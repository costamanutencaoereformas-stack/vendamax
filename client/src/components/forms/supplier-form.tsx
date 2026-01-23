import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { insertSupplierSchema } from "@shared/schema";
import { validateCNPJ, validateCPF } from "@/lib/validators";
import type { Supplier } from "@shared/schema";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

const supplierFormSchema = insertSupplierSchema.extend({
  // Aceita CPF ou CNPJ no mesmo campo (armazenado em suppliers.cnpj)
  cnpj: z
    .string()
    .min(1, "Documento é obrigatório")
    .refine((v) => validateCNPJ(v) || validateCPF(v), "Documento inválido (CPF ou CNPJ)"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
});

interface SupplierFormProps {
  supplier?: Supplier;
  onSuccess?: () => void;
}

export default function SupplierForm({ supplier, onSuccess }: SupplierFormProps) {
  const { toast } = useToast();

  const form = useForm<z.infer<typeof supplierFormSchema>>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: supplier?.name || "",
      tradeName: supplier?.tradeName || "",
      cnpj: supplier?.cnpj || "",
      email: supplier?.email || "",
      phone: supplier?.phone || "",
      address: supplier?.address || "",
      city: supplier?.city || "",
      state: supplier?.state || "",
      zipCode: supplier?.zipCode || "",
      paymentTerms: supplier?.paymentTerms || "",
    },
  });

  const searchCNPJMutation = useMutation({
    mutationFn: async (cnpj: string) => {
      const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
      if (cleanCNPJ.length !== 14) {
        throw new Error("O CNPJ deve ter 14 dígitos.");
      }

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
      if (!response.ok) {
        throw new Error("CNPJ não encontrado ou API temporariamente indisponível");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      // Map BrasilAPI fields to our form
      const razao = data.razao_social || data.razaoSocial || '';
      const fantasia = data.nome_fantasia || data.nomeFantasia || '';
      const logradouro = data.logradouro || '';
      const numero = data.numero || '';
      const complemento = data.complemento || '';
      const bairro = data.bairro || '';
      const municipio = data.municipio || data.cidade || '';
      const uf = data.uf || data.estado || '';
      const cep = data.cep || '';
      const email = data.email || '';
      const telefone = data.ddd_telefone_1 || data.telefone || '';

      form.setValue("name", razao || form.getValues("name"));
      form.setValue("tradeName", fantasia || form.getValues("tradeName"));
      const addressParts = [
        [logradouro, numero].filter(Boolean).join(", "),
        complemento ? `${complemento}` : '',
        bairro ? `${bairro}` : ''
      ].filter(Boolean);
      if (addressParts.length) form.setValue("address", addressParts.join(" - "));
      if (municipio) form.setValue("city", municipio);
      if (uf) form.setValue("state", uf);
      if (cep) form.setValue("zipCode", cep);
      if (email) form.setValue("email", email);
      if (telefone) form.setValue("phone", telefone);

      toast({
        title: "CNPJ encontrado!",
        description: "Dados da empresa foram preenchidos automaticamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro na consulta do CNPJ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearchCNPJ = () => {
    const cnpj = form.getValues("cnpj");
    if (!cnpj) {
      toast({
        title: "CNPJ obrigatório",
        description: "Digite um CNPJ para realizar a busca.",
        variant: "destructive",
      });
      return;
    }

    const clean = cnpj.replace(/[^\d]/g, '');
    if (clean.length !== 14) {
      toast({
        title: "CNPJ inválido",
        description: "O CNPJ deve ter 14 dígitos.",
        variant: "destructive",
      });
      return;
    }

    searchCNPJMutation.mutate(cnpj);
  };

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof supplierFormSchema>) => {
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create supplier");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Fornecedor cadastrado",
        description: "Fornecedor foi cadastrado com sucesso.",
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
    mutationFn: async (data: z.infer<typeof supplierFormSchema>) => {
      const response = await fetch(`/api/suppliers/${supplier!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update supplier");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({
        title: "Fornecedor atualizado",
        description: "Fornecedor foi atualizado com sucesso.",
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

  const onSubmit = (data: z.infer<typeof supplierFormSchema>) => {
    if (supplier) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="name" className="md:w-48 shrink-0">Razão Social *</Label>
          <div className="flex-1">
            <Input id="name" {...form.register("name")} placeholder="Digite a razão social" />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="tradeName" className="md:w-48 shrink-0">Nome Fantasia</Label>
          <div className="flex-1">
            <Input id="tradeName" {...form.register("tradeName")} placeholder="Digite o nome fantasia" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="cnpj" className="md:w-48 shrink-0">CPF/CNPJ *</Label>
          <div className="flex-1 flex items-center gap-2">
            <Input id="cnpj" {...form.register("cnpj")} placeholder="00.000.000/0000-00 ou 000.000.000-00" />
            <Button type="button" onClick={handleSearchCNPJ} disabled={searchCNPJMutation.isPending}>
              {searchCNPJMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {form.formState.errors.cnpj && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.cnpj.message}</p>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="email" className="md:w-48 shrink-0">E-mail</Label>
          <div className="flex-1">
            <Input id="email" type="email" {...form.register("email")} placeholder="fornecedor@exemplo.com" />
            {form.formState.errors.email && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="phone" className="md:w-48 shrink-0">Telefone</Label>
          <div className="flex-1">
            <Input id="phone" {...form.register("phone")} placeholder="(11) 99999-9999" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="zipCode" className="md:w-48 shrink-0">CEP</Label>
          <div className="flex-1 flex items-center gap-2">
            <Input id="zipCode" {...form.register("zipCode")} placeholder="00000-000" />
            <Button type="button" onClick={handleSearchCEP} disabled={searchCEPMutation.isPending}>
              {searchCEPMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {form.formState.errors.zipCode && (
          <p className="text-sm text-red-600 ml-0 md:ml-48">{form.formState.errors.zipCode.message}</p>
        )}

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="address" className="md:w-48 shrink-0">Endereço</Label>
          <div className="flex-1">
            <Input id="address" {...form.register("address")} placeholder="Rua, número, complemento" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="city" className="md:w-48 shrink-0">Cidade</Label>
          <div className="flex-1">
            <Input id="city" {...form.register("city")} placeholder="São Paulo" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <Label htmlFor="state" className="md:w-48 shrink-0">Estado</Label>
          <div className="flex-1">
            <Input id="state" {...form.register("state")} placeholder="SP" maxLength={2} />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-start">
          <Label htmlFor="paymentTerms" className="md:w-48 shrink-0">Condições de Pagamento</Label>
          <div className="flex-1">
            <Textarea id="paymentTerms" {...form.register("paymentTerms")} placeholder="Ex: 30/60/90 dias, À vista, etc." rows={3} />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando..." : supplier ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}