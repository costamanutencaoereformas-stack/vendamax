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
import { validateCNPJ } from "@/lib/validators";
import type { Supplier } from "@shared/schema";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

const supplierFormSchema = insertSupplierSchema.extend({
  cnpj: z.string().min(1, "CNPJ é obrigatório").refine(validateCNPJ, "CNPJ inválido"),
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="name">Razão Social *</Label>
          <Input
            id="name"
            {...form.register("name")}
            placeholder="Digite a razão social"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="col-span-2">
          <Label htmlFor="tradeName">Nome Fantasia</Label>
          <Input
            id="tradeName"
            {...form.register("tradeName")}
            placeholder="Digite o nome fantasia"
          />
        </div>

        <div>
          <Label htmlFor="cnpj">CNPJ *</Label>
          <Input
            id="cnpj"
            {...form.register("cnpj")}
            placeholder="00.000.000/0000-00"
          />
          {form.formState.errors.cnpj && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.cnpj.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            placeholder="fornecedor@exemplo.com"
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

        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="zipCode">CEP</Label>
            <Input
              id="zipCode"
              {...form.register("zipCode")}
              placeholder="00000-000"
            />
            {form.formState.errors.zipCode && (
              <p className="text-sm text-red-600 mt-1">{form.formState.errors.zipCode.message}</p>
            )}
          </div>
          <Button type="button" onClick={handleSearchCEP} disabled={searchCEPMutation.isPending}>
            {searchCEPMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
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

        <div className="col-span-2">
          <Label htmlFor="paymentTerms">Condições de Pagamento</Label>
          <Textarea
            id="paymentTerms"
            {...form.register("paymentTerms")}
            placeholder="Ex: 30/60/90 dias, À vista, etc."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
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