import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useLocation } from "wouter";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  ShoppingCart,
  Plus,
  AlertTriangle,
  Calendar,
  User,
  Clock,
  ArrowRight,
} from "lucide-react";

interface FinanceEntry {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  entryType: 'RECEIVABLE' | 'PAYABLE';
}

interface Quote {
  id: string;
  number: string;
  customerId: string;
  total: number;
  validUntil: string;
  status: string;
  createdAt?: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function Welcome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch finance entries
  const { data: financeEntries, isLoading: financeLoading } = useQuery<FinanceEntry[]>({
    queryKey: ["/api/finance"],
    queryFn: async () => {
      const res = await fetch("/api/finance");
      if (!res.ok) throw new Error("Falha ao carregar finanças");
      return res.json();
    },
  });

  // Fetch quotes
  const { data: quotes, isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    queryFn: async () => {
      const res = await fetch("/api/quotes");
      if (!res.ok) throw new Error("Falha ao carregar orçamentos");
      return res.json();
    },
  });

  // Fetch customers
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return res.json();
    },
  });

  // Filter data
  const today = new Date();
  
  const accountsPayable = (financeEntries || [])
    .filter(entry => entry.entryType === 'PAYABLE' && entry.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const accountsReceivable = (financeEntries || [])
    .filter(entry => entry.entryType === 'RECEIVABLE' && entry.status !== 'PAID')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const expiredQuotes = (quotes || [])
    .filter(q => {
      const validUntil = new Date(q.validUntil);
      return validUntil < today && q.status === 'PENDING';
    })
    .sort((a, b) => new Date(b.validUntil).getTime() - new Date(a.validUntil).getTime())
    .slice(0, 5);

  const getCustomerName = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.name || "Cliente não encontrado";
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < today;
  };

  // Calculate totals
  const totalPayable = accountsPayable.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalReceivable = accountsReceivable.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const totalExpiredQuotes = expiredQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0);

  const isLoading = financeLoading || quotesLoading;

  const quickActions = [
    {
      title: "Nova Venda",
      description: "Registrar uma venda",
      icon: ShoppingCart,
      color: "bg-blue-500",
      hoverColor: "hover:bg-blue-600",
      action: () => setLocation("/sales"),
    },
    {
      title: "Novo Orçamento",
      description: "Criar orçamento",
      icon: FileText,
      color: "bg-green-500",
      hoverColor: "hover:bg-green-600",
      action: () => setLocation("/quotes"),
    },
    {
      title: "Lançamento Financeiro",
      description: "Adicionar conta",
      icon: DollarSign,
      color: "bg-purple-500",
      hoverColor: "hover:bg-purple-600",
      action: () => setLocation("/finance"),
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Olá, {user?.name || 'Usuário'}! 👋
            </h1>
            <p className="text-blue-100 text-lg">
              Bem-vindo ao VendaMax - Sistema de Gestão
            </p>
            <p className="text-blue-200 text-sm mt-1">
              {new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className="hidden md:block">
            <Calendar className="h-24 w-24 text-blue-200 opacity-50" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Contas a Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPayable)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountsPayable.length} pendente{accountsPayable.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Contas a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalReceivable)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accountsReceivable.length} pendente{accountsReceivable.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Orçamentos Vencidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalExpiredQuotes)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {expiredQuotes.length} orçamento{expiredQuotes.length !== 1 ? 's' : ''} vencido{expiredQuotes.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={action.action}
                className={`${action.color} ${action.hoverColor} text-white rounded-lg p-6 transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg`}
              >
                <action.icon className="h-8 w-8 mb-3" />
                <h3 className="font-bold text-lg mb-1">{action.title}</h3>
                <p className="text-sm text-white/90">{action.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contas a Pagar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-5 w-5" />
                Contas a Pagar
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/finance")}>
                Ver todas
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accountsPayable.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conta a pagar pendente
              </p>
            ) : (
              <div className="space-y-3">
                {accountsPayable.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      isOverdue(entry.dueDate)
                        ? 'border-red-500 bg-red-50'
                        : 'border-yellow-500 bg-yellow-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className={`text-xs ${isOverdue(entry.dueDate) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            Vencimento: {formatDate(entry.dueDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-red-600">
                          {formatCurrency(entry.amount)}
                        </p>
                        {isOverdue(entry.dueDate) && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Vencido
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contas a Receber */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-5 w-5" />
                Contas a Receber
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/finance")}>
                Ver todas
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {accountsReceivable.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conta a receber pendente
              </p>
            ) : (
              <div className="space-y-3">
                {accountsReceivable.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      isOverdue(entry.dueDate)
                        ? 'border-red-500 bg-red-50'
                        : 'border-green-500 bg-green-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className={`text-xs ${isOverdue(entry.dueDate) ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                            Vencimento: {formatDate(entry.dueDate)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-bold text-green-600">
                          {formatCurrency(entry.amount)}
                        </p>
                        {isOverdue(entry.dueDate) && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Vencido
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Orçamentos Vencidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Orçamentos Vencidos
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/quotes")}>
              Ver todos
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {expiredQuotes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum orçamento vencido
            </p>
          ) : (
            <div className="space-y-3">
              {expiredQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="p-4 rounded-lg border-l-4 border-orange-500 bg-orange-50 hover:bg-orange-100 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/quotes?view=${quote.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-orange-600" />
                        <p className="font-medium text-sm">{quote.number}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {getCustomerName(quote.customerId)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-red-600 font-medium">
                          Vencido em: {formatDate(quote.validUntil)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-bold text-orange-600">
                        {formatCurrency(quote.total)}
                      </p>
                      <Badge variant="outline" className="mt-1 border-orange-500 text-orange-700">
                        Pendente
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
