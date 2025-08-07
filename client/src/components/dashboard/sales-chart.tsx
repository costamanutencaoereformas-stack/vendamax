import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";

export default function SalesChart() {
  const { data: sales } = useQuery({
    queryKey: ["/api/sales"],
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

    const daySales = sales?.filter((sale: any) => {
      const saleDate = new Date(sale.createdAt);
      return saleDate >= dayStart && saleDate <= dayEnd;
    }) || [];

    const total = daySales.reduce((sum: number, sale: any) => sum + parseFloat(sale.total), 0);
    
    return {
      day: day.toLocaleDateString('pt-BR', { weekday: 'short' }),
      value: total,
      count: daySales.length
    };
  });

  const maxValue = Math.max(...salesByDay.map(d => d.value), 1);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Vendas dos Últimos 7 Dias</h3>
        <div className="flex space-x-2">
          <button className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md">
            7 dias
          </button>
          <button className="px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-md">
            30 dias
          </button>
        </div>
      </div>
      
      <div className="h-64 flex items-end justify-between space-x-2">
        {salesByDay.map((data, index) => {
          const height = maxValue > 0 ? (data.value / maxValue) * 100 : 0;
          
          return (
            <div key={index} className="flex flex-col items-center space-y-2 group">
              <div className="relative">
                <div 
                  className="w-8 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors group-hover:bg-blue-600"
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
                {data.value > 0 && (
                  <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                      {formatCurrency(data.value)}
                      <br />
                      {data.count} venda{data.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">{data.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
