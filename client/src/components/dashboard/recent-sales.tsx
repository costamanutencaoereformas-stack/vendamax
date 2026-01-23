import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate, formatDocument } from "@/lib/formatters";
import { User, Building2 } from "lucide-react";
import type { Sale, Customer } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function RecentSales() {
  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    staleTime: 30000, // Dados ficam obsoletos após 30 segundos
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Vendas Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-1"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const recentSales = sales.slice(0, 5);
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Vendas Recentes</CardTitle>
          <Button variant="link" size="sm" className="px-0 h-auto">Ver todas</Button>
        </div>
      </CardHeader>
      {recentSales.length === 0 ? (
        <CardContent>
          <div className="text-center text-muted-foreground">
            <p>Nenhuma venda registrada ainda</p>
          </div>
        </CardContent>
      ) : (
        <CardContent className="overflow-x-auto">
          <div className="min-w-[720px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale: Sale) => {
                  const customer = customerMap.get(sale.customerId);
                  const isCompany = customer?.documentType === 'CNPJ';
                  
                  return (
                    <tr key={sale.id} className="border-b hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                            {isCompany ? (
                              <Building2 className="text-muted-foreground text-sm" />
                            ) : (
                              <User className="text-muted-foreground text-sm" />
                            )}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-foreground">
                              {customer?.name || 'Cliente não encontrado'}
                            </p>
                            {customer && (
                              <p className="text-sm text-muted-foreground">
                                {formatDocument(customer.document)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(sale.total)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sale.status === 'COMPLETED' && (
                          <Badge variant="default">Concluída</Badge>
                        )}
                        {sale.status === 'PROCESSING' && (
                          <Badge variant="secondary">Processando</Badge>
                        )}
                        {sale.status !== 'COMPLETED' && sale.status !== 'PROCESSING' && (
                          <Badge variant="destructive">Cancelada</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {sale.createdAt ? formatDate(sale.createdAt) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
