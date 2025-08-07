import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Eye, Trash2, ShoppingCart, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Sale, Customer, Quote } from "@shared/schema";

const statusConfig = {
  COMPLETED: { label: "Concluída", variant: "default" as const, color: "bg-green-100 text-green-800" },
  PROCESSING: { label: "Processando", variant: "secondary" as const, color: "bg-yellow-100 text-yellow-800" },
  CANCELLED: { label: "Cancelada", variant: "outline" as const, color: "bg-red-100 text-red-800" },
};

const paymentMethods = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
};

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  const { data: sales, isLoading } = useQuery({
    queryKey: ["/api/sales"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: quotes } = useQuery({
    queryKey: ["/api/quotes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sales/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete sale");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Venda excluída",
        description: "Venda foi excluída com sucesso.",
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
      const response = await fetch(`/api/sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update sale status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Status atualizado",
        description: "Status da venda foi atualizado com sucesso.",
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

  const filteredSales = sales?.filter((sale: Sale) => {
    const customer = customers?.find((c: Customer) => c.id === sale.customerId);
    const matchesSearch = sale.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sale.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || sale.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find((c: Customer) => c.id === customerId);
    return customer?.name || "Cliente não encontrado";
  };

  const getQuoteNumber = (quoteId: string | null) => {
    if (!quoteId) return null;
    const quote = quotes?.find((q: Quote) => q.id === quoteId);
    return quote?.number || null;
  };

  const handleDelete = (sale: Sale) => {
    if (confirm(`Tem certeza que deseja excluir a venda ${sale.number}?`)) {
      deleteMutation.mutate(sale.id);
    }
  };

  const handleStatusChange = (sale: Sale, status: string) => {
    updateStatusMutation.mutate({ id: sale.id, status });
  };

  const handleCreateSale = () => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de criação de vendas em desenvolvimento. Use a conversão de orçamentos.",
    });
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
        <div className="flex flex-1 space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar vendas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="COMPLETED">Concluídas</SelectItem>
              <SelectItem value="PROCESSING">Processando</SelectItem>
              <SelectItem value="CANCELLED">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button onClick={handleCreateSale}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total de Vendas</p>
                <p className="text-xl font-bold">{sales?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Faturamento Total</p>
                <p className="text-xl font-bold">
                  {formatCurrency(
                    sales?.reduce((sum: number, sale: Sale) => 
                      sum + parseFloat(sale.total), 0) || 0
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="text-sm text-gray-600">Concluídas</p>
                <p className="text-xl font-bold">
                  {sales?.filter((s: Sale) => s.status === 'COMPLETED').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div>
                <p className="text-sm text-gray-600">Processando</p>
                <p className="text-xl font-bold">
                  {sales?.filter((s: Sale) => s.status === 'PROCESSING').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Vendas</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchTerm || filterStatus !== "all" 
                  ? "Nenhuma venda encontrada com os filtros aplicados." 
                  : "Nenhuma venda registrada ainda."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Número</th>
                    <th className="text-left py-3 px-4 font-medium">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium">Valor</th>
                    <th className="text-left py-3 px-4 font-medium">Pagamento</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                    <th className="text-left py-3 px-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale: Sale) => {
                    const status = statusConfig[sale.status as keyof typeof statusConfig];
                    const quoteNumber = getQuoteNumber(sale.quoteId);
                    
                    return (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{sale.number}</p>
                            {quoteNumber && (
                              <p className="text-xs text-gray-500">Orç: {quoteNumber}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{getCustomerName(sale.customerId)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{formatCurrency(sale.total)}</p>
                          {parseFloat(sale.discount) > 0 && (
                            <p className="text-xs text-gray-500">
                              Desc: {formatCurrency(sale.discount)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline">
                            {paymentMethods[sale.paymentMethod as keyof typeof paymentMethods]}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {sale.createdAt ? formatDateTime(sale.createdAt) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingSale(sale)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {sale.status === 'PROCESSING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusChange(sale, 'COMPLETED')}
                              >
                                Concluir
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(sale)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Sale Dialog */}
      <Dialog open={!!viewingSale} onOpenChange={() => setViewingSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda</DialogTitle>
          </DialogHeader>
          {viewingSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Número:</Label>
                  <p className="font-medium">{viewingSale.number}</p>
                </div>
                <div>
                  <Label>Cliente:</Label>
                  <p className="font-medium">{getCustomerName(viewingSale.customerId)}</p>
                </div>
                <div>
                  <Label>Status:</Label>
                  <Badge variant={statusConfig[viewingSale.status as keyof typeof statusConfig].variant}>
                    {statusConfig[viewingSale.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
                <div>
                  <Label>Forma de Pagamento:</Label>
                  <p className="font-medium">
                    {paymentMethods[viewingSale.paymentMethod as keyof typeof paymentMethods]}
                  </p>
                </div>
                <div>
                  <Label>Subtotal:</Label>
                  <p className="font-medium">{formatCurrency(viewingSale.subtotal)}</p>
                </div>
                <div>
                  <Label>Desconto:</Label>
                  <p className="font-medium">{formatCurrency(viewingSale.discount)}</p>
                </div>
                <div className="col-span-2">
                  <Label>Total:</Label>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(viewingSale.total)}</p>
                </div>
                {getQuoteNumber(viewingSale.quoteId) && (
                  <div className="col-span-2">
                    <Label>Orçamento de Origem:</Label>
                    <p className="font-medium">{getQuoteNumber(viewingSale.quoteId)}</p>
                  </div>
                )}
              </div>
              
              {viewingSale.notes && (
                <div>
                  <Label>Observações:</Label>
                  <p className="text-sm text-gray-600 mt-1">{viewingSale.notes}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setViewingSale(null)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  toast({
                    title: "Em desenvolvimento",
                    description: "Funcionalidade de impressão em desenvolvimento.",
                  });
                }}>
                  Imprimir NF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
