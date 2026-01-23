import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { QuoteAttachment } from "@shared/schema";

type FileWithPreview = {
  id: string;
  file: File;
  preview: string;
  isNew: boolean;
};

interface FileUploadProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  existingAttachments?: QuoteAttachment[];
  onDeleteAttachment?: (id: string) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
}

export function FileUpload({
  onFilesChange,
  existingAttachments = [],
  onDeleteAttachment,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx",
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Limpar objetos URL quando o componente for desmontado
  useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview.startsWith('blob:')) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const handleFileChange = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    const validFiles: FileWithPreview[] = [];
    const invalidFiles: string[] = [];

    // Filtra os arquivos que ainda não foram adicionados
    const existingFileNames = files.map(f => f.file.name.toLowerCase());
    
    Array.from(newFiles).forEach((file) => {
      // Verifica se o arquivo já foi adicionado
      if (existingFileNames.includes(file.name.toLowerCase())) {
        toast({
          title: "Arquivo duplicado",
          description: `O arquivo "${file.name}" já foi adicionado.`,
          variant: "default",
        });
        return;
      }
      
      // Verifica o tamanho do arquivo
      if (file.size > maxSizeMB * 1024 * 1024) {
        invalidFiles.push(`${file.name} (Tamanho máximo: ${maxSizeMB}MB)`);
        return;
      }

      // Cria um objeto FileWithPreview para o novo arquivo
      validFiles.push({
        id: URL.createObjectURL(file), // Usa a URL do objeto como ID temporário
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : getFileIcon(file.type),
        isNew: true,
      });
    });

    // Mostra mensagem de erro para arquivos inválidos
    if (invalidFiles.length > 0) {
      toast({
        title: "Arquivos inválidos",
        description: `Os seguintes arquivos excedem o tamanho máximo de ${maxSizeMB}MB: ${invalidFiles.join(", ")}`,
        variant: "destructive",
      });
    }

    // Limita o número total de arquivos ao máximo permitido
    const updatedFiles = [...files, ...validFiles].slice(0, maxFiles);
    
    // Atualiza o estado local e notifica o componente pai
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const handleDelete = async (id: string, isNew: boolean) => {
    if (!isNew && onDeleteAttachment) {
      await onDeleteAttachment(id);
    }
    
    const updatedFiles = files.filter((file) => file.id !== id);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const getFileIcon = (fileType: string) => {
    const icons: Record<string, string> = {
      "application/pdf": "📄",
      "application/msword": "📝",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
      "application/vnd.ms-excel": "📊",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
      "image/": "🖼️",
    };

    // Return specific icon if found, or try to match by type prefix
    return (
      icons[fileType] || 
      (fileType.startsWith('image/') ? '🖼️' : '📄')
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (files.length >= maxFiles) {
            toast({
              title: "Limite de arquivos atingido",
              description: `Você pode enviar no máximo ${maxFiles} arquivos.`,
              variant: "destructive",
            });
            return;
          }
          handleFileChange(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">Clique para enviar</span> ou arraste e solte
          </div>
          <p className="text-xs text-muted-foreground">
            {`${accept.split(',').join(', ').replace(/\./g, ' ').toUpperCase()} (Máx. ${maxSizeMB}MB cada)`}
          </p>
        </div>
        <Input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept={accept}
          onChange={(e) => handleFileChange(e.target.files)}
        />
      </div>

      {(files.length > 0 || existingAttachments.length > 0) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Arquivos anexados</h4>
          <div className="grid gap-2">
            {existingAttachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
              >
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center h-8 w-8 text-2xl">
                    {getFileIcon(attachment.fileType)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{attachment.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSize)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(attachment.id, false);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
              >
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center h-8 w-8 text-2xl">
                    {getFileIcon(file.file.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file.id, true);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
