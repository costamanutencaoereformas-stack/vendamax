import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2 } from "lucide-react";
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
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);
  
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

  const searchCNPJMutation = useMutation({
    mutationFn: async (cnpj: string) => {
      // Remove formatting from CNPJ
      const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
      
      // Use a free Brazilian CNPJ API
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) {
        throw new Error("CNPJ não encontrado ou API temporariamente indisponível");
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Fill form with API data
      const companyName = data.razao_social || data.nome_fantasia || "";
      form.setValue("name", companyName);
      
      // Contact information
      if (data.email) {
        form.setValue("email", data.email);
      }
      
      // Phone formatting
      if (data.ddd_telefone_1 && data.telefone_1) {
        const formattedPhone = `(${data.ddd_telefone_1}) ${data.telefone_1.replace(/(\d{4,5})(\d{4})/, '$1-$2')}`;
        form.setValue("phone", formattedPhone);
      }
      
      // Address information
      let fullAddress = "";
      if (data.logradouro) {
        fullAddress = data.logradouro;
        if (data.numero) {
          fullAddress += `, ${data.numero}`;
        }
        if (data.complemento) {
          fullAddress += `, ${data.complemento}`;
        }
        if (data.bairro) {
          fullAddress += ` - ${data.bairro}`;
        }
        form.setValue("address", fullAddress);
      }
      
      form.setValue("city", data.municipio || "");
      form.setValue("state", data.uf || "");
      form.setValue("zipCode", data.cep || "");

      toast({
        title: "Dados importados com sucesso!",
        description: `Informações da empresa ${companyName} foram preenchidas automaticamente.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na consulta",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearchCNPJ = () => {
    const document = form.getValues("document");
    if (!document) {
      toast({
        title: "CNPJ obrigatório",
        description: "Digite um CNPJ para realizar a busca.",
        variant: "destructive",
      });
      return;
    }

    const cleanCNPJ = document.replace(/[^\d]/g, '');
    if (cleanCNPJ.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ deve ter 14 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (!validateCNPJ(cleanCNPJ)) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ digitado não é válido.",
        variant: "destructive",
      });
      return;
    }

    searchCNPJMutation.mutate(document);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const documentValue = form.watch("document");
  const detectedType = documentValue ? getDocumentType(documentValue) : null;
  const canSearchCNPJ = detectedType === "CNPJ" && !customer; // Only for new customers

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
          <div className="flex gap-2">
            <Input
              id="document"
              {...form.register("document")}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className="flex-1"
            />
            {canSearchCNPJ && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSearchCNPJ}
                disabled={searchCNPJMutation.isPending}
                className="px-3"
              >
                {searchCNPJMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
          {detectedType && (
            <p className="text-xs text-gray-500 mt-1">
              Tipo detectado: {detectedType}
              {canSearchCNPJ && (
                <span className="text-blue-600 ml-2">• Clique no ícone para buscar dados da empresa</span>
              )}
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
