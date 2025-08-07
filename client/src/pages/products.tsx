import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ProductForm from "@/components/forms/product-form";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Product, Category, Supplier } from "@shared/schema";

export default function Products() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto excluído",
        description: "Produto foi excluído com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products?.filter((product: Product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !categories) return "Sem categoria";
    const category = categories.find((c: Category) => c.id === categoryId);
    return category?.name || "Categoria não encontrada";
  };

  const getSupplierName = (supplierId: string | null) => {
    if (!supplierId || !suppliers) return "Sem fornecedor";
    const supplier = suppliers.find((s: Supplier) => s.id === supplierId);
    return supplier?.name || "Fornecedor não encontrado";
  };

  const handleDelete = (product: Product) => {
    if (confirm(`Tem certeza que deseja excluir o produto ${product.name}?`)) {
      deleteMutation.mutate(product.id);
    }
  };

  const isLowStock = (product: Product) => {
    return product.currentStock !== null && 
           product.minimumStock !== null && 
           product.currentStock <= product.minimumStock;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Produto</DialogTitle>
            </DialogHeader>
            <ProductForm
              onSuccess={() => setIsCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500">
              {searchTerm ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product: Product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <p className="text-sm text-gray-500">Código: {product.code}</p>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingProduct(product)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Preço de venda:</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(product.salePrice)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estoque:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {product.currentStock || 0} {product.unit}
                      </span>
                      {isLowStock(product) && (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Categoria:</span>
                    <span className="text-sm">{getCategoryName(product.categoryId)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Fornecedor:</span>
                    <span className="text-sm">{getSupplierName(product.supplierId)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    {isLowStock(product) && (
                      <Badge variant="destructive">
                        Estoque baixo
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <ProductForm
              product={editingProduct}
              onSuccess={() => setEditingProduct(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
