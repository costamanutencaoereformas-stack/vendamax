import { useMemo } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

// Minimal local types
type Supplier = {
  id: string;
  name: string;
  tradeName?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  paymentTerms?: string | null;
  isActive: boolean;
};

type Product = {
  id: string;
  code: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  supplierId?: string | null;
  unit: string;
  costPrice: number | string;
  salePrice: number | string;
  currentStock: number | string;
};

type SupplierMetrics = {
  productCount: number;
  totalStock: number;
  stockValueCost: number;
  stockValueSale: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export default function SupplierDetailsPage() {
  const { id } = useParams<{ id: string }>();
  // Fetch supplier by id
  const { data: supplier, isLoading: loadingSuppliers, error: suppliersError } = useQuery<Supplier>({
    queryKey: ["/api/suppliers", id],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}`);
      if (!res.ok) throw new Error("Falha ao carregar fornecedor");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: products, isLoading: loadingProducts, error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/suppliers", id, "products"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/products`);
      if (!res.ok) {
        let msg = "Falha ao carregar produtos do fornecedor";
        try {
          const j = await res.json();
          if (j?.message) msg = msg + ": " + j.message;
        } catch {}
        throw new Error(msg);
      }
      return res.json();
    },
    // Só buscar produtos depois que o fornecedor existir
    enabled: !!id && !!supplier?.id,
    retry: 1,
  });

  const { data: metrics } = useQuery<SupplierMetrics>({
    queryKey: ["/api/suppliers", id, "metrics"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/metrics`);
      if (!res.ok) throw new Error("Falha ao carregar métricas do fornecedor");
      return res.json();
    },
    // Só buscar métricas depois que o fornecedor existir
    enabled: !!id && !!supplier?.id,
    staleTime: 1000 * 30,
  });

  const supplierProducts = useMemo(() => products || [], [products]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Detalhes do Fornecedor</h1>
          {loadingSuppliers ? (
            <div className="text-sm text-muted-foreground">Carregando fornecedor...</div>
          ) : suppliersError ? (
            <div className="text-sm text-red-600">{(suppliersError as Error).message}</div>
          ) : (
            supplier && (
              <div className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{supplier.name}</span>
                {supplier.tradeName ? <span className="ml-2">• {supplier.tradeName}</span> : null}
              </div>
            )
          )}
        </div>
        <div>
          <Button variant="outline" onClick={() => history.back()}>Voltar</Button>
        </div>
      </div>

      {supplier && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">Contato</div>
              <div className="text-sm mt-1">{supplier.email || '-'}</div>
              <div className="text-sm">{supplier.phone || '-'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">Endereço</div>
              <div className="text-sm mt-1">{supplier.address || '-'}</div>
              <div className="text-sm">{[supplier.city, supplier.state].filter(Boolean).join(' / ') || '-'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-gray-500">Status</div>
              <div className="mt-1"><Badge variant={supplier.isActive ? 'default' : 'secondary'}>{supplier.isActive ? 'Ativo' : 'Inativo'}</Badge></div>
              <div className="text-xs text-gray-500 mt-2">Condições de Pagamento</div>
              <div className="mt-1 text-sm">{supplier.paymentTerms || '-'}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Itens vinculados</div><div className="text-lg font-medium mt-1">{metrics.productCount}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Estoque total</div><div className="text-lg font-medium mt-1">{metrics.totalStock}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Valor em estoque (custo)</div><div className="text-lg font-medium mt-1">{formatCurrency(metrics.stockValueCost)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Valor em estoque (venda)</div><div className="text-lg font-medium mt-1">{formatCurrency(metrics.stockValueSale)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Baixo estoque</div><div className="text-lg font-medium mt-1">{metrics.lowStockCount}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-gray-500">Ruptura (0)</div><div className="text-lg font-medium mt-1">{metrics.outOfStockCount}</div></CardContent></Card>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Produtos fornecidos</h2>
          <div className="text-sm text-muted-foreground">{supplierProducts.length} itens</div>
        </div>
        <div className="border rounded-lg overflow-x-auto">
          <div className="min-w-[900px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Unid.</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">Carregando produtos...</TableCell>
                  </TableRow>
                ) : productsError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-red-600">{(productsError as Error).message}</TableCell>
                  </TableRow>
                ) : supplierProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">Nenhum produto vinculado a este fornecedor.</TableCell>
                  </TableRow>
                ) : (
                  supplierProducts.map((p) => (
                    <TableRow key={p.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.unit}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(p.costPrice))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(p.salePrice))}</TableCell>
                      <TableCell className="text-right">{Number(p.currentStock)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
