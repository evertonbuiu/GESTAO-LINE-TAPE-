import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Loader2, Printer, X } from 'lucide-react';
import {
  ContractRecord,
  STATUS_COLORS,
  STATUS_LABELS,
  buildContractPrintDocument,
  computeFinancials,
  formatCurrency,
  formatDateBR,
  normalizeStatus,
  waitForContractAssets,
} from '@/lib/contracts';
import { normalizeLineTapeBrand } from '@/lib/brand';

interface ContractPreviewDialogProps {
  contract: ContractRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canViewValues?: boolean;
  logoUrl?: string | null;
  onDownloadPdf: (contract: ContractRecord) => Promise<void> | void;
}

function ItemPhoto({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="doc-noimage" role="img" aria-label={`${alt}: sem imagem`}>
        Sem imagem
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-16 h-16 object-cover rounded border border-border/60"
    />
  );
}

export function ContractPreviewDialog({
  contract,
  open,
  onOpenChange,
  canViewValues = true,
  logoUrl,
  onDownloadPdf,
}: ContractPreviewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!contract) return null;

  const details = contract.details;
  const items = details?.items || [];
  const sections = [...(contract.sections_snapshot || [])]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);
  const financials = computeFinancials(details);
  const status = normalizeStatus(contract.status);
  const money = (value: number) => formatCurrency(value, canViewValues);

  const handlePrint = async () => {
    if (printing) return;
    const node = printRef.current;
    if (!node) return;
    setPrinting(true);

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'Impressão do contrato');
    document.body.appendChild(iframe);

    const cleanup = () => {
      setPrinting(false);
      setTimeout(() => iframe.parentNode?.removeChild(iframe), 500);
    };

    const doc = iframe.contentDocument;
    if (!doc) return cleanup();

    doc.open();
    doc.write(
      buildContractPrintDocument(
        node.innerHTML,
        `Contrato ${contract.contract_number}`,
        `Contrato ${contract.contract_number} — ${contract.client_name}`,
      ),
    );
    doc.close();

    try {
      await waitForContractAssets(doc);
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
      await onDownloadPdf(contract);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col min-h-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-3">
            Contrato {contract.contract_number}
            <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
          </DialogTitle>
          <DialogDescription>
            Pré-visualização fiel do documento. Nenhum download é iniciado até você clicar em
            "Baixar PDF".
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div ref={printRef} className="doc-root bg-white text-black p-6 rounded-md text-[12px]">
            {/* Cabeçalho */}
            <section className="doc-header">
              <div className="doc-brand">
                {logoUrl && <img src={logoUrl} alt="Logo da empresa" className="doc-logo" />}
                <div>
                  <h2>{normalizeLineTapeBrand(details?.parties.companyName) || 'LINE TAPE'}</h2>
                  <p className="muted">{details?.parties.companyAddress}</p>
                  <p className="muted">
                    {details?.parties.companyPhone} {details?.parties.companyEmail}
                  </p>
                  <p className="muted">CNPJ: {details?.parties.companyDocument || '—'}</p>
                </div>
              </div>
              <div className="doc-meta">
                <p>
                  <strong>CONTRATO Nº {contract.contract_number}</strong>
                </p>
                <p className="muted">Modelo: {contract.template_name || 'Padrão LINE TAPE'}</p>
                <p className="muted">Versão do modelo: v{contract.template_version || 1}</p>
                {contract.source_quote_number && (
                  <p className="muted">Orçamento {contract.source_quote_number}</p>
                )}
              </div>
            </section>

            <h1>Contrato de Prestação de Serviços e Locação de Equipamentos</h1>

            {/* Partes */}
            <section>
              <h2>Das Partes</h2>
              <div className="doc-grid">
                <div>
                  <h3>Contratante</h3>
                  <p>{contract.client_name}</p>
                  <p className="muted">CPF/CNPJ: {contract.client_document || '—'}</p>
                  <p className="muted">{details?.parties.clientAddress}</p>
                  <p className="muted">
                    {contract.client_phone} {contract.client_email}
                  </p>
                </div>
                <div>
                  <h3>Contratada</h3>
                  <p>{details?.parties.companyName}</p>
                  <p className="muted">CNPJ: {details?.parties.companyDocument || '—'}</p>
                  <p className="muted">Responsável: {details?.parties.companyRepresentative}</p>
                  {details?.parties.technicalResponsible && (
                    <p className="muted">Resp. técnico: {details.parties.technicalResponsible}</p>
                  )}
                </div>
              </div>
            </section>

            {/* Objeto e evento */}
            <section>
              <h2>Do Objeto</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{contract.service_description}</p>
            </section>

            <section>
              <h2>Do Evento</h2>
              <div className="doc-grid">
                <div>
                  <p>
                    <strong>Evento:</strong> {details?.event.name || '—'}
                  </p>
                  <p>
                    <strong>Data:</strong> {formatDateBR(details?.event.date)}
                  </p>
                  <p>
                    <strong>Horário:</strong> {details?.event.startTime || '—'}
                    {details?.event.endTime ? ` às ${details.event.endTime}` : ''}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Montagem:</strong> {formatDateBR(details?.event.setupDate)}
                  </p>
                  <p>
                    <strong>Local:</strong> {details?.event.location || '—'}
                  </p>
                  <p>
                    <strong>Vigência:</strong> {formatDateBR(contract.start_date)} a{' '}
                    {formatDateBR(contract.end_date)}
                  </p>
                </div>
              </div>
            </section>

            {/* Equipamentos */}
            {items.length > 0 && (
              <section className="doc-items">
                <h2>Equipamentos e Serviços</h2>
                <table>
                  <colgroup>
                    <col className="c-photo" />
                    <col className="c-item" />
                    <col className="c-qty" />
                    <col className="c-unit" />
                    <col className="c-total" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Foto</th>
                      <th>Item</th>
                      <th>Qtd</th>
                      <th className="right">Unitário</th>
                      <th className="right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <ItemPhoto src={item.imageUrl} alt={item.name} />
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                          {item.description && <div className="muted">{item.description}</div>}
                        </td>
                        <td>{item.quantity}</td>
                        <td className="right">{money(item.unitPrice)}</td>
                        <td className="right">{money(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {/* Valores */}
            <section>
              <h2>Valores e Forma de Pagamento</h2>
              <div className="doc-totals">
                <div className="doc-totals-row">
                  <span>Subtotal</span>
                  <span>{money(financials.itemsSubtotal)}</span>
                </div>
                {financials.discount > 0 && (
                  <div className="doc-totals-row">
                    <span>Desconto</span>
                    <span>- {money(financials.discount)}</span>
                  </div>
                )}
                {financials.travel > 0 && (
                  <div className="doc-totals-row">
                    <span>Deslocamento</span>
                    <span>{money(financials.travel)}</span>
                  </div>
                )}
                {financials.lodging > 0 && (
                  <div className="doc-totals-row">
                    <span>Hospedagem</span>
                    <span>{money(financials.lodging)}</span>
                  </div>
                )}
                {financials.taxes > 0 && (
                  <div className="doc-totals-row">
                    <span>Impostos</span>
                    <span>{money(financials.taxes)}</span>
                  </div>
                )}
                <div className="doc-totals-row doc-total-final">
                  <span>Total</span>
                  <span>{money(financials.total || contract.total_value)}</span>
                </div>
              </div>

              {(financials.downPayment > 0 || (details?.financials.installments || []).length > 0) && (
                <table>
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th className="right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.downPayment > 0 && (
                      <tr>
                        <td>Sinal</td>
                        <td>{formatDateBR(details?.signature.date || contract.start_date)}</td>
                        <td className="right">{money(financials.downPayment)}</td>
                      </tr>
                    )}
                    {(details?.financials.installments || []).map((installment) => (
                      <tr key={installment.id}>
                        <td>{installment.label}</td>
                        <td>{formatDateBR(installment.dueDate)}</td>
                        <td className="right">{money(installment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {contract.payment_terms && (
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{contract.payment_terms}</p>
              )}
            </section>

            {/* Cláusulas */}
            <section className="doc-clauses">
              <h2>Cláusulas Contratuais</h2>
              {sections.map((section) => (
                <div key={section.id} className="doc-clause">
                  <h3>{section.title}</h3>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{section.content}</p>
                </div>
              ))}
            </section>

            {details?.notes && (
              <section>
                <h2>Observações</h2>
                <p style={{ whiteSpace: 'pre-wrap' }}>{details.notes}</p>
              </section>
            )}

            {/* Assinaturas */}
            <section className="doc-signatures">
              <p>
                {details?.signature.place || '—'},{' '}
                {formatDateBR(details?.signature.date || contract.signed_at || undefined)}
              </p>
              <div className="doc-sign-grid">
                <div className="doc-sign-slot">
                  <div className="doc-sign-line" />
                  <p>{contract.client_name}</p>
                  <p className="muted">Contratante — {contract.client_document || 'CPF/CNPJ'}</p>
                </div>
                <div className="doc-sign-slot">
                  <div className="doc-sign-line" />
                  <p>{details?.parties.companyName}</p>
                  <p className="muted">
                    Contratada — {details?.parties.companyRepresentative || 'Responsável'}
                  </p>
                </div>
              </div>
              {details?.signature.requireWitnesses && (
                <div className="doc-sign-grid">
                  {(details.witnesses || []).slice(0, 2).map((witness, index) => (
                    <div key={index} className="doc-sign-slot">
                      <div className="doc-sign-line" />
                      <p>{witness.name || `Testemunha ${index + 1}`}</p>
                      <p className="muted">CPF: {witness.document || '—'}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border/60 gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
          <Button variant="secondary" onClick={handlePrint} disabled={printing}>
            {printing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-1" />
            )}
            Imprimir
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
