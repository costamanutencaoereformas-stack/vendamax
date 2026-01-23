import { Switch, Route } from "wouter";
import React, { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Customers = lazy(() => import("@/pages/customers"));
const CustomerDetails = lazy(() => import("@/pages/customer-details"));
const Products = lazy(() => import("@/pages/products"));
const Suppliers = lazy(() => import("@/pages/suppliers"));
const SupplierDetails = lazy(() => import("@/pages/supplier-details"));
const Inventory = lazy(() => import("@/pages/inventory"));
const Quotes = lazy(() => import("@/pages/quotes"));
const Sales = lazy(() => import("@/pages/sales"));
const Reports = lazy(() => import("@/pages/reports"));
const Finance = lazy(() => import("@/pages/finance"));
const Purchases = lazy(() => import("@/pages/purchases"));
const CompanySettings = lazy(() => import("@/pages/company-settings"));
const Agenda = lazy(() => import("@/pages/agenda"));
const Login = lazy(() => import("@/pages/login"));
const Projects = lazy(() => import("@/pages/projects"));
const ProjectNew = lazy(() => import("@/pages/project-new"));
const ProjectDetails = lazy(() => import("@/pages/project-details"));
const Contracts = lazy(() => import("@/pages/contracts"));
const ProfitAnalysis = lazy(() => import("@/pages/profit-analysis"));
const EmailPage = lazy(() => import("@/pages/email"));
const Notes = lazy(() => import("@/pages/notes"));
const AnalyticsDashboard = lazy(() => import("@/pages/analytics-dashboard"));
const Welcome = lazy(() => import("@/pages/welcome"));
const PDV = lazy(() => import("@/pages/pdv"));
const CashRegister = lazy(() => import("@/pages/cash-register"));
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthProvider } from "@/contexts/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";
import { SearchProvider } from "@/contexts/search-context";
import { cn } from "@/lib/utils";
import { useAutoLogout } from "@/hooks/use-auto-logout";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const isMobile = useIsMobile();
  const { isCollapsed } = useSidebar();
  
  // Ativar logout automático por inatividade
  useAutoLogout();

  // Mostrar loading enquanto verifica autenticação
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/">
            {() => {
              window.location.href = "/login";
              return null;
            }}
          </Route>
          <Route>
            {() => {
              window.location.href = "/login";
              return null;
            }}
          </Route>
        </Switch>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <div
        className={cn(
          "flex-1 transition-all duration-300",
          isMobile ? "ml-0" : isCollapsed ? "ml-16" : "ml-64"
        )}
      >
        <Header />
        <main className="p-4 lg:p-6 max-w-full overflow-x-auto mx-auto max-w-7xl">
          <Suspense fallback={<div className="py-8 text-sm text-muted-foreground">Carregando página...</div>}>
            <Switch>
              <Route path="/login">
                {() => {
                  window.location.href = "/";
                  return null;
                }}
              </Route>
              <Route path="/" component={Welcome} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/analytics" component={AnalyticsDashboard} />
              <Route path="/customers" component={Customers} />
              <Route path="/customers/:id" component={CustomerDetails} />
              <Route path="/products" component={Products} />
              <Route path="/suppliers" component={Suppliers} />
              <Route path="/suppliers/:id" component={SupplierDetails} />
              <Route path="/inventory" component={Inventory} />
              <Route path="/agenda" component={Agenda} />
              <Route path="/notes" component={Notes} />
              <Route path="/quotes" component={Quotes} />
              <Route path="/sales" component={Sales} />
              <Route path="/pdv" component={PDV} />
              <Route path="/cash-register" component={CashRegister} />
              <Route path="/projects" component={Projects} />
              <Route path="/projects/new" component={ProjectNew} />
              <Route path="/projects/:id" component={ProjectDetails} />
              <Route path="/reports" component={Reports} />
              <Route path="/email" component={EmailPage} />
              <Route path="/profit-analysis" component={ProfitAnalysis} />
              <Route path="/finance" component={Finance} />
              <Route path="/purchases" component={Purchases} />
              <Route path="/contracts" component={Contracts} />
              <Route path="/company-settings" component={CompanySettings} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <SidebarProvider>
            <SearchProvider>
              <TooltipProvider>
                <Router />
                <Toaster />
              </TooltipProvider>
            </SearchProvider>
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;