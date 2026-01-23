import { DollarSign, FileText, Package, Users, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface MetricsCardsProps {
  metrics?: {
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  };
}

const metricCards: Array<{
  title: string;
  key: keyof NonNullable<MetricsCardsProps["metrics"]>;
  icon: any;
  format: "currency" | "number";
  trend?: string;
  subtitle?: string;
  warningKey?: keyof NonNullable<MetricsCardsProps["metrics"]>;
}> = [
  {
    title: "Vendas Hoje",
    key: "dailySales" as const,
    icon: DollarSign,
    format: "currency",
    trend: "+12.5%",
  },
  {
    title: "Orçamentos Pendentes",
    key: "pendingQuotes" as const,
    icon: FileText,
    format: "number",
    subtitle: "2h média",
  },
  {
    title: "Produtos em Estoque",
    key: "totalProducts" as const,
    icon: Package,
    format: "number",
    warningKey: "lowStockItems" as const,
  },
  {
    title: "Clientes Ativos",
    key: "activeCustomers" as const,
    icon: Users,
    format: "number",
    trend: "+8 este mês",
  },
];
// Using Falcon tokens for consistent theming

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((_, index) => (
          <Card key={index} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-24 mb-2"></div>
            <div className="h-8 bg-muted rounded w-16"></div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricCards.map((card) => {
        const value = metrics[card.key];
        const warningValue = card.warningKey ? metrics[card.warningKey] : null;
        
        return (
          <Card key={card.key} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold text-foreground">
                    {card.format === "currency" ? formatCurrency(value) : value?.toLocaleString()}
                  </p>
                  {card.trend && (
                    <p className={cn("text-sm flex items-center mt-1 text-muted-foreground")}>
                      <span className="mr-1">↑</span>
                      {card.trend}
                    </p>
                  )}
                  {card.subtitle && (
                    <p className={cn("text-sm flex items-center mt-1 text-muted-foreground")}>
                      <span className="mr-1">⏱</span>
                      {card.subtitle}
                    </p>
                  )}
                  {warningValue && warningValue > 0 && (
                    <p className="text-sm text-destructive flex items-center mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1 text-destructive" />
                      {warningValue} baixo estoque
                    </p>
                  )}
                </div>
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center bg-muted") }>
                  <card.icon className={cn("text-lg text-muted-foreground")} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
