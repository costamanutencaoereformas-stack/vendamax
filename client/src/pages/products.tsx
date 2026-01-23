import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Package, AlertTriangle, Power, FileText, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "../components/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import ProductForm from "@/components/forms/product-form";
import XMLImportDialog from "@/components/forms/xml-import-dialog";
import ProductMetricsCards from "@/components/products/product-metrics-cards";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  costPrice: string;
  salePrice: string;
  currentStock?: number | null;
  minimumStock?: number | null;
  categoryId?: string | null;
  supplierId?: string | null;
  isActive: boolean;
  createdAt: Date | null;
}

interface Category {
  id: string;
  name: string;
  description?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  cnpj: string;
}

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isXMLImportOpen, setIsXMLImportOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [excelReport, setExcelReport] = useState<any | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  
  // Fetch sale items to calculate top selling products
  const { data: saleItems = [] } = useQuery({
    queryKey: ["/api/sale-items"],
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
  const [cloneInitialValues, setCloneInitialValues] = useState<any | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const response = await fetch("/api/products");
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('Response is not an array of products');
      }
      return data;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2, // Retry failed requests up to 2 times
    refetchOnWindowFocus: true, // Refetch when window regains focus
    onError: (error) => {
      console.error('Failed to fetch products:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    }
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async (): Promise<Supplier[]> => {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      return response.json();
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ productId, currentStatus, productName }: { 
      productId: string; 
      currentStatus: boolean; 
      productName: string; 
    }) => {
      try {
        const newStatus = !currentStatus;
        console.log(`Alterando status do produto ${productName} de ${currentStatus} para ${newStatus}`);
        
        const response = await fetch(`/api/products/${productId}`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isActive: newStatus }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Produto atualizado com sucesso:', result);
        return { ...result, wasActive: currentStatus };
      } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate both query keys to ensure data consistency
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const action = data.wasActive ? "inativado" : "ativado";
      toast({
        title: `Produto ${action}`,
        description: `O produto foi ${action} com sucesso.`,
      });
    },
    onError: (error: any) => {
      console.error('Erro na mutation:', error);
      toast({
        title: "Erro",
        description: `Erro ao alterar status: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products?.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];
  
  // Calculate metrics for cards
  const productMetrics = useMemo(() => {
    // Count total products
    const totalProducts = products?.length || 0;
    
    // Count products with low or zero stock
    const lowStockProducts = products?.filter(product => 
      product.currentStock !== null && 
      product.currentStock !== undefined && 
      (product.currentStock <= 0 || 
       (product.minimumStock !== null && 
        product.minimumStock !== undefined && 
        product.currentStock <= product.minimumStock))
    ).length || 0;
    
    // Calculate top selling products
    const productSales = new Map();
    
    if (Array.isArray(saleItems)) {
      saleItems.forEach((item: any) => {
        if (!item.productId) return;
        
        const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
        productSales.set(item.productId, {
          quantity: existing.quantity + (item.quantity || 0),
          revenue: existing.revenue + parseFloat(item.total || '0')
        });
      });
    }
    
    // Get top products by quantity sold
    const topSellingProducts = Array.from(productSales.entries())
      .map(([productId, stats]) => {
        const product = products?.find((p: Product) => p.id === productId);
        return product ? {
          id: product.id,
          name: product.name,
          quantity: stats.quantity,
          revenue: stats.revenue
        } : null;
      })
      .filter((x): x is { id: string; name: string; quantity: number; revenue: number } => !!x)
      .sort((a: any, b: any) => b.quantity - a.quantity)
      .slice(0, 5);
    
    return {
      totalProducts,
      lowStockProducts,
      topSellingProducts
    };
  }, [products, saleItems]);

  const getCategoryName = (categoryId: string | null | undefined) => {
    if (!categoryId || !categories) return "Sem categoria";
    const category = categories.find((c: Category) => c.id === categoryId);
    return category?.name || "Categoria não encontrada";
  };

  const getSupplierName = (supplierId: string | null | undefined) => {
    if (!supplierId || !suppliers) return "Sem fornecedor";
    const supplier = suppliers.find((s: Supplier) => s.id === supplierId);
    return supplier?.name || "Fornecedor não encontrado";
  };

  const handleToggleActive = (product: Product) => {
    const action = product.isActive ? "inativar" : "ativar";
    console.log(`Tentando ${action} produto:`, product.name, 'Status atual:', product.isActive);
    
    if (confirm(`Tem certeza que deseja ${action} o produto ${product.name}?`)) {
      console.log('Executando mutation...');
      toggleActiveMutation.mutate({
        productId: product.id,
        currentStatus: product.isActive,
        productName: product.name
      });
    }
  };

  const isLowStock = (product: Product) => {
    return product.currentStock != null &&
           product.minimumStock != null &&
           (product.currentStock as number) <= (product.minimumStock as number);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        
        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-4 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" crumbs={[]} />
      
      <ProductMetricsCards 
        totalProducts={productMetrics.totalProducts}
        lowStockProducts={productMetrics.lowStockProducts}
        topSellingProducts={productMetrics.topSellingProducts}
      />

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Produtos</CardTitle>
              <CardDescription>Gerencie seus produtos e estoque</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsXMLImportOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Importar XML
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsExcelImportOpen(true)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Importar Planilha
                </Button>
                <Dialog
                  open={isCreateOpen}
                  onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setCloneInitialValues(null);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-full max-w-6xl max-h-[90vh]">
                    <DialogHeader>
                      <DialogTitle>Cadastrar Produto</DialogTitle>
                      <DialogDescription>
                        Preencha as informações do produto nos campos abaixo.
                      </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[75vh] pr-4">
                      <ProductForm
                        initialValues={cloneInitialValues ?? undefined}
                        onSuccess={() => {
                          setIsCreateOpen(false);
                          setCloneInitialValues(null);
                        }}
                      />
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

      {/* Excel Import Dialog */}
      <Dialog open={isExcelImportOpen} onOpenChange={setIsExcelImportOpen}>
        <DialogContent className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Produtos por Planilha</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo .xlsx conforme o template. O código interno será gerado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <a className="text-sm text-primary hover:underline" href="/api/products/import-template" target="_blank" rel="noreferrer">Baixar template</a>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('file') as HTMLInputElement);
                if (!input?.files || input.files.length === 0) return;
                const file = input.files[0];
                const formData = new FormData();
                formData.append('file', file);
                try {
                  setExcelUploading(true);
                  setExcelReport(null);
                  const res = await fetch('/api/products/import-excel', { method: 'POST', body: formData });
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  setExcelReport(data);
                  // refresh products
                  queryClient.invalidateQueries({ queryKey: ['products'] });
                } catch (err: any) {
                  alert(err.message || 'Falha ao importar planilha');
                } finally {
                  setExcelUploading(false);
                }
              }}
              className="space-y-3"
            >
              <Input type="file" name="file" accept=".xlsx,.xls" />
              <div className="flex justify-end">
                <Button type="submit" disabled={excelUploading}>{excelUploading ? 'Importando...' : 'Importar'}</Button>
              </div>
            </form>

            {excelReport && (
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-medium">Resumo:</span>{' '}
                  Criados: {excelReport.created?.length || 0} · Atualizados: {excelReport.updated?.length || 0} · Duplicados: {excelReport.duplicates?.length || 0} · Erros: {excelReport.errors?.length || 0}
                </div>
                {(excelReport.created?.length || 0) > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-1">Criados</div>
                    <div className="flex flex-wrap gap-2">
                      {excelReport.created.map((id: string) => (
                        <Button key={id} size="sm" variant="outline" onClick={() => {
                          const p = products?.find((x: any) => x.id === id);
                          if (p) setEditingProduct(p);
                        }}>Editar</Button>
                      ))}
                    </div>
                  </div>
                )}
                {(excelReport.updated?.length || 0) > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-1">Atualizados</div>
                    <div className="flex flex-wrap gap-2">
                      {excelReport.updated.map((id: string) => (
                        <Button key={id} size="sm" variant="outline" onClick={() => {
                          const p = products?.find((x: any) => x.id === id);
                          if (p) setEditingProduct(p);
                        }}>Editar</Button>
                      ))}
                    </div>
                  </div>
                )}
                {(excelReport.errors?.length || 0) > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-1">Erros</div>
                    <ul className="text-sm list-disc pl-5 space-y-1 max-h-48 overflow-auto">
                      {excelReport.errors.map((e: any, i: number) => (
                        <li key={i}>Linha {e.row}: {e.message}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(excelReport.duplicates?.length || 0) > 0 && (
                  <div>
                    <div className="font-medium text-sm mb-1">Duplicados</div>
                    <ul className="text-sm list-disc pl-5 space-y-1 max-h-48 overflow-auto">
                      {excelReport.duplicates.map((d: any, i: number) => (
                        <li key={i}>Linha {d.row}: {d.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[180px]">Categoria</TableHead>
                  <TableHead className="text-right w-[120px]">Custo</TableHead>
                  <TableHead className="text-right w-[120px]">Venda</TableHead>
                  <TableHead className="w-[160px]">Estoque</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product: Product) => (
                    <TableRow key={product.id} className="group">
                      <TableCell className="font-mono text-sm">
                        <span className="text-foreground">{product.code}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-muted">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt="thumb" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{product.name}</div>
                            {product.description && (
                              <div className="text-sm text-muted-foreground truncate max-w-xs">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getCategoryName(product.categoryId)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-medium">
                          {formatCurrency(parseFloat(product.costPrice))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-primary">
                          {formatCurrency(parseFloat(product.salePrice))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {product.currentStock !== null ? (
                          <div className="flex items-center space-x-2">
                            {isLowStock(product) && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className={`text-sm font-medium ${
                              isLowStock(product) ? 'text-amber-600' : ''
                            }`}>
                              {product.currentStock}
                            </span>
                            {product.minimumStock !== null && (
                              <span className="text-xs text-muted-foreground">
                                (mín: {product.minimumStock})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={product.isActive ? 'default' : 'outline'}
                          className={!product.isActive ? 'border-destructive/20 text-destructive' : ''}
                        >
                          {product.isActive ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setViewingProduct(product)}
                            title="Detalhar produto"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setEditingProduct(product)}
                            title="Editar produto"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => {
                              // Prefill values for creation based on selected product
                              setCloneInitialValues({
                                code: "", // empty to trigger auto-generation in form
                                barcode: "",
                                name: product.name,
                                description: product.description ?? "",
                                categoryId: product.categoryId ?? "",
                                supplierId: product.supplierId ?? "",
                                unit: "UN",
                                costPrice: product.costPrice,
                                salePrice: product.salePrice,
                                currentStock: "0",
                                minimumStock: (product.minimumStock ?? 0).toString(),
                                maximumStock: "1000",
                                isActive: true,
                              });
                              setIsCreateOpen(true);
                            }}
                            title="Clonar produto"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                              product.isActive ? 'text-destructive hover:text-destructive/90' : 'text-green-600 hover:text-green-700'
                            }`}
                            onClick={() => handleToggleActive(product)}
                            disabled={toggleActiveMutation.isPending}
                            title={product.isActive ? 'Inativar produto' : 'Ativar produto'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* XML Import Dialog */}
      <XMLImportDialog
        open={isXMLImportOpen}
        onOpenChange={setIsXMLImportOpen}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="w-full max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>
              Atualize as informações do produto nos campos abaixo.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-4">
            {editingProduct && (
              <ProductForm
                product={editingProduct}
                onSuccess={() => setEditingProduct(null)}
              />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Details Dialog (read-only) */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="w-full max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalhes do Produto</DialogTitle>
            <DialogDescription>
              Visualize histórico de preços e fornecedores deste produto.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            {viewingProduct && (
              <ProductDetailsContent product={viewingProduct} />
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductDetailsContent({ product }: { product: Product }) {
  const { toast } = useToast();
  const { data: priceHistory = [], isLoading: phLoading } = useQuery<any[]>({
    queryKey: ["/api/products", product.id, "price-history"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.id}/price-history`);
      if (!res.ok) throw new Error("Falha ao carregar histórico de preços");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: productSuppliers = [], isLoading: psLoading } = useQuery<any[]>({
    queryKey: ["/api/products", product.id, "suppliers"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.id}/suppliers`);
      if (!res.ok) throw new Error("Falha ao carregar fornecedores do produto");
      return res.json();
    },
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="thumb" className="h-full w-full object-cover rounded" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="font-semibold">{product.name}</div>
            <div className="text-sm text-muted-foreground font-mono">{product.code}</div>
          </div>
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground mt-2">{product.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histórico de Preço */}
        <div className="border rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Histórico de Preço</h3>
          </div>
          {phLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem histórico.</p>
          ) : (
            <ul className="space-y-2">
              {priceHistory.map((h: any, idx: number) => (
                <li key={idx} className="text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {new Date(h.changedAt || h.changed_at).toLocaleString("pt-BR")}
                  </span>
                  <span>
                    {formatCurrency(parseFloat(h.oldCostPrice || h.old_cost_price))}
                    {" → "}
                    <span className="font-medium">
                      {formatCurrency(parseFloat(h.newCostPrice || h.new_cost_price))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fornecedores do Produto */}
        <div className="border rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Fornecedores do Produto</h3>
          </div>
          {psLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : productSuppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem fornecedores mapeados.</p>
          ) : (
            <div className="space-y-3">
              {productSuppliers.map((m: any) => (
                <div key={m.id} className="text-sm flex items-center justify-between border rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{m.supplierName || m.supplier_id}</span>
                      {m.supplierCode && (
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">{m.supplierCode}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Último preço: {m.lastPrice ? formatCurrency(parseFloat(m.lastPrice)) : "-"} · Última compra: {m.lastPurchasedAt ? new Date(m.lastPurchasedAt).toLocaleDateString("pt-BR") : "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!m.supplierCode) return;
                        try {
                          await navigator.clipboard.writeText(m.supplierCode);
                          toast({ title: "Código copiado", description: m.supplierCode });
                        } catch (e: any) {
                          toast({ title: "Falha ao copiar", description: e.message, variant: "destructive" });
                        }
                      }}
                      disabled={!m.supplierCode}
                    >
                      Copiar código
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
