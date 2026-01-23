import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function currencyBR(n?: number) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ReceivablesList() {
  const { data: finance } = useQuery({ queryKey: ["/api/finance"] });

  const receivables = useMemo(() => {
    const all = Array.isArray(finance) ? finance : [];
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 14);
    return all
      .filter((f: any) => f.entryType === "RECEIVABLE" && (f.status === "OPEN" || f.status === "OVERDUE"))
      .filter((f: any) => {
        const due = f.dueDate ? new Date(f.dueDate) : null;
        return due && due <= horizon;
      })
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10);
  }, [finance]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">A Receber (próximos 14 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {receivables.map((r: any) => (
            <div key={r.id} className="py-2 flex items-center justify-between text-sm">
              <div className="flex-1">
                <div className="font-medium text-foreground">{r.partyName || r.description || "Recebível"}</div>
                <div className="text-muted-foreground">Venc.: {r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "-"} • {r.status}</div>
              </div>
              <div className="text-right font-semibold text-foreground">{currencyBR(r.amount)}</div>
            </div>
          ))}
          {receivables.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">Nenhum recebível próximo.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
