import { Link, useLocation } from "wouter";
import { 
  Home, 
  Users, 
  Package, 
  Truck, 
  Warehouse, 
  FileText, 
  ShoppingCart, 
  BarChart3, 
  FileInput,
  Banknote,
  Calendar,
  User,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  FileSignature,
  StickyNote,
  LineChart,
  CreditCard,
  DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useAuth } from "@/contexts/auth-context";

const navigation = [
  { name: "Início", href: "/", icon: Home },
  { name: "Dashboard", href: "/dashboard", icon: Home },
];

const cadastros = [
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Fornecedores", href: "/suppliers", icon: Truck },
  { name: "Produtos", href: "/products", icon: Package },
];

const operacoes = [
  { name: "Agenda", href: "/agenda", icon: Calendar },
  { name: "Estoque", href: "/inventory", icon: Warehouse },
  { name: "PDV (Vendas Rápidas)", href: "/pdv", icon: CreditCard },
  { name: "Gerenciar Caixa", href: "/cash-register", icon: DollarSign },
  { name: "Gestão de Compras", href: "/purchases", icon: ShoppingBag },
  { name: "Gestão de Contratos", href: "/contracts", icon: FileSignature },
  { name: "Gestão Projetos/Obras", href: "/projects", icon: FileInput },
  { name: "Orçamentos", href: "/quotes", icon: FileText },
  { name: "Vendas", href: "/sales", icon: ShoppingCart },
];

const analise = [
  { name: "Análise de Dados", href: "/analytics", icon: LineChart },
  { name: "Análise de Lucro", href: "/profit-analysis", icon: BarChart3 },
  { name: "Gestão Financeira", href: "/finance", icon: Banknote },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
];

function NavLink({ href, icon: Icon, children, isActive, isCollapsed }: {
  href: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
  isActive: boolean;
  isCollapsed?: boolean;
}) {
  return (
    <Link href={href}>
      <div className={cn(
        "group flex items-center text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer relative",
        isActive
          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
          : "text-gray-300 hover:bg-slate-700/50 hover:text-white",
        isCollapsed ? "justify-center px-2 py-3" : "px-3 py-2.5"
      )}>
        <Icon className={cn(
          "h-5 w-5",
          !isCollapsed && "mr-3",
          isActive ? "text-white" : "text-gray-400 group-hover:text-blue-400"
        )} />
        {!isCollapsed && children}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-foreground text-background text-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap pointer-events-none shadow">
            {children}
            <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-foreground rotate-45"></div>
          </div>
        )}
      </div>
    </Link>
  );
}

function NavSection({ title, items, isCollapsed }: {
  title: string;
  items: Array<{ name: string; href: string; icon: React.ComponentType<any> }>;
  isCollapsed?: boolean;
}) {
  const [location] = useLocation();

  return (
    <div className={cn("pt-4", isCollapsed && "pt-2")}>
      {!isCollapsed && (
        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </p>
      )}
      <div className={cn("space-y-1", !isCollapsed && "mt-2", isCollapsed && "space-y-2")}>
        {items.map((item) => (
          <NavLink
            key={item.name}
            href={item.href}
            icon={item.icon}
            isActive={location === item.href}
            isCollapsed={isCollapsed}
          >
            {item.name}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

function MobileNavSection({ title, items, onItemClick }: {
  title: string;
  items: Array<{ name: string; href: string; icon: React.ComponentType<any> }>;
  onItemClick: () => void;
}) {
  const [location] = useLocation();

  return (
    <div className="pt-4">
      <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </p>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <Link key={item.name} href={item.href}>
            <div
              className={cn(
                "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                location === item.href
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                  : "text-gray-300 hover:bg-slate-700/50 hover:text-white"
              )}
              onClick={onItemClick}
            >
              <item.icon className={cn(
                "mr-3 h-5 w-5",
                location === item.href ? "text-white" : "text-gray-400 group-hover:text-blue-400"
              )} />
              {item.name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { logout } = useAuth();

  if (isMobile) {
    return (
      <>
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-background rounded-md shadow-md border lg:hidden"
        >
          <Menu className="h-6 w-6 text-gray-600" />
        </button>

        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-64 bg-slate-800 shadow-xl">
              <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <BarChart3 className="text-white text-sm" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">VendaMax</h1>
                    <p className="text-xs text-gray-400">Sistema de Gestão</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <nav className="mt-6 pb-20 overflow-y-auto">
                <div className="px-3">
                  <div className="space-y-1">
                    {navigation.map((item) => (
                      <Link key={item.name} href={item.href}>
                        <div
                          className={cn(
                            "group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                            location === item.href
                              ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md"
                              : "text-gray-300 hover:bg-slate-700/50 hover:text-white"
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <item.icon className={cn(
                            "mr-3 h-5 w-5",
                            location === item.href ? "text-white" : "text-gray-400 group-hover:text-blue-400"
                          )} />
                          {item.name}
                        </div>
                      </Link>
                    ))}
                    
                    <MobileNavSection title="Cadastros" items={cadastros} onItemClick={() => setIsMobileMenuOpen(false)} />
                    <MobileNavSection title="Operações" items={operacoes} onItemClick={() => setIsMobileMenuOpen(false)} />
                    <MobileNavSection title="Análise" items={analise} onItemClick={() => setIsMobileMenuOpen(false)} />
                  </div>
                </div>
              </nav>
              
              {/* Mobile User Section */}
              <div className="absolute bottom-0 w-full p-4 border-t border-slate-700 bg-slate-900">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                    <User className="text-white text-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Administrador</p>
                    <p className="text-xs text-gray-400">admin</p>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-gray-400 hover:text-red-400 transition-colors"
                    title="Sair"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={cn(
      "bg-slate-800 shadow-xl border-r border-slate-700 fixed h-full z-10 lg:block transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn(
        "border-b border-slate-700 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800",
        isCollapsed ? "p-3" : "p-6"
      )}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
            <BarChart3 className="text-white text-lg" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">VendaMax</h1>
              <p className="text-xs text-gray-400">Sistema de Gestão</p>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-slate-700/50 transition-colors"
          title={isCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </div>
      
      <nav className="mt-6 h-[calc(100vh-200px)] overflow-y-auto scrollbar-hide">
        <div className={cn("px-3", isCollapsed && "px-1")}> 
          <div className={cn("space-y-1", isCollapsed && "space-y-2")}> 
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                href={item.href}
                icon={item.icon}
                isActive={location === item.href}
                isCollapsed={isCollapsed}
              >
                {item.name}
              </NavLink>
            ))}
            
            <NavSection title="Cadastros" items={cadastros} isCollapsed={isCollapsed} />
            <NavSection title="Operações" items={operacoes} isCollapsed={isCollapsed} />
            <NavSection title="Análise" items={analise} isCollapsed={isCollapsed} />
          </div>
        </div>
      </nav>
      
      {/* User Section */}
      <div className={cn(
        "absolute bottom-0 w-full border-t border-slate-700 bg-slate-900",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "space-x-3"
        )}>
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
            <User className="text-white text-sm" />
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Administrador</p>
                <p className="text-xs text-gray-400">admin</p>
              </div>
              <button 
                onClick={logout}
                className="text-gray-400 hover:text-red-400 transition-colors"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
