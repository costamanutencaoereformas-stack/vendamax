import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Percent, DollarSign, Layers, Users, Package, FolderCog, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

// Types expected from backend endpoint (align with planned API)
interface ProfitItem {
  id: string;
  saleId: string;
  saleNumber?: string;
  saleDate?: string;
  customerId?: string;
  customerName?: string;
  projectId?: string | null;
  projectName?: string | null;
  type: "product" | "service";
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  itemDiscount: number; // per-item discount
  allocatedDiscount: number; // proportional sale-level discount
  grossRevenue: number;
  netRevenue: number; // after discounts
  cost: number;
  profit: number;
  margin: number; // 0..1
  productId?: string | null;
  // server will include for services when serviceCost persisted on item
  persistedServiceCost?: boolean;
}

interface ProfitResponse {
  items: ProfitItem[];
  totals: {
    revenue: number;
    cost: number;
    profit: number;
    margin: number; // 0..1
  };
  groups?: Array<{
    key: string;
    label: string;
    revenue: number;
    cost: number;
    profit: number;
    margin: number; // 0..1
  }>;
}

export default function ProfitAnalysis() {
  const [filters, setFilters] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
    customerId: "all",
    projectId: "all",
    productId: "all",
    serviceCostMode: "expenses" as "expenses" | "tasks" | "hybrid",
    hourlyRate: "0",
    groupBy: "none" as "none" | "sale" | "customer" | "project" | "product" | "type",
  });

  // Client-side overrides: allow editing service costs without persisting
  const [serviceCostOverrides, setServiceCostOverrides] = useState<Record<string, number>>({});

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("start", filters.start);
    params.set("end", filters.end);
    if (filters.customerId !== "all") params.set("customerId", filters.customerId);
    if (filters.projectId !== "all") params.set("projectId", filters.projectId);
    if (filters.productId !== "all") params.set("productId", filters.productId);
    params.set("serviceCostMode", filters.serviceCostMode);
    params.set("hourlyRate", filters.hourlyRate || "0");
    if (filters.groupBy !== "none") params.set("groupBy", filters.groupBy);
    return params.toString();
  }, [filters]);

  const { data, isFetching, refetch } = useQuery<ProfitResponse>({
    queryKey: ["/api/reports/profit", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/reports/profit?${queryString}`);
      if (!res.ok) throw new Error("Falha ao carregar relatório de lucro");
      return res.json();
    },
  });

  const items = data?.items || [];

  // Load/save overrides from localStorage to survive filter changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem("profit_service_cost_overrides");
      if (raw) {
        const parsed = JSON.parse(raw || "{}");
        if (parsed && typeof parsed === "object") {
          setServiceCostOverrides(parsed as Record<string, number>);
        }
      }
    } catch {}
    // one-time load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "profit_service_cost_overrides",
        JSON.stringify(serviceCostOverrides || {})
      );
    } catch {}
  }, [serviceCostOverrides]);

  // Apply overrides to service items for display and totals
  const displayItems = useMemo(() => {
    return items.map((it) => {
      if (it.type === "service" && serviceCostOverrides[it.id] != null) {
        const overrideCost = serviceCostOverrides[it.id];
        const profit = it.netRevenue - overrideCost;
        const margin = it.netRevenue > 0 ? profit / it.netRevenue : 0;
        return { ...it, cost: overrideCost, profit, margin } as typeof it;
      }
      return it;
    });
  }, [items, serviceCostOverrides]);

  const totals = useMemo(() => {
    if (!displayItems.length) return { revenue: 0, cost: 0, profit: 0, margin: 0 };
    const acc = displayItems.reduce(
      (a, it) => {
        a.revenue += it.netRevenue;
        a.cost += it.cost;
        a.profit += it.profit;
        return a;
      },
      { revenue: 0, cost: 0, profit: 0 }
    );
    const margin = acc.revenue > 0 ? acc.profit / acc.revenue : 0;
    return { ...acc, margin };
  }, [displayItems]);

  const setFilter = (patch: Partial<typeof filters>) => setFilters((prev) => ({ ...prev, ...patch }));

  // Quick ranges
  const setQuickRange = (type: string) => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = now;
    if (type === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (type === "week") {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      start = new Date(now);
      start.setDate(now.getDate() - diffToMonday);
      end = now;
    } else if (type === "last30") {
      start = new Date(now);
      start.setDate(now.getDate() - 30);
    } else if (type === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
    } else if (type === "year") {
      start = new Date(now.getFullYear(), 0, 1);
    }
    setFilters((prev) => ({
      ...prev,
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    }));
  };

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchItemId, setLaunchItemId] = useState<string>("");
  const [launchValue, setLaunchValue] = useState<string>("");
  const selectedItem = useMemo(() => displayItems.find(i => i.id === launchItemId), [displayItems, launchItemId]);

  const handleExportCSV = () => {
    const rows = displayItems.map((it) => ({
      tipo: it.type,
      descricao: it.itemDescription,
      quantidade: it.quantity,
      precoUnit: it.unitPrice,
      descontoItem: it.itemDiscount,
      descontoRateado: it.allocatedDiscount,
      receitaLiquida: it.netRevenue,
      custo: it.cost,
      lucro: it.profit,
      margem: `${(it.margin * 100).toFixed(1)}%`,
      venda: it.saleNumber || it.saleId,
      data: it.saleDate ? formatDate(it.saleDate) : "",
      cliente: it.customerName || it.customerId || "",
      projeto: it.projectName || it.projectId || "",
    }));
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => `${(r as any)[h]}`.replace(/;|\n/g, " ")).join(";") )].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analise_lucro_${filters.start}_${filters.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <span>Análise de Lucro</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Input type="date" value={filters.start} onChange={(e) => setFilter({ start: e.target.value })} />
            </div>
            <div>
              <Label>Data Final</Label>
              <Input type="date" value={filters.end} onChange={(e) => setFilter({ end: e.target.value })} />
            </div>
            <div>
              <Label>Modo Custo Serviço</Label>
              <Select value={filters.serviceCostMode} onValueChange={(v: any) => setFilter({ serviceCostMode: v })}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expenses">Despesas Vinculadas</SelectItem>
                  <SelectItem value="tasks">Horas (Tarefas)</SelectItem>
                  <SelectItem value="hybrid">Híbrido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Hora (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={filters.hourlyRate}
                onChange={(e) => setFilter({ hourlyRate: e.target.value })}
              />
            </div>
            <div>
              <Label>Agrupar por</Label>
              <Select value={filters.groupBy} onValueChange={(v: any) => setFilter({ groupBy: v })}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem agrupamento</SelectItem>
                  <SelectItem value="type">Tipo (Produto/Serviço)</SelectItem>
                  <SelectItem value="sale">Venda</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="project">Projeto</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <Button variant="outline" onClick={() => setQuickRange("today")}>Hoje</Button>
              <Button variant="outline" onClick={() => setQuickRange("week")}>Semana</Button>
              <Button variant="outline" onClick={() => setQuickRange("last30")}>Últimos 30 dias</Button>
              <Button variant="outline" onClick={() => setQuickRange("quarter")}>Trimestre</Button>
              <Button variant="outline" onClick={() => setQuickRange("year")}>Ano</Button>
              <Button onClick={handleExportCSV} disabled={!items.length}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Receita Líquida</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.revenue)}</p>
              </div>
              <Layers className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Custo</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.cost)}</p>
              </div>
              <Package className="h-8 w-8 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lucro e Margem</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.profit)}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Percent className="h-4 w-4" /> {(totals.margin * 100).toFixed(1)}%
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Item</CardTitle>
        </CardHeader>
        <CardContent>
          {isFetching && <p className="text-sm text-gray-500">Carregando...</p>}
          {!isFetching && !items.length && (
            <p className="text-sm text-gray-500">Sem dados no período/critério selecionado.</p>
          )}
          {!!displayItems.length && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Descrição</th>
                    <th className="p-2 text-right">Qtde</th>
                    <th className="p-2 text-right">Unitário</th>
                    <th className="p-2 text-right">Desc. Item</th>
                    <th className="p-2 text-right">Desc. Rateado</th>
                    <th className="p-2 text-right">Receita Líq.</th>
                    <th className="p-2 text-right">Custo</th>
                    <th className="p-2 text-right">Lucro</th>
                    <th className="p-2 text-right">Margem</th>
                    <th className="p-2 text-left">Venda</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Projeto</th>
                    <th className="p-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.map((it) => (
                    <tr key={it.id} className="border-b">
                      <td className="p-2">
                        <Badge variant="outline">{it.type === "product" ? "Produto" : "Serviço"}</Badge>
                      </td>
                      <td className="p-2">{it.itemDescription}</td>
                      <td className="p-2 text-right">{it.quantity}</td>
                      <td className="p-2 text-right">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right">{formatCurrency(it.itemDiscount)}</td>
                      <td className="p-2 text-right">{formatCurrency(it.allocatedDiscount)}</td>
                      <td className="p-2 text-right">{formatCurrency(it.netRevenue)}</td>
                      <td className="p-2 text-right">
                        {formatCurrency(it.cost)}
                        {it.type === "service" && it.persistedServiceCost && (
                          <span className="ml-2"><Badge variant="outline">Consolidado</Badge></span>
                        )}
                      </td>
                      <td className="p-2 text-right">{formatCurrency(it.profit)}</td>
                      <td className="p-2 text-right">{(it.margin * 100).toFixed(1)}%</td>
                      <td className="p-2">{it.saleNumber || it.saleId}</td>
                      <td className="p-2">{it.customerName || it.customerId}</td>
                      <td className="p-2">{it.projectName || it.projectId}</td>
                      <td className="p-2 text-right">
                        {it.type === "service" && !it.persistedServiceCost ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Lançar custo do serviço"
                            disabled={!!saving[it.id]}
                            onClick={async () => {
                              if (it.cost > 0) {
                                try {
                                  setSaving((s) => ({ ...s, [it.id]: true }));
                                  const res = await fetch(`/api/sale-items/${it.id}/service-cost`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ serviceCost: it.cost }),
                                  });
                                  if (!res.ok) throw new Error("Falha ao lançar custo");
                                  await refetch();
                                } catch (e) {
                                  console.error(e);
                                  alert("Erro ao lançar custo do serviço.");
                                } finally {
                                  setSaving((s) => ({ ...s, [it.id]: false }));
                                }
                              } else {
                                setLaunchItemId(it.id);
                                setLaunchValue("");
                                setLaunchOpen(true);
                              }
                            }}
                          >
                            <FolderCog className="w-4 h-4" />
                          </Button>
                        ) : it.type === "service" && it.persistedServiceCost ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optional grouping summary from backend */}
      {!!data?.groups?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo por Grupo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Grupo</th>
                    <th className="p-2 text-right">Receita</th>
                    <th className="p-2 text-right">Custo</th>
                    <th className="p-2 text-right">Lucro</th>
                    <th className="p-2 text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.groups!.map((g) => (
                    <tr key={g.key} className="border-b">
                      <td className="p-2">{g.label}</td>
                      <td className="p-2 text-right">{formatCurrency(g.revenue)}</td>
                      <td className="p-2 text-right">{formatCurrency(g.cost)}</td>
                      <td className="p-2 text-right">{formatCurrency(g.profit)}</td>
                      <td className="p-2 text-right">{(g.margin * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Launch cost dialog */}
      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar custo do serviço</DialogTitle>
            <DialogDescription>
              Informe o valor do custo para consolidar no item selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item</Label>
              <div className="text-sm text-muted-foreground">{selectedItem?.itemDescription || '-'} ({selectedItem?.saleNumber || selectedItem?.saleId})</div>
            </div>
            <div>
              <Label>Valor do custo (R$)</Label>
              <Input type="number" min="0.01" step="0.01" value={launchValue} onChange={(e)=> setLaunchValue(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setLaunchOpen(false)}>Cancelar</Button>
              <Button onClick={async ()=>{
                const v = parseFloat(launchValue);
                if (!v || v <= 0) { alert('Informe um valor válido (> 0)'); return; }
                if (!launchItemId) { setLaunchOpen(false); return; }
                try {
                  setSaving((s)=> ({ ...s, [launchItemId]: true }));
                  const res = await fetch(`/api/sale-items/${launchItemId}/service-cost`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ serviceCost: v })
                  });
                  if (!res.ok) throw new Error('Falha ao lançar custo');
                  await refetch();
                  setLaunchOpen(false);
                } catch (e) {
                  console.error(e);
                  alert('Erro ao lançar custo do serviço.');
                } finally {
                  setSaving((s)=> ({ ...s, [launchItemId]: false }));
                }
              }}>Lançar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
