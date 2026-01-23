import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertContractSchema } from "@shared/schema";

export type Contract = {
  id: string;
  number: string;
  title: string;
  customerId: string | null;
  supplierId: string | null;
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

const contractFormSchema = insertContractSchema.extend({
  number: z.string().min(1, "Número é obrigatório"),
  title: z.string().min(1, "Título é obrigatório"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  cancelDate: z.string().optional().nullable(),
  totalValue: z.union([z.string(), z.number()]).optional().nullable(),
}).refine((data) => !!data.customerId || !!data.supplierId, {
  message: "Selecione um cliente ou um fornecedor",
  path: ["customerId"],
});

interface ContractFormProps {
  contract?: Contract;
  onSuccess?: () => void;
}

export default function ContractForm({ contract, onSuccess }: ContractFormProps) {
  const { toast } = useToast();

  const customersQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return res.json();
    },
  });

  const suppliersQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Falha ao carregar fornecedores");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof contractFormSchema>>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      number: contract?.number || "",
      title: contract?.title || "",
      customerId: contract?.customerId || null,
      supplierId: contract?.supplierId || null,
      projectId: contract?.projectId || null,
      status: contract?.status || "DRAFT",
      startDate: contract?.startDate || null,
      endDate: contract?.endDate || null,
      totalValue: contract?.totalValue ?? "",
      paymentTerms: contract?.paymentTerms || "",
      renewal: contract?.renewal || "NONE",
      cancelDate: contract?.cancelDate || null,
      notes: contract?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contractFormSchema>) => {
      const payload = normalizePayload(data);
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contrato criado" });
      onSuccess?.();
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message || String(err), variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contractFormSchema>) => {
      const payload = normalizePayload(data);
      const res = await fetch(`/api/contracts/${contract!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-role": "admin" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast({ title: "Contrato atualizado" });
      onSuccess?.();
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message || String(err), variant: "destructive" }),
  });

  const onSubmit = (data: z.infer<typeof contractFormSchema>) => {
    if (contract) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="number">Número *</Label>
          <Input id="number" {...form.register("number")} placeholder="CTR000001" />
        </div>
        <div>
          <Label htmlFor="title">Título *</Label>
          <Input id="title" {...form.register("title")} placeholder="Título do contrato" />
        </div>

        <div>
          <Label htmlFor="customerId">Cliente</Label>
          <div className="flex items-center gap-2">
            <Select
              value={(form.watch("customerId") as string | null) || undefined}
              onValueChange={(v) => form.setValue("customerId", v || null)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={customersQuery.isLoading ? "Carregando..." : "Selecione um cliente (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                {(customersQuery.data || []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("customerId", null)}>
              Limpar
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="supplierId">Fornecedor</Label>
          <div className="flex items-center gap-2">
            <Select
              value={(form.watch("supplierId") as string | null) || undefined}
              onValueChange={(v) => form.setValue("supplierId", v || null)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={suppliersQuery.isLoading ? "Carregando..." : "Selecione um fornecedor (opcional)"} />
              </SelectTrigger>
              <SelectContent>
                {(suppliersQuery.data || []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" onClick={() => form.setValue("supplierId", null)}>
              Limpar
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={form.watch("status")!} onValueChange={(v) => form.setValue("status", v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Rascunho</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="SUSPENDED">Suspenso</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
              <SelectItem value="COMPLETED">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="renewal">Renovação</Label>
          <Select value={(form.watch("renewal") || "NONE")!} onValueChange={(v) => form.setValue("renewal", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Nenhuma</SelectItem>
              <SelectItem value="AUTO">Automática</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="startDate">Início</Label>
          <Input id="startDate" type="date" value={dateInputValue(form.watch("startDate"))} onChange={(e) => form.setValue("startDate", e.target.value || null)} />
        </div>
        <div>
          <Label htmlFor="endDate">Fim</Label>
          <Input id="endDate" type="date" value={dateInputValue(form.watch("endDate"))} onChange={(e) => form.setValue("endDate", e.target.value || null)} />
        </div>

        <div>
          <Label htmlFor="totalValue">Valor Total</Label>
          <Input id="totalValue" type="number" step="0.01" placeholder="0.00" {...form.register("totalValue")} />
        </div>
        <div>
          <Label htmlFor="paymentTerms">Condições de Pagamento</Label>
          <Input id="paymentTerms" {...form.register("paymentTerms")} placeholder="30/60/90" />
        </div>

        <div className="col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" rows={3} {...form.register("notes")} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : contract ? "Atualizar" : "Criar"}</Button>
      </div>
    </form>
  );
}

function normalizePayload(data: any) {
  return {
    number: data.number,
    title: data.title,
    customerId: data.customerId || null,
    supplierId: data.supplierId || null,
    projectId: data.projectId || null,
    status: data.status,
    startDate: toDateOrNull(data.startDate),
    endDate: toDateOrNull(data.endDate),
    totalValue: data.totalValue === "" || data.totalValue == null ? null : String(data.totalValue),
    paymentTerms: emptyToNull(data.paymentTerms),
    renewal: emptyToNull(data.renewal) || "NONE",
    cancelDate: toDateOrNull(data.cancelDate),
    notes: emptyToNull(data.notes),
  };
}

function emptyToNull(v: any) { return v === undefined || v === null || v === "" ? null : v; }
function toDateOrNull(v: any) { return v ? new Date(v).toISOString() : null; }
function dateInputValue(v: string | null | undefined) { return v ? v.substring(0, 10) : ""; }
