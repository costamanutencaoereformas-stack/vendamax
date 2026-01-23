import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DollarSign, Plus, Minus, Lock, Unlock, TrendingUp, TrendingDown } from "lucide-react";
import { NumericFormat } from 'react-number-format';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { CashRegister, CashMovement } from "@shared/schema";

export default function CashRegisterPage() {
  const { toast } = useToast();
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [movementType, setMovementType] = useState<"WITHDRAWAL" | "REINFORCEMENT">("WITHDRAWAL");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");

  const { data: register } = useQuery<CashRegister>({
    queryKey: ["/api/cash-register/current"],
  });

  // Payment summary for current register period
  const { data: paymentSummary } = useQuery<{ register: CashRegister | null; summary: { paymentMethod: string; total: number; count: number }[] }>({
    queryKey: ["/api/cash-register/summary", register?.id],
    queryFn: async () => {
      const res = await fetch(`/api/cash-register/summary`);
      if (!res.ok) throw new Error("Falha ao carregar resumo de pagamentos");
      return res.json();
    },
  });

  const { data: movements } = useQuery<CashMovement[]>({
    queryKey: ["/api/cash-register/movements", register?.id],
    queryFn: async () => {
      if (!register?.id) return [];
      const res = await fetch(`/api/cash-register/movements/${register.id}`);
      if (!res.ok) throw new Error("Falha ao carregar movimentações");
      return res.json();
    },
    enabled: !!register?.id,
  });

  const openRegisterMutation = useMutation({
    mutationFn: async () => {
      if (!openingBalance || isNaN(parseFloat(openingBalance))) {
        throw new Error("Informe um valor válido para o saldo inicial");
      }
      
      console.log("Abrindo caixa com saldo:", parseFloat(openingBalance));
      
      const res = await fetch("/api/cash-register/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: parseFloat(openingBalance) }),
      });
      
      console.log("Resposta do servidor:", res.status, res.statusText);
      
      if (!res.ok) {
        const error = await res.text();
        console.error("Erro ao abrir caixa:", error);
        throw new Error(error || "Falha ao abrir caixa");
      }
      
      const data = await res.json();
      console.log("Caixa aberto com sucesso:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/summary"] });
      toast({ title: "Caixa aberto", description: "Caixa aberto com sucesso" });
      setIsOpenDialogOpen(false);
      setOpeningBalance("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao abrir caixa", 
        description: error.message || "Ocorreu um erro ao tentar abrir o caixa",
        variant: "destructive" 
      });
    },
  });

  const closeRegisterMutation = useMutation({
    mutationFn: async () => {
      if (!closingBalance || isNaN(parseFloat(closingBalance))) {
        throw new Error("Informe um valor válido para o saldo final");
      }
      
      const res = await fetch("/api/cash-register/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingBalance: parseFloat(closingBalance) }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Falha ao fechar caixa");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/summary"] });
      toast({ title: "Caixa fechado", description: "Caixa fechado com sucesso" });
      setIsCloseDialogOpen(false);
      setClosingBalance("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao fechar caixa", 
        description: error.message || "Ocorreu um erro ao tentar fechar o caixa",
        variant: "destructive" 
      });
    },
  });

  const addMovementMutation = useMutation({
    mutationFn: async () => {
      if (!movementAmount || isNaN(parseFloat(movementAmount)) || parseFloat(movementAmount) <= 0) {
        throw new Error("Informe um valor válido para a movimentação");
      }
      
      const res = await fetch("/api/cash-register/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          amount: parseFloat(movementAmount),
          description: movementDescription || (movementType === "WITHDRAWAL" ? "Sangria" : "Reforço"),
        }),
      });
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Falha ao registrar movimentação");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cash-register/summary"] });
      toast({ title: "Movimentação registrada", description: "Movimentação realizada com sucesso" });
      setIsMovementDialogOpen(false);
      setMovementAmount("");
      setMovementDescription("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao registrar movimentação", 
        description: error.message || "Ocorreu um erro ao tentar registrar a movimentação",
        variant: "destructive" 
      });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gerenciamento de Caixa</h1>
        {register?.status === "CLOSED" || !register ? (
          <Button onClick={() => setIsOpenDialogOpen(true)} className="bg-green-600">
            <Unlock className="h-4 w-4 mr-2" />
            Abrir Caixa
          </Button>
        ) : (
          <>
            <div className="flex gap-2">
              <Button onClick={() => setIsMovementDialogOpen(true)} variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Movimentação
              </Button>
              <Button onClick={() => setIsCloseDialogOpen(true)} variant="destructive">
                <Lock className="h-4 w-4 mr-2" />
                Fechar Caixa
              </Button>
            </div>

            {/* Payment summary card */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                {!paymentSummary?.summary || paymentSummary.summary.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Nenhum recebimento registrado no período do caixa</div>
                ) : (
                  <div className="divide-y border rounded">
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                      <div className="col-span-6">Forma de Pagamento</div>
                      <div className="col-span-3 text-right">Qtde</div>
                      <div className="col-span-3 text-right">Total</div>
                    </div>
                    {paymentSummary.summary.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                        <div className="col-span-6">
                          {({
                            CASH: "Dinheiro",
                            DEBIT: "Débito",
                            CREDIT: "Crédito",
                            PIX: "PIX",
                            BOLETO: "Boleto",
                            OTHER: "Outros",
                          } as Record<string, string>)[row.paymentMethod] || row.paymentMethod || "-"}
                        </div>
                        <div className="col-span-3 text-right">{row.count}</div>
                        <div className="col-span-3 text-right">{formatCurrency(row.total || 0)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {register && register.status === "OPEN" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Saldo Inicial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(parseFloat(register.openingBalance || "0"))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Saldo Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(parseFloat(register.currentBalance || "0"))}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="default" className="bg-green-500">Aberto</Badge>
                <p className="text-xs text-gray-500 mt-2">{register.openedAt && formatDateTime(new Date(register.openedAt))}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Movimentações</CardTitle>
            </CardHeader>
            <CardContent>
              {!movements || movements.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Nenhuma movimentação registrada ainda</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {movements.map((m) => {
                    const isPositive = m.type === "SALE" || m.type === "REINFORCEMENT" || m.type === "OPENING";
                    return (
                      <div key={m.id} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          {isPositive ? (
                            <TrendingUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <TrendingDown className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{m.description || m.type}</p>
                            <p className="text-xs text-gray-500">{m.createdAt && formatDateTime(new Date(m.createdAt))}</p>
                          </div>
                        </div>
                        <p className={`font-bold ${isPositive ? "text-green-600" : "text-red-600"}`}>
                          {isPositive ? "+" : "-"}{formatCurrency(parseFloat(m.amount))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Saldo Inicial</Label>
              <Input 
                type="number" 
                value={openingBalance} 
                onChange={(e) => setOpeningBalance(e.target.value)} 
                step="0.01"
                min="0"
                placeholder="0.00"
                disabled={openRegisterMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsOpenDialogOpen(false)}
              disabled={openRegisterMutation.isPending}
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => openRegisterMutation.mutate()}
              disabled={openRegisterMutation.isPending || !openingBalance}
            >
              {openRegisterMutation.isPending ? "Abrindo..." : "Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded">
              <p className="text-sm text-gray-600">Saldo Esperado</p>
              <p className="text-2xl font-bold">{formatCurrency(parseFloat(register?.currentBalance || "0"))}</p>
            </div>
            <div>
              <Label>Saldo Contado</Label>
              <Input type="number" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} step="0.01" />
            </div>
            {closingBalance && (
              <div className={`p-4 rounded ${parseFloat(closingBalance) === parseFloat(register?.currentBalance || "0") ? "bg-green-50" : "bg-red-50"}`}>
                <p className="text-sm">Diferença</p>
                <p className="text-xl font-bold">{formatCurrency(parseFloat(closingBalance) - parseFloat(register?.currentBalance || "0"))}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => closeRegisterMutation.mutate()} variant="destructive">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Movimentação de Caixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={movementType === "WITHDRAWAL" ? "default" : "outline"} onClick={() => setMovementType("WITHDRAWAL")} className={movementType === "WITHDRAWAL" ? "flex-1 bg-red-600 text-white" : "flex-1"}>
                <Minus className="h-4 w-4 mr-2" />
                Sangria
              </Button>
              <Button variant={movementType === "REINFORCEMENT" ? "default" : "outline"} onClick={() => setMovementType("REINFORCEMENT")} className={movementType === "REINFORCEMENT" ? "flex-1 bg-green-600 text-white" : "flex-1"}>
                <Plus className="h-4 w-4 mr-2" />
                Reforço
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <Label>Valor</Label>
                <NumericFormat
                  className="border rounded-lg px-4 py-3 w-full text-2xl font-bold text-center"
                  value={movementAmount}
                  thousandSeparator="."
                  decimalSeparator="," 
                  decimalScale={2}
                  fixedDecimalScale
                  allowNegative={false}
                  placeholder="R$ 0,00"
                  onValueChange={(v) => setMovementAmount(v.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Input value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} placeholder={movementType === 'WITHDRAWAL' ? 'Ex.: Sangria - Retirada de troco' : 'Ex.: Reforço - Suprimento de caixa'} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addMovementMutation.mutate()} className="bg-blue-600 hover:bg-blue-700">
              <DollarSign className="h-4 w-4 mr-2" />
              Confirmar {movementAmount ? ` - R$ ${Number(movementAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
