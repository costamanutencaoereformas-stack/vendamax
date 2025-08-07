export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
}

export function formatDocument(document: string): string {
  const clean = document.replace(/[^\d]/g, '');
  
  if (clean.length === 11) {
    // CPF: 000.000.000-00
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return document;
}

export function formatPhone(phone: string): string {
  const clean = phone.replace(/[^\d]/g, '');
  
  if (clean.length === 10) {
    // (00) 0000-0000
    return clean.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (clean.length === 11) {
    // (00) 00000-0000
    return clean.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  
  return phone;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatCEP(cep: string): string {
  const clean = cep.replace(/[^\d]/g, '');
  
  if (clean.length === 8) {
    return clean.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  
  return cep;
}

export function validateCEP(cep: string): boolean {
  const clean = cep.replace(/[^\d]/g, '');
  return clean.length === 8 && /^\d+$/.test(clean);
}

export function getDocumentType(document: string): 'CPF' | 'CNPJ' | 'UNKNOWN' {
  const clean = document.replace(/[^\d]/g, '');
  
  if (clean.length === 11) return 'CPF';
  if (clean.length === 14) return 'CNPJ';
  return 'UNKNOWN';
}
