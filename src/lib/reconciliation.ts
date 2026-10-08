/**
 * Sugestões de conciliação bancária.
 * Pontuação por valor, data e descrição — nunca confirma automaticamente.
 */

export interface ReconcilableEntry {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type?: "income" | "expense";
}

export interface Suggestion<T extends ReconcilableEntry> {
  candidate: T;
  score: number; // 0..100
  reasons: string[];
  confidence: "alta" | "media" | "baixa";
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

/** Similaridade por tokens compartilhados (Jaccard, 0..1). */
export const textSimilarity = (a: string, b: string): number => {
  const A = new Set(normalize(a));
  const B = new Set(normalize(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter += 1;
  });
  return inter / (A.size + B.size - inter);
};

export const daysBetween = (a: string, b: string): number =>
  Math.abs(
    Math.round(
      (new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000,
    ),
  );

export const scoreMatch = (
  source: ReconcilableEntry,
  candidate: ReconcilableEntry,
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let score = 0;

  const diff = Math.abs(source.amount - candidate.amount);
  if (diff <= 0.01) {
    score += 55;
    reasons.push("Valor idêntico");
  } else if (diff <= Math.abs(source.amount) * 0.02) {
    score += 35;
    reasons.push("Valor com diferença até 2%");
  } else if (diff <= Math.abs(source.amount) * 0.1) {
    score += 15;
    reasons.push("Valor aproximado");
  }

  const dd = daysBetween(source.date, candidate.date);
  if (dd === 0) {
    score += 30;
    reasons.push("Mesma data");
  } else if (dd <= 2) {
    score += 20;
    reasons.push(`Diferença de ${dd} dia(s)`);
  } else if (dd <= 7) {
    score += 8;
    reasons.push(`Diferença de ${dd} dia(s)`);
  }

  const sim = textSimilarity(source.description, candidate.description);
  if (sim >= 0.6) {
    score += 15;
    reasons.push("Descrição muito parecida");
  } else if (sim >= 0.25) {
    score += 8;
    reasons.push("Descrição parecida");
  }

  if (source.type && candidate.type && source.type !== candidate.type) {
    score = Math.max(0, score - 40);
    reasons.push("Tipo divergente (receita x despesa)");
  }

  return { score: Math.min(100, score), reasons };
};

export const confidenceOf = (score: number): Suggestion<ReconcilableEntry>["confidence"] =>
  score >= 80 ? "alta" : score >= 50 ? "media" : "baixa";

export const suggestMatches = <T extends ReconcilableEntry>(
  source: ReconcilableEntry,
  candidates: T[],
  { limit = 3, minScore = 30 }: { limit?: number; minScore?: number } = {},
): Suggestion<T>[] =>
  candidates
    .map((candidate) => {
      const { score, reasons } = scoreMatch(source, candidate);
      return { candidate, score, reasons, confidence: confidenceOf(score) };
    })
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
