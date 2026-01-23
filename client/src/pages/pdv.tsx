import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ShoppingCart, Plus, Minus, Trash2, Search, Barcode, 
  DollarSign, CreditCard, Smartphone, Receipt, X,
  Calculator, User, Package, CheckCircle, AlertCircle, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Product, Customer, Sale, CashRegister } from "@shared/schema";
import { useLocation } from "wouter";
import { CustomerFormWizard } from "@/components/forms/customer-form-wizard";

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
  discount: number;
}

export default function PDV() {
  const { toast } = useToast();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  
  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeSearch, setBarcodeSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"BOLETO" | "DEBIT" | "CREDIT" | "CASH" | "PIX" | "OTHER">("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);

  // Queries
  const { data: currentRegister, isLoading: loadingRegister } = useQuery<CashRegister>({
    queryKey: ["/api/cash-register/current"],
  });
  const { data: products, isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  // Helper to gate UI without breaking hooks order
  const gate = () => {
    if (loadingRegister) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center text-sm text-muted-foreground">Verificando status do caixa…</div>
        </div>
      );
    }
    if (!currentRegister) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Caixa não aberto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Para utilizar o PDV é necessário abrir o caixa do dia. Você será redirecionado para a tela do caixa.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => navigate("/cash-register")}>Abrir caixa</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>Recarregar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return null;
  };

  // Filter active products
  const activeProducts = products?.filter(p => p.isActive) || [];

  // Filter products by search term
  const filteredProducts = activeProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Focus barcode input on mount
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Handle barcode scan
  useEffect(() => {
    if (barcodeSearch.length > 0) {
      const product = activeProducts.find(p => 
        p.barcode === barcodeSearch || p.code === barcodeSearch
      );
      
      if (product) {
        addToCart(product);
        setBarcodeSearch("");
      }
    }
  }, [barcodeSearch, activeProducts]);

  // Cart calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartDiscount = discount;
  const cartTotal = Math.max(0, cartSubtotal - cartDiscount);
  const cashChange = paymentMethod === "CASH" && cashReceived 
    ? Math.max(0, parseFloat(cashReceived) - cartTotal)
    : 0;

  // Add product to cart
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return prev.map(item => 
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * parseFloat(product.salePrice)
              }
            : item
        );
      }
      
      return [
        ...prev,
        {
          product,
          quantity: 1,
          subtotal: parseFloat(product.salePrice),
          discount: 0
        }
      ];
    });
    
    toast({
      title: "Produto adicionado",
      description: `${product.name} foi adicionado ao carrinho`,
    });
  };

  // Update cart item quantity
  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? {
              ...item,
              quantity: newQuantity,
              subtotal: newQuantity * parseFloat(item.product.salePrice)
            }
          : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscount(0);
    setCashReceived("");
    setPaymentMethod("CASH");
  };

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error("Carrinho vazio");
      }

      // Create sale
      const baseNote = "venda Avulsa PDV";
      const cashDetail = paymentMethod === "CASH" ? ` - Dinheiro recebido: ${formatCurrency(parseFloat(cashReceived || "0"))}` : "";
      const salePayload = {
        number: `PDV-${Date.now()}`,
        customerId: selectedCustomer?.id || null,
        status: "COMPLETED",
        paymentMethod,
        subtotal: cartSubtotal.toFixed(2),
        discount: cartDiscount.toFixed(2),
        total: cartTotal.toFixed(2),
        notes: `${baseNote}${cashDetail}`,
      };

      const saleRes = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salePayload),
      });

      if (!saleRes.ok) {
        throw new Error("Falha ao criar venda");
      }

      const sale: Sale = await saleRes.json();

      // Create sale items
      for (const item of cart) {
        const itemPayload = {
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: parseFloat(item.product.salePrice).toFixed(2),
          discount: item.discount.toFixed(2),
          total: item.subtotal.toFixed(2),
        };

        const itemRes = await fetch(`/api/sales/${sale.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(itemPayload),
        });

        if (!itemRes.ok) {
          throw new Error("Falha ao criar item da venda");
        }
      }

      return sale;
    },
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      
      toast({
        title: "Venda concluída!",
        description: `Venda ${sale.number} registrada com sucesso`,
      });

      setIsPaymentDialogOpen(false);
      clearCart();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao finalizar venda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFinalizeSale = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCustomer) {
      toast({
        title: "Selecione um cliente",
        description: "É necessário selecionar ou cadastrar um cliente para finalizar a venda.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "CASH" && (!cashReceived || parseFloat(cashReceived) < cartTotal)) {
      toast({
        title: "Valor insuficiente",
        description: "O valor recebido é menor que o total da venda",
        variant: "destructive",
      });
      return;
    }

    createSaleMutation.mutate();
  };

  const gateView = gate();
  if (gateView) return gateView;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between text-2xl">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-8 w-8" />
                <span>Ponto de Venda (PDV)</span>
              </div>
              <div className="text-sm font-normal">
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Product Search & List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Barcode Scanner */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Barcode className="h-5 w-5" />
                  Código de Barras
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    ref={barcodeInputRef}
                    value={barcodeSearch}
                    onChange={(e) => setBarcodeSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setBarcodeSearch("");
                      }
                    }}
                    placeholder="Escaneie ou digite o código de barras..."
                    className="pl-10 h-12 text-lg"
                    autoFocus
                  />
                </div>
              </CardContent>
            </Card>

            {/* Product Search */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Buscar Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome, código ou código de barras..."
                    className="pl-10"
                  />
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {loadingProducts ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      Carregando produtos...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      Nenhum produto encontrado
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-400"
                        onClick={() => addToCart(product)}
                      >
                        <CardContent className="p-3">
                          <div className="flex flex-col h-full">
                            <div className="mb-2">
                              <Package className="h-8 w-8 text-blue-500 mb-2" />
                              <p className="font-semibold text-sm line-clamp-2">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.code}</p>
                            </div>
                            <div className="mt-auto">
                              <p className="text-lg font-bold text-blue-600">
                                {formatCurrency(parseFloat(product.salePrice))}
                              </p>
                              <Badge variant={(product.currentStock ?? 0) > 0 ? "default" : "destructive"} className="text-xs mt-1">
                                Estoque: {product.currentStock ?? 0}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Cart & Checkout */}
          <div className="space-y-4">
            {/* Customer Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      <p className="text-sm text-gray-500">{selectedCustomer.document}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCustomer(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsCustomerDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Selecionar Cliente
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Cart */}
            <Card className="flex flex-col h-[500px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Carrinho ({cart.length})
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <ShoppingCart className="h-16 w-16 mb-2" />
                    <p>Carrinho vazio</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <Card key={item.product.id} className="p-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatCurrency(parseFloat(item.product.salePrice))} x {item.quantity}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.product.id)}
                              className="text-red-500 hover:text-red-700 p-1 h-auto"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                className="h-8 w-8 p-0"
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-12 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                className="h-8 w-8 p-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="font-bold text-blue-600">
                              {formatCurrency(item.subtotal)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totals & Checkout */}
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(cartSubtotal)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span>Desconto:</span>
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                      className="w-32 h-8 text-right"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="border-t pt-2 flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => setIsPaymentDialogOpen(true)}
                  disabled={cart.length === 0}
                  className="w-full h-12 text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Receipt className="h-5 w-5 mr-2" />
                  Finalizar Venda
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Customer Selection Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Cliente</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end pb-2">
            <Button onClick={() => setIsCreateCustomerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {customers?.map((customer) => (
              <Card
                key={customer.id}
                className="p-3 cursor-pointer hover:bg-blue-50 transition-colors"
                onClick={() => {
                  setSelectedCustomer(customer);
                  setIsCustomerDialogOpen(false);
                }}
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.document}</p>
                  {customer.phone && (
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog open={isCreateCustomerOpen} onOpenChange={setIsCreateCustomerOpen}>
        <DialogContent className="w-screen h-screen md:h-auto md:max-w-2xl md:w-[720px] max-w-screen overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Cliente</DialogTitle>
          </DialogHeader>
          <CustomerFormWizard
            onSuccess={(created) => {
              if (created) {
                setSelectedCustomer(created);
              }
              setIsCreateCustomerOpen(false);
              setIsCustomerDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Finalizar Pagamento
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Total Display */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total a Pagar</p>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(cartTotal)}
              </p>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value: any) => setPaymentMethod(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Boleto
                    </div>
                  </SelectItem>
                  <SelectItem value="DEBIT">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão de Débito
                    </div>
                  </SelectItem>
                  <SelectItem value="CREDIT">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Cartão de Crédito
                    </div>
                  </SelectItem>
                  <SelectItem value="CASH">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Dinheiro
                    </div>
                  </SelectItem>
                  <SelectItem value="PIX">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      PIX
                    </div>
                  </SelectItem>
                  <SelectItem value="OTHER">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Outros
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cash Payment Fields */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Valor Recebido</Label>
                  <Input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                    min="0"
                    className="text-lg"
                  />
                </div>
                
                {cashReceived && parseFloat(cashReceived) >= cartTotal && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-sm font-medium text-green-800">Troco</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(cashChange)}
                    </p>
                  </div>
                )}

                {cashReceived && parseFloat(cashReceived) < cartTotal && (
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-800">
                        Valor insuficiente. Faltam {formatCurrency(cartTotal - parseFloat(cashReceived))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer Info */}
            {selectedCustomer && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Cliente</p>
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.document}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalizeSale}
              disabled={createSaleMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {createSaleMutation.isPending ? "Processando..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
