import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UpcomingAppointments() {
  const { data: appts } = useQuery({ queryKey: ["/api/appointments"] });

  const upcoming = useMemo(() => {
    const all = Array.isArray(appts) ? appts : [];
    const now = new Date();
    const in7 = new Date();
    in7.setDate(now.getDate() + 7);
    return all
      .filter((a: any) => new Date(a.date) >= now && new Date(a.date) <= in7)
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [appts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">Próximos Compromissos (7 dias)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {upcoming.map((a: any) => (
            <div key={a.id} className="py-2 text-sm">
              <div className="font-medium text-foreground">{a.subject || a.type}</div>
              <div className="text-muted-foreground">{new Date(a.date).toLocaleString("pt-BR")} • {a.status}</div>
              {a.customerId ? (
                <div className="text-muted-foreground">Cliente: {a.customerId}</div>
              ) : a.contactName ? (
                <div className="text-muted-foreground">Contato: {a.contactName} {a.contactPhone ? `• ${a.contactPhone}` : ""}</div>
              ) : null}
            </div>
          ))}
          {upcoming.length === 0 && (
            <div className="py-6 text-center text-muted-foreground">Sem compromissos nos próximos dias.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
