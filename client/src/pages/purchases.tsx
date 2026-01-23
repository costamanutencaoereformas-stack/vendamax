import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "@/contexts/search-context";
import type { PurchaseRequest, Supplier } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { X, Plus, CheckCircle, XCircle, FilePlus2, Pencil } from "lucide-react";

// Status chips
const statusMeta: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Rascunho", className: "bg-gray-100 text-gray-700 border border-gray-300" },
  SUBMITTED: { label: "Enviado", className: "bg-blue-50 text-blue-700 border border-blue-300" },
  APPROVED: { label: "Aprovado", className: "bg-green-50 text-green-700 border border-green-300" },
  REJECTED: { label: "Rejeitado", className: "bg-red-50 text-red-700 border border-red-300" },
};

export default function Purchases() {
  const { search } = useSearch();
  const { toast } = useToast();

  // Queries
  const { data: requests, isLoading } = useQuery<PurchaseRequest[]>({
    queryKey: ["/api/purchase-requests"],
    queryFn: async () => {
      const res = await fetch("/api/purchase-requests");
      if (!res.ok) throw new Error("Falha ao carregar solicitações de compra");
      return res.json();
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Nada selecionado");
      // 1) update header
      const up = await fetch(`/api/purchase-requests/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: editHeader.supplierId || null,
          requester: editHeader.requester || null,
          notes: editHeader.notes || null,
        }),
      });
      if (!up.ok) throw new Error("Falha ao salvar cabeçalho");
      // 2) delete removed items
      for (const rid of removedItemIds) {
        const dr = await fetch(`/api/purchase-request-items/${rid}`, { method: "DELETE" });
        if (!dr.ok) throw new Error("Falha ao remover item");
      }
      // 3) update edited existing items
      for (const it of existingItems) {
        if (removedItemIds.includes(it.id)) continue;
        if (!editedItemIds.includes(it.id)) continue;
        const payload: any = {
          productId: it.productId || null,
          description: it.productId ? null : (it.description || null),
          quantity: it.quantity,
          unitPrice: it.unitPrice != null ? it.unitPrice : null,
          total: it.unitPrice != null ? (Number(it.unitPrice) * Number(it.quantity)) : null,
        };
        const ur = await fetch(`/api/purchase-request-items/${it.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!ur.ok) throw new Error("Falha ao atualizar item");
      }
      // 4) add new items
      for (const it of newItems) {
        const ir = await fetch(`/api/purchase-requests/${selected.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: selected.id,
            productId: it.productId || null,
            description: it.productId ? null : (it.description || null),
            quantity: it.quantity,
            unitPrice: it.unitPrice != null ? it.unitPrice : null,
            total: it.unitPrice != null ? (Number(it.unitPrice) * Number(it.quantity)) : null,
          }),
        });
        if (!ir.ok) throw new Error("Falha ao adicionar item");
      }
      return true;
    },
    onSuccess: async () => {
      setOpenEdit(false);
      setSelected(null);
      setExistingItems([]);
      setNewItems([]);
      setRemovedItemIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({ title: "Solicitação atualizada", description: "Alterações salvas com sucesso." });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao salvar alterações", variant: "destructive" });
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Falha ao carregar fornecedores");
      return res.json();
    },
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return res.json();
    },
  });

  // Create dialog state
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState<{ supplierId: string | ""; requester: string; notes: string }>(
    { supplierId: "", requester: "", notes: "" }
  );
  const [items, setItems] = useState<Array<{ productId?: string; description?: string; quantity: number; unitPrice?: number }>>([]);
  const canSubmit = useMemo(() => items.length > 0 && items.every(it => (it.productId || it.description) && it.quantity > 0), [items]);

  // Quick-add supplier state
  const [openQuickSupplier, setOpenQuickSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState<{ name: string; cnpj: string; email?: string; phone?: string }>({ name: "", cnpj: "" });
  const quickAddSupplier = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplier.name,
          cnpj: newSupplier.cnpj,
          email: newSupplier.email || null,
          phone: newSupplier.phone || null,
          isActive: true,
        }),
      });
      if (!res.ok) throw new Error('Falha ao criar fornecedor');
      return res.json();
    },
    onSuccess: (created: any) => {
      setOpenQuickSupplier(false);
      setNewSupplier({ name: '', cnpj: '' });
      // refresh list and select created
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      // Pre-select in create dialog
      setForm((prev) => ({ ...prev, supplierId: created.id }));
      // Pre-select in edit dialog
      setEditHeader((prev) => ({ ...prev, supplierId: created.id }));
      toast({ title: 'Fornecedor criado', description: 'Fornecedor cadastrado com sucesso.' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro', description: e?.message || 'Falha ao criar fornecedor', variant: 'destructive' });
    }
  });

  // Edit dialog state
  const [openEdit, setOpenEdit] = useState(false);
  const [selected, setSelected] = useState<PurchaseRequest | null>(null);
  const [editHeader, setEditHeader] = useState<{ supplierId: string | ""; requester: string; notes: string }>({ supplierId: "", requester: "", notes: "" });
  const [existingItems, setExistingItems] = useState<any[]>([]);
  const [newItems, setNewItems] = useState<Array<{ productId?: string; description?: string; quantity: number; unitPrice?: number }>>([]);
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);
  const [editedItemIds, setEditedItemIds] = useState<string[]>([]);

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      // 1) create request
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: form.supplierId || null,
          requester: form.requester || null,
          notes: form.notes || null,
          status: "DRAFT",
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar solicitação");
      const created = await res.json();

      // 2) add items
      for (const it of items) {
        const ir = await fetch(`/api/purchase-requests/${created.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId: created.id,
            productId: it.productId || null,
            description: it.description || null,
            quantity: it.quantity,
            unitPrice: it.unitPrice != null ? it.unitPrice : null,
            total: it.unitPrice != null ? (Number(it.unitPrice) * Number(it.quantity)) : null,
          }),
        });
        if (!ir.ok) throw new Error("Erro ao adicionar item");
      }
      return created as PurchaseRequest;
    },
    onSuccess: () => {
      setOpenCreate(false);
      setForm({ supplierId: "", requester: "", notes: "" });
      setItems([]);
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      toast({ title: "Solicitação criada", description: "Solicitação de compra criada com sucesso." });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao criar solicitação", variant: "destructive" });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "APPROVED" | "REJECTED" | "SUBMITTED" | "DRAFT" }) => {
      const r = await fetch(`/api/purchase-requests/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error("Falha ao alterar status");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"] });
      // Also refresh products so user can verify auto-created products upon approval
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e?.message || "Falha ao alterar status", variant: "destructive" });
    },
  });

  // Filtering
  const list = Array.isArray(requests) ? requests : [];
  const filtered = list.filter((r) => {
    const term = (search || "").toLowerCase();
    if (!term) return true;
    return (
      (r.number || "").toLowerCase().includes(term) ||
      (r.requester || "").toLowerCase().includes(term) ||
      (r.notes || "").toLowerCase().includes(term)
    );
  });

  // Helpers
  const supplierName = (id?: string | null) => (Array.isArray(suppliers) ? suppliers.find(s => s.id === id)?.name : "-") || "-";
  const productName = (id?: string | null) => (Array.isArray(products) ? products.find(p => p.id === id)?.name : "-") || "-";

  // UI handlers
  const addItem = () => setItems((prev) => [...prev, { quantity: 1 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  useEffect(() => {
    // Pre-fill first item
    if (openCreate && items.length === 0) setItems([{ quantity: 1 }]);
  }, [openCreate]);

  useEffect(() => {
    // Load selection details when opening edit
    if (openEdit && selected) {
      setEditHeader({
        supplierId: ((selected as any).supplierId || "") as string,
        requester: ((selected as any).requester || "") as string,
        notes: ((selected as any).notes || "") as string,
      });
      // fetch items
      (async () => {
        try {
          const res = await fetch(`/api/purchase-requests/${selected.id}/items`);
          const arr = res.ok ? await res.json() : [];
          setExistingItems(arr);
          setNewItems([]);
          setRemovedItemIds([]);
          setEditedItemIds([]);
        } catch {
          setExistingItems([]);
        }
      })();
    } else if (!openEdit) {
      setExistingItems([]);
      setNewItems([]);
      setRemovedItemIds([]);
    }
  }, [openEdit, selected]);

  return (
    <div className="space-y-6">
      {/* Falcon Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Solicitações de Compra</h1>
          <nav className="breadcrumb mt-1">
            <a href="/">Início</a>
            <span className="breadcrumb-sep">/</span>
            <span>Compras</span>
          </nav>
        </div>
        <div className="toolbar">
          <Button onClick={() => setOpenCreate(true)}>
            <FilePlus2 className="h-4 w-4 mr-2" /> Nova Solicitação
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">Nenhuma solicitação encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground">
            <div className="col-span-2">Número</div>
            <div className="col-span-2">Fornecedor</div>
            <div className="col-span-2">Requisitante</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Observações</div>
            <div className="col-span-1 text-right">Ações</div>
          </div>
          <div className="divide-y">
            {filtered.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-muted/30">
                <div className="col-span-2 font-medium">{r.number}</div>
                <div className="col-span-2 truncate" title={supplierName((r as any).supplierId)}>{supplierName((r as any).supplierId)}</div>
                <div className="col-span-2 truncate">{(r as any).requester || '-'}</div>
                <div className="col-span-2">
                  <Badge variant="secondary" className={(statusMeta[(r as any).status]?.className || statusMeta.DRAFT.className)}>
                    {statusMeta[(r as any).status || 'DRAFT']?.label}
                  </Badge>
                </div>
                <div className="col-span-3 truncate" title={(r as any).notes || ''}>{(r as any).notes || '-'}</div>
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelected(r as any); setOpenEdit(true); }}
                    title="Visualizar/Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {(r as any).status !== 'APPROVED' && (
                    <Button variant="ghost" size="sm" onClick={() => setStatusMutation.mutate({ id: r.id, status: 'APPROVED' })} title="Aprovar">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  {(r as any).status !== 'REJECTED' && (
                    <Button variant="ghost" size="sm" onClick={() => setStatusMutation.mutate({ id: r.id, status: 'REJECTED' })} title="Rejeitar">
                      <XCircle className="h-4 w-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Compra</DialogTitle>
            <DialogDescription>Preencha os dados e adicione ao menos um item.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Fornecedor</Label>
                    <select
                      className="h-9 border rounded-md px-2 bg-white w-full"
                      value={form.supplierId}
                      onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <Button variant="outline" onClick={() => setOpenQuickSupplier(true)} title="Cadastrar fornecedor rapidamente">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Requisitante</Label>
                <Input value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} placeholder="Nome do requisitante" />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas" />
              </div>
            </div>

            {/* Items table */}
            <div className="border rounded-md overflow-x-auto">
              <div className="min-w-[720px] divide-y">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-4">Produto ou Descrição</div>
                  <div className="col-span-2 text-right">Qtd</div>
                  <div className="col-span-2 text-right">Preço Un.</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-2 text-right">Ações</div>
                </div>
                {items.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500">Nenhum item.</div>
                ) : (
                  items.map((it, idx) => {
                    const total = (it.unitPrice != null && !isNaN(Number(it.unitPrice))) ? Number(it.unitPrice) * Number(it.quantity || 0) : 0;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2">
                        <div className="col-span-4">
                          <div className="flex gap-2">
                            <select
                              className="h-9 border rounded-md px-2 bg-white w-full"
                              value={it.productId || ""}
                              onChange={(e) => setItems(prev => prev.map((p, i) => i === idx ? { ...p, productId: e.target.value || undefined, description: undefined } : p))}
                            >
                              <option value="">(Sem produto)</option>
                              {(Array.isArray(products) ? products : []).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          {!it.productId && (
                            <div className="mt-2">
                              <Input
                                placeholder="Descrição do item"
                                value={it.description || ""}
                                onChange={(e) => setItems(prev => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => setItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, Number(e.target.value)) } : p))}
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.unitPrice ?? ""}
                            onChange={(e) => setItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: e.target.value === "" ? undefined : Number(e.target.value) } : p))}
                          />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end pr-2">
                          <span className="text-sm font-medium">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Footer total */}
                {items.length > 0 && (
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30">
                    <div className="col-span-8 text-right font-medium">Total itens</div>
                    <div className="col-span-2 text-right font-semibold pr-2">
                      {items.reduce((sum, it) => {
                        const t = (it.unitPrice != null) ? Number(it.unitPrice) * Number(it.quantity || 0) : 0;
                        return sum + t;
                      }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div className="col-span-2" />
                  </div>
                )}
              </div>
            </div>
            <div>
              <Button variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-2"/>Adicionar Item</Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
              <Button disabled={!canSubmit || createRequestMutation.isPending} onClick={() => createRequestMutation.mutate()}>
                {createRequestMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Visualizar/Editar Solicitação</DialogTitle>
            <DialogDescription>Atualize o cabeçalho e gerencie os itens.</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Fornecedor</Label>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <select
                        className="h-9 border rounded-md px-2 bg-white w-full"
                        value={editHeader.supplierId}
                        onChange={(e) => setEditHeader({ ...editHeader, supplierId: e.target.value })}
                      >
                        <option value="">Selecione</option>
                        {(Array.isArray(suppliers) ? suppliers : []).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <Button variant="outline" onClick={() => setOpenQuickSupplier(true)} title="Cadastrar fornecedor rapidamente">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Requisitante</Label>
                  <Input value={editHeader.requester} onChange={(e) => setEditHeader({ ...editHeader, requester: e.target.value })} placeholder="Nome do requisitante" />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Input value={editHeader.notes} onChange={(e) => setEditHeader({ ...editHeader, notes: e.target.value })} placeholder="Notas" />
                </div>
              </div>

              {/* Items list */}
              <div className="border rounded-md overflow-x-auto">
                <div className="min-w-[760px] divide-y">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    <div className="col-span-4">Produto</div>
                    <div className="col-span-2 text-right">Qtd</div>
                    <div className="col-span-2 text-right">Preço Un.</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-2 text-right">Ações</div>
                  </div>
                  {/* Existing items (editable inline) */}
                  {existingItems.map((it: any, idx: number) => {
                    const removed = removedItemIds.includes(it.id);
                    const total = (it.unitPrice != null && !isNaN(Number(it.unitPrice))) ? Number(it.unitPrice) * Number(it.quantity || 0) : 0;
                    const markEdited = () => setEditedItemIds(prev => prev.includes(it.id) ? prev : [...prev, it.id]);
                    return (
                      <div key={it.id} className={`grid grid-cols-12 gap-2 px-3 py-2 ${removed ? 'opacity-40' : ''}`}>
                        <div className="col-span-4">
                          <div className="flex gap-2">
                            <select
                              className="h-9 border rounded-md px-2 bg-white w-full"
                              value={it.productId || ""}
                              onChange={(e) => {
                                const val = e.target.value || undefined;
                                setExistingItems(prev => prev.map((p, i) => i === idx ? { ...p, productId: val, description: val ? undefined : p.description } : p));
                                markEdited();
                              }}
                              disabled={removed}
                            >
                              <option value="">(Sem produto)</option>
                              {(Array.isArray(products) ? products : []).map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          {/* Free text when no product */}
                          {!it.productId && (
                            <div className="mt-2">
                              <Input
                                placeholder="Descrição do item"
                                value={it.description || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setExistingItems(prev => prev.map((p, i) => i === idx ? { ...p, description: val } : p));
                                  markEdited();
                                }}
                                disabled={removed}
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, Number(e.target.value));
                              setExistingItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: v } : p));
                              markEdited();
                            }}
                            disabled={removed}
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.unitPrice ?? ""}
                            onChange={(e) => {
                              const v = e.target.value === "" ? undefined : Number(e.target.value);
                              setExistingItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: v } : p));
                              markEdited();
                            }}
                            disabled={removed}
                          />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end pr-2">
                          <span className="text-sm font-medium">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setRemovedItemIds(prev => removed ? prev.filter(id => id !== it.id) : [...prev, it.id])}>
                            {removed ? 'Desfazer' : 'Remover'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {/* New items (editable) */}
                  {newItems.map((it, idx) => {
                    const total = (it.unitPrice != null && !isNaN(Number(it.unitPrice))) ? Number(it.unitPrice) * Number(it.quantity || 0) : 0;
                    return (
                      <div key={`new-${idx}`} className="grid grid-cols-12 gap-2 px-3 py-2">
                        <div className="col-span-4">
                          <select
                            className="h-9 border rounded-md px-2 bg-white w-full"
                            value={it.productId || ""}
                            onChange={(e) => setNewItems(prev => prev.map((p, i) => i === idx ? { ...p, productId: e.target.value || undefined, description: undefined } : p))}
                          >
                            <option value="">(Sem produto)</option>
                            {(Array.isArray(products) ? products : []).map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                          {!it.productId && (
                            <div className="mt-2">
                              <Input
                                placeholder="Descrição do item"
                                value={it.description || ""}
                                onChange={(e) => setNewItems(prev => prev.map((p, i) => i === idx ? { ...p, description: e.target.value } : p))}
                              />
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={1}
                            value={it.quantity}
                            onChange={(e) => setNewItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: Math.max(1, Number(e.target.value)) } : p))}
                          />
                        </div>
                        <div className="col-span-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={it.unitPrice ?? ""}
                            onChange={(e) => setNewItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: e.target.value === "" ? undefined : Number(e.target.value) } : p))}
                          />
                        </div>
                        <div className="col-span-2 text-right flex items-center justify-end pr-2">
                          <span className="text-sm font-medium">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setNewItems(prev => prev.filter((_, i) => i !== idx))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {/* Footer total */}
                  {(existingItems.length + newItems.length) > 0 && (
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/30">
                      <div className="col-span-8 text-right font-medium">Total itens</div>
                      <div className="col-span-2 text-right font-semibold pr-2">
                        {(() => {
                          const total = [...existingItems.filter((it:any)=>!removedItemIds.includes(it.id)), ...newItems].reduce((sum: number, it: any) => {
                            const up = it.unitPrice != null ? Number(it.unitPrice) : 0;
                            const qty = Number(it.quantity || 0);
                            return sum + (up * qty);
                          }, 0);
                          return total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        })()}
                      </div>
                      <div className="col-span-2" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Button variant="outline" onClick={() => setNewItems(prev => [...prev, { quantity: 1 }])}><Plus className="h-4 w-4 mr-2"/>Adicionar Item</Button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpenEdit(false)}>Fechar</Button>
                <Button disabled={updateRequestMutation.isPending} onClick={() => updateRequestMutation.mutate()}>
                  {updateRequestMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Supplier Dialog */}
      <Dialog open={openQuickSupplier} onOpenChange={setOpenQuickSupplier}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>Cadastre rapidamente um fornecedor para vincular à solicitação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="Ex.: ABC Materiais" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={newSupplier.cnpj} onChange={(e) => setNewSupplier({ ...newSupplier, cnpj: e.target.value })} placeholder="Somente números" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Email (opcional)</Label>
                <Input value={newSupplier.email || ''} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder="email@fornecedor.com" />
              </div>
              <div>
                <Label>Telefone (opcional)</Label>
                <Input value={newSupplier.phone || ''} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpenQuickSupplier(false)}>Cancelar</Button>
              <Button disabled={quickAddSupplier.isPending || !newSupplier.name || !newSupplier.cnpj} onClick={() => quickAddSupplier.mutate()}>
                {quickAddSupplier.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
