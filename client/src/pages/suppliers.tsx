import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SupplierForm from "@/components/forms/supplier-form";
import { formatDocument, formatPhone } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete supplier");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Fornecedor excluído",
        description: "Fornecedor foi excluído com sucesso.",
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

  const filteredSuppliers = suppliers?.filter((supplier: Supplier) =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.tradeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.cnpj.includes(searchTerm) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleDelete = (supplier: Supplier) => {
    if (confirm(`Tem certeza que deseja excluir o fornecedor ${supplier.name}?`)) {
      deleteMutation.mutate(supplier.id);
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
            placeholder="Buscar fornecedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Fornecedor</DialogTitle>
            </DialogHeader>
            <SupplierForm
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Suppliers Grid */}
      {filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {searchTerm ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier: Supplier) => (
            <Card key={supplier.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{supplier.name}</CardTitle>
                      {supplier.tradeName && (
                        <p className="text-sm text-gray-500">{supplier.tradeName}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {formatDocument(supplier.cnpj)}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSupplier(supplier)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(supplier)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {supplier.email && (
                    <p className="text-sm text-gray-600">{supplier.email}</p>
                  )}
                  {supplier.phone && (
                    <p className="text-sm text-gray-600">{formatPhone(supplier.phone)}</p>
                  )}
                  {supplier.city && supplier.state && (
                    <p className="text-sm text-gray-600">{supplier.city}, {supplier.state}</p>
                  )}
                  {supplier.paymentTerms && (
                    <div className="pt-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Condições de Pagamento:</p>
                      <p className="text-sm text-gray-600">{supplier.paymentTerms}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
          </DialogHeader>
          {editingSupplier && (
            <SupplierForm
              supplier={editingSupplier}
              onSuccess={() => setEditingSupplier(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
