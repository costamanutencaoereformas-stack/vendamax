import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Check } from "lucide-react";
import type { Product } from "@shared/schema";
import { formatCurrency } from "@/lib/formatters";
import QuickProductForm from "@/components/forms/quick-product-form";

interface ProductPickerProps {
  products: Product[] | undefined;
  // value can be single id or array of ids
  value?: string | string[] | null;
  // when multiple=true, onSelect receives Product[]; otherwise receives a single Product
  onSelect: (products: Product[] | Product) => void;
  placeholder?: string;
  className?: string;
  onProductCreated?: (product: Product) => void;
  multiple?: boolean; // default false
  // external control (optional) to open the dialog from parent
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // when provided, hide the internal trigger button (parent will trigger open)
  renderTrigger?: boolean;
}

export default function ProductPicker({ products, value, onSelect, placeholder = "Selecionar produtos...", className, onProductCreated, multiple = false, open: openProp, onOpenChange, renderTrigger = true }: ProductPickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);

  const open = typeof openProp === 'boolean' ? openProp : internalOpen;
  const setOpen = (v: boolean) => {
    if (typeof onOpenChange === 'function') onOpenChange(v);
    else setInternalOpen(v);
  };

  // initialize selectedProducts from value prop (supports single id or array)
  useMemo(() => {
    if (!products) return;
    if (!value) {
      setSelectedProducts([]);
      return;
    }
    if (Array.isArray(value)) {
      const selected = (products || []).filter(p => value.includes(p.id));
      setSelectedProducts(selected);
    } else if (typeof value === 'string') {
      const prod = (products || []).find(p => p.id === value);
      setSelectedProducts(prod ? [prod] : []);
    }
  }, [products, value]);

  const handleProductCreated = (newProduct: Product) => {
    setCreateProductOpen(false);
    setSelectedProducts(prev => [...prev, newProduct]);
    onProductCreated?.(newProduct);
  };

  const toggleProduct = (product: Product) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    if (multiple) {
      if (isSelected) {
        setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
      } else {
        setSelectedProducts(prev => [...prev, product]);
      }
    } else {
      // single selection: immediately select and close
      onSelect(product);
      setOpen(false);
    }
  };

  const handleConfirm = () => {
    if (multiple) {
      onSelect(selectedProducts);
    } else {
      onSelect(selectedProducts[0] ?? null as any);
    }
    setOpen(false);
  };

  return (
    <>
      {renderTrigger && (
        <Button
          type="button"
          variant="outline"
          className={className}
          onClick={() => setOpen(true)}
        >
        {selectedProducts.length > 0 ? (
          <span className="truncate text-left w-full">
            {selectedProducts.length === 1 ? (
              <span className="flex items-center gap-2">
                {selectedProducts[0].imageUrl ? (
                  <img src={selectedProducts[0].imageUrl} alt="thumb" className="h-6 w-6 object-cover rounded" />
                ) : null}
                <span>
                  {selectedProducts[0].name}
                  {(selectedProducts[0] as any).code ? ` (${(selectedProducts[0] as any).code})` : ""} · {formatCurrency((selectedProducts[0] as any).salePrice)}
                </span>
              </span>
            ) : (
              `${selectedProducts.length} produtos selecionados`
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        </Button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar produto por nome ou código..." />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setCreateProductOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Novo Produto
              </Button>
            </div>
          </CommandEmpty>
          <CommandGroup heading="Produtos">
            {(products || []).map((p) => {
              const isSelected = selectedProducts.some(sp => sp.id === p.id);
              return (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${(p as any).code ?? ""}`}
                  onSelect={() => {
                    toggleProduct(p);
                  }}
                  className="flex justify-between"
                >
                  <div className="flex items-center gap-3">
                    {p.imageUrl ? <img src={p.imageUrl} alt="thumb" className="h-8 w-8 object-cover rounded" /> : null}
                    <div className="flex flex-col">
                      <span className="font-medium">{p.name} {(p as any).code ? `(${(p as any).code})` : ""}</span>
                      <span className="text-xs text-muted-foreground">{formatCurrency((p as any).salePrice)}</span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4" />}
                </CommandItem>
              );
            })}
            <CommandItem
              value="criar-novo-produto"
              onSelect={() => {
                setOpen(false);
                setCreateProductOpen(true);
              }}
            >
              <div className="flex items-center gap-2 text-blue-600">
                <Plus className="h-4 w-4" />
                <span className="font-medium">Criar Novo Produto</span>
              </div>
            </CommandItem>
          </CommandGroup>
        </CommandList>
        {/* Footer actions for multiple selection */}
        {multiple && (
          <div className="flex items-center justify-end gap-2 p-3 border-t">
            <Button variant="outline" size="sm" onClick={() => { setSelectedProducts([]); setOpen(false); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              Inserir Produtos
            </Button>
          </div>
        )}
      </CommandDialog>

      <Dialog open={createProductOpen} onOpenChange={setCreateProductOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Novo Produto</DialogTitle>
          </DialogHeader>
          <QuickProductForm
            onSuccess={handleProductCreated}
            onCancel={() => setCreateProductOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
