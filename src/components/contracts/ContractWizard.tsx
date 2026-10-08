import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { CurrencyInput } from '@/components/ui/currency-input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Lock,
  Package,
  Plus,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePhoneInput } from '@/lib/utils';
import {
  ContractDetails,
  ContractInstallment,
  ContractItem,
  ContractRecord,
  ContractSection,
  computeFinancials,
  emptyDetails,
  formatCurrency,
  groupIssuesBySection,
  isContentLocked,
  validateContract,
} from '@/lib/contracts';

export interface ContractDraft {
  contract_number: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_document: string;
  service_description: string;
  start_date: string;
  end_date: string;
  total_value: number;
  payment_terms: string;
  status: string;
  locked?: boolean | null;
  sections_snapshot: ContractSection[];
  details: ContractDetails;
  client_id?: string | null;
  event_id?: string | null;
  quote_id?: string | null;
}

const SECTION_STEPS = [
  'Partes',
  'Objeto',
  'Evento',
  'Equipamentos',
  'Valores',
  'Cláusulas',
  'Assinaturas',
] as const;

type SectionStep = (typeof SECTION_STEPS)[number];

interface ContractWizardProps {
  draft: ContractDraft;
  onChange: (draft: ContractDraft) => void;
  onSaveDraft: () => Promise<void> | void;
  onPreview: () => void;
  onFinalize: () => Promise<void> | void;
  saving?: boolean;
  autosaveKey?: string;
}

function uid() {
  return `it_${Math.random().toString(36).slice(2, 10)}`;
}

export function ContractWizard({
  draft,
  onChange,
  onSaveDraft,
  onPreview,
  onFinalize,
  saving = false,
  autosaveKey,
}: ContractWizardProps) {
  const [step, setStep] = useState<SectionStep>('Partes');
  const locked = isContentLocked({ status: draft.status, locked: draft.locked });
  const financials = useMemo(() => computeFinancials(draft.details), [draft.details]);
  const issues = useMemo(
    () => validateContract({ ...draft, details: draft.details }),
    [draft],
  );
  const issuesBySection = useMemo(() => groupIssuesBySection(issues), [issues]);
  const autosaveTimer = useRef<number | null>(null);

  // Autosave local do rascunho (recuperação após fechar acidentalmente).
  useEffect(() => {
    if (!autosaveKey || locked) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(autosaveKey, JSON.stringify(draft));
      } catch {
        /* quota cheia: autosave é best-effort */
      }
    }, 800);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [draft, autosaveKey, locked]);

  const set = (patch: Partial<ContractDraft>) => onChange({ ...draft, ...patch });
  const setDetails = (patch: Partial<ContractDetails>) =>
    onChange({ ...draft, details: { ...draft.details, ...patch } });

  // Mantém o valor total sincronizado com a composição financeira.
  useEffect(() => {
    if (locked) return;
    if (Math.abs((draft.total_value || 0) - financials.total) >= 0.01 && financials.total > 0) {
      onChange({ ...draft, total_value: financials.total });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financials.total]);

  /* ----------------------------- itens ----------------------------- */
  const updateItem = (id: string, patch: Partial<ContractItem>) => {
    const items = draft.details.items.map((item) => {
      if (item.id !== id) return item;
      const merged = { ...item, ...patch };
      merged.subtotal = (Number(merged.quantity) || 0) * (Number(merged.unitPrice) || 0);
      return merged;
    });
    setDetails({ items });
  };

  const addItem = () =>
    setDetails({
      items: [
        ...draft.details.items,
        { id: uid(), name: '', description: '', quantity: 1, unitPrice: 0, subtotal: 0 },
      ],
    });

  const removeItem = (id: string) =>
    setDetails({ items: draft.details.items.filter((i) => i.id !== id) });

  /* -------------------------- parcelamento -------------------------- */
  const addInstallment = () => {
    const installments: ContractInstallment[] = [
      ...draft.details.financials.installments,
      {
        id: uid(),
        label: `Parcela ${draft.details.financials.installments.length + 1}`,
        dueDate: '',
        amount: 0,
      },
    ];
    setDetails({ financials: { ...draft.details.financials, installments } });
  };

  const updateInstallment = (id: string, patch: Partial<ContractInstallment>) =>
    setDetails({
      financials: {
        ...draft.details.financials,
        installments: draft.details.financials.installments.map((i) =>
          i.id === id ? { ...i, ...patch } : i,
        ),
      },
    });

  const removeInstallment = (id: string) =>
    setDetails({
      financials: {
        ...draft.details.financials,
        installments: draft.details.financials.installments.filter((i) => i.id !== id),
      },
    });

  /* --------------------------- cláusulas --------------------------- */
  const updateSection = (id: string, patch: Partial<ContractSection>) =>
    set({
      sections_snapshot: draft.sections_snapshot.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });

  const moveSection = (id: string, direction: -1 | 1) => {
    const sorted = [...draft.sections_snapshot].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    set({ sections_snapshot: sorted.map((s, i) => ({ ...s, order: i + 1 })) });
  };

  const handleFinalize = async () => {
    if (issues.length > 0) {
      toast.error(`Existem ${issues.length} pendência(s) obrigatória(s) antes de finalizar.`);
      return;
    }
    await onFinalize();
  };

  const orderedSections = [...draft.sections_snapshot].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {locked && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Contrato assinado</AlertTitle>
          <AlertDescription>
            O conteúdo deste contrato está travado permanentemente. Apenas status, anexos e
            metadados autorizados podem ser alterados.
          </AlertDescription>
        </Alert>
      )}

      {/* Navegação por seções */}
      <nav aria-label="Seções do contrato" className="flex flex-wrap gap-2">
        {SECTION_STEPS.map((name) => {
          const count = issuesBySection[name]?.length || 0;
          const active = step === name;
          return (
            <Button
              key={name}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              aria-current={active ? 'step' : undefined}
              onClick={() => setStep(name)}
              className="gap-2"
            >
              {name}
              {count > 0 ? (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                  {count}
                </Badge>
              ) : (
                <Check className="h-3 w-3 opacity-60" />
              )}
            </Button>
          );
        })}
      </nav>

      <ScrollArea className="flex-1 min-h-0 pr-3">
        <div className="space-y-4">
          {/* ------------------------- PARTES ------------------------- */}
          {step === 'Partes' && (
            <div className="grid gap-6 md:grid-cols-2">
              <fieldset disabled={locked} className="space-y-3">
                <legend className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" /> Contratante
                </legend>
                <div className="space-y-1.5">
                  <Label htmlFor="client_name">Razão social / Nome*</Label>
                  <Input
                    id="client_name"
                    value={draft.client_name}
                    onChange={(e) => set({ client_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="client_document">CPF / CNPJ*</Label>
                  <Input
                    id="client_document"
                    value={draft.client_document}
                    onChange={(e) => set({ client_document: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="client_phone">Telefone*</Label>
                    <Input
                      id="client_phone"
                      value={draft.client_phone}
                      onChange={(e) => set({ client_phone: handlePhoneInput(e.target.value) })}
                      placeholder="(62) 99999-9999"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="client_email">E-mail</Label>
                    <Input
                      id="client_email"
                      type="email"
                      value={draft.client_email}
                      onChange={(e) => set({ client_email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientAddress">Endereço completo*</Label>
                  <Textarea
                    id="clientAddress"
                    rows={2}
                    value={draft.details.parties.clientAddress}
                    onChange={(e) =>
                      setDetails({
                        parties: { ...draft.details.parties, clientAddress: e.target.value },
                      })
                    }
                  />
                </div>
              </fieldset>

              <fieldset disabled={locked} className="space-y-3">
                <legend className="font-semibold mb-2">Contratada</legend>
                <div className="space-y-1.5">
                  <Label htmlFor="companyName">Razão social*</Label>
                  <Input
                    id="companyName"
                    value={draft.details.parties.companyName}
                    onChange={(e) =>
                      setDetails({ parties: { ...draft.details.parties, companyName: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyDocument">CNPJ*</Label>
                  <Input
                    id="companyDocument"
                    value={draft.details.parties.companyDocument}
                    onChange={(e) =>
                      setDetails({
                        parties: { ...draft.details.parties, companyDocument: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="companyAddress">Endereço</Label>
                  <Textarea
                    id="companyAddress"
                    rows={2}
                    value={draft.details.parties.companyAddress}
                    onChange={(e) =>
                      setDetails({
                        parties: { ...draft.details.parties, companyAddress: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="companyRepresentative">Responsável*</Label>
                    <Input
                      id="companyRepresentative"
                      value={draft.details.parties.companyRepresentative}
                      onChange={(e) =>
                        setDetails({
                          parties: {
                            ...draft.details.parties,
                            companyRepresentative: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="technicalResponsible">Responsável técnico</Label>
                    <Input
                      id="technicalResponsible"
                      value={draft.details.parties.technicalResponsible}
                      onChange={(e) =>
                        setDetails({
                          parties: {
                            ...draft.details.parties,
                            technicalResponsible: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* ------------------------- OBJETO ------------------------- */}
          {step === 'Objeto' && (
            <fieldset disabled={locked} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contract_number">Número do contrato</Label>
                  <Input
                    id="contract_number"
                    value={draft.contract_number}
                    onChange={(e) => set({ contract_number: e.target.value })}
                    placeholder="Gerado automaticamente"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  <Input value="Modelo padrão LINE TAPE — v1" readOnly disabled />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="service_description">Objeto / descrição dos serviços*</Label>
                <Textarea
                  id="service_description"
                  rows={5}
                  value={draft.service_description}
                  onChange={(e) => set({ service_description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={draft.details.notes}
                  onChange={(e) => setDetails({ notes: e.target.value })}
                />
              </div>
            </fieldset>
          )}

          {/* ------------------------- EVENTO ------------------------- */}
          {step === 'Evento' && (
            <fieldset disabled={locked} className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eventName">Nome do evento</Label>
                <Input
                  id="eventName"
                  value={draft.details.event.name}
                  onChange={(e) => setDetails({ event: { ...draft.details.event, name: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventDate">Data do evento*</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={draft.details.event.date}
                  onChange={(e) => setDetails({ event: { ...draft.details.event, date: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventStartTime">Horário de início*</Label>
                <Input
                  id="eventStartTime"
                  type="time"
                  value={draft.details.event.startTime}
                  onChange={(e) =>
                    setDetails({ event: { ...draft.details.event, startTime: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventEndTime">Horário de término</Label>
                <Input
                  id="eventEndTime"
                  type="time"
                  value={draft.details.event.endTime}
                  onChange={(e) =>
                    setDetails({ event: { ...draft.details.event, endTime: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setupDate">Data de montagem</Label>
                <Input
                  id="setupDate"
                  type="date"
                  value={draft.details.event.setupDate}
                  onChange={(e) =>
                    setDetails({ event: { ...draft.details.event, setupDate: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventCity">Cidade / UF</Label>
                <Input
                  id="eventCity"
                  value={draft.details.event.city}
                  onChange={(e) => setDetails({ event: { ...draft.details.event, city: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="eventLocation">Local do evento*</Label>
                <Input
                  id="eventLocation"
                  value={draft.details.event.location}
                  onChange={(e) =>
                    setDetails({ event: { ...draft.details.event, location: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Vigência — início*</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => set({ start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">Vigência — término*</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => set({ end_date: e.target.value })}
                />
              </div>
            </fieldset>
          )}

          {/* ---------------------- EQUIPAMENTOS ---------------------- */}
          {step === 'Equipamentos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" /> Equipamentos e serviços
                </h3>
                {!locked && (
                  <Button type="button" size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>
                )}
              </div>

              {draft.details.items.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum item adicionado. Contratos gerados a partir de um orçamento já vêm com os
                  itens preenchidos.
                </p>
              )}

              <div className="space-y-3">
                {draft.details.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-2 md:grid-cols-[64px_1fr_70px_130px_120px_40px] items-start border border-border/60 rounded-md p-3"
                  >
                    <div className="w-16 h-16 rounded border border-border/60 bg-muted/40 overflow-hidden flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name || 'Equipamento'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        aria-label="Nome do item"
                        value={item.name}
                        disabled={locked}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        placeholder="Nome do equipamento/serviço"
                      />
                      <Input
                        aria-label="Descrição do item"
                        value={item.description || ''}
                        disabled={locked}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        placeholder="Descrição (opcional)"
                      />
                    </div>
                    <Input
                      aria-label="Quantidade"
                      type="number"
                      min={1}
                      disabled={locked}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) })}
                    />
                    <CurrencyInput
                      aria-label="Valor unitário"
                      value={item.unitPrice}
                      disabled={locked}
                      onChange={(value) => updateItem(item.id, { unitPrice: value })}
                    />
                    <div className="text-sm font-medium py-2 text-right">
                      {formatCurrency(item.subtotal)}
                    </div>
                    {!locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${item.name || 'item'}`}
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ------------------------- VALORES ------------------------- */}
          {step === 'Valores' && (
            <fieldset disabled={locked} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subtotal dos itens</Label>
                  <Input value={formatCurrency(financials.itemsSubtotal)} readOnly disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Desconto</Label>
                  <CurrencyInput
                    id="discount"
                    value={draft.details.financials.discount}
                    onChange={(value) =>
                      setDetails({ financials: { ...draft.details.financials, discount: value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="travel">Deslocamento / viagem</Label>
                  <CurrencyInput
                    id="travel"
                    value={draft.details.financials.travel}
                    onChange={(value) =>
                      setDetails({ financials: { ...draft.details.financials, travel: value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lodging">Hospedagem</Label>
                  <CurrencyInput
                    id="lodging"
                    value={draft.details.financials.lodging}
                    onChange={(value) =>
                      setDetails({ financials: { ...draft.details.financials, lodging: value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taxes">Impostos (quando aplicável)</Label>
                  <CurrencyInput
                    id="taxes"
                    value={draft.details.financials.taxes}
                    onChange={(value) =>
                      setDetails({ financials: { ...draft.details.financials, taxes: value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="downPayment">Sinal</Label>
                  <CurrencyInput
                    id="downPayment"
                    value={draft.details.financials.downPayment}
                    onChange={(value) =>
                      setDetails({ financials: { ...draft.details.financials, downPayment: value } })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Parcelas</h3>
                <Button type="button" size="sm" variant="outline" onClick={addInstallment}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar parcela
                </Button>
              </div>

              <div className="space-y-2">
                {draft.details.financials.installments.map((installment, index) => (
                  <div key={installment.id} className="grid gap-2 md:grid-cols-[1fr_160px_150px_40px]">
                    <Input
                      aria-label={`Descrição da parcela ${index + 1}`}
                      value={installment.label}
                      onChange={(e) => updateInstallment(installment.id, { label: e.target.value })}
                    />
                    <Input
                      aria-label={`Vencimento da parcela ${index + 1}`}
                      type="date"
                      value={installment.dueDate}
                      onChange={(e) => updateInstallment(installment.id, { dueDate: e.target.value })}
                    />
                    <CurrencyInput
                      aria-label={`Valor da parcela ${index + 1}`}
                      value={installment.amount}
                      onChange={(value) => updateInstallment(installment.id, { amount: value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover parcela ${index + 1}`}
                      onClick={() => removeInstallment(installment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="payment_terms">Forma de pagamento (texto do contrato)</Label>
                <Textarea
                  id="payment_terms"
                  rows={2}
                  value={draft.payment_terms}
                  onChange={(e) => set({ payment_terms: e.target.value })}
                  placeholder="Ex.: 50% de sinal na assinatura e 50% até 2 dias antes do evento."
                />
              </div>

              <div className="rounded-md border border-border/60 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total do contrato</span>
                  <span className="font-semibold">{formatCurrency(financials.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sinal + parcelas</span>
                  <span>{formatCurrency(financials.scheduledTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Saldo após sinal</span>
                  <span>{formatCurrency(financials.balance)}</span>
                </div>
              </div>

              {financials.hasScheduleMismatch && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Divergência no parcelamento</AlertTitle>
                  <AlertDescription>
                    Sinal + parcelas diferem do total do contrato em{' '}
                    {formatCurrency(Math.abs(financials.scheduleMismatch))}. Este aviso não impede
                    salvar nem finalizar.
                  </AlertDescription>
                </Alert>
              )}
            </fieldset>
          )}

          {/* ------------------------ CLÁUSULAS ------------------------ */}
          {step === 'Cláusulas' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Cláusulas do modelo padrão v1. Textos são gravados como snapshot no contrato — o
                conteúdo emitido não muda se o modelo for atualizado depois.
              </p>
              {orderedSections.map((section, index) => (
                <div key={section.id} className="border border-border/60 rounded-md p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id={`sec_${section.id}`}
                      checked={section.enabled}
                      disabled={locked || section.required}
                      onCheckedChange={(checked) =>
                        updateSection(section.id, { enabled: checked === true })
                      }
                      aria-label={`Incluir ${section.title}`}
                    />
                    <div className="flex-1">
                      <Input
                        aria-label="Título da cláusula"
                        value={section.title}
                        disabled={locked}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        className="font-medium"
                      />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={locked || index === 0}
                        aria-label="Mover cláusula para cima"
                        onClick={() => moveSection(section.id, -1)}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={locked || index === orderedSections.length - 1}
                        aria-label="Mover cláusula para baixo"
                        onClick={() => moveSection(section.id, 1)}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    aria-label={`Texto de ${section.title}`}
                    rows={4}
                    value={section.content}
                    disabled={locked || !section.enabled}
                    onChange={(e) => updateSection(section.id, { content: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ----------------------- ASSINATURAS ----------------------- */}
          {step === 'Assinaturas' && (
            <fieldset disabled={locked} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="signaturePlace">Local de assinatura / foro*</Label>
                  <Input
                    id="signaturePlace"
                    value={draft.details.signature.place}
                    onChange={(e) =>
                      setDetails({
                        signature: { ...draft.details.signature, place: e.target.value },
                      })
                    }
                    placeholder="Goiânia/GO"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signatureDate">Data de assinatura</Label>
                  <Input
                    id="signatureDate"
                    type="date"
                    value={draft.details.signature.date}
                    onChange={(e) =>
                      setDetails({ signature: { ...draft.details.signature, date: e.target.value } })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="requireWitnesses"
                  checked={draft.details.signature.requireWitnesses}
                  onCheckedChange={(checked) =>
                    setDetails({
                      signature: { ...draft.details.signature, requireWitnesses: checked },
                    })
                  }
                />
                <Label htmlFor="requireWitnesses">Exigir duas testemunhas</Label>
              </div>

              {draft.details.witnesses.map((witness, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`witness_name_${index}`}>Testemunha {index + 1} — nome</Label>
                    <Input
                      id={`witness_name_${index}`}
                      value={witness.name}
                      onChange={(e) => {
                        const witnesses = [...draft.details.witnesses];
                        witnesses[index] = { ...witness, name: e.target.value };
                        setDetails({ witnesses });
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`witness_doc_${index}`}>Testemunha {index + 1} — CPF</Label>
                    <Input
                      id={`witness_doc_${index}`}
                      value={witness.document}
                      onChange={(e) => {
                        const witnesses = [...draft.details.witnesses];
                        witnesses[index] = { ...witness, document: e.target.value };
                        setDetails({ witnesses });
                      }}
                    />
                  </div>
                </div>
              ))}

              <p className="text-xs text-muted-foreground">
                A assinatura é manual (impressa). Nenhuma assinatura eletrônica é gerada pelo
                sistema.
              </p>
            </fieldset>
          )}

          {/* Resumo de pendências */}
          {issues.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{issues.length} pendência(s) antes de finalizar</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
                  {issues.slice(0, 8).map((issue, i) => (
                    <li key={i}>
                      <strong>{issue.section}:</strong> {issue.message}
                    </li>
                  ))}
                  {issues.length > 8 && <li>… e mais {issues.length - 8}.</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <Button type="button" variant="outline" onClick={onPreview}>
          Pré-visualizar
        </Button>
        {!locked && (
          <>
            <Button type="button" variant="secondary" onClick={() => onSaveDraft()} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Salvando…' : 'Salvar rascunho'}
            </Button>
            <Button type="button" onClick={handleFinalize} disabled={saving || issues.length > 0}>
              Finalizar para assinatura
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
