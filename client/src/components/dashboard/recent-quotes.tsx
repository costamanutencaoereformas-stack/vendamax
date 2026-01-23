import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useMemo } from "react";
import type { Quote, Customer } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecentQuotes() {
  const { data: quotes = [] } = useQuery<Quote[]>({ 
    queryKey: ["/api/quotes"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });
  const { data: customers = [] } = useQuery<Customer[]>({ 
    queryKey: ["/api/customers"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  const items = useMemo(() => {
    const arr = Array.isArray(quotes) ? quotes.slice() : [];
    arr.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return arr.slice(0, 10);
  }, [quotes]);

  function getCustomerName(id?: string) {
    if (!id || !Array.isArray(customers)) return "-";
    const c = customers.find((x: any) => x.id === id);
    return c?.name || "-";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Orçamentos Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {items.map((q: any) => (
            <div key={q.id} className="py-2 flex items-center justify-between text-sm">
              <div className="flex-1">
                <div className="font-medium text-foreground">#{q.number} • {getCustomerName(q.customerId)}</div>
                <div className="text-muted-foreground">{q.status} • {new Date(q.createdAt).toLocaleDateString("pt-BR")}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground">{Number(q.total || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => (window.location.href = `/quotes?view=${q.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1" /> Ver
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">Nenhum orçamento encontrado.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
