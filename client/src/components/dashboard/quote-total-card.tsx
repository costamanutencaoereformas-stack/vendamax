import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { TrendingUp, CheckCircle, ArrowUpRight } from "lucide-react";
import type { Quote } from "@shared/schema";

interface QuoteTotalCardProps {
  className?: string;
  showTrend?: boolean;
  // optional quotes to compute totals from (if omitted the component will fetch all quotes)
  quotes?: Quote[] | undefined;
}

export default function QuoteTotalCard({ className, showTrend = true, quotes }: QuoteTotalCardProps) {
  // If quotes prop is not provided, fall back to fetching all quotes (backwards compatible)
  const { data: fetchedQuotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    queryFn: async () => {
      const res = await fetch("/api/quotes");
      if (!res.ok) throw new Error("Falha ao carregar orçamentos");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    const arr = Array.isArray(quotes) ? quotes : (Array.isArray(fetchedQuotes) ? fetchedQuotes : []);
    
    // Filtrar orçamentos aprovados e convertidos
    const approvedQuotes = arr.filter((q: Quote) => q.status === 'APPROVED');
    const convertedQuotes = arr.filter((q: Quote) => q.status === 'CONVERTED');
    const successfulQuotes = [...approvedQuotes, ...convertedQuotes];
    
    // Calcular totais
    const approvedTotal = approvedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
    const convertedTotal = convertedQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
    const grandTotal = approvedTotal + convertedTotal;
    
    // Calcular estatísticas dos últimos 30 dias para tendência
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSuccessful = successfulQuotes.filter(q => {
      const createdAt = (q as any)?.createdAt ? new Date((q as any).createdAt) : null;
      return createdAt && createdAt >= thirtyDaysAgo;
    });
    
    const recentTotal = recentSuccessful.reduce((sum, q) => sum + Number(q.total || 0), 0);
    
    // Calcular período anterior para comparação de tendência
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const previousPeriodSuccessful = successfulQuotes.filter(q => {
      const createdAt = (q as any)?.createdAt ? new Date((q as any).createdAt) : null;
      return createdAt && createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    });
    
    const previousTotal = previousPeriodSuccessful.reduce((sum, q) => sum + Number(q.total || 0), 0);
    
    // Calcular percentual de crescimento
    const growthPercentage = previousTotal > 0 
      ? ((recentTotal - previousTotal) / previousTotal) * 100 
      : recentTotal > 0 ? 100 : 0;
    
    return {
      approvedCount: approvedQuotes.length,
      convertedCount: convertedQuotes.length,
      totalCount: successfulQuotes.length,
      approvedTotal,
      convertedTotal,
      grandTotal,
      recentTotal,
      growthPercentage,
      isPositiveGrowth: growthPercentage >= 0,
    };
  }, [quotes]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-600" />
          Total Orçamentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Valor total principal */}
        <div className="space-y-1">
          <div className="text-xl font-bold text-green-600">
            {formatCurrency(stats.grandTotal)}
          </div>
          <div className="text-xs text-muted-foreground">
            (Aprovados + Convertidos)
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
