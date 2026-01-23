import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Sale } from "@shared/schema";

export default function SalesChart() {
  const { data: sales = [], isError } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    retry: 2,
    staleTime: 30000, // 30 segundos - dados ficam obsoletos
  });

  // Calculate sales for the last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const salesByDay = last7Days.map(day => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    const daySales = Array.isArray(sales) ? sales.filter((sale: any) => {
      if (!sale.createdAt) return false;
      const saleDate = new Date(sale.createdAt);
      return saleDate >= dayStart && saleDate <= dayEnd;
    }) : [];

    const total = daySales.reduce((sum: number, sale: any) => sum + parseFloat(sale.total), 0);
    
    return {
      day: day.toLocaleDateString('pt-BR', { weekday: 'short' }),
      value: total,
      count: daySales.length
    };
  });

  const maxValue = Math.max(...salesByDay.map(d => d.value), 1);

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Vendas dos Últimos 7 Dias</CardTitle>
            <Button variant="link" size="sm" className="px-0 h-auto">Ver todas</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Erro ao carregar dados de vendas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!Array.isArray(sales) || sales.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Vendas dos Últimos 7 Dias</CardTitle>
            <Button variant="link" size="sm" className="px-0 h-auto">Ver todas</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>Nenhuma venda registrada nos últimos 7 dias</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Vendas dos Últimos 7 Dias</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary">7 dias</Button>
            <Button size="sm" variant="ghost">30 dias</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex items-end justify-between gap-2">
          {salesByDay.map((data, index) => {
            const height = maxValue > 0 ? (data.value / maxValue) * 100 : 0;
            
            return (
              <div key={index} className="flex flex-col items-center gap-2 group">
                <div className="relative">
                  <div 
                    className="w-8 bg-primary rounded-t transition-colors group-hover:bg-primary/80"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  />
                  {data.value > 0 && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-popover text-popover-foreground border rounded shadow-sm text-xs py-1 px-2 whitespace-nowrap">
                        {formatCurrency(data.value)}
                        <br />
                        {data.count} venda{data.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{data.day}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
