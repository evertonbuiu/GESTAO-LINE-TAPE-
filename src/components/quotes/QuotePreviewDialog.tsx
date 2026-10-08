import { useEffect, useRef, useState } from 'react';
import { Download, ImageOff, Loader2, Printer, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getQuoteStatusClasses, getQuoteStatusLabel } from '@/lib/quotes';
import { resolveProductImageDisplayUrl } from '@/lib/storageUrls';

export interface QuotePreviewProduct {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  image_url?: string;
}

function ProductImage({ src, alt }: { src?: string; alt: string }) {
  const displaySrc = resolveProductImageDisplayUrl(src);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(displaySrc ? 'loading' : 'error');

  useEffect(() => {
    setState(displaySrc ? 'loading' : 'error');
  }, [displaySrc]);

  if (!displaySrc || state === 'error') {
    return (
      <div
        className="doc-noimage flex h-16 w-16 flex-col items-center justify-center gap-1 rounded border bg-muted text-[9px] text-muted-foreground"
        role="img"
        aria-label={`Sem imagem para ${alt}`}
      >
        <ImageOff className="h-4 w-4" aria-hidden="true" />
        <span>Sem imagem</span>
      </div>
    );
  }

  return (
    <div className="doc-thumb relative h-16 w-16 overflow-hidden rounded border bg-muted">
      {state === 'loading' && <Skeleton className="absolute inset-0 h-full w-full" />}
      <img
        src={displaySrc}
        alt={alt}
        width={64}
        height={64}
        loading="eager"
        referrerPolicy="no-referrer"
        className="h-16 w-16 object-cover"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
      />
    </div>
  );
}

export interface QuotePreviewData {
  id: string;
  quote_number?: string;
  quote_date?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  client_document?: string;
  client_address?: string;
  event_name?: string;
  event_date?: string;
  event_location?: string;
  decorator_name?: string;
  technical_responsible?: string;
  products?: QuotePreviewProduct[];
  subtotal?: number;
  discount_percentage?: number;
  discount_amount?: number;
  travel_expense?: number;
  accommodation_expense?: number;
  total_amount?: number;
  tax_option?: string;
  status?: string;
  notes?: string;
}

interface QuotePreviewDialogProps {
  quote: QuotePreviewData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewValues: boolean;
  onDownloadPdf: (quote: QuotePreviewData) => void | Promise<void>;
  company: { name: string; address: string; phone: string; email: string };
  logoUrl?: string | null;
}

function money(value: number | undefined, canViewValues: boolean) {
  if (!canViewValues) return '---';
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string) {
  const dateOnly = (value || '').split('T')[0];
  const [y, m, d] = dateOnly.split('-');
  return y && m && d ? `${d}/${m}/${y}` : 'Não informado';
}

/** CSS aplicado ao documento isolado de impressão (A4 retrato). */
export const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 11mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { background: #ffffff; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #111111;
    margin: 0;
    font-size: 11.5px;
    line-height: 1.35;
  }
  h1, h2, h3 { margin: 0 0 4px; }
  h2 { font-size: 15px; }
  h3 { font-size: 12.5px; }
  p { margin: 0 0 2px; }
  .muted, .text-muted-foreground { color: #555555; }
  section { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  section.doc-items { break-inside: auto; page-break-inside: auto; }
  .doc-header {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    border-bottom: 1px solid #cccccc; padding-bottom: 8px;
  }
  .doc-brand { display: flex; align-items: center; gap: 10px; }
  .doc-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
  .doc-meta { text-align: right; }
  .doc-parties { display: flex; gap: 16px; }
  .doc-parties > div { flex: 1 1 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, img { break-inside: avoid; page-break-inside: avoid; }
  th, td {
    border: 1px solid #cccccc; padding: 5px; text-align: left; font-size: 10.5px;
    vertical-align: top; overflow-wrap: anywhere; word-break: break-word;
  }
  th { background: #f2f2f2; }
  col.c-photo { width: 78px; } col.c-item { width: auto; }
  col.c-qty { width: 44px; } col.c-unit { width: 92px; } col.c-total { width: 96px; }
  td img { width: 64px; height: 64px; object-fit: cover; border: 1px solid #dddddd; border-radius: 3px; }
  .doc-noimage {
    width: 64px; height: 64px; border: 1px solid #dddddd; border-radius: 3px; background: #f5f5f5;
    color: #777777; font-size: 8px; display: flex; align-items: center; justify-content: center; text-align: center;
  }
  .doc-noimage svg { display: none; }
  .right, .doc-totals-row span:last-child { text-align: right; }
  .doc-totals { width: 62mm; margin-left: auto; break-inside: avoid; page-break-inside: avoid; }
  .doc-totals-row { display: flex; justify-content: space-between; padding: 1px 0; }
  .doc-total-final { border-top: 1px solid #111111; margin-top: 3px; padding-top: 3px; font-weight: bold; font-size: 13px; }
  .doc-notes p { white-space: pre-wrap; }
`;

/** Monta o HTML completo do documento de impressão. Exportado para testes. */
export function buildPrintDocument(bodyHtml: string, title: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${title}</title>
<style>${PRINT_STYLES}</style>
</head><body><main class="doc-root">${bodyHtml}</main></body></html>`;
}

/** Aguarda fontes e imagens do documento, com timeout de segurança. */
export async function waitForDocumentAssets(doc: Document, timeoutMs = 5000) {
  const guard = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  const fonts = (doc as any).fonts?.ready ? Promise.resolve((doc as any).fonts.ready) : Promise.resolve();
  const images = Promise.all(
    Array.from(doc.images || []).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  );
  await Promise.race([Promise.all([fonts, images]).then(() => undefined), guard]);
}

export function QuotePreviewDialog({
  quote,
  open,
  onOpenChange,
  canViewValues,
  onDownloadPdf,
  company,
  logoUrl,
}: QuotePreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  if (!quote) return null;

  const products = quote.products || [];

  const handlePrint = async () => {
    if (printing) return;
    const node = printRef.current;
    if (!node) return;
    setPrinting(true);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Impressão do orçamento');
    document.body.appendChild(iframe);

    const cleanup = () => {
      setPrinting(false);
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 500);
    };

    const doc = iframe.contentDocument;
    if (!doc) {
      cleanup();
      return;
    }

    doc.open();
    doc.write(buildPrintDocument(node.innerHTML, `Orçamento ${quote.quote_number || ''}`));
    doc.close();

    try {
      await waitForDocumentAssets(doc);
      const win = iframe.contentWindow;
      win?.addEventListener?.('afterprint', cleanup, { once: true });
      win?.focus();
      win?.print();
      setTimeout(cleanup, 1000);
    } catch {
      cleanup();
    }
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownloadPdf(quote);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
          <DialogTitle>Pré-visualização do orçamento {quote.quote_number || ''}</DialogTitle>
          <DialogDescription>
            Visualização do documento como o cliente irá receber. Nenhum arquivo é baixado nesta tela.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div ref={printRef} className="doc-root space-y-6 px-4 py-4 text-sm sm:px-6">
            {/* Cabeçalho */}
            <section className="doc-header flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="doc-brand flex items-center gap-3">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={`Logotipo ${company.name}`}
                    className="doc-logo h-12 w-auto object-contain"
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h2 className="text-base font-bold">{company.name}</h2>
                  <p className="text-xs text-muted-foreground muted">{company.address}</p>
                  <p className="text-xs text-muted-foreground muted">
                    {company.phone} • {company.email}
                  </p>
                </div>
              </div>
              <div className="doc-meta sm:text-right">
                <p className="font-semibold">Orçamento {quote.quote_number || ''}</p>
                <p className="text-xs text-muted-foreground muted">Emissão: {formatDate(quote.quote_date)}</p>
                <Badge variant="outline" className={getQuoteStatusClasses(quote.status)}>
                  {getQuoteStatusLabel(quote.status)}
                </Badge>
              </div>
            </section>

            {/* Cliente e evento */}
            <section className="doc-parties grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="mb-1 text-sm font-semibold">Cliente</h3>
                <p>{quote.client_name || 'Não informado'}</p>
                {quote.client_document && <p className="text-xs muted">Documento: {quote.client_document}</p>}
                {quote.client_phone && <p className="text-xs muted">Telefone: {quote.client_phone}</p>}
                {quote.client_email && <p className="text-xs muted">E-mail: {quote.client_email}</p>}
                {quote.client_address && <p className="text-xs muted">Endereço: {quote.client_address}</p>}
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold">Evento</h3>
                <p>{quote.event_name || 'Não informado'}</p>
                <p className="text-xs muted">Data: {formatDate(quote.event_date)}</p>
                {quote.event_location && <p className="text-xs muted">Local: {quote.event_location}</p>}
                {quote.decorator_name && <p className="text-xs muted">Decorador: {quote.decorator_name}</p>}
                {quote.technical_responsible && (
                  <p className="text-xs muted">Responsável técnico: {quote.technical_responsible}</p>
                )}
              </div>
            </section>

            {/* Itens */}
            <section className="doc-items">
              <h3 className="mb-1 text-sm font-semibold">Itens</h3>
              <table className="w-full border-collapse text-xs">
                <colgroup>
                  <col className="c-photo" />
                  <col className="c-item" />
                  <col className="c-qty" />
                  <col className="c-unit" />
                  <col className="c-total" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="border p-2 text-left">Foto</th>
                    <th className="border p-2 text-left">Item</th>
                    <th className="border p-2 text-left">Qtd</th>
                    <th className="border p-2 text-left right">Valor unit.</th>
                    <th className="border p-2 text-left right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td className="border p-2" colSpan={5}>
                        Nenhum item cadastrado.
                      </td>
                    </tr>
                  ) : (
                    products.map((product, index) => (
                      <tr key={product.id || `${product.name}-${index}`}>
                        <td className="border p-2 align-top">
                          <ProductImage src={product.image_url} alt={product.name || 'Item do orçamento'} />
                        </td>
                        <td className="border p-2">
                          <span className="font-medium">{product.name}</span>
                          {product.description && <div className="muted">{product.description}</div>}
                        </td>
                        <td className="border p-2">{product.quantity}</td>
                        <td className="border p-2 right">{money(product.unit_price, canViewValues)}</td>
                        <td className="border p-2 right">{money(product.total_price, canViewValues)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            {/* Valores */}
            <section className="doc-totals ml-auto w-full space-y-1 sm:w-72">
              <div className="doc-totals-row flex justify-between">
                <span className="muted">Subtotal</span>
                <span>{money(quote.subtotal, canViewValues)}</span>
              </div>
              {Boolean(quote.discount_amount) && (
                <div className="doc-totals-row flex justify-between">
                  <span className="muted">Desconto ({quote.discount_percentage || 0}%)</span>
                  <span>- {money(quote.discount_amount, canViewValues)}</span>
                </div>
              )}
              {Boolean(quote.travel_expense) && (
                <div className="doc-totals-row flex justify-between">
                  <span className="muted">Viagem</span>
                  <span>{money(quote.travel_expense, canViewValues)}</span>
                </div>
              )}
              {Boolean(quote.accommodation_expense) && (
                <div className="doc-totals-row flex justify-between">
                  <span className="muted">Hospedagem</span>
                  <span>{money(quote.accommodation_expense, canViewValues)}</span>
                </div>
              )}
              <div className="doc-totals-row doc-total-final flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{money(quote.total_amount, canViewValues)}</span>
              </div>
            </section>

            {/* Observações */}
            {quote.notes && (
              <section className="doc-notes">
                <h3 className="mb-1 text-sm font-semibold">Observações</h3>
                <p className="whitespace-pre-wrap text-xs muted">{quote.notes}</p>
              </section>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Fechar
          </Button>
          <Button type="button" variant="secondary" className="min-h-11" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Imprimir
          </Button>
          <Button type="button" className="min-h-11" onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuotePreviewDialog;
