import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ContractForm from "@/components/forms/contract-form";

type Contract = {
  id: string;
  number: string;
  title: string;
  customerId: string | null;
  projectId: string | null;
  status: "DRAFT" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "COMPLETED";
  startDate: string | null;
  endDate: string | null;
  totalValue: string | number | null;
  paymentTerms: string | null;
  renewal: string | null;
  cancelDate: string | null;
  notes: string | null;
  createdAt: string | null;
};

async function fetchContracts(): Promise<Contract[]> {
  const res = await fetch("/api/contracts", { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export default function ContractsPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery({ queryKey: ["contracts"], queryFn: fetchContracts });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
        headers: { "x-user-role": "admin" },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao excluir contrato");
      }
    },
    onSuccess: () => {
      toast({ title: "Contrato excluído" });
      refetch();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message || String(err), variant: "destructive" });
    },
  });

  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contract | null>(null);

  return (
    <div className="space-y-6 min-w-[900px]">
      <div className="flex items-center justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo Contrato</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo Contrato</DialogTitle>
            </DialogHeader>
            <ContractForm onSuccess={() => { setOpen(false); refetch(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contratos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Carregando...</TableCell>
                  </TableRow>
                )}
                {!isLoading && (data ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Nenhum contrato encontrado</TableCell>
                  </TableRow>
                )}
                {(data ?? []).map((c) => {
                  const total = c.totalValue == null ? 0 : Number(c.totalValue);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.number}</TableCell>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{statusLabel(c.status)}</TableCell>
                      <TableCell>{c.startDate ? formatDate(c.startDate) : "-"}</TableCell>
                      <TableCell>{c.endDate ? formatDate(c.endDate) : "-"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditing(c); setEditOpen(true); }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(c.id)}
                        >
                          {remove.isPending ? "Excluindo..." : "Excluir (admin)"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Contrato</DialogTitle>
          </DialogHeader>
          {editing && (
            <ContractForm
              contract={editing as any}
              onSuccess={() => { setEditOpen(false); setEditing(null); refetch(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusLabel(s: Contract["status"]) {
  switch (s) {
    case "DRAFT": return "Rascunho";
    case "ACTIVE": return "Ativo";
    case "SUSPENDED": return "Suspenso";
    case "CANCELLED": return "Cancelado";
    case "COMPLETED": return "Concluído";
    default: return s;
  }
}
