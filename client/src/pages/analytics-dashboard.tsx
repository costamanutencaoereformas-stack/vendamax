import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Download, Calendar, TrendingUp, DollarSign, Package, Users } from "lucide-react";
import type { Quote, Sale, Customer, Product } from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

export default function AnalyticsDashboard() {
  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Filter states
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Fetch data
  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: sales, isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
  });

  const { data: customers, isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: ["/api/categories"],
  });

  const isLoading = quotesLoading || salesLoading || customersLoading || productsLoading;

  // Filter data based on date range and filters
  const filteredData = useMemo(() => {
    if (!quotes || !sales || !customers || !products) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filterByDate = (item: any) => {
      const date = new Date(item.createdAt || item.date);
      return date >= start && date <= end;
    };

    let filteredQuotes = quotes.filter(filterByDate);
    let filteredSales = sales.filter(filterByDate);

    // Apply customer filter
    if (selectedCustomer) {
      filteredQuotes = filteredQuotes.filter(q => q.customerId === selectedCustomer);
      filteredSales = filteredSales.filter(s => s.customerId === selectedCustomer);
    }

    // Apply status filter for quotes
    if (selectedStatus) {
      filteredQuotes = filteredQuotes.filter(q => q.status === selectedStatus);
    }

    return {
      quotes: filteredQuotes,
      sales: filteredSales,
      customers,
      products,
    };
  }, [quotes, sales, customers, products, startDate, endDate, selectedCustomer, selectedStatus]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!filteredData) return null;

    const { quotes, sales, customers, products } = filteredData;

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalQuotes = quotes.length;
    const totalSales = sales.length;
    const conversionRate = totalQuotes > 0 ? (totalSales / totalQuotes) * 100 : 0;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const quotesValue = quotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
    const approvedQuotes = quotes.filter(q => q.status === 'APPROVED').length;
    const pendingQuotes = quotes.filter(q => q.status === 'PENDING').length;
    const rejectedQuotes = quotes.filter(q => q.status === 'REJECTED').length;

    return {
      totalRevenue,
      totalQuotes,
      totalSales,
      conversionRate,
      avgTicket,
      quotesValue,
      approvedQuotes,
      pendingQuotes,
      rejectedQuotes,
      activeCustomers: customers.length,
      totalProducts: products.length,
    };
  }, [filteredData]);

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    if (!filteredData) return [];

    const { quotes, sales } = filteredData;
    const monthsMap = new Map<string, { sales: number; quotes: number; salesCount: number; quotesCount: number }>();

    // Process sales
    sales.forEach(sale => {
      const date = new Date(sale.createdAt || sale.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthsMap.get(monthKey) || { sales: 0, quotes: 0, salesCount: 0, quotesCount: 0 };
      existing.sales += Number(sale.total || 0);
      existing.salesCount += 1;
      monthsMap.set(monthKey, existing);
    });

    // Process quotes
    quotes.forEach(quote => {
      const date = new Date((quote as any).createdAt || quote.validUntil);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthsMap.get(monthKey) || { sales: 0, quotes: 0, salesCount: 0, quotesCount: 0 };
      existing.quotes += Number(quote.total || 0);
      existing.quotesCount += 1;
      monthsMap.set(monthKey, existing);
    });

    return Array.from(monthsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        vendas: data.sales,
        orcamentos: data.quotes,
        numVendas: data.salesCount,
        numOrcamentos: data.quotesCount,
      }));
  }, [filteredData]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    if (!filteredData) return [];

    const { quotes } = filteredData;
    const statusMap = new Map<string, number>();

    quotes.forEach(quote => {
      const status = quote.status;
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    const statusLabels: Record<string, string> = {
      PENDING: 'Pendente',
      APPROVED: 'Aprovado',
      REJECTED: 'Rejeitado',
      CONVERTED: 'Convertido',
    };

    return Array.from(statusMap.entries()).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
    }));
  }, [filteredData]);

  // Top customers
  const topCustomers = useMemo(() => {
    if (!filteredData) return [];

    const { sales, customers } = filteredData;
    const customerSales = new Map<string, number>();

    sales.forEach(sale => {
      const current = customerSales.get(sale.customerId) || 0;
      customerSales.set(sale.customerId, current + Number(sale.total || 0));
    });

    return Array.from(customerSales.entries())
      .map(([customerId, total]) => {
        const customer = customers.find(c => c.id === customerId);
        return {
          name: customer?.name || 'Desconhecido',
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredData]);

  // Top products
  const topProducts = useMemo(() => {
    if (!filteredData) return [];

    const { sales, products } = filteredData;
    
    // Get all sale items
    const productSales = new Map<string, { quantity: number; revenue: number }>();

    sales.forEach(sale => {
      // This is a simplified version. In reality, you'd need to fetch sale items
      // For now, we'll just show products that exist
    });

    // For demonstration, show products by current stock value
    return products
      .map(p => ({
        name: p.name,
        value: Number(p.currentStock || 0) * Number(p.salePrice || 0),
        stock: Number(p.currentStock || 0),
      }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  // Handle export
  const handleExport = () => {
    if (!filteredData || !metrics) return;

    const csvContent = [
      ['Análise de Dados - Período', `${startDate} a ${endDate}`],
      [],
      ['Métricas Gerais'],
      ['Total em Vendas', metrics.totalRevenue.toFixed(2)],
      ['Total de Orçamentos', metrics.totalQuotes],
      ['Total de Vendas', metrics.totalSales],
      ['Taxa de Conversão', `${metrics.conversionRate.toFixed(2)}%`],
      ['Ticket Médio', metrics.avgTicket.toFixed(2)],
      [],
      ['Evolução Mensal'],
      ['Mês', 'Vendas (R$)', 'Orçamentos (R$)', 'Qtd Vendas', 'Qtd Orçamentos'],
      ...monthlyTrend.map(d => [d.month, d.vendas, d.orcamentos, d.numVendas, d.numOrcamentos]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analise-dados-${startDate}-${endDate}.csv`;
    link.click();
  };

  const handleQuickFilter = (period: 'week' | 'month' | 'quarter' | 'year') => {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'week':
        start.setDate(end.getDate() - 7);
        break;
      case 'month':
        start.setMonth(end.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(end.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard de Análise de Dados</h1>
          <nav className="breadcrumb mt-1">
            <a href="/">Início</a>
            <span className="breadcrumb-sep">/</span>
            <span>Análise de Dados</span>
          </nav>
        </div>
        <div className="toolbar">
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Quick filters */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter('week')}>
                Última Semana
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter('month')}>
                Último Mês
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter('quarter')}>
                Último Trimestre
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleQuickFilter('year')}>
                Último Ano
              </Button>
            </div>

            {/* Date range and filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Data Inicial</Label>
                <input
                  id="startDate"
                  type="date"
                  className="w-full h-10 border rounded-md px-3 bg-white"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">Data Final</Label>
                <input
                  id="endDate"
                  type="date"
                  className="w-full h-10 border rounded-md px-3 bg-white"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="customer">Cliente</Label>
                <select
                  id="customer"
                  className="w-full h-10 border rounded-md px-3 bg-white"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                >
                  <option value="">Todos</option>
                  {customers?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status">Status Orçamento</Label>
                <select
                  id="status"
                  className="w-full h-10 border rounded-md px-3 bg-white"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="PENDING">Pendente</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="REJECTED">Rejeitado</option>
                  <option value="CONVERTED">Convertido</option>
                </select>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setSelectedCustomer("");
                setSelectedStatus("");
                setSelectedCategory("");
              }}
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Receita Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.totalRevenue || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.totalSales || 0} vendas realizadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.conversionRate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.totalSales}/{metrics?.totalQuotes} orçamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.avgTicket || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Por venda realizada
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeCustomers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.totalProducts || 0} produtos cadastrados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal - Vendas vs Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088FE" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOrcamentos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#00C49F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="vendas"
                  stroke="#0088FE"
                  fillOpacity={1}
                  fill="url(#colorVendas)"
                  name="Vendas"
                />
                <Area
                  type="monotone"
                  dataKey="orcamentos"
                  stroke="#00C49F"
                  fillOpacity={1}
                  fill="url(#colorOrcamentos)"
                  name="Orçamentos"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status dos Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Clientes por Faturamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topCustomers} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="total" fill="#0088FE" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Produtos por Valor em Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'value') return formatCurrency(value);
                    return value;
                  }}
                />
                <Legend />
                <Bar dataKey="value" fill="#00C49F" name="Valor" />
                <Bar dataKey="stock" fill="#FFBB28" name="Estoque" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Count Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Quantidade de Vendas e Orçamentos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="numVendas"
                stroke="#0088FE"
                strokeWidth={2}
                name="Qtd Vendas"
                dot={{ fill: '#0088FE' }}
              />
              <Line
                type="monotone"
                dataKey="numOrcamentos"
                stroke="#00C49F"
                strokeWidth={2}
                name="Qtd Orçamentos"
                dot={{ fill: '#00C49F' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
