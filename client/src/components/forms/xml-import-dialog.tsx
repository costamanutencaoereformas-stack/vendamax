import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileText, Edit2, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";

interface XMLProduct {
  cProd: string;
  xProd: string;
  NCM?: string;
  CFOP?: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  // Campos editáveis
  name: string;
  description?: string;
  costPrice: number;
  salePrice: number;
  categoryId?: string;
  supplierId?: string;
  currentStock: number;
  minimumStock?: number;
}

interface NFEData {
  supplier: {
    cnpj: string;
    name: string;
    email?: string;
    phone?: string;
  };
  products: XMLProduct[];
}

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
  cnpj: string;
}

interface XMLImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function XMLImportDialog({ open, onOpenChange }: XMLImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [nfeData, setNfeData] = useState<NFEData | null>(null);
  const [editingProducts, setEditingProducts] = useState<XMLProduct[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const { toast } = useToast();

  // Buscar categorias e fornecedores
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      return response.json();
    },
  });

  // Mutation para processar XML
  const parseXMLMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('xmlFile', file);
      
      const response = await fetch('/api/xml/parse-nfe', {
        method: 'POST',
        body: formData,
      });
      
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const errorBody = contentType.includes('application/json')
          ? await response.json()
          : await response.text();
        const message = typeof errorBody === 'string' ? errorBody : (errorBody?.message || 'Erro ao processar XML');
        throw new Error(message);
      }

      if (contentType.includes('application/json')) {
        return response.json();
      }
      // Fallback para texto (ex: servidor/proxy retornou HTML)
      const text = await response.text();
      throw new Error(text || 'Resposta não é JSON válida do servidor');
    },
    onSuccess: (data: NFEData) => {
      setNfeData(data);
      // Inicializar produtos editáveis com dados do XML
      const initialProducts = data.products.map(product => ({
        ...product,
        name: product.xProd,
        description: `${product.xProd} - NCM: ${product.NCM || 'N/A'}`,
        costPrice: product.vUnCom,
        salePrice: product.vUnCom * 1.3, // Margem de 30% por padrão
        currentStock: "0", // Estoque inicial zero, será atualizado pelo movimento de entrada
        minimumStock: Math.ceil(product.qCom * 0.1), // 10% do estoque da nota
      }));
      setEditingProducts(initialProducts);
      setStep('preview');
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar XML",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para importar produtos
  const importProductsMutation = useMutation({
    mutationFn: async (data: { supplier: any; products: XMLProduct[] }) => {
      const response = await fetch('/api/xml/import-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        if (response.status === 409) {
          const payload = await response.json().catch(() => ({}));
          const msg = payload?.message || 'XML já importado anteriormente.';
          throw new Error(msg);
        }
        const error = await response.text();
        throw new Error(error);
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      // Garantir atualização das listas
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] }); // compatibilidade caso exista em outro lugar
      
      toast({
        title: "Importação concluída",
        description: `${result.productsImported} produtos importados com sucesso. ${result.supplierCreated ? 'Fornecedor criado automaticamente.' : ''}`,
      });
      
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.name.endsWith('.xml')) {
      setFile(selectedFile);
    } else {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo XML válido.",
        variant: "destructive",
      });
    }
  };

  const handleProcessXML = () => {
    if (file) {
      setStep('importing');
      parseXMLMutation.mutate(file);
    }
  };

  const handleProductChange = (index: number, field: keyof XMLProduct, value: any) => {
    const updatedProducts = [...editingProducts];
    updatedProducts[index] = { ...updatedProducts[index], [field]: value };
    setEditingProducts(updatedProducts);
  };

  const handleImportProducts = () => {
    if (nfeData) {
      setStep('importing');
      importProductsMutation.mutate({
        supplier: nfeData.supplier,
        products: editingProducts,
        // @ts-expect-error include nfeNumber for backend duplicate prevention
        nfeNumber: (nfeData as any).nfeNumber,
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setNfeData(null);
    setEditingProducts([]);
    setStep('upload');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Produtos via XML da NFe
          </DialogTitle>
          <DialogDescription>
            Faça upload do arquivo XML da NFe para importar produtos automaticamente
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <Label htmlFor="xml-file" className="text-lg font-medium cursor-pointer">
                  Selecione o arquivo XML da NFe
                </Label>
                <p className="text-sm text-gray-500">
                  Apenas arquivos .xml são aceitos
                </p>
              </div>
              <Input
                id="xml-file"
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="mt-4 max-w-md mx-auto"
              />
            </div>

            {file && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">{file.name}</span>
                </div>
                <p className="text-sm text-blue-700">
                  Arquivo selecionado. Clique em "Processar XML" para continuar.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleProcessXML} 
                disabled={!file || parseXMLMutation.isPending}
              >
                {parseXMLMutation.isPending ? "Processando..." : "Processar XML"}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && nfeData && (
          <div className="space-y-6">
            {/* Informações do Fornecedor */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Fornecedor Identificado</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Nome:</span> {nfeData.supplier.name}
                </div>
                <div>
                  <span className="font-medium">CNPJ:</span> {nfeData.supplier.cnpj}
                </div>
              </div>
            </div>

            {/* Produtos para Edição */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Produtos Encontrados ({editingProducts.length})</h3>
                <Badge variant="outline">
                  <Edit2 className="h-3 w-3 mr-1" />
                  Editável
                </Badge>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código Original</TableHead>
                      <TableHead>Nome do Produto</TableHead>
                      <TableHead>Preço de Custo</TableHead>
                      <TableHead>Preço de Venda</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Estoque</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editingProducts.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">
                          {product.cProd}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={product.name}
                            onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                            className="min-w-[200px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={product.costPrice}
                            onChange={(e) => handleProductChange(index, 'costPrice', parseFloat(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={product.salePrice}
                            onChange={(e) => handleProductChange(index, 'salePrice', parseFloat(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={product.categoryId ?? "none"}
                            onValueChange={(value) => handleProductChange(index, 'categoryId', value === 'none' ? undefined : value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem categoria</SelectItem>
                              {categories?.map((category: Category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={product.currentStock}
                            onChange={(e) => handleProductChange(index, 'currentStock', parseInt(e.target.value))}
                            className="w-20"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImportProducts}
                disabled={importProductsMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                {importProductsMutation.isPending ? "Importando..." : "Importar Produtos"}
              </Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-lg font-medium">Processando importação...</p>
            <p className="text-sm text-gray-500">Isso pode levar alguns segundos</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
