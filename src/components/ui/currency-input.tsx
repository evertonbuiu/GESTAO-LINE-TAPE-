import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number;
  onChange?: (value: number) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value = 0, onChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    // Formatar valor para exibição com símbolo de moeda
    const formatCurrency = React.useCallback((val: number) => {
      if (val === 0) return '';
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(val);
    }, []);

    // Processar input tratando dígitos como centavos (padrão brasileiro)
    const processInput = React.useCallback((input: string): { rawValue: number; displayValue: string } => {
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
      
      // Formata para exibição em tempo real
      const formattedDisplay = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(rawValue);
      
      return { rawValue, displayValue: formattedDisplay };
    }, []);

    // Atualizar display quando valor prop mudar
    React.useEffect(() => {
      setDisplayValue(formatCurrency(value));
    }, [value, formatCurrency]);

    const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Se o campo está vazio, permite limpar
      if (inputValue === '') {
        setDisplayValue('');
        onChange?.(0);
        return;
      }
      
      const processed = processInput(inputValue);
      
      setDisplayValue(processed.displayValue);
      onChange?.(processed.rawValue);
    }, [processInput, onChange]);

    // Combinar refs
    React.useImperativeHandle(ref, () => inputRef.current!, []);

    return (
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={cn(className)}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
