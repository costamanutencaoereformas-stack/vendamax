import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatCurrency, createDateFromInput, createISODateString } from '@/lib/formatters';
import { useSearch } from "@/contexts/search-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

export type Appointment = {
  id: string;
  type: string; // VISIT | CALL | MEETING
  date: string; // ISO string
  status: string; // PENDING | DONE | CANCELED
  subject: string | null;
  notes: string | null;
  customerId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  createdAt: string | null;
};

export default function Agenda() {
  const qc = useQueryClient();
  const { search } = useSearch();
  const TYPE_LABELS: Record<string, string> = {
    VISIT: "Visita",
    CALL: "Ligação",
    MEETING: "Reunião",
    OTHER: "Outros",
  };
  const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendente",
    DONE: "Concluído",
    CANCELED: "Cancelado",
  };
  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  // Quick create for selected day
  const [subject, setSubject] = useState("");
  const [time, setTime] = useState<string>("09:00");
  const [createDate, setCreateDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  });
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<"DAY" | "WEEK" | "MONTH">("DAY");

  // Create form extended fields
  const [createType, setCreateType] = useState<string>("VISIT");
  const [createStatus, setCreateStatus] = useState<string>("PENDING");
  const [createNotes, setCreateNotes] = useState<string>("");
  const [createContactName, setCreateContactName] = useState<string>("");
  const [createContactPhone, setCreateContactPhone] = useState<string>("");
  const [createCustomerId, setCreateCustomerId] = useState<string>("");

  const { data, isLoading, error } = useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: async () => {
      const res = await fetch("/api/appointments");
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        // Try to extract JSON error, otherwise use status text
        if (ct.includes("application/json")) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.message || "Falha ao carregar agenda");
        }
        throw new Error(res.statusText || "Falha ao carregar agenda");
      }
      if (!ct.includes("application/json")) {
        // Avoid surfacing raw HTML
        await res.text().catch(() => null);
        throw new Error("Resposta inválida do servidor (não JSON)");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // Combine selected day with selected time in local timezone
      const [hh, mm] = time.split(":");
      const dt = createDateFromInput(createDate);
      dt.setHours(Number(hh || 0), Number(mm || 0), 0, 0);
      const body = {
        type: createType,
        status: createStatus,
        date: dt.toISOString(),
        subject: subject || null,
        notes: createNotes || null,
        customerId: createCustomerId || null,
        contactName: createContactName || null,
        contactPhone: createContactPhone || null,
      };
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        try {
          const maybeJson = ct.includes("application/json") ? JSON.parse(text) : null;
          throw new Error(maybeJson?.message || text || "Falha ao criar compromisso");
        } catch {
          throw new Error(text || "Falha ao criar compromisso");
        }
      }
      // Allow empty or non-JSON success responses
      if (ct.includes("application/json")) {
        return res.json();
      }
      return null as any;
    },
    onSuccess: () => {
      setSubject("");
      setCreateNotes("");
      setCreateContactName("");
      setCreateContactPhone("");
      setCreateCustomerId("");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (partial: Partial<Appointment> & { id: string }) => {
      const res = await fetch(`/api/appointments/${partial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        try {
          const maybeJson = ct.includes("application/json") ? JSON.parse(text) : null;
          throw new Error(maybeJson?.message || text || "Falha ao atualizar compromisso");
        } catch {
          throw new Error(text || "Falha ao atualizar compromisso");
        }
      }
      if (ct.includes("application/json")) return res.json();
      return null as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir compromisso");
      return true;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  // Helpers
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const startOfWeekMon = (d: Date) => {
    const tmp = new Date(d);
    const day = (tmp.getDay() + 6) % 7; // Mon=0
    tmp.setDate(tmp.getDate() - day);
    tmp.setHours(0, 0, 0, 0);
    return tmp;
  };
  const endOfWeekMon = (d: Date) => {
    const s = startOfWeekMon(d);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    e.setHours(23, 59, 59, 999);
    return e;
  };

  const typeBadge = (t: string) =>
    t === "VISIT"
      ? "bg-blue-100 text-blue-700"
      : t === "CALL"
      ? "bg-purple-100 text-purple-700"
      : t === "MEETING"
      ? "bg-orange-100 text-orange-700"
      : "bg-gray-100 text-gray-700"; // OTHER or unknown
  const statusBadge = (s: string) =>
    s === "PENDING"
      ? "bg-yellow-100 text-yellow-700"
      : s === "DONE"
      ? "bg-green-100 text-green-700"
      : "bg-gray-100 text-gray-600";
  const nextStatus = (s: string) => (s === "PENDING" ? "DONE" : s === "DONE" ? "CANCELED" : "PENDING");

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    // Monday-first grid: JS getDay() 0=Sun..6=Sat; convert so Mon=0..Sun=6
    const startIdx = (start.getDay() + 6) % 7;
    const totalDays = end.getDate();
    const cells: { date: Date; current: boolean }[] = [];
    // leading from previous month
    for (let i = 0; i < startIdx; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (startIdx - i));
      cells.push({ date: d, current: false });
    }
    // current month
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(currentMonth);
      d.setDate(day);
      cells.push({ date: d, current: true });
    }
    // trailing to complete weeks (42 cells for 6 weeks)
    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push({ date: d, current: false });
    }
    return cells;
  }, [currentMonth]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    (data || []).forEach((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [data]);

  // Per-day summary for badge coloring (priority: PENDING > DONE > CANCELED)
  const summaryByDay = useMemo(() => {
    type S = { count: number; status: "PENDING" | "DONE" | "CANCELED" };
    const map = new Map<string, S>();
    (data || []).forEach((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const curr = map.get(key);
      const nextCount = (curr?.count || 0) + 1;
      let nextStatus: S["status"] = curr?.status || a.status as any;
      // Upgrade priority if needed
      const rank = (s: S["status"]) => (s === "PENDING" ? 3 : s === "DONE" ? 2 : 1);
      if (!curr || rank(a.status as any) > rank(curr.status)) nextStatus = a.status as any;
      map.set(key, { count: nextCount, status: nextStatus });
    });
    return map;
  }, [data]);

  // Per-day detailed breakdown for tooltip
  const breakdownByDay = useMemo(() => {
    const map = new Map<string, { PENDING: number; DONE: number; CANCELED: number }>();
    (data || []).forEach((a) => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const curr = map.get(key) || { PENDING: 0, DONE: 0, CANCELED: 0 };
      const s = (a.status as "PENDING" | "DONE" | "CANCELED") || "PENDING";
      curr[s] = (curr[s] || 0) + 1;
      map.set(key, curr);
    });
    return map;
  }, [data]);

  const periodAppointments = useMemo(() => {
    let items = (data || []);
    if (viewMode === "DAY") {
      items = items.filter((a) => isSameDay(new Date(a.date), selectedDate));
    } else if (viewMode === "WEEK") {
      const s = startOfWeekMon(selectedDate);
      const e = endOfWeekMon(selectedDate);
      items = items.filter((a) => {
        const d = new Date(a.date).getTime();
        return d >= s.getTime() && d <= e.getTime();
      });
    } else {
      items = items.filter((a) => {
        const d = new Date(a.date);
        return d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
      });
    }
    return items
      .filter((a) => (typeFilter === "ALL" ? true : a.type === typeFilter))
      .filter((a) => (statusFilter === "ALL" ? true : a.status === statusFilter))
      .filter((a) => (search ? (a.subject || "").toLowerCase().includes(search.toLowerCase()) : true))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, selectedDate, viewMode, typeFilter, statusFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        crumbs={[]}
        actions={
          <Button onClick={() => { setCreateDate(selectedDate.toISOString().split("T")[0]); setCreateOpen(true); }}>
            Novo compromisso
          </Button>
        }
      />
      {/* Calendar + List side-by-side */}
      <div className="grid grid-cols-1 xl:[grid-template-columns:420px_minmax(0,1fr)] gap-6 items-start">
      {/* Calendar (Falcon-styled via shared Calendar component) */}
      <div className="bg-white rounded-md border p-3">
        <Calendar
          mode="single"
          month={currentMonth}
          onMonthChange={setCurrentMonth}
          selected={selectedDate}
          getBadge={(day: Date) => {
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const sum = summaryByDay.get(key);
            if (!sum) return null;
            const colorClass =
              sum.status === "PENDING"
                ? "bg-yellow-600 text-white"
                : sum.status === "DONE"
                ? "bg-green-600 text-white"
                : "bg-gray-400 text-white";
            return { count: sum.count, colorClass };
          }}
          getTooltip={(day: Date) => {
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
            const b = breakdownByDay.get(key);
            if (!b) return null;
            const parts: string[] = [];
            if (b.PENDING) parts.push(`Pendente: ${b.PENDING}`);
            if (b.DONE) parts.push(`Concluído: ${b.DONE}`);
            if (b.CANCELED) parts.push(`Cancelado: ${b.CANCELED}`);
            return parts.length ? parts.join(" | ") : null;
          }}
          onSelect={(d) => {
            if (!d) return;
            const nd = new Date(d);
            nd.setHours(0,0,0,0);
            setSelectedDate(nd);
            // reflect in create form
            setCreateDate(nd.toISOString().split("T")[0]);
            setCreateOpen(true);
          }}
          showOutsideDays
        />
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-screen h-[90vh] sm:h-auto sm:max-w-[520px] max-w-none p-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo compromisso</DialogTitle>
            <DialogDescription>
              {new Date(createDate).toLocaleDateString("pt-BR")} • Tipo: {TYPE_LABELS[createType] || createType} • Status: {STATUS_LABELS[createStatus] || createStatus}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-600">Data</label>
              <input
                type="date"
                className="mt-1 w-full border rounded-md px-2 py-1"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Hora</label>
              <input
                type="time"
                className="mt-1 w-full border rounded-md px-2 py-1"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Tipo</label>
              <select className="mt-1 w-full border rounded-md px-2 py-1" value={createType} onChange={(e) => setCreateType(e.target.value)}>
                <option value="VISIT">{TYPE_LABELS["VISIT"]}</option>
                <option value="CALL">{TYPE_LABELS["CALL"]}</option>
                <option value="MEETING">{TYPE_LABELS["MEETING"]}</option>
                <option value="OTHER">{TYPE_LABELS["OTHER"]}</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600">Status</label>
              <select className="mt-1 w-full border rounded-md px-2 py-1" value={createStatus} onChange={(e) => setCreateStatus(e.target.value)}>
                <option value="PENDING">{STATUS_LABELS["PENDING"]}</option>
                <option value="DONE">{STATUS_LABELS["DONE"]}</option>
                <option value="CANCELED">{STATUS_LABELS["CANCELED"]}</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-sm text-gray-600">Assunto</label>
              <input
                type="text"
                className="mt-1 w-full border rounded-md px-2 py-1"
                placeholder="Ex: Visita técnica"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-sm text-gray-600">Notas</label>
              <textarea className="mt-1 w-full border rounded-md px-2 py-1" rows={3} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Contato (Nome)</label>
              <input className="mt-1 w-full border rounded-md px-2 py-1" value={createContactName} onChange={(e) => setCreateContactName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Contato (Telefone)</label>
              <input className="mt-1 w-full border rounded-md px-2 py-1" value={createContactPhone} onChange={(e) => setCreateContactPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-600">Cliente (ID opcional)</label>
              <input className="mt-1 w-full border rounded-md px-2 py-1" value={createCustomerId} onChange={(e) => setCreateCustomerId(e.target.value)} placeholder="Ex: uuid do cliente" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-3 py-2 border rounded-md"
            >
              Cancelar
            </button>
            <button
              onClick={async () => { await createMutation.mutateAsync(); setCreateOpen(false); }}
              className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Adicionar"}
            </button>
          </div>
          {createMutation.error && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-screen h-[90vh] sm:h-auto sm:max-w-[520px] max-w-none p-4 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar compromisso</DialogTitle>
            <DialogDescription>
              {editing ? new Date(editing.date).toLocaleString("pt-BR") : ""}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-gray-600">Hora</label>
                <input
                  type="time"
                  className="mt-1 w-full border rounded-md px-2 py-1"
                  value={new Date(editing.date).toLocaleTimeString("pt-BR", { hour12: false, hour: "2-digit", minute: "2-digit" })}
                  onChange={(e) => {
                    const [hh, mm] = e.target.value.split(":");
                    const dt = new Date(editing.date);
                    dt.setHours(Number(hh || 0), Number(mm || 0), 0, 0);
                    setEditing({ ...editing, date: dt.toISOString() });
                  }}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Tipo</label>
                <select className="mt-1 w-full border rounded-md px-2 py-1" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                  <option value="VISIT">{TYPE_LABELS["VISIT"]}</option>
                  <option value="CALL">{TYPE_LABELS["CALL"]}</option>
                  <option value="MEETING">{TYPE_LABELS["MEETING"]}</option>
                  <option value="OTHER">{TYPE_LABELS["OTHER"]}</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">Status</label>
                <select className="mt-1 w-full border rounded-md px-2 py-1" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="PENDING">{STATUS_LABELS["PENDING"]}</option>
                  <option value="DONE">{STATUS_LABELS["DONE"]}</option>
                  <option value="CANCELED">{STATUS_LABELS["CANCELED"]}</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-gray-600">Assunto</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" value={editing.subject || ""} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="text-sm text-gray-600">Notas</label>
                <textarea className="mt-1 w-full border rounded-md px-2 py-1" rows={3} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Contato (Nome)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" value={editing.contactName || ""} onChange={(e) => setEditing({ ...editing, contactName: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Contato (Telefone)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" value={editing.contactPhone || ""} onChange={(e) => setEditing({ ...editing, contactPhone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600">Cliente (ID opcional)</label>
                <input className="mt-1 w-full border rounded-md px-2 py-1" value={editing.customerId || ""} onChange={(e) => setEditing({ ...editing, customerId: e.target.value })} />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setEditOpen(false)} className="px-3 py-2 border rounded-md">Cancelar</button>
            <button
              onClick={async () => {
                if (!editing) return;
                await updateMutation.mutateAsync({
                  id: editing.id,
                  type: editing.type,
                  status: editing.status,
                  date: editing.date,
                  subject: editing.subject,
                  notes: editing.notes,
                  customerId: editing.customerId,
                  contactName: editing.contactName,
                  contactPhone: editing.contactPhone,
                } as any);
                setEditOpen(false);
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
          {updateMutation.error && (
            <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Day/Period list + filters */}
      <div className="bg-white rounded-md border max-h-[80vh] flex flex-col">
        <div className="p-4 border-b">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <h2 className="font-medium">
                {viewMode === "DAY" && (
                  <>Compromissos do dia {selectedDate.toLocaleDateString("pt-BR")}</>
                )}
                {viewMode === "WEEK" && (
                  <>Compromissos da semana de {startOfWeekMon(selectedDate).toLocaleDateString("pt-BR")} a {endOfWeekMon(selectedDate).toLocaleDateString("pt-BR")}</>
                )}
                {viewMode === "MONTH" && (
                  <>Compromissos de {selectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</>
                )}
              </h2>
              {isLoading ? (
                <p className="text-sm text-gray-500">Carregando...</p>
              ) : error ? (
                <p className="text-sm text-red-600">{(error as Error).message}</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 mr-2">
                <button className={["px-2 py-1 text-xs rounded-md border", viewMode === "DAY" ? "bg-gray-100" : ""].join(" ")} onClick={() => setViewMode("DAY")}>Dia</button>
                <button className={["px-2 py-1 text-xs rounded-md border", viewMode === "WEEK" ? "bg-gray-100" : ""].join(" ")} onClick={() => setViewMode("WEEK")}>Semana</button>
                <button className={["px-2 py-1 text-xs rounded-md border", viewMode === "MONTH" ? "bg-gray-100" : ""].join(" ")} onClick={() => setViewMode("MONTH")}>Mês</button>
                <button className="px-2 py-1 text-xs rounded-md border" onClick={() => setSelectedDate(new Date())}>Hoje</button>
              </div>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="ALL">Tipo (todos)</option>
                <option value="VISIT">{TYPE_LABELS["VISIT"]}</option>
                <option value="CALL">{TYPE_LABELS["CALL"]}</option>
                <option value="MEETING">{TYPE_LABELS["MEETING"]}</option>
                <option value="OTHER">{TYPE_LABELS["OTHER"]}</option>
              </select>
              <select
                className="border rounded-md px-2 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Status (todos)</option>
                <option value="PENDING">{STATUS_LABELS["PENDING"]}</option>
                <option value="DONE">{STATUS_LABELS["DONE"]}</option>
                <option value="CANCELED">{STATUS_LABELS["CANCELED"]}</option>
              </select>
              {/* Busca removida aqui; usar busca global no header */}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="min-w-[640px]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 px-3">Hora</th>
                <th className="py-2 px-3">Tipo</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Assunto</th>
                <th className="py-2 px-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {periodAppointments.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 px-3">{new Date(a.date).toLocaleString("pt-BR", { day: viewMode !== "DAY" ? '2-digit' : undefined, month: viewMode !== "DAY" ? '2-digit' : undefined, hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="py-2 px-3"><span className={["px-2 py-0.5 text-xs rounded", typeBadge(a.type)].join(" ")}>{TYPE_LABELS[a.type] || a.type}</span></td>
                  <td className="py-2 px-3"><span className={["px-2 py-0.5 text-xs rounded", statusBadge(a.status)].join(" ")}>{STATUS_LABELS[a.status] || a.status}</span></td>
                  <td className="py-2 px-3">{a.subject || "(Sem assunto)"}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 text-xs border rounded-md"
                        title="Alternar status"
                        onClick={() => updateMutation.mutate({ id: a.id, status: nextStatus(a.status) } as any)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "..." : "Status"}
                      </button>
                      <button
                        className="px-2 py-1 text-xs border rounded-md"
                        title="Editar"
                        onClick={() => { setEditing(a); setEditOpen(true); }}
                      >
                        Editar
                      </button>
                      <button
                        className="px-2 py-1 text-xs border rounded-md text-red-600"
                        title="Excluir"
                        onClick={() => deleteMutation.mutate(a.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>) )}
              {periodAppointments.length === 0 && (
                <tr>
                  <td className="py-6 px-3 text-center text-gray-500" colSpan={5}>Nenhum compromisso no período selecionado</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
      {/* end grid wrapper */}
      </div>
    </div>
  );
}
