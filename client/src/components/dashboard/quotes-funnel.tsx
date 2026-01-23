import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export default function QuotesFunnel() {
  const { data: quotes } = useQuery({ queryKey: ["/api/quotes"] });

  const stats = useMemo(() => {
    const arr = Array.isArray(quotes) ? quotes : [];
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const recent = arr.filter((q: any) => new Date(q.createdAt || 0) >= from);
    const byStatus = recent.reduce((acc: Record<string, number>, q: any) => {
      acc[q.status || "PENDING"] = (acc[q.status || "PENDING"] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      PENDING: byStatus["PENDING"] || 0,
      APPROVED: byStatus["APPROVED"] || 0,
      CONVERTED: byStatus["CONVERTED"] || 0,
      REJECTED: byStatus["REJECTED"] || 0,
      total: recent.length,
    };
  }, [quotes]);

  const cards = [
    { label: "Pendentes", value: stats.PENDING, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
    { label: "Aprovados", value: stats.APPROVED, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Convertidos", value: stats.CONVERTED, color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Rejeitados", value: stats.REJECTED, color: "bg-rose-50 text-rose-700 border-rose-200" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Funil de Orçamentos (30 dias)</h3>
        <div className="text-sm text-gray-500">Total: {stats.total}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className={`border rounded-lg p-3 ${c.color}`}>
            <div className="text-xs uppercase tracking-wide">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
