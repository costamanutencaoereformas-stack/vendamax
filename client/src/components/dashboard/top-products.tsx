import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Laptop, Smartphone, Mouse, Keyboard, Package } from "lucide-react";
import type { Product, SaleItem } from "@shared/schema";

const productIcons: Record<string, React.ComponentType<any>> = {
  laptop: Laptop,
  smartphone: Smartphone,
  mouse: Mouse,
  keyboard: Keyboard,
  default: Package,
};

function getProductIcon(productName: string) {
  const name = productName.toLowerCase();
  if (name.includes('notebook') || name.includes('laptop')) return productIcons.laptop;
  if (name.includes('iphone') || name.includes('smartphone') || name.includes('celular')) return productIcons.smartphone;
  if (name.includes('mouse')) return productIcons.mouse;
  if (name.includes('teclado') || name.includes('keyboard')) return productIcons.keyboard;
  return productIcons.default;
}

export default function TopProducts() {
  const { data: products } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: sales } = useQuery({
    queryKey: ["/api/sales"],
  });

  const { data: saleItems } = useQuery({
    queryKey: ["/api/sales", "items"],
    queryFn: async () => {
      if (!sales) return [];
      
      const allItems: any[] = [];
      for (const sale of sales) {
        const response = await fetch(`/api/sales/${sale.id}/items`);
        if (response.ok) {
          const items = await response.json();
          allItems.push(...items);
        }
      }
      return allItems;
    },
    enabled: !!sales,
  });

  if (!products || !saleItems) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Produtos Mais Vendidos</h3>
        <div className="space-y-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
              <div className="text-right">
                <div className="h-4 bg-gray-200 rounded w-20 mb-1"></div>
                <div className="w-16 h-2 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calculate product sales statistics
  const productStats = new Map();
  
  saleItems.forEach((item: SaleItem) => {
    const existing = productStats.get(item.productId) || { quantity: 0, revenue: 0 };
    productStats.set(item.productId, {
      quantity: existing.quantity + item.quantity,
      revenue: existing.revenue + parseFloat(item.total)
    });
  });

  // Get top products by revenue
  const topProducts = Array.from(productStats.entries())
    .map(([productId, stats]) => {
      const product = products.find((p: Product) => p.id === productId);
      return product ? { ...product, stats } : null;
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.stats.revenue - a.stats.revenue)
    .slice(0, 4);

  const maxRevenue = topProducts[0]?.stats.revenue || 1;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Produtos Mais Vendidos</h3>
        <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
          Ver todos
        </button>
      </div>
      
      {topProducts.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>Nenhuma venda registrada ainda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topProducts.map((product: any) => {
            const IconComponent = getProductIcon(product.name);
            const progressWidth = (product.stats.revenue / maxRevenue) * 100;
            
            return (
              <div key={product.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                    <IconComponent className="text-gray-500 h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      {product.stats.quantity} venda{product.stats.quantity > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatCurrency(product.stats.revenue)}
                  </p>
                  <div className="w-16 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
