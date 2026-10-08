/**
 * Exportação dos Relatórios: CSV (Excel pt-BR) e impressão/PDF com layout próprio.
 * A impressão abre a caixa de diálogo do navegador — nunca baixa arquivo sozinha.
 */

import { buildCsv, csvFileName, type CsvColumn, type DateRange, formatDateBR } from "@/lib/reports";

export const downloadReportCsv = <T,>(
  slug: string,
  range: DateRange,
  rows: T[],
  columns: Array<CsvColumn<T>>,
) => {
  const csv = buildCsv(rows, columns);
  // BOM garante acentuação correta no Excel
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = csvFileName(slug, range);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { color: #555; font-size: 11px; margin-bottom: 12px; }
  .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .kpi { border: 1px solid #ddd; border-radius: 6px; padding: 6px 10px; min-width: 130px; }
  .kpi span { display: block; color: #555; font-size: 10px; }
  .kpi strong { font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th, td { border-bottom: 1px solid #e2e2e2; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  footer { margin-top: 12px; color: #777; font-size: 9px; }
`;

export interface PrintKpi {
  label: string;
  value: string;
}

export interface PrintTable {
  columns: Array<{ label: string; numeric?: boolean }>;
  rows: string[][];
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export const buildPrintHtml = (
  title: string,
  range: DateRange,
  kpis: PrintKpi[],
  table: PrintTable,
): string => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="sub">Período: ${formatDateBR(range.start)} a ${formatDateBR(range.end)}</p>
<div class="kpis">${kpis
  .map(
    (k) =>
      `<div class="kpi"><span>${escapeHtml(k.label)}</span><strong>${escapeHtml(k.value)}</strong></div>`,
  )
  .join("")}</div>
<table><thead><tr>${table.columns
  .map((c) => `<th class="${c.numeric ? "num" : ""}">${escapeHtml(c.label)}</th>`)
  .join("")}</tr></thead><tbody>${table.rows
  .map(
    (r) =>
      `<tr>${r
        .map(
          (cell, i) =>
            `<td class="${table.columns[i]?.numeric ? "num" : ""}">${escapeHtml(cell ?? "")}</td>`,
        )
        .join("")}</tr>`,
  )
  .join("")}</tbody></table>
<footer>Emitido em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} — LINE TAPE</footer>
</body></html>`;

/** Imprime via iframe isolado: não altera a página nem baixa arquivos. */
export const printReport = (
  title: string,
  range: DateRange,
  kpis: PrintKpi[],
  table: PrintTable,
) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(buildPrintHtml(title, range, kpis, table));
  doc.close();

  const run = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  if (doc.readyState === "complete") setTimeout(run, 50);
  else iframe.onload = () => setTimeout(run, 50);
};
