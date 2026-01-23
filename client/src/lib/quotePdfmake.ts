// pdfmake-based generator for direct download with real page numbers and theme
// Requires: npm install pdfmake
import pdfMake from "pdfmake/build/pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts";

// Some builds export { pdfMake: { vfs } }, others export { vfs } directly.
// Support both to avoid runtime errors in different bundlers.
(pdfMake as any).vfs = (vfsFonts as any)?.pdfMake?.vfs || (vfsFonts as any)?.vfs || (pdfMake as any).vfs;

export type QuotePdfTheme = {
  primary?: string;
  muted?: string;
  fontSize?: number;
};

export type QuoteItem = {
  code?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type CompanyInfo = {
  logoBase64?: string;
  // Display name, typically trade name
  name: string;
  // Optional separate fields for header richness
  tradeName?: string;
  legalName?: string;
  cnpj?: string;
  stateRegistration?: string;
  address?: string;
  cityUf?: string;
  phone?: string;
  email?: string;
};

export type CustomerInfo = {
  name: string;
  doc?: string;
  address?: string;
  contact?: string;
};

export type QuoteInfo = {
  number?: string;
  date?: string; // DD/MM/YYYY
  validUntil?: string; // DD/MM/YYYY
  paymentTerms?: string;
  notes?: string;
  seller?: string;
};

export type Totals = {
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  shipping?: number;
  grandTotal?: number;
};

export type QuoteDocument = {
  company: CompanyInfo;
  customer: CustomerInfo;
  quote: QuoteInfo;
  items: QuoteItem[];
  totals?: Totals;
  signatures?: { companyBase64?: string; customerBase64?: string };
};

function currencyBR(n?: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Align date formatting with the HTML printer: accept YYYY-MM-DD and render DD/MM/YYYY
function formatDate(date?: string) {
  if (!date) return "";
  // If already in DD/MM/YYYY, keep it; if in YYYY-MM-DD, convert
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mm, d] = m;
    return `${d}/${mm}/${y}`;
  }
  return date; // fallback as-is
}

export async function downloadQuotePdf(doc: QuoteDocument, filename: string, theme: QuotePdfTheme = {}) {
  const primary = theme.primary || "#1f2937"; // gray-800
  const muted = theme.muted || "#6b7280"; // gray-500
  const baseFontSize = theme.fontSize || 10;

  const tableBody = [
    [{ text: "Código", style: "th" }, { text: "Descrição", style: "th" }, { text: "Unid", style: "th", alignment: "right" }, { text: "Qtd", style: "th", alignment: "right" }, { text: "Vlr Unit.", style: "th", alignment: "right" }, { text: "Subtotal", style: "th", alignment: "right" }],
    ...doc.items.map((it) => {
      const subtotal = it.quantity * it.unitPrice - (it.discount || 0);
      return [
        it.code || "-",
        it.description,
        { text: it.unit || "un", alignment: "right" },
        { text: String(it.quantity), alignment: "right" },
        { text: currencyBR(it.unitPrice), alignment: "right" },
        { text: currencyBR(subtotal), alignment: "right" },
      ];
    })
  ];

  const dd: any = {
    pageSize: "A4",
    pageMargins: [40, 64, 40, 64],
    styles: {
      th: { bold: true, fillColor: "#f3f4f6" },
      title: { fontSize: baseFontSize + 6, bold: true, color: primary },
      h2: { fontSize: baseFontSize + 2, bold: true, margin: [0, 8, 0, 4] },
      small: { color: muted, fontSize: baseFontSize - 1 },
      label: { color: muted },
    },
    header: (currentPage: number, pageCount: number, pageSize: any) => {
      const left = [] as any[];
      if (doc.company.logoBase64) {
        // Match HTML logo visual height (~54px)
        left.push({ image: doc.company.logoBase64, height: 54, margin: [0, 0, 0, 6] });
      }
      // Match HTML layout: title uses only company.name
      left.push({ text: doc.company.name || '', style: "title" });
      const companyLines = [
        doc.company.cnpj ? `CNPJ: ${doc.company.cnpj}` : undefined,
        doc.company.address || undefined,
        doc.company.cityUf || undefined,
        [doc.company.phone, doc.company.email].filter(Boolean).join(" · ") || undefined,
      ].filter(Boolean) as string[];
      left.push({ text: companyLines.join("\n"), style: "small" });

      return {
        margin: [40, 24, 40, 0],
        columns: [
          { width: '*', stack: left },
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: 'Orçamento', style: 'h2' },
              { text: `Nº: ${doc.quote.number || '-'}`, style: 'small' },
              { text: `Emissão: ${formatDate(doc.quote.date)}`, style: 'small' },
              { text: `Validade: ${formatDate(doc.quote.validUntil)}`, style: 'small' },
            ],
          }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [40, 0, 40, 24],
        columns: [
          { text: `Orçamento ${doc.quote.number || '-'}`, style: 'small' },
          { text: `${currentPage} / ${pageCount}`, alignment: 'right', style: 'small' },
        ],
      };
    },
    content: [
      { text: 'Cliente', style: 'h2' },
      {
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: `Nome: ${doc.customer.name}` },
              { text: doc.customer.doc ? `Doc: ${doc.customer.doc}` : '' }
            ],
            [
              { text: doc.customer.address ? `Endereço: ${doc.customer.address}` : '' },
              { text: doc.customer.contact ? `Contato: ${doc.customer.contact}` : '' }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 8]
      },

      { text: 'Produtos e Serviços', style: 'h2' },
      {
        table: {
          headerRows: 1,
          widths: [60, '*', 40, 40, 70, 70],
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#e5e7eb',
          vLineColor: () => '#e5e7eb',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        }
      },

      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              widths: [120, 100],
              body: [
                [{ text: 'Subtotal', alignment: 'right' }, { text: currencyBR(doc.totals?.subtotal), alignment: 'right' }],
                ...(doc.totals?.discountTotal ? [[{ text: 'Descontos', alignment: 'right' }, { text: '-' + currencyBR(doc.totals?.discountTotal), alignment: 'right' }]] : []),
                ...(doc.totals?.taxTotal ? [[{ text: 'Impostos', alignment: 'right' }, { text: currencyBR(doc.totals?.taxTotal), alignment: 'right' }]] : []),
                ...(doc.totals?.shipping ? [[{ text: 'Frete', alignment: 'right' }, { text: currencyBR(doc.totals?.shipping), alignment: 'right' }]] : []),
                [{ text: 'Total', alignment: 'right', bold: true }, { text: currencyBR(doc.totals?.grandTotal), alignment: 'right', bold: true }],
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 12, 0, 0]
          }
        ]
      },

      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Condições de Pagamento', style: 'h2' },
              { text: doc.quote.paymentTerms || '', style: 'small' }
            ]
          },
          {
            width: '*',
            stack: [
              { text: 'Observações', style: 'h2' },
              { text: doc.quote.notes || '', style: 'small' }
            ]
          }
        ]
      },

      {
        columns: [
          { width: '*', text: '' },
          { width: 'auto', text: doc.quote.seller ? `Vendedor: ${doc.quote.seller}` : '', style: 'small' }
        ],
        margin: [0, 8, 0, 0]
      },

      { text: 'Assinaturas', style: 'h2', margin: [0, 16, 0, 8] },
      {
        columns: [
          {
            width: '*',
            stack: [
              doc.signatures?.companyBase64 ? { image: doc.signatures.companyBase64, width: 200, height: 60 } : { text: '\n\n\n' },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 280, y2: 0, lineWidth: 0.5 }] },
              { text: 'Assinatura - Empresa', style: 'small', alignment: 'center' }
            ]
          },
          {
            width: '*',
            stack: [
              doc.signatures?.customerBase64 ? { image: doc.signatures.customerBase64, width: 200, height: 60 } : { text: '\n\n\n' },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 280, y2: 0, lineWidth: 0.5 }] },
              { text: 'Assinatura - Cliente', style: 'small', alignment: 'center' }
            ]
          }
        ]
      }
    ]
  };

  pdfMake.createPdf(dd).download(filename);
}
