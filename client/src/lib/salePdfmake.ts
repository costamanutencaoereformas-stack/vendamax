// pdfmake-based generator for direct download of a Sale document
// Requires: pdfmake (already used by quotePdfmake)
import pdfMake from "pdfmake/build/pdfmake";
import vfsFonts from "pdfmake/build/vfs_fonts";

// support various bundlers
(pdfMake as any).vfs = (vfsFonts as any)?.pdfMake?.vfs || (vfsFonts as any)?.vfs || (pdfMake as any).vfs;

export type SalePdfTheme = {
  primary?: string;
  muted?: string;
  fontSize?: number;
};

export type SaleItem = {
  code?: string;
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
};

export type CompanyInfo = {
  logoBase64?: string;
  name: string;
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

export type SaleInfo = {
  number?: string;
  date?: string; // DD/MM/YYYY
  paymentMethod?: string;
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

export type SaleDocument = {
  company: CompanyInfo;
  customer: CustomerInfo;
  sale: SaleInfo;
  items: SaleItem[];
  totals?: Totals;
  signatures?: { companyBase64?: string; customerBase64?: string };
};

function currencyBR(n?: number) {
  return (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function downloadSalePdf(doc: SaleDocument, filename: string, theme: SalePdfTheme = {}) {
  const primary = theme.primary || "#1f2937";
  const muted = theme.muted || "#6b7280";
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
    header: () => {
      const left = [] as any[];
      if (doc.company.logoBase64) {
        left.push({ image: doc.company.logoBase64, width: 120, margin: [0, 0, 0, 6] });
      }
      left.push({ text: doc.company.tradeName || doc.company.name, style: "title" });
      const companyLines = [
        doc.company.legalName && `Razão Social: ${doc.company.legalName}`,
        doc.company.cnpj && `CNPJ: ${doc.company.cnpj}`,
        doc.company.stateRegistration && `IE: ${doc.company.stateRegistration}`,
        doc.company.address,
        doc.company.cityUf,
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
              { text: 'Venda', style: 'h2' },
              { text: `Nº: ${doc.sale.number || '-'}`, style: 'small' },
              { text: `Emissão: ${doc.sale.date || ''}`, style: 'small' },
              { text: doc.sale.paymentMethod ? `Pagamento: ${doc.sale.paymentMethod}` : '', style: 'small' },
            ],
          }
        ]
      };
    },
    footer: (currentPage: number, pageCount: number) => {
      return {
        margin: [40, 0, 40, 24],
        columns: [
          { text: `Venda ${doc.sale.number || '-'}`, style: 'small' },
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

      { text: 'Observações', style: 'h2' },
      { text: doc.sale.notes || '', style: 'small' },

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
