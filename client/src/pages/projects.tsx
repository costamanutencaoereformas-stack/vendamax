import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Info, FolderKanban, Filter, Plus, TrendingUp, DollarSign, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate, createDateFromInput, formatDateForInput, createISODateString } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";

// Utility to get status label
function statusLabel(status: string) {
  switch (status) {
    case "PLANNING": return "Planejamento";
    case "IN_PROGRESS": return "Em andamento";
    case "ON_HOLD": return "Em espera";
    case "COMPLETED": return "Concluído";
    case "CANCELLED": return "Cancelado";
    default: return status;
  }
}

// Status color utility for badge
function getStatusColor(status: string) {
  switch (status) {
    case "PLANNING": return "bg-blue-200 text-blue-900 border border-blue-500";
    case "IN_PROGRESS": return "bg-indigo-400 text-indigo-900 border border-indigo-700";
    case "ON_HOLD": return "bg-yellow-200 text-yellow-900 border border-yellow-500";
    case "COMPLETED": return "bg-green-200 text-green-900 border border-green-500";
    case "CANCELLED": return "bg-red-200 text-red-900 border border-red-500";
    default: return "bg-gray-100 text-gray-700";
  }
}

interface Project {
  id: string;
  code: string;
  name: string;
  customerId: string | null;
  customerName?: string | null;
  quoteId?: string | null;
  saleId?: string | null;
  status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  startDate: string | null;
  endDate: string | null;
  expectedEndDate: string | null;
  totalCost: number | null;
  totalRevenue: number | null;
  createdAt: string;
}

async function fetchProjects(): Promise<Project[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Falha ao carregar projetos (${res.status})`);
  }
  return res.json();
}

export default function ProjectsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<Project[]>({ queryKey: ["projects"], queryFn: fetchProjects, retry: 1 });

  // react-query onError handled via options in the component usage (toast handled below)

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [customerFilter, setCustomerFilter] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");

  // Read query params: fromQuote, fromSale
  const linkParams = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const fromQuote = sp.get("fromQuote");
    const fromSale = sp.get("fromSale");
    return { fromQuote, fromSale };
  }, [typeof window !== 'undefined' ? window.location.search : '']);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!data) return [];
    
    const matched = data.filter((project) => {
      // Search term filter (code or name)
      if (searchTerm && !project.code.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !project.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Status filter
      if (statusFilter && statusFilter !== "ALL" && project.status !== statusFilter) {
        return false;
      }
      
      // Customer filter
      if (customerFilter && !(project.customerName || '').toLowerCase().includes(customerFilter.toLowerCase())) {
        return false;
      }
      
      // Date filters
      if (startDateFilter && project.startDate) {
        const projectStart = new Date(project.startDate);
        const filterStart = createDateFromInput(startDateFilter);
        if (projectStart < filterStart) return false;
      }
      
      if (endDateFilter && project.expectedEndDate) {
        const projectEnd = new Date(project.expectedEndDate);
        const filterEnd = createDateFromInput(endDateFilter);
        // include entire filter end day
        filterEnd.setHours(23, 59, 59, 999);
        if (projectEnd > filterEnd) return false;
      }
      
      return true;
    });

    // Sort by status priority: IN_PROGRESS, PLANNING, ON_HOLD, COMPLETED, CANCELLED
    const priority: Record<Project['status'], number> = {
      IN_PROGRESS: 0,
      PLANNING: 1,
      ON_HOLD: 2,
      COMPLETED: 3,
      CANCELLED: 4,
    };

    matched.sort((a, b) => {
      const pa = priority[a.status] ?? 99;
      const pb = priority[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      // fallback: by startDate (earlier first), then by code
      const da = a.startDate ? new Date(a.startDate).getTime() : 0;
      const db = b.startDate ? new Date(b.startDate).getTime() : 0;
      if (da !== db) return da - db;
      return a.code.localeCompare(b.code);
    });

    return matched;
  }, [data, searchTerm, statusFilter, customerFilter, startDateFilter, endDateFilter]);

  // Get unique customers for filter dropdown
  const uniqueCustomers = useMemo(() => {
    if (!data) return [];
    const customers = data
      .map(p => p.customerName)
      .filter((name): name is string => !!name)
      .filter((name, index, arr) => arr.indexOf(name) === index)
      .sort();
    return customers;
  }, [data]);

  const createLinkedProject = useMutation({
    mutationFn: async (payload: { quoteId?: string; saleId?: string }) => {
      const code = `PJT${Date.now().toString(36).toUpperCase()}`;
      const body: any = {
        code,
        name: payload.quoteId ? `Projeto do Orçamento ${payload.quoteId}` : payload.saleId ? `Projeto da Venda ${payload.saleId}` : `Novo Projeto`,
        status: "PLANNING",
        // Use date-only converted safely to ISO to avoid timezone shifting
        startDate: createISODateString(formatDateForInput(new Date())),
        ...(payload.quoteId ? { quoteId: payload.quoteId } : {}),
        ...(payload.saleId ? { saleId: payload.saleId } : {}),
      };
      const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao criar projeto");
      }
      return res.json() as Promise<Project>;
    },
    onSuccess: (proj) => {
      // Clear search params and go to project
      navigate(`/projects/${proj.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar projeto", description: err?.message || String(err), variant: "destructive" });
    }
  });

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen">
      {/* Linked Project Banner */}
      {(linkParams.fromQuote || linkParams.fromSale) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-md flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <div>
              {linkParams.fromQuote && <span>Vincular projeto ao orçamento <span className="font-semibold">{linkParams.fromQuote}</span>?</span>}
              {linkParams.fromSale && !linkParams.fromQuote && <span>Vincular projeto à venda <span className="font-semibold">{linkParams.fromSale}</span>?</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={createLinkedProject.isPending}
              onClick={() =>
                createLinkedProject.mutate({
                  quoteId: linkParams.fromQuote || undefined,
                  saleId: !linkParams.fromQuote ? (linkParams.fromSale || undefined) : undefined,
                })
              }
            >
              {createLinkedProject.isPending ? "Criando..." : "Criar projeto vinculado"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/projects")}
            >
              Ignorar
            </Button>
          </div>
        </div>
      )}

      {/* Filters Card */}
      <Card className="shadow-lg border-indigo-100">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-indigo-800">
              <Filter className="h-5 w-5" />
              Filtros e Busca
            </CardTitle>
            <Button onClick={() => navigate("/projects/new")} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Novo Projeto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="search" className="text-xs font-medium">Buscar</Label>
              <Input
                id="search"
                placeholder="Código ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status-filter" className="text-xs font-medium">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PLANNING">Planejamento</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                  <SelectItem value="ON_HOLD">Em espera</SelectItem>
                  <SelectItem value="COMPLETED">Concluído</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="customer-filter" className="text-xs font-medium">Cliente</Label>
              <Input
                id="customer-filter"
                placeholder="Nome do cliente..."
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-date" className="text-xs font-medium">Início (De)</Label>
              <Input
                id="start-date"
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-date" className="text-xs font-medium">Previsão (Até)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
            </div>
          </div>
          {(searchTerm || statusFilter !== "ALL" || customerFilter || startDateFilter || endDateFilter) && (
            <div className="mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setCustomerFilter("");
                  setStartDateFilter("");
                  setEndDateFilter("");
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-indigo-700">Total</p>
                <div className="w-8 h-8 bg-indigo-200 rounded-lg flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-indigo-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-900">{filteredProjects.length}</p>
                <p className="text-xs text-indigo-600">projetos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-700">Em Andamento</p>
                <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-900">
                  {filteredProjects.filter(p => p.status === 'IN_PROGRESS').length}
                </p>
                <p className="text-xs text-blue-600">ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-green-700">Receita Total</p>
                <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(filteredProjects.reduce((sum, p) => sum + (p.totalRevenue ?? 0), 0))}
                </p>
                <p className="text-xs text-green-600">receita</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-rose-50 border-pink-200 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-pink-700">Lucro Total</p>
                <div className="w-8 h-8 bg-pink-200 rounded-lg flex items-center justify-center">
                  <Target className="h-4 w-4 text-pink-700" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-pink-900">
                  {formatCurrency(
                    filteredProjects.reduce((sum, p) => sum + ((p.totalRevenue ?? 0) - (p.totalCost ?? 0)), 0)
                  )}
                </p>
                <p className="text-xs text-pink-600">lucro</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table Card */}
      <Card className="shadow-lg border-indigo-100">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
          <CardTitle className="flex items-center gap-2 text-indigo-800">
            <FolderKanban className="h-5 w-5" />
            Lista de Projetos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-indigo-50">
                  <TableHead className="font-semibold">Código</TableHead>
                  <TableHead className="font-semibold">Nome</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Início</TableHead>
                  <TableHead className="font-semibold">Previsão</TableHead>
                  <TableHead className="text-right font-semibold">Receita</TableHead>
                  <TableHead className="text-right font-semibold">Custo</TableHead>
                  <TableHead className="text-right font-semibold">Lucro</TableHead>
                  <TableHead className="font-semibold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                        <span>Carregando projetos...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filteredProjects.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                      <div className="flex flex-col items-center gap-2">
                        <FolderKanban className="h-12 w-12 text-gray-300" />
                        <p className="font-medium">{(data ?? []).length === 0 ? "Nenhum projeto encontrado" : "Nenhum projeto corresponde aos filtros"}</p>
                        {(data ?? []).length === 0 && (
                          <Button onClick={() => navigate("/projects/new")} size="sm" variant="outline">
                            <Plus className="h-4 w-4 mr-2" />
                            Criar Primeiro Projeto
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {filteredProjects.map((p) => {
                  const cost = p.totalCost ?? 0;
                  const revenue = p.totalRevenue ?? 0;
                  const profit = revenue - cost;
                  const rowStatusClasses: Record<Project['status'], string> = {
                    PLANNING: 'bg-blue-50/60',
                    IN_PROGRESS: 'bg-indigo-100/60',
                    ON_HOLD: 'bg-yellow-50/60',
                    COMPLETED: 'bg-green-50/60',
                    CANCELLED: 'bg-red-50/60',
                  };
                  const badgeBorderClasses: Record<Project['status'], string> = {
                    PLANNING: 'border border-blue-400',
                    IN_PROGRESS: 'border border-indigo-600',
                    ON_HOLD: 'border border-yellow-400',
                    COMPLETED: 'border border-green-500',
                    CANCELLED: 'border border-red-500',
                  };
                  // Overdue: expectedEndDate < today and not completed/cancelled
                  const overdue = p.expectedEndDate && !['COMPLETED','CANCELLED'].includes(p.status) && new Date(p.expectedEndDate) < new Date();

                  return (
                    <TableRow key={p.id} className={`group hover:bg-indigo-50/60 transition-colors ${rowStatusClasses[p.status] || ''}`}>
                      <TableCell className="font-medium">{p.code}</TableCell>
                      <TableCell className="max-w-xs truncate" title={p.name}>{p.name}</TableCell>
                      <TableCell className="max-w-xs truncate" title={p.customerName ?? undefined}>{p.customerName ?? "-"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm ${getStatusColor(p.status)} ${badgeBorderClasses[p.status]}`}>{statusLabel(p.status)}</span>
                      </TableCell>
                      <TableCell>{p.startDate ? formatDate(p.startDate) : "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {p.expectedEndDate ? formatDate(p.expectedEndDate) : "-"}
                          {overdue && (
                            <span title="Projeto atrasado">
                              <Info className="h-4 w-4 text-red-500 inline ml-1" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                      <TableCell className={`text-right font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(profit)}</TableCell>
                      <TableCell className="pl-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 opacity-70 group-hover:opacity-100"><MoreHorizontal className="h-5 w-5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/projects/${p.id}`)}>
                              Ver detalhes
                            </DropdownMenuItem>
                            {/* <DropdownMenuItem onClick={() => ...}>Editar</DropdownMenuItem> */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
