import { useForm, useFieldArray } from "react-hook-form";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ProductPicker from "@/components/product-picker";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertQuoteSchema } from "@shared/schema";
import { formatCurrency } from "@/lib/formatters";
import type { Quote, Customer, Product, QuoteAttachment, Project } from "@shared/schema";
import { FileUpload } from "./file-upload";
import api from '@/lib/api';

const quoteItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["PRODUCT", "SERVICE"]).default("PRODUCT"),
  productId: z.string().optional(),
  serviceDescription: z.string().optional(),
  quantity: z.string().min(1, "Quantidade é obrigatória"),
  unitPrice: z.string().min(1, "Preço unitário é obrigatório"),
  discount: z.string().optional(),
}).refine((item) => item.type === "SERVICE" ? Boolean(item.serviceDescription && item.serviceDescription.trim()) : true, {
  message: "Descrição do serviço é obrigatória",
  path: ["serviceDescription"],
}).refine((item) => item.type === "PRODUCT" ? Boolean(item.productId) : true, {
  message: "Produto é obrigatório",
  path: ["productId"],
});

const quoteFormSchema = insertQuoteSchema.extend({
  validUntil: z.string().min(1, "Data de validade é obrigatória"),
  status: z.string().min(1, "Status é obrigatório"),
  subtotal: z.string(),
  discount: z.string().optional(),
  total: z.string(),
  paymentTerms: z.string().optional(),
  seller: z.string().optional(),
  taxTotal: z.string().optional(),
  shipping: z.string().optional(),
  projectId: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, "Adicione pelo menos um item"),
});

interface QuoteFormProps {
  quote?: Quote;
  cloneFrom?: Quote; // origem para clonagem
  projectId?: string; // projeto vinculado (para preenchimento automático)
  onSuccess?: () => void;
}

export default function QuoteForm({ quote, cloneFrom, projectId, onSuccess }: QuoteFormProps) {
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<QuoteAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerSelected, setProductPickerSelected] = useState<string[]>([]);
  
  // Carregar anexos existentes quando o componente for montado
  useEffect(() => {
    const loadAttachments = async () => {
      if (!quote?.id) return;
      
      try {
        const response = await api.get(`/quotes/${quote.id}/attachments`);
        setAttachments(response.data);
      } catch (error) {
        console.error('Erro ao carregar anexos:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os anexos do orçamento.',
          variant: 'destructive',
        });
      }
    };
    
    loadAttachments();
  }, [quote?.id, toast]);
  
  // Função para lidar com o upload de arquivos
  const handleFilesChange = async (files: { file: File; preview: string; id: string; isNew: boolean }[]) => {
    if (!quote?.id) {
      toast({
        title: 'Erro',
        description: 'É necessário salvar o orçamento antes de anexar arquivos.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Adiciona apenas os arquivos que são novos (isNew = true)
      const newFiles = files.filter(file => file.isNew);
      
      if (newFiles.length > 0) {
        // Enviar cada arquivo individualmente
  const uploadedAttachments: QuoteAttachment[] = [];
        
        for (const file of newFiles) {
          const formData = new FormData();
          formData.append('file', file.file);
          
          const response = await api.post(`/quotes/${quote.id}/attachments`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          
          uploadedAttachments.push(response.data);
        }
        
        // Atualizar a lista de anexos com os novos arquivos
        setAttachments(prev => [...prev, ...uploadedAttachments]);
        
        toast({
          title: 'Sucesso',
          description: `${newFiles.length} arquivo(s) enviado(s) com sucesso!`,
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível enviar o(s) arquivo(s). Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Função para lidar com a remoção de um anexo
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!quote?.id) return;
    
    try {
      await api.delete(`/api/quote-attachments/${attachmentId}`);
      
      // Atualizar a lista de anexos removendo o arquivo excluído
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      
      toast({
        title: 'Sucesso',
        description: 'Arquivo removido com sucesso!',
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao remover arquivo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    }
  };
  

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return res.json();
    },
  });

  // Carregar projetos para seleção
  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Falha ao carregar projetos");
      return res.json();
    },
  });

  // Carregar projeto específico se projectId for fornecido
  const { data: selectedProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error("Falha ao carregar projeto");
      return res.json();
    },
    enabled: !!projectId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof quoteFormSchema> }) => {
      const quoteData = {
        number: data.number || quote?.number || `ORC-${Date.now()}`,
        customerId: data.customerId,
        validUntil: new Date(data.validUntil),
        subtotal: data.subtotal,
        discount: data.discount || "0",
        total: data.total,
        notes: data.notes || null,
        status: data.status,
        paymentTerms: data.paymentTerms || null,
        seller: data.seller || null,
        taxTotal: data.taxTotal || "0",
        shipping: data.shipping || "0",
        projectId: data.projectId || null,
        userId: null,
      };

      const resp = await fetch(`/api/quotes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
      });
      if (!resp.ok) throw new Error("Failed to update quote");
      await resp.json();

      // Sincronizar itens (create/update/delete)
      const currentResp = await fetch(`/api/quotes/${id}/items`);
      if (!currentResp.ok) throw new Error("Failed to load current quote items");
      const currentItems: any[] = await currentResp.json();

      const currentIds = new Set(currentItems.map((it) => it.id));
      const submittedIds = new Set((data.items || []).map((it) => it.id).filter(Boolean) as string[]);

      // Atualizar ou criar itens submetidos
      for (const item of data.items || []) {
        const payload: any = {
          productId: item.type === "PRODUCT" ? (item.productId || null) : null,
          serviceDescription: item.type === "SERVICE" ? (item.serviceDescription || "") : null,
          quantity: parseInt(item.quantity),
          unitPrice: item.unitPrice,
          discount: item.discount || "0",
          total: ((parseFloat(item.quantity) * parseFloat(item.unitPrice)) - parseFloat(item.discount || "0")).toString(),
        };

        if (item.id) {
          // update
          const u = await fetch(`/api/quotes/${id}/items/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!u.ok) throw new Error("Failed to update quote item");
        } else {
          // create
          const c = await fetch(`/api/quotes/${id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!c.ok) throw new Error("Failed to create quote item");
        }
      }

      // Excluir itens removidos
      for (const existing of currentItems) {
        if (!submittedIds.has(existing.id)) {
          const d = await fetch(`/api/quotes/${id}/items/${existing.id}`, { method: "DELETE" });
          if (!d.ok && d.status !== 204) throw new Error("Failed to delete quote item");
        }
      }

      return { ok: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      {
        /* manter comportamento consistente com criação */
      }
      toast({
        title: "Orçamento atualizado",
        description: "Orçamento foi atualizado com sucesso.",
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

  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return res.json();
    },
  });

  // Carregar itens existentes ao editar
  const { data: existingItems } = useQuery({
    queryKey: ["/api/quotes", quote?.id, "items"],
    queryFn: async () => {
      const resp = await fetch(`/api/quotes/${quote!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens do orçamento");
      return resp.json();
    },
    enabled: !!quote?.id,
  });

  // Carregar itens da origem ao clonar
  const { data: cloneItems } = useQuery({
    queryKey: ["/api/quotes", cloneFrom?.id, "items", "clone"],
    queryFn: async () => {
      const resp = await fetch(`/api/quotes/${cloneFrom!.id}/items`);
      if (!resp.ok) throw new Error("Falha ao carregar itens do orçamento de origem");
      return resp.json();
    },
    enabled: !!cloneFrom?.id,
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
      paymentTerms: (quote as any)?.paymentTerms || "",
      seller: (quote as any)?.seller || "",
      taxTotal: (quote as any)?.taxTotal || "0",
      shipping: (quote as any)?.shipping || "0",
      projectId: (quote as any)?.projectId || projectId || "",
      notes: quote?.notes || "",
      items: [{ id: undefined, type: "PRODUCT", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" } as any],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Preencher automaticamente o cliente quando um projeto for selecionado
  useEffect(() => {
    if (selectedProject?.customerId && !quote?.customerId && !cloneFrom?.customerId) {
      form.setValue("customerId", selectedProject.customerId);
    }
  }, [selectedProject, quote?.customerId, cloneFrom?.customerId, form]);

  // Quando itens existentes carregarem, resetar os valores do formulário
  useEffect(() => {
    if (quote && existingItems) {
      const itemsForForm = existingItems.map((item: any) => ({
        id: item.id,
        type: item.productId ? "PRODUCT" : "SERVICE",
        productId: item.productId || "",
        serviceDescription: item.serviceDescription || "",
        quantity: String(item.quantity ?? "1"),
        unitPrice: String(item.unitPrice ?? "0"),
        discount: String(item.discount ?? "0"),
      }));

  form.reset({
        number: quote.number || "",
        customerId: quote.customerId || "",
        status: quote.status || "PENDING",
        validUntil: quote.validUntil ? new Date(quote.validUntil).toISOString().split("T")[0] : "",
        subtotal: String(quote.subtotal ?? "0"),
        discount: String(quote.discount ?? "0"),
        total: String(quote.total ?? "0"),
        notes: quote.notes || "",
        paymentTerms: (quote as any)?.paymentTerms || "",
        seller: (quote as any)?.seller || "",
        taxTotal: String((quote as any)?.taxTotal ?? "0"),
        shipping: String((quote as any)?.shipping ?? "0"),
        projectId: (quote as any)?.projectId || "",
        items: (itemsForForm.length > 0 ? itemsForForm : [{ id: undefined, type: "PRODUCT", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" }]) as any,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingItems, quote?.id]);

  // Quando estiver clonando e os itens de origem carregarem, preencher o formulário sem IDs
  useEffect(() => {
    if (cloneFrom && cloneItems) {
      const itemsForForm = (cloneItems as any[]).map((item: any) => ({
        id: undefined, // remover IDs para que sejam criados como novos
        type: item.productId ? "PRODUCT" : "SERVICE",
        productId: item.productId || "",
        serviceDescription: item.serviceDescription || "",
        quantity: String(item.quantity ?? "1"),
        unitPrice: String(item.unitPrice ?? "0"),
        discount: String(item.discount ?? "0"),
      }));

      form.reset({
        number: "",
        customerId: cloneFrom.customerId || "",
        status: "PENDING",
        validUntil: cloneFrom.validUntil ? new Date(cloneFrom.validUntil).toISOString().split("T")[0] : "",
        subtotal: String(cloneFrom.subtotal ?? "0"),
        discount: String(cloneFrom.discount ?? "0"),
        total: String(cloneFrom.total ?? "0"),
        notes: cloneFrom.notes || "",
        paymentTerms: (cloneFrom as any)?.paymentTerms || "",
        seller: (cloneFrom as any)?.seller || "",
        taxTotal: String((cloneFrom as any)?.taxTotal ?? "0"),
        shipping: String((cloneFrom as any)?.shipping ?? "0"),
        projectId: (cloneFrom as any)?.projectId || "",
  items: (itemsForForm.length > 0 ? itemsForForm : [{ id: undefined, type: "PRODUCT", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" }]) as any,
      });
      // Recalcular totais após reset
      setTimeout(() => calculateTotals(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloneItems, cloneFrom?.id]);

  // Prefill imediato ao iniciar clonagem (antes dos itens carregarem)
  useEffect(() => {
    if (cloneFrom && !quote) {
      form.reset({
        number: "",
        customerId: cloneFrom.customerId || "",
        status: "PENDING",
        validUntil: cloneFrom.validUntil ? new Date(cloneFrom.validUntil).toISOString().split("T")[0] : "",
        subtotal: String(cloneFrom.subtotal ?? "0"),
        discount: String(cloneFrom.discount ?? "0"),
        total: String(cloneFrom.total ?? "0"),
        notes: cloneFrom.notes || "",
        paymentTerms: (cloneFrom as any)?.paymentTerms || "",
        seller: (cloneFrom as any)?.seller || "",
        taxTotal: String((cloneFrom as any)?.taxTotal ?? "0"),
        shipping: String((cloneFrom as any)?.shipping ?? "0"),
        projectId: (cloneFrom as any)?.projectId || "",
        // mantém ao menos um item vazio até os itens carregarem
    items: [{ id: undefined, type: "PRODUCT", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" }] as any,
      });
      setTimeout(() => calculateTotals(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloneFrom?.id]);

  const calculateTotals = () => {
    const items = form.watch("items");
    const subtotal = items.reduce((sum, item) => {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const discount = parseFloat(item.discount ?? "0") || 0;
      return sum + (qty * price - discount);
    }, 0);

    const generalDiscount = parseFloat(form.watch("discount") ?? "0") || 0;
    const taxTotal = parseFloat(form.watch("taxTotal") ?? "0") || 0;
    const shipping = parseFloat(form.watch("shipping") ?? "0") || 0;
    const total = subtotal - generalDiscount + taxTotal + shipping;

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
        paymentTerms: data.paymentTerms || null,
        seller: data.seller || null,
        taxTotal: data.taxTotal || "0",
        shipping: data.shipping || "0",
        projectId: data.projectId || null,
        userId: null,
      };

      const quoteResponse = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
      });
      
      if (!quoteResponse.ok) throw new Error("Failed to create quote");
      const createdQuote = await quoteResponse.json();

      // Create quote items (support product or service)
      for (const item of data.items) {
        const itemData: any = {
          productId: item.type === "PRODUCT" ? (item.productId || null) : null,
          serviceDescription: item.type === "SERVICE" ? (item.serviceDescription || "") : null,
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
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
    if (quote?.id) {
      updateMutation.mutate({ id: quote.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addItem = () => {
    append({ id: undefined, type: "PRODUCT", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" });
  };

  const getProduct = (productId?: string) => {
    if (!Array.isArray(products)) return undefined;
    return (products as Product[]).find((p: Product) => p.id === productId);
  };

  const updateItemPrice = (index: number, productId: string) => {
    try {
      const product = getProduct(productId);
      if (product && product.salePrice) {
        form.setValue(`items.${index}.unitPrice`, product.salePrice);
        calculateTotals();
      }
    } catch (error) {
      console.error('Erro ao atualizar preço do item:', error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[80vh] overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="number">Número do Orçamento</Label>
          <Input
            id="number"
            {...form.register("number")}
            placeholder="Será gerado automaticamente"
          />
        </div>

        <div className="md:col-span-4">
          <Label htmlFor="customerId">Cliente *</Label>
          <Select
            value={form.watch("customerId")}
            onValueChange={(value) => form.setValue("customerId", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(customers) ? customers : [])
                .filter((customer: Customer) => customer.isActive || customer.id === quote?.customerId || customer.id === cloneFrom?.customerId)
                .map((customer: Customer) => (
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

        <div className="md:col-span-2">
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

        <div className="md:col-span-2">
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

        <div className="md:col-span-2">
          <Label htmlFor="seller">Vendedor</Label>
          <Input
            id="seller"
            {...form.register("seller")}
            placeholder="Nome do vendedor"
          />
        </div>

        <div className="md:col-span-4">
          <Label htmlFor="projectId">Projeto (opcional)</Label>
          <Select
            value={form.watch("projectId")}
            onValueChange={(value) => {
              form.setValue("projectId", value);
              // Preencher cliente automaticamente se o projeto tiver um cliente vinculado
              const project = projects?.find(p => p.id === value);
              if (project?.customerId && !quote?.customerId && !cloneFrom?.customerId) {
                form.setValue("customerId", project.customerId);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(projects) ? projects : []).map((project: Project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.code} - {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Itens do Orçamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Produtos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Produtos</h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setProductPickerSelected([]);
                    setProductPickerOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" /> Adicionar Produtos
                </Button>
              </div>
            </div>
            {(fields.map((f, i) => ({ f, i })).filter(({ i }) => form.watch(`items.${i}.type`) === "PRODUCT")).map(({ f, i }) => (
              <div key={f.id} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
                <div className="col-span-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.watch(`items.${i}.type`)}
                    onValueChange={(value) => {
                      form.setValue(`items.${i}.type`, value as any);
                      if (value === "SERVICE") {
                        form.setValue(`items.${i}.productId`, "");
                      } else {
                        form.setValue(`items.${i}.serviceDescription`, "");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUCT">Produto</SelectItem>
                      <SelectItem value="SERVICE">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.watch(`items.${i}.type`) === "PRODUCT" ? (
                  <div className="col-span-4">
                    <Label>Produto *</Label>
                    <ProductPicker
                      products={products}
                      value={form.watch(`items.${i}.productId`)}
                      onSelect={(p: any) => {
                        try {
                          const prod = Array.isArray(p) ? p[0] : p;
                          if (!prod) return;
                          form.setValue(`items.${i}.productId`, prod.id);
                          updateItemPrice(i, prod.id);
                        } catch (error) {
                          console.error('Erro ao selecionar produto:', error);
                        }
                      }}
                      onProductCreated={(newProduct) => {
                        try {
                          // Invalidar cache de produtos para incluir o novo produto
                          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                        } catch (error) {
                          console.error('Erro ao criar produto:', error);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="col-span-4">
                    <Label>Descrição do Serviço *</Label>
                    <Input
                      {...form.register(`items.${i}.serviceDescription`)}
                      placeholder="Descreva o serviço"
                      onChange={calculateTotals}
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label>Qtd *</Label>
                  <Input
                    {...form.register(`items.${i}.quantity`)}
                    type="number"
                    min="1"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Preço Un. *</Label>
                  <Input
                    {...form.register(`items.${i}.unitPrice`)}
                    type="number"
                    step="0.01"
                    min="0"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Desconto</Label>
                  <Input
                    {...form.register(`items.${i}.discount`)}
                    type="number"
                    step="0.01"
                    min="0"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-12 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    size="sm"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Serviços */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Serviços</h4>
              <Button
                type="button"
                size="sm"
                onClick={() => append({ id: undefined, type: "SERVICE", productId: "", serviceDescription: "", quantity: "1", unitPrice: "0", discount: "0" })}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar Serviço
              </Button>
            </div>
            {(fields.map((f, i) => ({ f, i })).filter(({ i }) => form.watch(`items.${i}.type`) === "SERVICE")).map(({ f, i }) => (
              <div key={f.id} className="grid grid-cols-12 gap-2 items-end p-4 border rounded-lg">
                <div className="col-span-2">
                  <Label>Tipo</Label>
                  <Select
                    value={form.watch(`items.${i}.type`)}
                    onValueChange={(value) => {
                      form.setValue(`items.${i}.type`, value as any);
                      if (value === "SERVICE") {
                        form.setValue(`items.${i}.productId`, "");
                      } else {
                        form.setValue(`items.${i}.serviceDescription`, "");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRODUCT">Produto</SelectItem>
                      <SelectItem value="SERVICE">Serviço</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.watch(`items.${i}.type`) === "PRODUCT" ? (
                  <div className="col-span-4">
                    <Label>Produto *</Label>
                    <ProductPicker
                      products={products}
                      value={form.watch(`items.${i}.productId`)}
                      onSelect={(p: any) => {
                        try {
                          const prod = Array.isArray(p) ? p[0] : p;
                          if (!prod) return;
                          form.setValue(`items.${i}.productId`, prod.id);
                          updateItemPrice(i, prod.id);
                        } catch (error) {
                          console.error('Erro ao selecionar produto:', error);
                        }
                      }}
                      onProductCreated={(newProduct) => {
                        try {
                          // Invalidar cache de produtos para incluir o novo produto
                          queryClient.invalidateQueries({ queryKey: ["/api/products"] });
                        } catch (error) {
                          console.error('Erro ao criar produto:', error);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="col-span-4">
                    <Label>Descrição do Serviço *</Label>
                    <Input
                      {...form.register(`items.${i}.serviceDescription`)}
                      placeholder="Descreva o serviço"
                      onChange={calculateTotals}
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <Label>Qtd *</Label>
                  <Input
                    {...form.register(`items.${i}.quantity`)}
                    type="number"
                    min="1"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Preço Un. *</Label>
                  <Input
                    {...form.register(`items.${i}.unitPrice`)}
                    type="number"
                    step="0.01"
                    min="0"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-2">
                  <Label>Desconto</Label>
                  <Input
                    {...form.register(`items.${i}.discount`)}
                    type="number"
                    step="0.01"
                    min="0"
                    onChange={calculateTotals}
                  />
                </div>

                <div className="col-span-12 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    size="sm"
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

        {/* Product picker modal used to add multiple products at once */}
        <ProductPicker
          products={products}
          multiple
          open={productPickerOpen}
          onOpenChange={(v) => setProductPickerOpen(v)}
          onSelect={(selected) => {
            try {
              const prods = Array.isArray(selected) ? selected as Product[] : [];
              // append each selected product as separate quote item
              for (const p of prods) {
                append({ id: undefined, type: "PRODUCT", productId: p.id, serviceDescription: "", quantity: "1", unitPrice: String((p as any).salePrice ?? "0"), discount: "0" });
              }
              // Recalculate totals
              setTimeout(() => calculateTotals(), 0);
            } catch (error) {
              console.error('Erro ao inserir produtos no orçamento:', error);
            }
          }}
          renderTrigger={false}
        />

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          {/* Totals */}
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

            <div className="flex justify-between items-center">
              <Label htmlFor="taxTotal">Impostos:</Label>
              <Input
                id="taxTotal"
                {...form.register("taxTotal")}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-32"
                onChange={calculateTotals}
              />
            </div>

            <div className="flex justify-between items-center">
              <Label htmlFor="shipping">Frete:</Label>
              <Input
                id="shipping"
                {...form.register("shipping")}
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

      {/* Payment Terms */}
      <div>
        <Label htmlFor="paymentTerms">Condição de Pagamento</Label>
        <Input
          id="paymentTerms"
          {...form.register("paymentTerms")}
          placeholder="Ex.: 30/60/90 dias, à vista, cartão, etc."
        />
      </div>

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

      {/* Anexos */}
      <div className="space-y-2">
        <Label>Anexos</Label>
        <div className="border rounded-lg p-4">
          <FileUpload
            onFilesChange={handleFilesChange}
            existingAttachments={attachments}
            onDeleteAttachment={handleDeleteAttachment}
            maxFiles={10}
            maxSizeMB={20}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Adicione imagens, documentos ou planilhas relevantes para este orçamento. Máx. 10 arquivos de 20MB cada.
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
          {createMutation.isPending || updateMutation.isPending
            ? "Salvando..."
            : quote ? "Salvar Alterações" : "Criar Orçamento"}
        </Button>
      </div>
    </form>
  );
}
