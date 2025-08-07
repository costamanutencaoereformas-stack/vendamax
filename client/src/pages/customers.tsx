import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CustomerForm from "@/components/forms/customer-form";
import { formatDocument, formatPhone } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete customer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Cliente excluído",
        description: "Cliente foi excluído com sucesso.",
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

  const filteredCustomers = customers?.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.document.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = (customer: Customer) => {
    if (confirm(`Tem certeza que deseja excluir o cliente ${customer.name}?`)) {
      deleteMutation.mutate(customer.id);
    }
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
            placeholder="Buscar clientes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Cliente</DialogTitle>
            </DialogHeader>
            <CustomerForm
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Customers Grid */}
      {filteredCustomers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer: Customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {customer.documentType === 'CNPJ' ? (
                        <Building2 className="h-5 w-5 text-gray-600" />
                      ) : (
                        <User className="h-5 w-5 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {formatDocument(customer.document)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCustomer(customer)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(customer)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {customer.email && (
                    <p className="text-sm text-gray-600">{customer.email}</p>
                  )}
                  {customer.phone && (
                    <p className="text-sm text-gray-600">{formatPhone(customer.phone)}</p>
                  )}
                  {customer.city && customer.state && (
                    <p className="text-sm text-gray-600">{customer.city}, {customer.state}</p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant={customer.isActive ? "default" : "secondary"}>
                      {customer.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <Badge variant="outline">
                      {customer.classification || "Regular"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          {editingCustomer && (
            <CustomerForm
              customer={editingCustomer}
              onSuccess={() => setEditingCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
