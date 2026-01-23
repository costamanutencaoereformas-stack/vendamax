import { Plus, UserPlus, Package, AlertTriangle, Banknote } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type ActionColor = "green" | "blue" | "purple" | "orange";

const actions: Array<{ title: string; href: string; icon: any; color: ActionColor }> = [
  {
    title: "Nova Venda",
    href: "/sales",
    icon: Plus,
    color: "green",
  },
  {
    title: "Novo Cliente",
    href: "/customers",
    icon: UserPlus,
    color: "blue",
  },
  {
    title: "Novo Produto",
    href: "/products",
    icon: Package,
    color: "purple",
  },
  {
    title: "Financeiro",
    href: "/finance",
    icon: Banknote,
    color: "orange",
  },
];

const colorClasses: Record<ActionColor, string> = {
  green: "bg-green-50 text-green-700 hover:bg-green-100 border-green-200",
  blue: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200",
  purple: "bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200",
  orange: "bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-200",
};

const iconClasses: Record<ActionColor, string> = {
  green: "text-green-500 group-hover:text-green-600",
  blue: "text-blue-500 group-hover:text-blue-600",
  purple: "text-purple-500 group-hover:text-purple-600",
  orange: "text-orange-500 group-hover:text-orange-600",
};

export default function QuickActions() {
  const [, setLocation] = useLocation();
  
  const { data: lowStockProducts = [] } = useQuery<any[]>({
    queryKey: ["/api/products/low-stock"],
  });

  const lowStockCount = lowStockProducts.length || 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                variant="outline"
                className={`group h-auto min-h-[100px] flex-col items-center justify-center gap-2 p-4 text-center transition-all duration-200 hover:shadow-sm ${colorClasses[action.color]} border`}
                onClick={() => setLocation(action.href)}
              >
                <div className={`p-2.5 rounded-lg bg-white/50 backdrop-blur-sm ${colorClasses[action.color].split(' ')[0]} border`}>
                  <Icon className={`h-5 w-5 transition-colors ${iconClasses[action.color]}`} />
                </div>
                <span className="text-sm font-medium">{action.title}</span>
              </Button>
            );
          })}
        </CardContent>
      </Card>
      
      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="text-destructive h-4 w-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">Estoque Baixo</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  {lowStockCount} produto{lowStockCount > 1 ? 's' : ''} com estoque abaixo do mínimo
                </p>
                <Button 
                  variant="link"
                  size="sm"
                  className="px-0 h-auto"
                  onClick={() => setLocation("/inventory")}
                >
                  Visualizar produtos →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
