import { DollarSign, FileText, Package, Users, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface MetricsCardsProps {
  metrics?: {
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  };
}

const metricCards = [
  {
    title: "Vendas Hoje",
    key: "dailySales" as const,
    icon: DollarSign,
    color: "green",
    format: "currency",
    trend: "+12.5%",
  },
  {
    title: "Orçamentos Pendentes",
    key: "pendingQuotes" as const,
    icon: FileText,
    color: "blue",
    format: "number",
    subtitle: "2h média",
  },
  {
    title: "Produtos em Estoque",
    key: "totalProducts" as const,
    icon: Package,
    color: "orange",
    format: "number",
    warningKey: "lowStockItems" as const,
  },
  {
    title: "Clientes Ativos",
    key: "activeCustomers" as const,
    icon: Users,
    color: "purple",
    format: "number",
    trend: "+8 este mês",
  },
];

const colorClasses = {
  green: {
    bg: "bg-green-100",
    text: "text-green-600",
    trend: "text-green-600",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-600",
    trend: "text-blue-600",
  },
  orange: {
    bg: "bg-orange-100",
    text: "text-orange-600",
    trend: "text-orange-600",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-600",
    trend: "text-purple-600",
  },
};

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metricCards.map((_, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {metricCards.map((card) => {
        const colors = colorClasses[card.color];
        const value = metrics[card.key];
        const warningValue = card.warningKey ? metrics[card.warningKey] : null;
        
        return (
          <div key={card.key} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {card.format === "currency" ? formatCurrency(value) : value?.toLocaleString()}
                </p>
                {card.trend && (
                  <p className={`text-sm ${colors.trend} flex items-center mt-1`}>
                    <span className="mr-1">↑</span>
                    {card.trend}
                  </p>
                )}
                {card.subtitle && (
                  <p className={`text-sm ${colors.trend} flex items-center mt-1`}>
                    <span className="mr-1">⏱</span>
                    {card.subtitle}
                  </p>
                )}
                {warningValue && warningValue > 0 && (
                  <p className="text-sm text-orange-600 flex items-center mt-1">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {warningValue} baixo estoque
                  </p>
                )}
              </div>
              <div className={`w-12 h-12 ${colors.bg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`${colors.text} text-lg`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
