import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Users, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import type { Sale, Quote, Customer, Product } from "@shared/schema";
import { useSearch } from "@/contexts/search-context";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [reportType, setReportType] = useState("sales");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { search } = useSearch();

  const { data: sales, refetch: refetchSales, isRefetching: isRefetchingSales } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    refetchInterval: 30000, // Atualiza a cada 30 segundos
    refetchOnWindowFocus: true,
  });

  const { data: quotes, refetch: refetchQuotes, isRefetching: isRefetchingQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: customers, refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    refetchOnWindowFocus: true,
  });

  const { data: products, refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    refetchOnWindowFocus: true,
  });

  const { data: lowStockProducts, refetch: refetchLowStock } = useQuery<Product[]>({
    queryKey: ["/api/products/low-stock"],
    refetchInterval: 60000, // Atualiza a cada 60 segundos
    refetchOnWindowFocus: true,
  });

  // Monthly report (server aggregated)
  const { data: monthly, refetch: refetchMonthly } = useQuery<Array<{ month: string; sales: number; salesCount: number; quotes: number }>>({
    queryKey: ["/api/reports/monthly"],
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
  });

  // Função para atualizar todos os dados
  const handleRefreshAll = async () => {
    toast({ title: "Atualizando dados...", description: "Buscando informações mais recentes" });
    await Promise.all([
      refetchSales(),
      refetchQuotes(),
      refetchCustomers(),
      refetchProducts(),
      refetchLowStock(),
      refetchMonthly(),
    ]);
    setLastUpdate(new Date());
    toast({ title: "Dados atualizados!", description: "Todas as informações foram atualizadas com sucesso" });
  };

  const isRefreshing = isRefetchingSales || isRefetchingQuotes;

  // Atualizar timestamp quando os dados mudarem
  useEffect(() => {
    if (!isRefreshing && (sales || quotes)) {
      setLastUpdate(new Date());
    }
  }, [sales, quotes, isRefreshing]);

  // Quick period helpers
  const setQuickRange = (type: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (type) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week": {
        const day = now.getDay(); // 0 Sun
        const diffToMonday = (day + 6) % 7;
        start = new Date(now);
        start.setDate(now.getDate() - diffToMonday);
        break; }
      case "last30":
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      case "quarter": {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        break; }
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  // Filter data by date range, status and search
  const normalizedSearch = (search || "").toLowerCase().trim();

  const filteredSales = useMemo(() => {
    const arr: Sale[] = (sales || []).filter((sale: Sale) => {
      if (!sale.createdAt) return false;
      const d = new Date(sale.createdAt).toISOString().split('T')[0];
      const inRange = d >= dateRange.start && d <= dateRange.end;
      const statusOk = statusFilter === "all" || sale.status === statusFilter;
      if (!inRange || !statusOk) return false;
      if (!normalizedSearch) return true;
      const customerName = customers?.find((c: Customer) => c.id === sale.customerId)?.name?.toLowerCase() || "";
      return (
        (sale.number || "").toLowerCase().includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        (sale.notes || "").toLowerCase().includes(normalizedSearch)
      );
    });
    return arr;
  }, [sales, customers, dateRange, statusFilter, normalizedSearch]);

  const filteredQuotes = useMemo(() => {
    const arr: Quote[] = (quotes || []).filter((quote: Quote) => {
      if (!quote.createdAt) return false;
      const d = new Date(quote.createdAt).toISOString().split('T')[0];
      const inRange = d >= dateRange.start && d <= dateRange.end;
      const statusOk = statusFilter === "all" || quote.status === statusFilter;
      if (!inRange || !statusOk) return false;
      if (!normalizedSearch) return true;
      const customerName = customers?.find((c: Customer) => c.id === quote.customerId)?.name?.toLowerCase() || "";
      return (
        (quote.number || "").toLowerCase().includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        (quote.notes || "").toLowerCase().includes(normalizedSearch)
      );
    });
    return arr;
  }, [quotes, customers, dateRange, statusFilter, normalizedSearch]);

  // Calculate metrics
  const totalSalesRevenue = filteredSales.reduce((sum: number, sale: Sale) => 
    sum + parseFloat(sale.total), 0
  );

  const totalQuotesValue = filteredQuotes.reduce((sum: number, quote: Quote) => 
    sum + parseFloat(quote.total), 0
  );

  const completedSales = filteredSales.filter((sale: Sale) => sale.status === 'COMPLETED');
  const totalCompletedRevenue = completedSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0);
  const pendingQuotes = filteredQuotes.filter((quote: Quote) => quote.status === 'PENDING');
  const approvedQuotes = filteredQuotes.filter((quote: Quote) => quote.status === 'APPROVED');
  const convertedQuotes = filteredQuotes.filter((quote: Quote) => quote.status === 'CONVERTED');

  const conversionRate = filteredQuotes.length > 0 
    ? ((convertedQuotes.length / filteredQuotes.length) * 100).toFixed(1)
    : "0.0";

  // Top customers by sales value
  const customerSales = new Map<string, number>();
  filteredSales.forEach((sale: Sale) => {
    const current = customerSales.get(sale.customerId) || 0;
    customerSales.set(sale.customerId, current + parseFloat(sale.total));
  });

  const topCustomers = Array.from(customerSales.entries())
    .map(([customerId, value]) => ({
      customer: customers?.find((c: Customer) => c.id === customerId),
      value
    }))
    .filter(item => item.customer)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Sales by month (last 6 months) - fallback local computation if API not available
  const localMonthlyData = (() => {
    const arr: Array<{ month: string; sales: number; salesCount: number; quotes: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthSales = (sales || []).filter((sale: Sale) => sale.createdAt && new Date(sale.createdAt) >= monthStart && new Date(sale.createdAt) <= monthEnd);
      const monthQuotes = (quotes || []).filter((quote: Quote) => quote.createdAt && new Date(quote.createdAt) >= monthStart && new Date(quote.createdAt) <= monthEnd);
      arr.push({
        month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        sales: monthSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0),
        quotes: monthQuotes.length,
        salesCount: monthSales.length,
      });
    }
    return arr;
  })();
  const monthlyData = monthly && Array.isArray(monthly) && monthly.length === 6 ? monthly : localMonthlyData;

  // Purge-safe color mapping for Tailwind classes
  const colorClasses: Record<string, { bg: string; text: string }> = {
    green: { bg: 'bg-green-50', text: 'text-green-600' },
    yellow: { bg: 'bg-yellow-50', text: 'text-yellow-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
  };

  // Exports
  const buildRowsForExport = () => {
    if (reportType === "sales") {
      return filteredSales.map(s => ({
        tipo: "Venda",
        numero: s.number,
        cliente: customers?.find(c => c.id === s.customerId)?.name || "",
        total: s.total,
        status: s.status,
  data: formatDate(s.createdAt || ""),
      }));
    }
    if (reportType === "quotes") {
      return filteredQuotes.map(q => ({
        tipo: "Orçamento",
        numero: q.number,
        cliente: customers?.find(c => c.id === q.customerId)?.name || "",
        total: q.total,
        status: q.status,
        validade: formatDate(q.validUntil),
  criadoEm: formatDate(q.createdAt || ""),
      }));
    }
    if (reportType === "customers") {
      // agregação simples no período
      const map = new Map<string, { name: string; valor: number; qtde: number }>();
      filteredSales.forEach(s => {
        const name = customers?.find(c => c.id === s.customerId)?.name || s.customerId;
        const cur = map.get(s.customerId) || { name, valor: 0, qtde: 0 };
        cur.valor += parseFloat(s.total);
        cur.qtde += 1;
        map.set(s.customerId, cur);
      });
      return Array.from(map.values()).map(v => ({ cliente: v.name, valor: v.valor.toFixed(2), vendas: v.qtde }));
    }
    // products: export baixo estoque e catálogo básico
    return (products || []).map(p => ({
      codigo: p.code,
      nome: p.name,
      estoque: p.currentStock,
      minimo: p.minimumStock,
      preco: p.salePrice,
    }));
  };

  const handleExportCSV = () => {
    const rows = buildRowsForExport();
    if (!rows.length) {
      toast({ title: "Sem dados para exportar" });
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";"), ...rows.map(r => headers.map(h => `${(r as any)[h]}`.replace(/;|\n/g, ' ')).join(";") )].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${reportType}_${dateRange.start}_${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const rows = buildRowsForExport();
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Relatório</title>
      <style>body{font-family:Arial;padding:24px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:8px;font-size:12px} th{background:#f3f4f6}</style>
    </head><body>`);
    win.document.write(`<h2>Relatório: ${reportType.toUpperCase()} (${dateRange.start} a ${dateRange.end})</h2>`);
    if (!rows.length) {
      win.document.write('<p>Sem dados</p>');
    } else {
      win.document.write('<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>');
      rows.forEach(r => {
        win!.document.write('<tr>' + headers.map(h => `<td>${(r as any)[h]}</td>`).join('') + '</tr>');
      });
      win.document.write('</tbody></table>');
    }
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      {/* Indicador de atualização automática */}
      {isRefreshing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-blue-800">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Atualizando dados automaticamente...</span>
        </div>
      )}
      
      {/* Date Range, Status, Search and Export Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Filtros de Relatório</span>
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshAll}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(v) => { setReportType(v); setStatusFilter("all"); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Vendas</SelectItem>
                  <SelectItem value="quotes">Orçamentos</SelectItem>
                  <SelectItem value="customers">Clientes</SelectItem>
                  <SelectItem value="products">Produtos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {reportType === 'sales' && (
                    <>
                      <SelectItem value="COMPLETED">Concluída</SelectItem>
                      <SelectItem value="PROCESSING">Processando</SelectItem>
                      <SelectItem value="CANCELLED">Cancelada</SelectItem>
                    </>
                  )}
                  {reportType === 'quotes' && (
                    <>
                      <SelectItem value="PENDING">Pendente</SelectItem>
                      <SelectItem value="APPROVED">Aprovado</SelectItem>
                      <SelectItem value="CONVERTED">Convertido</SelectItem>
                      <SelectItem value="REJECTED">Rejeitado</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setQuickRange('today')}>Hoje</Button>
              <Button variant="outline" onClick={() => setQuickRange('week')}>Semana</Button>
              <Button variant="outline" onClick={() => setQuickRange('last30')}>Últimos 30 dias</Button>
              <Button variant="outline" onClick={() => setQuickRange('quarter')}>Trimestre</Button>
              <Button variant="outline" onClick={() => setQuickRange('year')}>Ano</Button>
            </div>
            <div className="ml-auto flex items-end gap-2">
              <Button variant="secondary" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button onClick={handleExportPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-muted-foreground">Faturamento</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalCompletedRevenue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {completedSales.length} vendas concluídas
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Orçamentos</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalQuotesValue)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {filteredQuotes.length} orçamentos
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa Conversão</p>
                <p className="text-2xl font-bold text-foreground">{conversionRate}%</p>
                <p className="text-sm text-muted-foreground">
                  {convertedQuotes.length} convertidos
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos Baixo Estoque</p>
                <p className="text-2xl font-bold text-foreground">
                  {lowStockProducts?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Requer atenção
                </p>
              </div>
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card className="shadow-lg border-purple-100">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <TrendingUp className="h-5 w-5" />
              Evolução Mensal (Últimos 6 Meses)
            </CardTitle>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-t from-blue-500 to-blue-400"></div>
                <span className="text-muted-foreground">Vendas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-gradient-to-t from-green-500 to-green-400"></div>
                <span className="text-muted-foreground">Orçamentos</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-8">
          {(() => {
            const totalSalesSum = monthlyData.reduce((s, d) => s + (d.sales || 0), 0);
            const totalCountSum = monthlyData.reduce((s, d) => s + (d.salesCount || 0) + (d.quotes || 0), 0);
            if (totalSalesSum === 0 && totalCountSum === 0) {
              return (
                <div className="text-center py-12">
                  <TrendingDown className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Sem dados nos últimos 6 meses</p>
                  <p className="text-sm text-muted-foreground mt-1">Comece criando vendas e orçamentos</p>
                </div>
              );
            }
            const maxSales = Math.max(...monthlyData.map(d => d.sales || 0), 1);
            const maxQuotes = Math.max(...monthlyData.map(d => d.quotes || 0), 1);
            return (
              <div className="space-y-6">
                {/* Totais do Período */}
                <div className="grid grid-cols-3 gap-4 pb-4 border-b">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total Faturado</p>
                    <p className="text-xl font-bold text-blue-600">{formatCurrency(totalSalesSum)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Vendas Realizadas</p>
                    <p className="text-xl font-bold text-purple-600">{monthlyData.reduce((s, d) => s + (d.salesCount || 0), 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Orçamentos Criados</p>
                    <p className="text-xl font-bold text-green-600">{monthlyData.reduce((s, d) => s + (d.quotes || 0), 0)}</p>
                  </div>
                </div>
                
                {/* Gráfico de Barras */}
                <div className="h-80 flex items-end justify-between gap-2 px-4">
                  {monthlyData.map((data, index) => {
                    const salesHeight = (data.sales / maxSales) * 100;
                    const quotesHeight = (data.quotes / maxQuotes) * 100;
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center group">
                        <div className="w-full flex justify-center gap-1 items-end h-64">
                          {/* Barra de Vendas */}
                          <div className="relative flex-1 max-w-[40px]">
                            <div
                              className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 hover:from-blue-700 hover:to-blue-500 transition-all shadow-lg relative group/bar"
                              style={{ height: data.sales > 0 ? `${Math.max(salesHeight, 8)}%` : '4px' }}
                            >
                              {/* Tooltip Vendas */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10">
                                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                                  <div className="font-semibold text-blue-300 mb-1">💰 Vendas</div>
                                  <div>{formatCurrency(data.sales)}</div>
                                  <div className="text-gray-300">{data.salesCount} vendas</div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Barra de Orçamentos */}
                          <div className="relative flex-1 max-w-[40px]">
                            <div
                              className="w-full rounded-t-lg bg-gradient-to-t from-green-600 to-green-400 hover:from-green-700 hover:to-green-500 transition-all shadow-lg relative group/bar"
                              style={{ height: data.quotes > 0 ? `${Math.max(quotesHeight, 8)}%` : '4px' }}
                            >
                              {/* Tooltip Orçamentos */}
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-10">
                                <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                                  <div className="font-semibold text-green-300 mb-1">📋 Orçamentos</div>
                                  <div>{data.quotes} criados</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Label do Mês */}
                        <div className="mt-3 text-center">
                          <span className="text-xs font-medium text-gray-700 uppercase">{data.month}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Additional KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold text-foreground">
                  {completedSales.length ? formatCurrency(totalCompletedRevenue / completedSales.length) : formatCurrency(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio de Conversão</p>
                <p className="text-2xl font-bold text-foreground">
                  {(() => {
                    const saleByQuote = new Map(filteredSales.filter(s => s.quoteId).map(s => [s.quoteId!, s]));
                    const diffs: number[] = [];
                    filteredQuotes.forEach(q => {
                      const s = saleByQuote.get(q.id);
                      if (s && q.createdAt && s.createdAt) {
                        const days = (new Date(s.createdAt).getTime() - new Date(q.createdAt).getTime()) / (1000*60*60*24);
                        if (days >= 0) diffs.push(days);
                      }
                    });
                    const avg = diffs.length ? diffs.reduce((a,b)=>a+b,0)/diffs.length : 0;
                    return `${avg.toFixed(1)} dias`;
                  })()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Itens Baixo Estoque</p>
                <p className="text-2xl font-bold text-foreground">{lowStockProducts?.length || 0}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  const rows = (lowStockProducts || []).map((p: Product) => ({ codigo: p.code, nome: p.name, estoque: p.currentStock, minimo: p.minimumStock }));
                  if (!rows.length) { toast({ title: 'Sem itens de baixo estoque' }); return; }
                  const headers = Object.keys(rows[0]);
                  const csv = [headers.join(';'), ...rows.map(r => headers.map(h => `${(r as any)[h]}`).join(';'))].join('\n');
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `baixo_estoque_${dateRange.end}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>Exportar</Button>
                <a href="/products?lowStock=1"><Button>Ver produtos</Button></a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum dados disponível</p>
            ) : (
              <div className="space-y-4">
                {topCustomers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{item.customer?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.customer?.documentType === 'CNPJ' ? 'Empresa' : 'Pessoa Física'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(item.value)}</p>
                      <Badge variant="outline">#{index + 1}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quote Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status dos Orçamentos (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Pendentes</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{pendingQuotes.length}</span>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(pendingQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Aprovados</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{approvedQuotes.length}</span>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(approvedQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Convertidos</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{convertedQuotes.length}</span>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(convertedQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="font-medium">Rejeitados</span>
                <div className="text-right">
                  <span className="text-lg font-bold">
                    {filteredQuotes.filter((q: Quote) => q.status === 'REJECTED').length}
                  </span>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(
                      filteredQuotes
                        .filter((q: Quote) => q.status === 'REJECTED')
                        .reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status das Vendas (Período)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Concluídas', color: 'green', key: 'COMPLETED' },
              { label: 'Processando', color: 'yellow', key: 'PROCESSING' },
              { label: 'Canceladas', color: 'red', key: 'CANCELLED' },
            ].map(s => {
              const items = filteredSales.filter(x => x.status === (s.key as any));
              const total = items.reduce((sum, it) => sum + parseFloat(it.total), 0);
              return (
                <div key={s.key} className={`flex justify-between items-center p-3 ${colorClasses[s.color].bg} rounded-lg`}>
                  <span className="font-medium">{s.label}</span>
                  <div className="text-right">
                    <span className="text-lg font-bold">{items.length}</span>
                    <p className={`text-sm ${colorClasses[s.color].text}`}>{formatCurrency(total)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Segment performance (by customer segment) */}
      <Card>
        <CardHeader>
          <CardTitle>Faturamento por Segmento (Período)</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const map = new Map<string, number>();
            filteredSales.forEach(s => {
              const seg = customers?.find(c => c.id === s.customerId)?.segment || 'Sem segmento';
              map.set(seg, (map.get(seg) || 0) + parseFloat(s.total));
            });
            const arr = Array.from(map.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
            if (!arr.length) return <p className="text-muted-foreground">Sem dados</p>;
            const max = Math.max(...arr.map(([,v])=>v), 1);
            return (
              <div className="space-y-3">
                {arr.map(([seg, val]) => (
                  <div key={seg} className="space-y-1">
                    <div className="flex justify-between text-sm"><span>{seg}</span><span>{formatCurrency(val)}</span></div>
                    <div className="h-2 bg-muted rounded"><div className="h-2 bg-primary rounded" style={{ width: `${(val/max)*100}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Detailed tables per report type */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {reportType === 'sales' && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left">Número</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Data</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((s, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2">{s.number}</td>
                      <td className="p-2">{customers?.find(c => c.id === s.customerId)?.name}</td>
                      <td className="p-2">{s.createdAt ? formatDate(s.createdAt) : '-'}</td>
                      <td className="p-2"><Badge variant="outline">{s.status}</Badge></td>
                      <td className="p-2 text-right">{formatCurrency(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reportType === 'quotes' && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="p-2 text-left">Número</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Criado</th>
                    <th className="p-2 text-left">Validade</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((q, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2">{q.number}</td>
                      <td className="p-2">{customers?.find(c => c.id === q.customerId)?.name}</td>
                      <td className="p-2">{q.createdAt ? formatDate(q.createdAt) : '-'}</td>
                      <td className="p-2">{formatDate(q.validUntil)}</td>
                      <td className="p-2"><Badge variant="outline">{q.status}</Badge></td>
                      <td className="p-2 text-right">{formatCurrency(q.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reportType === 'customers' && (
            <div className="overflow-auto">
              {(() => {
                const map = new Map<string, { name: string; valor: number; qtde: number; last: Date | null }>();
                filteredSales.forEach(s => {
                  const name = customers?.find(c => c.id === s.customerId)?.name || s.customerId;
                  const cur = map.get(s.customerId) || { name, valor: 0, qtde: 0, last: null };
                  cur.valor += parseFloat(s.total);
                  cur.qtde += 1;
                  cur.last = cur.last && s.createdAt ? (new Date(cur.last) > new Date(s.createdAt) ? cur.last : new Date(s.createdAt)) : (s.createdAt ? new Date(s.createdAt) : cur.last);
                  map.set(s.customerId, cur);
                });
                const rows = Array.from(map.values()).sort((a,b)=>b.valor-a.valor);
                return (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left">Cliente</th>
                        <th className="p-2 text-right">Faturamento</th>
                        <th className="p-2 text-right">Vendas</th>
                        <th className="p-2 text-left">Último Movimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.name}</td>
                          <td className="p-2 text-right">{formatCurrency(r.valor)}</td>
                          <td className="p-2 text-right">{r.qtde}</td>
                          <td className="p-2">{r.last ? formatDateTime(r.last.toISOString()) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
          {reportType === 'products' && (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Produto</th>
                    <th className="p-2 text-right">Estoque</th>
                    <th className="p-2 text-right">Mínimo</th>
                    <th className="p-2 text-right">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {(products || []).map((p, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{p.code}</td>
                      <td className="p-2">{p.name}</td>
                      <td className="p-2 text-right">{p.currentStock}</td>
                      <td className="p-2 text-right">{p.minimumStock}</td>
                      <td className="p-2 text-right">{formatCurrency(p.salePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...filteredSales.slice(-5), ...filteredQuotes.slice(-5)]
              .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
              .slice(0, 10)
              .map((item: any, index) => (
                <div key={index} className="flex items-center justify-between p-3 border-b">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      'number' in item ? 'bg-green-500' : 'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium">
                        {'number' in item ? `Venda ${item.number}` : `Orçamento ${item.number}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {customers?.find((c: Customer) => c.id === item.customerId)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.total)}</p>
                    <p className="text-xs text-gray-500">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
