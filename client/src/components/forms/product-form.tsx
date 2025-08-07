import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertProductSchema } from "@shared/schema";
import type { Product, Category, Supplier } from "@shared/schema";

const productFormSchema = insertProductSchema.extend({
  costPrice: z.string().min(1, "Preço de custo é obrigatório"),
  salePrice: z.string().min(1, "Preço de venda é obrigatório"),
  currentStock: z.string().optional(),
  minimumStock: z.string().optional(),
  maximumStock: z.string().optional(),
});

interface ProductFormProps {
  product?: Product;
  onSuccess?: () => void;
}

export default function ProductForm({ product, onSuccess }: ProductFormProps) {
  const { toast } = useToast();
  
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: suppliers } = useQuery({
    queryKey: ["/api/suppliers"],
  });
  
  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      code: product?.code || "",
      barcode: product?.barcode || "",
      name: product?.name || "",
      description: product?.description || "",
      categoryId: product?.categoryId || "",
      supplierId: product?.supplierId || "",
      unit: product?.unit || "UN",
      costPrice: product?.costPrice || "",
      salePrice: product?.salePrice || "",
      currentStock: product?.currentStock?.toString() || "0",
      minimumStock: product?.minimumStock?.toString() || "0",
      maximumStock: product?.maximumStock?.toString() || "1000",
      isActive: product?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const submitData = {
        ...data,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currentStock: data.currentStock ? parseInt(data.currentStock) : 0,
        minimumStock: data.minimumStock ? parseInt(data.minimumStock) : 0,
        maximumStock: data.maximumStock ? parseInt(data.maximumStock) : 1000,
        categoryId: data.categoryId || null,
        supplierId: data.supplierId || null,
      };
      
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      if (!response.ok) throw new Error("Failed to create product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto cadastrado",
        description: "Produto foi cadastrado com sucesso.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const submitData = {
        ...data,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currentStock: data.currentStock ? parseInt(data.currentStock) : 0,
        minimumStock: data.minimumStock ? parseInt(data.minimumStock) : 0,
        maximumStock: data.maximumStock ? parseInt(data.maximumStock) : 1000,
        categoryId: data.categoryId || null,
        supplierId: data.supplierId || null,
      };
      
      const response = await fetch(`/api/products/${product!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      if (!response.ok) throw new Error("Failed to update product");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Produto atualizado",
        description: "Produto foi atualizado com sucesso.",
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof productFormSchema>) => {
    if (product) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="code">Código *</Label>
          <Input
            id="code"
            {...form.register("code")}
            placeholder="Digite o código do produto"
          />
          {form.formState.errors.code && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="barcode">Código de Barras</Label>
          <Input
            id="barcode"
            {...form.register("barcode")}
            placeholder="Digite o código de barras"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="name">Nome *</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Digite o nome do produto"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Descrição</Label>
          <Textarea
            id="description"
            {...form.register("description")}
            placeholder="Digite uma descrição para o produto"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <Select
            value={form.watch("categoryId")}
            onValueChange={(value) => form.setValue("categoryId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((category: Category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="supplierId">Fornecedor</Label>
          <Select
            value={form.watch("supplierId")}
            onValueChange={(value) => form.setValue("supplierId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {suppliers?.map((supplier: Supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="unit">Unidade</Label>
          <Select
            value={form.watch("unit")}
            onValueChange={(value) => form.setValue("unit", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UN">Unidade</SelectItem>
              <SelectItem value="KG">Quilograma</SelectItem>
              <SelectItem value="G">Grama</SelectItem>
              <SelectItem value="L">Litro</SelectItem>
              <SelectItem value="ML">Mililitro</SelectItem>
              <SelectItem value="M">Metro</SelectItem>
              <SelectItem value="CM">Centímetro</SelectItem>
              <SelectItem value="M²">Metro Quadrado</SelectItem>
              <SelectItem value="M³">Metro Cúbico</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="costPrice">Preço de Custo *</Label>
          <Input
            id="costPrice"
            {...form.register("costPrice")}
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
          />
          {form.formState.errors.costPrice && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.costPrice.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="salePrice">Preço de Venda *</Label>
          <Input
            id="salePrice"
            {...form.register("salePrice")}
            placeholder="0,00"
            type="number"
            step="0.01"
            min="0"
          />
          {form.formState.errors.salePrice && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.salePrice.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="currentStock">Estoque Atual</Label>
          <Input
            id="currentStock"
            {...form.register("currentStock")}
            placeholder="0"
            type="number"
            min="0"
          />
        </div>

        <div>
          <Label htmlFor="minimumStock">Estoque Mínimo</Label>
          <Input
            id="minimumStock"
            {...form.register("minimumStock")}
            placeholder="0"
            type="number"
            min="0"
          />
        </div>

        <div>
          <Label htmlFor="maximumStock">Estoque Máximo</Label>
          <Input
            id="maximumStock"
            {...form.register("maximumStock")}
            placeholder="1000"
            type="number"
            min="0"
          />
        </div>

        <div className="col-span-2 flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <Label htmlFor="isActive">Produto ativo</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : product ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
