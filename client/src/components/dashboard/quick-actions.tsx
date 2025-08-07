import { Plus, UserPlus, Package, FileInput, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

const actions = [
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
    title: "Importar NF",
    href: "/import",
    icon: FileInput,
    color: "orange",
  },
];

const colorClasses = {
  green: "bg-green-100 text-green-600",
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
};

export default function QuickActions() {
  const [, setLocation] = useLocation();
  
  const { data: lowStockProducts } = useQuery({
    queryKey: ["/api/products/low-stock"],
  });

  const lowStockCount = lowStockProducts?.length || 0;

  return (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="space-y-3">
          {actions.map((action) => (
            <button
              key={action.title}
              onClick={() => setLocation(action.href)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${colorClasses[action.color]} rounded-lg flex items-center justify-center`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-gray-900">{action.title}</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-orange-600 h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-orange-800 mb-1">Estoque Baixo</h4>
              <p className="text-sm text-orange-700 mb-3">
                {lowStockCount} produto{lowStockCount > 1 ? 's' : ''} com estoque abaixo do mínimo
              </p>
              <button 
                onClick={() => setLocation("/inventory")}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium"
              >
                Visualizar produtos →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
