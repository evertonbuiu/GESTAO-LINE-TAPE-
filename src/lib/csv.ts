/** Utilitários de exportação CSV (compatível com Excel PT-BR). */

export const toCsv = (
  rows: Array<Record<string, unknown>>,
  columns?: Array<{ key: string; label: string }>,
): string => {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = value instanceof Date ? value.toISOString() : String(value);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = cols.map((c) => escape(c.label)).join(";");
  const body = rows.map((r) => cols.map((c) => escape(r[c.key])).join(";"));
  return [header, ...body].join("\n");
};

export const downloadCsv = (
  filename: string,
  rows: Array<Record<string, unknown>>,
  columns?: Array<{ key: string; label: string }>,
) => {
  const csv = toCsv(rows, columns);
  // BOM para o Excel reconhecer acentuação
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
