import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, ChevronLeft, ChevronRight, User, MapPin, Building, FileText } from "lucide-react";
import { getDocumentType } from "@/lib/formatters";
import type { Customer } from "@shared/schema";

const customerFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  document: z.string().min(1, "CPF/CNPJ é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  contact: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  responsible: z.string().optional(),
  segment: z.string().optional(),
  observations: z.string().optional(),
  isActive: z.boolean().default(true),
  classification: z.string().default("REGULAR"),
});

interface CustomerFormWizardProps {
  customer?: Customer;
  onSuccess: (customer?: Customer) => void;
}

const steps = [
  {
    id: 1,
    title: "Dados Básicos",
    description: "Informações principais do cliente",
    icon: User,
    fields: ["name", "document", "email"]
  },
  {
    id: 2,
    title: "Endereço",
    description: "Localização e contato",
    icon: MapPin,
    fields: ["phone", "contact", "address", "city", "state", "zipCode"]
  },
  {
    id: 3,
    title: "Classificação",
    description: "Segmento e responsável",
    icon: Building,
    fields: ["responsible", "segment", "classification", "isActive", "observations"]
  },
  {
    id: 4,
    title: "Observações",
    description: "Informações adicionais",
    icon: FileText,
    fields: ["observations"]
  }
];

export function CustomerFormWizard({ customer, onSuccess }: CustomerFormWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof customerFormSchema>>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: customer?.name || "",
      document: customer?.document || "",
      email: customer?.email || "",
      phone: customer?.phone || "",
      contact: customer?.contact || "",
      address: customer?.address || "",
      city: customer?.city || "",
      state: customer?.state || "",
      zipCode: customer?.zipCode || "",
      responsible: customer?.responsible || "",
      segment: customer?.segment || "",
      observations: customer?.observations || "",
      isActive: customer?.isActive ?? true,
      classification: customer?.classification || "REGULAR",
    },
  });

  // Fetch segments for dropdown
  const { data: segments = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: async () => {
      const response = await fetch("/api/segments");
      if (!response.ok) throw new Error("Failed to fetch segments");
      return response.json();
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
    onSuccess: (created: Customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Cliente cadastrado com sucesso!",
        description: "O cliente foi adicionado ao sistema.",
      });
      onSuccess(created);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customerFormSchema>) => {
      const response = await fetch(`/api/customers/${customer?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update customer");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Cliente atualizado com sucesso!",
        description: "As informações do cliente foram atualizadas.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar cliente",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const searchCNPJMutation = useMutation({
    mutationFn: async (cnpj: string) => {
      // Remove formatting from CNPJ
      const cleanCNPJ = cnpj.replace(/[^\d]/g, '');
      const response = await fetch(`/api/cnpj/${cleanCNPJ}`);
      if (!response.ok) throw new Error("Failed to fetch CNPJ data");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === "OK") {
        // Fill form with company data
        form.setValue("name", data.nome);
        form.setValue("email", data.email || "");
        form.setValue("phone", data.telefone || "");
        form.setValue("address", `${data.logradouro}, ${data.numero}`);
        form.setValue("city", data.municipio);
        form.setValue("state", data.uf);
        form.setValue("zipCode", data.cep);
        
        toast({
          title: "Dados da empresa encontrados!",
          description: "As informações foram preenchidas automaticamente.",
        });
      } else {
        toast({
          title: "CNPJ não encontrado",
          description: "Não foi possível encontrar dados para este CNPJ.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao buscar CNPJ",
        description: "Não foi possível consultar os dados da empresa.",
        variant: "destructive",
      });
    },
  });

  const handleSearchCNPJ = () => {
    const documentValue = form.getValues("document");
    if (documentValue && getDocumentType(documentValue) === "CNPJ") {
      searchCNPJMutation.mutate(documentValue);
    }
  };

  const onSubmit = (data: z.infer<typeof customerFormSchema>) => {
    const documentType = getDocumentType(data.document) || "CPF";
    const submitData = { ...data, documentType };
    
    if (customer) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const nextStep = async () => {
    console.log('nextStep called, currentStep:', currentStep);
    const currentStepData = steps.find(s => s.id === currentStep);
    console.log('currentStepData:', currentStepData);
    
    if (currentStepData) {
      console.log('Validating fields:', currentStepData.fields);
      const isValid = await form.trigger(currentStepData.fields as any);
      console.log('Validation result:', isValid);
      console.log('Form errors:', form.formState.errors);
      
      if (isValid) {
        const nextStepNumber = Math.min(currentStep + 1, steps.length);
        console.log('Moving to step:', nextStepNumber);
        setCurrentStep(nextStepNumber);
      } else {
        console.log('Validation failed, staying on current step');
      }
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const documentValue = form.watch("document");
  const detectedType = documentValue ? getDocumentType(documentValue) || "CPF" : "CPF";

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
              currentStep >= step.id 
                ? "bg-blue-500 border-blue-500 text-white" 
                : "border-gray-300 text-gray-400"
            }`}>
              <step.icon className="w-5 h-5" />
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                currentStep > step.id ? "bg-blue-500" : "bg-gray-300"
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Current Step Info */}
      <div className="text-center">
        <h3 className="text-lg font-semibold">{steps[currentStep - 1].title}</h3>
        <p className="text-sm text-gray-600">{steps[currentStep - 1].description}</p>
      </div>

      {/* Form Steps */}
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
        <Card>
          <CardContent className="p-6">
            {/* Step 1: Dados Básicos */}
            {currentStep === 1 && (
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
                    {detectedType === "CNPJ" && !customer && (
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
                      {detectedType === "CNPJ" && !customer && (
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
              </div>
            )}

            {/* Step 2: Endereço */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      {...form.register("phone")}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact">Contato</Label>
                    <Input
                      id="contact"
                      {...form.register("contact")}
                      placeholder="Nome da pessoa de contato"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    {...form.register("address")}
                    placeholder="Rua, número, complemento"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div>
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    {...form.register("zipCode")}
                    placeholder="00000-000"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Classificação */}
            {currentStep === 3 && (
              <div className="space-y-4">
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
                    value={form.watch("classification") || "REGULAR"}
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

                <div>
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    {...form.register("observations")}
                    placeholder="Adicione observações sobre o cliente, histórico, preferências, etc."
                    rows={4}
                    className="resize-none"
                    onKeyDown={(e) => {
                      e.stopPropagation();
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Observações */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea
                    id="observations"
                    {...form.register("observations")}
                    placeholder="Adicione observações sobre o cliente, histórico, preferências, etc."
                    rows={6}
                    className="resize-none"
                    onKeyDown={(e) => {
                      // Permite Enter dentro do textarea sem acionar o onKeyDown do form
                      e.stopPropagation();
                    }}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Informações adicionais que podem ser úteis para o atendimento
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          <div className="flex space-x-2">
            <Button type="button" variant="outline" onClick={() => onSuccess()}>
              Cancelar
            </Button>
            
            {currentStep < steps.length ? (
              <Button type="button" onClick={nextStep}>
                Próximo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  customer ? "Atualizar" : "Cadastrar"
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
