import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Product, Category } from "@shared/schema";
import { useState } from 'react';

const quickProductSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  code: z.string().optional(),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  costPrice: z.string().min(1, "Preço de custo é obrigatório"),
  salePrice: z.string().min(1, "Preço de venda é obrigatório"),
  currentStock: z.string().optional(),
  minimumStock: z.string().optional(),
});

interface QuickProductFormProps {
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

export default function QuickProductForm({ onSuccess, onCancel }: QuickProductFormProps) {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Falha ao carregar categorias");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof quickProductSchema>>({
    resolver: zodResolver(quickProductSchema),
    defaultValues: {
      name: "",
      code: "",
      categoryId: "",
      costPrice: "",
      salePrice: "",
      currentStock: "0",
      minimumStock: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quickProductSchema>) => {
      // Generate a unique code if not provided
      const generateCode = () => {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `PRD${timestamp}${random}`;
      };

      const productData = {
        name: data.name,
        code: data.code && data.code.trim() ? data.code.trim() : generateCode(),
        categoryId: data.categoryId,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currentStock: parseInt(data.currentStock || "0"),
        minimumStock: parseInt(data.minimumStock || "0"),
        isActive: true,
        description: null,
        unit: "UN",
      };

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro do servidor:', response.status, errorData);
        throw new Error(`Erro ${response.status}: ${errorData || "Falha ao criar produto"}`);
      }
      return response.json();
    },
    onSuccess: (newProduct) => {
      // upload image if present
      (async () => {
        try {
          if (imageFile) {
            const fd = new FormData();
            fd.append('file', imageFile);
            const resp = await fetch(`/api/products/${newProduct.id}/image`, { method: 'POST', body: fd });
            if (!resp.ok) throw new Error('Falha ao enviar imagem');
          }
        } catch (e: any) {
          console.warn('Falha ao enviar imagem do produto rápido', e);
        } finally {
          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
          toast({ title: "Produto criado", description: "Produto foi criado com sucesso." });
          onSuccess(newProduct);
        }
      })();
    },
    onError: (error: any) => {
      console.error('Erro detalhado ao criar produto:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar produto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof quickProductSchema>) => {
    createMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nome do Produto *</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Digite o nome do produto"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            {...form.register("code")}
            placeholder="Código do produto (opcional)"
          />
          <div className="flex flex-col">
            <Label htmlFor="image">Imagem (opcional)</Label>
            <input id="image" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div>
          <Label htmlFor="categoryId">Categoria *</Label>
          <Select
            value={form.watch("categoryId")}
            onValueChange={(value) => form.setValue("categoryId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(categories) ? categories : []).map((category: Category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.categoryId && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.categoryId.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="costPrice">Preço de Custo *</Label>
          <Input
            id="costPrice"
            {...form.register("costPrice")}
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
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
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
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
            type="number"
            min="0"
            placeholder="0"
          />
        </div>

        <div>
          <Label htmlFor="minimumStock">Estoque Mínimo</Label>
          <Input
            id="minimumStock"
            {...form.register("minimumStock")}
            type="number"
            min="0"
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Criando..." : "Criar Produto"}
        </Button>
      </div>
    </form>
  );
}
