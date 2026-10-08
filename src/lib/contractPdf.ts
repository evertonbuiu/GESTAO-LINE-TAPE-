import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { normalizeLineTapeBrand } from '@/lib/brand';
import {
  ContractRecord,
  computeFinancials,
  formatCurrency,
  formatDateBR,
} from '@/lib/contracts';

const MARGIN = 12;
const A4_WIDTH = 210;
const A4_HEIGHT = 297;
const CONTENT_WIDTH = A4_WIDTH - MARGIN * 2;
const DEFAULT_LOGO_URL = '/line-tape-brand-512.png';

type PdfImageFormat = 'PNG' | 'JPEG' | 'WEBP';

function imageFormat(dataUrl: string): PdfImageFormat {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // CORS ou rede: o PDF é gerado sem a imagem, sem quebrar o documento.
    return null;
  }
}

/**
 * Gera e baixa o PDF A4 do contrato: cabeçalho com logo, seções, tabela de
 * equipamentos, resumo financeiro, cláusulas e assinaturas, com rodapé
 * identificando o contrato e numeração de páginas.
 */
export async function downloadContractPdf(
  contract: ContractRecord,
  options: { logoUrl?: string | null; canViewValues?: boolean } = {},
): Promise<void> {
  const { logoUrl, canViewValues = true } = options;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const details = contract.details;
  const financials = computeFinancials(details);
  const money = (value: number) => formatCurrency(value, canViewValues);

  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > A4_HEIGHT - MARGIN - 10) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const heading = (text: string) => {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(text, MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
  };

  const paragraph = (text: string) => {
    if (!text) return;
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
    lines.forEach((line: string) => {
      ensureSpace(5);
      doc.text(line, MARGIN, y);
      y += 4.4;
    });
    y += 2;
  };

  // Cabeçalho
  let logoDataUrl: string | null = null;
  for (const candidate of [...new Set([logoUrl, DEFAULT_LOGO_URL].filter(Boolean))] as string[]) {
    logoDataUrl = await toDataUrl(candidate);
    if (logoDataUrl) break;
  }
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, imageFormat(logoDataUrl), MARGIN, y, 30, 14, undefined, 'FAST');
    } catch {
      /* logo inválida: segue sem imagem */
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(normalizeLineTapeBrand(details?.parties.companyName) || 'LINE TAPE', MARGIN + 34, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    [
      details?.parties.companyAddress || '',
      `CNPJ: ${details?.parties.companyDocument || '—'}`,
    ].filter(Boolean),
    MARGIN + 34,
    y + 9.5,
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`CONTRATO Nº ${contract.contract_number}`, A4_WIDTH - MARGIN, y + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Modelo v${contract.template_version || 1}`,
    A4_WIDTH - MARGIN,
    y + 9.5,
    { align: 'right' },
  );
  y += 18;
  doc.setDrawColor(200);
  doc.line(MARGIN, y, A4_WIDTH - MARGIN, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS E LOCAÇÃO DE EQUIPAMENTOS', A4_WIDTH / 2, y, {
    align: 'center',
    maxWidth: CONTENT_WIDTH,
  });
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);

  // Partes
  heading('DAS PARTES');
  paragraph(
    `CONTRATANTE: ${contract.client_name} — CPF/CNPJ: ${contract.client_document || '—'} — ` +
      `${details?.parties.clientAddress || ''} — Tel.: ${contract.client_phone || '—'}` +
      `${contract.client_email ? ` — ${contract.client_email}` : ''}`,
  );
  paragraph(
    `CONTRATADA: ${details?.parties.companyName || ''} — CNPJ: ${
      details?.parties.companyDocument || '—'
    } — Responsável: ${details?.parties.companyRepresentative || '—'}`,
  );

  // Objeto
  heading('DO OBJETO');
  paragraph(contract.service_description || '');

  // Evento
  heading('DO EVENTO');
  paragraph(
    `Evento: ${details?.event.name || '—'} | Data: ${formatDateBR(details?.event.date)} | ` +
      `Horário: ${details?.event.startTime || '—'}${
        details?.event.endTime ? ` às ${details.event.endTime}` : ''
      } | Montagem: ${formatDateBR(details?.event.setupDate)}`,
  );
  paragraph(
    `Local: ${details?.event.location || '—'} | Vigência: ${formatDateBR(
      contract.start_date,
    )} a ${formatDateBR(contract.end_date)}`,
  );

  // Equipamentos
  const items = details?.items || [];
  if (items.length > 0) {
    heading('EQUIPAMENTOS E SERVIÇOS');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Item', 'Qtd', 'Unitário', 'Subtotal']],
      body: items.map((item) => [
        item.description ? `${item.name}\n${item.description}` : item.name,
        String(item.quantity),
        money(item.unitPrice),
        money(item.subtotal),
      ]),
      styles: { fontSize: 8.5, cellPadding: 1.6, overflow: 'linebreak' },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      columnStyles: {
        1: { cellWidth: 14, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Valores
  heading('VALORES E FORMA DE PAGAMENTO');
  const totalsRows: string[][] = [['Subtotal', money(financials.itemsSubtotal)]];
  if (financials.discount > 0) totalsRows.push(['Desconto', `- ${money(financials.discount)}`]);
  if (financials.travel > 0) totalsRows.push(['Deslocamento', money(financials.travel)]);
  if (financials.lodging > 0) totalsRows.push(['Hospedagem', money(financials.lodging)]);
  if (financials.taxes > 0) totalsRows.push(['Impostos', money(financials.taxes)]);
  totalsRows.push(['TOTAL', money(financials.total || contract.total_value)]);

  autoTable(doc, {
    startY: y,
    margin: { left: A4_WIDTH - MARGIN - 70, right: MARGIN },
    body: totalsRows,
    styles: { fontSize: 9, cellPadding: 1.4 },
    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 32, halign: 'right' } },
    theme: 'plain',
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  const installments = details?.financials.installments || [];
  if (financials.downPayment > 0 || installments.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Parcela', 'Vencimento', 'Valor']],
      body: [
        ...(financials.downPayment > 0
          ? [['Sinal', formatDateBR(details?.signature.date || contract.start_date), money(financials.downPayment)]]
          : []),
        ...installments.map((i) => [i.label, formatDateBR(i.dueDate), money(i.amount)]),
      ],
      styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      columnStyles: { 2: { halign: 'right' } },
      theme: 'grid',
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  if (contract.payment_terms) paragraph(contract.payment_terms);

  // Cláusulas
  heading('CLÁUSULAS CONTRATUAIS');
  [...(contract.sections_snapshot || [])]
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order)
    .forEach((section) => {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, MARGIN, y);
      y += 4.6;
      doc.setFont('helvetica', 'normal');
      paragraph(section.content);
    });

  if (details?.notes) {
    heading('OBSERVAÇÕES');
    paragraph(details.notes);
  }

  // Assinaturas
  ensureSpace(50);
  y += 6;
  paragraph(
    `${details?.signature.place || '—'}, ${formatDateBR(
      details?.signature.date || contract.signed_at || undefined,
    )}`,
  );
  y += 12;

  const signatureSlots: Array<[string, string]> = [
    [contract.client_name, `Contratante — ${contract.client_document || 'CPF/CNPJ'}`],
    [
      details?.parties.companyName || '',
      `Contratada — ${details?.parties.companyRepresentative || 'Responsável'}`,
    ],
  ];
  const slotWidth = CONTENT_WIDTH / 2 - 6;
  signatureSlots.forEach(([name, role], index) => {
    const x = MARGIN + index * (slotWidth + 12);
    doc.line(x, y, x + slotWidth, y);
    doc.setFontSize(9);
    doc.text(name || '', x + slotWidth / 2, y + 4, { align: 'center', maxWidth: slotWidth });
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(role, x + slotWidth / 2, y + 8, { align: 'center', maxWidth: slotWidth });
    doc.setTextColor(20);
  });
  y += 22;

  if (details?.signature.requireWitnesses) {
    ensureSpace(24);
    (details.witnesses || []).slice(0, 2).forEach((witness, index) => {
      const x = MARGIN + index * (slotWidth + 12);
      doc.line(x, y, x + slotWidth, y);
      doc.setFontSize(9);
      doc.text(witness.name || `Testemunha ${index + 1}`, x + slotWidth / 2, y + 4, {
        align: 'center',
        maxWidth: slotWidth,
      });
      doc.setFontSize(8);
      doc.setTextColor(110);
      doc.text(`CPF: ${witness.document || '—'}`, x + slotWidth / 2, y + 8, { align: 'center' });
      doc.setTextColor(20);
    });
  }

  // Rodapé com identificação e numeração
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    if (logoDataUrl) {
      try {
        doc.saveGraphicsState();
        doc.setGState(doc.GState({ opacity: 0.08 }));
        doc.addImage(
          logoDataUrl,
          imageFormat(logoDataUrl),
          A4_WIDTH / 2 - 45,
          A4_HEIGHT / 2 - 35,
          90,
          70,
          undefined,
          'FAST',
        );
        doc.restoreGraphicsState();
      } catch {
        /* mantém o PDF utilizável se a marca d'água falhar */
      }
    }
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(
      `Contrato ${contract.contract_number} — ${contract.client_name}`,
      MARGIN,
      A4_HEIGHT - 7,
    );
    doc.text(`Página ${page} de ${pages}`, A4_WIDTH - MARGIN, A4_HEIGHT - 7, { align: 'right' });
    doc.setTextColor(20);
  }

  doc.save(`contrato-${contract.contract_number}.pdf`);
}
