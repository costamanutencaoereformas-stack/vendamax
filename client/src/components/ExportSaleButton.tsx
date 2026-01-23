import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SignaturePad from "@/components/SignaturePad";
import { exportSaleToPdf, type SaleDocument as HtmlSaleDocument } from "@/lib/salePdf";
import { downloadSalePdf, type SalePdfTheme, type SaleDocument as PmSaleDocument } from "@/lib/salePdfmake";

export interface ExportSaleButtonProps {
  doc: Omit<HtmlSaleDocument, "signatures"> & { signatures?: HtmlSaleDocument["signatures"] };
  buttonText?: string;
  disabled?: boolean;
  companyLogoUrl?: string; // optional URL to fetch and embed as base64
  saleId?: string; // reserved for future persistence of signatures
  enablePersist?: boolean; // currently unused; kept for API symmetry
  theme?: SalePdfTheme;
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export default function ExportSaleButton({ doc, buttonText = "Exportar PDF", disabled, companyLogoUrl, saleId, enablePersist = false, theme }: ExportSaleButtonProps) {
  const [open, setOpen] = useState(false);
  const [companySign, setCompanySign] = useState<string | null>(doc.signatures?.companyBase64 || null);
  const [customerSign, setCustomerSign] = useState<string | null>(doc.signatures?.customerBase64 || null);
  const [error, setError] = useState<string>("");

  async function ensureCompany(docIn: ExportSaleButtonProps["doc"], logoUrl?: string) {
    let merged = { ...docIn } as ExportSaleButtonProps["doc"];
    const missingName = !merged.company?.name;
    const missingFields = !merged.company?.cnpj && !merged.company?.address && !merged.company?.email && !merged.company?.phone;
    if (missingName || missingFields) {
      try {
        const res = await fetch("/api/company");
        if (res.ok) {
          const s = await res.json();
          const addr = [s?.address && `${s.address}${s?.number ? ", " + s.number : ""}`, s?.complement, s?.neighborhood, s?.zipCode].filter(Boolean).join(" · ");
          const cityUf = [s?.city, s?.state].filter(Boolean).join(" - ");
          merged = {
            ...merged,
            company: {
              ...merged.company,
              name: merged.company.name || s?.tradeName || s?.name || "",
              cnpj: merged.company.cnpj || s?.cnpj || "",
              address: merged.company.address || addr || "",
              cityUf: merged.company.cityUf || cityUf || "",
              phone: merged.company.phone || s?.phone || "",
              email: merged.company.email || s?.email || "",
              logoBase64: merged.company.logoBase64,
            },
          } as any;
          if (!logoUrl && s?.logoUrl) logoUrl = s.logoUrl as string;
        }
      } catch {}
    }
    return { merged, logoUrl };
  }

  async function buildWithLogo() {
    const { merged, logoUrl } = await ensureCompany(doc, companyLogoUrl);
    let logoBase64 = merged.company.logoBase64;
    if (!logoBase64 && logoUrl) {
      try {
        logoBase64 = await fetchImageAsDataUrl(logoUrl);
      } catch {
        // ignore
      }
    }
    return { ...merged, company: { ...merged.company, logoBase64 } };
  }

  async function handlePrint() {
    setError("");
    const ready = await buildWithLogo();
    exportSaleToPdf({
      ...ready,
      signatures: { companyBase64: companySign || undefined, customerBase64: customerSign || undefined },
    });
    setOpen(false);
  }

  async function handleDownload() {
    setError("");
    const ready = await buildWithLogo();
    const filename = `Venda-${(ready.sale.number || "").replace(/\s+/g, "_") || "sem-numero"}.pdf`;
    await downloadSalePdf({
      ...(ready as unknown as PmSaleDocument),
      signatures: { companyBase64: companySign || undefined, customerBase64: customerSign || undefined },
    }, filename, theme);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>{buttonText}</Button>
      </DialogTrigger>
      <DialogContent className="w-screen h-screen md:h-auto md:max-w-[860px] md:w-[860px] max-w-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar Venda em PDF</DialogTitle>
          <DialogDescription>Revise e insira as assinaturas antes de gerar o PDF.</DialogDescription>
        </DialogHeader>
        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2" role="alert">{error}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-2 text-sm text-muted-foreground">Assinatura - Empresa</div>
            <SignaturePad onChange={setCompanySign} />
          </div>
          <div>
            <div className="mb-2 text-sm text-muted-foreground">Assinatura - Cliente</div>
            <SignaturePad onChange={setCustomerSign} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handlePrint}>Gerar PDF</Button>
          <Button onClick={handleDownload}>Baixar PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
