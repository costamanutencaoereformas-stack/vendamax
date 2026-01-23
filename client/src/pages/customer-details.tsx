import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
// Minimal local types to avoid cross-package import issues
type Customer = {
  id: string;
  name: string;
  document?: string | null;
  documentType?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  classification?: string | null;
  isActive?: boolean | null;
};

type Product = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  salePrice: string;
  costPrice: string;
  currentStock: number;
  isActive: boolean;
};

type Sale = {
  id: string;
  number: string;
  customerId: string;
  status: string;
  paymentMethod: string;
  subtotal: number | string;
  discount?: number | string | null;
  total: number | string;
  createdAt?: string | Date | null;
};

type SaleItem = {
  id: string;
  saleId: string;
  productId?: string | null;
  serviceDescription?: string | null;
  quantity: number | string;
  unitPrice: number | string;
  total: number | string;
};

export default function CustomerDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);

  const { data: customer, isLoading: loadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers", id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error("Falha ao carregar cliente");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: sales, isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch(`/api/sales`);
      if (!res.ok) throw new Error("Falha ao carregar vendas");
      return res.json();
    },
  });

  const customerSales = useMemo(() => {
    return (sales || []).filter((s) => s.customerId === id);
  }, [sales, id]);

  const { data: totalSalesData } = useQuery<{
    totalSales: number;
    totalCompletedSales: number;
    salesCount: number;
    completedSalesCount: number;
  }>({
    queryKey: ["/api/customers", id, "total-sales"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${id}/total-sales`);
      if (!res.ok) throw new Error("Falha ao carregar total de vendas");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: viewingSaleItems } = useQuery<SaleItem[]>({
    queryKey: ["/api/sales", viewingSale?.id, "items"],
    queryFn: async () => {
      const resp = await fetch(`/api/sales/${viewingSale!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens da venda");
      return resp.json();
    },
    enabled: !!viewingSale?.id,
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return res.json();
    },
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  const getProductName = (productId: string): string => {
    if (!products) return productId;
    const product = products.find(p => p.id === productId);
    return product ? `${product.name} (${product.code})` : productId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Detalhes do Cliente</h1>
          {loadingCustomer ? (
            <div className="text-sm text-muted-foreground">Carregando cliente...</div>
          ) : (
            customer && (
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{customer.name}</span>
                {customer.document ? (
                  <span className="ml-2">• {customer.documentType} {customer.document}</span>
                ) : null}
              </div>
            )
          )}
        </div>
        <div>
          <Button variant="outline" onClick={() => history.back()}>Voltar</Button>
        </div>
      </div>

      {customer && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">Contato</div>
            <div className="text-sm mt-1">{customer.email || '-'}</div>
            <div className="text-sm">{customer.phone || '-'}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">Endereço</div>
            <div className="text-sm mt-1">{customer.address || '-'}</div>
            <div className="text-sm">{[customer.city, customer.state].filter(Boolean).join(' / ') || '-'}</div>
          </div>
          <div className="p-4 rounded-lg border bg-white">
            <div className="text-xs text-gray-500">Classificação</div>
            <div className="mt-1"><Badge>{customer.classification || 'REGULAR'}</Badge></div>
            <div className="text-xs text-gray-500 mt-2">Status</div>
            <div className="mt-1"><Badge variant={customer.isActive ? 'default' : 'secondary'}>{customer.isActive ? 'Ativo' : 'Inativo'}</Badge></div>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <div className="min-w-[900px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Desconto</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingSales ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">Carregando vendas...</TableCell>
                </TableRow>
              ) : customerSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">Nenhuma venda encontrada para este cliente.</TableCell>
                </TableRow>
              ) : (
                customerSales.map((s) => (
                  <TableRow key={s.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="font-medium">{s.number}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'COMPLETED' ? 'default' : 'secondary'}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>{s.paymentMethod}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(s.subtotal))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(s.discount || 0))}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatCurrency(Number(s.total))}</TableCell>
                    <TableCell>{s.createdAt ? formatDate(s.createdAt) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="secondary" size="sm" onClick={() => setViewingSale(s)}>Ver itens</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Total Sales Summary */}
        {totalSalesData && (
          <div className="border-t bg-muted/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Total de Vendas</div>
                <div className="font-semibold text-lg">{totalSalesData.salesCount}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Vendas Concluídas</div>
                <div className="font-semibold text-lg">{totalSalesData.completedSalesCount}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Valor Total</div>
                <div className="font-semibold text-lg text-blue-600">{formatCurrency(totalSalesData.totalSales)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Valor Concluído</div>
                <div className="font-semibold text-lg text-green-600">{formatCurrency(totalSalesData.totalCompletedSales)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sale details dialog */}
      <Dialog open={!!viewingSale} onOpenChange={() => setViewingSale(null)}>
        <DialogContent className="w-screen h-screen md:h-auto md:max-w-2xl md:w-[720px] max-w-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Venda {viewingSale?.number ? `(${viewingSale.number})` : ''}</DialogTitle>
          </DialogHeader>

          {viewingSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div><Badge variant={viewingSale.status === 'COMPLETED' ? 'default' : 'secondary'}>{viewingSale.status}</Badge></div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pagamento</div>
                  <div>{viewingSale.paymentMethod}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Subtotal</div>
                  <div className="font-medium">{formatCurrency(Number(viewingSale.subtotal))}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Desconto</div>
                  <div className="font-medium">{formatCurrency(Number(viewingSale.discount || 0))}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500">Total</div>
                  <div className="text-lg font-bold text-green-600">{formatCurrency(Number(viewingSale.total))}</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto/Serviço</TableHead>
                      <TableHead className="text-right">Qtde</TableHead>
                      <TableHead className="text-right">Unitário</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(viewingSaleItems || []).map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          {it.productId ? (
                            <span>{getProductName(it.productId)}</span>
                          ) : (
                            <span>{it.serviceDescription}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{Number(it.quantity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(it.unitPrice))}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(it.total))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
