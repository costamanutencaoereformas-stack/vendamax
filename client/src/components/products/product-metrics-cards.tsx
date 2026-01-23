import { Package, AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";

interface ProductMetricsCardsProps {
  totalProducts: number;
  lowStockProducts: number;
  topSellingProducts: { id: string; name: string; quantity: number; revenue: number }[];
}

export default function ProductMetricsCards({
  totalProducts,
  lowStockProducts,
  topSellingProducts,
}: ProductMetricsCardsProps) {
  // Get the top selling product if available
  const topProduct = topSellingProducts && topSellingProducts.length > 0 ? topSellingProducts[0] : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total de Produtos</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Estoque Baixo/Zerado</p>
              <p className="text-2xl font-bold">{lowStockProducts}</p>
            </div>
            <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Produto Mais Vendido</p>
              {topProduct ? (
                <>
                  <p className="text-lg font-bold truncate max-w-[180px]">{topProduct.name}</p>
                  <p className="text-sm text-muted-foreground">{topProduct.quantity} unidades</p>
                </>
              ) : (
                <p className="text-lg font-bold">Nenhum dado</p>
              )}
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}