import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { queryClient } from "@/lib/queryClient";
import { insertProductSchema } from "@shared/schema";
import { RefreshCw } from "lucide-react";

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
  maximumStock?: number | null;
  categoryId?: string | null;
  supplierId?: string | null;
  barcode?: string | null;
  unit?: string | null;
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
  // When creating a product, allows prefilling values (e.g., cloning from another product)
  initialValues?: Partial<z.infer<typeof productFormSchema>>;
}

export default function ProductForm({ product, onSuccess, initialValues }: ProductFormProps) {
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.imageUrl ?? null);
  
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Price history and suppliers mapping (only when editing existing product)
  const { data: priceHistory = [], isLoading: phLoading } = useQuery<any[]>({
    queryKey: ["/api/products", product?.id, "price-history"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/price-history`);
      if (!res.ok) throw new Error("Falha ao carregar histórico de preços");
      return res.json();
    },
    enabled: !!product?.id,
    staleTime: 30_000,
  });

  const { data: productSuppliers = [], isLoading: psLoading } = useQuery<any[]>({
    queryKey: ["/api/products", product?.id, "suppliers"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product!.id}/suppliers`);
      if (!res.ok) throw new Error("Falha ao carregar fornecedores do produto");
      return res.json();
    },
    enabled: !!product?.id,
    staleTime: 30_000,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const response = await fetch("/api/suppliers");
      if (!response.ok) throw new Error("Failed to fetch suppliers");
      return response.json();
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });
  
  // Função para gerar código automático
  const generateAutoCode = () => {
    if (product) return; // Não gerar código para produtos em edição
    
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos do timestamp
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0'); // 3 dígitos aleatórios
    const autoCode = `PRD${timestamp}${random}`;
    
    // Verificar se o código já existe
    const existingCodes = products?.map((p: Product) => p.code) || [];
    if (!existingCodes.includes(autoCode)) {
      form.setValue("code", autoCode);
    } else {
      // Se existir, tentar novamente
      generateAutoCode();
    }
  };

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      // If editing, prioritize product values. Otherwise, use provided initialValues (for clone) or sensible defaults
      code: product?.code ?? initialValues?.code ?? "",
      barcode: product?.barcode ?? initialValues?.barcode ?? "",
      name: product?.name ?? initialValues?.name ?? "",
      description: product?.description ?? initialValues?.description ?? "",
      categoryId: product?.categoryId ?? initialValues?.categoryId ?? "",
      supplierId: product?.supplierId ?? initialValues?.supplierId ?? "",
      unit: product?.unit ?? initialValues?.unit ?? "UN",
      costPrice: product?.costPrice ?? initialValues?.costPrice ?? "",
      salePrice: product?.salePrice ?? initialValues?.salePrice ?? "",
      currentStock: (product?.currentStock != null
        ? product.currentStock.toString()
        : (initialValues?.currentStock as string | undefined)) ?? "0",
      minimumStock: (product?.minimumStock != null
        ? product.minimumStock.toString()
        : (initialValues?.minimumStock as string | undefined)) ?? "0",
      maximumStock: (product?.maximumStock != null
        ? product.maximumStock.toString()
        : (initialValues?.maximumStock as string | undefined)) ?? "1000",
      isActive: product?.isActive ?? initialValues?.isActive ?? true,
    },
  });

  // Auto-generate code when creating new product and products data is loaded
  useEffect(() => {
    if (!product && products && !form.watch("code")) {
      generateAutoCode();
    }
  }, [products, product]);

  // Manage preview URL for selected file
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

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
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Wrap create to handle image upload after creation
  const handleCreateSuccess = async (created: any) => {
    try {
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const resp = await fetch(`/api/products/${created.id}/image`, { method: 'POST', body: fd });
        if (!resp.ok) throw new Error('Falha ao enviar imagem');
        const json = await resp.json();
        setPreviewUrl(json.imageUrl ?? null);
      }
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({ title: "Produto cadastrado", description: "Produto foi cadastrado com sucesso." });
      onSuccess?.();
    }

  };

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
      // handled in wrapper
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleUpdateSuccess = async (updated: any) => {
    try {
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        const resp = await fetch(`/api/products/${updated.id}/image`, { method: 'POST', body: fd });
        if (!resp.ok) throw new Error('Falha ao enviar imagem');
        const json = await resp.json();
        setPreviewUrl(json.imageUrl ?? null);
      }
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({ title: "Produto atualizado", description: "Produto foi atualizado com sucesso." });
      onSuccess?.();
    }
  };

  const onSubmit = (data: z.infer<typeof productFormSchema>) => {
    if (product) {
      updateMutation.mutate(data, { onSuccess: (res) => handleUpdateSuccess(res) as any });
    } else {
      createMutation.mutate(data, { onSuccess: (res) => handleCreateSuccess(res) as any });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="code">Código *</Label>
          <div className="flex space-x-2">
            <Input
              id="code"
              {...form.register("code")}
              placeholder="Digite o código do produto"
              className="flex-1"
              readOnly={!!product}
              disabled={!!product}
            />
            {!product && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateAutoCode}
                className="px-3"
                title="Gerar código automaticamente"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
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

          <div className="flex flex-col items-start space-y-2">
            <Label htmlFor="image">Imagem do produto</Label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl && (
              <img src={previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-md border" />
            )}
        </div>

        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <Select
            value={(form.watch("categoryId") ?? undefined) as string | undefined}
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
            value={(form.watch("supplierId") ?? undefined) as string | undefined}
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
            checked={Boolean(form.watch("isActive"))}
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

      {product && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          {/* Price History */}
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

          {/* Product Suppliers */}
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
      )}
    </form>
  );
}
