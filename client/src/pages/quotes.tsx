import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Eye, Trash2, FileText, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import QuoteForm from "@/components/forms/quote-form";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Quote, Customer } from "@shared/schema";

const statusConfig = {
  PENDING: { label: "Pendente", variant: "default" as const, color: "text-blue-600" },
  APPROVED: { label: "Aprovado", variant: "default" as const, color: "text-green-600" },
  REJECTED: { label: "Rejeitado", variant: "secondary" as const, color: "text-red-600" },
  CONVERTED: { label: "Convertido", variant: "default" as const, color: "text-purple-600" },
};

export default function Quotes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const { toast } = useToast();

  const { data: quotes, isLoading } = useQuery({
    queryKey: ["/api/quotes"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/quotes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete quote");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Orçamento excluído",
        description: "Orçamento foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update quote status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Status atualizado",
        description: "Status do orçamento foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredQuotes = quotes?.filter((quote: Quote) => {
    const customer = customers?.find((c: Customer) => c.id === quote.customerId);
    return quote.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
           customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           quote.notes?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find((c: Customer) => c.id === customerId);
    return customer?.name || "Cliente não encontrado";
  };

  const handleDelete = (quote: Quote) => {
    if (confirm(`Tem certeza que deseja excluir o orçamento ${quote.number}?`)) {
      deleteMutation.mutate(quote.id);
    }
  };

  const handleStatusChange = (quote: Quote, status: string) => {
    updateStatusMutation.mutate({ id: quote.id, status });
  };

  const isExpired = (quote: Quote) => {
    return new Date(quote.validUntil) < new Date();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar orçamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Criar Orçamento</DialogTitle>
            </DialogHeader>
            <QuoteForm
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Quotes Grid */}
      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {searchTerm ? "Nenhum orçamento encontrado." : "Nenhum orçamento criado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuotes.map((quote: Quote) => {
            const status = statusConfig[quote.status as keyof typeof statusConfig] || statusConfig.PENDING;
            const expired = isExpired(quote);
            
            return (
              <Card key={quote.id} className={`hover:shadow-md transition-shadow ${expired ? 'border-red-200' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{quote.number}</CardTitle>
                        <p className="text-sm text-gray-500">{getCustomerName(quote.customerId)}</p>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingQuote(quote)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingQuote(quote)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(quote)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor total:</span>
                      <span className="text-sm font-medium">
                        {formatCurrency(quote.total)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Válido até:</span>
                      <span className={`text-sm ${expired ? 'text-red-600 font-medium' : ''}`}>
                        {formatDate(quote.validUntil)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                      {expired && quote.status === 'PENDING' && (
                        <Badge variant="destructive">Vencido</Badge>
                      )}
                    </div>
                    
                    {quote.status === 'PENDING' && !expired && (
                      <div className="flex space-x-1 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(quote, 'APPROVED')}
                          className="flex-1 text-green-600 hover:bg-green-50"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(quote, 'REJECTED')}
                          className="flex-1 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingQuote} onOpenChange={() => setEditingQuote(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Orçamento</DialogTitle>
          </DialogHeader>
          {editingQuote && (
            <QuoteForm
              quote={editingQuote}
              onSuccess={() => setEditingQuote(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewingQuote} onOpenChange={() => setViewingQuote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Orçamento</DialogTitle>
          </DialogHeader>
          {viewingQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número:</Label>
                  <p className="font-medium">{viewingQuote.number}</p>
                </div>
                <div>
                  <Label>Cliente:</Label>
                  <p className="font-medium">{getCustomerName(viewingQuote.customerId)}</p>
                </div>
                <div>
                  <Label>Status:</Label>
                  <Badge variant={statusConfig[viewingQuote.status as keyof typeof statusConfig].variant}>
                    {statusConfig[viewingQuote.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
                <div>
                  <Label>Válido até:</Label>
                  <p className="font-medium">{formatDate(viewingQuote.validUntil)}</p>
                </div>
                <div>
                  <Label>Subtotal:</Label>
                  <p className="font-medium">{formatCurrency(viewingQuote.subtotal)}</p>
                </div>
                <div>
                  <Label>Desconto:</Label>
                  <p className="font-medium">{formatCurrency(viewingQuote.discount)}</p>
                </div>
                <div className="col-span-2">
                  <Label>Total:</Label>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(viewingQuote.total)}</p>
                </div>
              </div>
              
              {viewingQuote.notes && (
                <div>
                  <Label>Observações:</Label>
                  <p className="text-sm text-gray-600 mt-1">{viewingQuote.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setViewingQuote(null)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  // TODO: Implement PDF generation
                  toast({
                    title: "Em desenvolvimento",
                    description: "Funcionalidade de impressão em desenvolvimento.",
                  });
                }}>
                  Imprimir PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
