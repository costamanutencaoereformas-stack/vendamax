import { useQuery } from "@tanstack/react-query";
import MetricsCards from "@/components/dashboard/metrics-cards";
import RecentSales from "@/components/dashboard/recent-sales";
import QuickActions from "@/components/dashboard/quick-actions";
import SalesChart from "@/components/dashboard/sales-chart";
import TopProducts from "@/components/dashboard/top-products";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics"],
  });

  if (metricsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <MetricsCards metrics={metrics} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentSales />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesChart />
        <TopProducts />
      </div>
    </div>
  );
}
