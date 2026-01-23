import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, TrendingUp, TrendingDown, RotateCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDateTime } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertInventorySchema } from "@shared/schema";
import type { Inventory, Product } from "@shared/schema";

const inventoryFormSchema = insertInventorySchema.extend({
  quantity: z.string().min(1, "Quantidade é obrigatória"),
});

const movementTypes = {
  IN: { label: "Entrada", icon: TrendingUp, color: "text-green-600" },
  OUT: { label: "Saída", icon: TrendingDown, color: "text-red-600" },
  ADJUSTMENT: { label: "Ajuste", icon: RotateCw, color: "text-blue-600" },
};

export default function Inventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: inventory, isLoading: inventoryLoading } = useQuery<any[]>({
    queryKey: ["/api/inventory"],
  });

  const { data: products } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: lowStockProducts } = useQuery<any[]>({
    queryKey: ["/api/products/low-stock"],
  });

  const form = useForm<z.infer<typeof inventoryFormSchema>>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      productId: "",
      type: "IN",
      quantity: "",
      reason: "",
      userId: null,
    },
  });

  const createMovementMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inventoryFormSchema>) => {
      const submitData = {
        ...data,
        quantity: parseInt(data.quantity),
      };
      
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      if (!response.ok) throw new Error("Failed to create inventory movement");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products/low-stock"] });
      toast({
        title: "Movimentação registrada",
        description: "Movimentação de estoque foi registrada com sucesso.",
      });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof inventoryFormSchema>) => {
    createMovementMutation.mutate(data);
  };

  const filteredMovements = inventory?.filter((movement: Inventory) => {
    const product = products?.find((p: Product) => p.id === movement.productId);
    return product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           product?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
           movement.reason?.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  const getProductName = (productId: string) => {
    const product = products?.find((p: Product) => p.id === productId);
    return product ? `${product.name} (${product.code})` : "Produto não encontrado";
  };

  if (inventoryLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
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
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Produtos</p>
                <p className="text-2xl font-bold text-gray-900">{products?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Produtos com Estoque Baixo</p>
                <p className="text-2xl font-bold text-gray-900">{lowStockProducts?.length || 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Movimentações Hoje</p>
                <p className="text-2xl font-bold text-gray-900">
                  {inventory?.filter((m: Inventory) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return m.createdAt && new Date(m.createdAt) >= today;
                  }).length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <RotateCw className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar movimentações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Movimentação
            </Button>
          </DialogTrigger>
          <DialogContent className="w-screen h-[90vh] sm:h-auto sm:max-w-[640px] max-w-none p-4 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Movimentação</DialogTitle>
              <DialogDescription>
                Preencha os dados para registrar a movimentação de estoque.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="productId">Produto *</Label>
                <Select
                  value={form.watch("productId")}
                  onValueChange={(value) => form.setValue("productId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.code}) - Estoque: {product.currentStock || 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.productId && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.productId.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="type">Tipo de Movimentação *</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => form.setValue("type", value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">Entrada</SelectItem>
                    <SelectItem value="OUT">Saída</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="quantity">Quantidade *</Label>
                <Input
                  id="quantity"
                  {...form.register("quantity")}
                  placeholder="Digite a quantidade"
                  type="number"
                  min="1"
                />
                {form.formState.errors.quantity && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.quantity.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="reason">Motivo</Label>
                <Textarea
                  id="reason"
                  {...form.register("reason")}
                  placeholder="Descreva o motivo da movimentação"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMovementMutation.isPending}>
                  {createMovementMutation.isPending ? "Registrando..." : "Registrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inventory Movements */}
      <Card>
        <CardHeader>
          <CardTitle>Movimentações de Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMovements.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {searchTerm ? "Nenhuma movimentação encontrada." : "Nenhuma movimentação registrada ainda."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Produto</th>
                    <th className="text-left py-3 px-4 font-medium">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium">Quantidade</th>
                    <th className="text-left py-3 px-4 font-medium">Motivo</th>
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((movement: Inventory) => {
                    const movementConfig = movementTypes[movement.type as keyof typeof movementTypes];
                    const IconComponent = movementConfig.icon;
                    
                    return (
                      <tr key={movement.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium">{getProductName(movement.productId)}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <IconComponent className={`h-4 w-4 ${movementConfig.color}`} />
                            <Badge variant="outline">
                              {movementConfig.label}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`font-medium ${
                            movement.type === 'IN' ? 'text-green-600' :
                            movement.type === 'OUT' ? 'text-red-600' : 
                            'text-blue-600'
                          }`}>
                            {movement.type === 'OUT' ? '-' : '+'}{movement.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-600">
                            {movement.reason || '-'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {movement.createdAt ? formatDateTime(movement.createdAt) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
