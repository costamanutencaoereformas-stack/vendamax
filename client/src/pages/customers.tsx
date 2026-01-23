import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, User, Building2, Power, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PageHeader from "../components/PageHeader";
import { CustomerFormWizard } from "@/components/forms/customer-form-wizard";
import { formatDocument, formatPhone } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
interface Customer {
  id: string;
  name: string;
  document: string;
  documentType: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  responsible?: string | null;
  segment?: string | null;
  observations?: string | null;
  isActive: boolean;
  classification: string;
  createdAt: Date | null;
}

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error("Failed to fetch customers");
      return response.json();
    },
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

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ customerId, currentStatus, customerName }: { 
      customerId: string; 
      currentStatus: boolean; 
      customerName: string; 
    }) => {
      try {
        const newStatus = !currentStatus;
        console.log(`Alterando status do cliente ${customerName} de ${currentStatus} para ${newStatus}`);
        
        const response = await fetch(`/api/customers/${customerId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: newStatus }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Cliente atualizado com sucesso:', result);
        return { ...result, wasActive: currentStatus };
      } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      const action = data.wasActive ? "inativado" : "ativado";
      toast({
        title: `Cliente ${action}`,
        description: `O cliente foi ${action} com sucesso.`,
      });
    },
    onError: (error: any) => {
      console.error('Erro na mutation:', error);
      toast({
        title: "Erro",
        description: `Erro ao alterar status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.document.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleToggleActive = (customer: Customer) => {
    const action = customer.isActive ? "inativar" : "ativar";
    console.log(`Tentando ${action} cliente:`, customer.name, 'Status atual:', customer.isActive);
    
    if (confirm(`Tem certeza que deseja ${action} o cliente ${customer.name}?`)) {
      console.log('Executando mutation...');
      toggleActiveMutation.mutate({
        customerId: customer.id,
        currentStatus: customer.isActive,
        customerName: customer.name
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
          <div className="border rounded-lg bg-card">
            <div className="h-12 bg-muted/50 border-b"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 border-b bg-card">
                <div className="flex items-center h-full px-4 space-x-4">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-4 bg-muted rounded w-28"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" crumbs={[]} />

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
          <DialogContent className="w-screen h-screen md:h-auto md:max-w-2xl md:w-[720px] max-w-screen overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Cliente</DialogTitle>
              <DialogDescription>
                Preencha as informações do cliente seguindo as etapas do formulário.
              </DialogDescription>
            </DialogHeader>
            <CustomerFormWizard
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Customers Table */}
      <div className="border rounded-lg overflow-x-auto bg-card">
        <div className="min-w-[900px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Cliente</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Segmento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer: Customer) => (
                <TableRow key={customer.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        {customer.documentType === 'CNPJ' ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {customer.classification || "Regular"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {formatDocument(customer.document)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {customer.documentType}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.email && (
                        <div className="text-sm">{customer.email}</div>
                      )}
                      {customer.phone && (
                        <div className="text-sm text-muted-foreground">
                          {formatPhone(customer.phone)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.city && customer.state ? (
                      <div className="text-sm">
                        <div>{customer.city}</div>
                        <div className="text-muted-foreground">{customer.state}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.responsible ? (
                      <span className="text-sm">{customer.responsible}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {customer.segment ? (
                      <span className="text-sm">{customer.segment}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.isActive ? "default" : "secondary"}>
                      {customer.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingCustomer(customer)}
                        title="Visualizar cliente"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setLocation(`/customers/${customer.id}`)}
                        title="Detalhar cliente"
                      >
                        Detalhar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCustomer(customer)}
                        title="Editar cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(customer)}
                        disabled={toggleActiveMutation.isPending}
                        title={customer.isActive ? "Inativar cliente" : "Ativar cliente"}
                        className={customer.isActive ? "text-destructive" : "text-primary"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={() => setEditingCustomer(null)}>
        <DialogContent className="w-screen h-screen md:h-auto md:max-w-2xl md:w-[720px] max-w-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Edite as informações do cliente nos campos abaixo.
            </DialogDescription>
          </DialogHeader>
          {editingCustomer && (
            <CustomerFormWizard
              customer={editingCustomer}
              onSuccess={() => setEditingCustomer(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick View Dialog */}
      <Dialog open={!!viewingCustomer} onOpenChange={() => setViewingCustomer(null)}>
        <DialogContent className="w-screen h-screen md:h-auto md:max-w-xl md:w-[640px] max-w-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
            <DialogDescription>
              Visualização rápida dos dados. Este modo é somente leitura.
            </DialogDescription>
          </DialogHeader>
          {viewingCustomer && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted-foreground">Nome</div>
                <div className="font-medium">{viewingCustomer.name || '-'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Documento</div>
                  <div className="font-mono text-sm">{formatDocument(viewingCustomer.document)}</div>
                  <div className="text-xs text-muted-foreground">{viewingCustomer.documentType}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Classificação</div>
                  <div>{viewingCustomer.classification || 'Regular'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">E-mail</div>
                  <div>{viewingCustomer.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Telefone</div>
                  <div>{viewingCustomer.phone ? formatPhone(viewingCustomer.phone) : '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Endereço</div>
                <div>{viewingCustomer.address || '-'}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Cidade</div>
                  <div>{viewingCustomer.city || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Estado</div>
                  <div>{viewingCustomer.state || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">CEP</div>
                  <div>{viewingCustomer.zipCode || '-'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Responsável</div>
                  <div>{viewingCustomer.responsible || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Segmento</div>
                  <div>{viewingCustomer.segment || '-'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div>
                  <Badge variant={viewingCustomer.isActive ? 'default' : 'secondary'}>
                    {viewingCustomer.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
              {viewingCustomer.observations && (
                <div>
                  <div className="text-xs text-muted-foreground">Observações</div>
                  <div className="whitespace-pre-line text-sm text-foreground">
                    {viewingCustomer.observations}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
