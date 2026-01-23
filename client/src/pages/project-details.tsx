import React from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, createDateFromInput, formatDateForInput, createISODateString } from "@/lib/formatters";

// Minimal types used by this page to satisfy TypeScript. These mirror the
// shapes returned by the backend but are intentionally small to avoid
// cascading type errors. We can expand them later.
type Project = {
  id: string;
  code?: string;
  name?: string;
  description?: string | null;
  totalCost?: number;
  totalRevenue?: number;
  quoteId?: string | null;
  saleId?: string | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
  endDate?: string | null;
  status?: string;
  customerName?: string | null;
};

type Task = { id: string; title?: string; description?: string | null; assignee?: string | null; startDate?: string | null; endDate?: string | null; status?: string };

type Expense = { id: string; description?: string; category?: string | null; date: string; amount: number; status?: string };

type Document = { id: string; title?: string; url: string; createdAt?: string | null };

type Note = { id: string; content: string; createdAt?: string | null };

type ProjectSummary = { totalPlanned?: number; quoteTotal?: number; tasksCost?: number; expensesTotal?: number; totalActual?: number; remaining?: number };

// Small helpers to call the API. These were referenced in the component but
// missing; implement them here so the file compiles. They return parsed JSON
// or throw on non-OK responses.
async function fetchProject(projectId: string): Promise<Project> {
  const res = await fetch(`/api/projects/${projectId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchTasks(projectId: string): Promise<Task[]> {
  const res = await fetch(`/api/projects/${projectId}/tasks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchExpenses(projectId: string): Promise<Expense[]> {
  const res = await fetch(`/api/projects/${projectId}/expenses`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchDocuments(projectId: string): Promise<Document[]> {
  const res = await fetch(`/api/projects/${projectId}/documents`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();

  async function fetchProjectNotes(projectId: string) {
    if (!projectId) return [] as any[];
    const res = await fetch(`/api/projects/${projectId}/observations`);
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao carregar anotações');
    }
    return res.json();
  }
  async function createProjectNote(projectId: string, content: string) {
    if (!projectId) throw new Error('Missing projectId');
    const res = await fetch(`/api/projects/${projectId}/observations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao criar anotação');
    }
    return res.json();
  }

  const { data: projectNotes, refetch: refetchNotes, isLoading: loadingNotes } = useQuery<Note[]>({
    queryKey: ["project", id, "notes"],
    queryFn: () => fetchProjectNotes(id!),
    enabled: !!id,
  });
  const [newNote, setNewNote] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });

  const allTasks = useQuery({
    queryKey: ["project", id, "tasks"],
    queryFn: () => fetchTasks(id!),
    enabled: !!id,
  });

  // Normalize legacy task statuses to current UI set
  const normalizeTaskStatus = (s?: string) => {
    const v = (s || '').toUpperCase();
    if (v === 'TODO') return 'PENDING';
    if (v === 'DOING') return 'IN_PROGRESS';
    if (v === 'BLOCKED') return 'IN_PROGRESS';
    if (v === 'CANCELED') return 'CANCELLED';
    return v || 'PENDING';
  };
  const tasksForRender = (allTasks.data || []).map((t: any) => ({
    ...t,
    status: normalizeTaskStatus(t.status),
  }));

  const { data: expenses } = useQuery({
    queryKey: ["project", id, "expenses"],
    queryFn: () => fetchExpenses(id!),
    enabled: !!id,
  });

  // Expense filters
  const [filterCategory, setFilterCategory] = React.useState<string>("ALL");
  const [filterStart, setFilterStart] = React.useState<string>("");
  const [filterEnd, setFilterEnd] = React.useState<string>("");
  const [filterQuery, setFilterQuery] = React.useState<string>("");

  const filteredExpenses = React.useMemo(() => {
    const list = expenses || [];
    const start = filterStart ? createDateFromInput(filterStart) : null;
    const end = filterEnd ? createDateFromInput(filterEnd) : null;
    const q = (filterQuery || '').trim().toLowerCase();
    return list.filter((e) => {
      // Category filter
  if (filterCategory && filterCategory !== 'ALL' && !(e.category || '').toLowerCase().includes(filterCategory.toLowerCase())) return false;

      // Date range
      const d = new Date(e.date);
      if (start && d < start) return false;
      if (end && d > end) return false;

      // Global text/number search across description, category, date, amount, status
      if (q) {
        const fields = [
          (e.description || '').toString(),
          (e.category || '').toString(),
          formatDate(e.date || '').toString(),
          (e.amount ?? '').toString(),
          (e.status || '').toString(),
        ].map(s => s.toLowerCase());

        const matched = fields.some(f => f.includes(q));
        if (!matched) return false;
      }

      return true;
    });
  }, [expenses, filterCategory, filterStart, filterEnd, filterQuery]);

  const { data: summary } = useQuery<ProjectSummary>({
    queryKey: ["project", id, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/summary`);
      if (!res.ok) throw new Error("Falha ao carregar resumo do projeto");
      return res.json();
    },
    enabled: !!id,
  });

  const cost = (project?.totalCost ?? 0);
  const revenue = (project?.totalRevenue ?? 0);
  const profit = revenue - cost;

  // Dialog state
  const [editOpen, setEditOpen] = React.useState(false);
  const [linkQuoteOpen, setLinkQuoteOpen] = React.useState(false);
  const [linkSaleOpen, setLinkSaleOpen] = React.useState(false);

  // Edit form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState<string>("");
  const [expectedEndDate, setExpectedEndDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  // Edit task state
  const [editTaskOpen, setEditTaskOpen] = React.useState(false);
  const [editTaskId, setEditTaskId] = React.useState("");
  const [editTaskTitle, setEditTaskTitle] = React.useState("");
  const [editTaskAssignee, setEditTaskAssignee] = React.useState("");
  const [editTaskStartDate, setEditTaskStartDate] = React.useState("");
  const [editTaskEndDate, setEditTaskEndDate] = React.useState("");
  const [editTaskStatus, setEditTaskStatus] = React.useState("");
  // Task details dialog state
  const [taskDetailsOpen, setTaskDetailsOpen] = React.useState(false);
  const [taskDetails, setTaskDetails] = React.useState<Task | null>(null);

  React.useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setStartDate(project.startDate ? project.startDate.slice(0, 10) : "");
      setExpectedEndDate(project.expectedEndDate ? project.expectedEndDate.slice(0, 10) : "");
      setEndDate(project.endDate ? project.endDate.slice(0, 10) : "");
    }
  }, [project]);

  // Link inputs
  const [quoteIdInput, setQuoteIdInput] = React.useState("");
  const [saleIdInput, setSaleIdInput] = React.useState("");

  const updateProject = useMutation({
    mutationFn: async (payload: Partial<Project>) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Falha ao atualizar projeto");
      }
      return res.json() as Promise<Project>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id, "summary"] });
      toast({ title: "Projeto atualizado" });
      setEditOpen(false);
      setLinkQuoteOpen(false);
      setLinkSaleOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || String(err), variant: "destructive" });
    },
  });

  const finalizeProject = () => {
    updateProject.mutate({ status: "COMPLETED", endDate: new Date().toISOString() } as any);
  };

  const qc = useQueryClient();

  // UI -> Backend status mapping
  const toBackendStatus = (s: string) => {
    switch (s) {
      case 'PENDING': return 'TODO';
      case 'IN_PROGRESS': return 'DOING';
      case 'DONE': return 'DONE';
      case 'CANCELLED': return 'CANCELLED';
      default: return 'TODO';
    }
  };

  const createTask = async (payload: any) => {
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Falha ao criar tarefa');
    return res.json();
  };

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "tasks"] });
      toast({ title: 'Tarefa criada com sucesso' });
      // Clear modal inputs
      setNewTaskTitle("");
      setNewTaskAssignee("");
      setNewTaskStartDate("");
      setNewTaskEndDate("");
      setNewTaskStatus("PENDING");
      setAddTaskOpen(false);
    },
    onError: (err: any) => toast({ title: 'Erro ao criar tarefa', description: err?.message || String(err), variant: 'destructive' })
  });

  const updateTask = async (taskId: string, payload: any) => {
    const res = await fetch(`/api/projects/${id}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Falha ao atualizar tarefa');
    return res.json();
  };

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: any }) => updateTask(taskId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "tasks"] });
      setEditTaskOpen(false);
      toast({ title: 'Tarefa atualizada com sucesso!' });
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar tarefa', variant: 'destructive' });
    },
  });

  // Expenses mutations
  const createExpense = async (payload: any) => {
    const res = await fetch(`/api/projects/${id}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao criar despesa');
    }
    return res.json();
  };

  const deleteExpense = async (expenseId: string) => {
    const res = await fetch(`/api/projects/${id}/expenses/${expenseId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const t = await res.text();
      throw new Error(t || 'Falha ao excluir despesa');
    }
    return true;
  };

  const updateExpense = async (expenseId: string, payload: any) => {
    const res = await fetch(`/api/projects/${id}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao atualizar despesa');
    }
    return res.json();
  };
  
  const markExpenseCompleted = async (expenseId: string) => {
    const res = await fetch(`/api/projects/${id}/expenses/${expenseId}/mark-completed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao marcar despesa como concluída');
    }
    return res.json();
  };

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "expenses"] });
      qc.invalidateQueries({ queryKey: ["project", id, "summary"] });
      toast({ title: 'Despesa lançada com sucesso' });
      // Clear modal inputs
      setNewExpenseDesc("");
      setNewExpenseCat("");
      setNewExpenseDate("");
      setNewExpenseAmount("");
      setAddExpenseOpen(false);
    },
    onError: (err: any) => toast({ title: 'Erro ao lançar despesa', description: err?.message || String(err), variant: 'destructive' })
  });

  // Documents (Anexos)
  const { data: documents } = useQuery({
    queryKey: ["project", id, "documents"],
    queryFn: () => fetchDocuments(id!),
    enabled: !!id,
  });

  const uploadDocument = async (file: File, caption?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    const res = await fetch(`/api/projects/${id}/documents`, { method: 'POST', body: form });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || 'Falha ao enviar anexo');
    }
    return res.json();
  };

  const deleteDocument = async (docId: string) => {
    const res = await fetch(`/api/projects/${id}/documents/${docId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const t = await res.text();
      throw new Error(t || 'Falha ao excluir anexo');
    }
    return true;
  };

  const uploadDocMutation = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption?: string }) => uploadDocument(file, caption),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "documents"] });
      toast({ title: 'Anexo enviado' });
    },
    onError: (err: any) => toast({ title: 'Erro ao enviar anexo', description: err?.message || String(err), variant: 'destructive' })
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => deleteDocument(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "documents"] });
      toast({ title: 'Anexo excluído' });
    },
    onError: (err: any) => toast({ title: 'Erro ao excluir anexo', description: err?.message || String(err), variant: 'destructive' })
  });

  // Attachments upload UI state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileCaption, setFileCaption] = React.useState<string>("");
  const [storageOption, setStorageOption] = React.useState<'local'|'drive'>('local');
  const [driveTokensInput, setDriveTokensInput] = React.useState<string>('');
  const [isUploadingToDrive, setIsUploadingToDrive] = React.useState(false);

  const uploadToDrive = async (file: File, caption?: string) => {
    if (!file) throw new Error('No file');
    setIsUploadingToDrive(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tokens', driveTokensInput || '');
      form.append('filename', caption || file.name);
      const res = await fetch('/api/_drive/upload', { method: 'POST', body: form });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Drive upload failed');
      }
      const json = await res.json();
      const uploaded = json.uploaded || json;
      const driveUrl = uploaded.webContentLink || uploaded.webViewLink || (uploaded.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : '');

      // Persist remote doc record
      const r2 = await fetch(`/api/projects/${id}/documents/remote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: caption || uploaded.name || file.name, url: driveUrl, type: uploaded.mimeType || file.type }),
      });
      if (!r2.ok) {
        const t = await r2.text();
        throw new Error(t || 'Failed to save remote document');
      }
      qc.invalidateQueries({ queryKey: ["project", id, "documents"] });
      toast({ title: 'Anexo enviado para Google Drive' });
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "expenses"] });
      qc.invalidateQueries({ queryKey: ["project", id, "summary"] });
      toast({ title: 'Despesa excluída' });
    },
    onError: (err: any) => toast({ title: 'Erro ao excluir despesa', description: err?.message || String(err), variant: 'destructive' })
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (args: { id: string; payload: any }) => updateExpense(args.id, args.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "expenses"] });
      qc.invalidateQueries({ queryKey: ["project", id, "summary"] });
      toast({ title: 'Despesa atualizada' });
      setEditExpOpen(false);
    },
    onError: (err: any) => toast({ title: 'Erro ao atualizar despesa', description: err?.message || String(err), variant: 'destructive' })
  });
  
  const markExpenseCompletedMutation = useMutation({
    mutationFn: (expenseId: string) => markExpenseCompleted(expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id, "expenses"] });
      qc.invalidateQueries({ queryKey: ["project", id, "summary"] });
      toast({ title: 'Despesa marcada como concluída' });
    },
    onError: (err: any) => toast({ title: 'Erro ao marcar despesa como concluída', description: err?.message || String(err), variant: 'destructive' })
  });

  // Edit expense dialog state
  const [editExpOpen, setEditExpOpen] = React.useState(false);
  const [editExpId, setEditExpId] = React.useState<string>("");
  const [editDesc, setEditDesc] = React.useState<string>("");
  const [editCat, setEditCat] = React.useState<string>("");
  const [editDate, setEditDate] = React.useState<string>("");
  const [editAmount, setEditAmount] = React.useState<string>("");

  // Add task dialog state
  const [addTaskOpen, setAddTaskOpen] = React.useState(false);
  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskAssignee, setNewTaskAssignee] = React.useState("");
  const [newTaskStartDate, setNewTaskStartDate] = React.useState("");
  const [newTaskEndDate, setNewTaskEndDate] = React.useState("");
  const [newTaskStatus, setNewTaskStatus] = React.useState("PENDING");

  // Add expense dialog state
  const [addExpenseOpen, setAddExpenseOpen] = React.useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = React.useState("");
  const [newExpenseCat, setNewExpenseCat] = React.useState("");
  const [newExpenseDate, setNewExpenseDate] = React.useState("");
  const [newExpenseAmount, setNewExpenseAmount] = React.useState("");
  // Product-from-stock option
  const [useProductFromStock, setUseProductFromStock] = React.useState(true);
  const [selectedProductId, setSelectedProductId] = React.useState<string>("");
  const [selectedProductQty, setSelectedProductQty] = React.useState<number>(1);
  const [productSearchQuery, setProductSearchQuery] = React.useState<string>("");
  const [showProductSuggestions, setShowProductSuggestions] = React.useState<boolean>(false);
  const productComboRef = React.useRef<HTMLDivElement | null>(null);

  // Load products for selection
  const { data: allProducts } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const r = await fetch('/api/products');
      if (!r.ok) throw new Error('Falha ao carregar produtos');
      return r.json();
    },
  });

  // When opening Add Expense dialog default to using product-from-stock and reset search
  React.useEffect(() => {
    if (addExpenseOpen) {
      setUseProductFromStock(true);
      setProductSearchQuery("");
      setSelectedProductId("");
      setSelectedProductQty(1);
      setShowProductSuggestions(false);
    }
  }, [addExpenseOpen]);

  // Close suggestions when clicking outside
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!productComboRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!productComboRef.current.contains(e.target)) {
        setShowProductSuggestions(false);
      }
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Clone dialog states
  const [cloneTasksOpen, setCloneTasksOpen] = React.useState(false);
  const [cloneExpensesOpen, setCloneExpensesOpen] = React.useState(false);
  const [sourceProjectId, setSourceProjectId] = React.useState("");
  const [selectedTasks, setSelectedTasks] = React.useState<string[]>([]);
  const [resetDates, setResetDates] = React.useState(true);

  // Fetch all projects for clone dialog
  const { data: allProjects } = useQuery<Project[]>({
    queryKey: ["all-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  return (
    <div className="space-y-6 w-full">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projeto / Obra</h1>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados...</p>
          ) : project ? (
            <p className="text-sm text-muted-foreground">{project.code} • {project.name}</p>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0">
          <Button variant="outline" onClick={() => navigate("/projects")}>Voltar</Button>
          <Button onClick={() => setEditOpen(true)} disabled={!project || project.status === "COMPLETED"}>Editar</Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <Card className="sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-blue-600">Resumo</CardTitle>
          </CardHeader>
          <CardContent>
            {project && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Cliente</div>
                  <div className="font-medium">{project.customerName ?? '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{statusLabel(project.status)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Início</div>
                  <div>{project.startDate ? formatDate(project.startDate) : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Previsão</div>
                  <div>{project.expectedEndDate ? formatDate(project.expectedEndDate) : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Término</div>
                  <div>{project.endDate ? formatDate(project.endDate) : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Orçamento</div>
                  <div>{project.quoteId ? project.quoteId : '-'}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Venda</div>
                  <div>{project.saleId ? project.saleId : '-'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orçamento e Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Planejado</span><span>{formatCurrency(summary?.totalPlanned ?? 0)}</span></div>
              <div className="flex justify-between"><span>Orçamento (Quote)</span><span>{formatCurrency(summary?.quoteTotal ?? 0)}</span></div>
              <div className="flex justify-between"><span>Custo Tarefas</span><span>{formatCurrency(summary?.tasksCost ?? 0)}</span></div>
              <div className="flex justify-between"><span>Despesas</span><span>{formatCurrency(summary?.expensesTotal ?? 0)}</span></div>
              <div className="flex justify-between"><span>Total Real</span><span>{formatCurrency(summary?.totalActual ?? 0)}</span></div>
              <div className={`flex justify-between font-medium ${(summary?.remaining ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}><span>Saldo</span><span>{formatCurrency(summary?.remaining ?? 0)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button className="w-full" variant="secondary" onClick={() => { setQuoteIdInput(project?.quoteId || ""); setLinkQuoteOpen(true); }} disabled={!project || project.status === "COMPLETED"}>Vincular Orçamento</Button>
              <Button className="w-full" variant="secondary" onClick={() => { setSaleIdInput(project?.saleId || ""); setLinkSaleOpen(true); }} disabled={!project || project.status === "COMPLETED"}>Vincular Venda</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status do Projeto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                className="w-full bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300" 
                variant={project?.status === "PLANNING" ? "default" : "outline"}
                onClick={() => updateProject.mutate({ status: "PLANNING" })}
                disabled={!project || updateProject.isPending || project.status === "PLANNING"}
              >
                {project?.status === "PLANNING" ? "✓ " : ""}Planejamento
              </Button>
              <Button 
                className="w-full bg-green-100 text-green-800 hover:bg-green-200 border-green-300" 
                variant={project?.status === "IN_PROGRESS" ? "default" : "outline"}
                onClick={() => updateProject.mutate({ status: "IN_PROGRESS" })}
                disabled={!project || updateProject.isPending || project.status === "IN_PROGRESS"}
              >
                {project?.status === "IN_PROGRESS" ? "✓ " : ""}Em Andamento
              </Button>
              <Button 
                className="w-full bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300" 
                variant={project?.status === "ON_HOLD" ? "default" : "outline"}
                onClick={() => updateProject.mutate({ status: "ON_HOLD" })}
                disabled={!project || updateProject.isPending || project.status === "ON_HOLD"}
              >
                {project?.status === "ON_HOLD" ? "✓ " : ""}Em Espera
              </Button>
              <Button 
                className="w-full bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300" 
                variant={project?.status === "COMPLETED" ? "default" : "outline"}
                onClick={finalizeProject}
                disabled={!project || updateProject.isPending || project.status === "COMPLETED"}
              >
                {project?.status === "COMPLETED" ? "✓ " : ""}{updateProject.isPending ? "Salvando..." : "Concluído"}
              </Button>
              <Button 
                className="w-full bg-red-100 text-red-800 hover:bg-red-200 border-red-300" 
                variant={project?.status === "CANCELLED" ? "destructive" : "outline"}
                onClick={() => {
                  if (confirm("Tem certeza que deseja cancelar este projeto?")) {
                    updateProject.mutate({ status: "CANCELLED" });
                  }
                }}
                disabled={!project || updateProject.isPending || project.status === "CANCELLED"}
              >
                {project?.status === "CANCELLED" ? "✓ " : ""}Cancelado
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks - Kanban */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-green-600">Tarefas (Kanban)</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCloneTasksOpen(true)} disabled={!project || project.status === "COMPLETED"}>
                Clonar Tarefas
              </Button>
              <Button onClick={() => setAddTaskOpen(true)} disabled={!project || project.status === "COMPLETED"}>
                + Adicionar Tarefa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(tasksForRender.length === 0) ? (
            <div className="text-center text-sm text-muted-foreground py-6">Nenhuma tarefa lançada</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { key: 'PENDING', title: 'Pendente' },
                { key: 'IN_PROGRESS', title: 'Em andamento' },
                { key: 'DONE', title: 'Concluída' },
                { key: 'CANCELLED', title: 'Canceladas' },
              ].map((col) => {
                const colTasks = tasksForRender.filter(t => t.status === col.key);
                return (
                  <div
                    key={col.key}
                    className="rounded-lg border p-3 min-h-[200px] bg-white"
                    onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => {
                      e.preventDefault();
                      const taskId = e.dataTransfer.getData('text/plain');
                      if (!taskId) return;
                      const task = tasksForRender.find((t: Task) => t.id === taskId);
                      if (!task || task.status === col.key) return;
                      const payload: any = {
                        title: task.title,
                        assignee: task.assignee,
                        startDate: task.startDate,
                        dueDate: task.endDate,
                        status: col.key,
                      };
                      updateTaskMutation.mutate({ taskId: task.id, payload });
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{col.title}</h4>
                      <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {colTasks.map((t) => (
                        <div
                          key={t.id}
                          draggable={project?.status !== 'COMPLETED'}
                          onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                          className={`rounded p-3 border ${taskStatusClasses[(t.status || 'PENDING') as keyof typeof taskStatusClasses].bg} ${taskStatusClasses[(t.status || 'PENDING') as keyof typeof taskStatusClasses].text} ${taskStatusClasses[(t.status || 'PENDING') as keyof typeof taskStatusClasses].border} ${t.status === 'CANCELLED' ? 'opacity-60 line-through' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-medium text-sm">{t.title}</div>
                              <div className="text-xs text-muted-foreground">{t.assignee ? `Resp.: ${t.assignee}` : 'Sem responsável'}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Início: {t.startDate ? formatDate(t.startDate) : '-'} • Fim: {t.endDate ? formatDate(t.endDate) : '-'}</div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {t.status !== 'DONE' && project?.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                                <button
                                  className="px-2 py-1 text-xs text-white bg-green-600 rounded"
                                  onClick={() => updateTaskMutation.mutate({ taskId: t.id, payload: { title: t.title, assignee: t.assignee, startDate: t.startDate, dueDate: t.endDate, status: 'DONE' } })}
                                  disabled={updateTaskMutation.isPending}
                                >Concluir</button>
                              )}
                              <button
                                className="px-2 py-1 text-xs text-white bg-gray-700 rounded"
                                onClick={() => {
                                  setEditTaskId(t.id);
                                  setEditTaskTitle(t.title || "");
                                  setEditTaskAssignee(t.assignee || "");
                                  setEditTaskStartDate(t.startDate ? String(t.startDate).slice(0,10) : "");
                                  setEditTaskEndDate(t.endDate ? String(t.endDate).slice(0,10) : "");
                                  setEditTaskStatus(t.status || "PENDING");
                                  setEditTaskOpen(true);
                                }}
                                disabled={project?.status === 'COMPLETED' || t.status === 'CANCELLED'}
                              >Editar</button>
                              <button
                                className="px-2 py-1 text-xs text-white bg-indigo-600 rounded"
                                onClick={() => {
                                  setTaskDetails(t);
                                  setTaskDetailsOpen(true);
                                }}
                              >Detalhes</button>
                              <button
                                className="px-2 py-1 text-xs text-white bg-red-600 rounded"
                                onClick={() => {
                                  if (!confirm('Deseja cancelar esta tarefa? Ela ficará marcada como cancelada.')) return;
                                  updateTaskMutation.mutate({ taskId: t.id, payload: { title: t.title, assignee: t.assignee, startDate: t.startDate, dueDate: t.endDate, status: 'CANCELLED' } });
                                }}
                                disabled={project?.status === 'COMPLETED' || t.status === 'CANCELLED'}
                              >Cancelar</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-red-600">Despesas</CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setCloneExpensesOpen(true)} disabled={!project || project.status === "COMPLETED"} variant="outline">
                Clonar Despesas
              </Button>
              <Button onClick={() => setAddExpenseOpen(true)} disabled={!project || project.status === "COMPLETED"}>
                + Lançar Despesa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Input placeholder="Buscar despesas (descrição, categoria, valor...)" value={filterQuery} onChange={(e) => setFilterQuery(e.target.value)} />
              <div>
                <Label htmlFor="filterCategory">Categoria</Label>
                <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as categorias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Mão de Obra">Mão de Obra</SelectItem>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Label htmlFor="fstart" className="whitespace-nowrap">Início</Label>
                <Input id="fstart" type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Label htmlFor="fend" className="whitespace-nowrap">Fim</Label>
                <Input id="fend" type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} />
              </div>
              <div className="flex items-center justify-start sm:justify-end">
                <Button variant="outline" onClick={() => { setFilterCategory("ALL"); setFilterStart(""); setFilterEnd(""); }}>Limpar filtros</Button>
              </div>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!filteredExpenses || filteredExpenses.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhuma despesa lançada</TableCell>
                    </TableRow>
                  ) : filteredExpenses.map(e => (
                    <TableRow key={e.id} className={e.status === "COMPLETED" ? "bg-blue-50" : ""}>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell>{e.category ?? '-'}</TableCell>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(e.amount)}
                        {e.status === "COMPLETED" && (
                          <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            Concluído
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                          <button
                            className="px-2 py-1 text-xs sm:text-sm text-white bg-gray-700 rounded whitespace-nowrap"
                            onClick={() => {
                              setEditExpId(e.id);
                              setEditDesc(e.description || "");
                              setEditCat(e.category || "");
                              setEditDate(e.date ? String(e.date).slice(0,10) : "");
                              setEditAmount(String(e.amount ?? 0));
                              setEditExpOpen(true);
                            }}
                            disabled={project?.status === "COMPLETED" || e.status === "COMPLETED"}
                          >Editar</button>
                          {e.status !== "COMPLETED" && (
                            <button
                              className="px-2 py-1 text-xs sm:text-sm text-white bg-blue-600 rounded whitespace-nowrap"
                              onClick={() => {
                                if (!confirm('Marcar esta despesa como concluída? Após concluir, não será possível editar.')) return;
                                markExpenseCompletedMutation.mutate(e.id);
                              }}
                              disabled={markExpenseCompletedMutation.isPending || project?.status === "COMPLETED"}
                            >Concluir</button>
                          )}
                          <button
                            className="px-2 py-1 text-xs sm:text-sm text-white bg-red-600 rounded whitespace-nowrap"
                            onClick={() => {
                              if (!confirm('Excluir esta despesa?')) return;
                              deleteExpenseMutation.mutate(e.id);
                            }}
                            disabled={deleteExpenseMutation.isPending || project?.status === "COMPLETED" || e.status === "COMPLETED"}
                          >Excluir</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Revenue vs Expenses Chart */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Receita vs Despesas</h3>
            <ChartContainer
              config={{
                receita: {
                  label: "Receita",
                  color: "hsl(142, 76%, 36%)",
                },
                despesas: {
                  label: "Despesas",
                  color: "hsl(0, 84%, 60%)",
                },
              }}
              className="h-[250px] sm:h-[300px]"
            >
              <LineChart
                data={(() => {
                  const totalRevenue = project?.totalRevenue || 0;
                  const expensesByMonth = filteredExpenses?.reduce((acc: any, expense) => {
                    const date = new Date(expense.date);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    if (!acc[monthKey]) {
                      acc[monthKey] = { month: monthKey, receita: totalRevenue, despesas: 0 };
                    }
                    acc[monthKey].despesas += Number(expense.amount);
                    return acc;
                  }, {}) || {};
                  
                  return Object.values(expensesByMonth).sort((a: any, b: any) => a.month.localeCompare(b.month));
                })()}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(value) => {
                    const [year, month] = value.split('-');
                    return `${month}/${year.slice(-2)}`;
                  }}
                />
                <YAxis 
                  tickFormatter={(value) => 
                    new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(value)
                  }
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    formatter={(value, name) => [
                      new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(value)),
                      name === 'receita' ? 'Receita' : 'Despesas'
                    ]}
                    labelFormatter={(label) => {
                      const [year, month] = label.split('-');
                      return `${month}/${year}`;
                    }}
                  />} 
                />
                <Line 
                  type="monotone" 
                  dataKey="receita" 
                  stroke="var(--color-receita)" 
                  strokeWidth={2}
                  dot={{ fill: "var(--color-receita)" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="despesas" 
                  stroke="var(--color-despesas)" 
                  strokeWidth={2}
                  dot={{ fill: "var(--color-despesas)" }}
                />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Place Diário de Obra and Anexos side-by-side on md+ screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-blue-700">Diário de Obra</CardTitle>
              <Button onClick={() => setAddingNote(v => !v)} variant="secondary">
                {addingNote ? 'Cancelar' : '+ Nova Anotação'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {addingNote && (
              <div className="mb-4">
                <textarea
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                  placeholder="Digite uma nova anotação do diário de obra..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  disabled={loadingNotes}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    onClick={async () => {
                      if (!newNote.trim()) return;
                      await createProjectNote(id!, newNote.trim());
                      setNewNote("");
                      setAddingNote(false);
                      refetchNotes();
                    }}
                    disabled={!newNote.trim() || loadingNotes}
                  >Salvar Anotação</Button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {loadingNotes ? (
                <div className="text-sm text-muted-foreground">Carregando anotações...</div>
              ) : (projectNotes && projectNotes.length > 0 ? (
                projectNotes.slice().reverse().map((note) => (
                  <div key={note.id} className="border rounded p-2 bg-blue-50">
                    <div className="text-xs text-muted-foreground mb-1">{note.createdAt ? new Date(note.createdAt).toLocaleString('pt-BR') : ''}</div>
                    <div className="text-sm whitespace-pre-line">{note.content}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">Nenhuma anotação ainda.</div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-purple-600">Anexos</CardTitle>
              <div className="text-sm text-muted-foreground">Arquivos do projeto</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                <div className="sm:col-span-1">
                  <Label>Armazenamento</Label>
                  <Select value={storageOption} onValueChange={(v: string) => setStorageOption(v as 'local'|'drive')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Local" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="drive">Google Drive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="file">Arquivo</Label>
                  <Input id="file" type="file" onChange={(e) => { const f = e.target.files?.[0] || null; setSelectedFile(f); }} />
                </div>
                <div>
                  <Label htmlFor="fcaption">Legenda</Label>
                  <Input id="fcaption" value={fileCaption} onChange={(e) => setFileCaption(e.target.value)} placeholder="Legenda do arquivo (opcional)" />
                </div>
              </div>

              {storageOption === 'drive' && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <Button onClick={async () => {
                      try {
                        const r = await fetch('/api/_drive/auth-url');
                        if (!r.ok) throw new Error('Falha ao obter URL');
                        const j = await r.json();
                        window.open(j.url, '_blank');
                      } catch (err: any) { toast({ title: 'Erro', description: err?.message || String(err), variant: 'destructive' }); }
                    }}>Conectar Google Drive</Button>
                    <div className="text-sm text-muted-foreground">(abra a URL retornada e autorize; o server irá retornar tokens no callback)</div>
                  </div>
                  <div className="text-xs text-muted-foreground">Modo dev: cole tokens JSON abaixo (após autorizar no callback)</div>
                  <Input value={driveTokensInput} onChange={(e) => setDriveTokensInput(e.target.value)} placeholder='Cole aqui o JSON de tokens (dev only)' />
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => { setSelectedFile(null); setFileCaption(""); }}>Limpar</Button>
                <Button disabled={!selectedFile || (storageOption === 'local' ? uploadDocMutation.isPending : isUploadingToDrive)} onClick={async () => {
                  if (!selectedFile) return;
                  try {
                    if (storageOption === 'local') {
                      await uploadDocMutation.mutateAsync({ file: selectedFile, caption: fileCaption.trim() || undefined });
                    } else {
                      await uploadToDrive(selectedFile, fileCaption.trim() || undefined);
                    }
                    setSelectedFile(null);
                    setFileCaption("");
                  } catch (err: any) {
                    toast({ title: 'Erro ao enviar anexo', description: err?.message || String(err), variant: 'destructive' });
                  }
                }}>{storageOption === 'local' ? (uploadDocMutation.isPending ? 'Enviando...' : 'Enviar Anexo') : (isUploadingToDrive ? 'Enviando para Drive...' : 'Enviar para Drive')}</Button>
              </div>

              <div>
                <h4 className="font-medium mb-2">Anexos existentes</h4>
                {(!documents || documents.length === 0) ? (
                  <div className="text-sm text-muted-foreground">Nenhum anexo</div>
                ) : (
                  <div className="space-y-2">
                    {(documents || []).map(d => (
                      <div key={d.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium text-sm">{d.title || d.url.split('/').pop()}</div>
                          <div className="text-xs text-muted-foreground">{d.createdAt ? formatDate(d.createdAt) : ''}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a className="text-sm text-blue-600" href={d.url} target="_blank" rel="noreferrer">Abrir</a>
                          <button className="text-sm text-red-600" onClick={() => { if (!confirm('Excluir anexo?')) return; deleteDocMutation.mutate(d.id); }}>Excluir</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        loading={updateProject.isPending}
        onSave={() => {
          const payload: any = {
            name: name.trim(),
            description: description.trim() || null,
          };
          if (startDate) payload.startDate = createISODateString(startDate);
          if (expectedEndDate) payload.expectedEndDate = createISODateString(expectedEndDate);
          if (endDate) payload.endDate = createISODateString(endDate);
          updateProject.mutate(payload);
        }}
        values={{
          name,
          description,
          startDate,
          expectedEndDate,
          endDate,
        }}
        setValues={(v) => {
          if (v.name !== undefined) setName(v.name);
          if (v.description !== undefined) setDescription(v.description);
          if (v.startDate !== undefined) setStartDate(v.startDate);
          if (v.expectedEndDate !== undefined) setExpectedEndDate(v.expectedEndDate);
          if (v.endDate !== undefined) setEndDate(v.endDate);
        }}
      />

      <LinkQuoteDialog
        open={linkQuoteOpen}
        onOpenChange={setLinkQuoteOpen}
        value={quoteIdInput}
        setValue={setQuoteIdInput}
        loading={updateProject.isPending}
  onConfirm={(q) => updateProject.mutate(({ quoteId: q?.id } as any))}
      />

      <LinkSaleDialog
        open={linkSaleOpen}
        onOpenChange={setLinkSaleOpen}
        value={saleIdInput}
        setValue={setSaleIdInput}
        loading={updateProject.isPending}
        onSave={() => updateProject.mutate({ saleId: saleIdInput })}
      />

      {/* Edit Task Dialog */}
      <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
            <DialogDescription>Atualize os dados da tarefa selecionada.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="etitle">Título</Label>
              <Input id="etitle" value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eassignee">Responsável</Label>
              <Input id="eassignee" value={editTaskAssignee} onChange={(e) => setEditTaskAssignee(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="estartdate">Data Início</Label>
              <Input id="estartdate" type="date" value={editTaskStartDate} onChange={(e) => setEditTaskStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eenddate">Data Fim</Label>
              <Input id="eenddate" type="date" value={editTaskEndDate} onChange={(e) => setEditTaskEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="estatus">Status</Label>
              <Select value={editTaskStatus} onValueChange={setEditTaskStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                  <SelectItem value="DONE">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTaskOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editTaskTitle.trim()) { 
                  toast({ title: 'Título é obrigatório', variant: 'destructive' }); 
                  return; 
                }
                const payload: any = {
                  title: editTaskTitle.trim(),
                  assignee: editTaskAssignee.trim() || null,
                  startDate: editTaskStartDate ? createISODateString(editTaskStartDate) : null,
                  dueDate: editTaskEndDate ? createISODateString(editTaskEndDate) : null,
                  status: toBackendStatus(editTaskStatus),
                };
                updateTaskMutation.mutate({ taskId: editTaskId, payload });
              }}
              disabled={updateTaskMutation.isPending}
            >{updateTaskMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={taskDetailsOpen} onOpenChange={setTaskDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da Tarefa</DialogTitle>
            <DialogDescription>Visualize as informações completas da tarefa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-muted-foreground text-xs">Título</div>
              <div className="font-medium">{taskDetails?.title ?? '-'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Descrição</div>
              <div className="whitespace-pre-line">{taskDetails?.description ?? '-'}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-muted-foreground text-xs">Responsável</div>
                <div>{taskDetails?.assignee ?? 'Sem responsável'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Status</div>
                <div>{taskStatusLabel(taskDetails?.status)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-muted-foreground text-xs">Início</div>
                <div>{taskDetails?.startDate ? formatDate(taskDetails.startDate) : '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Fim</div>
                <div>{taskDetails?.endDate ? formatDate(taskDetails.endDate) : '-'}</div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDetailsOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={editExpOpen} onOpenChange={setEditExpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
            <DialogDescription>Atualize os dados da despesa selecionada.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="edesc">Descrição</Label>
              <Input id="edesc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ecat">Categoria</Label>
              <Select value={editCat} onValueChange={(v) => setEditCat(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Material">Material</SelectItem>
                  <SelectItem value="Mão de Obra">Mão de Obra</SelectItem>
                  <SelectItem value="Serviços">Serviços</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edate">Data</Label>
              <Input id="edate" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="eamount">Valor</Label>
              <Input id="eamount" type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editDesc.trim()) { toast({ title: 'Descrição é obrigatória', variant: 'destructive' }); return; }
                if (!editDate) { toast({ title: 'Data é obrigatória', variant: 'destructive' }); return; }
                const amt = parseFloat(editAmount || '0');
                if (!isFinite(amt) || amt <= 0) { toast({ title: 'Valor inválido', variant: 'destructive' }); return; }
                const payload: any = {
                  description: editDesc.trim(),
                  category: editCat.trim() || null,
                  date: createISODateString(editDate),
                  amount: String(amt),
                };
                updateExpenseMutation.mutate({ id: editExpId, payload });
              }}
              disabled={updateExpenseMutation.isPending}
            >{updateExpenseMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Nova Tarefa</DialogTitle>
            <DialogDescription>Preencha os dados da nova tarefa para o projeto.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ntitle">Título *</Label>
              <Input id="ntitle" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Digite o título da tarefa" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nassignee">Responsável</Label>
              <Input id="nassignee" value={newTaskAssignee} onChange={(e) => setNewTaskAssignee(e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nstartdate">Data Início</Label>
              <Input id="nstartdate" type="date" value={newTaskStartDate} onChange={(e) => setNewTaskStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nenddate">Data Fim</Label>
              <Input id="nenddate" type="date" value={newTaskEndDate} onChange={(e) => setNewTaskEndDate(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="nstatus">Status</Label>
              <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="IN_PROGRESS">Em andamento</SelectItem>
                  <SelectItem value="DONE">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newTaskTitle.trim()) { 
                  toast({ title: 'Título é obrigatório', variant: 'destructive' }); 
                  return; 
                }
                const payload: any = {
                  title: newTaskTitle.trim(),
                  assignee: newTaskAssignee.trim() || null,
                  startDate: newTaskStartDate ? createISODateString(newTaskStartDate) : null,
                  dueDate: newTaskEndDate ? createISODateString(newTaskEndDate) : null,
                  status: toBackendStatus(newTaskStatus),
                };
                createTaskMutation.mutate(payload);
              }}
              disabled={createTaskMutation.isPending}
            >{createTaskMutation.isPending ? 'Criando...' : 'Criar Tarefa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançar Nova Despesa</DialogTitle>
            <DialogDescription>Preencha os dados da nova despesa para o projeto.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ndesc">Descrição *</Label>
              <Input id="ndesc" value={newExpenseDesc} onChange={(e) => setNewExpenseDesc(e.target.value)} placeholder="Descreva a despesa" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ncat">Categoria</Label>
              <Select value={newExpenseCat} onValueChange={(v) => setNewExpenseCat(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Material">Material</SelectItem>
                  <SelectItem value="Mão de Obra">Mão de Obra</SelectItem>
                  <SelectItem value="Serviços">Serviços</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ndate">Data *</Label>
              <Input id="ndate" type="date" value={newExpenseDate} onChange={(e) => setNewExpenseDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="namount">Valor (R$) *</Label>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={useProductFromStock} onChange={(e) => setUseProductFromStock(e.target.checked)} /> Usar produto do estoque</label>
              </div>
              {!useProductFromStock && (
                <Input id="namount" type="number" step="0.01" value={newExpenseAmount} onChange={(e) => setNewExpenseAmount(e.target.value)} placeholder="0,00" />
              )}
              {useProductFromStock && (
                <div className="space-y-2" ref={productComboRef}>
                  <div>
                    <Label>Produto</Label>
                    <input
                      className="h-9 border rounded-md px-2 bg-white w-full"
                      placeholder="Buscar por código, nome ou código de barras..."
                      value={productSearchQuery}
                      onChange={(e) => { setProductSearchQuery(e.target.value); setShowProductSuggestions(true); }}
                      onFocus={() => setShowProductSuggestions(true)}
                    />
                    {showProductSuggestions && (
                      <div className="border rounded mt-1 max-h-48 overflow-y-auto bg-white z-50 relative shadow-md">
                        {(Array.isArray(allProducts) ? allProducts : [])
                          .filter((p: any) => {
                            const q = (productSearchQuery || '').toLowerCase().trim();
                            if (!q) return true;
                            return (String(p.code || '').toLowerCase().includes(q) || String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q));
                          })
                          .slice(0, 50)
                          .map((p: any) => (
                            <div
                              key={p.id}
                              className="p-2 hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                              onMouseDown={(ev) => { ev.preventDefault(); setSelectedProductId(p.id); setProductSearchQuery(`${p.code ? p.code + ' - ' : ''}${p.name}`); setShowProductSuggestions(false); }}
                            >
                              <div>
                                <div className="font-medium">{p.code ? `${p.code} • ` : ''}{p.name}</div>
                                <div className="text-xs text-muted-foreground">Estoque: {p.currentStock ?? 0} • Custo: {formatCurrency(p.costPrice ?? 0)}</div>
                              </div>
                              <div className="text-sm text-muted-foreground">{p.unit || ''}</div>
                            </div>
                          ))}
                        {(Array.isArray(allProducts) ? allProducts : []).filter((p: any) => {
                          const q = (productSearchQuery || '').toLowerCase().trim();
                          return q && !(String(p.code || '').toLowerCase().includes(q) || String(p.name || '').toLowerCase().includes(q) || String(p.barcode || '').toLowerCase().includes(q));
                        }).length === 0 && (productSearchQuery ? null : null)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-start sm:items-center min-w-0">
                    <div className="w-28">
                      <Label>Quantidade</Label>
                      <Input type="number" min={1} value={String(selectedProductQty)} onChange={(e) => setSelectedProductQty(Math.max(1, Number(e.target.value || 1)))} />
                    </div>
                    <div className="flex-1 text-sm">
                      <div className="text-muted-foreground">Preço custo por unidade</div>
                      <div className="font-medium">{selectedProductId ? (formatCurrency((allProducts || []).find(p => p.id === selectedProductId)?.costPrice ?? 0)) : '-'}</div>
                    </div>
                    <div className="text-sm">
                      <div className="text-muted-foreground">Estoque atual</div>
                      <div className="font-medium">{selectedProductId ? ((allProducts || []).find(p => p.id === selectedProductId)?.currentStock ?? 0) : '-'}</div>
                    </div>
                    <div className="w-full sm:w-44 flex-shrink-0">
                      <Label>Total calculado</Label>
                      <div className="h-9 flex items-center px-3 border rounded bg-gray-50 truncate">{selectedProductId ? formatCurrency(((allProducts || []).find(p => p.id === selectedProductId)?.costPrice ?? 0) * Math.max(1, Math.floor(selectedProductQty))) : '-'}</div>
                    </div>
                  </div>
                  {selectedProductId && (() => {
                    const prod = (allProducts || []).find(p => p.id === selectedProductId);
                    const stock = prod?.currentStock ?? 0;
                    if (selectedProductQty > stock) {
                      return (
                        <div className="text-sm text-red-700 mt-2">Quantidade selecionada maior que o estoque disponível ({stock}). Verifique o estoque ou ajuste a quantidade.</div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!newExpenseDesc.trim()) { 
                  toast({ title: 'Descrição é obrigatória', variant: 'destructive' }); 
                  return; 
                }
                if (!newExpenseDate) { 
                  toast({ title: 'Data é obrigatória', variant: 'destructive' }); 
                  return; 
                }
                let payload: any = {
                  description: newExpenseDesc.trim(),
                  category: newExpenseCat.trim() || null,
                  date: createISODateString(newExpenseDate),
                };
                if (useProductFromStock) {
                  if (!selectedProductId) { toast({ title: 'Selecione um produto', variant: 'destructive' }); return; }
                  const prod = (allProducts || []).find(p => p.id === selectedProductId);
                  if (!prod) { toast({ title: 'Produto inválido', variant: 'destructive' }); return; }
                  const cost = Number(prod.costPrice || 0);
                  if (!isFinite(cost) || cost <= 0) { toast({ title: 'Produto sem preço de custo válido', variant: 'destructive' }); return; }
                  payload.amount = String((cost * Math.max(1, Math.floor(selectedProductQty))).toFixed(2));
                  payload.description = payload.description + ` (Produto: ${prod.name})`;
                  payload.productId = selectedProductId;
                  payload.quantity = Math.max(1, Math.floor(selectedProductQty));
                } else {
                  const amt = parseFloat(newExpenseAmount || '0');
                  if (!isFinite(amt) || amt <= 0) { 
                    toast({ title: 'Valor inválido', variant: 'destructive' }); 
                    return; 
                  }
                  payload.amount = String(amt);
                }
                createExpenseMutation.mutate(payload);
              }}
              disabled={createExpenseMutation.isPending}
            >{createExpenseMutation.isPending ? 'Lançando...' : 'Lançar Despesa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Clone Tasks Dialog */}
      <Dialog open={cloneTasksOpen} onOpenChange={setCloneTasksOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Tarefas</DialogTitle>
            <DialogDescription>Selecione o projeto e as tarefas que deseja clonar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto de Origem</Label>
              <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects?.filter(p => p.id !== id).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} - {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sourceProjectId && (
              <>
                <div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={resetDates}
                      onChange={(e) => setResetDates(e.target.checked)}
                      id="resetDates"
                      className="h-4 w-4"
                    />
                    <label htmlFor="resetDates" className="text-sm">Limpar datas das tarefas clonadas</label>
                  </div>
                </div>

                <div className="mt-2">
                  <Label className="flex items-center justify-between mb-2">
                    <span>Tarefas Disponíveis</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tasksQuery = allTasks?.data || [];
                        if (selectedTasks.length === tasksQuery.length) {
                          setSelectedTasks([]);
                        } else {
                          setSelectedTasks(tasksQuery.map(t => t.id));
                        }
                      }}
                    >
                      {selectedTasks.length === (allTasks?.data || []).length ? "Desmarcar Todos" : "Selecionar Todos"}
                    </Button>
                  </Label>
                  <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-4">
                    <SourceProjectTasks
                      sourceProjectId={sourceProjectId}
                      selectedTasks={selectedTasks}
                      setSelectedTasks={setSelectedTasks}
                    />
                  </div>
                </div>
              </>
            )}</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneTasksOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                try {
                  if (!sourceProjectId) {
                    toast({ title: "Selecione um projeto de origem", variant: "destructive" });
                    return;
                  }

                  // Fetch tasks from source project
                  const res = await fetch(`/api/projects/${sourceProjectId}/tasks`);
                  if (!res.ok) throw new Error("Falha ao buscar tarefas");
                  const sourceTasks = await res.json();
                  
                  // Filter only selected tasks to clone
                  const tasksToClone = sourceTasks.filter((t: Task) => selectedTasks.includes(t.id));
                  if (tasksToClone.length === 0) {
                    toast({ title: "Selecione pelo menos uma tarefa para clonar", variant: "destructive" });
                    return;
                  }

                  // Clone each selected task
                  for (const task of tasksToClone) {
                    await createTask({
                      title: task.title,
                      description: task.description,
                      assignee: task.assignee,
                      startDate: resetDates ? null : task.startDate,
                      dueDate: resetDates ? null : task.endDate,
                      status: "PENDING", // Always start as pending
                    });
                  }

                  qc.invalidateQueries({ queryKey: ["project", id, "tasks"] });
                  toast({ title: `${tasksToClone.length} tarefa(s) clonada(s) com sucesso!` });
                  setCloneTasksOpen(false);
                  setSourceProjectId("");
                  setSelectedTasks([]);
                } catch (error: any) {
                  toast({
                    title: "Erro ao clonar tarefas",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >Clonar Tarefas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone Expenses Dialog */}
      <Dialog open={cloneExpensesOpen} onOpenChange={setCloneExpensesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clonar Despesas</DialogTitle>
            <DialogDescription>Selecione o projeto de origem para copiar as despesas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Projeto de Origem</Label>
              <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects?.filter(p => p.id !== id).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneExpensesOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                try {
                  if (!sourceProjectId) {
                    toast({ title: "Selecione um projeto de origem", variant: "destructive" });
                    return;
                  }

                  // Fetch expenses from source project
                  const res = await fetch(`/api/projects/${sourceProjectId}/expenses`);
                  if (!res.ok) throw new Error("Falha ao buscar despesas");
                  const sourceExpenses = await res.json();

                  // Clone each expense
                  for (const expense of sourceExpenses) {
                    await createExpense({
                      description: expense.description,
                      category: expense.category,
                      date: createISODateString(formatDateForInput(new Date())), // Use current date
                      amount: expense.amount,
                    });
                  }

                  qc.invalidateQueries({ queryKey: ["project", id, "expenses"] });
                  toast({ title: "Despesas clonadas com sucesso!" });
                  setCloneExpensesOpen(false);
                  setSourceProjectId("");
                } catch (error: any) {
                  toast({
                    title: "Erro ao clonar despesas",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >Clonar Despesas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusLabel(s: Project["status"]) {
  switch (s) {
    case "PLANNING": return "Planejamento";
    case "IN_PROGRESS": return "Em andamento";
    case "ON_HOLD": return "Em espera";
    case "COMPLETED": return "Concluído";
    case "CANCELLED": return "Cancelado";
    default: return s;
  }
}

function taskStatusLabel(s: Task["status"]) {
  switch (s) {
    case "PENDING": return "Pendente";
    case "IN_PROGRESS": return "Em andamento";
    case "DONE": return "Concluída";
    default: return s;
  }
}

const taskStatusClasses = {
  PENDING: { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200' },
  IN_PROGRESS: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  DONE: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  CANCELLED: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
} as const;

// Helper component: fetch and render tasks from a source project.
function SourceProjectTasks({
  sourceProjectId,
  selectedTasks,
  setSelectedTasks,
}: {
  sourceProjectId: string;
  selectedTasks: string[];
  setSelectedTasks: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ["source-project-tasks", sourceProjectId],
    queryFn: () => fetchTasks(sourceProjectId),
    enabled: !!sourceProjectId,
  });

  if (!sourceProjectId) return null;
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando tarefas...</div>;
  if (error) return <div className="text-sm text-red-600">Erro ao carregar tarefas</div>;

  return (
    <>
      {(tasks || []).map((task: Task) => (
        <div key={task.id} className={`flex items-start gap-2 p-2 rounded ${taskStatusClasses[(task.status || 'PENDING') as keyof typeof taskStatusClasses].bg}`}>
          <input
            type="checkbox"
            checked={selectedTasks.includes(task.id)}
            onChange={(e) => {
              setSelectedTasks(prev =>
                e.target.checked ? [...prev, task.id] : prev.filter((id: string) => id !== task.id)
              );
            }}
            id={`task-${task.id}`}
            className="mt-1 h-4 w-4"
          />
          <label htmlFor={`task-${task.id}`} className="flex-1 text-sm cursor-pointer">
            <div className="font-medium">{task.title}</div>
            {task.description && (
              <div className="text-muted-foreground text-xs mt-0.5">{task.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-1">
              {task.assignee ? `Responsável: ${task.assignee} • ` : ''}
              Status: {taskStatusLabel(task.status)}
            </div>
            <div className="text-xs text-muted-foreground">
              {task.startDate || task.endDate ? `Datas: ${task.startDate ? formatDate(task.startDate) : '-'} até ${task.endDate ? formatDate(task.endDate) : '-'}` : ''}
            </div>
          </label>
        </div>
      ))}
    </>
  );
}

// Edit Dialog
function EditProjectDialog({ open, onOpenChange, onSave, loading, values, setValues }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: () => void;
  loading?: boolean;
  values: { name: string; description: string; startDate: string; expectedEndDate: string; endDate: string };
  setValues: (v: Partial<{ name: string; description: string; startDate: string; expectedEndDate: string; endDate: string }>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Projeto</DialogTitle>
          <DialogDescription>Atualize os dados básicos e datas do projeto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pname">Nome</Label>
            <Input id="pname" value={values.name} onChange={(e) => setValues({ name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdesc">Descrição</Label>
            <Input id="pdesc" value={values.description} onChange={(e) => setValues({ description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pstart">Início</Label>
              <Input id="pstart" type="date" value={values.startDate} onChange={(e) => setValues({ startDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pexp">Previsão</Label>
              <Input id="pexp" type="date" value={values.expectedEndDate} onChange={(e) => setValues({ expectedEndDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pend">Término</Label>
              <Input id="pend" type="date" value={values.endDate} onChange={(e) => setValues({ endDate: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Reuse EditProjectDialog inside component via rendering
// Link Quote Dialog
function LinkQuoteDialog({ open, onOpenChange, value, setValue, onConfirm, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
  onConfirm?: (quote: any | null) => void;
  loading?: boolean;
}) {
  const [quote, setQuote] = React.useState<any | null>(null);
  const [fetching, setFetching] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      const id = value?.trim();
      if (!id) { setQuote(null); return; }
      setFetching(true);
      try {
        // Try by UUID first
        const res = await fetch(`/api/quotes/${id}`);
        if (res.ok) {
          const q = await res.json();
          if (!cancelled) setQuote(q);
        } else {
          // Fallback: try by human-readable number (e.g., ORC000123)
          const res2 = await fetch(`/api/quotes/by-number/${encodeURIComponent(id)}`);
          if (res2.ok) {
            const q2 = await res2.json();
            if (!cancelled) setQuote(q2);
          } else {
            if (!cancelled) setQuote(null);
          }
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular Orçamento</DialogTitle>
          <DialogDescription>Informe o ID (UUID) ou Número (ex.: ORC000123) do orçamento para vincular ao projeto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="qid">ID ou Número do Orçamento</Label>
          <Input id="qid" placeholder="Cole o ID (UUID) ou Número (ORC000123)" value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="text-xs text-muted-foreground">
            {fetching ? 'Carregando orçamento...' : quote ? `Orçamento carregado • Código: ${quote.number} • Cliente: ${quote.customerName ?? quote.customerId}` : (value ? 'Orçamento não encontrado' : '')}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onConfirm?.(quote)} disabled={loading || !value.trim() || !quote}>{loading ? "Vinculando..." : "Vincular"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkSaleDialog({ open, onOpenChange, value, setValue, onSave, loading }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
  onSave: () => void;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular Venda</DialogTitle>
          <DialogDescription>Informe o ID da venda para vincular ao projeto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="sid">ID da Venda</Label>
          <Input id="sid" placeholder="Cole o ID da venda (UUID)" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={loading || !value.trim()}>{loading ? "Vinculando..." : "Vincular"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mount dialogs next to page root
// We append components at the end of default export render via fragments; modify above return
