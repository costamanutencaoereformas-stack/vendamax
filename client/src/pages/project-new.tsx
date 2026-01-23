import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput, createISODateString } from "@/lib/formatters";
import type { Customer } from "@shared/schema";

export default function ProjectNewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState<string>(formatDateForInput(new Date()));
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState<string>("");

  // Carregar clientes para seleção
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Falha ao carregar clientes");
      return res.json();
    },
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do projeto");
      const code = `PJT${Date.now().toString(36).toUpperCase()}`;
      const body = {
        code,
        name: name.trim(),
        description: description || undefined,
        customerId: customerId || undefined,
        status: "PLANNING",
        startDate: startDate ? createISODateString(startDate) : undefined,
      };
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao criar projeto");
      }
      return res.json() as Promise<{ id: string }>; 
    },
    onSuccess: (proj) => {
      navigate(`/projects/${proj.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar projeto", description: err?.message || String(err), variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 min-w-[700px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Novo Projeto</h1>
          <p className="text-sm text-muted-foreground">Defina os dados básicos e crie um novo projeto/obra.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projeto</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reforma Loja Centro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerId">Cliente (opcional)</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {(Array.isArray(customers) ? customers : [])
                    .filter((customer: Customer) => customer.isActive)
                    .map((customer: Customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição" />
            </div>

            <div className="pt-2 flex gap-2">
              <Button onClick={() => createProject.mutate()} disabled={createProject.isPending}>
                {createProject.isPending ? "Criando..." : "Criar Projeto"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/projects")}>Cancelar</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
