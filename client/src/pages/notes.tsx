import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Edit3, Trash2, Pin, PinOff, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

const colors = [
  { name: "Padrão", value: "bg-white", border: "border-gray-200" },
  { name: "Amarelo", value: "bg-yellow-100", border: "border-yellow-200" },
  { name: "Verde", value: "bg-green-100", border: "border-green-200" },
  { name: "Azul", value: "bg-blue-100", border: "border-blue-200" },
  { name: "Rosa", value: "bg-pink-100", border: "border-pink-200" },
  { name: "Roxo", value: "bg-purple-100", border: "border-purple-200" },
  { name: "Laranja", value: "bg-orange-100", border: "border-orange-200" },
];

export default function NotesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({ title: "", content: "", color: "bg-white" });

  // Fetch notes from API
  const { data: notes = [], isLoading } = useQuery<any[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      const response = await fetch('/api/notes');
      if (!response.ok) throw new Error('Failed to fetch notes');
      return response.json();
    },
  });

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    note.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(note => note.isPinned);
  const unpinnedNotes = filteredNotes.filter(note => !note.isPinned);

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: { title: string; content: string; color: string }) => {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteData.title || "Nota sem título",
          content: noteData.content,
          color: noteData.color,
          isPinned: false,
        }),
      });
      if (!response.ok) throw new Error('Failed to create note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setNewNote({ title: "", content: "", color: "bg-white" });
      setIsCreating(false);
      toast({ title: "Nota criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar nota", variant: "destructive" });
    },
  });

  const createNote = () => {
    if (!newNote.title.trim() && !newNote.content.trim()) {
      toast({ title: "Erro", description: "Adicione um título ou conteúdo", variant: "destructive" });
      return;
    }
    createNoteMutation.mutate(newNote);
  };

  const updateNoteMutation = useMutation({
    mutationFn: async (updatedNote: Note) => {
      const response = await fetch(`/api/notes/${updatedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedNote.title,
          content: updatedNote.content,
          color: updatedNote.color,
          isPinned: updatedNote.isPinned,
        }),
      });
      if (!response.ok) throw new Error('Failed to update note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setEditingNote(null);
      toast({ title: "Nota atualizada!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar nota", variant: "destructive" });
    },
  });

  const updateNote = (updatedNote: Note) => {
    updateNoteMutation.mutate(updatedNote);
  };

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete note');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: "Nota excluída!" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir nota", variant: "destructive" });
    },
  });

  const deleteNote = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta nota?")) {
      deleteNoteMutation.mutate(id);
    }
  };

  const togglePin = (id: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      updateNote({ ...note, isPinned: !note.isPinned });
    }
  };

  const changeNoteColor = (id: string, color: string) => {
    const note = notes.find(n => n.id === id);
    if (note) {
      updateNote({ ...note, color });
    }
  };

  const NoteCard = ({ note }: { note: Note }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const colorConfig = colors.find(c => c.value === note.color) || colors[0];

    return (
      <Card className={cn(
        "group relative transition-all duration-200 hover:shadow-md cursor-pointer",
        colorConfig.value,
        colorConfig.border
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-sm line-clamp-2 flex-1 pr-2">
              {note.title}
            </h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePin(note.id);
                }}
              >
                {note.isPinned ? (
                  <PinOff className="h-3 w-3" />
                ) : (
                  <Pin className="h-3 w-3" />
                )}
              </Button>
              <div className="relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(!showColorPicker);
                  }}
                >
                  <Palette className="h-3 w-3" />
                </Button>
                {showColorPicker && (
                  <div className="absolute top-8 right-0 bg-white border rounded-lg shadow-lg p-2 z-10">
                    <div className="grid grid-cols-4 gap-1">
                      {colors.map((color) => (
                        <button
                          key={color.value}
                          className={cn(
                            "w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform",
                            color.value,
                            color.border,
                            note.color === color.value && "ring-2 ring-blue-500"
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            changeNoteColor(note.id, color.value);
                            setShowColorPicker(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingNote(note);
                }}
              >
                <Edit3 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteNote(note.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
            {note.content}
          </p>
          <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
            <span>{new Date(note.updatedAt).toLocaleDateString('pt-BR')}</span>
            {note.isPinned && (
              <Badge variant="secondary" className="text-xs">
                <Pin className="h-3 w-3 mr-1" />
                Fixada
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Anotações Rápidas</h1>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Nota
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Pesquisar notas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <Card className={cn("border-2 border-dashed", newNote.color)}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <Input
                placeholder="Título da nota"
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Escreva sua nota aqui..."
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform",
                        color.value,
                        color.border,
                        newNote.color === color.value && "ring-2 ring-blue-500"
                      )}
                      onClick={() => setNewNote(prev => ({ ...prev, color: color.value }))}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCreating(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={createNote}>
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className={cn("w-full max-w-md", editingNote.color)}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Editar Nota</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingNote(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Título da nota"
                value={editingNote.title}
                onChange={(e) => setEditingNote(prev => prev ? { ...prev, title: e.target.value } : null)}
              />
              <Textarea
                placeholder="Conteúdo da nota"
                value={editingNote.content}
                onChange={(e) => setEditingNote(prev => prev ? { ...prev, content: e.target.value } : null)}
                rows={6}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform",
                        color.value,
                        color.border,
                        editingNote.color === color.value && "ring-2 ring-blue-500"
                      )}
                      onClick={() => setEditingNote(prev => prev ? { ...prev, color: color.value } : null)}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditingNote(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => editingNote && updateNote(editingNote)}>
                    Salvar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pinned Notes */}
      {pinnedNotes.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Pin className="h-4 w-4 mr-2" />
            Fixadas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {/* Other Notes */}
      {unpinnedNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && (
            <h2 className="text-lg font-medium mb-4">Outras</h2>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unpinnedNotes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            Carregando notas...
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredNotes.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Plus className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? "Nenhuma nota encontrada" : "Nenhuma nota criada"}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchTerm 
              ? "Tente pesquisar com outros termos" 
              : "Comece criando sua primeira anotação rápida"
            }
          </p>
          {!searchTerm && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira nota
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
