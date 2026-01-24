import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { NumericFormat } from "react-number-format";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, Supplier, Sale, Finance } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { formatCurrency, createDateFromInput, formatDateForInput, createISODateString } from '@/lib/formatters';
import { Pencil, CheckCircle2, XCircle, Lock as LockIcon, User, Building2, Calendar as CalendarIcon, DollarSign, FileText, Tag, Briefcase, CreditCard, MessageSquare, Plus, TrendingUp, TrendingDown, Wallet, ArrowUpCircle, ArrowDownCircle, Copy, Percent, Calculator, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceivableItem {
  id: string;
  code?: string;
  date: string;
  dueDate: string;
  customerName: string;
  description: string;
  amount: number;
  discount?: number | null;
  status: "aberto" | "pago" | "vencido" | "cancelado" | "concluido";
  customerId?: string | null;
  saleId?: string | null;
  recurrence?: "nenhuma" | "mensal" | "semanal";
  category?: string | null;
  costCenter?: string | null;
  project?: string | null;
  projectId?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

interface PayableItem {
  id: string;
  code?: string;
  date: string;
  dueDate: string;
  supplierName: string;
  description: string;
  amount: number;
  surcharge?: number | null;
  status: "aberto" | "pago" | "vencido" | "cancelado" | "concluido";
  supplierId?: string | null;
  recurrence?: "nenhuma" | "mensal" | "semanal";
  category?: string | null;
  costCenter?: string | null;
  project?: string | null;
  projectId?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
}

interface CashMovement {
  id: string;
  date: string;
  type: "entrada" | "saida";
  description: string;
  amount: number; // entradas positivo, saídas negativo
  paymentMethod?: string | null;
  category?: string | null;
  costCenter?: string | null;
  project?: string | null;
  notes?: string | null;
  receivableId?: string | null;
  payableId?: string | null;
}

// Lista unificada para a aba "Todos os lançamentos"
type AllKind = "RECEBER" | "PAGAR" | "CAIXA";
interface AllEntry {
  id: string;
  date: string; // YYYY-MM-DD
  dueDate?: string; // para receber/pagar
  kind: AllKind;
  party: string; // cliente/fornecedor/descrição curta
  description: string;
  amount: number; // manter sinal natural: receber/pagar positivos para exibição; caixa pode ser +/-
  status?: "aberto" | "pago" | "vencido" | "cancelado" | "concluido"; // aplicável a receber/pagar
  paymentMethod?: string | null;
  category?: string | null;
  notes?: string | null;
}

export default function Finance() {
  // Lista de categorias padrão (pode ser evoluída para backend)
  const defaultCategories = [
    "Vendas",
    "Serviços",
    "Impostos",
    "Aluguel",
    "Salários",
    "Fornecedores",
    "Transporte",
    "Marketing",
    "Manutenção",
    "Outros",
  ];
  const [searchReceivables, setSearchReceivables] = useState("");
  const [searchPayables, setSearchPayables] = useState("");

  // Filters - All
  const [allSearch, setAllSearch] = useState<string>("");
  const [allDateFrom, setAllDateFrom] = useState<string>("");
  const [allDateTo, setAllDateTo] = useState<string>("");
  const [allKind, setAllKind] = useState<"todos" | AllKind>("todos");
  const [allStatus, setAllStatus] = useState<"todos"|"aberto"|"pago"|"vencido"|"cancelado">("todos");
  const [allPayment, setAllPayment] = useState<string>("");
  const [allMin, setAllMin] = useState<string>("");
  const [allMax, setAllMax] = useState<string>("");
  const [allSortBy, setAllSortBy] = useState<"date"|"amount"|"status"|"kind">("date");
  const [allSortDir, setAllSortDir] = useState<"asc"|"desc">("asc");
  const [allPage, setAllPage] = useState<number>(1);
  const [allPageSize, setAllPageSize] = useState<number>(10);
  const [allDueToday, setAllDueToday] = useState<boolean>(false);

  // Filters - Receivables
  const [rcvDateFrom, setRcvDateFrom] = useState<string>("");
  const [rcvDateTo, setRcvDateTo] = useState<string>("");
  const [rcvStatus, setRcvStatus] = useState<"todos"|"aberto"|"pago"|"vencido"|"cancelado">("todos");
  const [rcvPayment, setRcvPayment] = useState<string>("");
  const [rcvOnlyOverdue, setRcvOnlyOverdue] = useState<boolean>(false);
  const [rcvDueToday, setRcvDueToday] = useState<boolean>(false);
  const [rcvMin, setRcvMin] = useState<string>("");
  const [rcvMax, setRcvMax] = useState<string>("");
  const [rcvSortBy, setRcvSortBy] = useState<"date"|"dueDate"|"amount"|"status">("dueDate");
  const [rcvSortDir, setRcvSortDir] = useState<"asc"|"desc">("asc");
  const [rcvCols, setRcvCols] = useState<{dueDate:boolean; payment:boolean; notes:boolean}>({ dueDate: true, payment: true, notes: false });
  const [rcvPage, setRcvPage] = useState<number>(1);
  const [rcvPageSize, setRcvPageSize] = useState<number>(10);

  // Filters - Payables
  const [pblDateFrom, setPblDateFrom] = useState<string>("");
  const [pblDateTo, setPblDateTo] = useState<string>("");
  const [pblStatus, setPblStatus] = useState<"todos"|"aberto"|"pago"|"vencido"|"cancelado">("todos");
  const [pblPayment, setPblPayment] = useState<string>("");
  const [pblOnlyOverdue, setPblOnlyOverdue] = useState<boolean>(false);
  const [pblDueToday, setPblDueToday] = useState<boolean>(false);
  const [pblMin, setPblMin] = useState<string>("");
  const [pblMax, setPblMax] = useState<string>("");
  const [pblSortBy, setPblSortBy] = useState<"date"|"dueDate"|"amount"|"status">("dueDate");
  const [pblSortDir, setPblSortDir] = useState<"asc"|"desc">("asc");
  const [pblCols, setPblCols] = useState<{dueDate:boolean; payment:boolean; notes:boolean}>({ dueDate: true, payment: true, notes: false });
  const [pblPage, setPblPage] = useState<number>(1);
  const [pblPageSize, setPblPageSize] = useState<number>(10);

  // Charts filters
  const [chartGranularity, setChartGranularity] = useState<"dia"|"mes"|"ano">("mes");
  const [chartType, setChartType] = useState<"ambos"|"entrada"|"saida">("ambos");
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [chartMonth, setChartMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [chartShowValues, setChartShowValues] = useState<boolean>(true);
  const [chartShowNet, setChartShowNet] = useState<boolean>(false);
  const chartRef = useRef<HTMLDivElement | null>(null);

  // Filtros para DRE (por competência, usando dueDate)
  const [dreDateFrom, setDreDateFrom] = useState<string>("");
  const [dreDateTo, setDreDateTo] = useState<string>("");

  // Util: formato compacto (k, M) mantendo título com valor cheio
  function formatCurrencyCompact(v: number): string {
    const abs = Math.abs(v);
    const sign = v < 0 ? "-" : "";
    const fmt = (n:number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
    if (abs >= 1_000_000) return `${sign}R$ ${fmt(abs/1_000_000)}M`;
    if (abs >= 1_000) return `${sign}R$ ${fmt(abs/1_000)}k`;
    return `${sign}${abs.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  }

  async function exportChartAsPng() {
    const el = chartRef.current;
    if (!el) return;
    // Carrega html2canvas dinamicamente via CDN
    if (!(window as any).html2canvas) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Falha ao carregar html2canvas'));
        document.body.appendChild(s);
      });
    }
    const html2canvas = (window as any).html2canvas as (node: HTMLElement) => Promise<HTMLCanvasElement>;
    const canvas = await html2canvas(el);
    const link = document.createElement('a');
    link.download = `grafico-financeiro.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // Dados do backend
  const { data: financeData } = useQuery<Finance[]>({ queryKey: ["/api/finance"] });

  // Helper to keep calendar date stable (avoid timezone shifting)
  function toDateOnly(value: any): string {
    const d = new Date(value as any);
    // build a UTC date from UTC components and slice YYYY-MM-DD
    const dateOnly = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return dateOnly.toISOString().slice(0, 10);
  }

  // Editar lançamento
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editId, setEditId] = useState<string>("");
  const [editType, setEditType] = useState<"receber" | "pagar">("receber");
  const [editDate, setEditDate] = useState<string>(formatDateForInput(new Date()));
  const [editDueDate, setEditDueDate] = useState<string>(formatDateForInput(new Date()));
  const [editParty, setEditParty] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDiscount, setEditDiscount] = useState<string>("");
  const [editDiscountType, setEditDiscountType] = useState<"valor" | "percentual">("valor");
  const [editSurcharge, setEditSurcharge] = useState<string>("");
  const [editSurchargeType, setEditSurchargeType] = useState<"valor" | "percentual">("valor");
  const [editError, setEditError] = useState<string>("");
  const [editStatus, setEditStatus] = useState<"aberto" | "pago" | "vencido" | "cancelado">("aberto");
  const [editRecurrence, setEditRecurrence] = useState<"nenhuma" | "mensal" | "semanal">("nenhuma");
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  const [editCostCenter, setEditCostCenter] = useState<string>("");
  const [editProject, setEditProject] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editLocked, setEditLocked] = useState<boolean>(false);
  // Edit dialog toggle
  const [showEditDialog, setShowEditDialog] = useState<boolean>(false);

  function openEditFromReceivable(r: ReceivableItem) {
    setEditId(r.id);
    setEditType("receber");
    setEditDate(r.date);
    setEditDueDate(r.dueDate || r.date);
    setEditParty(r.customerName);
    setEditDesc(r.description);
    setEditAmount(String(r.amount));
    setEditDiscount(r.discount != null ? String(r.discount) : "");
    setEditDiscountType((r as any).discountType === "PERCENTAGE" ? "percentual" : "valor");
    setEditSurcharge("");
    setEditStatus(r.status as any);
    setEditRecurrence(r.recurrence || "nenhuma");
    setEditPaymentMethod(r.paymentMethod || "");
    setEditCategory(r.category || "");
    setEditCostCenter(r.costCenter || "");
    setEditProject(r.projectId || "");
    setEditNotes(r.notes || "");
    setEditLocked(r.status === "pago");
    setEditError("");
    setShowEditDialog(true);
  }

  // Função para clonar conta a receber
  function cloneReceivable(r: ReceivableItem) {
    setLaunchType("receber");
    setLaunchDate(formatDateForInput(new Date()));
    setLaunchDueDate(formatDateForInput(new Date(Date.now() + 30*24*3600*1000))); // +30 dias
    setLaunchDesc(r.description + " (Cópia)");
    setLaunchAmount(String(r.amount));
    setLaunchStatus("aberto");
    setLaunchRecurrence(r.recurrence || "nenhuma");
    setLaunchPaymentMethod(r.paymentMethod || "");
    setLaunchCategory(r.category || "");
    setLaunchCostCenter(r.costCenter || "");
    setLaunchProject(r.project || "");
    setLaunchNotes((r.notes || "") + " [Clonado]");
    setLaunchPaid(false);
    setIsSimple(!r.customerId);
    if (r.customerId) {
      setSelectedCustomerId(r.customerId);
      setLaunchParty("");
    } else {
      setSelectedCustomerId("");
      setLaunchParty(r.customerName);
    }
    setIsLaunchOpen(true);
    toast({ title: "Lançamento clonado", description: "Revise os dados e confirme para criar" });
  }

  // Função para clonar conta a pagar  
  function clonePayable(p: PayableItem) {
    setLaunchType("pagar");
    setLaunchDate(formatDateForInput(new Date()));
    setLaunchDueDate(formatDateForInput(new Date(Date.now() + 30*24*3600*1000))); // +30 dias
    setLaunchDesc(p.description + " (Cópia)");
    setLaunchAmount(String(p.amount));
    setLaunchStatus("aberto");
    setLaunchRecurrence(p.recurrence || "nenhuma");
    setLaunchPaymentMethod(p.paymentMethod || "");
    setLaunchCategory(p.category || "");
    setLaunchCostCenter(p.costCenter || "");
    setLaunchProject(p.project || "");
    setLaunchNotes((p.notes || "") + " [Clonado]");
    setLaunchPaid(false);
    setIsSimple(!p.supplierId);
    if (p.supplierId) {
      setSelectedSupplierId(p.supplierId);
      setLaunchParty("");
    } else {
      setSelectedSupplierId("");
      setLaunchParty(p.supplierName);
    }
    setIsLaunchOpen(true);
    toast({ title: "Lançamento clonado", description: "Revise os dados e confirme para criar" });
  }

  // Format YYYY-MM-DD -> DD/MM/YYYY without creating Date
  function formatDatePtBR(dateStr: string): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }

  // Parse YYYY-MM-DD -> { y, m, d } numbers
  function parseYMD(dateStr: string): { y: number; m: number; d: number } {
    const [ys, ms, ds] = dateStr.split("-");
    return { y: Number(ys), m: Number(ms), d: Number(ds) };
  }

  // Mapear Finance -> estados de UI
  const receivables = useMemo<ReceivableItem[]>(() => {
    const today = toDateOnly(new Date());
    return (financeData || [])
      .filter(f => f.entryType === "RECEIVABLE")
      .map(f => ({
        id: f.id,
        code: (f as any).code || undefined,
        date: toDateOnly(f.date),
        dueDate: toDateOnly((f as any).dueDate || f.date),
        customerName: f.partyName || "",
        description: f.description || "",
        amount: Number(f.amount),
        discount: (f as any).discount != null ? Number((f as any).discount) : null,
        status: (() => {
          const base = f.status === "PAID" ? "pago" as const : (f.status === "OVERDUE" ? "vencido" as const : (f.status === "CANCELED" ? "cancelado" as const : "aberto" as const));
          const due = toDateOnly((f as any).dueDate || f.date);
          if (base !== "pago" && base !== "cancelado" && due < today) return "vencido" as const;
          return base;
        })(),
        customerId: f.customerId || null,
        saleId: f.saleId || null,
        recurrence: f.recurrence === "MONTHLY" ? "mensal" : (f.recurrence === "WEEKLY" ? "semanal" : "nenhuma"),
        category: f.category || null,
        costCenter: f.costCenter || null,
        project: f.project || null,
        projectId: (f as any).projectId || null,
        paymentMethod: f.paymentMethod || null,
        notes: f.notes || null,
      }));
  }, [financeData]);

  const payables = useMemo<PayableItem[]>(() => {
    const today = toDateOnly(new Date());
    return (financeData || [])
      .filter(f => f.entryType === "PAYABLE")
      .map(f => ({
        id: f.id,
        code: (f as any).code || undefined,
        date: toDateOnly(f.date),
        dueDate: toDateOnly((f as any).dueDate || f.date),
        supplierName: f.partyName || "",
        description: f.description || "",
        amount: Number(f.amount),
        surcharge: (f as any).surcharge != null ? Number((f as any).surcharge) : null,
        status: (() => {
          const base = f.status === "PAID" ? "pago" as const : (f.status === "OVERDUE" ? "vencido" as const : (f.status === "CANCELED" ? "cancelado" as const : "aberto" as const));
          const due = toDateOnly((f as any).dueDate || f.date);
          if (base !== "pago" && base !== "cancelado" && due < today) return "vencido" as const;
          return base;
        })(),
        supplierId: f.supplierId || null,
        recurrence: f.recurrence === "MONTHLY" ? "mensal" : (f.recurrence === "WEEKLY" ? "semanal" : "nenhuma"),
        category: f.category || null,
        costCenter: f.costCenter || null,
        project: f.project || null,
        projectId: (f as any).projectId || null,
        paymentMethod: f.paymentMethod || null,
        notes: f.notes || null,
      }));
  }, [financeData]);
  function openEditFromPayable(p: PayableItem) {
    setEditId(p.id);
    setEditType("pagar");
    setEditDate(p.date);
    setEditDueDate(p.dueDate || p.date);
    setEditParty(p.supplierName);
    setEditDesc(p.description);
    setEditAmount(String(p.amount));
    setEditSurcharge(p.surcharge != null ? String(p.surcharge) : "");
    setEditSurchargeType((p as any).surchargeType === "PERCENTAGE" ? "percentual" : "valor");
    setEditDiscount("");
    setEditStatus(p.status as any);
    setEditRecurrence(p.recurrence || "nenhuma");
    setEditPaymentMethod(p.paymentMethod || "");
    setEditCategory(p.category || "");
    setEditCostCenter(p.costCenter || "");
    setEditProject(p.projectId || "");
    setEditNotes(p.notes || "");
    setEditLocked(p.status === "pago");
    setEditError("");
    setShowEditDialog(true);
  }

  async function handleSaveEdit() {
    if (editLocked) { setEditError("Lançamentos pagos não podem ser editados."); return; }
    const amount = parseFloat(editAmount.replace(",", "."));
    const discount = parseFloat(editDiscount.replace(",", ".")) || 0;
    const surcharge = parseFloat(editSurcharge.replace(",", ".")) || 0;
    const discountType = editDiscountType === "percentual" ? "PERCENTAGE" : "FIXED_VALUE";
    const surchargeType = editSurchargeType === "percentual" ? "PERCENTAGE" : "FIXED_VALUE";
    if (!amount || Number.isNaN(amount) || amount <= 0) { setEditError("Informe um valor válido maior que zero."); return; }
    if (editType === "receber" && (discount < 0 || Number.isNaN(discount))) {
      setEditError("Informe um desconto válido.");
      return;
    }
    if (editType === "pagar" && (surcharge < 0 || Number.isNaN(surcharge))) {
      setEditError("Informe um acréscimo válido.");
      return;
    }
    if (!editPaymentMethod) { setEditError("Informe o meio de pagamento."); return; }
    setEditError("");
    const payload: any = {
      date: editDate,
      dueDate: editDueDate || editDate,
      description: editDesc,
      partyName: editParty,
      amount: amount.toFixed(2),
      discount: editType === "receber" ? discount.toFixed(2) : null,
      discountType: editType === "receber" ? discountType : null,
      surcharge: editType === "pagar" ? surcharge.toFixed(2) : null,
      surchargeType: editType === "pagar" ? surchargeType : null,
      status: editStatus === "pago" ? "PAID" : (editStatus === "vencido" ? "OVERDUE" : (editStatus === "cancelado" ? "CANCELED" : "OPEN")),
      recurrence: editRecurrence === "mensal" ? "MONTHLY" : (editRecurrence === "semanal" ? "WEEKLY" : "NONE"),
      paymentMethod: editPaymentMethod,
      category: editCategory || null,
      costCenter: editCostCenter || null,
      projectId: editProject || null,
      notes: editNotes || null,
    };
    const res = await fetch(`/api/finance/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { setEditError("Falha ao salvar alterações."); toast({ title: "Erro", description: "Falha ao salvar alterações", variant: "destructive" }); return; }
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    setShowEditDialog(false);
    toast({ title: "✅ Lançamento atualizado", description: "As alterações foram salvas com sucesso" });
  }

  async function handleMarkPaid(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    await fetch(`/api/finance/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: today }) });
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    toast({ title: "Lançamento pago" });
  }
  
  async function handleMarkCompleted(id: string) {
    await fetch(`/api/finance/${id}/mark-completed`, { method: "POST", headers: { "Content-Type": "application/json" } });
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    toast({ title: "Lançamento marcado como concluído" });
  }

  async function handleCancel(id: string) {
    await fetch(`/api/finance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELED" }) });
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    toast({ title: "Lançamento cancelado" });
  }

  const cashMovements = useMemo<CashMovement[]>(() => {
    return (financeData || [])
      .filter(f => f.entryType === "CASH")
      .map(f => ({
        id: f.id,
        date: toDateOnly(f.date),
        type: Number(f.amount) >= 0 ? "entrada" : "saida",
        description: f.description || "",
        amount: Number(f.amount),
        paymentMethod: f.paymentMethod || null,
        category: f.category || null,
        costCenter: f.costCenter || null,
        project: f.project || null,
        notes: f.notes || null,
        receivableId: f.linkFinanceId || null,
        payableId: f.linkFinanceId || null,
      }));
  }, [financeData]);

  // Lista unificada de lançamentos
  const allEntries = useMemo<AllEntry[]>(() => {
    // Conjuntos de vínculos para marcar itens em "Todos"
    const linkedRecIds = new Set(cashMovements.filter(m=>!!m.receivableId).map(m=>m.receivableId as string));
    const linkedPayIds = new Set(cashMovements.filter(m=>!!m.payableId).map(m=>m.payableId as string));
    const rec: AllEntry[] = receivables.map(r => ({
      id: r.id,
      date: r.date,
      dueDate: r.dueDate,
      kind: "RECEBER",
      party: r.customerName,
      description: r.description,
      amount: r.amount,
      status: r.status,
      paymentMethod: r.paymentMethod || null,
      category: r.category || null,
      notes: (r.notes ? (linkedRecIds.has(r.id) ? `${r.notes} (Vinculado)` : r.notes) : (linkedRecIds.has(r.id) ? "Vinculado" : null)),
    }));
    const pay: AllEntry[] = payables.map(p => ({
      id: p.id,
      date: p.date,
      dueDate: p.dueDate,
      kind: "PAGAR",
      party: p.supplierName,
      description: p.description,
      amount: p.amount,
      status: p.status,
      paymentMethod: p.paymentMethod || null,
      category: p.category || null,
      notes: (p.notes ? (linkedPayIds.has(p.id) ? `${p.notes} (Vinculado)` : p.notes) : (linkedPayIds.has(p.id) ? "Vinculado" : null)),
    }));
    const cash: AllEntry[] = cashMovements
      .filter(mv => !mv.receivableId && !mv.payableId)
      .map(mv => ({
      id: mv.id,
      date: mv.date,
      kind: "CAIXA",
      party: mv.type === "entrada" ? "Entrada de Caixa" : "Saída de Caixa",
      description: mv.description,
      amount: mv.amount, // pode ser negativo
      paymentMethod: mv.paymentMethod || null,
      category: mv.category || null,
      notes: mv.notes || null,
    }));
    return [...rec, ...pay, ...cash];
  }, [receivables, payables, cashMovements]);

  // Dialog de novo lançamento
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [launchType, setLaunchType] = useState<"receber" | "pagar">("receber");
  const [launchDate, setLaunchDate] = useState<string>(formatDateForInput(new Date()));
  const [launchDueDate, setLaunchDueDate] = useState<string>(formatDateForInput(new Date()));
  const [launchParty, setLaunchParty] = useState("");
  const [launchDesc, setLaunchDesc] = useState("");
  const [launchAmount, setLaunchAmount] = useState<string>("");
  const [launchDiscount, setLaunchDiscount] = useState<string>("");
  const [launchSurcharge, setLaunchSurcharge] = useState<string>("");
  const [launchDiscountType, setLaunchDiscountType] = useState<"valor" | "percentual">("valor");
  const [launchSurchargeType, setLaunchSurchargeType] = useState<"valor" | "percentual">("valor");
  const [launchPaid, setLaunchPaid] = useState<boolean>(false);
  const [isSimple, setIsSimple] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");
  const [launchStatus, setLaunchStatus] = useState<"aberto" | "pago" | "vencido">("aberto");
  const [launchRecurrence, setLaunchRecurrence] = useState<"nenhuma" | "mensal" | "semanal">("nenhuma");
  const [launchCategory, setLaunchCategory] = useState<string>("");
  const [launchCostCenter, setLaunchCostCenter] = useState<string>("");
  const [launchProject, setLaunchProject] = useState<string>("");
  const [launchPaymentMethod, setLaunchPaymentMethod] = useState<string>("");
  const [launchNotes, setLaunchNotes] = useState<string>("");
  const [launchError, setLaunchError] = useState<string>("");
  const [boletoLine, setBoletoLine] = useState<string>("");
  const [boletoError, setBoletoError] = useState<string>("");

  // UI helpers: validações em tempo real e destaques
  const amountNum = useMemo(() => parseFloat((launchAmount || "").replace(",", ".")), [launchAmount]);
  const invalidAmount = !amountNum || Number.isNaN(amountNum) || amountNum <= 0;
  const missingPayment = !launchPaymentMethod;
  const missingParty = launchType === "receber"
    ? (!selectedCustomerId && !isSimple ? true : (!selectedCustomerId && isSimple && !launchParty.trim()))
    : (!selectedSupplierId && !isSimple ? true : (!selectedSupplierId && isSimple && !launchParty.trim()));
  const dateOrderInvalid = launchDueDate < launchDate;

  // Carregar entidades para vinculação
  const { data: customers } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: suppliers } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const { data: sales } = useQuery<Sale[]>({ queryKey: ["/api/sales"] });
  const { data: projects } = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const { toast } = useToast();

  const selectedCustomerName = useMemo(() => customers?.find(c => c.id === selectedCustomerId)?.name || "", [customers, selectedCustomerId]);
  const selectedSupplierName = useMemo(() => suppliers?.find(s => s.id === selectedSupplierId)?.name || "", [suppliers, selectedSupplierId]);
  
  // Helper para buscar informações do projeto
  const getProjectInfo = (projectId?: string | null) => {
    if (!projectId || !projects) return null;
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return null;
    return {
      code: proj.code,
      name: proj.name
    };
  };

  // Autocomplete filtros
  const [customerFilter, setCustomerFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const filteredCustomers = useMemo(() => (customers || []).filter(c => (c.name || "").toLowerCase().includes(customerFilter.toLowerCase())), [customers, customerFilter]);
  const filteredSuppliers = useMemo(() => (suppliers || []).filter(s => (s.name || "").toLowerCase().includes(supplierFilter.toLowerCase())), [suppliers, supplierFilter]);

  // Sugestões e persistência para Categoria e Centro de Custo
  const LS_CATEGORIES = "finance.categories";
  const LS_COSTCENTERS = "finance.costCenters";
  const existingCategories = useMemo(() => Array.from(new Set((financeData||[]).map(f => f.category).filter(Boolean))) as string[], [financeData]);
  const existingCostCenters = useMemo(() => Array.from(new Set((financeData||[]).map(f => f.costCenter).filter(Boolean))) as string[], [financeData]);
  const [userCategories, setUserCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_CATEGORIES) || "[]"); } catch { return []; }
  });
  const [userCostCenters, setUserCostCenters] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_COSTCENTERS) || "[]"); } catch { return []; }
  });
  const categoryOptions = useMemo(() => Array.from(new Set([...(existingCategories||[]), ...userCategories])), [existingCategories, userCategories]);
  const costCenterOptions = useMemo(() => Array.from(new Set([...(existingCostCenters||[]), ...userCostCenters])), [existingCostCenters, userCostCenters]);
  function addCategoryOption() {
    const name = prompt("Nova categoria:")?.trim();
    if (!name) return;
    const next = Array.from(new Set([...(userCategories||[]), name]));
    setUserCategories(next);
    localStorage.setItem(LS_CATEGORIES, JSON.stringify(next));
    setLaunchCategory(name);
  }
  function addCostCenterOption() {
    const name = prompt("Novo centro de custo:")?.trim();
    if (!name) return;
    const next = Array.from(new Set([...(userCostCenters||[]), name]));
    setUserCostCenters(next);
    localStorage.setItem(LS_COSTCENTERS, JSON.stringify(next));
    setLaunchCostCenter(name);
  }

  function parseBoletoDate(factorStr: string): string | null {
    if (!/^[0-9]{4}$/.test(factorStr)) return null;
    const factor = parseInt(factorStr, 10);
    if (!Number.isFinite(factor) || factor <= 0) return null;
    const base = new Date(1997, 9, 7, 12, 0, 0, 0);
    base.setDate(base.getDate() + factor);
    return formatDateForInput(base);
  }

  function formatBoletoAmount(amountStr: string): string | null {
    if (!/^[0-9]{10}$/.test(amountStr)) return null;
    const raw = parseInt(amountStr, 10);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const value = (raw / 100).toFixed(2);
    return value.replace(".", ",");
  }

  function handleReadBoletoFromLine() {
    setBoletoError("");
    const digits = (boletoLine || "").replace(/[^0-9]/g, "");
    if (!digits) {
      setBoletoError("Informe a linha digitável do boleto.");
      return;
    }
    if (digits.length !== 47 && digits.length !== 48 && digits.length !== 44) {
      setBoletoError("Linha digitável inválida (tamanho incorreto).");
      return;
    }

    // Para simplificar, trabalhar com a representação de código de barras (44 dígitos)
    // Se vier com 47/48 dígitos, tentar reduzir para 44 removendo dígitos verificadores dos campos
    let barcode = digits;
    if (digits.length === 47 || digits.length === 48) {
      try {
        const campo1 = digits.slice(0, 9);
        const dv1 = digits.slice(9, 10);
        const campo2 = digits.slice(10, 20);
        const dv2 = digits.slice(20, 21);
        const campo3 = digits.slice(21, 31);
        const dv3 = digits.slice(31, 32);
        const resto = digits.slice(32);
        if (!/^[0-9]+$/.test(campo1+dv1+campo2+dv2+campo3+dv3+resto)) {
          throw new Error("formato inválido");
        }
        // Montar código de barras: 4 primeiros dígitos + DV geral + fator + valor + resto
        const bancoMoeda = campo1.slice(0, 4);
        const dvGeral = resto.slice(0, 1);
        const fator = resto.slice(1, 5);
        const valor = resto.slice(5, 15);
        const livre = campo1.slice(4, 9) + campo2.slice(0, 10) + campo3.slice(0, 10);
        barcode = bancoMoeda + dvGeral + fator + valor + livre;
      } catch {
        // Se não conseguir converter, seguir usando os 44 primeiros dígitos
        barcode = digits.slice(0, 44);
      }
    }

    if (barcode.length !== 44) {
      setBoletoError("Não foi possível interpretar a linha digitável do boleto.");
      return;
    }

    const fator = barcode.slice(5, 9);
    const valorStr = barcode.slice(9, 19);
    let parsedDate = parseBoletoDate(fator);
    const parsedAmount = formatBoletoAmount(valorStr);

    if (parsedDate) {
      // Validar se a data faz sentido (não muito antiga ou muito distante)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setFullYear(today.getFullYear() - 1); // até 1 ano atrás
      const maxDate = new Date(today);
      maxDate.setFullYear(today.getFullYear() + 5); // até 5 anos à frente
      const d = new Date(parsedDate);
      if (d < minDate || d > maxDate || isNaN(d.getTime())) {
        parsedDate = null;
      }
    }

    if (!parsedDate && !parsedAmount) {
      setBoletoError("Não foi possível extrair vencimento e valor do boleto.");
      return;
    }

    if (parsedDate) {
      setLaunchDueDate(parsedDate);
    } else if (!parsedAmount) {
      setBoletoError("Não foi possível determinar um vencimento válido a partir da linha digitável.");
    }
    if (parsedAmount) {
      setLaunchAmount(parsedAmount);
    }
    if (!launchDesc.trim()) {
      setLaunchDesc("Pagamento de boleto");
    }

    toast({
      title: "Boleto lido",
      description: `${parsedDate ? "Vencimento atualizado. " : ""}${parsedAmount ? "Valor atualizado." : ""}`.trim() || "Dados atualizados a partir da linha digitável.",
    });
  }

  // Filtering helpers
  function inRange(dateStr: string, from: string, to: string) {
    if (from && dateStr < from) return false;
    if (to && dateStr > to) return false;
    return true;
  }
  function withinAmount(amount: number, minStr: string, maxStr: string) {
    const min = minStr ? parseFloat(minStr.replace(",", ".")) : undefined;
    const max = maxStr ? parseFloat(maxStr.replace(",", ".")) : undefined;
    if (min != null && amount < min) return false;
    if (max != null && amount > max) return false;
    return true;
  }
  function sortItems<T>(arr: T[], by: any, dir: "asc"|"desc") {
    const s = [...arr].sort((a: any, b: any) => {
      const va = a[by];
      const vb = b[by];
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
    return dir === "asc" ? s : s.reverse();
  }

  // Apply filters + sort + paginate - All
  const filteredAllEntriesAll = useMemo(() => {
    let list = allEntries.filter(e => [
      e.party, 
      e.description, 
      e.notes, 
      e.category, 
      e.paymentMethod,
      e.amount.toString(),
      formatDatePtBR(e.date),
      e.dueDate ? formatDatePtBR(e.dueDate) : "",
      e.status || ""
    ].some(f => (f || "").toString().toLowerCase().includes(allSearch.toLowerCase())));
    list = list.filter(e => inRange(e.date, allDateFrom, allDateTo));
    if (allKind !== "todos") list = list.filter(e => e.kind === allKind);
    if (allStatus !== "todos") list = list.filter(e => (e.kind === "CAIXA" ? false : e.status === allStatus));
    if (allPayment) list = list.filter(e => (e.paymentMethod || "").toLowerCase() === allPayment.toLowerCase());
    list = list.filter(e => withinAmount(e.amount, allMin, allMax));
    // Vence hoje (aplica somente para Receber/Pagar)
    if (allDueToday) {
      const today = toDateOnly(new Date());
      list = list.filter(e => e.kind !== "CAIXA" && toDateOnly((e.dueDate || e.date)) === today);
    }
    // Custom sort: vencidos primeiro; ao ordenar por data, usar dueDate para Receber/Pagar e date para Caixa
    list = [...list].sort((a, b) => {
      const aOver = a.kind !== "CAIXA" && a.status === "vencido" ? 0 : 1;
      const bOver = b.kind !== "CAIXA" && b.status === "vencido" ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver; // vencidos primeiro
      // Escolha de campo de ordenação
      const by = allSortBy;
      let va: any;
      let vb: any;
      if (by === "date") {
        // Em "Todos", ordenar por Data de Lançamento (sempre 'date') para todos os tipos
        va = a.date;
        vb = b.date;
      } else {
        va = (a as any)[by];
        vb = (b as any)[by];
      }
      if (va < vb) return allSortDir === "asc" ? -1 : 1;
      if (va > vb) return allSortDir === "asc" ? 1 : -1;
      // Tie-breakers: amount desc, then party asc
      if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
      const ap = (a.party || "").toLowerCase();
      const bp = (b.party || "").toLowerCase();
      if (ap < bp) return -1;
      if (ap > bp) return 1;
      return 0;
    });
    return list;
  }, [allEntries, allSearch, allDateFrom, allDateTo, allKind, allStatus, allPayment, allMin, allMax, allSortBy, allSortDir]);
  const allTotalPages = Math.max(1, Math.ceil(filteredAllEntriesAll.length / allPageSize));
  const filteredAllEntries = filteredAllEntriesAll.slice((allPage-1)*allPageSize, (allPage)*allPageSize);

  // Apply filters + sort + paginate - Receivables
  const filteredReceivablesAll = useMemo(() => {
    let list = receivables.filter(r => [
      r.customerName, 
      r.description, 
      r.notes, 
      r.category, 
      r.costCenter, 
      r.project, 
      r.paymentMethod,
      r.amount.toString(),
      formatDatePtBR(r.date),
      formatDatePtBR(r.dueDate),
      r.status
    ].some(f => (f || "").toString().toLowerCase().includes(searchReceivables.toLowerCase())));
    // Filtro por Data de Lançamento (não por vencimento)
    list = list.filter(r => inRange(r.date, rcvDateFrom, rcvDateTo));
    if (rcvStatus !== "todos") list = list.filter(r => r.status === rcvStatus);
    if (rcvPayment) list = list.filter(r => (r.paymentMethod || "").toLowerCase() === rcvPayment.toLowerCase());
    if (rcvOnlyOverdue) list = list.filter(r => r.status === "vencido");
    list = list.filter(r => withinAmount(r.amount, rcvMin, rcvMax));
    if (rcvDueToday) {
      const today = toDateOnly(new Date());
      list = list.filter(r => toDateOnly(r.dueDate || r.date) === today);
    }
    // Custom sort: vencidos primeiro; por padrão usar dueDate asc quando rcvSortBy === "dueDate"
    list = [...list].sort((a, b) => {
      const aOver = a.status === "vencido" ? 0 : 1;
      const bOver = b.status === "vencido" ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const by = rcvSortBy;
      let va: any = (a as any)[by];
      let vb: any = (b as any)[by];
      if (by === "date" || by === "dueDate") {
        va = by === "dueDate" ? a.dueDate : a.date;
        vb = by === "dueDate" ? b.dueDate : b.date;
      }
      if (va < vb) return rcvSortDir === "asc" ? -1 : 1;
      if (va > vb) return rcvSortDir === "asc" ? 1 : -1;
      // Tie-breakers: amount desc, then customerName asc
      if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
      const an = (a.customerName || "").toLowerCase();
      const bn = (b.customerName || "").toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    return list;
  }, [receivables, searchReceivables, rcvDateFrom, rcvDateTo, rcvStatus, rcvPayment, rcvOnlyOverdue, rcvMin, rcvMax, rcvSortBy, rcvSortDir]);
  const rcvTotalPages = Math.max(1, Math.ceil(filteredReceivablesAll.length / rcvPageSize));
  const filteredReceivables = filteredReceivablesAll.slice((rcvPage-1)*rcvPageSize, (rcvPage)*rcvPageSize);

  // Apply filters + sort + paginate - Payables
  const filteredPayablesAll = useMemo(() => {
    let list = payables.filter(p => [
      p.supplierName, 
      p.description, 
      p.notes, 
      p.category, 
      p.costCenter, 
      p.project, 
      p.paymentMethod,
      p.amount.toString(),
      formatDatePtBR(p.date),
      formatDatePtBR(p.dueDate),
      p.status
    ].some(f => (f || "").toString().toLowerCase().includes(searchPayables.toLowerCase())));
    // Filtro por Data de Lançamento (não por vencimento)
    list = list.filter(p => inRange(p.date, pblDateFrom, pblDateTo));
    if (pblStatus !== "todos") list = list.filter(p => p.status === pblStatus);
    if (pblPayment) list = list.filter(p => (p.paymentMethod || "").toLowerCase() === pblPayment.toLowerCase());
    if (pblOnlyOverdue) list = list.filter(p => p.status === "vencido");
    list = list.filter(p => withinAmount(p.amount, pblMin, pblMax));
    if (pblDueToday) {
      const today = toDateOnly(new Date());
      list = list.filter(p => toDateOnly(p.dueDate || p.date) === today);
    }
    // Custom sort: vencidos primeiro; por padrão usar dueDate asc quando pblSortBy === "dueDate"
    list = [...list].sort((a, b) => {
      const aOver = a.status === "vencido" ? 0 : 1;
      const bOver = b.status === "vencido" ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const by = pblSortBy;
      let va: any = (a as any)[by];
      let vb: any = (b as any)[by];
      if (by === "date" || by === "dueDate") {
        va = by === "dueDate" ? a.dueDate : a.date;
        vb = by === "dueDate" ? b.dueDate : b.date;
      }
      if (va < vb) return pblSortDir === "asc" ? -1 : 1;
      if (va > vb) return pblSortDir === "asc" ? 1 : -1;
      // Tie-breakers: amount desc, then supplierName asc
      if (a.amount !== b.amount) return a.amount > b.amount ? -1 : 1;
      const an = (a.supplierName || "").toLowerCase();
      const bn = (b.supplierName || "").toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
    return list;
  }, [payables, searchPayables, pblDateFrom, pblDateTo, pblStatus, pblPayment, pblOnlyOverdue, pblMin, pblMax, pblSortBy, pblSortDir]);
  const pblTotalPages = Math.max(1, Math.ceil(filteredPayablesAll.length / pblPageSize));
  const filteredPayables = filteredPayablesAll.slice((pblPage-1)*pblPageSize, (pblPage)*pblPageSize);

  // Cálculos derivados
  const initialCash = 0; // sem saldo inicial mock
  
  // Series para gráficos conforme filtros
  const { chartLabels, chartIn, chartOut, chartNet } = useMemo(() => {
    const labels: string[] = [];
    const inVals: number[] = [];
    const outVals: number[] = [];
    const netVals: number[] = [];
    const withinType = (t: "entrada"|"saida") => chartType === "ambos" || chartType === t;
    // Helper to push sum
    function sumFor(predicate: (d: CashMovement) => boolean): number {
      return cashMovements.filter(predicate).reduce((s, mv) => s + Math.abs(mv.amount), 0);
    }
    if (chartGranularity === "mes") {
      // 12 meses do ano selecionado
      for (let m = 1; m <= 12; m++) {
        labels.push(`${m.toString().padStart(2, "0")}/${chartYear}`);
        const inSum = withinType("entrada") ? sumFor(d => parseYMD(d.date).y === chartYear && parseYMD(d.date).m === m && d.amount >= 0) : 0;
        const outSum = withinType("saida") ? sumFor(d => parseYMD(d.date).y === chartYear && parseYMD(d.date).m === m && d.amount < 0) : 0;
        inVals.push(inSum);
        outVals.push(outSum);
        // saldo do período sempre considera ambas as direções
        const netSum = sumFor(d => parseYMD(d.date).y === chartYear && parseYMD(d.date).m === m && d.amount >= 0) -
                       sumFor(d => parseYMD(d.date).y === chartYear && parseYMD(d.date).m === m && d.amount < 0);
        netVals.push(Math.abs(netSum));
      }
    } else if (chartGranularity === "dia") {
      // dias do mês/ano selecionados
      const daysInMonth = new Date(chartYear, chartMonth, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        labels.push(`${d.toString().padStart(2, "0")}/${chartMonth.toString().padStart(2, "0")}`);
        const inSum = withinType("entrada") ? sumFor(x => parseYMD(x.date).y === chartYear && parseYMD(x.date).m === chartMonth && parseYMD(x.date).d === d && x.amount >= 0) : 0;
        const outSum = withinType("saida") ? sumFor(x => parseYMD(x.date).y === chartYear && parseYMD(x.date).m === chartMonth && parseYMD(x.date).d === d && x.amount < 0) : 0;
        inVals.push(inSum);
        outVals.push(outSum);
        const netSum = sumFor(x => parseYMD(x.date).y === chartYear && parseYMD(x.date).m === chartMonth && parseYMD(x.date).d === d && x.amount >= 0) -
                       sumFor(x => parseYMD(x.date).y === chartYear && parseYMD(x.date).m === chartMonth && parseYMD(x.date).d === d && x.amount < 0);
        netVals.push(Math.abs(netSum));
      }
    } else {
      // anos: últimos 5 até chartYear
      for (let y = chartYear - 4; y <= chartYear; y++) {
        labels.push(String(y));
        const inSum = withinType("entrada") ? sumFor(x => parseYMD(x.date).y === y && x.amount >= 0) : 0;
        const outSum = withinType("saida") ? sumFor(x => parseYMD(x.date).y === y && x.amount < 0) : 0;
        inVals.push(inSum);
        outVals.push(outSum);
        const netSum = sumFor(x => parseYMD(x.date).y === y && x.amount >= 0) -
                       sumFor(x => parseYMD(x.date).y === y && x.amount < 0);
        netVals.push(Math.abs(netSum));
      }
    }
    return { chartLabels: labels, chartIn: inVals, chartOut: outVals, chartNet: netVals };
  }, [cashMovements, chartGranularity, chartType, chartYear, chartMonth]);
  const chartTotals = useMemo(() => {
    const inSum = chartIn.reduce((s, v) => s + v, 0);
    const outSum = chartOut.reduce((s, v) => s + v, 0);
    return { inSum, outSum, net: inSum - outSum };
  }, [chartIn, chartOut]);
  // Altura proporcional ao maior valor das séries visíveis
  const barHeightPx = 160; // dentro de h-48
  const maxValVisible = useMemo(() => {
    const vals:number[] = [];
    if (chartType === "ambos" || chartType === "entrada") vals.push(...chartIn);
    if (chartType === "ambos" || chartType === "saida") vals.push(...chartOut);
    if (chartShowNet) vals.push(...chartNet);
    const m = Math.max(0, ...vals);
    return m || 1; // evita divisão por zero
  }, [chartIn, chartOut, chartNet, chartType, chartShowNet]);
  const barH = (v:number) => `${Math.max(4, Math.round((Math.abs(v) / maxValVisible) * barHeightPx))}px`;
  const receivablesOpen = receivables.filter(r => r.status !== "pago" && r.status !== "cancelado").reduce((s, r) => s + r.amount, 0);
  const payablesOpen = payables.filter(p => p.status !== "pago" && p.status !== "cancelado").reduce((s, p) => s + p.amount, 0);
  // Saldo de Caixa real: considerar Receber/Pagar/Caixa (todos os movimentos de caixa, inclusive vinculados)
  const cashBalance = initialCash + cashMovements
    .reduce((s, mv) => s + mv.amount, 0);

  // Gráfico: fluxo mensal baseado nos movimentos de caixa (entradas - saídas)
  const currentYear = new Date().getFullYear();
  const monthlyNet = Array.from({ length: 12 }, (_, m) => {
    return cashMovements
      .filter(mv => {
        const { y, m: mm } = parseYMD(mv.date);
        return y === currentYear && (mm - 1) === m;
      })
      .reduce((s, mv) => s + mv.amount, 0);
  });
  const monthlyIn = Array.from({ length: 12 }, (_, m) => {
    return cashMovements
      .filter(mv => {
        const { y, m: mm } = parseYMD(mv.date);
        return y === currentYear && (mm - 1) === m && mv.type === "entrada";
      })
      .reduce((s, mv) => s + Math.max(0, mv.amount), 0);
  });
  const monthlyOut = Array.from({ length: 12 }, (_, m) => {
    return cashMovements
      .filter(mv => {
        const { y, m: mm } = parseYMD(mv.date);
        return y === currentYear && (mm - 1) === m && mv.type === "saida";
      })
      .reduce((s, mv) => s + Math.abs(mv.amount), 0);
  });

  const dreSummary = useMemo(() => {
    const inPeriod = (dateStr: string) => inRange(dateStr, dreDateFrom, dreDateTo);
    type DreRow = { centro: string; categoria: string; receitas: number; despesas: number; resultado: number };
    const map = new Map<string, DreRow>();

    const ensureRow = (rawCentro: string | null | undefined, rawCategoria: string | null | undefined) => {
      const centro = (rawCentro && rawCentro.trim()) || "Sem centro de custo";
      const categoria = (rawCategoria && rawCategoria.trim()) || "Sem categoria";
      const key = `${centro}__${categoria}`;
      if (!map.has(key)) {
        map.set(key, { centro, categoria, receitas: 0, despesas: 0, resultado: 0 });
      }
      return map.get(key)!;
    };

    for (const r of receivables) {
      if (r.status === "cancelado") continue;
      const refDate = r.dueDate || r.date;
      if (!inPeriod(refDate)) continue;
      const row = ensureRow(r.costCenter || null, r.category || null);
      const disc = (r as any).discount ?? r.discount ?? 0;
      const net = r.amount - (disc || 0);
      row.receitas += net;
    }

    for (const p of payables) {
      if (p.status === "cancelado") continue;
      const refDate = p.dueDate || p.date;
      if (!inPeriod(refDate)) continue;
      const row = ensureRow(p.costCenter || null, p.category || null);
      const add = (p as any).surcharge ?? p.surcharge ?? 0;
      const net = p.amount + (add || 0);
      row.despesas += net;
    }

    const porCentro = Array.from(map.values()).map(row => ({
      ...row,
      resultado: row.receitas - row.despesas,
    }));

    porCentro.sort((a, b) => {
      const c = a.centro.localeCompare(b.centro, "pt-BR");
      if (c !== 0) return c;
      return a.categoria.localeCompare(b.categoria, "pt-BR");
    });

    const totalReceitas = porCentro.reduce((s, r) => s + r.receitas, 0);
    const totalDespesas = porCentro.reduce((s, r) => s + r.despesas, 0);
    const resultado = totalReceitas - totalDespesas;

    return {
      totalReceitas,
      totalDespesas,
      resultado,
      porCentro,
    };
  }, [receivables, payables, dreDateFrom, dreDateTo]);

  async function handleAddLaunch() {
    const amount = parseFloat(launchAmount.replace(",", "."));
      const discount = parseFloat(launchDiscount.replace(",", ".")) || 0;
      const surcharge = parseFloat(launchSurcharge.replace(",", ".")) || 0;
      const discountType = launchDiscountType === "percentual" ? "PERCENTAGE" : "FIXED_VALUE";    // validação de valor (> 0)
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setLaunchError("Informe um valor válido maior que zero.");
      toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" });
      return;
    }
    
    // validação de desconto/acréscimo
    if (launchType === "receber" && (discount < 0 || Number.isNaN(discount))) {
      setLaunchError("Informe um valor de desconto válido.");
      toast({ title: "Desconto inválido", description: "O desconto deve ser um valor válido.", variant: "destructive" });
      return;
    }
    
    if (launchType === "pagar" && (surcharge < 0 || Number.isNaN(surcharge))) {
      setLaunchError("Informe um valor de acréscimo válido.");
      toast({ title: "Acréscimo inválido", description: "O acréscimo deve ser um valor válido.", variant: "destructive" });
      return;
    }
    // validação de vínculo/parte (aceita vinculado OU nome livre)
    if (launchType === "receber") {
      const hasParty = (!!selectedCustomerId) || (!!launchParty.trim());
      if (!hasParty) { setLaunchError("Informe o cliente (vínculo ou nome livre)."); return; }
    } else {
      const hasParty = (!!selectedSupplierId) || (!!launchParty.trim());
      if (!hasParty) { setLaunchError("Informe o fornecedor (vínculo ou nome livre)."); return; }
    }
    // validação de meio de pagamento
    if (!launchPaymentMethod) { setLaunchError("Informe o meio de pagamento."); return; }
    // passou na validação
    setLaunchError("");
    const statusUi: "aberto" | "pago" | "vencido" = launchPaid ? "pago" : launchStatus;
    const statusApi = statusUi === "pago" ? "PAID" : (statusUi === "vencido" ? "OVERDUE" : "OPEN");
    const recurrenceApi = launchRecurrence === "mensal" ? "MONTHLY" : (launchRecurrence === "semanal" ? "WEEKLY" : "NONE");
    const entryType = launchType === "receber" ? "RECEIVABLE" : "PAYABLE";
    const partyName = (launchType === "receber" ? selectedCustomerName : selectedSupplierName) || launchParty;
    const discountTypeApi = launchDiscountType === "percentual" ? "PERCENTAGE" : "FIXED_VALUE";
    const surchargeTypeApi = launchSurchargeType === "percentual" ? "PERCENTAGE" : "FIXED_VALUE";
    const payload: any = {
      entryType,
      status: statusApi,
      date: launchDate,
      dueDate: launchDueDate || launchDate,
      description: launchDesc,
      partyName,
      customerId: launchType === "receber" ? (selectedCustomerId || undefined) : undefined,
      supplierId: launchType === "pagar" ? (selectedSupplierId || undefined) : undefined,
      saleId: selectedSaleId || undefined,
      amount: amount,
      discount: launchType === "receber" ? discount : undefined,
      discountType: launchType === "receber" ? discountTypeApi : undefined,
      surcharge: launchType === "pagar" ? surcharge : undefined,
      surchargeType: launchType === "pagar" ? surchargeTypeApi : undefined,
      paymentMethod: launchPaymentMethod || undefined,
      recurrence: recurrenceApi,
      category: launchCategory || undefined,
      costCenter: launchCostCenter || undefined,
      project: launchProject || undefined,
      notes: launchNotes || undefined,
    };
    console.log('handleLaunch - Sending payload to /api/finance:', payload);
    const res = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) { setLaunchError("Falha ao salvar lançamento."); toast({ title: "Erro", description: "Falha ao salvar lançamento", variant: "destructive" }); return; }
    const created: Finance = await res.json();
    // se pago, disparar movimento vinculado
    if (statusApi === "PAID") {
      await fetch(`/api/finance/${created.id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: launchDate, paymentMethod: launchPaymentMethod || undefined, notes: launchNotes || undefined }) });
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    // reset e fechar
    setIsLaunchOpen(false);
    setLaunchParty("");
    setLaunchDesc("");
    setLaunchAmount("");
    setLaunchDiscount("");
    setLaunchSurcharge("");
    toast({ title: "Lançamento criado", description: created.description || "Registro adicionado." });
    setLaunchPaid(false);
    setIsSimple(false);
    setSelectedCustomerId("");
    setSelectedSupplierId("");
    setSelectedSaleId("");
    setLaunchStatus("aberto");
    setLaunchRecurrence("nenhuma");
    setLaunchCategory("");
    setLaunchCostCenter("");
    setLaunchProject("");
    setLaunchPaymentMethod("");
    setLaunchNotes("");
    setLaunchDueDate(formatDateForInput(new Date()));
    setLaunchError("");
  }

  // Dialog de novo movimento de caixa (avulso ou vinculado)
  const [isCashOpen, setIsCashOpen] = useState(false);
  const [mvType, setMvType] = useState<"entrada" | "saida">("entrada");
  const [mvDate, setMvDate] = useState<string>(formatDateForInput(new Date()));
  const [mvDesc, setMvDesc] = useState("");
  const [mvAmount, setMvAmount] = useState("");
  const [mvPaymentMethod, setMvPaymentMethod] = useState("");
  const [mvCategory, setMvCategory] = useState("");
  const [mvCostCenter, setMvCostCenter] = useState("");
  const [mvProject, setMvProject] = useState("");
  const [mvNotes, setMvNotes] = useState("");
  const [linkReceivableId, setLinkReceivableId] = useState("");
  const [linkPayableId, setLinkPayableId] = useState("");
  const [mvError, setMvError] = useState("");
  const [linkReceivableFilter, setLinkReceivableFilter] = useState("");
  const [linkPayableFilter, setLinkPayableFilter] = useState("");
  const linkFilteredReceivables = useMemo(() => receivables
    .filter(r=>r.status!=="pago")
    .filter(r=> (r.customerName + " " + r.description).toLowerCase().includes(linkReceivableFilter.toLowerCase())), [receivables, linkReceivableFilter]);
  const linkFilteredPayables = useMemo(() => payables
    .filter(p=>p.status!=="pago")
    .filter(p=> (p.supplierName + " " + p.description).toLowerCase().includes(linkPayableFilter.toLowerCase())), [payables, linkPayableFilter]);

  async function handleAddCashMovement() {
    const amountNum = parseFloat(mvAmount);
    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) { setMvError("Informe um valor válido maior que zero."); toast({ title: "Valor inválido", description: "Informe um valor maior que zero.", variant: "destructive" }); return; }
    if (!mvDesc.trim()) { setMvError("Informe uma descrição para o movimento."); toast({ title: "Descrição obrigatória", description: "Preencha o campo descrição.", variant: "destructive" }); return; }
    if (linkReceivableId && linkPayableId) { setMvError("Vincule apenas a um tipo: Receber OU Pagar."); toast({ title: "Vínculo inválido", description: "Escolha apenas Receber ou Pagar.", variant: "destructive" }); return; }
    setMvError("");
    const signed = mvType === "entrada" ? amountNum : -amountNum;
    const payload: any = {
      entryType: "CASH",
      status: "PAID",
      date: mvDate,
      dueDate: mvDate,
      description: mvDesc,
      amount: signed,
      paymentMethod: mvPaymentMethod || undefined,
      category: mvCategory || undefined,
      costCenter: mvCostCenter || undefined,
      project: mvProject || undefined,
      notes: mvNotes || undefined,
      linkFinanceId: linkReceivableId || linkPayableId || undefined,
    };
    console.log('handleAddCashMovement - Sending payload to /api/finance:', payload);
    const res = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      setMvError(errorData.error || "Erro ao registrar movimento de caixa.");
      toast({ 
        title: "Erro ao registrar", 
        description: errorData.error || "Não foi possível salvar o movimento.", 
        variant: "destructive" 
      });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
    toast({ 
      title: "Movimento registrado", 
      description: `Movimento de ${mvType} de R$ ${amountNum.toFixed(2)} cadastrado com sucesso.` 
    });
    // reset e fechar
    setIsCashOpen(false);
    setMvType("entrada");
    setMvDate(formatDateForInput(new Date()));
    setMvDesc("");
    setMvAmount("");
    setMvPaymentMethod("");
    setMvCategory("");
    setMvCostCenter("");
    setMvProject("");
    setMvNotes("");
    setLinkReceivableId("");
    setLinkPayableId("");
    setMvError("");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header com Cards de Resumo Modernos */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                  <DollarSign className="h-8 w-8 text-white" />
                </div>
                Gestão Financeira
              </h1>
              <p className="text-slate-600 mt-1">Controle completo de contas a receber, pagar e fluxo de caixa</p>
            </div>

            {/* Botão Novo Lançamento */}
            <Dialog open={isLaunchOpen} onOpenChange={(o) => { setIsLaunchOpen(o); if (!o) setLaunchError(""); }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 px-6 py-3 rounded-xl flex items-center gap-2 font-semibold">
                  <Plus className="h-5 w-5" />
                  Novo Lançamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border-0">
                <DialogHeader className="pb-6 border-b border-slate-200">
                  <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    Novo Lançamento Financeiro
                  </DialogTitle>
                  <DialogDescription className="text-slate-600">
                    Registre uma conta a receber ou a pagar. Lançamentos marcados como pagos afetam automaticamente o caixa.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-8 py-6">
                  {launchError && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">Erro de validação</p>
                        <p className="text-red-700 text-sm">{launchError}</p>
                      </div>
                    </div>
                  )}

                  {/* Tipo de Lançamento */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-200">
                    <label className="text-sm font-semibold text-slate-700 mb-4 block flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      Tipo de Lançamento
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        type="button"
                        variant={launchType === "receber" ? "default" : "outline"}
                        onClick={() => setLaunchType("receber")}
                        className={clsx(
                          "h-16 text-lg font-semibold transition-all duration-200",
                          launchType === "receber"
                            ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg transform scale-105"
                            : "border-2 border-slate-300 hover:border-emerald-300 hover:bg-emerald-50"
                        )}
                      >
                        <ArrowDownCircle className="h-6 w-6 mr-3" />
                        💰 A Receber
                      </Button>
                      <Button
                        type="button"
                        variant={launchType === "pagar" ? "default" : "outline"}
                        onClick={() => setLaunchType("pagar")}
                        className={clsx(
                          "h-16 text-lg font-semibold transition-all duration-200",
                          launchType === "pagar"
                            ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg transform scale-105"
                            : "border-2 border-slate-300 hover:border-red-300 hover:bg-red-50"
                        )}
                      >
                        <ArrowUpCircle className="h-6 w-6 mr-3" />
                        💸 A Pagar
                      </Button>
                    </div>
                  </div>

                  {/* Informações Básicas */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <label className="text-sm font-semibold text-slate-700 mb-4 block flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-600" />
                      Informações Básicas
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-slate-500" />
                          Data do Lançamento
                        </label>
                        <Input
                          type="date"
                          value={launchDate}
                          onChange={(e) => setLaunchDate(e.target.value)}
                          className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-slate-500" />
                          Data de Vencimento
                        </label>
                        <Input
                          type="date"
                          value={launchDueDate}
                          onChange={(e) => setLaunchDueDate(e.target.value)}
                          className="h-12 text-base border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div className="mt-6 space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500" />
                        Descrição
                      </label>
                      <Textarea
                        value={launchDescription}
                        onChange={(e) => setLaunchDescription(e.target.value)}
                        placeholder="Descreva o lançamento financeiro..."
                        className="min-h-20 resize-none border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Valor e Ajustes */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <label className="text-sm font-semibold text-slate-700 mb-4 block flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-slate-600" />
                      Valor e Ajustes
                    </label>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-slate-500" />
                          Valor Principal <span className="text-red-500">*</span>
                        </label>
                        <NumericFormat
                          className={clsx(
                            "border-2 rounded-xl px-4 py-4 w-full text-2xl font-bold text-center transition-all duration-200",
                            "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                            invalidAmount && "ring-2 ring-red-300 focus:ring-red-500 border-red-300"
                          )}
                          value={launchAmount}
                          thousandSeparator="."
                          decimalSeparator=","
                          decimalScale={2}
                          fixedDecimalScale
                          allowNegative={false}
                          placeholder="R$ 0,00"
                          onValueChange={(v) => setLaunchAmount(v.value)}
                        />
                      </div>

                      {/* Desconto/Acréscimo */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {launchType === "receber" ? (
                          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border border-amber-200 shadow-sm">
                            <label className="text-sm font-semibold text-amber-800 mb-4 block flex items-center gap-2">
                              <Percent className="h-5 w-5 text-amber-600" />
                              Desconto
                            </label>
                            <div className="flex gap-3 mb-4">
                              <button
                                type="button"
                                onClick={() => setLaunchDiscountType("valor")}
                                className={clsx(
                                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                  launchDiscountType === "valor"
                                    ? "bg-amber-600 text-white shadow-md transform scale-105"
                                    : "bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                                )}
                              >
                                💰 R$ Valor
                              </button>
                              <button
                                type="button"
                                onClick={() => setLaunchDiscountType("percentual")}
                                className={clsx(
                                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                  launchDiscountType === "percentual"
                                    ? "bg-amber-600 text-white shadow-md transform scale-105"
                                    : "bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                                )}
                              >
                                📊 % Percentual
                              </button>
                            </div>
                            <NumericFormat
                              className="border-2 rounded-lg px-3 py-3 w-full text-lg font-semibold border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                              value={launchDiscount}
                              thousandSeparator="."
                              decimalSeparator=","
                              decimalScale={2}
                              fixedDecimalScale
                              allowNegative={false}
                              placeholder={launchDiscountType === "percentual" ? "0,00 %" : "R$ 0,00"}
                              onValueChange={(v) => setLaunchDiscount(v.value)}
                            />
                          </div>
                        ) : (
                          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 rounded-xl border border-red-200 shadow-sm">
                            <label className="text-sm font-semibold text-red-800 mb-4 block flex items-center gap-2">
                              <TrendingUp className="h-5 w-5 text-red-600" />
                              Acréscimo (Multas/Juros)
                            </label>
                            <div className="flex gap-3 mb-4">
                              <button
                                type="button"
                                onClick={() => setLaunchSurchargeType("valor")}
                                className={clsx(
                                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                  launchSurchargeType === "valor"
                                    ? "bg-red-600 text-white shadow-md transform scale-105"
                                    : "bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400"
                                )}
                              >
                                💰 R$ Valor
                              </button>
                              <button
                                type="button"
                                onClick={() => setLaunchSurchargeType("percentual")}
                                className={clsx(
                                  "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                                  launchSurchargeType === "percentual"
                                    ? "bg-red-600 text-white shadow-md transform scale-105"
                                    : "bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400"
                                )}
                              >
                                📊 % Percentual
                              </button>
                            </div>
                            <NumericFormat
                              className="border-2 rounded-lg px-3 py-3 w-full text-lg font-semibold border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                              value={launchSurcharge}
                              thousandSeparator="."
                              decimalSeparator=","
                              decimalScale={2}
                              fixedDecimalScale
                              allowNegative={false}
                              placeholder={launchSurchargeType === "percentual" ? "0,00 %" : "R$ 0,00"}
                              onValueChange={(v) => setLaunchSurcharge(v.value)}
                            />
                          </div>
                        )}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                          <label className="text-sm font-semibold text-blue-800 mb-4 block flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-blue-600" />
                            Valor Final
                          </label>
                          <div className="border-2 rounded-lg px-4 py-3 w-full text-xl font-bold bg-slate-50 text-center border-slate-300">
                            {(() => {
                              // Helper para parse com separadores brasileiros
                              const parseValue = (str: string) => {
                                if (!str) return 0;
                                // Remove espaços
                                str = str.trim();
                                // Remove "R$" e outros caracteres
                                str = str.replace(/[^\d.,]/g, '');
                                // Se houver vírgula, é decimal
                                if (str.includes(',')) {
                                  // Remove pontos (separador de milhar) e substitui vírgula por ponto
                                  str = str.replace(/\./g, '').replace(',', '.');
                                } else if (str.includes('.')) {
                                  // Se só tem ponto, pode ser milhar ou decimal
                                  // Conta quantos há após o último ponto
                                  const parts = str.split('.');
                                  if (parts[parts.length - 1].length <= 2) {
                                    // Último "ponto" tem 1-2 dígitos = decimal
                                    str = parts.join('').slice(0, -2) + '.' + parts[parts.length - 1];
                                  } else {
                                    // Remove todos os pontos (são separadores de milhar)
                                    str = str.replace(/\./g, '');
                                  }
                                }
                                return parseFloat(str) || 0;
                              };
                              
                              const amount = parseValue(launchAmount);
                              const discountValue = parseValue(launchDiscount);
                              const surchargeValue = parseValue(launchSurcharge);
                              
                              let final = amount;
                              if (launchType === "receber") {
                                // Desconto para recebível
                                if (launchDiscountType === "percentual") {
                                  final = amount - (amount * discountValue / 100);
                                } else {
                                  final = amount - discountValue;
                                }
                              } else {
                                // Acréscimo para pagável (pagar)
                                if (launchSurchargeType === "percentual") {
                                  final = amount + (amount * surchargeValue / 100);
                                } else {
                                  final = amount + surchargeValue;
                                }
                              }
                              
                              return final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marcar como Pago */}
                  <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
                    <div className="flex items-center gap-4">
                      <input
                        id="paid"
                        type="checkbox"
                        checked={launchPaid}
                        onChange={(e) => setLaunchPaid(e.target.checked)}
                        className="h-6 w-6 text-emerald-600 bg-white border-2 border-emerald-300 rounded focus:ring-emerald-500 focus:ring-2"
                      />
                      <div className="flex-1">
                        <label htmlFor="paid" className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Marcar como pago
                        </label>
                        <p className="text-sm text-emerald-700 mt-1">
                          Registra movimento de caixa automaticamente quando o lançamento for salvo.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                    <Button
                      variant="outline"
                      onClick={() => setIsLaunchOpen(false)}
                      size="lg"
                      className="px-8 py-3 text-base font-semibold border-2 border-slate-300 hover:bg-slate-50 transition-all duration-200"
                    >
                      <X className="h-5 w-5 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAddLaunch}
                      size="lg"
                      className="px-8 py-3 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Adicionar Lançamento
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card A Receber */}
            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm font-medium mb-1">A Receber</p>
                  <p className="text-3xl font-bold text-white mb-1">
                    {receivablesOpen.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-emerald-100 text-xs">Valores pendentes</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <ArrowDownCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>

            {/* Card A Pagar */}
            <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm font-medium mb-1">A Pagar</p>
                  <p className="text-3xl font-bold text-white mb-1">
                    {payablesOpen.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-red-100 text-xs">Valores pendentes</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <ArrowUpCircle className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>

            {/* Card Saldo de Caixa */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Saldo de Caixa</p>
                  <p className={`text-3xl font-bold text-white mb-1 ${
                    cashBalance >= 0 ? '' : 'text-red-200'
                  }`}>
                    {cashBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                  <p className="text-blue-100 text-xs">Disponível agora</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto px-6 py-8">
            <DialogHeader className="pb-6 border-b border-slate-200">
              <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                Novo Lançamento Financeiro
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Registre uma conta a receber ou a pagar. Lançamentos marcados como pagos afetam automaticamente o caixa.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-8 py-6">
              {launchError && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Erro de validação</p>
                    <p className="text-red-700 text-sm">{launchError}</p>
                  </div>
                </div>
              )}

              {/* Tipo de Lançamento */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 rounded-xl border border-slate-200">
                <label className="text-sm font-semibold text-slate-700 mb-4 block flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Tipo de Lançamento
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant={launchType === "receber" ? "default" : "outline"}
                    onClick={() => setLaunchType("receber")}
                    className={clsx(
                      "h-16 text-lg font-semibold transition-all duration-200",
                      launchType === "receber"
                        ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg transform scale-105"
                        : "border-2 border-slate-300 hover:border-emerald-300 hover:bg-emerald-50"
                    )}
                  >
                    <ArrowDownCircle className="h-6 w-6 mr-3" />
                    💰 A Receber
                  </Button>
                  <Button
                    type="button"
                    variant={launchType === "pagar" ? "default" : "outline"}
                    onClick={() => setLaunchType("pagar")}
                    className={clsx(
                      "h-16 text-lg font-semibold transition-all duration-200",
                      launchType === "pagar"
                        ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg transform scale-105"
                        : "border-2 border-slate-300 hover:border-red-300 hover:bg-red-50"
                    )}
                  >
                    <ArrowUpCircle className="h-6 w-6 mr-3" />
                    💸 A Pagar
                  </Button>
                </div>
              </div>
              {/* Datas */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Datas
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Data do Lançamento</label>
                    <div className="flex gap-2">
                      <Input type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} className="flex-1" />
                      <Button type="button" variant="outline" size="sm" onClick={() => setLaunchDate(formatDateForInput(new Date()))}>Hoje</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Vencimento</label>
                    <div className="flex gap-2">
                      <Input type="date" value={launchDueDate} onChange={(e) => setLaunchDueDate(e.target.value)} className={clsx("flex-1", dateOrderInvalid && "ring-2 ring-amber-300 focus:ring-amber-500")} />
                      <Button type="button" variant="outline" size="sm" onClick={() => setLaunchDueDate(formatDateForInput(new Date()))}>Hoje</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLaunchDueDate(formatDateForInput(new Date(Date.now()+7*24*3600*1000)))}>+7</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setLaunchDueDate(formatDateForInput(new Date(Date.now()+30*24*3600*1000)))}>+30</Button>
                    </div>
                  </div>
                </div>
                {dateOrderInvalid && (
                  <div className="text-amber-700 bg-amber-50 border-l-4 border-amber-500 rounded px-3 py-2 text-xs mt-2">⚠️ Vencimento anterior à data do lançamento.</div>
                )}
              </div>
              {/* Status e Configurações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">Status</label>
                  <select className="border rounded-md px-3 py-2 w-full" value={launchStatus} onChange={(e) => setLaunchStatus(e.target.value as any)}>
                    <option value="aberto">⏳ Pendente</option>
                    <option value="pago">✅ Pago</option>
                    <option value="vencido">⚠️ Vencido</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-2 block">Recorrência</label>
                  <select className="border rounded-md px-3 py-2 w-full" value={launchRecurrence} onChange={(e) => setLaunchRecurrence(e.target.value as any)}>
                    <option value="nenhuma">🔘 Nenhuma</option>
                    <option value="mensal">📅 Mensal</option>
                    <option value="semanal">🗓️ Semanal</option>
                  </select>
                </div>
              </div>
              
              <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-md border border-blue-200">
                <input id="simple" type="checkbox" checked={isSimple} onChange={(e) => setIsSimple(e.target.checked)} className="h-4 w-4" />
                <label htmlFor="simple" className="text-sm font-medium text-blue-900">📝 Lançamento simples (sem vínculo com cliente/fornecedor cadastrado)</label>
              </div>
              {/* Cliente/Fornecedor */}
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
                <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                  {launchType === "receber" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  {launchType === "receber" ? "Cliente" : "Fornecedor"} <span className="text-red-600">*</span>
                </label>
                {launchType === "receber" ? (
                  !isSimple ? (
                    <>
                      <Input placeholder="🔍 Filtrar clientes" value={customerFilter} onChange={(e)=> setCustomerFilter(e.target.value)} className="mb-2" />
                      <select className="border rounded-md px-3 py-2 w-full mb-3" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                        <option value="">👤 Selecione um cliente...</option>
                        {filteredCustomers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Vincular a uma Venda (opcional)</label>
                        <select className="border rounded-md px-3 py-2 w-full" value={selectedSaleId} onChange={(e) => setSelectedSaleId(e.target.value)}>
                          <option value="">🛒 Sem vínculo</option>
                          {(sales || []).map(s => (
                            <option key={s.id} value={s.id}>{s.number || s.id}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  ) : (
                    <Input className={clsx(missingParty && "ring-2 ring-red-300 focus:ring-red-500")} placeholder="Digite o nome do cliente" value={launchParty} onChange={(e) => setLaunchParty(e.target.value)} />
                  )
                ) : (
                  !isSimple ? (
                    <>
                      <Input placeholder="🔍 Filtrar fornecedores" value={supplierFilter} onChange={(e)=> setSupplierFilter(e.target.value)} className="mb-2" />
                      <select className={clsx("border rounded-md px-3 py-2 w-full", missingParty && "ring-2 ring-red-300 focus:ring-red-500")} value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)}>
                        <option value="">🏭 Selecione um fornecedor...</option>
                        {filteredSuppliers.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <Input className={clsx(missingParty && "ring-2 ring-red-300 focus:ring-red-500")} placeholder="Digite o nome do fornecedor" value={launchParty} onChange={(e) => setLaunchParty(e.target.value)} />
                  )
                )}
              </div>
              {/* Descrição */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descrição
                </label>
                <Input placeholder="Ex.: Venda #1001, Pagamento fornecedor, Recebimento de cliente..." value={launchDesc} onChange={(e) => setLaunchDesc(e.target.value)} />
              </div>
              
              {/* Informações Adicionais */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Classificação e Vínculos
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Categoria</label>
                    <div className="flex gap-2">
                      <select className="border rounded-md px-3 py-2 flex-1" value={launchCategory} onChange={(e)=> setLaunchCategory(e.target.value)}>
                        <option value="">📂 Selecione...</option>
                        {categoryOptions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <Button type="button" size="sm" variant="outline" onClick={addCategoryOption}>+</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Centro de Custo</label>
                    <div className="flex gap-2">
                      <select className="border rounded-md px-3 py-2 flex-1" value={launchCostCenter} onChange={(e)=> setLaunchCostCenter(e.target.value)}>
                        <option value="">🏛️ Selecione...</option>
                        {costCenterOptions.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <Button type="button" size="sm" variant="outline" onClick={addCostCenterOption}>+</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">
                      Projeto {launchType === "pagar" && <span className="text-xs text-blue-600 font-semibold">(vínculo automático com despesas)</span>}
                    </label>
                    <select className="border rounded-md px-3 py-2 w-full" value={launchProject} onChange={(e) => setLaunchProject(e.target.value)}>
                      <option value="">📋 Nenhum</option>
                      {(projects || [])
                        .filter(p => p.status !== 'concluido')
                        .map(proj => (
                          <option key={proj.id} value={proj.id}>
                            {proj.name} - {proj.number}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 mb-1 block">Meio de Pagamento <span className="text-red-600">*</span></label>
                    <select className={clsx("border rounded-md px-3 py-2 w-full", missingPayment && "ring-2 ring-red-300 focus:ring-red-500")} value={launchPaymentMethod} onChange={(e) => setLaunchPaymentMethod(e.target.value)} required>
                      <option value="">💳 Selecione...</option>
                      <option value="PIX">📱 PIX</option>
                      <option value="DINHEIRO">💵 Dinheiro</option>
                      <option value="DEBITO">💳 Débito</option>
                      <option value="CREDITO">💳 Crédito</option>
                      <option value="BOLETO">🧾 Boleto</option>
                    </select>
                  </div>
                </div>
              </div>
              {/* Observações */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Observações
                </label>
                <Input placeholder="Notas adicionais, informações complementares..." value={launchNotes} onChange={(e) => setLaunchNotes(e.target.value)} />
              </div>
              {launchType === "pagar" && launchPaymentMethod === "BOLETO" && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 space-y-2">
                  <label className="text-xs font-medium text-yellow-900 mb-1 block">
                    🧾 Leitura de boleto (opcional)
                  </label>
                  <div className="flex flex-col md:flex-row gap-2">
                    <Input
                      placeholder="Cole ou leia a linha digitável do boleto"
                      value={boletoLine}
                      onChange={(e) => setBoletoLine(e.target.value)}
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" onClick={handleReadBoletoFromLine}>
                      Ler boleto
                    </Button>
                  </div>
                  {boletoError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1" role="alert" aria-live="assertive">
                      {boletoError}
                    </div>
                  )}
                  <p className="text-[11px] text-yellow-800">
                    Ao ler o boleto, o sistema tenta preencher automaticamente o vencimento e o valor. Você pode ajustar os dados manualmente se precisar.
                  </p>
                </div>
              )}
              {/* Valor e Ajustes */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <label className="text-sm font-semibold text-slate-700 mb-4 block flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-slate-600" />
                  Valor e Ajustes
                </label>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-slate-500" />
                      Valor Principal <span className="text-red-500">*</span>
                    </label>
                    <NumericFormat
                      className={clsx(
                        "border-2 rounded-xl px-4 py-4 w-full text-2xl font-bold text-center transition-all duration-200",
                        "border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                        invalidAmount && "ring-2 ring-red-300 focus:ring-red-500 border-red-300"
                      )}
                      value={launchAmount}
                      thousandSeparator="."
                      decimalSeparator=","
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      placeholder="R$ 0,00"
                      onValueChange={(v) => setLaunchAmount(v.value)}
                    />
                  </div>

                  {/* Desconto/Acréscimo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {launchType === "receber" ? (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-xl border border-amber-200 shadow-sm">
                        <label className="text-sm font-semibold text-amber-800 mb-4 block flex items-center gap-2">
                          <Percent className="h-5 w-5 text-amber-600" />
                          Desconto
                        </label>
                        <div className="flex gap-3 mb-4">
                          <button
                            type="button"
                            onClick={() => setLaunchDiscountType("valor")}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                              launchDiscountType === "valor"
                                ? "bg-amber-600 text-white shadow-md transform scale-105"
                                : "bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                            )}
                          >
                            💰 R$ Valor
                          </button>
                          <button
                            type="button"
                            onClick={() => setLaunchDiscountType("percentual")}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                              launchDiscountType === "percentual"
                                ? "bg-amber-600 text-white shadow-md transform scale-105"
                                : "bg-white text-amber-700 border-2 border-amber-300 hover:bg-amber-50 hover:border-amber-400"
                            )}
                          >
                            📊 % Percentual
                          </button>
                        </div>
                        <NumericFormat
                          className="border-2 rounded-lg px-3 py-3 w-full text-lg font-semibold border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
                          value={launchDiscount}
                          thousandSeparator="."
                          decimalSeparator=","
                          decimalScale={2}
                          fixedDecimalScale
                          allowNegative={false}
                          placeholder={launchDiscountType === "percentual" ? "0,00 %" : "R$ 0,00"}
                          onValueChange={(v) => setLaunchDiscount(v.value)}
                        />
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-red-50 to-rose-50 p-5 rounded-xl border border-red-200 shadow-sm">
                        <label className="text-sm font-semibold text-red-800 mb-4 block flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-red-600" />
                          Acréscimo (Multas/Juros)
                        </label>
                        <div className="flex gap-3 mb-4">
                          <button
                            type="button"
                            onClick={() => setLaunchSurchargeType("valor")}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                              launchSurchargeType === "valor"
                                ? "bg-red-600 text-white shadow-md transform scale-105"
                                : "bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400"
                            )}
                          >
                            💰 R$ Valor
                          </button>
                          <button
                            type="button"
                            onClick={() => setLaunchSurchargeType("percentual")}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                              launchSurchargeType === "percentual"
                                ? "bg-red-600 text-white shadow-md transform scale-105"
                                : "bg-white text-red-700 border-2 border-red-300 hover:bg-red-50 hover:border-red-400"
                            )}
                          >
                            📊 % Percentual
                          </button>
                        </div>
                        <NumericFormat
                          className="border-2 rounded-lg px-3 py-3 w-full text-lg font-semibold border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all duration-200"
                          value={launchSurcharge}
                          thousandSeparator="."
                          decimalSeparator=","
                          decimalScale={2}
                          fixedDecimalScale
                          allowNegative={false}
                          placeholder={launchSurchargeType === "percentual" ? "0,00 %" : "R$ 0,00"}
                          onValueChange={(v) => setLaunchSurcharge(v.value)}
                        />
                      </div>
                    )}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200 shadow-sm">
                      <label className="text-sm font-semibold text-blue-800 mb-4 block flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-blue-600" />
                        Valor Final
                      </label>
                      <div className="border-2 rounded-lg px-4 py-3 w-full text-xl font-bold bg-slate-50 text-center border-slate-300">
                        {(() => {
                          // Helper para parse com separadores brasileiros
                          const parseValue = (str: string) => {
                            if (!str) return 0;
                            // Remove espaços
                            str = str.trim();
                            // Remove "R$" e outros caracteres
                            str = str.replace(/[^\d.,]/g, '');
                            // Se houver vírgula, é decimal
                            if (str.includes(',')) {
                              // Remove pontos (separador de milhar) e substitui vírgula por ponto
                              str = str.replace(/\./g, '').replace(',', '.');
                            } else if (str.includes('.')) {
                              // Se só tem ponto, pode ser milhar ou decimal
                              // Conta quantos há após o último ponto
                              const parts = str.split('.');
                              if (parts[parts.length - 1].length <= 2) {
                                // Último "ponto" tem 1-2 dígitos = decimal
                                str = parts.join('').slice(0, -2) + '.' + parts[parts.length - 1];
                              } else {
                                // Remove todos os pontos (são separadores de milhar)
                                str = str.replace(/\./g, '');
                              }
                            }
                            return parseFloat(str) || 0;
                          };
                          
                          const amount = parseValue(launchAmount);
                          const discountValue = parseValue(launchDiscount);
                          const surchargeValue = parseValue(launchSurcharge);
                          
                          let final = amount;
                          if (launchType === "receber") {
                            // Desconto para recebível
                            if (launchDiscountType === "percentual") {
                              final = amount - (amount * discountValue / 100);
                            } else {
                              final = amount - discountValue;
                            }
                          } else {
                            // Acréscimo para pagável (pagar)
                            if (launchSurchargeType === "percentual") {
                              final = amount + (amount * surchargeValue / 100);
                            } else {
                              final = amount + surchargeValue;
                            }
                          }
                          
                          return final.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Marcar como Pago */}
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-6 rounded-xl border border-emerald-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <input
                    id="paid"
                    type="checkbox"
                    checked={launchPaid}
                    onChange={(e) => setLaunchPaid(e.target.checked)}
                    className="h-6 w-6 text-emerald-600 bg-white border-2 border-emerald-300 rounded focus:ring-emerald-500 focus:ring-2"
                  />
                  <div className="flex-1">
                    <label htmlFor="paid" className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" />
                      Marcar como pago
                    </label>
                    <p className="text-sm text-emerald-700 mt-1">
                      Registra movimento de caixa automaticamente quando o lançamento for salvo.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Ações */}
              <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                <Button
                  variant="outline"
                  onClick={() => setIsLaunchOpen(false)}
                  size="lg"
                  className="px-8 py-3 text-base font-semibold border-2 border-slate-300 hover:bg-slate-50 transition-all duration-200"
                >
                  <X className="h-5 w-5 mr-2" />
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddLaunch}
                  size="lg"
                  className="px-8 py-3 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Adicionar Lançamento
                </Button>
              </div>
            </div>

        {/* Editar Lançamento */}
        <Dialog open={isEditOpen} onOpenChange={(o) => { setIsEditOpen(o); if (!o) setEditError(""); }}>
          <DialogContent className="md:max-w-screen-md md:w-[700px]">
            <DialogHeader>
              <DialogTitle>Editar Lançamento</DialogTitle>
              <DialogDescription>
                {editLocked ? "Lançamento pago - somente leitura." : "Atualize as informações do lançamento selecionado."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {editError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2" role="alert" aria-live="assertive">{editError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Tipo</label>
                <Input className="sm:col-span-2" value={editType === "receber" ? "A Receber" : "A Pagar"} readOnly />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Data</label>
                <Input className="sm:col-span-2" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} disabled={editLocked} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Vencimento</label>
                <Input className="sm:col-span-2" type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={editLocked} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Status</label>
                <select className="border rounded px-2 py-1 sm:col-span-2" value={editStatus} onChange={(e)=> setEditStatus(e.target.value as any)} disabled={editLocked}>
                  <option value="aberto">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="vencido">Vencido</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Recorrência</label>
                <select className="border rounded px-2 py-1 sm:col-span-2" value={editRecurrence} onChange={(e)=> setEditRecurrence(e.target.value as any)} disabled={editLocked}>
                  <option value="nenhuma">Nenhuma</option>
                  <option value="mensal">Mensal</option>
                  <option value="semanal">Semanal</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">{editType === "receber" ? "Cliente" : "Fornecedor"}</label>
                <Input className="sm:col-span-2" value={editParty} onChange={(e) => setEditParty(e.target.value)} disabled={editLocked || editType === "receber"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Descrição</label>
                <Input className="sm:col-span-2" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} disabled={editLocked} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm w-36 text-muted-foreground">Categoria</label>
                  <select className="border rounded px-2 py-1 flex-1" value={editCategory} onChange={(e)=> setEditCategory(e.target.value)} disabled={editLocked}>
                    <option value="">Selecione...</option>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm w-36 text-muted-foreground">Centro de Custo</label>
                  <select className="border rounded px-2 py-1 flex-1" value={editCostCenter} onChange={(e)=> setEditCostCenter(e.target.value)} disabled={editLocked}>
                    <option value="">Selecione...</option>
                    {costCenterOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm w-36 text-muted-foreground">Projeto</label>
                  <Input placeholder="Opcional" value={editProject} onChange={(e)=> setEditProject(e.target.value)} disabled={editLocked} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm w-36 text-muted-foreground">Meio de Pagamento <span className="text-red-600">*</span></label>
                  <select className="border rounded px-2 py-1 flex-1" value={editPaymentMethod} onChange={(e)=> setEditPaymentMethod(e.target.value)} disabled={editLocked} required>
                    <option value="">Selecione...</option>
                    <option value="PIX">PIX</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="DEBITO">Débito</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="BOLETO">Boleto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Observações</label>
                <Input className="sm:col-span-2" placeholder="Notas adicionais" value={editNotes} onChange={(e)=> setEditNotes(e.target.value)} disabled={editLocked} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <label className="text-sm text-muted-foreground">Valor</label>
                <div className="sm:col-span-2">
                  <NumericFormat
                    className={clsx("border rounded px-2 py-1 w-full")}
                    value={editAmount}
                    thousandSeparator="."
                    decimalSeparator="," 
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    placeholder="0,00"
                    onValueChange={(v) => setEditAmount(v.value)}
                    disabled={editLocked}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {editType === "receber" ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Percent className="h-4 w-4 text-amber-600" />
                      Desconto
                    </label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setEditDiscountType("valor")}
                        disabled={editLocked}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                          editDiscountType === "valor"
                            ? "bg-amber-600 text-white"
                            : "bg-white text-amber-600 border border-amber-300 hover:bg-amber-100"
                        }`}
                      >
                        R$ Valor
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditDiscountType("percentual")}
                        disabled={editLocked}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                          editDiscountType === "percentual"
                            ? "bg-amber-600 text-white"
                            : "bg-white text-amber-600 border border-amber-300 hover:bg-amber-100"
                        }`}
                      >
                        % Percentual
                      </button>
                    </div>
                    <NumericFormat
                      className="border rounded px-2 py-1 w-full"
                      value={editDiscount}
                      thousandSeparator="."
                      decimalSeparator="," 
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      placeholder={editDiscountType === "percentual" ? "0,00 %" : "0,00"}
                      onValueChange={(v) => setEditDiscount(v.value)}
                      disabled={editLocked}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-red-600" />
                      Acréscimo (Multas/Juros)
                    </label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setEditSurchargeType("valor")}
                        disabled={editLocked}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                          editSurchargeType === "valor"
                            ? "bg-red-600 text-white"
                            : "bg-white text-red-600 border border-red-300 hover:bg-red-100"
                        }`}
                      >
                        R$ Valor
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSurchargeType("percentual")}
                        disabled={editLocked}
                        className={`flex-1 px-2 py-1 rounded text-xs font-semibold transition ${
                          editSurchargeType === "percentual"
                            ? "bg-red-600 text-white"
                            : "bg-white text-red-600 border border-red-300 hover:bg-red-100"
                        }`}
                      >
                        % Percentual
                      </button>
                    </div>
                    <NumericFormat
                      className="border rounded px-2 py-1 w-full"
                      value={editSurcharge}
                      thousandSeparator="."
                      decimalSeparator="," 
                      decimalScale={2}
                      fixedDecimalScale
                      allowNegative={false}
                      placeholder={editSurchargeType === "percentual" ? "0,00 %" : "0,00"}
                      onValueChange={(v) => setEditSurcharge(v.value)}
                      disabled={editLocked}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-sm text-muted-foreground flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    Valor Final
                  </label>
                  <div className="border rounded px-2 py-1 w-full bg-gray-50 text-right font-semibold">
                    {(() => {
                      // Helper para parse com separadores brasileiros
                      const parseValue = (str: string) => {
                        if (!str) return 0;
                        // Remove espaços
                        str = str.trim();
                        // Remove "R$" e outros caracteres
                        str = str.replace(/[^\d.,]/g, '');
                        // Se houver vírgula, é decimal
                        if (str.includes(',')) {
                          // Remove pontos (separador de milhar) e substitui vírgula por ponto
                          str = str.replace(/\./g, '').replace(',', '.');
                        } else if (str.includes('.')) {
                          // Se só tem ponto, pode ser milhar ou decimal
                          // Conta quantos há após o último ponto
                          const parts = str.split('.');
                          if (parts[parts.length - 1].length <= 2) {
                            // Último "ponto" tem 1-2 dígitos = decimal
                            str = parts.join('').slice(0, -2) + '.' + parts[parts.length - 1];
                          } else {
                            // Remove todos os pontos (são separadores de milhar)
                            str = str.replace(/\./g, '');
                          }
                        }
                        return parseFloat(str) || 0;
                      };
                      
                      const base = parseValue(editAmount);
                      const discountValue = parseValue(editDiscount);
                      const surchargeValue = parseValue(editSurcharge);
                      
                      let final = base;
                      if (editType === "receber") {
                        // Desconto para recebível
                        if (editDiscountType === "percentual") {
                          final = base - (base * discountValue / 100);
                        } else {
                          final = base - discountValue;
                        }
                      } else {
                        // Acréscimo para pagável
                        if (editSurchargeType === "percentual") {
                          final = base + (base * surchargeValue / 100);
                        } else {
                          final = base + surchargeValue;
                        }
                      }
                      
                      return final.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                {!editLocked && <Button onClick={handleSaveEdit}>Salvar</Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      

      <Tabs defaultValue="receber" className="bg-white rounded-lg shadow-md p-2">
        <TabsList className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-lg">
          <TabsTrigger value="receber" className="flex items-center gap-2 data-[state=active]:bg-green-600 data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" />
            Contas a Receber
          </TabsTrigger>
          <TabsTrigger value="pagar" className="flex items-center gap-2 data-[state=active]:bg-red-600 data-[state=active]:text-white">
            <TrendingDown className="h-4 w-4" />
            Contas a Pagar
          </TabsTrigger>
          <TabsTrigger value="caixa" className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Wallet className="h-4 w-4" />
            Caixa
          </TabsTrigger>
          <TabsTrigger value="todos" className="flex items-center gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FileText className="h-4 w-4" />
            Todos
          </TabsTrigger>
          <TabsTrigger value="dre" className="flex items-center gap-2 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
            <Briefcase className="h-4 w-4" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="graficos" className="flex items-center gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" />
            Gráficos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="receber" className="mt-4">
          <Card className="shadow-lg border-green-100">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <ArrowDownCircle className="h-5 w-5" />
                  Contas a Receber
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        const resp = await fetch('/api/sales/ensure-receivables-bulk', { method: 'POST' });
                        if (!resp.ok) throw new Error(await resp.text());
                        await queryClient.invalidateQueries({ queryKey: ["/api/finance"] });
                        toast({ title: 'Recebíveis garantidos', description: 'Recebíveis de vendas concluídas foram verificados.' });
                      } catch (e) {
                        console.error('Bulk ensure receivables failed', e);
                        toast({ title: 'Erro', description: 'Falha ao garantir recebíveis', variant: 'destructive' });
                      }
                    }}
                  >
                    Garantir Recebíveis
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Buscar por cliente ou descrição" value={searchReceivables} onChange={(e)=>{ setSearchReceivables(e.target.value); setRcvPage(1); }} />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Data de Lançamento de</label>
                    <Input type="date" value={rcvDateFrom} onChange={(e)=>{ setRcvDateFrom(e.target.value); setRcvPage(1); }} />
                    <label className="text-sm text-muted-foreground">até</label>
                    <Input type="date" value={rcvDateTo} onChange={(e)=>{ setRcvDateTo(e.target.value); setRcvPage(1); }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="border rounded px-2 py-1" value={rcvStatus} onChange={(e)=>{ setRcvStatus(e.target.value as any); setRcvPage(1); }}>
                      <option value="todos">Todos</option>
                      <option value="aberto">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={rcvPayment} onChange={(e)=>{ setRcvPayment(e.target.value); setRcvPage(1); }}>
                      <option value="">Pagamento...</option>
                      <option value="PIX">PIX</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="DEBITO">Débito</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="BOLETO">Boleto</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Valor mín</label>
                    <Input type="number" step="0.01" value={rcvMin} onChange={(e)=>{ setRcvMin(e.target.value); setRcvPage(1); }} />
                    <label className="text-sm text-muted-foreground">máx</label>
                    <Input type="number" step="0.01" value={rcvMax} onChange={(e)=>{ setRcvMax(e.target.value); setRcvPage(1); }} />
                    <div className="flex items-center gap-2 ml-2">
                      <input id="rcvOver" type="checkbox" checked={rcvOnlyOverdue} onChange={(e)=>{ setRcvOnlyOverdue(e.target.checked); setRcvPage(1); }} />
                      <label htmlFor="rcvOver" className="text-sm">Somente vencidos</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="rcvDue" type="checkbox" checked={rcvDueToday} onChange={(e)=>{ setRcvDueToday(e.target.checked); setRcvPage(1); }} />
                      <label htmlFor="rcvDue" className="text-sm">Vence hoje</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Ordenar</label>
                    <select className="border rounded px-2 py-1" value={rcvSortBy} onChange={(e)=> setRcvSortBy(e.target.value as any)}>
                      <option value="date">Data de Lançamento</option>
                      <option value="dueDate">Vencimento</option>
                      <option value="amount">Valor</option>
                      <option value="status">Status</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={rcvSortDir} onChange={(e)=> setRcvSortDir(e.target.value as any)}>
                      <option value="asc">Crescente</option>
                      <option value="desc">Decrescente</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input id="rcvColDue" type="checkbox" checked={rcvCols.dueDate} onChange={(e)=> setRcvCols(v=>({ ...v, dueDate: e.target.checked }))} />
                      <label htmlFor="rcvColDue" className="text-sm">Mostrar Vencimento</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="rcvColPay" type="checkbox" checked={rcvCols.payment} onChange={(e)=> setRcvCols(v=>({ ...v, payment: e.target.checked }))} />
                      <label htmlFor="rcvColPay" className="text-sm">Mostrar Pagamento</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="rcvColNotes" type="checkbox" checked={rcvCols.notes} onChange={(e)=> setRcvCols(v=>({ ...v, notes: e.target.checked }))} />
                      <label htmlFor="rcvColNotes" className="text-sm">Mostrar Observações</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Data de Lançamento</TableHead>
                    {rcvCols.dueDate && <TableHead>Vencimento</TableHead>}
                    <TableHead>Cliente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    {rcvCols.payment && <TableHead>Pagamento</TableHead>}
                    {rcvCols.notes && <TableHead>Obs.</TableHead>}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.map((r) => {
                    const projectInfo = getProjectInfo(r.projectId);
                    return (
                    <TableRow
                      key={r.id}
                      className={`${
                        r.status === "cancelado" ? "text-gray-400 line-through" : ""
                      } ${
                        r.status === "vencido" ? "bg-red-50" : ""
                      }`}
                    >
                      <TableCell>
                        <span className="font-mono text-xs text-gray-600">{r.code || "-"}</span>
                      </TableCell>
                      <TableCell>{formatDatePtBR(r.date)}</TableCell>
                      {rcvCols.dueDate && (
                        <TableCell className={r.status === "vencido" ? "text-red-700 font-medium" : undefined}>
                          {formatDatePtBR(r.dueDate)}
                        </TableCell>
                      )}
                      <TableCell>{r.customerName}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell>
                        {projectInfo ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-semibold text-indigo-700">{projectInfo.code}</span>
                            <span className="text-xs text-gray-600 truncate max-w-[200px]" title={projectInfo.name}>{projectInfo.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="capitalize">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium select-none ${
                          r.status === "pago" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                          r.status === "vencido" ? "bg-red-100 text-red-800 border border-red-200" :
                          r.status === "aberto" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}>
                          {r.status}
                        </span>
                      </TableCell>
                      {rcvCols.payment && <TableCell>{r.paymentMethod || ""}</TableCell>}
                      {rcvCols.notes && <TableCell>{r.notes || ""}</TableCell>}
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditFromReceivable(r)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Clonar Lançamento" onClick={() => cloneReceivable(r)} className="text-blue-600 hover:text-blue-700">
                          <Copy className="w-4 h-4" />
                        </Button>
                        {r.status !== "pago" && r.status !== "cancelado" && (
                          <Button variant="ghost" size="icon" title="Marcar como Pago" onClick={() => handleMarkPaid(r.id)}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {r.status !== "pago" && r.status !== "cancelado" && (
                          <Button variant="ghost" size="icon" title="Cancelar" onClick={() => handleCancel(r.id)}>
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {filteredReceivables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>Nenhum registro encontrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Por página</span>
                  <select className="border rounded px-2 py-1" value={rcvPageSize} onChange={(e)=> { setRcvPageSize(Number(e.target.value)); setRcvPage(1); }}>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={rcvPage<=1} onClick={()=> setRcvPage(p=> Math.max(1, p-1))}>Anterior</Button>
                  <span className="text-sm">Página {rcvPage} de {rcvTotalPages}</span>
                  <Button variant="outline" disabled={rcvPage>=rcvTotalPages} onClick={()=> setRcvPage(p=> Math.min(rcvTotalPages, p+1))}>Próxima</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagar" className="mt-4">
          <Card className="shadow-lg border-red-100">
            <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b border-red-100">
              <CardTitle className="flex items-center gap-2 text-red-800">
                <ArrowUpCircle className="h-5 w-5" />
                Contas a Pagar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Buscar por fornecedor ou descrição" value={searchPayables} onChange={(e)=>{ setSearchPayables(e.target.value); setPblPage(1); }} />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Data de Lançamento de</label>
                    <Input type="date" value={pblDateFrom} onChange={(e)=>{ setPblDateFrom(e.target.value); setPblPage(1); }} />
                    <label className="text-sm text-muted-foreground">até</label>
                    <Input type="date" value={pblDateTo} onChange={(e)=>{ setPblDateTo(e.target.value); setPblPage(1); }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="border rounded px-2 py-1" value={pblStatus} onChange={(e)=>{ setPblStatus(e.target.value as any); setPblPage(1); }}>
                      <option value="todos">Todos</option>
                      <option value="aberto">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={pblPayment} onChange={(e)=>{ setPblPayment(e.target.value); setPblPage(1); }}>
                      <option value="">Pagamento...</option>
                      <option value="PIX">PIX</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="DEBITO">Débito</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="BOLETO">Boleto</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Valor mín</label>
                    <Input type="number" step="0.01" value={pblMin} onChange={(e)=>{ setPblMin(e.target.value); setPblPage(1); }} />
                    <label className="text-sm text-muted-foreground">máx</label>
                    <Input type="number" step="0.01" value={pblMax} onChange={(e)=>{ setPblMax(e.target.value); setPblPage(1); }} />
                    <div className="flex items-center gap-2 ml-2">
                      <input id="pblOver" type="checkbox" checked={pblOnlyOverdue} onChange={(e)=>{ setPblOnlyOverdue(e.target.checked); setPblPage(1); }} />
                      <label htmlFor="pblOver" className="text-sm">Somente vencidos</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="pblDue" type="checkbox" checked={pblDueToday} onChange={(e)=>{ setPblDueToday(e.target.checked); setPblPage(1); }} />
                      <label htmlFor="pblDue" className="text-sm">Vence hoje</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Ordenar</label>
                    <select className="border rounded px-2 py-1" value={pblSortBy} onChange={(e)=> setPblSortBy(e.target.value as any)}>
                      <option value="date">Data de Lançamento</option>
                      <option value="dueDate">Vencimento</option>
                      <option value="amount">Valor</option>
                      <option value="status">Status</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={pblSortDir} onChange={(e)=> setPblSortDir(e.target.value as any)}>
                      <option value="asc">Crescente</option>
                      <option value="desc">Decrescente</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input id="pblColDue" type="checkbox" checked={pblCols.dueDate} onChange={(e)=> setPblCols(v=>({ ...v, dueDate: e.target.checked }))} />
                      <label htmlFor="pblColDue" className="text-sm">Mostrar Vencimento</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="pblColPay" type="checkbox" checked={pblCols.payment} onChange={(e)=> setPblCols(v=>({ ...v, payment: e.target.checked }))} />
                      <label htmlFor="pblColPay" className="text-sm">Mostrar Pagamento</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input id="pblColNotes" type="checkbox" checked={pblCols.notes} onChange={(e)=> setPblCols(v=>({ ...v, notes: e.target.checked }))} />
                      <label htmlFor="pblColNotes" className="text-sm">Mostrar Observações</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <div className="min-w-[900px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Data de Lançamento</TableHead>
                    {pblCols.dueDate && <TableHead>Vencimento</TableHead>}
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    {pblCols.payment && <TableHead>Pagamento</TableHead>}
                    {pblCols.notes && <TableHead>Obs.</TableHead>}
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayables.map((p) => {
                    const projectInfo = getProjectInfo(p.projectId);
                    return (
                    <TableRow
                      key={p.id}
                      className={`${
                        p.status === "cancelado" ? "text-gray-400 line-through" : ""
                      } ${
                        p.status === "vencido" ? "bg-red-50" : ""
                      }`}
                    >
                      <TableCell>
                        <span className="font-mono text-xs text-gray-600">{p.code || "-"}</span>
                      </TableCell>
                      <TableCell>{formatDatePtBR(p.date)}</TableCell>
                      {pblCols.dueDate && (
                        <TableCell className={p.status === "vencido" ? "text-red-700 font-medium" : undefined}>
                          {formatDatePtBR(p.dueDate)}
                        </TableCell>
                      )}
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell>{p.description}</TableCell>
                      <TableCell>
                        {projectInfo ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-xs font-semibold text-indigo-700">{projectInfo.code}</span>
                            <span className="text-xs text-gray-600 truncate max-w-[200px]" title={projectInfo.name}>{projectInfo.name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{p.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="capitalize">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium select-none ${p.status === "pago" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                          p.status === "vencido" ? "bg-red-100 text-red-800 border border-red-200" :
                          p.status === "aberto" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                          p.status === "concluido" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                          "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}>
                          {p.status}
                        </span>
                      </TableCell>
                      {pblCols.payment && <TableCell>{p.paymentMethod || ""}</TableCell>}
                      {pblCols.notes && <TableCell>{p.notes || ""}</TableCell>}
                      <TableCell className="text-right space-x-2">
                        {p.status !== "concluido" && (
                          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditFromPayable(p)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Clonar Lançamento" onClick={() => clonePayable(p)} className="text-blue-600 hover:text-blue-700">
                          <Copy className="w-4 h-4" />
                        </Button>
                        {p.status !== "pago" && p.status !== "cancelado" && p.status !== "concluido" && (
                          <Button variant="ghost" size="icon" title="Marcar como Pago" onClick={() => handleMarkPaid(p.id)}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </Button>
                        )}
                        {p.status !== "pago" && p.status !== "cancelado" && p.status !== "concluido" && (
                          <Button variant="ghost" size="icon" title="Cancelar" onClick={() => handleCancel(p.id)}>
                            <XCircle className="w-4 h-4 text-red-600" />
                          </Button>
                        )}
                        {p.status !== "cancelado" && p.status !== "concluido" && (
                          <Button variant="ghost" size="icon" title="Marcar como Concluído" onClick={() => handleMarkCompleted(p.id)}>
                            <LockIcon className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                  {filteredPayables.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8}>Nenhum registro encontrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
                </div>
              </div>
            </CardContent>
            <div className="flex items-center justify-between mt-3 px-6 pb-6">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Por página</span>
                <select className="border rounded px-2 py-1" value={pblPageSize} onChange={(e)=> { setPblPageSize(Number(e.target.value)); setPblPage(1); }}>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={pblPage<=1} onClick={()=> setPblPage(p=> Math.max(1, p-1))}>Anterior</Button>
                <span className="text-sm">Página {pblPage} de {pblTotalPages}</span>
                <Button variant="outline" disabled={pblPage>=pblTotalPages} onClick={()=> setPblPage(p=> Math.min(pblTotalPages, p+1))}>Próxima</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          <Card className="shadow-lg border-indigo-100">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <FileText className="h-5 w-5" />
                Todos os Lançamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="Buscar por parte ou descrição" value={allSearch} onChange={(e)=>{ setAllSearch(e.target.value); setAllPage(1); }} />
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Data de Lançamento de</label>
                    <Input type="date" value={allDateFrom} onChange={(e)=>{ setAllDateFrom(e.target.value); setAllPage(1); }} />
                    <label className="text-sm text-muted-foreground">até</label>
                    <Input type="date" value={allDateTo} onChange={(e)=>{ setAllDateTo(e.target.value); setAllPage(1); }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select className="border rounded px-2 py-1" value={allKind} onChange={(e)=>{ setAllKind(e.target.value as any); setAllPage(1); }}>
                      <option value="todos">Tipos...</option>
                      <option value="RECEBER">A Receber</option>
                      <option value="PAGAR">A Pagar</option>
                      <option value="CAIXA">Caixa</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={allStatus} onChange={(e)=>{ setAllStatus(e.target.value as any); setAllPage(1); }}>
                      <option value="todos">Status...</option>
                      <option value="aberto">Pendente</option>
                      <option value="pago">Pago</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Valor mín</label>
                    <Input type="number" step="0.01" value={allMin} onChange={(e)=>{ setAllMin(e.target.value); setAllPage(1); }} />
                    <label className="text-sm text-muted-foreground">máx</label>
                    <Input type="number" step="0.01" value={allMax} onChange={(e)=>{ setAllMax(e.target.value); setAllPage(1); }} />
                    <div className="flex items-center gap-2 ml-2">
                      <input id="allDueToday" type="checkbox" checked={allDueToday} onChange={(e)=>{ setAllDueToday(e.target.checked); setAllPage(1); }} />
                      <label htmlFor="allDueToday" className="text-sm">Vence hoje</label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Pagamento</label>
                    <select className="border rounded px-2 py-1" value={allPayment} onChange={(e)=>{ setAllPayment(e.target.value); setAllPage(1); }}>
                      <option value="">Pagamento...</option>
                      <option value="PIX">PIX</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="DEBITO">Débito</option>
                      <option value="CREDITO">Crédito</option>
                      <option value="BOLETO">Boleto</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Ordenar</label>
                    <select className="border rounded px-2 py-1" value={allSortBy} onChange={(e)=> setAllSortBy(e.target.value as any)}>
                      <option value="date">Data de Lançamento</option>
                      <option value="amount">Valor</option>
                      <option value="status">Status</option>
                      <option value="kind">Tipo</option>
                    </select>
                    <select className="border rounded px-2 py-1" value={allSortDir} onChange={(e)=> setAllSortDir(e.target.value as any)}>
                      <option value="asc">Crescente</option>
                      <option value="desc">Decrescente</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <div className="min-w-[1100px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data de Lançamento</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Parte</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vínculo</TableHead>
                        <TableHead>Pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllEntries.map((e) => (
                        <TableRow
                          key={e.id}
                          className={`${
                            e.status === "cancelado" ? "text-gray-400 line-through" : ""
                          } ${
                            e.kind !== "CAIXA" && e.status === "vencido" ? "bg-red-50" : ""
                          }`}
                        >
                          <TableCell>{formatDatePtBR(e.date)}</TableCell>
                          <TableCell className={e.kind !== "CAIXA" && e.status === "vencido" ? "text-red-700 font-medium" : undefined}>
                            {e.kind === "CAIXA" ? "—" : (e.dueDate ? formatDatePtBR(e.dueDate) : "—")}
                          </TableCell>
                          <TableCell>{e.kind === "RECEBER" ? "A Receber" : e.kind === "PAGAR" ? "A Pagar" : "Caixa"}</TableCell>
                          <TableCell>{e.party}</TableCell>
                          <TableCell>{e.description}</TableCell>
                          <TableCell className={`text-right ${e.kind === "PAGAR" || (e.kind === "CAIXA" && e.amount < 0) ? "text-red-600" : "text-emerald-700"}`}>
                            {e.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="capitalize">
                            {e.kind === "CAIXA" ? (
                              "—"
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium select-none ${
                                e.status === "pago" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                e.status === "vencido" ? "bg-red-100 text-red-800 border border-red-200" :
                                e.status === "aberto" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                "bg-gray-100 text-gray-700 border border-gray-200"
                              }`}>
                                {e.status}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {e.kind === "CAIXA" ? "—" : (
                              <>
                                {((e as any).project) && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                    📊 Projeto
                                  </span>
                                )}
                                {!((e as any).project) && ((e.notes || "").toLowerCase().includes("vinculado") ? "Vinculado" : "—")}
                              </>
                            )}
                          </TableCell>
                          <TableCell>{e.paymentMethod || ""}</TableCell>
                        </TableRow>
                      ))}
                      {filteredAllEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9}>Nenhum registro encontrado</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Por página</span>
                  <select className="border rounded px-2 py-1" value={allPageSize} onChange={(e)=> { setAllPageSize(Number(e.target.value)); setAllPage(1); }}>
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={allPage<=1} onClick={()=> setAllPage(p=> Math.max(1, p-1))}>Anterior</Button>
                  <span className="text-sm">Página {allPage} de {allTotalPages}</span>
                  <Button variant="outline" disabled={allPage>=allTotalPages} onClick={()=> setAllPage(p=> Math.min(allTotalPages, p+1))}>Próxima</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="caixa" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-blue-100">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <Wallet className="h-5 w-5" />
                    Resumo do Caixa
                  </CardTitle>
                  <Dialog open={isCashOpen} onOpenChange={(o)=>{ setIsCashOpen(o); if (!o) setMvError(""); }}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="default">Novo Movimento</Button>
                    </DialogTrigger>
                    <DialogContent className="md:max-w-screen-lg md:w-[900px] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Novo Movimento de Caixa</DialogTitle>
                        <DialogDescription>Registre uma entrada ou saída avulsa, opcionalmente vinculando a um lançamento.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6">
                        {mvError && (
                          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2" role="alert" aria-live="assertive">{mvError}</div>
                        )}
                        
                        {/* Informações Principais */}
                        <div className="bg-gray-50 p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Informações Principais</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Tipo</label>
                              <select className="border rounded px-3 py-2 w-full" value={mvType} onChange={(e)=>setMvType(e.target.value as any)}>
                                <option value="entrada">Entrada</option>
                                <option value="saida">Saída</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Data</label>
                              <Input type="date" value={mvDate} onChange={(e)=>setMvDate(e.target.value)} />
                            </div>
                            <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                              <label className="text-sm text-muted-foreground">Descrição <span className="text-red-500">*</span></label>
                              <Input placeholder="Ex.: Ajuste de caixa" value={mvDesc} onChange={(e)=>setMvDesc(e.target.value)} required />
                            </div>
                          </div>
                          <div className="mt-4">
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Valor</label>
                              <NumericFormat
                                className={clsx("border rounded px-3 py-2 w-full text-lg font-semibold")}
                                value={mvAmount}
                                thousandSeparator="."
                                decimalSeparator="," 
                                decimalScale={2}
                                fixedDecimalScale
                                allowNegative={false}
                                placeholder="0,00"
                                onValueChange={(v) => setMvAmount(v.value)}
                              />
                            </div>
                          </div>
                        </div>
                        {/* Classificação e Pagamento */}
                        <div className="bg-blue-50 p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-blue-700 mb-3">Classificação e Pagamento</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Meio de Pagamento</label>
                              <select className="border rounded px-3 py-2 w-full" value={mvPaymentMethod} onChange={(e)=>setMvPaymentMethod(e.target.value)}>
                                <option value="">Selecione...</option>
                                <option value="PIX">PIX</option>
                                <option value="DINHEIRO">Dinheiro</option>
                                <option value="DEBITO">Débito</option>
                                <option value="CREDITO">Crédito</option>
                                <option value="BOLETO">Boleto</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Categoria</label>
                              <div className="flex gap-2">
                                <select className="border rounded px-3 py-2 flex-1" value={mvCategory} onChange={(e)=>setMvCategory(e.target.value)}>
                                  <option value="">Selecione...</option>
                                  {categoryOptions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <Button type="button" variant="outline" size="sm" onClick={addCategoryOption}>+</Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Centro de Custo</label>
                              <div className="flex gap-2">
                                <select className="border rounded px-3 py-2 flex-1" value={mvCostCenter} onChange={(e)=>setMvCostCenter(e.target.value)}>
                                  <option value="">Selecione...</option>
                                  {costCenterOptions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <Button type="button" variant="outline" size="sm" onClick={addCostCenterOption}>+</Button>
                              </div>
                            </div>
                            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                              <label className="text-sm text-muted-foreground">Projeto</label>
                              <Input placeholder="Opcional" value={mvProject} onChange={(e)=>setMvProject(e.target.value)} />
                            </div>
                          </div>
                        </div>
                        {/* Observações e Vínculos */}
                        <div className="bg-amber-50 p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-amber-700 mb-3">Observações e Vínculos</h4>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm text-muted-foreground">Observações</label>
                              <Input placeholder="Notas adicionais" value={mvNotes} onChange={(e)=>setMvNotes(e.target.value)} />
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-sm text-muted-foreground flex items-center gap-2">
                                  <ArrowDownCircle className="h-4 w-4 text-green-600" />
                                  Vincular a Conta a Receber
                                </label>
                                <div className="space-y-2">
                                  <Input 
                                    placeholder="Filtrar por cliente/descrição" 
                                    value={linkReceivableFilter} 
                                    onChange={(e)=> setLinkReceivableFilter(e.target.value)} 
                                  />
                                  <select 
                                    className="border rounded px-3 py-2 w-full" 
                                    value={linkReceivableId} 
                                    onChange={(e)=>{ 
                                      setLinkReceivableId(e.target.value); 
                                      if (e.target.value) setLinkPayableId(""); 
                                    }}
                                  >
                                    <option value="">Nenhum</option>
                                    {linkFilteredReceivables.map(r=> (
                                      <option key={r.id} value={r.id}>
                                        {formatDatePtBR(r.date)} - {r.customerName} - {r.amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm text-muted-foreground flex items-center gap-2">
                                  <ArrowUpCircle className="h-4 w-4 text-red-600" />
                                  Vincular a Conta a Pagar
                                </label>
                                <div className="space-y-2">
                                  <Input 
                                    placeholder="Filtrar por fornecedor/descrição" 
                                    value={linkPayableFilter} 
                                    onChange={(e)=> setLinkPayableFilter(e.target.value)} 
                                  />
                                  <select 
                                    className="border rounded px-3 py-2 w-full" 
                                    value={linkPayableId} 
                                    onChange={(e)=>{ 
                                      setLinkPayableId(e.target.value); 
                                      if (e.target.value) setLinkReceivableId(""); 
                                    }}
                                  >
                                    <option value="">Nenhum</option>
                                    {linkFilteredPayables.map(p=> (
                                      <option key={p.id} value={p.id}>
                                        {formatDatePtBR(p.date)} - {p.supplierName} - {p.amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={()=>setIsCashOpen(false)}>Cancelar</Button>
                          <Button onClick={handleAddCashMovement}>Adicionar</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {(() => {
                  const now = new Date();
                  const m = now.getMonth();
                  const y = now.getFullYear();
                  // Considerar apenas movimentos avulsos (sem vínculo)
                  const avulsos = cashMovements.filter(mv => !mv.receivableId && !mv.payableId);
                  const entradasMes = avulsos.filter(mv => {
                    const { y: yy, m: mm } = parseYMD(mv.date);
                    return mv.type === "entrada" && yy === y && (mm - 1) === m;
                  }).reduce((s, mv) => s + mv.amount, 0);
                  const saidasMes = avulsos.filter(mv => {
                    const { y: yy, m: mm } = parseYMD(mv.date);
                    return mv.type === "saida" && yy === y && (mm - 1) === m;
                  }).reduce((s, mv) => s + Math.abs(mv.amount), 0);
                  return (
                    <>
                      <div>Entradas no mês: <span className="text-emerald-700 font-medium">{entradasMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                      <div>Saídas no mês: <span className="text-red-700 font-medium">{saidasMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                      <div>Saldo atual: <span className="text-blue-700 font-medium">{cashBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                      {/* Nota removida: dados mock. Integração com backend pendente. */}
                    </>
                  );
                })()}
              </CardContent>
              </Card>
            <Card className="shadow-lg border-blue-100">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <CreditCard className="h-5 w-5" />
                  Movimentos de Caixa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <div className="min-w-[700px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data de Lançamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashMovements
                      .filter(mv => !mv.receivableId && !mv.payableId)
                      .map(mv => ({ d: mv.date, t: mv.type === "entrada" ? "Entrada" as const : "Saída" as const, desc: mv.description, v: mv.amount }))
                      .sort((a, b) => (a.d < b.d ? 1 : (a.d > b.d ? -1 : 0)))
                      .slice(0, 10)
                      .map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{formatDatePtBR(it.d)}</TableCell>
                        <TableCell className={it.t === "Entrada" ? "text-emerald-700" : "text-red-700"}>{it.t}</TableCell>
                        <TableCell>{it.desc}</TableCell>
                        <TableCell className={"text-right " + (it.v >= 0 ? "text-emerald-700" : "text-red-700")}>{it.v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="mt-4">
          <Card className="shadow-lg border-amber-100">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Briefcase className="h-5 w-5" />
                Análise DRE (Competência)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Competência de</label>
                    <Input
                      type="date"
                      value={dreDateFrom}
                      onChange={(e) => setDreDateFrom(e.target.value)}
                    />
                    <label className="text-sm text-muted-foreground">até</label>
                    <Input
                      type="date"
                      value={dreDateTo}
                      onChange={(e) => setDreDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Regime: competência (usa vencimento de receber/pagar)</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const now = new Date();
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        setDreDateFrom(`${y}-${m}-01`);
                        const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
                        setDreDateTo(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
                      }}
                    >
                      Mês atual
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDreDateFrom("");
                        setDreDateTo("");
                      }}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Centro de Custo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Receitas</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dreSummary.porCentro && dreSummary.porCentro.length > 0 ? (
                      <>
                        {dreSummary.porCentro.map((row: any) => (
                          <TableRow key={`${row.centro}__${row.categoria}`}>
                            <TableCell>{row.centro}</TableCell>
                            <TableCell>{row.categoria}</TableCell>
                            <TableCell className="text-right text-emerald-700">
                              {row.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right text-red-700">
                              {row.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${row.resultado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                            >
                              {row.resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-amber-50 font-semibold">
                          <TableCell colSpan={2}>Total Geral</TableCell>
                          <TableCell className="text-right text-emerald-700">
                            {dreSummary.totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-right text-red-700">
                            {dreSummary.totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell
                            className={`text-right ${dreSummary.resultado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}
                          >
                            {dreSummary.resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5}>Nenhum lançamento encontrado no período selecionado.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graficos" className="mt-4">
          <Card className="shadow-lg border-purple-100">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <TrendingUp className="h-5 w-5" />
                Fluxo Mensal
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportChartAsPng}>Baixar PNG</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Granularidade</label>
                  <select className="border rounded px-2 py-1" value={chartGranularity} onChange={e=>setChartGranularity(e.target.value as any)}>
                    <option value="dia">Dia</option>
                    <option value="mes">Mês</option>
                    <option value="ano">Ano</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Tipo</label>
                  <select className="border rounded px-2 py-1" value={chartType} onChange={e=>setChartType(e.target.value as any)}>
                    <option value="ambos">Entradas e Saídas</option>
                    <option value="entrada">Somente Entradas</option>
                    <option value="saida">Somente Saídas</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="accent-emerald-600" checked={chartShowValues} onChange={e=>setChartShowValues(e.target.checked)} />
                  Mostrar valores
                </label>
                {(chartGranularity === "dia" || chartGranularity === "mes") && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Ano</label>
                    <Input type="number" value={chartYear} onChange={e=>setChartYear(Number(e.target.value||new Date().getFullYear()))} className="w-28" />
                  </div>
                )}
                {chartGranularity === "dia" && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Mês/Ano</label>
                    <Input type="month" value={`${chartYear}-${String(chartMonth).padStart(2,'0')}`}
                      onChange={(e)=>{
                        const [y,m] = e.target.value.split('-').map(Number);
                        if (y) setChartYear(y);
                        if (m) setChartMonth(m);
                      }} />
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" className="accent-sky-600" checked={chartShowNet} onChange={e=>setChartShowNet(e.target.checked)} />
                  Mostrar Saldo (terceira barra)
                </label>
              </div>
              {/* Gráfico simples em CSS (barras lado a lado: Entradas x Saídas) */}
              <div ref={chartRef} className="grid grid-cols-12 gap-2 items-end h-48 bg-white p-2 rounded">
                {chartLabels.map((label, i) => (
                  <div key={label} className="grid items-end h-full gap-1"
                       style={{ display: 'grid', gridTemplateColumns: `repeat(${(chartType!=="saida"?1:0)+(chartType!=="entrada"?1:0)+(chartShowNet?1:0)}, minmax(0,1fr))` }}
                       title={`${label}`}>
                    {(chartType === "ambos" || chartType === "entrada") ? (
                      <div className="relative rounded flex items-end justify-center"
                        style={{ height: barH(chartIn[i]), backgroundColor: '#10B981' }}
                        title={`${label} - Entradas: ${chartIn[i].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
                        {chartShowValues && (
                          <span className="absolute top-1 text-[10px] text-white drop-shadow select-none">
                            {formatCurrencyCompact(chartIn[i])}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}
                    {(chartType === "ambos" || chartType === "saida") ? (
                      <div className="relative rounded flex items-end justify-center"
                        style={{ height: barH(chartOut[i]), backgroundColor: '#EF4444' }}
                        title={`${label} - Saídas: ${chartOut[i].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
                        {chartShowValues && (
                          <span className="absolute top-1 text-[10px] text-white drop-shadow select-none">
                            {formatCurrencyCompact(chartOut[i])}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}
                    {chartShowNet && (
                      <div className="relative rounded flex items-end justify-center"
                        style={{ height: barH(chartNet[i]), backgroundColor: '#0EA5E9' }}
                        title={`${label} - Saldo: ${(chartIn[i]-chartOut[i]).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}>
                        {chartShowValues && (
                          <span className="absolute top-1 text-[10px] text-white drop-shadow select-none">
                            {formatCurrencyCompact(chartIn[i]-chartOut[i])}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Entradas (verde) e Saídas (vermelho) conforme filtros acima. Valores calculados a partir dos movimentos de caixa.</div>
              <div className="mt-2 text-sm">
                <span className="mr-4">Total Entradas: <span className="text-emerald-700 font-medium">{chartTotals.inSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                <span className="mr-4">Total Saídas: <span className="text-red-700 font-medium">{chartTotals.outSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
                <span>Saldo: <span className={`font-medium ${chartTotals.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{chartTotals.net.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Dialogo de edição de Receber/Pagar */}
      <Dialog open={showEditDialog} onOpenChange={o=>{ setShowEditDialog(o); if (!o) setEditError(""); }}>
        <DialogContent className="md:max-w-screen-lg md:w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{editType === "receber" ? "✏️ Editar Conta a Receber" : "✏️ Editar Conta a Pagar"}</DialogTitle>
            <DialogDescription>
              {editLocked ? "⚠️ Lançamento pago - somente leitura." : "Atualize as informações do lançamento selecionado."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {editError && (
              <div className="text-red-600 text-sm bg-red-50 border-l-4 border-red-500 rounded px-4 py-3 flex items-start gap-2" role="alert" aria-live="assertive">
                <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}
            
            {editLocked && (
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded px-4 py-3 flex items-start gap-2">
                <LockIcon className="h-5 w-5 flex-shrink-0 mt-0.5 text-blue-600" />
                <span className="text-sm text-blue-900">Este lançamento está marcado como pago e não pode ser editado.</span>
              </div>
            )}
            
            {/* Datas */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Datas
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Data do Lançamento</label>
                  <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} disabled={editLocked} />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Vencimento</label>
                  <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={editLocked} />
                </div>
              </div>
            </div>
            
            {/* Status e Recorrência */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">Status</label>
                <select className="border rounded-md px-3 py-2 w-full" value={editStatus} onChange={(e) => setEditStatus(e.target.value as any)} disabled={editLocked}>
                  <option value="aberto">⏳ Pendente</option>
                  <option value="pago">✅ Pago</option>
                  <option value="vencido">⚠️ Vencido</option>
                  <option value="cancelado">❌ Cancelado</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">Recorrência</label>
                <select className="border rounded-md px-3 py-2 w-full" value={editRecurrence} onChange={(e) => setEditRecurrence(e.target.value as any)} disabled={editLocked}>
                  <option value="nenhuma">🔘 Nenhuma</option>
                  <option value="mensal">📅 Mensal</option>
                  <option value="semanal">🗓️ Semanal</option>
                </select>
              </div>
            </div>
            
            {/* Cliente/Fornecedor */}
            <div className="bg-white p-4 rounded-lg border-2 border-gray-300">
              <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                {editType === "receber" ? <User className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                {editType === "receber" ? "Cliente" : "Fornecedor"}
              </label>
              <Input value={editParty} onChange={(e) => setEditParty(e.target.value)} disabled={true} className="bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">ℹ️ Nome da parte não pode ser alterado após criação</p>
            </div>
            
            {/* Descrição e Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Descrição
                </label>
                <Input placeholder="Ex.: Venda #1001, Pagamento fornecedor..." value={editDesc} onChange={(e) => setEditDesc(e.target.value)} disabled={editLocked} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor <span className="text-red-600">*</span>
                </label>
                <NumericFormat
                  className={clsx("border rounded-md px-3 py-2 w-full", editLocked && "bg-gray-100")}
                  value={editAmount}
                  thousandSeparator="."
                  decimalSeparator=","
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  placeholder="0,00"
                  prefix="R$ "
                  onValueChange={(v) => setEditAmount(v.value)}
                  disabled={editLocked}
                />
              </div>
            </div>
            
            {/* Informações Adicionais */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Classificação e Vínculos
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Categoria</label>
                  <select className="border rounded-md px-3 py-2 w-full" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} disabled={editLocked}>
                    <option value="">📂 Selecione...</option>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Centro de Custo</label>
                  <select className="border rounded-md px-3 py-2 w-full" value={editCostCenter} onChange={(e) => setEditCostCenter(e.target.value)} disabled={editLocked}>
                    <option value="">🏛️ Selecione...</option>
                    {costCenterOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Projeto</label>
                  <select className="border rounded-md px-3 py-2 w-full" value={editProject} onChange={(e) => setEditProject(e.target.value)} disabled={editLocked}>
                    <option value="">📋 Nenhum</option>
                    {(projects || [])
                      .map(proj => (
                        <option key={proj.id} value={proj.id}>
                          {proj.code} - {proj.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Meio de Pagamento <span className="text-red-600">*</span></label>
                  <select className="border rounded-md px-3 py-2 w-full" value={editPaymentMethod} onChange={(e) => setEditPaymentMethod(e.target.value)} disabled={editLocked}>
                    <option value="">💳 Selecione...</option>
                    <option value="PIX">📱 PIX</option>
                    <option value="DINHEIRO">💵 Dinheiro</option>
                    <option value="DEBITO">💳 Débito</option>
                    <option value="CREDITO">💳 Crédito</option>
                    <option value="BOLETO">🧾 Boleto</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Observações */}
            <div>
              <label className="text-xs font-medium text-gray-700 mb-2 block flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Observações
              </label>
              <Input placeholder="Notas adicionais sobre este lançamento..." value={editNotes} onChange={(e) => setEditNotes(e.target.value)} disabled={editLocked} />
            </div>
            
            {/* Botões de ação */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                disabled={editLocked}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
