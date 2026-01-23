export interface XMLProduct {
  cProd: string;
  xProd: string;
  NCM?: string;
  CFOP?: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
}

export interface NFESupplier {
  cnpj: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface NFEData {
  supplier: NFESupplier;
  products: XMLProduct[];
  nfeNumber?: string;
  nfeDate?: string;
}

/**
 * Extrai texto de um elemento XML
 */
function getTextContent(element: Element | null): string {
  return element?.textContent?.trim() || '';
}

/**
 * Extrai número de um elemento XML
 */
function getNumericContent(element: Element | null): number {
  const text = getTextContent(element);
  return text ? parseFloat(text.replace(',', '.')) : 0;
}

/**
 * Formata CNPJ removendo caracteres especiais
 */
function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

/**
 * Parse do XML da NFe para extrair dados do fornecedor e produtos
 */
export function parseNFEXML(xmlContent: string): NFEData {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

  // Verificar se há erros no parsing
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Erro ao processar XML: Formato inválido');
  }

  // Buscar namespace da NFe
  const nfeElement = xmlDoc.querySelector('NFe') || xmlDoc.querySelector('nfeProc NFe');
  if (!nfeElement) {
    throw new Error('XML não é uma NFe válida');
  }

  // Extrair dados do emitente (fornecedor)
  const emit = nfeElement.querySelector('emit');
  if (!emit) {
    throw new Error('Dados do emitente não encontrados no XML');
  }

  const supplier: NFESupplier = {
    cnpj: formatCNPJ(getTextContent(emit.querySelector('CNPJ'))),
    name: getTextContent(emit.querySelector('xNome')),
    email: getTextContent(emit.querySelector('email')),
    phone: getTextContent(emit.querySelector('fone')),
  };

  // Extrair endereço do emitente
  const enderEmit = emit.querySelector('enderEmit');
  if (enderEmit) {
    supplier.address = getTextContent(enderEmit.querySelector('xLgr'));
    supplier.city = getTextContent(enderEmit.querySelector('xMun'));
    supplier.state = getTextContent(enderEmit.querySelector('UF'));
    supplier.zipCode = getTextContent(enderEmit.querySelector('CEP'));
  }

  if (!supplier.cnpj || !supplier.name) {
    throw new Error('CNPJ ou nome do fornecedor não encontrados');
  }

  // Extrair produtos
  const detElements = nfeElement.querySelectorAll('det');
  if (detElements.length === 0) {
    throw new Error('Nenhum produto encontrado no XML');
  }

  const products: XMLProduct[] = [];

  detElements.forEach((det) => {
    const prod = det.querySelector('prod');
    if (!prod) return;

    const imposto = det.querySelector('imposto');
    const icms = imposto?.querySelector('ICMS');
    
    // Buscar CFOP em diferentes locais possíveis
    let cfop = getTextContent(prod.querySelector('CFOP'));
    if (!cfop && icms) {
      // Tentar buscar CFOP dentro do ICMS
      const icmsVariants = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90'];
      for (const variant of icmsVariants) {
        const icmsElement = icms.querySelector(variant);
        if (icmsElement) {
          cfop = getTextContent(icmsElement.querySelector('CFOP'));
          if (cfop) break;
        }
      }
    }

    const product: XMLProduct = {
      cProd: getTextContent(prod.querySelector('cProd')),
      xProd: getTextContent(prod.querySelector('xProd')),
      NCM: getTextContent(prod.querySelector('NCM')),
      CFOP: cfop,
      uCom: getTextContent(prod.querySelector('uCom')),
      qCom: getNumericContent(prod.querySelector('qCom')),
      vUnCom: getNumericContent(prod.querySelector('vUnCom')),
      vProd: getNumericContent(prod.querySelector('vProd')),
    };

    // Validar dados obrigatórios
    if (product.cProd && product.xProd && product.qCom > 0 && product.vUnCom > 0) {
      products.push(product);
    }
  });

  if (products.length === 0) {
    throw new Error('Nenhum produto válido encontrado no XML');
  }

  // Extrair informações da NFe
  const ide = nfeElement.querySelector('ide');
  const nfeData: NFEData = {
    supplier,
    products,
    nfeNumber: getTextContent(ide?.querySelector('nNF') || null),
    nfeDate: getTextContent(ide?.querySelector('dhEmi') || null),
  };

  return nfeData;
}

/**
 * Valida se o arquivo é um XML válido da NFe
 */
export function validateNFEXML(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        // Verificar se há erros no parsing
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          resolve(false);
          return;
        }

        // Verificar se é uma NFe
        const nfeElement = xmlDoc.querySelector('NFe') || xmlDoc.querySelector('nfeProc NFe');
        resolve(!!nfeElement);
      } catch {
        resolve(false);
      }
    };
    reader.onerror = () => resolve(false);
    reader.readAsText(file);
  });
}

/**
 * Gera código de produto único baseado no código original
 */
export function generateProductCode(originalCode: string, existingCodes: string[]): string {
  let code = originalCode;
  let counter = 1;
  
  while (existingCodes.includes(code)) {
    code = `${originalCode}-${counter}`;
    counter++;
  }
  
  return code;
}

/**
 * Calcula preço de venda com base no custo e margem
 */
export function calculateSalePrice(costPrice: number, marginPercent: number = 30): number {
  return costPrice * (1 + marginPercent / 100);
}

/**
 * Interface para dados de produto formatado para importação
 */
export interface FormattedProduct {
  name?: string;
  costPrice?: number;
  salePrice?: number;
  currentStock?: number;
  categoryId?: string;
  supplierId?: string;
}

/**
 * Formata dados do produto para importação
 */
export function formatProductForImport(xmlProduct: XMLProduct, overrides: FormattedProduct = {}) {
  return {
    code: xmlProduct.cProd,
    name: overrides.name || xmlProduct.xProd,
    description: `${xmlProduct.xProd} - NCM: ${xmlProduct.NCM || 'N/A'}`,
    costPrice: overrides.costPrice || xmlProduct.vUnCom,
    salePrice: overrides.salePrice || calculateSalePrice(xmlProduct.vUnCom),
    currentStock: "0", // Estoque inicial zero, será atualizado pelo movimento de entrada
    minimumStock: Math.ceil((overrides.currentStock || xmlProduct.qCom) * 0.1),
    categoryId: overrides.categoryId,
    supplierId: overrides.supplierId,
    isActive: true,
    // Metadados da NFe
    metadata: {
      nfeCode: xmlProduct.cProd,
      ncm: xmlProduct.NCM,
      cfop: xmlProduct.CFOP,
      unit: xmlProduct.uCom,
      originalQuantity: xmlProduct.qCom,
      originalUnitValue: xmlProduct.vUnCom,
      originalTotalValue: xmlProduct.vProd,
    }
  };
}
