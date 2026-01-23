import { useState, useEffect } from "react";
import { useSearch } from "@/contexts/search-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Eye, FileText, CheckCircle, Edit, XCircle, Copy, MoreVertical, TrendingUp, DollarSign, Clock, Target, Percent, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import QuoteForm from "@/components/forms/quote-form";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Quote, Customer } from "@shared/schema";
import ExportQuoteButton from "@/components/ExportQuoteButton";
import QuoteTotalCard from "@/components/dashboard/quote-total-card";

const statusConfig = {
  PENDING: { label: "Pendente", variant: "default" as const, color: "text-blue-600" },
  APPROVED: { label: "Aprovado", variant: "default" as const, color: "text-green-600" },
  REJECTED: { label: "Rejeitado", variant: "secondary" as const, color: "text-red-600" },
  CONVERTED: { label: "Convertido", variant: "default" as const, color: "text-purple-600" },
};

// Purge-safe Tailwind color classes for quote statuses (with colored borders)
const quoteStatusColors: Record<keyof typeof statusConfig, { bg: string; text: string; border: string }> = {
  PENDING: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border border-yellow-300' },
  APPROVED: { bg: 'bg-green-50', text: 'text-green-600', border: 'border border-green-300' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-600', border: 'border border-red-300' },
  CONVERTED: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border border-purple-300' },
};

export default function Quotes() {
  const { search } = useSearch();
  const [creatingQuoteOpen, setCreatingQuoteOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [cloneFrom, setCloneFrom] = useState<Quote | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const { toast } = useToast();

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [expiredOnly, setExpiredOnly] = useState<boolean>(false);
  const [validFrom, setValidFrom] = useState<string>(""); // yyyy-mm-dd
  const [validTo, setValidTo] = useState<string>("");
  const [totalMin, setTotalMin] = useState<string>("");
  const [totalMax, setTotalMax] = useState<string>("");
  // New: createdAt period filters
  const [createdFrom, setCreatedFrom] = useState<string>("");
  const [createdTo, setCreatedTo] = useState<string>("");

  // Use server-side filtering by passing current filter state as query params
  const buildQuery = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (customerFilter) params.set('customerId', customerFilter);
    if (expiredOnly) params.set('expiredOnly', '1');
    if (validFrom) params.set('validFrom', validFrom);
    if (validTo) params.set('validTo', validTo);
    if (createdFrom) params.set('createdFrom', createdFrom);
    if (createdTo) params.set('createdTo', createdTo);
    if (totalMin) params.set('totalMin', totalMin);
    if (totalMax) params.set('totalMax', totalMax);
    if (search) params.set('q', search);
    const s = params.toString();
    return s ? `/api/quotes?${s}` : '/api/quotes';
  };

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes", statusFilter, customerFilter, expiredOnly, validFrom, validTo, createdFrom, createdTo, totalMin, totalMax, search],
    queryFn: async () => {
      const url = buildQuery();
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao carregar orçamentos");
      return res.json();
    },
  });

  // Helper to format date to input value yyyy-mm-dd
  const fmtInput = (d: Date) => {
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return iso.slice(0, 10);
  };

  // Sparkline helper
  const Sparkline = ({ data, width = 120, height = 36, stroke = '#2563eb' }: { data: number[]; width?: number; height?: number; stroke?: string }) => {
    if (!data || data.length === 0) return null;
    const max = Math.max(1, ...data);
    const step = width / (data.length - 1 || 1);
    const points = data.map((v, i) => {
      const x = i * step;
      const y = height - (v / max) * height;
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
      </svg>
    );
  };

  // Abrir visualização quando houver parâmetro ?view=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get("view");
    if (viewId && Array.isArray(quotes)) {
      const q = (quotes as Quote[]).find((x) => x.id === viewId);
      if (q) setViewingQuote(q);
    }
  }, [quotes]);

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Falha ao carregar clientes");
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

  // Dados da empresa
  const { data: companySettings } = useQuery<any>({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await fetch("/api/company");
      if (!res.ok) return undefined;
      return res.json();
    },
  });

  // Itens do orçamento atualmente em visualização
  const { data: viewingItems, isLoading: viewingItemsLoading } = useQuery({
    queryKey: ["/api/quotes", viewingQuote?.id, "items"],
    queryFn: async () => {
      const resp = await fetch(`/api/quotes/${viewingQuote!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens");
      return resp.json();
    },
    enabled: !!viewingQuote?.id,
  });

  // Excluir orçamento removido das ações

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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
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

  const filteredQuotes = (Array.isArray(quotes) ? quotes : []).filter((quote: Quote) => {
    const customer = customers?.find((c: Customer) => c.id === quote.customerId);
    const term = (search || "").toLowerCase();
    if (!term) return true;
    return quote.number.toLowerCase().includes(term) ||
           (customer?.name || "").toLowerCase().includes(term) ||
           (quote.notes || "").toLowerCase().includes(term);
  })
  // Filtro por status
  .filter((q: Quote) => {
    if (!statusFilter) return true;
    return q.status === statusFilter;
  })
  // Filtro por cliente
  .filter((q: Quote) => {
    if (!customerFilter) return true;
    return q.customerId === customerFilter;
  })
  // Filtro vencidos
  .filter((q: Quote) => {
    if (!expiredOnly) return true;
    return new Date(q.validUntil) < new Date();
  })
  // Filtro por período de validade
  .filter((q: Quote) => {
    if (!validFrom && !validTo) return true;
    const vu = new Date(q.validUntil);
    if (validFrom && vu < new Date(validFrom)) return false;
    if (validTo) {
      const end = new Date(validTo);
      end.setHours(23,59,59,999);
      if (vu > end) return false;
    }
    return true;
  })
  // Filtro por período de criação (createdAt)
  .filter((q: Quote) => {
    if (!createdFrom && !createdTo) return true;
    const created = (q as any)?.createdAt ? new Date((q as any).createdAt) : null;
    if (!created) return false;
    if (createdFrom && created < new Date(createdFrom)) return false;
    if (createdTo) {
      const end = new Date(createdTo);
      end.setHours(23,59,59,999);
      if (created > end) return false;
    }
    return true;
  })
  // Filtro por faixa de total
  .filter((q: Quote) => {
    const min = totalMin ? Number(totalMin.replace(",",".")) : undefined;
    const max = totalMax ? Number(totalMax.replace(",",".")) : undefined;
    const total = Number(q.total ?? 0);
    if (min !== undefined && !isNaN(min) && total < min) return false;
    if (max !== undefined && !isNaN(max) && total > max) return false;
    return true;
  });

  // Aggregates for cards (based on current filters)
  const kpis = (() => {
    const list = filteredQuotes as Quote[];
    const totalCount = list.length;
    const sumSel = (sel: (q: Quote) => number) => list.reduce((acc, q) => acc + sel(q), 0);
    const sumTotal = (sel?: (q: Quote) => boolean) => list.filter(sel ?? (() => true)).reduce((acc, q) => acc + Number(q.total || 0), 0);
    const count = (sel: (q: Quote) => boolean) => list.filter(sel).length;
    const isExp = (q: Quote) => new Date(q.validUntil) < new Date();
    const pendingCount = count(q => q.status === 'PENDING');
    const approvedCount = count(q => q.status === 'APPROVED');
    const rejectedCount = count(q => q.status === 'REJECTED');
    const convertedCount = count(q => q.status === 'CONVERTED');
    const expiredCount = count(isExp);
    const subtotalSum = sumSel(q => Number((q as any)?.subtotal ?? 0));
    const discountSum = sumSel(q => Number((q as any)?.discount ?? 0));
    const totalValue = sumTotal();
    const pendingValue = sumTotal(q => q.status === 'PENDING');
    const approvedValue = sumTotal(q => q.status === 'APPROVED');
    const convertedValue = sumTotal(q => q.status === 'CONVERTED');
    const wonCount = approvedCount + convertedCount;
    const conversionRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0;
    const avgTicket = totalCount > 0 ? totalValue / totalCount : 0;
    const avgByStatus = (status: Quote['status']) => {
      const arr = list.filter(q => q.status === status);
      return arr.length > 0 ? arr.reduce((a, q) => a + Number(q.total || 0), 0) / arr.length : 0;
    };
    const buildSeries = (status: Quote['status']) => {
      const days = 14;
      const series: number[] = [];
      const today = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d0 = new Date(today);
        d0.setDate(today.getDate() - i);
        d0.setHours(0,0,0,0);
        const d1 = new Date(d0);
        d1.setHours(23,59,59,999);
        const countDay = list.filter(q => q.status === status).filter(q => {
          const c = (q as any)?.createdAt ? new Date((q as any).createdAt) : null;
          return c && c >= d0 && c <= d1;
        }).length;
        series.push(countDay);
      }
      return series;
    };
    return {
      totalCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      convertedCount,
      expiredCount,
      subtotalSum,
      discountSum,
      totalValue,
      pendingValue,
      approvedValue,
      convertedValue,
      conversionRate,
      avgTicket,
      avgTicketsByStatus: {
        PENDING: avgByStatus('PENDING'),
        APPROVED: avgByStatus('APPROVED'),
        REJECTED: avgByStatus('REJECTED'),
        CONVERTED: avgByStatus('CONVERTED'),
      },
      trends: {
        PENDING: buildSeries('PENDING'),
        APPROVED: buildSeries('APPROVED'),
        REJECTED: buildSeries('REJECTED'),
        CONVERTED: buildSeries('CONVERTED'),
      }
    };
  })();

  const getCustomerName = (customerId: string) => {
    const list = Array.isArray(customers) ? customers : [];
    const customer = list.find((c: Customer) => c.id === customerId);
    return customer?.name || "Cliente não encontrado";
  };

  const getProduct = (productId: string) => {
    const list = Array.isArray(products) ? products : [];
    return list.find((p: any) => p.id === productId);
  };

  const getProductName = (productId: string) => {
    const product = getProduct(productId);
    return product?.name || "Produto";
  };

  // Criar venda a partir de orçamento aprovado
  const createSaleFromQuote = (quote: Quote) => {
    if (quote.status !== 'APPROVED') {
      toast({
        title: 'Ação não permitida',
        description: 'Apenas orçamentos aprovados podem virar venda.',
        variant: 'destructive',
      });
      return;
    }
    // Navega para a página de vendas com referência do orçamento
    window.location.href = `/sales?fromQuote=${quote.id}`;
  };

  const handleStatusChange = (quote: Quote, status: string) => {
    updateStatusMutation.mutate({ id: quote.id, status });
  };

  const isExpired = (quote: Quote) => {
    // Desconsiderar vencimento para orçamentos aprovados e convertidos
    if (quote.status === 'APPROVED' || quote.status === 'CONVERTED') {
      return false;
    }
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
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-purple-50 min-h-screen">
      {/* Toolbar */}
      <Card className="shadow-lg border-purple-100">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Filter className="h-5 w-5" />
              Filtros de Orçamentos
            </CardTitle>
            <Button onClick={() => setCreatingQuoteOpen(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <FileText className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-2 items-end">
            {/* Status */}
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                className="h-9 border rounded-md px-2 bg-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDING">Pendente</option>
                <option value="APPROVED">Aprovado</option>
                <option value="REJECTED">Rejeitado</option>
                <option value="CONVERTED">Convertido</option>
              </select>
            </div>
            {/* Cliente */}
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Cliente</label>
              <select
                className="h-9 border rounded-md px-2 bg-white min-w-[200px]"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {(Array.isArray(customers) ? customers : []).map((c: Customer) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Validade de - até */}
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Validade de</label>
              <input type="date" className="h-9 border rounded-md px-2 bg-white" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">até</label>
              <input type="date" className="h-9 border rounded-md px-2 bg-white" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
            {/* Somente vencidos */}
            <div className="flex items-center h-9 gap-2">
              <input id="expiredOnly" type="checkbox" className="h-4 w-4" checked={expiredOnly} onChange={(e) => setExpiredOnly(e.target.checked)} />
              <label htmlFor="expiredOnly" className="text-sm">Somente vencidos</label>
            </div>
            {/* Criado de - até */}
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Criado de</label>
              <input type="date" className="h-9 border rounded-md px-2 bg-white" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">até</label>
              <input type="date" className="h-9 border rounded-md px-2 bg-white" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getFullYear(), now.getMonth(), 1);
                  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setCreatedFrom(fmtInput(start));
                  setCreatedTo(fmtInput(end));
                }}
              >
                Mês atual
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const now = new Date();
                  const start = new Date();
                  start.setDate(now.getDate() - 6);
                  setCreatedFrom(fmtInput(start));
                  setCreatedTo(fmtInput(now));
                }}
              >
                Últimos 7 dias
              </Button>
            </div>
            {/* Totais */}
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Total mín.</label>
              <input placeholder="0" className="h-9 border rounded-md px-2 bg-white w-28" value={totalMin} onChange={(e) => setTotalMin(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-xs text-muted-foreground">Total máx.</label>
              <input placeholder="" className="h-9 border rounded-md px-2 bg-white w-28" value={totalMax} onChange={(e) => setTotalMax(e.target.value)} />
            </div>
            <div className="flex items-center">
              <Button variant="outline" onClick={() => { setStatusFilter(""); setCustomerFilter(""); setExpiredOnly(false); setValidFrom(""); setValidTo(""); setCreatedFrom(""); setCreatedTo(""); setTotalMin(""); setTotalMax(""); }}>Limpar filtros</Button>
            </div>
          </div>
        </div>
      </div>
        </CardContent>
      </Card>

      {/* Summary Cards (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-purple-700">Total</p>
                <div className="w-8 h-8 bg-purple-200 rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-purple-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-900">{kpis.totalCount}</p>
                <p className="text-xs text-purple-600">orçamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-yellow-700">Pendentes</p>
                <div className="w-8 h-8 bg-yellow-200 rounded-lg flex items-center justify-center">
                  <Clock className="h-4 w-4 text-yellow-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-900">{formatCurrency(kpis.pendingValue)}</p>
                <p className="text-xs text-yellow-600">{kpis.pendingCount} orç.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-green-700">Aprovados</p>
                <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(kpis.approvedValue)}</p>
                <p className="text-xs text-green-600">{kpis.approvedCount} orç.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-indigo-700">Convertidos</p>
                <div className="w-8 h-8 bg-indigo-200 rounded-lg flex items-center justify-center">
                  <Target className="h-4 w-4 text-indigo-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-900">{formatCurrency(kpis.convertedValue)}</p>
                <p className="text-xs text-indigo-600">{kpis.convertedCount} orç.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">Taxa Conv.</p>
                <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center">
                  <Percent className="h-4 w-4 text-blue-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">{kpis.conversionRate.toFixed(0)}%</p>
                <p className="text-xs text-blue-600">conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-pink-700">Ticket Médio</p>
                <div className="w-8 h-8 bg-pink-200 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-pink-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-pink-900">{formatCurrency(kpis.avgTicket)}</p>
                <p className="text-xs text-pink-600">por orç.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quotes List */}
      {filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {search ? "Nenhum orçamento encontrado." : "Nenhum orçamento criado ainda."}
            </p>
            <div className="mt-4">
              <Button onClick={() => setCreatingQuoteOpen(true)}>
                Criar Primeiro Orçamento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredQuotes.map((quote: Quote) => {
              const status = statusConfig[quote.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const expired = isExpired(quote);
              const approved = quote.status === 'APPROVED';
              const converted = quote.status === 'CONVERTED';
              return (
                <Card key={quote.id} className={`shadow-lg hover:shadow-xl transition-all ${approved ? 'border-green-300 bg-green-50' : converted ? 'border-purple-300 bg-purple-50' : expired ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">Criado em</div>
                        <div>{(quote as any)?.createdAt ? formatDate((quote as any).createdAt) : '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Número</div>
                        <div className="font-medium">{quote.number}</div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ações">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Abrir menu de ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setViewingQuote(quote)}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          {quote.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => setEditingQuote(quote)}>
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => { setCloneFrom(quote); setCreatingQuoteOpen(true); }}>
                            <Copy className="mr-2 h-4 w-4" /> Clonar orçamento
                          </DropdownMenuItem>
                          {!approved && !converted && quote.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(quote, 'APPROVED')}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Aprovar
                            </DropdownMenuItem>
                          )}
                          {quote.status === 'PENDING' && (
                            <DropdownMenuItem onClick={() => handleStatusChange(quote, 'REJECTED')}>
                              <XCircle className="mr-2 h-4 w-4 text-red-600" /> Cancelar
                            </DropdownMenuItem>
                          )}
                          {approved && (
                            <DropdownMenuItem onClick={() => createSaleFromQuote(quote)}>
                              <FileText className="mr-2 h-4 w-4 text-blue-600" /> Criar venda
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Cliente</div>
                      <div className="truncate">{getCustomerName(quote.customerId)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].bg} ${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].text} ${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].border}`}
                      >
                        {status.label}
                      </Badge>
                      {expired && quote.status === 'PENDING' && (
                        <Badge variant="destructive">Vencido</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="font-medium">{formatCurrency(quote.total)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Válido até</div>
                        <div className={`${expired ? 'text-red-600 font-medium' : ''}`}>{formatDate(quote.validUntil)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Cond. Pagamento</div>
                        <div className="truncate" title={String((quote as any)?.paymentTerms || '')}>
                          {(quote as any)?.paymentTerms ? String((quote as any).paymentTerms) : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Obs.</div>
                        <div className="truncate" title={quote.notes || ''}>{quote.notes ? quote.notes : '-'}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Obs.</div>
                      <div className="truncate" title={quote.notes || ''}>{quote.notes ? quote.notes : '-'}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop list (table) */}
          <Card className="hidden md:block shadow-lg">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                {/* Header Row */}
                <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 text-xs font-semibold text-purple-800 items-center border-b border-purple-100">
                  <div className="col-span-1">Criado em</div>
                  <div className="col-span-2">Número</div>
                  <div className="col-span-2">Cliente</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-1">Cond. Pagamento</div>
                  <div className="col-span-1">Obs.</div>
                  <div className="col-span-1 text-right">Total</div>
                  <div className="col-span-1">Válido até</div>
                  <div className="col-span-1 text-right whitespace-nowrap">Ações</div>
                </div>
                {/* Rows */}
                <div className="divide-y">
                  {filteredQuotes.map((quote: Quote) => {
                    const status = statusConfig[quote.status as keyof typeof statusConfig] || statusConfig.PENDING;
                    const expired = isExpired(quote);
                    const approved = quote.status === 'APPROVED';
                    const converted = quote.status === 'CONVERTED';
                    return (
                      <div key={quote.id} className={`grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-purple-50/50 transition-colors ${approved ? 'bg-green-50' : converted ? 'bg-purple-50' : expired ? 'bg-red-50' : ''}`}>
                  <div className="col-span-1 flex items-center">
                    <div className="text-sm text-muted-foreground">{(quote as any)?.createdAt ? formatDate((quote as any).createdAt) : '-'}</div>
                  </div>
                  <div className="col-span-2 flex items-center space-x-2 truncate">
                    <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center">
                      <FileText className="h-3 w-3 text-gray-600" />
                    </div>
                    <span className="font-medium truncate">{quote.number}</span>
                  </div>
                  <div className="col-span-2 truncate" title={getCustomerName(quote.customerId)}>
                    {getCustomerName(quote.customerId)}
                  </div>
                  <div className="col-span-2 flex items-center space-x-2">
                    <Badge
                      variant="secondary"
                      className={`${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].bg} ${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].text} ${quoteStatusColors[quote.status as keyof typeof quoteStatusColors].border}`}
                    >
                      {status.label}
                    </Badge>
                    {expired && quote.status === 'PENDING' && (
                      <Badge variant="destructive">Vencido</Badge>
                    )}
                  </div>
                  <div className="col-span-1 truncate" title={String((quote as any)?.paymentTerms || '')}>
                    {(quote as any)?.paymentTerms ? String((quote as any).paymentTerms) : '-'}
                  </div>
                  <div className="col-span-1 truncate" title={quote.notes || ''}>
                    {quote.notes ? quote.notes : '-'}
                  </div>
                  <div className="col-span-1 text-right font-medium">{formatCurrency(quote.total)}</div>
                  <div className={`col-span-1 ${expired ? 'text-red-600 font-medium' : ''}`}>{formatDate(quote.validUntil)}</div>
                  <div className="col-span-1 flex items-center justify-end whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Ações">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Abrir menu de ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setViewingQuote(quote)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualizar
                        </DropdownMenuItem>
                        {quote.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => setEditingQuote(quote)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => { setCloneFrom(quote); setCreatingQuoteOpen(true); }}>
                          <Copy className="mr-2 h-4 w-4" /> Clonar orçamento
                        </DropdownMenuItem>
                        {!approved && !converted && quote.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'APPROVED')}>
                            <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Aprovar
                          </DropdownMenuItem>
                        )}
                        {quote.status === 'PENDING' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(quote, 'REJECTED')}>
                            <XCircle className="mr-2 h-4 w-4 text-red-600" /> Cancelar
                          </DropdownMenuItem>
                        )}
                        {approved && (
                          <DropdownMenuItem onClick={() => createSaleFromQuote(quote)}>
                            <FileText className="mr-2 h-4 w-4 text-blue-600" /> Criar venda
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                      </div>

                      {/* Inline quick actions removed as per new rules */}
                    </div>
                  );
                  })}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={creatingQuoteOpen} onOpenChange={(open) => { setCreatingQuoteOpen(open); if (!open) setCloneFrom(null); }}>
        <DialogContent className="sm:max-w-3xl md:max-w-5xl xl:max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>{cloneFrom ? `Clonar Orçamento ${cloneFrom.number}` : 'Novo Orçamento'}</DialogTitle>
            <DialogDescription>
              {cloneFrom ? 'Revise os dados abaixo. Ao salvar, será criado um novo orçamento com base no original.' : 'Preencha os dados do orçamento e salve.'}
            </DialogDescription>
          </DialogHeader>
          {creatingQuoteOpen && (
            <QuoteForm
              cloneFrom={cloneFrom ?? undefined}
              onSuccess={() => setCreatingQuoteOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingQuote} onOpenChange={() => setEditingQuote(null)}>
        <DialogContent className="sm:max-w-3xl md:max-w-5xl xl:max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle>Editar Orçamento</DialogTitle>
            <DialogDescription>Faça as alterações necessárias no orçamento.</DialogDescription>
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
        <DialogContent className="w-screen h-screen md:h-auto md:max-w-3xl md:w-[900px] max-w-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Orçamento</DialogTitle>
            <DialogDescription>Visualize as informações completas do orçamento.</DialogDescription>
          </DialogHeader>
          {viewingQuote && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <Badge
                      variant="secondary"
                      className={`${quoteStatusColors[viewingQuote.status as keyof typeof quoteStatusColors].bg} ${quoteStatusColors[viewingQuote.status as keyof typeof quoteStatusColors].text} ${quoteStatusColors[viewingQuote.status as keyof typeof quoteStatusColors].border}`}
                    >
                      {statusConfig[viewingQuote.status as keyof typeof statusConfig].label}
                    </Badge>
                  </div>
                  <div>
                    <Label>Válido até:</Label>
                    <p className="font-medium">{formatDate(viewingQuote.validUntil)}</p>
                  </div>
                </div>

                {/* Lista de Itens */}
                <div>
                  <Label>Itens</Label>
                  <div className="mt-2 border rounded-md overflow-x-auto">
                    <div className="min-w-[560px] divide-y">
                      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                        <div className="col-span-6">Produto/Serviço</div>
                        <div className="col-span-2 text-right">Qtd</div>
                        <div className="col-span-2 text-right">Preço Un.</div>
                        <div className="col-span-2 text-right">Total</div>
                      </div>
                      {viewingItemsLoading ? (
                        <div className="px-3 py-4 text-sm text-gray-500">Carregando itens...</div>
                      ) : viewingItems && viewingItems.length > 0 ? (
                        viewingItems.map((item: any) => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                            <div className="col-span-6 truncate" title={item.productId ? getProductName(item.productId) : (item.serviceDescription || "Serviço") }>
                              {item.productId ? getProductName(item.productId) : (item.serviceDescription || "Serviço")}
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
                </div>

                {/* Totais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Subtotal:</Label>
                    <p className="font-medium">{formatCurrency(viewingQuote.subtotal ?? 0)}</p>
                  </div>
                  <div>
                    <Label>Desconto:</Label>
                    <p className="font-medium">{formatCurrency(viewingQuote.discount ?? 0)}</p>
                  </div>
                  <div>
                    <Label>Impostos:</Label>
                    <p className="font-medium">{formatCurrency(Number((viewingQuote as any)?.taxTotal ?? 0))}</p>
                  </div>
                  <div>
                    <Label>Frete:</Label>
                    <p className="font-medium">{formatCurrency(Number((viewingQuote as any)?.shipping ?? 0))}</p>
                  </div>
                  <div className="col-span-2">
                    <Label>Total:</Label>
                    <p className="text-lg font-bold text-blue-600">{formatCurrency(viewingQuote.total ?? 0)}</p>
                  </div>
                </div>

                {viewingQuote.paymentTerms && (
                  <div>
                    <Label>Condição de Pagamento:</Label>
                    <p className="text-sm text-gray-600 mt-1">{String(viewingQuote.paymentTerms)}</p>
                  </div>
                )}
              </div>

              {viewingQuote.notes && (
                <div>
                  <Label>Observações:</Label>
                  <p className="text-sm text-gray-600 mt-1">{viewingQuote.notes}</p>
                </div>
              )}
              
              <div className="flex flex-col md:flex-row gap-2 md:justify-end pt-4">
                <Button variant="outline" onClick={() => setViewingQuote(null)}>
                  Fechar
                </Button>
                {(() => {
                  const cust = Array.isArray(customers) ? customers.find((c: Customer) => c.id === viewingQuote.customerId) : undefined;
                  const addressParts = [cust?.address, cust?.city && cust?.state ? `${cust.city} - ${cust.state}` : cust?.city || "", cust?.zipCode]
                    .filter(Boolean)
                    .join(" · ");
                  const compAddr = [companySettings?.address && `${companySettings.address}${companySettings?.number ? ", " + companySettings.number : ""}`,
                    companySettings?.complement,
                    companySettings?.neighborhood,
                    companySettings?.zipCode].filter(Boolean).join(" · ");
                  const cityUf = [companySettings?.city, companySettings?.state].filter(Boolean).join(" - ");
                  const items = Array.isArray(viewingItems) ? viewingItems.map((it: any) => {
                    const product = it.productId ? getProduct(it.productId) : null;
                    return {
                      code: product?.code || undefined,
                      description: it.productId ? getProductName(it.productId) : (it.serviceDescription || "Serviço"),
                      unit: product?.unit || "un",
                      quantity: Number(it.quantity) || 0,
                      unitPrice: Number(it.unitPrice) || 0,
                      discount: it.discount ? Number(it.discount) : 0,
                    };
                  }) : [];
                  const doc = {
                    company: {
                      // Preferir nome fantasia se existir
                      name: companySettings?.tradeName || companySettings?.name || "",
                      tradeName: companySettings?.tradeName || undefined,
                      legalName: companySettings?.name || undefined,
                      cnpj: companySettings?.cnpj || "",
                      stateRegistration: companySettings?.stateRegistration || undefined,
                      address: compAddr || "",
                      cityUf,
                      phone: companySettings?.phone || "",
                      email: companySettings?.email || "",
                    },
                    customer: {
                      name: cust?.name || "",
                      doc: cust?.document || "",
                      address: addressParts,
                      contact: [cust?.phone, cust?.email].filter(Boolean).join(" · "),
                    },
                    quote: {
                      number: viewingQuote.number,
                      date: (viewingQuote as any)?.createdAt ? String((viewingQuote as any).createdAt).slice(0,10) : new Date().toISOString().slice(0,10),
                      validUntil: String(viewingQuote.validUntil).slice(0,10),
                      paymentTerms: String(viewingQuote.paymentTerms || ""),
                      notes: viewingQuote.notes || "",
                      seller: (viewingQuote as any)?.seller || "",
                    },
                    items,
                    totals: {
                      subtotal: Number(viewingQuote.subtotal) || undefined,
                      discountTotal: Number(viewingQuote.discount) || undefined,
                      taxTotal: Number((viewingQuote as any)?.taxTotal ?? 0) || undefined,
                      shipping: Number((viewingQuote as any)?.shipping ?? 0) || undefined,
                      grandTotal: Number(viewingQuote.total) || undefined,
                    },
                    signatures: {
                      companyBase64: (viewingQuote as any)?.companySignature || undefined,
                      customerBase64: (viewingQuote as any)?.customerSignature || undefined,
                    }
                  } as any;
                  return (
                    <ExportQuoteButton
                      doc={doc}
                      buttonText="Imprimir PDF"
                      companyLogoUrl={companySettings?.logoUrl}
                      quoteId={String((viewingQuote as any)?.id || viewingQuote.number)}
                      theme={{ primary: "#1f2937", muted: "#6b7280", fontSize: 10 }}
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
