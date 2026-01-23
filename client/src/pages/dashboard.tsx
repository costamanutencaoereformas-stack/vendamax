import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentSales from "@/components/dashboard/recent-sales";
import QuickActions from "@/components/dashboard/quick-actions";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProducts from "@/components/dashboard/top-products";
import RecentQuotes from "@/components/dashboard/recent-quotes";
import ReceivablesList from "@/components/dashboard/receivables-list";
import UpcomingAppointments from "@/components/dashboard/upcoming-appointments";
import QuotesFunnel from "@/components/dashboard/quotes-funnel";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<{
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  }>({
    queryKey: ["/api/dashboard/metrics"],
    refetchInterval: 60000, // Atualizar a cada 60 segundos
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Falcon Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <nav className="breadcrumb mt-1">
            <a href="/">Início</a>
            <span className="breadcrumb-sep">/</span>
            <span>Dashboard</span>
          </nav>
        </div>
        <div className="toolbar">
          {/* Add dashboard-level actions here as needed */}
        </div>
      </div>

      <MetricsCards metrics={metrics} />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 lg:col-span-2">
          <RecentSales />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SalesChart />
        <TopProducts />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 lg:col-span-2 space-y-6">
          <QuotesFunnel />
          <RecentQuotes />
        </div>
        <div className="space-y-6">
          <ReceivablesList />
          <UpcomingAppointments />
        </div>
      </div>
    </div>
  );
}
