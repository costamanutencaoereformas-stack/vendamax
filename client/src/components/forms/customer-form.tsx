import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertCustomerSchema } from "@shared/schema";
import { documentValidationSchema, validateCPF, validateCNPJ } from "@/lib/validators";
import { getDocumentType } from "@/lib/formatters";
import type { Customer } from "@shared/schema";

const customerFormSchema = insertCustomerSchema.extend({
  document: documentValidationSchema,
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: () => void;
}

export default function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: customer?.name || "",
      document: customer?.document || "",
      documentType: customer?.documentType || "CPF",
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      city: customer?.city || "",
      state: customer?.state || "",
      zipCode: customer?.zipCode || "",
      isActive: customer?.isActive ?? true,
      classification: customer?.classification || "REGULAR",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerFormSchema>) => {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create customer");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Cliente cadastrado",
        description: "Cliente foi cadastrado com sucesso.",
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
    mutationFn: async (data: z.infer<typeof customerFormSchema>) => {
      const response = await fetch(`/api/customers/${customer!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update customer");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Cliente atualizado",
        description: "Cliente foi atualizado com sucesso.",
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

  const onSubmit = (data: z.infer<typeof customerFormSchema>) => {
    // Auto-detect document type
    const documentType = getDocumentType(data.document);
    const submitData = { ...data, documentType };
    
    if (customer) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const documentValue = form.watch("document");
  const detectedType = documentValue ? getDocumentType(documentValue) : null;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Nome/Razão Social *</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Digite o nome completo"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="document">CPF/CNPJ *</Label>
          <Input
            id="document"
            {...form.register("document")}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
          />
          {detectedType && (
            <p className="text-xs text-gray-500 mt-1">
              Tipo detectado: {detectedType}
            </p>
          )}
          {form.formState.errors.document && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.document.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            placeholder="cliente@exemplo.com"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            {...form.register("phone")}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="address">Endereço</Label>
          <Input
            id="address"
            {...form.register("address")}
            placeholder="Rua, número, complemento"
          />
        </div>

        <div>
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            {...form.register("city")}
            placeholder="São Paulo"
          />
        </div>

        <div>
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            {...form.register("state")}
            placeholder="SP"
            maxLength={2}
          />
        </div>

        <div>
          <Label htmlFor="zipCode">CEP</Label>
          <Input
            id="zipCode"
            {...form.register("zipCode")}
            placeholder="00000-000"
          />
        </div>

        <div>
          <Label htmlFor="classification">Classificação</Label>
          <Select
            value={form.watch("classification")}
            onValueChange={(value) => form.setValue("classification", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">Regular</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={form.watch("isActive")}
            onCheckedChange={(checked) => form.setValue("isActive", checked)}
          />
          <Label htmlFor="isActive">Cliente ativo</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : customer ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
