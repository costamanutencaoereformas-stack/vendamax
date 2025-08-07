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
  User,
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
];

const cadastros = [
  { name: "Clientes", href: "/customers", icon: Users },
  { name: "Produtos", href: "/products", icon: Package },
  { name: "Fornecedores", href: "/suppliers", icon: Truck },
];

const operacoes = [
  { name: "Estoque", href: "/inventory", icon: Warehouse },
  { name: "Orçamentos", href: "/quotes", icon: FileText },
  { name: "Vendas", href: "/sales", icon: ShoppingCart },
];

const analise = [
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Importar NF", href: "/import", icon: FileInput },
];

function NavLink({ href, icon: Icon, children, isActive }: {
  href: string;
  icon: React.ComponentType<any>;
  children: React.ReactNode;
  isActive: boolean;
}) {
  return (
    <Link href={href}>
      <a className={cn(
        "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "bg-blue-50 text-blue-700"
          : "text-gray-700 hover:bg-gray-100"
      )}>
        <Icon className={cn(
          "mr-3 h-5 w-5",
          isActive ? "text-blue-500" : "text-gray-400"
        )} />
        {children}
      </a>
    </Link>
  );
}

function NavSection({ title, items }: {
  title: string;
  items: Array<{ name: string; href: string; icon: React.ComponentType<any> }>;
}) {
  const [location] = useLocation();

  return (
    <div className="pt-4">
      <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {title}
      </p>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.name}
            href={item.href}
            icon={item.icon}
            isActive={location === item.href}
          >
            {item.name}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 fixed h-full z-10">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <BarChart3 className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">VendaMax</h1>
            <p className="text-xs text-gray-500">Sistema de Gestão</p>
          </div>
        </div>
      </div>
      
      <nav className="mt-6">
        <div className="px-3">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                href={item.href}
                icon={item.icon}
                isActive={location === item.href}
              >
                {item.name}
              </NavLink>
            ))}
            
            <NavSection title="Cadastros" items={cadastros} />
            <NavSection title="Operações" items={operacoes} />
            <NavSection title="Análise" items={analise} />
          </div>
        </div>
      </nav>
      
      {/* User Section */}
      <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="text-gray-600 text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Administrador</p>
            <p className="text-xs text-gray-500">admin</p>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
