import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatPhone(phone: string): string {
  if (!phone) return phone;
  
  // Remove todos os caracteres não numéricos
  const numbersOnly = phone.replace(/\D/g, '');
  
  // Se não tem números suficientes, retorna como está
  if (numbersOnly.length < 10) {
    return phone;
  }
  
  // Formatar para (xx) xxxxx-xxxx para 11 dígitos
  if (numbersOnly.length === 11) {
    return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 7)}-${numbersOnly.slice(7)}`;
  }
  
  // Para números com 10 dígitos (xx) xxxx-xxxx
  if (numbersOnly.length === 10) {
    return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 6)}-${numbersOnly.slice(6)}`;
  }
  
  return phone;
}

export function handlePhoneInput(value: string): string {
  // Permitir apenas números, parênteses, espaços e hífens durante a digitação
  const cleaned = value.replace(/[^\d()\s-]/g, '');
  
  // Se o usuário está digitando, aplicar formatação progressiva
  const numbersOnly = cleaned.replace(/\D/g, '');
  
  if (numbersOnly.length <= 2) {
    return numbersOnly;
  }
  
  if (numbersOnly.length <= 7) {
    return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2)}`;
  }
  
  if (numbersOnly.length <= 11) {
    if (numbersOnly.length === 10) {
      return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 6)}-${numbersOnly.slice(6)}`;
    } else {
      return `(${numbersOnly.slice(0, 2)}) ${numbersOnly.slice(2, 7)}-${numbersOnly.slice(7)}`;
    }
  }
  
  // Limitar a 11 dígitos
  const limited = numbersOnly.slice(0, 11);
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

// Formatação de CPF
export function formatCPF(cpf: string): string {
  if (!cpf) return cpf;
  
  // Remove todos os caracteres não numéricos
  const numbersOnly = cpf.replace(/\D/g, '');
  
  // Se não tem números suficientes, retorna como está
  if (numbersOnly.length <= 11) {
    // Aplica formatação progressiva
    if (numbersOnly.length <= 3) {
      return numbersOnly;
    }
    if (numbersOnly.length <= 6) {
      return `${numbersOnly.slice(0, 3)}.${numbersOnly.slice(3)}`;
    }
    if (numbersOnly.length <= 9) {
      return `${numbersOnly.slice(0, 3)}.${numbersOnly.slice(3, 6)}.${numbersOnly.slice(6)}`;
    }
    return `${numbersOnly.slice(0, 3)}.${numbersOnly.slice(3, 6)}.${numbersOnly.slice(6, 9)}-${numbersOnly.slice(9, 11)}`;
  }
  
  return cpf;
}

// Formatação de CNPJ
export function formatCNPJ(cnpj: string): string {
  if (!cnpj) return cnpj;
  
  // Remove todos os caracteres não numéricos
  const numbersOnly = cnpj.replace(/\D/g, '');
  
  // Se não tem números suficientes, retorna como está
  if (numbersOnly.length <= 14) {
    // Aplica formatação progressiva
    if (numbersOnly.length <= 2) {
      return numbersOnly;
    }
    if (numbersOnly.length <= 5) {
      return `${numbersOnly.slice(0, 2)}.${numbersOnly.slice(2)}`;
    }
    if (numbersOnly.length <= 8) {
      return `${numbersOnly.slice(0, 2)}.${numbersOnly.slice(2, 5)}.${numbersOnly.slice(5)}`;
    }
    if (numbersOnly.length <= 12) {
      return `${numbersOnly.slice(0, 2)}.${numbersOnly.slice(2, 5)}.${numbersOnly.slice(5, 8)}/${numbersOnly.slice(8)}`;
    }
    return `${numbersOnly.slice(0, 2)}.${numbersOnly.slice(2, 5)}.${numbersOnly.slice(5, 8)}/${numbersOnly.slice(8, 12)}-${numbersOnly.slice(12, 14)}`;
  }
  
  return cnpj;
}

// Função para lidar com CPF/CNPJ automaticamente
export function formatDocument(document: string): string {
  if (!document) return document;
  
  const numbersOnly = document.replace(/\D/g, '');
  
  // Se tem 11 dígitos ou menos, trata como CPF
  if (numbersOnly.length <= 11) {
    return formatCPF(document);
  }
  // Caso contrário, trata como CNPJ
  return formatCNPJ(document);
}

export function getStatusVariant(status: string): string {
  const statusMap: Record<string, string> = {
    'available': 'available',
    'pending': 'pending', 
    'confirmed': 'confirmed',
    'allocated': 'allocated',
    'returned': 'returned',
    'maintenance': 'maintenance',
    'out_of_stock': 'out-of-stock',
    'low_stock': 'low-stock',
    'active': 'active',
    'inactive': 'inactive',
    'scheduled': 'scheduled',
    'in_progress': 'in-progress',
    'completed': 'completed',
    'cancelled': 'cancelled',
    // Alternative naming
    'em_manutencao': 'maintenance',
    'estoque_baixo': 'low-stock',
    'sem_estoque': 'out-of-stock',
    'ativo': 'active',
    'inativo': 'inactive',
    'agendado': 'scheduled',
    'em_andamento': 'in-progress',
    'concluido': 'completed',
    'cancelado': 'cancelled',
    'pendente': 'pending',
    'confirmado': 'confirmed',
    'alocado': 'allocated',
    'devolvido': 'returned',
    'disponivel': 'available'
  }
  
  return statusMap[status.toLowerCase()] || 'default'
}
