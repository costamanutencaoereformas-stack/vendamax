import { Search, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";

const pageNames: Record<string, { title: string; description: string }> = {
  "/": { title: "Dashboard", description: "Visão geral do seu negócio" },
  "/dashboard": { title: "Dashboard", description: "Visão geral do seu negócio" },
  "/customers": { title: "Clientes", description: "Gerenciar clientes e prospects" },
  "/products": { title: "Produtos", description: "Catálogo de produtos e serviços" },
  "/suppliers": { title: "Fornecedores", description: "Gerenciar fornecedores" },
  "/inventory": { title: "Estoque", description: "Controle de estoque e movimentações" },
  "/quotes": { title: "Orçamentos", description: "Criar e gerenciar orçamentos" },
  "/sales": { title: "Vendas", description: "Processar vendas e pedidos" },
  "/reports": { title: "Relatórios", description: "Análises e indicadores" },
};

export default function Header() {
  const [location] = useLocation();
  const pageInfo = pageNames[location] || { title: "Página", description: "" };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{pageInfo.title}</h1>
            {pageInfo.description && (
              <p className="text-sm text-gray-600">{pageInfo.description}</p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 w-64"
              />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
            </Button>
            
            {/* Quick Actions */}
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
