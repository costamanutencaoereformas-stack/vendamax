import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  stateRegistration: z.string().optional(),
  stateRegistrationExempt: z.boolean().optional(),
});

interface CustomerFormProps {
  customer?: Customer;
  onSuccess?: () => void;
}

export default function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const { toast } = useToast();
  const [isSearchingCNPJ, setIsSearchingCNPJ] = useState(false);

  // Query para buscar segmentos disponíveis
  const { data: segments = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: async () => {
      const response = await fetch("/api/segments");
      if (!response.ok) throw new Error("Erro ao carregar segmentos");
      return response.json();
    },
  });
  
  const form = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: customer?.name || "",
      document: customer?.document || "",
      documentType: customer?.documentType || "CPF",
      stateRegistration: customer?.stateRegistration || "",
      stateRegistrationExempt: customer?.stateRegistrationExempt ?? false,
      email: customer?.email || "",
      phone: customer?.phone || "",
      address: customer?.address || "",
      city: customer?.city || "",
      state: customer?.state || "",
      zipCode: customer?.zipCode || "",
      responsible: customer?.responsible || "",
      segment: customer?.segment || "",
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
    const documentType = getDocumentType(data.document) || "CPF";
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
      
      // Use a free Brazilian CNPJ API with proper headers
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });
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
      
      // Phone formatting - BrasilAPI returns phone with DDD together
      if (data.ddd_telefone_1) {
        const phoneWithDDD = data.ddd_telefone_1.toString();
        if (phoneWithDDD.length >= 10) {
          // Extract DDD (first 2 digits) and phone number (remaining digits)
          const ddd = phoneWithDDD.substring(0, 2);
          const phoneNumber = phoneWithDDD.substring(2);
          const formattedPhone = `(${ddd}) ${phoneNumber.replace(/(\d{4,5})(\d{4})/, '$1-$2')}`;
          form.setValue("phone", formattedPhone);
        }
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

  const searchCEPMutation = useMutation({
    mutationFn: async (cep: string) => {
      // Remove formatting from CEP
      const cleanCEP = cep.replace(/[^\d]/g, '');
      
      // Use ViaCEP API (free Brazilian CEP service)
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      if (!response.ok) {
        throw new Error("CEP não encontrado ou API temporariamente indisponível");
      }
      const data = await response.json();
      if (data.erro) {
        throw new Error("CEP não encontrado");
      }
      return data;
    },
    onSuccess: (data) => {
      // Fill form with API data
      form.setValue("address", `${data.logradouro || ''} - ${data.bairro || ''}`);
      form.setValue("city", data.localidade || "");
      form.setValue("state", data.uf || "");
      
      toast({
        title: "CEP encontrado!",
        description: `Endereço preenchido automaticamente: ${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na consulta do CEP",
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

  const handleSearchCEP = () => {
    const zipCode = form.getValues("zipCode");
    if (!zipCode) {
      toast({
        title: "CEP obrigatório",
        description: "Digite um CEP para realizar a busca.",
        variant: "destructive",
      });
      return;
    }

    const cleanCEP = zipCode.replace(/[^\d]/g, '');
    if (cleanCEP.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "O CEP deve ter 8 dígitos.",
        variant: "destructive",
      });
      return;
    }

    searchCEPMutation.mutate(zipCode);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const documentValue = form.watch("document");
  const detectedType = documentValue ? getDocumentType(documentValue) || "CPF" : "CPF";
  const canSearchCNPJ = detectedType === "CNPJ" && !customer; // Only for new customers

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const tag = (e.target as HTMLElement).tagName;
          if (tag !== 'TEXTAREA') {
            e.preventDefault();
          }
        }
      }}
      className="space-y-4"
    >
      <div className="space-y-4">
        <div>
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

        <div>
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

        {/* Debug: Show detected type */}
        {documentValue && (
          <p className="text-xs text-gray-400">Debug: Detected type = {detectedType}</p>
        )}
        
        {detectedType === "CNPJ" && (
          <div className="space-y-4 border border-blue-200 p-4 rounded-lg bg-blue-50">
            <h4 className="text-sm font-medium text-blue-900">Dados CNPJ</h4>
            <div className="flex items-center space-x-2">
              <Switch
                id="stateRegistrationExempt"
                checked={form.watch("stateRegistrationExempt") ?? false}
                onCheckedChange={(checked) => {
                  form.setValue("stateRegistrationExempt", checked);
                  if (checked) {
                    form.setValue("stateRegistration", "");
                  }
                }}
              />
              <Label htmlFor="stateRegistrationExempt">Isento de Inscrição Estadual</Label>
            </div>
            
            {!form.watch("stateRegistrationExempt") && (
              <div>
                <Label htmlFor="stateRegistration">Inscrição Estadual</Label>
                <Input
                  id="stateRegistration"
                  {...form.register("stateRegistration")}
                  placeholder="000.000.000.000"
                />
                {form.formState.errors.stateRegistration && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.stateRegistration.message}</p>
                )}
              </div>
            )}
          </div>
        )}

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

        <div>
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
          <div className="flex gap-2">
            <Input
              id="zipCode"
              {...form.register("zipCode")}
              placeholder="00000-000"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSearchCEP}
              disabled={searchCEPMutation.isPending}
              className="px-3"
            >
              {searchCEPMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            • Clique no ícone para buscar endereço automaticamente
          </p>
        </div>

        <div>
          <Label htmlFor="responsible">Responsável</Label>
          <Input
            id="responsible"
            {...form.register("responsible")}
            placeholder="Nome do responsável pelo cliente"
          />
        </div>

        <div>
          <Label htmlFor="segment">Segmento</Label>
          <Select
            value={form.watch("segment") || undefined}
            onValueChange={(value) => form.setValue("segment", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um segmento" />
            </SelectTrigger>
            <SelectContent>
              {segments.map((segment: any) => (
                <SelectItem key={segment.id} value={segment.name}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="classification">Classificação</Label>
          <Select
            value={form.watch("classification") || undefined}
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

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={form.watch("isActive") ?? true}
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
