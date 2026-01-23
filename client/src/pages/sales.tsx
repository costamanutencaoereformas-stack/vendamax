import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Eye, XCircle, ShoppingCart, CreditCard, FileText, CheckCircle, Pencil, Copy, MoreHorizontal, Filter, DollarSign, TrendingUp, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/formatters";
import ProductPicker from "@/components/product-picker";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Sale, Customer, Quote, Product, QuoteItem, SaleItem, Project } from "@shared/schema";
import ExportSaleButton from "@/components/ExportSaleButton";

const statusConfig = {
  COMPLETED: { label: "Concluída", variant: "default" as const, color: "bg-green-200 text-green-900 border border-green-500" },
  PROCESSING: { label: "Processando", variant: "secondary" as const, color: "bg-yellow-200 text-yellow-900 border border-yellow-500" },
  CANCELLED: { label: "Cancelada", variant: "outline" as const, color: "bg-red-200 text-red-900 border border-red-500" },
};

const paymentMethods = {
  CASH: "Dinheiro",
  CARD: "Cartão",
  PIX: "PIX",
  BOLETO: "Boleto",
};

export default function Sales() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterDueDateStart, setFilterDueDateStart] = useState<string>("");
  const [filterDueDateEnd, setFilterDueDateEnd] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'blank' | 'fromQuote' | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editingSaleItems, setEditingSaleItems] = useState<SaleItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  // Ensure dialogs are mutually exclusive to avoid overlapping modals
  useEffect(() => {
    if (viewingSale) {
      setIsCreateOpen(false);
    }
  }, [viewingSale]);

  useEffect(() => {
    if (isCreateOpen) {
      setViewingSale(null);
    }
  }, [isCreateOpen]);

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Products for mapping productId -> product name in preview
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: quotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  // Load the original quote details when viewing a sale that was created from a quote
  const { data: viewingQuote } = useQuery<Quote | null>({
    queryKey: ["/api/quotes", viewingSale?.quoteId],
    queryFn: async () => {
      if (!viewingSale?.quoteId) return null;
      const r = await fetch(`/api/quotes/${viewingSale.quoteId}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!viewingSale?.quoteId,
  });

  // Carregar projetos para seleção
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Falha ao carregar projetos");
      return res.json();
    },
  });

  // Handle navigation from quotes page: /sales?fromQuote=<id>
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuoteId = params.get("fromQuote");
      if (!fromQuoteId) return;

      // Only proceed when quotes and sales are loaded
      if (!Array.isArray(quotes) || !Array.isArray(sales)) return;

      const q = quotes.find((x) => x.id === fromQuoteId) || null;
      if (!q) {
        toast({ title: "Orçamento não encontrado", description: "O orçamento informado não existe.", variant: "destructive" });
        return;
      }

      // Prevent using a quote that is not approved or already used
      const alreadyUsed = (sales || []).some((s) => s.quoteId === q.id);
      if (q.status !== 'APPROVED') {
        toast({ title: "Não é possível converter", description: "Apenas orçamentos aprovados podem virar venda.", variant: "destructive" });
        return;
      }
      if (alreadyUsed) {
        toast({ title: "Já convertido", description: `O orçamento ${q.number} já foi convertido em venda.`, variant: "destructive" });
        return;
      }

      // Open create dialog in fromQuote mode with preselected quote
      setCreateMode('fromQuote');
      setSelectedQuote(q);
      setIsCreateOpen(true);
    } catch (e) {
      // Fail silently but log for debugging
      console.warn('[sales] Falha ao processar parametro fromQuote', e);
    }
  }, [quotes, sales]);

  // Manual sale state
  type ManualItem = {
    kind: 'product' | 'service';
    productId?: string | null;
    serviceDescription?: string | null;
    quantity: number;
    unitPrice: number;
  };

  // From Quote: allow choosing payment and adding extra items
  const [fromQuotePaymentMethod, setFromQuotePaymentMethod] = useState<keyof typeof paymentMethods>("PIX");
  const [additionalItems, setAdditionalItems] = useState<ManualItem[]>([]);
  const [fromQuoteDueDate, setFromQuoteDueDate] = useState<string>("");
  const [fromQuoteNotes, setFromQuoteNotes] = useState<string>("");
  const addAdditionalItem = (kind: 'product'|'service') => {
    setAdditionalItems((prev) => [
      ...prev,
      { kind, productId: null, serviceDescription: kind === 'service' ? '' : null, quantity: 1, unitPrice: 0 },
    ]);
  };
  const removeAdditionalItem = (index: number) => {
    setAdditionalItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateAdditionalItem = (index: number, patch: Partial<ManualItem>) => {
    setAdditionalItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const additionalSubtotal = useMemo(() =>
    additionalItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitPrice || 0)), 0),
  [additionalItems]);
  const combinedSubtotalFromQuote = useMemo(() => (selectedQuote ? Number(selectedQuote.subtotal) : 0) + additionalSubtotal, [selectedQuote, additionalSubtotal]);
  const combinedTotalFromQuote = useMemo(() => {
    const baseDiscount = Number(selectedQuote?.discount ?? 0);
    return Math.max(0, combinedSubtotalFromQuote - baseDiscount);
  }, [combinedSubtotalFromQuote, selectedQuote]);
  const [manualCustomerId, setManualCustomerId] = useState<string>("");
  const [manualPaymentMethod, setManualPaymentMethod] = useState<keyof typeof paymentMethods>("CASH");
  const [manualDueDate, setManualDueDate] = useState<string>("");
  const [manualDiscount, setManualDiscount] = useState<number>(0);
  const [manualNotes, setManualNotes] = useState<string>("");
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [manualProjectId, setManualProjectId] = useState<string>("");

  const addManualItem = (kind: 'product'|'service') => {
    setManualItems((prev) => [
      ...prev,
      { kind, productId: null, serviceDescription: kind === 'service' ? '' : null, quantity: 1, unitPrice: 0 },
    ]);
  };
  const removeManualItem = (index: number) => {
    setManualItems((prev) => prev.filter((_, i) => i !== index));
  };
  const updateManualItem = (index: number, patch: Partial<ManualItem>) => {
    setManualItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const manualSubtotal = useMemo(() =>
    manualItems.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitPrice || 0)), 0),
  [manualItems]);
  const manualTotal = useMemo(() => Math.max(0, manualSubtotal - Number(manualDiscount || 0)), [manualSubtotal, manualDiscount]);

  const resetManualForm = () => {
    setManualCustomerId("");
    setManualPaymentMethod("CASH");
    setManualDueDate("");
    setManualDiscount(0);
    setManualNotes("");
    setManualItems([]);
    setManualProjectId("");
  };

  const createManualSale = useMutation({
    mutationFn: async () => {
      if (!manualCustomerId) throw new Error('Selecione um cliente');
      if (manualItems.length === 0) throw new Error('Adicione ao menos um item');

      // Build sale payload
      const payload: any = {
        number: `VEN-MAN-${Date.now()}`,
        customerId: manualCustomerId,
        projectId: manualProjectId || null,
        quoteId: null,
        status: 'PROCESSING',
        paymentMethod: manualPaymentMethod,
        subtotal: Number(manualSubtotal).toFixed(2),
        discount: Number(manualDiscount || 0).toFixed(2),
        total: Number(manualTotal).toFixed(2),
        notes: manualNotes || undefined,
        dueDate: manualDueDate || undefined,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Falha ao criar venda');
      }
      const sale: Sale = await res.json();

      // Create items sequentially
      for (const it of manualItems) {
        const itemPayload: any = {
          productId: it.kind === 'product' ? it.productId : undefined,
          serviceDescription: it.kind === 'service' ? (it.serviceDescription || 'Serviço') : undefined,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0).toFixed(2),
          total: (Number(it.quantity) * Number(it.unitPrice || 0)).toFixed(2),
        };
        const r = await fetch(`/api/sales/${sale.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        });
        if (!r.ok) {
          const msg = await r.text();
          throw new Error(msg || 'Falha ao criar item da venda');
        }
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      setIsCreateOpen(false);
      setCreateMode(null);
      resetManualForm();
      toast({ title: 'Venda criada', description: 'Venda manual criada com sucesso.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar venda', description: error.message, variant: 'destructive' });
    },
  });

  // Approved quotes for conversion, excluding those already converted (i.e., already used in a sale)
  const usedQuoteIds = new Set((sales ?? []).map((s) => s.quoteId).filter((id): id is string => !!id));
  const approvedQuotes: Quote[] = (quotes ?? [])
    .filter((q: Quote) => q.status === 'APPROVED' && !usedQuoteIds.has(q.id));

  // Items of the selected quote (for preview)
  const { data: selectedQuoteItems, isLoading: selectedQuoteItemsLoading } = useQuery<QuoteItem[]>({
    queryKey: ["/api/quotes", selectedQuote?.id, "items"],
    queryFn: async () => {
      const resp = await fetch(`/api/quotes/${selectedQuote!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens do orçamento");
      return resp.json();
    },
    enabled: !!selectedQuote?.id,
  });

  // Items of the viewing sale (for details dialog)
  const { data: viewingSaleItems, isLoading: viewingSaleItemsLoading, error: viewingSaleItemsError } = useQuery<SaleItem[]>({
    queryKey: ["/api/sales", viewingSale?.id, "items"],
    queryFn: async () => {
      const resp = await fetch(`/api/sales/${viewingSale!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens da venda");
      return resp.json();
    },
    enabled: !!viewingSale?.id,
  });

  // Debug helpers: log errors and loaded items for the viewing sale
  useEffect(() => {
    if (viewingSaleItemsError && viewingSale?.id) {
      console.error("[sales] Erro ao carregar itens da venda", viewingSale.id, viewingSaleItemsError);
    }
  }, [viewingSaleItemsError, viewingSale?.id]);

  useEffect(() => {
    if (viewingSale?.id && viewingSaleItems) {
      console.debug("[sales] Itens da venda carregados", viewingSale.id, viewingSaleItems);
    }
  }, [viewingSale?.id, viewingSaleItems]);

  // remove delete; cancellation will be handled via updateStatusMutation

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentMethod, dueDate, notes, discount }: { id: string; status: string; paymentMethod?: string; dueDate?: Date; notes?: string; discount?: number | string }) => {
      const payload: any = { status };
      
      // Adicionar campos opcionais se fornecidos
      if (paymentMethod !== undefined) payload.paymentMethod = paymentMethod;
      if (dueDate !== undefined) payload.dueDate = dueDate;
      if (notes !== undefined) payload.notes = notes;
      if (discount !== undefined) payload.discount = discount;
      
      const response = await fetch(`/api/sales/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Falha ao atualizar a venda");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Venda atualizada",
        description: "Venda foi atualizada com sucesso.",
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

  // Atualizar itens da venda
  const updateSaleItemsMutation = useMutation({
    mutationFn: async ({ saleId, items }: { saleId: string, items: SaleItem[] }) => {
      const response = await fetch(`/api/sales/${saleId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) throw new Error("Falha ao atualizar itens da venda");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales", "items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "Itens atualizados",
        description: "Itens da venda foram atualizados com sucesso.",
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
    const project = projects?.find((p: Project) => p.id === sale.projectId);
    const matchesSearch = sale.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === "all" || sale.status === filterStatus;
    const matchesProject = filterProject === "all" || sale.projectId === filterProject;
    const matchesCustomer = filterCustomer === "all" || sale.customerId === filterCustomer;
    const matchesPayment = filterPayment === "all" || sale.paymentMethod === filterPayment;
    let dueDateISO = sale.dueDate ? (typeof sale.dueDate === 'string' ? sale.dueDate.slice(0,10) : sale.dueDate.toISOString().slice(0,10)) : null;
    const matchesDueDateStart = !filterDueDateStart || (dueDateISO && dueDateISO >= filterDueDateStart);
    const matchesDueDateEnd = !filterDueDateEnd || (dueDateISO && dueDateISO <= filterDueDateEnd);
    return matchesSearch && matchesStatus && matchesProject && matchesCustomer && matchesPayment && matchesDueDateStart && matchesDueDateEnd;
  }) || [];

  // Build PDF document for the viewing sale
  const viewingSaleDoc = useMemo(() => {
    if (!viewingSale) return null;
    const customer = customers?.find((c: Customer) => c.id === viewingSale.customerId);
    const items = (viewingSaleItems || []).map((it) => {
      const prod = products?.find((p: any) => p.id === it.productId);
      return {
        code: prod?.code || undefined,
        description: it.productId ? (prod?.name || String(it.productId)) : (it.serviceDescription || "Serviço"),
        unit: prod?.unit || "un",
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice || 0),
        discount: Number(it.discount || 0),
      };
    });
    const address = [customer?.address, customer?.city, customer?.state, customer?.zipCode].filter(Boolean).join(" · ");
    const contact = [customer?.phone, customer?.email].filter(Boolean).join(" · ");
    // prefer ISO date for HTML generator formatting (YYYY-MM-DD)
    const dateIso = viewingSale.createdAt ? new Date(viewingSale.createdAt).toISOString().slice(0, 10) : "";
    return {
      company: {
        name: "",
        cnpj: "",
        address: "",
        cityUf: "",
        phone: "",
        email: "",
      },
      customer: {
        name: customer?.name || "",
        doc: customer?.document || undefined,
        address: address || undefined,
        contact: contact || undefined,
      },
      sale: {
        number: viewingSale.number,
        date: dateIso,
        paymentMethod: paymentMethods[viewingSale.paymentMethod as keyof typeof paymentMethods],
        notes: viewingSale.notes || "",
      },
      items,
      totals: {
        subtotal: Number(viewingSale.subtotal || 0),
        discountTotal: Number(viewingSale.discount || 0),
        grandTotal: Number(viewingSale.total || 0),
      },
      signatures: undefined,
    } as const;
  }, [viewingSale, viewingSaleItems, customers, products]);

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find((c: Customer) => c.id === customerId);
    return customer?.name || "Cliente não encontrado";
  };

  const getQuoteNumber = (quoteId: string | null) => {
    if (!quoteId) return null;
    const quote = quotes?.find((q: Quote) => q.id === quoteId);
    return quote?.number || null;
  };

  const getProductName = (productId?: string | null) => {
    if (!productId) return undefined;
    const product = (products as any[])?.find?.((p: any) => p.id === productId);
    return product?.name as string | undefined;
  };

  const getProductCode = (productId?: string | null) => {
    if (!productId) return undefined;
    const product = (products as any[])?.find?.((p: any) => p.id === productId);
    return product?.code as string | undefined;
  };

  const handleCancel = (sale: Sale) => {
    if (sale.status === 'CANCELLED') return;
    if (confirm(`Cancelar a venda ${sale.number}? Ela não será contabilizada nos relatórios.`)) {
      handleStatusChange(sale, 'CANCELLED');
    }
  };

  const handleStatusChange = (sale: Sale, status: string) => {
    updateStatusMutation.mutate({ id: sale.id, status });
  };

  const handleSaleUpdate = (sale: Sale, updates: Partial<Sale>) => {
    updateStatusMutation.mutate({ 
      id: sale.id, 
      status: (updates.status || sale.status) as string,
      paymentMethod: updates.paymentMethod as string | undefined,
      dueDate: updates.dueDate as Date | undefined,
      notes: updates.notes as string | undefined,
      discount: updates.discount as any,
    });
  };

  const handleCreateSale = () => {
    setCreateMode(null);
    setSelectedQuote(null);
    setIsCreateOpen(true);
  };

  const createFromQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedQuote) throw new Error('Selecione um orçamento aprovado');
      
      // Fetch quote items first
      const quoteItems = await fetch(`/api/quotes/${selectedQuote.id}/items`).then(res => res.json());
      
      // Create payload with quote items
      const payload = {
        number: `VEN-${selectedQuote.number}-${Date.now()}`,
        quoteId: selectedQuote.id,
        customerId: selectedQuote.customerId,
        projectId: (selectedQuote as any).projectId || null,
        status: 'PROCESSING',
        subtotal: (Number.isFinite(combinedSubtotalFromQuote) ? combinedSubtotalFromQuote.toFixed(2) : String(combinedSubtotalFromQuote)),
        discount: (selectedQuote.discount != null ? Number(selectedQuote.discount) : 0).toFixed(2),
        total: (Number.isFinite(combinedTotalFromQuote) ? combinedTotalFromQuote.toFixed(2) : String(combinedTotalFromQuote)),
        notes: [
          `Criado a partir do orçamento ${selectedQuote.number}`,
          selectedQuote.notes,
          selectedQuote.paymentTerms ? `Condição de pagamento: ${selectedQuote.paymentTerms}` : null,
          fromQuoteNotes || null
        ].filter(Boolean).join('\n'),
        paymentMethod: fromQuotePaymentMethod,
        dueDate: fromQuoteDueDate || undefined,
        // Include quote items in the payload to ensure they're processed
        items: quoteItems.map((item: any) => ({
          productId: item.productId || null,
          serviceDescription: item.serviceDescription || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || '0',
          total: item.total
        }))
      };
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Falha ao criar venda');
      }
      const sale: Sale = await res.json();

      // Criar itens adicionais APENAS se houver itens extras além dos do orçamento
      // Os itens do orçamento são automaticamente copiados pelo backend
      if (additionalItems.length > 0) {
        console.log(`[Sales] Criando ${additionalItems.length} itens adicionais para venda ${sale.id}`);
        
        for (const it of additionalItems) {
          const itemPayload: any = {
            productId: it.kind === 'product' ? it.productId : undefined,
            serviceDescription: it.kind === 'service' ? (it.serviceDescription || 'Serviço') : undefined,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: Number(it.quantity) * Number(it.unitPrice || 0),
          };
          const r = await fetch(`/api/sales/${sale.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemPayload),
          });
          if (!r.ok) {
            const msg = await r.text();
            throw new Error(msg || 'Falha ao criar item adicional da venda');
          }
        }
        console.log(`[Sales] Itens adicionais criados com sucesso para venda ${sale.id}`);
      } else {
        console.log(`[Sales] Venda ${sale.id} criada sem itens adicionais, apenas com itens do orçamento`);
      }

      return sale;
    },
    onSuccess: () => {
      setIsCreateOpen(false);
      setSelectedQuote(null);
      setCreateMode(null);
      setAdditionalItems([]);
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({ title: 'Venda criada', description: 'Venda criada a partir do orçamento aprovado.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar venda', description: error.message, variant: 'destructive' });
    },
  });

  // Duplicar venda
  const duplicateSale = async (sale: Sale) => {
    try {
      // Fetch items of the sale
      const itemsResp = await fetch(`/api/sales/${sale.id}/items`);
      if (!itemsResp.ok) throw new Error("Falha ao carregar itens da venda");
      const items: SaleItem[] = await itemsResp.json();

      // Prepare new sale payload (remove id, number, createdAt, quoteId, projectId, userId)
      const payload: any = {
        number: `VEN-DUP-${Date.now()}`,
        customerId: sale.customerId,
        status: 'PROCESSING',
        paymentMethod: sale.paymentMethod,
        subtotal: sale.subtotal,
        discount: sale.discount,
        total: sale.total,
        notes: sale.notes,
        dueDate: sale.dueDate,
        // projectId: sale.projectId, // optionally copy project
      };

      // Create new sale
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text() || 'Falha ao duplicar venda');
      const newSale: Sale = await res.json();

      // Create items for new sale
      for (const it of items) {
        const itemPayload: any = {
          productId: it.productId,
          serviceDescription: it.serviceDescription,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
          total: it.total,
          serviceCost: it.serviceCost,
        };
        const r = await fetch(`/api/sales/${newSale.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(itemPayload),
        });
        if (!r.ok) throw new Error(await r.text() || 'Falha ao duplicar item da venda');
      }

      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({ title: 'Venda duplicada', description: `A venda ${sale.number} foi duplicada com sucesso.` });
    } catch (err: any) {
      toast({ title: 'Erro ao duplicar venda', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>

              {/* Sale Items List */}
              <div>
                <Label>Itens da Venda</Label>
                <div className="mt-2 border rounded-md divide-y">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    <div className="col-span-4">Produto/Serviço</div>
                    <div className="col-span-2 text-right">Qtd</div>
                    <div className="col-span-2 text-right">Preço Un.</div>
                    <div className="col-span-2 text-right">Desconto</div>
                    <div className="col-span-2 text-right">Total</div>
                  </div>
                  {viewingSaleItemsLoading ? (
                    <div className="px-3 py-4 text-sm text-gray-500">Carregando itens...</div>
                  ) : (viewingSaleItems || []).length > 0 ? (
                    (viewingSaleItems || []).map((item: any) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                        <div className="col-span-4 truncate">
                          {item.productId ? (
                            <span>
                              <span className="font-medium">Produto:</span>{" "}
                              {getProductName(item.productId) || item.productId}
                              {(() => {
                                const code = getProductCode(item.productId);
                                return code ? ` (code: ${code})` : "";
                              })()}
                            </span>
                          ) : (
                            <span>
                              <span className="font-medium">Serviço:</span>{" "}
                              {item.serviceDescription || 'Serviço'}
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-right">{item.quantity}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item?.unitPrice ?? 0)}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item?.discount ?? 0)}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item?.total ?? 0)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-gray-500">Nenhum item.</div>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-green-50 min-h-screen">
      {/* Filters Card */}
      <Card className="shadow-lg border-green-100">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Filter className="h-5 w-5" />
              Filtros de Vendas
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => { setCreateMode('blank'); setIsCreateOpen(true); }}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Venda
              </Button>
              <Button
                onClick={() => { setCreateMode('fromQuote'); setIsCreateOpen(true); }}
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                De Orçamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Linha 1: Busca */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="search-sales" className="text-xs font-medium text-gray-700">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search-sales"
                  placeholder="Número, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Linha 2: Filtros principais em grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-status" className="text-xs font-medium text-gray-700">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger id="filter-status">
                    <SelectValue placeholder="Todos Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="COMPLETED">Concluídas</SelectItem>
                    <SelectItem value="PROCESSING">Processando</SelectItem>
                    <SelectItem value="CANCELLED">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-customer" className="text-xs font-medium text-gray-700">Cliente</Label>
                <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                  <SelectTrigger id="filter-customer">
                    <SelectValue placeholder="Todos Clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Clientes</SelectItem>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-payment" className="text-xs font-medium text-gray-700">Pagamento</Label>
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger id="filter-payment">
                    <SelectValue placeholder="Todas Formas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Formas</SelectItem>
                    {Object.entries(paymentMethods).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-project" className="text-xs font-medium text-gray-700">Projeto</Label>
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger id="filter-project">
                    <SelectValue placeholder="Todos Projetos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Projetos</SelectItem>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 3: Filtros de data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-date-start" className="text-xs font-medium text-gray-700">Vencimento (De)</Label>
                <Input
                  id="filter-date-start"
                  type="date"
                  value={filterDueDateStart}
                  onChange={e => setFilterDueDateStart(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="filter-date-end" className="text-xs font-medium text-gray-700">Vencimento (Até)</Label>
                <Input
                  id="filter-date-end"
                  type="date"
                  value={filterDueDateEnd}
                  onChange={e => setFilterDueDateEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {(searchTerm || filterStatus !== "all" || filterProject !== "all" || filterCustomer !== "all" || filterPayment !== "all" || filterDueDateStart || filterDueDateEnd) && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                  setFilterProject("all");
                  setFilterCustomer("all");
                  setFilterPayment("all");
                  setFilterDueDateStart("");
                  setFilterDueDateEnd("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

  {/* KPI Cards */}
  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">Concluídas</p>
                <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-blue-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{filteredSales.filter((s: Sale) => s.status === 'COMPLETED').length || 0}</p>
                <p className="text-xs text-blue-600">vendas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-green-700">Faturamento</p>
                <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(
                    filteredSales.filter((s: Sale) => s.status === 'COMPLETED')
                      .reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0) || 0
                  )}
                </p>
                <p className="text-xs text-green-600">total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-yellow-700">Processando</p>
                <div className="w-8 h-8 bg-yellow-200 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-yellow-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-900">
                  {filteredSales.filter((s: Sale) => s.status === 'PROCESSING').length || 0}
                </p>
                <p className="text-xs text-yellow-600">em processo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-orange-700">A Receber</p>
                <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-orange-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-900">
                  {formatCurrency(
                    filteredSales.filter((s: Sale) => s.status === 'PROCESSING')
                      .reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total || '0'), 0) || 0
                  )}
                </p>
                <p className="text-xs text-orange-600">pendente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-purple-700">Total</p>
                <div className="w-8 h-8 bg-purple-200 rounded-lg flex items-center justify-center">
                  <Package className="h-4 w-4 text-purple-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900">{filteredSales.length || 0}</p>
                <p className="text-xs text-purple-600">vendas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales List */}
      <Card className="shadow-lg border-green-100">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <ShoppingCart className="h-5 w-5" />
            Lista de Vendas
          </CardTitle>
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
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                    <th className="text-left py-3 px-4 font-medium">Cliente</th>
                    <th className="text-left py-3 px-4 font-medium">Valor</th>
                    <th className="text-left py-3 px-4 font-medium">Pagamento</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Vencimento</th>
                    <th className="text-left py-3 px-4 font-medium">Observação da Venda</th>
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
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {sale.createdAt ? formatDate(sale.createdAt) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{getCustomerName(sale.customerId)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{formatCurrency(Number(sale.total || 0))}</p>
                          {Number(sale.discount || 0) > 0 && (
                            <p className="text-xs text-gray-500">
                              Desc: {formatCurrency(Number(sale.discount || 0))}
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
                          {sale.dueDate ? formatDate(sale.dueDate) : '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700 max-w-xs truncate">
                          {sale.notes ? sale.notes : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 p-0"><MoreHorizontal className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewingSale(sale)}>
                                <Eye className="h-4 w-4 mr-2" /> Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateSale(sale)}>
                                <Copy className="h-4 w-4 mr-2" /> Duplicar
                              </DropdownMenuItem>
                              {sale.status === 'PROCESSING' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingSale(sale);
                                    fetch(`/api/sales/${sale.id}/items`)
                                      .then(resp => {
                                        if (!resp.ok) throw new Error("Falha ao carregar itens da venda");
                                        return resp.json();
                                      })
                                      .then(items => setEditingSaleItems(items))
                                      .catch(err => {
                                        console.error("Erro ao carregar itens da venda", err);
                                        toast({
                                          title: "Erro",
                                          description: "Falha ao carregar itens da venda",
                                          variant: "destructive",
                                        });
                                      });
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-2" /> Editar
                                </DropdownMenuItem>
                              )}
                              {sale.status === 'PROCESSING' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(sale, 'COMPLETED')}>
                                  <CheckCircle className="h-4 w-4 mr-2" /> Concluir
                                </DropdownMenuItem>
                              )}
                              {sale.status === 'PROCESSING' && (
                                <DropdownMenuItem onClick={() => handleCancel(sale)}>
                                  <XCircle className="h-4 w-4 mr-2 text-red-600" /> Cancelar
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
      <Dialog open={!!viewingSale} onOpenChange={(open) => !open && setViewingSale(null)}>
        <DialogContent key={viewingSale?.id ?? 'no-sale'} className="max-w-3xl max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Detalhes da Venda {viewingSale?.number}</DialogTitle>
            <DialogDescription>
              Visualize os dados e itens da venda selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 overflow-y-auto max-h-[70vh] space-y-4">
            {viewingSale && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Cliente</Label>
                  <p className="font-medium">{getCustomerName(viewingSale.customerId)}</p>
                </div>
                <div>
                  <Label>Forma de Pagamento</Label>
                  <p className="font-medium">{paymentMethods[viewingSale.paymentMethod as keyof typeof paymentMethods]}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="font-medium">{statusConfig[viewingSale.status as keyof typeof statusConfig]?.label || viewingSale.status}</p>
                </div>
                <div>
                  <Label>Data</Label>
                  <p className="font-medium">{viewingSale.createdAt ? formatDateTime(viewingSale.createdAt) : '-'}</p>
                </div>
                {/* Observação da Venda */}
                <div className="md:col-span-2">
                  <Label>Observação da Venda</Label>
                  <div className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words">
                    {viewingSale.notes ? viewingSale.notes : 'Sem observações da venda.'}
                  </div>
                </div>

                {viewingQuote && (
                  <div className="md:col-span-2">
                    <Label>Observações do Orçamento</Label>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {viewingQuote.observations ? viewingQuote.observations : 'Sem observações no orçamento original.'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Sale Items List */}
            <div>
              <Label>
                Itens da Venda {Array.isArray(viewingSaleItems) ? `(${viewingSaleItems.length})` : ""}
              </Label>
              <div className="mt-2 border rounded-md divide-y">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-5">Produto/Serviço</div>
                  <div className="col-span-2 text-right">Qtd</div>
                  <div className="col-span-2 text-right">Preço Un.</div>
                  <div className="col-span-1 text-right">Desc.</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {viewingSaleItemsError ? (
                  <div className="px-3 py-4 text-sm text-red-600">
                    Erro ao carregar itens: {((viewingSaleItemsError as any)?.message) || "Erro desconhecido"}
                  </div>
                ) : viewingSaleItemsLoading ? (
                  <div className="px-3 py-4 text-sm text-gray-500">Carregando itens...</div>
                ) : (viewingSaleItems || []).length > 0 ? (
                  (viewingSaleItems || []).map((item: any) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                      <div className="col-span-5 truncate">
                        {item.productId ? (
                          <span>
                            <span className="font-medium">Produto:</span>{" "}
                            {getProductName(item.productId) || item.productId}
                            {(() => {
                              const code = getProductCode(item.productId);
                              return code ? ` (code: ${code})` : "";
                            })()}
                          </span>
                        ) : (
                          <span>
                            <span className="font-medium">Serviço:</span>{" "}
                            {item.serviceDescription || 'Serviço'}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">{item.quantity}</div>
                      <div className="col-span-2 text-right">{formatCurrency(Number(item?.unitPrice ?? 0))}</div>
                      <div className="col-span-1 text-right">{formatCurrency(Number(item?.discount ?? 0))}</div>
                      <div className="col-span-2 text-right">{formatCurrency(Number(item?.total ?? 0))}</div>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-gray-500">Nenhum item.</div>
                )}
              </div>
            </div>

            {viewingSale && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Subtotal</Label>
                  <p className="font-medium">{formatCurrency(Number(viewingSale.subtotal || 0))}</p>
                </div>
                <div>
                  <Label>Desconto</Label>
                  <p className="font-medium">{formatCurrency(Number(viewingSale.discount || 0))}</p>
                </div>
                <div>
                  <Label>Total</Label>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(Number(viewingSale.total || 0))}</p>
                </div>
              </div>
            )}
            {viewingSale && viewingSaleDoc && (
              <div className="flex justify-end">
                <ExportSaleButton
                  doc={viewingSaleDoc as any}
                  buttonText="Imprimir/Exportar PDF"
                  saleId={String(viewingSale.id)}
                  theme={{ primary: "#1f2937", muted: "#6b7280", fontSize: 10 }}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Sale Dialog */}
      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent
          key={editingSale?.id ?? 'no-edit-sale'}
          className="sm:max-w-3xl md:max-w-5xl xl:max-w-6xl w-full max-h-[90vh] overflow-y-auto p-0"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold">Editar Venda {editingSale?.number}</DialogTitle>
            <DialogDescription>
              Edite os dados da venda selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-4 space-y-6">
            {editingSale && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Número da Venda</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {editingSale.number}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Cliente</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {getCustomerName(editingSale.customerId)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Orçamento de Origem</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {getQuoteNumber(editingSale.quoteId) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Projeto</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {projects?.find((p: Project) => p.id === editingSale.projectId)?.name ?? "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Criada em</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {editingSale.createdAt ? formatDateTime(new Date(editingSale.createdAt)) : "—"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Data de Vencimento</Label>
                    <Input 
                      type="date" 
                      className="mt-1"
                      value={editingSale.dueDate ? new Date(editingSale.dueDate).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setEditingSale({...editingSale, dueDate: e.target.value ? new Date(e.target.value) : null})}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Forma de Pagamento</Label>
                    <Select 
                      value={editingSale.paymentMethod ?? undefined} 
                      onValueChange={(value) => setEditingSale({...editingSale, paymentMethod: value as keyof typeof paymentMethods})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(paymentMethods).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Status</Label>
                    <Select 
                      value={editingSale.status ?? undefined} 
                      onValueChange={(value) => setEditingSale({...editingSale, status: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusConfig).map(([key, {label}]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Subtotal</Label>
                    <p className="mt-1 font-medium text-gray-900 bg-white border rounded-md px-3 py-2 text-sm">
                      {formatCurrency(Number(editingSale.subtotal || 0))}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Desconto (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      className="mt-1"
                      value={String(editingSale.discount ?? '0')}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = Number(v);
                        setEditingSale({
                          ...editingSale,
                          discount: isFinite(num) ? (num < 0 ? '0.00' : num.toFixed(2)) as any : (v as any),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Total</Label>
                    <p className="mt-1 text-lg font-bold text-green-600 bg-white border rounded-md px-3 py-2">
                      {formatCurrency(Number(editingSale.total || 0))}
                    </p>
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs font-medium text-gray-700">Observações</Label>
                    <Input 
                      className="mt-1"
                      value={editingSale.notes || ''} 
                      onChange={(e) => setEditingSale({...editingSale, notes: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Itens da venda em edição */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold text-gray-800">Itens da Venda</Label>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setEditingSaleItems(prev => [
                            ...prev,
                            { 
                              id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                              saleId: editingSale!.id,
                              kind: 'product',
                              productId: null,
                              serviceDescription: null,
                              quantity: 1,
                              unitPrice: '0',
                              discount: null,
                              serviceCost: null,
                              total: '0',
                            }
                          ]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Produto
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setEditingSaleItems(prev => [
                            ...prev,
                            { 
                              id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                              saleId: editingSale!.id,
                              kind: 'service',
                              productId: null,
                              serviceDescription: '',
                              quantity: 1,
                              unitPrice: '0',
                              discount: null,
                              serviceCost: null,
                              total: '0',
                            }
                          ]);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Serviço
                  </Button>
                </div>
              </div>
              
              <div className="border rounded-md">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 border-b">
                  <div className="col-span-4">Produto/Serviço</div>
                  <div className="col-span-2 text-right">Qtd</div>
                  <div className="col-span-2 text-right">Preço Un.</div>
                  <div className="col-span-2 text-right">Desc.</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1"></div>
                </div>
                <div className="divide-y max-h-80 overflow-y-auto">
                  {editingSaleItems.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500">Nenhum item. Adicione produtos ou serviços usando os botões acima.</div>
                  ) : (
                    editingSaleItems.map((item, index) => {
                      const isProduct = item.productId !== null;
                      const qty = Number(item.quantity) || 0;
                      const price = Number(item.unitPrice || 0) || 0;
                      const itemDiscount = Number(item.discount || 0) || 0;
                      const total = Math.max(0, qty * price - itemDiscount);
                      
                      return (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 bg-white">
                          <div className="col-span-4">
                            {isProduct ? (
                            <ProductPicker
                              products={products}
                              value={item.productId}
                              onSelect={(product) => {
                                if (!product) return;
                                const updatedItems = [...editingSaleItems];
                                const nextQty = Number(updatedItems[index].quantity) || 0;
                                const nextPrice = Number(product.salePrice || 0) || 0;
                                const nextDiscount = Number(updatedItems[index].discount || 0) || 0;
                                const nextTotal = Math.max(0, nextQty * nextPrice - nextDiscount);
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  productId: product.id,
                                  unitPrice: String(nextPrice),
                                  total: String(nextTotal),
                                } as any;
                                setEditingSaleItems(updatedItems);
                              }}
                            />
                            ) : (
                              <Input
                                placeholder="Descrição do serviço"
                                value={item.serviceDescription || ''}
                                onChange={(e) => {
                                  const updatedItems = [...editingSaleItems];
                                  updatedItems[index] = {
                                    ...updatedItems[index],
                                    serviceDescription: e.target.value
                                  };
                                  setEditingSaleItems(updatedItems);
                                }}
                            />
                            )}
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                if (qty < 1) return;
                                
                                const updatedItems = [...editingSaleItems];
                                const nextPrice = Number(updatedItems[index].unitPrice || 0) || 0;
                                const nextDiscount = Number(updatedItems[index].discount || 0) || 0;
                                const nextTotal = Math.max(0, qty * nextPrice - nextDiscount);
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  quantity: qty,
                                  total: String(nextTotal),
                                } as any;
                                setEditingSaleItems(updatedItems);
                              }}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => {
                                const price = Number(e.target.value);
                                if (price < 0) return;
                                
                                const updatedItems = [...editingSaleItems];
                                const nextQty = Number(updatedItems[index].quantity) || 0;
                                const nextDiscount = Number(updatedItems[index].discount || 0) || 0;
                                const nextTotal = Math.max(0, nextQty * price - nextDiscount);
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  unitPrice: String(price),
                                  total: String(nextTotal),
                                } as any;
                                setEditingSaleItems(updatedItems);
                              }}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.discount ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                const num = Number(v);
                                const updatedItems = [...editingSaleItems];
                                const nextQty = Number(updatedItems[index].quantity) || 0;
                                const nextPrice = Number(updatedItems[index].unitPrice || 0) || 0;
                                const nextDiscount = isFinite(num) ? num : Number(updatedItems[index].discount || 0) || 0;
                                const nextTotal = Math.max(0, nextQty * nextPrice - nextDiscount);
                                updatedItems[index] = {
                                  ...updatedItems[index],
                                  discount: isFinite(num) ? String(num) : v,
                                  total: String(nextTotal),
                                } as any;
                                setEditingSaleItems(updatedItems);
                              }}
                            />
                          </div>
                          <div className="col-span-1 text-right">
                            {formatCurrency(total)}
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingSaleItems(prev => prev.filter((_, i) => i !== index));
                              }}
                            >
                              <XCircle className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    })}
                </div>
              </div>

              {/* Totais */}
              {editingSaleItems.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <div className="w-full md:w-1/3 space-y-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-700">Subtotal:</span>
                      <span className="font-semibold">
                        {formatCurrency(
                          editingSaleItems.reduce((sum, item) => {
                            const qty = Number(item.quantity) || 0;
                            const price = Number(item.unitPrice || 0) || 0;
                            const itemDiscount = Number(item.discount || 0) || 0;
                            const itemTotal = Math.max(0, qty * price - itemDiscount);
                            return sum + itemTotal;
                          }, 0)
                        )}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700 block">Desconto (R$):</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={String(editingSale?.discount ?? '0')}
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = Number(v);
                          if (!editingSale) return;
                          setEditingSale({
                            ...editingSale,
                            discount: isFinite(num) ? (num < 0 ? '0.00' : num.toFixed(2)) as any : (v as any),
                          });
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2 mt-1">
                      <span>Total:</span>
                      <span className="text-green-600">
                        {formatCurrency(
                          Math.max(
                            0,
                            editingSaleItems.reduce((sum, item) => {
                              const qty = Number(item.quantity) || 0;
                              const price = Number(item.unitPrice || 0) || 0;
                              const itemDiscount = Number(item.discount || 0) || 0;
                              const itemTotal = Math.max(0, qty * price - itemDiscount);
                              return sum + itemTotal;
                            }, 0) -
                            Number(editingSale?.discount || 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setEditingSale(null);
                  setEditingSaleItems([]);
                }}
              >
                Cancelar
              </Button>
              <Button onClick={() => {
                if (editingSale) {
                  // Primeiro atualizar a venda
                  handleSaleUpdate(editingSale, {
                    status: editingSale.status,
                    paymentMethod: editingSale.paymentMethod,
                    dueDate: editingSale.dueDate,
                    notes: editingSale.notes,
                    discount: (editingSale.discount != null ? Number(editingSale.discount) : 0) as any
                  });
                  
                  // Depois atualizar os itens da venda
                  updateSaleItemsMutation.mutate({
                    saleId: editingSale.id,
                    items: editingSaleItems
                  });
                  
                  setEditingSale(null);
                  setEditingSaleItems([]);
                }
              }}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Sale Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent key={isCreateOpen ? 'create-open' : 'create-closed'} className="sm:max-w-3xl md:max-w-5xl xl:max-w-6xl max-h-[95vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Nova Venda</DialogTitle>
            <DialogDescription>
              Preencha os dados e adicione itens para criar uma nova venda.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2 overflow-y-auto max-h-[80vh] space-y-4">
            {/* Step 1: choose mode */}
            {!createMode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="cursor-pointer hover:bg-muted/30" onClick={() => setCreateMode('fromQuote')}>
                  <CardContent className="p-4 flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Converter de Orçamento</p>
                      <p className="text-sm text-gray-600">Listar orçamentos aprovados e converter em venda.</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:bg-muted/30" onClick={() => setCreateMode('blank')}>
                  <CardContent className="p-4 flex items-start space-x-3">
                    <ShoppingCart className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Venda Manual</p>
                      <p className="text-sm text-gray-600">Iniciar venda sem orçamento.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 2: pick approved quote */}
            {createMode === 'fromQuote' && !selectedQuote && (
              <div className="space-y-3">
                <Label>Orçamentos Aprovados</Label>
                <div className="rounded-md border">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                    <div className="col-span-3">Número</div>
                    <div className="col-span-4">Cliente</div>
                    <div className="col-span-2 text-right">Total</div>
                    <div className="col-span-2">Aprovado em</div>
                    <div className="col-span-1 text-right">Ação</div>
                  </div>
                  <div className="divide-y max-h-96 overflow-auto">
                    {(approvedQuotes || []).map((q: Quote) => (
                      <div key={q.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
                        <div className="col-span-3">{q.number}</div>
                        <div className="col-span-4">{getCustomerName(q.customerId)}</div>
                        <div className="col-span-2 text-right">{formatCurrency(q.total)}</div>
                        <div className="col-span-2">{q.createdAt ? formatDateTime(q.createdAt) : '-'}</div>
                        <div className="col-span-1 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedQuote(q)}>
                            Selecionar
                          </Button>
                        </div>
                      </div>
                    ))}
                    {approvedQuotes.length === 0 && (
                      <div className="px-3 py-4 text-sm text-gray-500">Nenhum orçamento aprovado.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 (manual): build sale */}
            {createMode === 'blank' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente</Label>
                    <select
                      className="w-full border rounded px-2 py-2 mt-1"
                      value={manualCustomerId}
                      onChange={(e) => setManualCustomerId(e.target.value)}
                    >
                      <option value="">Selecionar cliente...</option>
                      {(customers || []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <select
                      className="w-full border rounded px-2 py-2 mt-1"
                      value={manualPaymentMethod}
                      onChange={(e) => setManualPaymentMethod(e.target.value as any)}
                    >
                      {Object.entries(paymentMethods).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Vencimento</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={manualDueDate}
                      onChange={(e) => setManualDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Projeto (opcional)</Label>
                    <Select value={manualProjectId} onValueChange={(value) => {
                      setManualProjectId(value);
                      // Preencher cliente automaticamente se o projeto tiver um cliente vinculado
                      const project = projects?.find(p => p.id === value);
                      if (project?.customerId && !manualCustomerId) {
                        setManualCustomerId(project.customerId);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(projects) ? projects : []).map((project: Project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.code} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Itens</Label>
                  <div className="mt-2 border rounded-md divide-y">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                      <div className="text-sm text-muted-foreground">Adicionar</div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => addManualItem('product')}>Produto</Button>
                        <Button variant="outline" size="sm" onClick={() => addManualItem('service')}>Serviço</Button>
                      </div>
                    </div>
                    {manualItems.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500">Nenhum item adicionado.</div>
                    ) : (
                      manualItems.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
                          <div className="col-span-4">
                            {it.kind === 'product' ? (
                              <ProductPicker
                                products={products}
                                value={it.productId ?? null}
                                onSelect={(p) => {
                                  if (!p) return;
                                  updateManualItem(idx, {
                                    productId: p.id,
                                    unitPrice: Number(p.salePrice) || 0,
                                  });
                                }}
                              />
                            ) : (
                              <Input
                                placeholder="Descrição do serviço"
                                value={it.serviceDescription || ''}
                                onChange={(e) => updateManualItem(idx, { serviceDescription: e.target.value })}
                              />
                            )}
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => updateManualItem(idx, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => updateManualItem(idx, { unitPrice: Number(e.target.value || 0) })}
                            />
                          </div>
                          <div className="col-span-2 text-right font-medium">
                            {formatCurrency(Number(it.quantity) * Number(it.unitPrice || 0))}
                          </div>
                          <div className="col-span-1 text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeManualItem(idx)}>Remover</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div>
                    <Label>Desconto</Label>
                    <Input type="number" step="0.01" value={manualDiscount} onChange={(e) => setManualDiscount(Number(e.target.value || 0))} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Observações</Label>
                    <Input value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} placeholder="Notas da venda" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Subtotal</Label>
                    <p className="font-medium">{formatCurrency(manualSubtotal)}</p>
                  </div>
                  <div>
                    <Label>Total</Label>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(manualTotal)}</p>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => { setCreateMode(null); resetManualForm(); }}>Voltar</Button>
                  <Button onClick={() => createManualSale.mutate()} disabled={createManualSale.isPending || !manualCustomerId || manualItems.length === 0}>
                    {createManualSale.isPending ? 'Salvando...' : 'Salvar Venda'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: preview and confirm */}
            {createMode === 'fromQuote' && selectedQuote && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Cliente</Label>
                    <p className="font-medium">{getCustomerName(selectedQuote.customerId)}</p>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <select
                      className="w-full border rounded px-2 py-2 mt-1"
                      value={fromQuotePaymentMethod}
                      onChange={(e) => setFromQuotePaymentMethod(e.target.value as any)}
                    >
                      {Object.entries(paymentMethods).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Vencimento</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={fromQuoteDueDate}
                      onChange={(e) => setFromQuoteDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label>Itens</Label>
                  <div className="mt-2 border rounded-md divide-y">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                      <div className="col-span-6">Produto/Serviço</div>
                      <div className="col-span-2 text-right">Qtd</div>
                      <div className="col-span-2 text-right">Preço Un.</div>
                      <div className="col-span-2 text-right">Total</div>
                    </div>
                    {selectedQuoteItemsLoading ? (
                      <div className="px-3 py-4 text-sm text-gray-500">Carregando itens...</div>
                    ) : (selectedQuoteItems || []).length > 0 ? (
                      (selectedQuoteItems || []).map((item: any) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                          <div className="col-span-6 truncate">
                            {item.productId ? (
                              <span>
                                <span className="font-medium">Produto:</span>{" "}
                                {getProductName(item.productId) || item.productId}
                                {(() => {
                                  const code = getProductCode(item.productId);
                                  return code ? ` (code: ${code})` : "";
                                })()}
                              </span>
                            ) : (
                              <span>
                                <span className="font-medium">Serviço:</span>{" "}
                                {item.serviceDescription || 'Serviço'}
                              </span>
                            )}
                          </div>
                          <div className="col-span-2 text-right">{item.quantity}</div>
                          <div className="col-span-2 text-right">{formatCurrency(item?.unitPrice ?? 0)}</div>
                          <div className="col-span-2 text-right">{formatCurrency(item?.total ?? 0)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500">Nenhum item.</div>
                    )}
                  </div>
                </div>

                {/* Additional Items */}
                <div>
                  <Label>Itens Adicionais</Label>
                  <div className="mt-2 border rounded-md divide-y">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                      <div className="text-sm text-muted-foreground">Adicionar</div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => addAdditionalItem('product')}>Produto</Button>
                        <Button variant="outline" size="sm" onClick={() => addAdditionalItem('service')}>Serviço</Button>
                      </div>
                    </div>
                    {additionalItems.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500">Nenhum item adicional.</div>
                    ) : (
                      additionalItems.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
                          <div className="col-span-6">
                            {it.kind === 'product' ? (
                              <ProductPicker
                                products={products}
                                value={it.productId ?? null}
                                onSelect={(p) => {
                                  if (!p) return;
                                  updateAdditionalItem(idx, {
                                    productId: p.id,
                                    unitPrice: Number(p.salePrice) || 0,
                                  });
                                }}
                              />
                            ) : (
                              <Input
                                placeholder="Descrição do serviço"
                                value={it.serviceDescription || ''}
                                onChange={(e) => updateAdditionalItem(idx, { serviceDescription: e.target.value })}
                              />
                            )}
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => updateAdditionalItem(idx, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={it.unitPrice}
                              onChange={(e) => updateAdditionalItem(idx, { unitPrice: Number(e.target.value || 0) })}
                            />
                          </div>
                          <div className="col-span-1 text-right font-medium">
                            {formatCurrency(Number(it.quantity) * Number(it.unitPrice || 0))}
                          </div>
                          <div className="col-span-1 text-right">
                            <Button variant="ghost" size="sm" onClick={() => removeAdditionalItem(idx)}>Remover</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Subtotal (Orçamento + Adicionais)</Label>
                    <p className="font-medium">{formatCurrency(combinedSubtotalFromQuote)}</p>
                  </div>
                  <div>
                    <Label>Desconto</Label>
                    <p className="font-medium">{formatCurrency(Number(selectedQuote.discount ?? 0))}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Total</Label>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(combinedTotalFromQuote)}</p>
                  </div>
                </div>

                <div>
                  <Label>Observações</Label>
                  <p className="text-sm text-gray-600 mt-1">{selectedQuote.notes || '-'}</p>
                </div>

                <div className="col-span-2">
                  <Label>Observação da Venda</Label>
                  <Input
                    value={fromQuoteNotes}
                    onChange={(e) => setFromQuoteNotes(e.target.value)}
                    placeholder="Observações específicas desta venda"
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => { setSelectedQuote(null); setCreateMode(null); }}>
                    Voltar
                  </Button>
                  <Button onClick={() => createFromQuoteMutation.mutate()} disabled={selectedQuoteItemsLoading || createFromQuoteMutation.isPending}>
                    {createFromQuoteMutation.isPending ? 'Convertendo...' : 'Converter e Salvar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  </div>
);
}
