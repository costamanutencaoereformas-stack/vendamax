export function formatCurrency(value: number | string): string {
  if (value === undefined || value === null) return 'R$ 0,00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
}

export function formatDocument(document: string): string {
  if (!document) return '';
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
  if (!phone) return '';
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

export function formatDateTime(date: string | Date): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj);
}

export function formatDate(date: string | Date): string {
  if (!date) return '';
  // Handle common string cases to avoid timezone day-shift
  if (typeof date === 'string') {
    // Case 1: Pure date string YYYY-MM-DD
    const m1 = date.match(/^(\d{4})-(\d{2})-(\d{2})(?!T)/);
    if (m1) {
      const [, y, m, d] = m1;
      return `${d}/${m}/${y}`;
    }
    // Case 2: ISO at midnight UTC -> treat as date-only
    const m2 = date.match(/^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/);
    if (m2) {
      const [, y, m, d] = m2;
      return `${d}/${m}/${y}`;
    }
  }
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(dateObj);
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function getDocumentType(document: string): 'CPF' | 'CNPJ' | null {
  if (!document) return null;
  
  const clean = document.replace(/[^\d]/g, '');
  
  if (clean.length === 11) {
    return 'CPF';
  } else if (clean.length === 14) {
    return 'CNPJ';
  }
  
  return null;
}

// Date utilities to handle timezone consistently
export function createDateFromInput(dateInput: string): Date {
  // For date inputs (YYYY-MM-DD), create date at local noon to avoid timezone shifts
  if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  return new Date(dateInput);
}

export function formatDateForInput(date: Date | string | null): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return '';
  
  // Format as YYYY-MM-DD for input fields
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createISODateString(dateInput: string): string {
  // Create consistent ISO string for backend
  const date = createDateFromInput(dateInput);
  return date.toISOString();
}
