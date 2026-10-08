import { supabase } from '@/integrations/supabase/client';

/** Formata um número inteiro no padrão histórico #001. */
export function formatQuoteNumber(sequence: number): string {
  return `#${String(Math.max(1, Math.floor(sequence))).padStart(3, '0')}`;
}

/** Extrai o valor numérico de um número de orçamento (#012 -> 12). */
export function parseQuoteNumber(value: string | null | undefined): number {
  const digits = (value || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/**
 * Reserva um número de orçamento único e concorrente no banco (sequence via RPC).
 * Mantém compatibilidade com números antigos e nunca renumera registros existentes.
 * Em caso de indisponibilidade da RPC, usa fallback baseado no maior número atual.
 */
export async function reserveQuoteNumber(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('next_quote_number');
    if (!error && typeof data === 'string' && data.trim()) {
      return data;
    }
  } catch {
    // segue para o fallback
  }

  const { data: rows } = await supabase.from('external_quotes').select('quote_number');
  const max = (rows || []).reduce(
    (acc: number, row: { quote_number?: string }) => Math.max(acc, parseQuoteNumber(row.quote_number)),
    0,
  );
  return formatQuoteNumber(max + 1);
}
