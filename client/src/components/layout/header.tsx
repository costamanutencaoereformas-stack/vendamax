import { Search, Bell, LogOut, User, Settings, HelpCircle, Moon, Sun, Menu, Building2, Clock, AlertTriangle, Calendar, Mail, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSearch } from "@/contexts/search-context";
import { SessionIndicator } from "@/components/session-indicator";

const pageNames: Record<string, { title: string; description: string }> = {
  "/": { title: "Início", description: "Bem-vindo ao VendaMax" },
  "/dashboard": { title: "Dashboard", description: "Visão geral do seu negócio" },
  "/customers": { title: "Clientes", description: "Gerenciar clientes e prospects" },
  "/products": { title: "Produtos", description: "Catálogo de produtos e serviços" },
  "/suppliers": { title: "Fornecedores", description: "Gerenciar fornecedores" },
  "/inventory": { title: "Estoque", description: "Controle de estoque e movimentações" },
  "/quotes": { title: "Orçamentos", description: "Criar e gerenciar orçamentos" },
  "/sales": { title: "Vendas", description: "Processar vendas e pedidos" },
  "/purchases": { title: "Compras", description: "Gerenciar solicitações de compra" },
  "/contracts": { title: "Gestão de Contratos", description: "Gerenciar contratos" },
  "/reports": { title: "Relatórios", description: "Análises e indicadores" },
  "/analytics": { title: "Análise de Dados", description: "Dashboard analítico com gráficos dinâmicos" },
  "/company-settings": { title: "Configurações da Empresa", description: "Dados da empresa, categorias e segmentos" },
  "/projects": { title: "Projetos / Obras", description: "Acompanhe obras, vincule orçamentos e vendas e visualize o custo final do serviço." },
  "/agenda": { title: "Agenda", description: "Visualize e cadastre compromissos por dia" },
  "/finance": { title: "Financeiro", description: "Controle de Contas" },
};

interface User {
  name?: string;
  email?: string;
  username?: string;
  avatar?: string;
}

interface Notification {
  id: string;
  type: 'expired_quote' | 'overdue_receivable' | 'overdue_payable' | 'appointment_reminder';
  title: string;
  message: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
}

export default function Header() {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { theme, setTheme } = useTheme();
  const pageInfo = pageNames[location] || { title: "Página", description: "" };
  const { user, logout } = useAuth() as { user: User; logout: () => void };
  const { search, setSearch } = useSearch();
  
  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn("Falha ao carregar notificações (HTTP)", res.status, text);
          return [] as Notification[];
        }
        return res.json();
      } catch (e) {
        console.warn("Falha ao carregar notificações (network)", e);
        return [] as Notification[];
      }
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expired_quote':
        return <Clock className="h-4 w-4" />;
      case 'overdue_receivable':
      case 'overdue_payable':
        return <AlertTriangle className="h-4 w-4" />;
      case 'appointment_reminder':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };
  
  // Get user initials for avatar fallback
  const getUserInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={cn(
        "container flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8",
        isMobile && "pl-16"
      )}>
        {/* Left side: Page title and breadcrumb */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
          
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight">
              {pageInfo.title}
            </h1>
            {!isMobile && pageInfo.description && (
              <p className="text-sm text-muted-foreground">{pageInfo.description}</p>
            )}
          </div>
        </div>

        {/* Right side: Search, theme toggle, notifications, and user menu */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search */}
          <div className="hidden md:block w-64">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Pesquisar..."
                className="w-full pl-8 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Session Timer - visible on desktop only */}
          {!isMobile && <SessionIndicator />}

          <TooltipProvider>
            {/* Theme Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                >
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Alternar tema</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alternar tema</TooltipContent>
            </Tooltip>

            {/* Notifications */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {notifications.length > 0 && (
                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75"></span>
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Notificações</TooltipContent>
              </Tooltip>
              
              <DropdownMenuContent className="w-80" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex items-center justify-between">
                    <span>Notificações</span>
                    {notifications.length > 0 && (
                      <Badge variant="secondary">{notifications.length}</Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />
                
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma notificação
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notification) => (
                      <DropdownMenuItem key={notification.id} className="p-3 cursor-pointer">
                        <div className="flex items-start gap-3 w-full">
                          <div className="flex-shrink-0 mt-0.5">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium truncate">
                                {notification.title}
                              </p>
                              <Badge 
                                variant={getPriorityColor(notification.priority) as any}
                                className="text-xs"
                              >
                                {notification.priority === 'high' ? 'Alta' : 
                                 notification.priority === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
                
                {notifications.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-center justify-center text-sm text-muted-foreground"
                      onClick={() => {
                        // Navigate to a notifications page or clear all
                        console.log('Ver todas as notificações');
                      }}
                    >
                      Ver todas as notificações
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notes Access */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation('/notes')}
                >
                  <StickyNote className="h-5 w-5" />
                  <span className="sr-only">Anotações</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Anotações Rápidas</TooltipContent>
            </Tooltip>

            {/* Gmail Access */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation('/email')}
                >
                  <Mail className="h-5 w-5" />
                  <span className="sr-only">E-mail</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>E-mail</TooltipContent>
            </Tooltip>

            {/* Help */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-5 w-5" />
                  <span className="sr-only">Ajuda</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajuda</TooltipContent>
            </Tooltip>

            {/* User Profile */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getUserInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Conta</TooltipContent>
              </Tooltip>
              
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || user?.username}
                    </p>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setLocation('/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => setLocation('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuItem onClick={() => setLocation('/company-settings')}>
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>Configurações da Empresa</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                  <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Mobile search bar */}
      {isMobile && (
        <div className="border-t px-4 py-2 md:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar..."
              className="w-full pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}
    </header>
  );
}
