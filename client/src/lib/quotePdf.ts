export type QuoteItem = {
  code?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // absolute value in BRL
};

export type CompanyInfo = {
  logoBase64?: string; // data:image/png;base64,...
  name: string;
  cnpj?: string;
  address?: string;
  cityUf?: string;
  phone?: string;
  email?: string;
};

export type CustomerInfo = {
  name: string;
  doc?: string; // CPF/CNPJ
  address?: string;
  contact?: string; // telefone/email
};

export type QuoteInfo = {
  number?: string;
  date?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  paymentTerms?: string;
  notes?: string;
};

export type Signatures = {
  companyBase64?: string; // data:image/png;base64,
  customerBase64?: string; // data:image/png;base64,
};

export type QuoteDocument = {
  company: CompanyInfo;
  customer: CustomerInfo;
  quote: QuoteInfo;
  items: QuoteItem[];
  totals?: {
    subtotal?: number;
    discountTotal?: number;
    taxTotal?: number;
    shipping?: number;
    grandTotal?: number;
  };
  signatures?: Signatures;
};

function currencyBR(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date?: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function exportQuoteToPdf(doc: QuoteDocument) {
  const subtotal =
    doc.totals?.subtotal ??
    doc.items.reduce((s, it) => s + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const discountTotal = doc.totals?.discountTotal ?? doc.items.reduce((s, it) => s + (it.discount || 0), 0);
  const taxTotal = doc.totals?.taxTotal ?? 0;
  const shipping = doc.totals?.shipping ?? 0;
  const grandTotal = doc.totals?.grandTotal ?? subtotal - discountTotal + taxTotal + shipping;

  const style = `
    <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.4; }
      .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .header-table td { padding: 8px; vertical-align: top; border: none; }
      .logo-cell { width: 140px; text-align: left; }
      .company-cell { width: auto; }
      .quote-info-cell { width: 200px; text-align: right; }
      .row { display: flex; gap: 16px; align-items: flex-start; }
      .col { flex: 1; }
      .muted { color: #6b7280; }
      .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
      .section { margin-top: 16px; }
      .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
      th { background: #f9fafb; font-weight: 700; }
      tfoot td { border-top: 2px solid #111827; font-weight: 700; }
      .right { text-align: right; }
      .center { text-align: center; }
      .logo { height: 54px; object-fit: contain; max-width: 130px; }
      .sig { height: 64px; }
      .sig-line { border-top: 1px solid #111827; margin-top: 8px; padding-top: 4px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .small { font-size: 12px; line-height: 1.3; }
      .company-info { margin-bottom: 4px; }
      .quote-info { margin-bottom: 2px; }
      /* Quebras de página e impressão */
      .page-break { page-break-before: always; break-before: page; }
      tr, td, th { page-break-inside: avoid; break-inside: avoid; }
      .no-break { page-break-inside: avoid; break-inside: avoid; }
      @media print {
        .print-footer { position: fixed; bottom: 6mm; left: 18mm; right: 18mm; color: #6b7280; font-size: 10px; }
      }
      /* Modo compacto para tentar manter assinaturas na mesma página */
      body.compact .section { margin-top: 8px; }
      body.compact .card { padding: 8px; }
      body.compact .grid-2 { gap: 8px; }
      body.compact .sig { height: 56px; }
      body.compact th, body.compact td { padding: 6px; }
    </style>
  `;

  const headerHtml = `
    <table class="header-table">
      <tr>
        <td class="logo-cell">
          ${doc.company.logoBase64 ? `<img class="logo" src="${doc.company.logoBase64}" />` : ""}
        </td>
        <td class="company-cell">
          <div class="title">${doc.company.name || ""}</div>
          ${doc.company.cnpj ? `<div class="small company-info">CNPJ: ${doc.company.cnpj}</div>` : ""}
          ${doc.company.address ? `<div class="small company-info">${doc.company.address}</div>` : ""}
          ${doc.company.cityUf ? `<div class="small company-info">${doc.company.cityUf}</div>` : ""}
          ${[doc.company.phone, doc.company.email].filter(Boolean).length > 0 ? `<div class="small company-info">${[doc.company.phone, doc.company.email].filter(Boolean).join(" · ")}</div>` : ""}
        </td>
        <td class="quote-info-cell">
          <div class="small"><strong>Orçamento</strong></div>
          <div class="small quote-info">Nº: ${doc.quote.number || "-"}</div>
          <div class="small quote-info">Emissão: ${formatDate(doc.quote.date)}</div>
          <div class="small quote-info">Validade: ${formatDate(doc.quote.validUntil)}</div>
        </td>
      </tr>
    </table>
  `;

  const customerHtml = `
    <div class="section card">
      <div class="title" style="font-size:16px;">Cliente</div>
      <div class="grid-2 small">
        <div>
          <div><strong>Nome:</strong> ${doc.customer.name}</div>
          ${doc.customer.doc ? `<div><strong>Doc:</strong> ${doc.customer.doc}</div>` : ""}
        </div>
        <div>
          ${doc.customer.address ? `<div><strong>Endereço:</strong> ${doc.customer.address}</div>` : ""}
          ${doc.customer.contact ? `<div><strong>Contato:</strong> ${doc.customer.contact}</div>` : ""}
        </div>
      </div>
    </div>
  `;

  const itemsHeader = `
    <thead>
      <tr>
        <th style="width: 12%;">Código</th>
        <th>Descrição</th>
        <th class="right" style="width: 10%;">Unid</th>
        <th class="right" style="width: 10%;">Qtd</th>
        <th class="right" style="width: 16%;">Vlr Unit.</th>
        <th class="right" style="width: 16%;">Subtotal</th>
      </tr>
    </thead>
  `;

  const itemRows = doc.items.map(it => {
    const subtotalItem = it.quantity * it.unitPrice - (it.discount || 0);
    return `
      <tr>
        <td>${it.code || "-"}</td>
        <td>${it.description}</td>
        <td class="right">${it.unit || "un"}</td>
        <td class="right">${it.quantity}</td>
        <td class="right">${currencyBR(it.unitPrice)}</td>
        <td class="right">${currencyBR(subtotalItem)}</td>
      </tr>
    `;
  }).join("");

  const totalsHtml = `
    <div class="section">
      <div class="row">
        <div class="col"></div>
        <div class="col">
          <table>
            <tbody>
              <tr>
                <td class="right"><strong>Subtotal</strong></td>
                <td class="right" style="width: 30%;">${currencyBR(subtotal)}</td>
              </tr>
              ${discountTotal ? `<tr><td class="right"><strong>Descontos</strong></td><td class="right">-${currencyBR(discountTotal)}</td></tr>` : ""}
              ${taxTotal ? `<tr><td class="right"><strong>Impostos</strong></td><td class="right">${currencyBR(taxTotal)}</td></tr>` : ""}
              ${shipping ? `<tr><td class="right"><strong>Frete</strong></td><td class="right">${currencyBR(shipping)}</td></tr>` : ""}
              <tr>
                <td class="right"><strong>Total</strong></td>
                <td class="right">${currencyBR(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const paymentObsHtml = `
    <div class="section grid-2">
      <div class="card">
        <div class="title" style="font-size:16px;">Condições de Pagamento</div>
        <div class="small">${doc.quote.paymentTerms || ""}</div>
      </div>
      <div class="card">
        <div class="title" style="font-size:16px;">Observações</div>
        <div class="small">${doc.quote.notes || ""}</div>
      </div>
    </div>
  `;

  const signaturesHtml = `
    <div id="signatures" class="section grid-2 no-break" style="page-break-inside: avoid; break-inside: avoid;">
      <div class="card center">
        ${doc.signatures?.companyBase64 ? `<img class="sig" src="${doc.signatures.companyBase64}" />` : "<div style='height:64px'></div>"}
        <div class="sig-line small">Assinatura - Empresa</div>
      </div>
      <div class="card center">
        ${doc.signatures?.customerBase64 ? `<img class="sig" src="${doc.signatures.customerBase64}" />` : "<div style='height:64px'></div>"}
        <div class="sig-line small">Assinatura - Cliente</div>
      </div>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Orcamento-${(doc.quote.number || "").replace(/\s+/g, "_")}</title>
        ${style}
      </head>
      <body>
        ${headerHtml}
        ${customerHtml}
        <div class="section">
          <div class="title" style="font-size:16px;">Produtos e Serviços</div>
          <table>
            ${itemsHeader}
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>
        ${totalsHtml}
        ${paymentObsHtml}
        ${signaturesHtml}
        <div class="print-footer">
          Orçamento: ${doc.quote.number || "-"} • Gerado em ${new Date().toLocaleString("pt-BR")} • Página <span class="pageNumber"></span>
        </div>
      </body>
    </html>
  `;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Aguarda layout, aplica modo compacto se assinaturas estourarem, então imprime
  win.focus();
  const tryCompactAndPrint = () => {
    try {
      const sig = win.document.getElementById('signatures');
      if (sig) {
        const rect = sig.getBoundingClientRect();
        const footerReserve = 48; // px
        if (rect.bottom > (win.innerHeight - footerReserve)) {
          win.document.body.classList.add('compact');
        }
      }
    } catch {}
    setTimeout(() => win.print(), 50);
  };
  setTimeout(tryCompactAndPrint, 300);
}
