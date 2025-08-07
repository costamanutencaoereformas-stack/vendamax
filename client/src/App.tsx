import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Suppliers from "@/pages/suppliers";
import Inventory from "@/pages/inventory";
import Quotes from "@/pages/quotes";
import Sales from "@/pages/sales";
import Reports from "@/pages/reports";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useIsMobile } from "./hooks/useIsMobile";

function Router() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/customers" component={Customers} />
            <Route path="/products" component={Products} />
            <Route path="/suppliers" component={Suppliers} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/quotes" component={Quotes} />
            <Route path="/sales" component={Sales} />
            <Route path="/reports" component={Reports} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  const isMobile = useIsMobile();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Sidebar />
          <div className={isMobile ? "ml-0" : "ml-64"}>
            <Header />
            <main className={isMobile ? "p-4" : "p-6"}>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/customers" component={Customers} />
                <Route path="/products" component={Products} />
                <Route path="/suppliers" component={Suppliers} />
                <Route path="/inventory" component={Inventory} />
                <Route path="/quotes" component={Quotes} />
                <Route path="/sales" component={Sales} />
                <Route path="/reports" component={Reports} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;