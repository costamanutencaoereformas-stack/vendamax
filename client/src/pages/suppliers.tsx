import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Power, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "../components/PageHeader";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import SupplierForm from "@/components/forms/supplier-form";
import { formatDocument, formatPhone } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import type { Supplier } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: suppliers, isLoading, error } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers", { credentials: "include" });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      return (await res.json()) as Supplier[];
    },
  });

  // Removido: exclusão de fornecedores e toggle direto na lista

  // Mutação para ativar/inativar fornecedor
  const setActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: variables.isActive ? "Fornecedor ativado" : "Fornecedor inativado",
        description: "Status atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao alterar status",
        variant: "destructive",
      });
    },
  });

  const handleToggleActive = (s: Supplier) => {
    const action = s.isActive ? "inativar" : "ativar";
    if (confirm(`Tem certeza que deseja ${action} o fornecedor ${s.name}?`)) {
      setActive.mutate({ id: s.id, isActive: !s.isActive });
    }
  };

  const filteredSuppliers =
    suppliers?.filter((supplier: Supplier) =>
      supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.tradeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      supplier.cnpj?.includes(searchTerm) ||
      supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  // Removido: handler de exclusão

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

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600 font-medium">Erro ao carregar fornecedores</p>
            <p className="text-sm text-gray-600 mt-1">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fornecedores" crumbs={[]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
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
          <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Fornecedor</DialogTitle>
              <DialogDescription>Preencha os dados do fornecedor. Campos com * são obrigatórios.</DialogDescription>
            </DialogHeader>
            <SupplierForm onSuccess={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {searchTerm ? "Nenhum fornecedor encontrado." : "Nenhum fornecedor cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 px-3">Nome</th>
                <th className="py-2 px-3">Fantasia</th>
                <th className="py-2 px-3">Documento</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Telefone</th>
                <th className="py-2 px-3">Cidade/UF</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2 px-3 font-medium">{s.name}</td>
                  <td className="py-2 px-3">{s.tradeName || "-"}</td>
                  <td className="py-2 px-3">{formatDocument(s.cnpj)}</td>
                  <td className="py-2 px-3">{s.email || "-"}</td>
                  <td className="py-2 px-3">{s.phone ? formatPhone(s.phone) : "-"}</td>
                  <td className="py-2 px-3">{s.city && s.state ? `${s.city}/${s.state}` : "-"}</td>
                  <td className="py-2 px-3">
                    {s.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">Inativo</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingSupplier(s)}
                        title="Visualizar fornecedor"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setLocation(`/suppliers/${s.id}`)}
                        title="Detalhar fornecedor"
                      >
                        Detalhar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSupplier(s)}
                        title="Editar fornecedor"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(s)}
                        disabled={setActive.isPending}
                        title={s.isActive ? "Inativar fornecedor" : "Ativar fornecedor"}
                        className={s.isActive ? "text-orange-600 hover:text-orange-700" : "text-green-600 hover:text-green-700"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={() => setEditingSupplier(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Fornecedor</DialogTitle>
            <DialogDescription>Altere os dados necessários e salve para atualizar o fornecedor.</DialogDescription>
          </DialogHeader>
          {editingSupplier && (
            <SupplierForm supplier={editingSupplier} onSuccess={() => setEditingSupplier(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick View Dialog */}
      <Dialog open={!!viewingSupplier} onOpenChange={() => setViewingSupplier(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto w-[95vw] sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Fornecedor</DialogTitle>
            <DialogDescription>Visualização rápida dos dados (somente leitura).</DialogDescription>
          </DialogHeader>
          {viewingSupplier && (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">Nome</div>
                <div className="font-medium">{viewingSupplier.name || '-'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Fantasia</div>
                  <div>{viewingSupplier.tradeName || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">CNPJ</div>
                  <div className="font-mono">{formatDocument(viewingSupplier.cnpj) || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">E-mail</div>
                  <div>{viewingSupplier.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Telefone</div>
                  <div>{viewingSupplier.phone ? formatPhone(viewingSupplier.phone) : '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Endereço</div>
                <div>{viewingSupplier.address || '-'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Cidade</div>
                  <div>{viewingSupplier.city || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Estado</div>
                  <div>{viewingSupplier.state || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">CEP</div>
                  <div>{viewingSupplier.zipCode || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Condições de Pagamento</div>
                <div>{viewingSupplier.paymentTerms || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div>
                  {viewingSupplier.isActive ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 px-2 py-0.5 text-xs font-medium">Ativo</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2 py-0.5 text-xs font-medium">Inativo</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
