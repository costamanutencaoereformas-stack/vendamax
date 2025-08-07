import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import type { Sale, Quote, Customer, Product } from "@shared/schema";

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [reportType, setReportType] = useState("sales");
  const { toast } = useToast();

  const { data: sales } = useQuery({
    queryKey: ["/api/sales"],
  });

  const { data: quotes } = useQuery({
    queryKey: ["/api/quotes"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: lowStockProducts } = useQuery({
    queryKey: ["/api/products/low-stock"],
  });

  // Filter data by date range
  const filteredSales = sales?.filter((sale: Sale) => {
    if (!sale.createdAt) return false;
    const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
    return saleDate >= dateRange.start && saleDate <= dateRange.end;
  }) || [];

  const filteredQuotes = quotes?.filter((quote: Quote) => {
    if (!quote.createdAt) return false;
    const quoteDate = new Date(quote.createdAt).toISOString().split('T')[0];
    return quoteDate >= dateRange.start && quoteDate <= dateRange.end;
  }) || [];

  // Calculate metrics
  const totalSalesRevenue = filteredSales.reduce((sum: number, sale: Sale) => 
    sum + parseFloat(sale.total), 0
  );

  const totalQuotesValue = filteredQuotes.reduce((sum: number, quote: Quote) => 
    sum + parseFloat(quote.total), 0
  );

  const completedSales = filteredSales.filter((sale: Sale) => sale.status === 'COMPLETED');
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

  // Sales by month (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    const monthSales = sales?.filter((sale: Sale) => {
      if (!sale.createdAt) return false;
      const saleDate = new Date(sale.createdAt);
      return saleDate >= monthStart && saleDate <= monthEnd;
    }) || [];

    const monthQuotes = quotes?.filter((quote: Quote) => {
      if (!quote.createdAt) return false;
      const quoteDate = new Date(quote.createdAt);
      return quoteDate >= monthStart && quoteDate <= monthEnd;
    }) || [];
    
    monthlyData.push({
      month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      sales: monthSales.reduce((sum: number, sale: Sale) => sum + parseFloat(sale.total), 0),
      quotes: monthQuotes.length,
      salesCount: monthSales.length
    });
  }

  const handleExport = () => {
    toast({
      title: "Em desenvolvimento",
      description: "Funcionalidade de exportação em desenvolvimento.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Range and Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Filtros de Relatório</span>
          </CardTitle>
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
              <Select value={reportType} onValueChange={setReportType}>
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
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Faturamento</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalSalesRevenue)}
                </p>
                <p className="text-sm text-green-600">
                  {completedSales.length} vendas concluídas
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Orçamentos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(totalQuotesValue)}
                </p>
                <p className="text-sm text-blue-600">
                  {filteredQuotes.length} orçamentos
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa Conversão</p>
                <p className="text-2xl font-bold text-gray-900">{conversionRate}%</p>
                <p className="text-sm text-purple-600">
                  {convertedQuotes.length} convertidos
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Produtos Baixo Estoque</p>
                <p className="text-2xl font-bold text-gray-900">
                  {lowStockProducts?.length || 0}
                </p>
                <p className="text-sm text-orange-600">
                  Requer atenção
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Mensal (Últimos 6 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between space-x-2">
            {monthlyData.map((data, index) => {
              const maxValue = Math.max(...monthlyData.map(d => d.sales), 1);
              const height = (data.sales / maxValue) * 100;
              
              return (
                <div key={index} className="flex flex-col items-center space-y-2 group">
                  <div className="relative">
                    <div 
                      className="w-12 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                      style={{ height: `${Math.max(height, 5)}%` }}
                    />
                    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        {formatCurrency(data.sales)}
                        <br />
                        {data.salesCount} vendas
                        <br />
                        {data.quotes} orçamentos
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{data.month}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Clientes (Período)</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum dados disponível</p>
            ) : (
              <div className="space-y-4">
                {topCustomers.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{item.customer?.name}</p>
                        <p className="text-sm text-gray-500">
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
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="font-medium">Pendentes</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{pendingQuotes.length}</span>
                  <p className="text-sm text-blue-600">
                    {formatCurrency(pendingQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="font-medium">Aprovados</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{approvedQuotes.length}</span>
                  <p className="text-sm text-green-600">
                    {formatCurrency(approvedQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="font-medium">Convertidos</span>
                <div className="text-right">
                  <span className="text-lg font-bold">{convertedQuotes.length}</span>
                  <p className="text-sm text-purple-600">
                    {formatCurrency(convertedQuotes.reduce((sum: number, q: Quote) => sum + parseFloat(q.total), 0))}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <span className="font-medium">Rejeitados</span>
                <div className="text-right">
                  <span className="text-lg font-bold">
                    {filteredQuotes.filter((q: Quote) => q.status === 'REJECTED').length}
                  </span>
                  <p className="text-sm text-red-600">
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
