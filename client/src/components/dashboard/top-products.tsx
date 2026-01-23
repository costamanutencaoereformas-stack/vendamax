import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Laptop, Smartphone, Mouse, Keyboard, Package } from "lucide-react";
import type { Product, Sale, SaleItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  const { data: sales = [] } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  const { data: saleItems } = useQuery<SaleItem[]>({
    queryKey: ["/api/sales", "items"],
    queryFn: async () => {
      try {
        if (!sales || sales.length === 0) return [] as SaleItem[];
        
        const allItems: SaleItem[] = [] as SaleItem[];
        for (const sale of sales as Sale[]) {
          try {
            const response = await fetch(`/api/sales/${sale.id}/items`);
            if (response.ok) {
              const items = await response.json();
              if (Array.isArray(items)) {
                allItems.push(...(items as SaleItem[]));
              }
            }
          } catch (error) {
            console.error(`Erro ao buscar itens da venda ${sale.id}:`, error);
            // Continue com as outras vendas mesmo se uma falhar
          }
        }
        return allItems;
      } catch (error) {
        console.error('Erro ao buscar itens de vendas:', error);
        return [] as SaleItem[];
      }
    },
    enabled: !!sales && sales.length > 0,
    retry: 1,
    staleTime: 30000, // 30 segundos
  });

  if (!products || !saleItems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Produtos Mais Vendidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-muted rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-muted rounded w-32 mb-1"></div>
                    <div className="h-3 bg-muted rounded w-16"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 bg-muted rounded w-20 mb-1"></div>
                  <div className="w-16 h-2 bg-muted rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Produtos Mais Vendidos</CardTitle>
          <Button variant="link" size="sm" className="px-0 h-auto">Ver todos</Button>
        </div>
      </CardHeader>
      <CardContent>
        {topProducts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
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
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <IconComponent className="text-muted-foreground h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.stats.quantity} venda{product.stats.quantity > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {formatCurrency(product.stats.revenue)}
                    </p>
                    <div className="w-24 h-2 bg-muted rounded-full">
                      <div 
                        className="h-2 bg-primary rounded-full"
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
