import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertQuoteSchema } from "@shared/schema";
import { formatCurrency } from "@/lib/formatters";
import type { Quote, Customer, Product } from "@shared/schema";

const quoteItemSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  unitPrice: z.string().min(1, "Preço unitário é obrigatório"),
  discount: z.string().optional(),
});

const quoteFormSchema = insertQuoteSchema.extend({
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  status: z.string().min(1, "Status é obrigatório"),
  subtotal: z.string(),
  discount: z.string().optional(),
  total: z.string(),
  items: z.array(quoteItemSchema).min(1, "Adicione pelo menos um item"),
});

interface QuoteFormProps {
  quote?: Quote;
  onSuccess?: () => void;
}

export default function QuoteForm({ quote, onSuccess }: QuoteFormProps) {
  const { toast } = useToast();
  
  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  const { data: products } = useQuery({
    queryKey: ["/api/products"],
  });
  
  const form = useForm<z.infer<typeof quoteFormSchema>>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      number: quote?.number || "",
      customerId: quote?.customerId || "",
      status: quote?.status || "PENDING",
      validUntil: quote?.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : "",
      subtotal: quote?.subtotal || "0",
      discount: quote?.discount || "0",
      total: quote?.total || "0",
      notes: quote?.notes || "",
      items: [{ productId: "", quantity: "1", unitPrice: "0", discount: "0" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const calculateTotals = () => {
    const items = form.watch("items");
    const subtotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount) || 0;
      return sum + (qty * price - discount);
    }, 0);

    const generalDiscount = parseFloat(form.watch("discount")) || 0;
    const total = subtotal - generalDiscount;

    form.setValue("subtotal", subtotal.toString());
    form.setValue("total", Math.max(0, total).toString());
  };

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      // Generate quote number if not provided
      const quoteNumber = data.number || `ORC-${Date.now()}`;
      
      const quoteData = {
        number: quoteNumber,
        customerId: data.customerId,
        validUntil: new Date(data.validUntil),
        subtotal: data.subtotal,
        discount: data.discount || "0",
        total: data.total,
        notes: data.notes || null,
        status: data.status,
        userId: null,
      };

      const quoteResponse = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
      });
      
      if (!quoteResponse.ok) throw new Error("Failed to create quote");
      const createdQuote = await quoteResponse.json();

      // Create quote items
      for (const item of data.items) {
        const itemData = {
          productId: item.productId,
          quantity: parseInt(item.quantity),
          unitPrice: item.unitPrice,
          discount: item.discount || "0",
          total: ((parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount || "0")).toString(),
        };

        const itemResponse = await fetch(`/api/quotes/${createdQuote.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemData),
        });
        
        if (!itemResponse.ok) throw new Error("Failed to create quote item");
      }

      return createdQuote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Orçamento criado",
        description: "Orçamento foi criado com sucesso.",
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

  const onSubmit = (data: z.infer<typeof quoteFormSchema>) => {
    createMutation.mutate(data);
  };

  const addItem = () => {
    append({ productId: "", quantity: "1", unitPrice: "0", discount: "0" });
  };

  const getProduct = (productId: string) => {
    return products?.find((p: Product) => p.id === productId);
  };

  const updateItemPrice = (index: number, productId: string) => {
    const product = getProduct(productId);
    if (product) {
      form.setValue(`items.${index}.unitPrice`, product.salePrice);
      calculateTotals();
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="number">Número do Orçamento</Label>
          <Input
            id="number"
            {...form.register("number")}
            placeholder="Será gerado automaticamente"
          />
        </div>

        <div>
          <Label htmlFor="customerId">Cliente *</Label>
          <Select
            value={form.watch("customerId")}
            onValueChange={(value) => form.setValue("customerId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {customers?.map((customer: Customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.customerId && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.customerId.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="validUntil">Válido até *</Label>
          <Input
            id="validUntil"
            type="date"
            {...form.register("validUntil")}
          />
          {form.formState.errors.validUntil && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.validUntil.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="status">Status *</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(value) => form.setValue("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pendente</SelectItem>
              <SelectItem value="APPROVED">Aprovado</SelectItem>
              <SelectItem value="REJECTED">Rejeitado</SelectItem>
              <SelectItem value="CONVERTED">Convertido</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.status && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.status.message}</p>
          )}
        </div>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Itens do Orçamento</CardTitle>
            <Button type="button" onClick={addItem} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
              <div className="col-span-4">
                <Label>Produto *</Label>
                <Select
                  value={form.watch(`items.${index}.productId`)}
                  onValueChange={(value) => {
                    form.setValue(`items.${index}.productId`, value);
                    updateItemPrice(index, value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product: Product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {formatCurrency(product.salePrice)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Qtd *</Label>
                <Input
                  {...form.register(`items.${index}.quantity`)}
                  type="number"
                  min="1"
                  onChange={calculateTotals}
                />
              </div>

              <div className="col-span-2">
                <Label>Preço Un. *</Label>
                <Input
                  {...form.register(`items.${index}.unitPrice`)}
                  type="number"
                  step="0.01"
                  min="0"
                  onChange={calculateTotals}
                />
              </div>

              <div className="col-span-2">
                <Label>Desconto</Label>
                <Input
                  {...form.register(`items.${index}.discount`)}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  onChange={calculateTotals}
                />
              </div>

              <div className="col-span-1">
                <Label>Total</Label>
                <div className="p-2 bg-gray-50 rounded text-sm font-medium">
                  {formatCurrency(
                    (parseFloat(form.watch(`items.${index}.quantity`)) || 0) *
                    (parseFloat(form.watch(`items.${index}.unitPrice`)) || 0) -
                    (parseFloat(form.watch(`items.${index}.discount`)) || 0)
                  )}
                </div>
              </div>

              <div className="col-span-1">
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      remove(index);
                      calculateTotals();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(form.watch("subtotal"))}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <Label htmlFor="discount">Desconto Geral:</Label>
              <Input
                id="discount"
                {...form.register("discount")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-32"
                onChange={calculateTotals}
              />
            </div>
            
            <div className="flex justify-between text-lg font-semibold border-t pt-3">
              <span>Total:</span>
              <span>{formatCurrency(form.watch("total"))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="Informações adicionais sobre o orçamento"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Salvando..." : "Criar Orçamento"}
        </Button>
      </div>
    </form>
  );
}
