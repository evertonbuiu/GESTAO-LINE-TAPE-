import { useState, useCallback, useRef } from 'react';

interface CurrencyInputHook {
  displayValue: string;
  rawValue: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  setValue: (value: number) => void;
}

export function useCurrencyInput(initialValue: number = 0): CurrencyInputHook {
  const [rawValue, setRawValue] = useState<number>(initialValue);
  const [displayValue, setDisplayValue] = useState<string>(formatCurrencyInput(initialValue));

  const setValue = useCallback((value: number) => {
    setRawValue(value);
    setDisplayValue(formatCurrencyInput(value));
  }, []);

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    const cursorPosition = event.target.selectionStart || 0;
    
    // Se o campo está vazio, permite limpar
    if (inputValue === '') {
      setRawValue(0);
      setDisplayValue('');
      return;
    }
    
    const processed = processCurrencyInput(inputValue);
    
    setRawValue(processed.rawValue);
    setDisplayValue(processed.displayValue);
    
    // Preserva a posição do cursor no próximo ciclo de render
    setTimeout(() => {
      const newCursorPos = Math.min(cursorPosition, processed.displayValue.length);
      event.target.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }, []);

  return {
    displayValue,
    rawValue,
    onChange,
    setValue
  };
}

function formatCurrencyInput(value: number): string {
  if (value === 0) return '';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function processCurrencyInput(input: string): { rawValue: number; displayValue: string } {
  // Remove tudo que não é dígito
  const digitsOnly = input.replace(/\D/g, '');
  
  if (!digitsOnly || digitsOnly === '0') {
    return { rawValue: 0, displayValue: '' };
  }
  
  // Converte dígitos para valor numérico
  // Trata os últimos 2 dígitos como centavos
  let rawValue: number;
  
  if (digitsOnly.length === 1) {
    // 1 dígito: 0,0X
    rawValue = parseFloat('0.0' + digitsOnly);
  } else if (digitsOnly.length === 2) {
    // 2 dígitos: 0,XY
    rawValue = parseFloat('0.' + digitsOnly);
  } else {
    // 3+ dígitos: os dois últimos são centavos
    const integerPart = digitsOnly.slice(0, -2);
    const decimalPart = digitsOnly.slice(-2);
    rawValue = parseFloat(integerPart + '.' + decimalPart);
  }
  
  // Formata para exibição
  const displayValue = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rawValue);
  
  return { rawValue, displayValue };
}

// Função auxiliar para extrair valor numérico de string formatada
export function parseCurrencyString(currencyString: string): number {
  if (!currencyString) return 0;
  
  // Remove símbolos de moeda e caracteres de formatação, mantém apenas dígitos e vírgula
  const cleanString = currencyString
    .replace(/[^\d,]/g, '')
    .replace(',', '.');
  
  return parseFloat(cleanString) || 0;
}

// Função para formatar valor numérico para string de moeda
export function formatCurrencyValue(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}