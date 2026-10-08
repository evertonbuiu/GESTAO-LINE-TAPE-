import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CurrencyInput } from '@/components/ui/currency-input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { getSignedStorageUrl } from '@/lib/storageUrls';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileText,
  Plus,
  RefreshCw,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  BR_STATES,
  FISCAL_BUCKET,
  FISCAL_MODEL_LABELS,
  FISCAL_MODELS,
  FISCAL_PURPOSE_LABELS,
  FISCAL_STATUS_LABELS,
  HOMOLOGATION_WATERMARK,
  buildTripChecklist,
  calculateFiscalTotals,
  canGeneratePrint,
  canTransitionFiscalStatus,
  checklistReady,
  emptyFiscalDocumentForm,
  evaluateFiscalReadiness,
  fiscalFormToRecord,
  fiscalStatusVariant,
  formatCentsBRL,
  nextFiscalStatuses,
  recommendedModel,
  requiresMdfe,
  validateFiscalDocumentForm,
  type FiscalDocumentForm,
  type FiscalItemInput,
  type FiscalModel,
  type FiscalProfileLike,
  type FiscalPurpose,
  type PartyForm,
} from '@/lib/fiscal';

interface TransportOption {
  id: string;
  destination: string;
  destination_state?: string | null;
  origin_state?: string | null;
  transport_date: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
}

interface FiscalDocumentRow {
  id: string;
  model: string;
  series: string;
  number: string | null;
  purpose: string;
  status: string;
  environment: string;
  issue_date: string;
  transport_id: string | null;
  access_key: string | null;
  protocol_number: string | null;
  authorized_at: string | null;
  xml_path: string | null;
  total_document_cents: number;
  recipient: Record<string, string> | null;
  operation_nature: string | null;
  source: string;
}

interface Props {
  transports: TransportOption[];
  onRefreshTransports?: () => void;
}

const emptyItem = (): FiscalItemInput => ({
  description: '',
  ncm: '',
  cfop: '',
  unit: 'UN',
  quantity: 1,
  unit_value_cents: 0,
  cst: '',
  csosn: '',
  icms_rate: 0,
  ipi_rate: 0,
});

const PartyFields = ({
  title,
  value,
  onChange,
  idPrefix,
}: {
  title: string;
  value: PartyForm;
  onChange: (patch: Partial<PartyForm>) => void;
  idPrefix: string;
}) => (
  <section className="space-y-3">
    <h4 className="text-sm font-semibold uppercase text-muted-foreground">{title}</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Nome / Razão social</Label>
        <Input id={`${idPrefix}-name`} value={value.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-doc`}>CNPJ / CPF</Label>
        <Input id={`${idPrefix}-doc`} value={value.document} onChange={(e) => onChange({ document: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-ie`}>Inscrição Estadual</Label>
        <Input id={`${idPrefix}-ie`} value={value.ie} onChange={(e) => onChange({ ie: e.target.value })} placeholder="ISENTO" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-address`}>Endereço</Label>
        <Input id={`${idPrefix}-address`} value={value.address} onChange={(e) => onChange({ address: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-city`}>Município</Label>
        <Input id={`${idPrefix}-city`} value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-state`}>UF</Label>
        <Select value={value.state} onValueChange={(uf) => onChange({ state: uf })}>
          <SelectTrigger id={`${idPrefix}-state`}>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            {BR_STATES.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-zip`}>CEP</Label>
        <Input id={`${idPrefix}-zip`} value={value.zip} onChange={(e) => onChange({ zip: e.target.value })} placeholder="00000000" />
      </div>
    </div>
  </section>
);

export const FiscalDocumentsPanel = ({ transports }: Props) => {
  const { toast } = useToast();
  const { canViewValues } = useValueVisibility();

  const [documents, setDocuments] = useState<FiscalDocumentRow[]>([]);
  const [profiles, setProfiles] = useState<FiscalProfileLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [preflight, setPreflight] = useState<{
    ready: boolean;
    missing_secrets: string[];
    message: string;
  } | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FiscalDocumentForm>(emptyFiscalDocumentForm());
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [importTarget, setImportTarget] = useState<FiscalDocumentRow | null>(null);
  const [importing, setImporting] = useState(false);

  const setField = <K extends keyof FiscalDocumentForm>(key: K, value: FiscalDocumentForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadData = useCallback(async () => {
    setLoading(true);
    const [docsRes, profilesRes] = await Promise.all([
      supabase.from('fiscal_documents').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('fiscal_profiles').select('*').order('created_at', { ascending: false }),
    ]);
    if (docsRes.error) {
      toast({ title: 'Erro ao carregar documentos fiscais', description: docsRes.error.message, variant: 'destructive' });
    }
    setDocuments((docsRes.data ?? []) as unknown as FiscalDocumentRow[]);
    setProfiles((profilesRes.data ?? []) as unknown as FiscalProfileLike[]);
    setLoading(false);
  }, [toast]);

  const runPreflight = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('fiscal-document', {
      body: { action: 'preflight' },
    });
    if (error) {
      setPreflight({
        ready: false,
        missing_secrets: [],
        message: 'Não foi possível contatar a função fiscal. Transmissão indisponível.',
      });
      return;
    }
    setPreflight({
      ready: Boolean(data?.ready),
      missing_secrets: (data?.missing_secrets ?? []) as string[],
      message: String(data?.message ?? ''),
    });
  }, []);

  useEffect(() => {
    loadData();
    runPreflight();
  }, [loadData, runPreflight]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === form.profile_id) ?? null,
    [profiles, form.profile_id]
  );

  const readiness = useMemo(
    () =>
      evaluateFiscalReadiness({
        providerConfigured: Boolean(preflight?.ready),
        certificateConfigured: Boolean(preflight?.ready),
        profile: selectedProfile,
        environment: form.environment,
      }),
    [preflight, selectedProfile, form.environment]
  );

  const totals = useMemo(
    () =>
      calculateFiscalTotals(form.items, {
        freightCents: form.freight_cents,
        insuranceCents: form.insurance_cents,
        discountCents: form.discount_cents,
      }),
    [form.items, form.freight_cents, form.insurance_cents, form.discount_cents]
  );

  const linkedTransport = useMemo(
    () => transports.find((t) => t.id === form.transport_id) ?? null,
    [transports, form.transport_id]
  );

  const checklistFor = useCallback(
    (transportId: string) => {
      const transport = transports.find((t) => t.id === transportId);
      const docs = documents.filter((d) => d.transport_id === transportId);
      const authorized = docs.filter((d) => d.status === 'autorizado');
      return buildTripChecklist({
        hasAuthorizedNfe: authorized.some((d) => d.model === '55'),
        needsMdfe: requiresMdfe({
          originState: transport?.origin_state,
          destinationState: transport?.destination_state,
          ownVehicle: true,
          hasFiscalDocuments: docs.length > 0,
        }),
        hasAuthorizedMdfe: authorized.some((d) => d.model === '58'),
        hasDriver: Boolean(transport?.driver_name),
        hasPlate: Boolean(transport?.vehicle_plate),
        isHomologation: docs.some((d) => d.environment !== 'producao'),
      });
    },
    [transports, documents]
  );

  const openWizard = () => {
    setForm(emptyFiscalDocumentForm());
    setErrors([]);
    setStep(1);
    setWizardOpen(true);
  };

  const updateItem = (index: number, patch: Partial<FiscalItemInput>) =>
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));

  const applyProfileDefaults = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    setForm((prev) => ({
      ...prev,
      profile_id: profileId,
      model: ((profile?.model as FiscalModel) ?? prev.model) as FiscalModel,
      environment: (profile?.environment as 'homologacao' | 'producao') ?? prev.environment,
      operation_nature: profile?.operation_nature ?? prev.operation_nature,
      emitter: {
        ...prev.emitter,
        name: (profile?.emitter as Record<string, string>)?.name ?? prev.emitter.name,
        document: (profile?.emitter as Record<string, string>)?.cnpj ?? prev.emitter.document,
        ie: (profile?.emitter as Record<string, string>)?.ie ?? prev.emitter.ie,
        address: (profile?.emitter as Record<string, string>)?.address ?? prev.emitter.address,
        city: (profile?.emitter as Record<string, string>)?.city ?? prev.emitter.city,
        state: (profile?.emitter as Record<string, string>)?.state ?? prev.emitter.state,
        zip: (profile?.emitter as Record<string, string>)?.zip ?? prev.emitter.zip,
      },
      items: prev.items.map((item) => ({
        ...item,
        cfop: item.cfop || (profile?.default_cfop ?? ''),
        ncm: item.ncm || (profile?.default_ncm ?? ''),
        unit: item.unit || (profile?.default_unit ?? 'UN'),
        cst: item.cst || (profile?.default_cst ?? ''),
        csosn: item.csosn || (profile?.default_csosn ?? ''),
        icms_rate: item.icms_rate || (profile?.icms_rate ?? 0),
      })),
    }));
  };

  const handleSave = async () => {
    const validationErrors = validateFiscalDocumentForm(form);
    setErrors(validationErrors);
    if (validationErrors.length) {
      toast({ title: 'Corrija os campos obrigatórios', description: `${validationErrors.length} pendência(s).`, variant: 'destructive' });
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const record = fiscalFormToRecord(form);

    const { data: inserted, error } = await supabase
      .from('fiscal_documents')
      .insert({ ...record, status: 'rascunho', created_by: userData?.user?.id ?? null } as never)
      .select('id')
      .single();

    if (error || !inserted) {
      setSaving(false);
      toast({ title: 'Erro ao salvar documento', description: error?.message ?? 'Falha desconhecida', variant: 'destructive' });
      return;
    }

    if (form.items.length) {
      const items = form.items.map((item, index) => ({
        document_id: (inserted as { id: string }).id,
        sequence: index + 1,
        description: item.description,
        ncm: item.ncm || null,
        cfop: item.cfop || null,
        unit: item.unit || 'UN',
        quantity: item.quantity,
        unit_value_cents: Math.round(item.unit_value_cents),
        total_cents: Math.round(item.quantity * item.unit_value_cents),
        cst: item.cst || null,
        csosn: item.csosn || null,
        icms_rate: item.icms_rate ?? null,
        ipi_rate: item.ipi_rate ?? null,
      }));
      const { error: itemsError } = await supabase.from('fiscal_document_items').insert(items as never);
      if (itemsError) {
        toast({ title: 'Documento salvo, itens com erro', description: itemsError.message, variant: 'destructive' });
      }
    }

    setSaving(false);
    setWizardOpen(false);
    toast({ title: 'Documento salvo como rascunho', description: 'Valide antes de transmitir.' });
    loadData();
  };

  const changeStatus = async (doc: FiscalDocumentRow, next: string) => {
    if (!canTransitionFiscalStatus(doc.status, next)) {
      toast({ title: 'Transição inválida', description: `${doc.status} → ${next}`, variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('fiscal_documents').update({ status: next } as never).eq('id', doc.id);
    if (error) {
      toast({ title: 'Não foi possível mudar a situação', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Situação atualizada', description: FISCAL_STATUS_LABELS[next as keyof typeof FISCAL_STATUS_LABELS] });
    loadData();
  };

  const transmit = async (doc: FiscalDocumentRow) => {
    const { data, error } = await supabase.functions.invoke('fiscal-document', {
      body: { action: 'transmit', document_id: doc.id },
    });
    const message =
      (data as { error?: string } | null)?.error ??
      error?.message ??
      'Transmissão indisponível nesta instalação.';
    toast({ title: 'Transmissão bloqueada', description: message, variant: 'destructive' });
    loadData();
  };

  const importXml = async (doc: FiscalDocumentRow, file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      toast({ title: 'Arquivo inválido', description: 'Envie um arquivo .xml autorizado.', variant: 'destructive' });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Limite de 3 MB.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    const xml = await file.text();
    const { data, error } = await supabase.functions.invoke('fiscal-document', {
      body: { action: 'import_xml', document_id: doc.id, xml },
    });
    setImporting(false);

    const failure = (data as { error?: string } | null)?.error ?? error?.message;
    if (failure) {
      toast({ title: 'Importação recusada', description: failure, variant: 'destructive' });
      return;
    }
    toast({ title: 'XML autorizado importado', description: `Chave ${(data as { access_key?: string })?.access_key ?? ''}` });
    setImportTarget(null);
    loadData();
  };

  const openXml = async (doc: FiscalDocumentRow) => {
    if (!doc.xml_path) return;
    const url = await getSignedStorageUrl(doc.xml_path, FISCAL_BUCKET);
    if (!url) {
      toast({ title: 'Arquivo indisponível', description: 'Sem permissão ou arquivo removido.', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const printDocument = async (doc: FiscalDocumentRow) => {
    if (!canGeneratePrint(doc)) {
      toast({
        title: 'Impressão indisponível',
        description: 'DANFE/DAMDFE só pode ser gerado a partir de XML autorizado com chave e protocolo.',
        variant: 'destructive',
      });
      return;
    }
    const win = window.open('', '_blank');
    if (!win) return;
    const watermark = doc.environment !== 'producao' ? HOMOLOGATION_WATERMARK : '';
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>${doc.model === '58' ? 'DAMDFE' : 'DANFE'} ${doc.access_key}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}h1{font-size:18px}
      .wm{color:#b91c1c;border:2px dashed #b91c1c;padding:8px;text-align:center;font-weight:bold;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #999;padding:6px;font-size:12px;text-align:left}</style>
      </head><body>
      ${watermark ? `<div class="wm">${watermark}</div>` : ''}
      <h1>${doc.model === '58' ? 'DAMDFE — Manifesto' : 'DANFE — Documento Auxiliar'}</h1>
      <table>
        <tr><th>Modelo</th><td>${doc.model}</td><th>Série/Número</th><td>${doc.series}/${doc.number ?? '-'}</td></tr>
        <tr><th>Chave de acesso</th><td colspan="3">${doc.access_key}</td></tr>
        <tr><th>Protocolo</th><td>${doc.protocol_number}</td><th>Autorizado em</th><td>${doc.authorized_at ?? '-'}</td></tr>
        <tr><th>Natureza da operação</th><td colspan="3">${doc.operation_nature ?? '-'}</td></tr>
        <tr><th>Destinatário</th><td colspan="3">${doc.recipient?.name ?? '-'}</td></tr>
        ${canViewValues ? `<tr><th>Valor total</th><td colspan="3">${formatCentsBRL(doc.total_document_cents)}</td></tr>` : ''}
      </table>
      </body></html>`);
    win.document.close();
    win.print();
  };

  const suggestedModel = recommendedModel({ isCarrierService: form.purpose === 'prestacao_servico' });

  return (
    <div className="space-y-6">
      {/* Diagnóstico de prontidão */}
      <Alert variant={preflight?.ready ? 'default' : 'destructive'}>
        {preflight?.ready ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        <AlertTitle>
          {preflight?.ready ? 'Credenciais fiscais presentes' : 'Modo de preparação — transmissão bloqueada'}
        </AlertTitle>
        <AlertDescription className="space-y-1">
          <p>{preflight?.message ?? 'Verificando configuração fiscal...'}</p>
          {preflight?.missing_secrets?.length ? (
            <p className="text-xs">Faltam: {preflight.missing_secrets.join(', ')}</p>
          ) : null}
          <p className="text-xs">
            Nenhum documento é marcado como autorizado sem protocolo real da SEFAZ. É possível preparar
            documentos, homologar e importar XML autorizado de emissor externo.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Documentos Fiscais
            </CardTitle>
            <CardDescription>
              NF-e 55 (remessa/retorno), MDF-e 58 quando aplicável e CT-e 57 somente em prestação de serviço
              de transporte.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { loadData(); runPreflight(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button size="sm" onClick={openWizard} disabled={profiles.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> Novo documento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nenhum perfil fiscal cadastrado</AlertTitle>
              <AlertDescription>
                O sistema não presume CFOP, CST/CSOSN, NCM ou ICMS. Cadastre um perfil fiscal e obtenha a
                confirmação do contador/administrador antes da primeira transmissão.
              </AlertDescription>
            </Alert>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Finalidade</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Chave</TableHead>
                {canViewValues && <TableHead>Total</TableHead>}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={8}>Carregando...</TableCell>
                </TableRow>
              )}
              {!loading && documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Nenhum documento fiscal registrado.
                  </TableCell>
                </TableRow>
              )}
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {doc.model}
                    {doc.environment !== 'producao' && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        homologação
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{FISCAL_PURPOSE_LABELS[doc.purpose as FiscalPurpose] ?? doc.purpose}</TableCell>
                  <TableCell>{doc.issue_date}</TableCell>
                  <TableCell>{doc.recipient?.name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={fiscalStatusVariant(doc.status)}>
                      {FISCAL_STATUS_LABELS[doc.status as keyof typeof FISCAL_STATUS_LABELS] ?? doc.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{doc.access_key ?? '—'}</TableCell>
                  {canViewValues && <TableCell>{formatCentsBRL(doc.total_document_cents)}</TableCell>}
                  <TableCell className="text-right space-x-1">
                    {nextFiscalStatuses(doc.status)
                      .filter((s) => s !== 'autorizado')
                      .map((next) => (
                        <Button key={next} size="sm" variant="outline" onClick={() => changeStatus(doc, next)}>
                          {FISCAL_STATUS_LABELS[next]}
                        </Button>
                      ))}
                    {doc.status === 'enviado' && (
                      <Button size="sm" variant="secondary" onClick={() => transmit(doc)}>
                        Consultar SEFAZ
                      </Button>
                    )}
                    {doc.status !== 'autorizado' && (
                      <Button size="sm" variant="outline" onClick={() => setImportTarget(doc)}>
                        <Upload className="h-3 w-3 mr-1" /> Importar XML
                      </Button>
                    )}
                    {doc.xml_path && (
                      <Button size="sm" variant="ghost" onClick={() => openXml(doc)}>
                        XML
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => printDocument(doc)}
                      disabled={!canGeneratePrint(doc)}
                    >
                      <FileCheck2 className="h-3 w-3 mr-1" />
                      {doc.model === '58' ? 'DAMDFE' : 'DANFE'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Checklist pré-viagem */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Checklist pré-viagem</CardTitle>
          <CardDescription>Documentos exigidos por viagem antes da saída.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {transports.slice(0, 5).map((transport) => {
            const items = checklistFor(transport.id);
            const ready = checklistReady(items);
            return (
              <div key={transport.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {transport.destination} — {transport.transport_date}
                  </span>
                  <Badge variant={ready ? 'default' : 'destructive'}>{ready ? 'Pronta' : 'Pendente'}</Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {items.map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      {item.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <AlertTriangle className={`h-4 w-4 ${item.blocking ? 'text-destructive' : 'text-muted-foreground'}`} />
                      )}
                      <span className={item.ok ? '' : 'text-muted-foreground'}>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {transports.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma viagem cadastrada.</p>
          )}
        </CardContent>
      </Card>

      {/* Assistente */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Novo documento fiscal — etapa {step} de 3</DialogTitle>
            <DialogDescription>
              O documento nasce como rascunho. Nenhum valor fiscal é presumido pelo sistema.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[62vh] pr-4">
            <div className="space-y-6">
              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Pendências</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 text-xs space-y-1">
                      {errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="profile">Perfil fiscal *</Label>
                      <Select value={form.profile_id} onValueChange={applyProfileDefaults}>
                        <SelectTrigger id="profile">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={p.id as string}>
                              {p.name} ({p.model})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="purpose">Finalidade</Label>
                      <Select
                        value={form.purpose}
                        onValueChange={(v) => setField('purpose', v as FiscalPurpose)}
                      >
                        <SelectTrigger id="purpose">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FISCAL_PURPOSE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="model">Modelo</Label>
                      <Select value={form.model} onValueChange={(v) => setField('model', v as FiscalModel)}>
                        <SelectTrigger id="model">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FISCAL_MODELS.map((m) => (
                            <SelectItem key={m} value={m}>
                              {FISCAL_MODEL_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.model !== suggestedModel && (
                        <p className="text-xs text-muted-foreground">
                          Sugerido para esta finalidade: modelo {suggestedModel}.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="nature">Natureza da operação *</Label>
                      <Input
                        id="nature"
                        value={form.operation_nature}
                        onChange={(e) => setField('operation_nature', e.target.value)}
                        placeholder="Ex.: Remessa para locação"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="series">Série</Label>
                      <Input id="series" value={form.series} onChange={(e) => setField('series', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="issue">Data de emissão</Label>
                      <Input
                        id="issue"
                        type="date"
                        value={form.issue_date}
                        onChange={(e) => setField('issue_date', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="env">Ambiente</Label>
                      <Select
                        value={form.environment}
                        onValueChange={(v) => setField('environment', v as 'homologacao' | 'producao')}
                      >
                        <SelectTrigger id="env">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="homologacao">Homologação (sem valor fiscal)</SelectItem>
                          <SelectItem value="producao">Produção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="transport">Viagem vinculada</Label>
                      <Select
                        value={form.transport_id || 'none'}
                        onValueChange={(v) => setField('transport_id', v === 'none' ? '' : v)}
                      >
                        <SelectTrigger id="transport">
                          <SelectValue placeholder="Sem vínculo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem vínculo</SelectItem>
                          {transports.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.destination} — {t.transport_date}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {linkedTransport && documents.some((d) => d.transport_id === linkedTransport.id && d.model === form.model && d.status !== 'cancelado') && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Já existe documento deste modelo para a viagem</AlertTitle>
                      <AlertDescription>Confirme para não emitir em duplicidade.</AlertDescription>
                    </Alert>
                  )}

                  <PartyFields
                    title="Emitente"
                    idPrefix="emitter"
                    value={form.emitter}
                    onChange={(patch) => setField('emitter', { ...form.emitter, ...patch })}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <PartyFields
                    title="Destinatário"
                    idPrefix="recipient"
                    value={form.recipient}
                    onChange={(patch) => setField('recipient', { ...form.recipient, ...patch })}
                  />

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="same-delivery"
                      checked={form.same_delivery}
                      onCheckedChange={(v) => setField('same_delivery', Boolean(v))}
                    />
                    <Label htmlFor="same-delivery">Entrega no endereço do destinatário</Label>
                  </div>

                  {!form.same_delivery && (
                    <PartyFields
                      title="Local de entrega"
                      idPrefix="delivery"
                      value={form.delivery}
                      onChange={(patch) => setField('delivery', { ...form.delivery, ...patch })}
                    />
                  )}

                  <section className="space-y-3">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground">
                      Veículo, condutor e percurso
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="plate">Placa</Label>
                        <Input
                          id="plate"
                          value={form.vehicle.plate}
                          onChange={(e) => setField('vehicle', { ...form.vehicle, plate: e.target.value.toUpperCase() })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vmodel">Modelo do veículo</Label>
                        <Input
                          id="vmodel"
                          value={form.vehicle.model}
                          onChange={(e) => setField('vehicle', { ...form.vehicle, model: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="vstate">UF de licenciamento</Label>
                        <Select
                          value={form.vehicle.state}
                          onValueChange={(uf) => setField('vehicle', { ...form.vehicle, state: uf })}
                        >
                          <SelectTrigger id="vstate">
                            <SelectValue placeholder="UF" />
                          </SelectTrigger>
                          <SelectContent>
                            {BR_STATES.map((uf) => (
                              <SelectItem key={uf} value={uf}>
                                {uf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="driver">Condutor</Label>
                        <Input
                          id="driver"
                          value={form.driver.name}
                          onChange={(e) => setField('driver', { ...form.driver, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="driver-doc">CPF do condutor</Label>
                        <Input
                          id="driver-doc"
                          value={form.driver.document}
                          onChange={(e) => setField('driver', { ...form.driver, document: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="driver-phone">Telefone</Label>
                        <Input
                          id="driver-phone"
                          value={form.driver.phone}
                          onChange={(e) => setField('driver', { ...form.driver, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="route">Percurso (UFs separadas por vírgula)</Label>
                      <Input
                        id="route"
                        value={form.route_states.join(',')}
                        onChange={(e) =>
                          setField(
                            'route_states',
                            e.target.value
                              .toUpperCase()
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean)
                          )
                        }
                        placeholder="GO,MG,SP"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="refkeys">Documentos referenciados (chaves de 44 dígitos)</Label>
                      <Textarea
                        id="refkeys"
                        value={form.referenced_keys.join('\n')}
                        onChange={(e) =>
                          setField(
                            'referenced_keys',
                            e.target.value.split(/\s+/).map((s) => s.trim()).filter(Boolean)
                          )
                        }
                        placeholder="Uma chave por linha"
                      />
                    </div>
                  </section>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase text-muted-foreground">Itens</h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          items: [
                            ...prev.items,
                            {
                              ...emptyItem(),
                              cfop: selectedProfile?.default_cfop ?? '',
                              ncm: selectedProfile?.default_ncm ?? '',
                              unit: selectedProfile?.default_unit ?? 'UN',
                              cst: selectedProfile?.default_cst ?? '',
                              csosn: selectedProfile?.default_csosn ?? '',
                              icms_rate: selectedProfile?.icms_rate ?? 0,
                            },
                          ],
                        }))
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar item
                    </Button>
                  </div>

                  {form.items.map((item, index) => (
                    <div key={index} className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Item {index + 1}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))} title="Remover" aria-label="Remover">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                          <Label htmlFor={`item-${index}-desc`}>Descrição</Label>
                          <Input
                            id={`item-${index}-desc`}
                            value={item.description}
                            onChange={(e) => updateItem(index, { description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-ncm`}>NCM</Label>
                          <Input id={`item-${index}-ncm`} value={item.ncm ?? ''} onChange={(e) => updateItem(index, { ncm: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-cfop`}>CFOP</Label>
                          <Input id={`item-${index}-cfop`} value={item.cfop ?? ''} onChange={(e) => updateItem(index, { cfop: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-unit`}>Unidade</Label>
                          <Input id={`item-${index}-unit`} value={item.unit ?? ''} onChange={(e) => updateItem(index, { unit: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-qty`}>Quantidade</Label>
                          <Input
                            id={`item-${index}-qty`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-value`}>Valor unitário</Label>
                          <CurrencyInput
                            id={`item-${index}-value`}
                            value={item.unit_value_cents / 100}
                            onChange={(v) => updateItem(index, { unit_value_cents: Math.round((v ?? 0) * 100) })}
                            placeholder="R$ 0,00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-cst`}>CST</Label>
                          <Input id={`item-${index}-cst`} value={item.cst ?? ''} onChange={(e) => updateItem(index, { cst: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-csosn`}>CSOSN</Label>
                          <Input id={`item-${index}-csosn`} value={item.csosn ?? ''} onChange={(e) => updateItem(index, { csosn: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`item-${index}-icms`}>ICMS (%)</Label>
                          <Input
                            id={`item-${index}-icms`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.icms_rate ?? 0}
                            onChange={(e) => updateItem(index, { icms_rate: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="freight">Frete</Label>
                      <CurrencyInput
                        id="freight"
                        value={form.freight_cents / 100}
                        onChange={(v) => setField('freight_cents', Math.round((v ?? 0) * 100))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="insurance">Seguro</Label>
                      <CurrencyInput
                        id="insurance"
                        value={form.insurance_cents / 100}
                        onChange={(v) => setField('insurance_cents', Math.round((v ?? 0) * 100))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="discount">Desconto</Label>
                      <CurrencyInput
                        id="discount"
                        value={form.discount_cents / 100}
                        onChange={(v) => setField('discount_cents', Math.round((v ?? 0) * 100))}
                      />
                    </div>
                  </div>

                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div>Produtos: {formatCentsBRL(totals.productsCents)}</div>
                    <div>ICMS estimado: {formatCentsBRL(totals.icmsCents)}</div>
                    <div>IPI estimado: {formatCentsBRL(totals.ipiCents)}</div>
                    <div className="font-semibold">Total do documento: {formatCentsBRL(totals.documentCents)}</div>
                  </div>

                  {!readiness.canTransmit && (
                    <Alert variant="destructive">
                      <ShieldAlert className="h-4 w-4" />
                      <AlertTitle>Transmissão bloqueada</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-4 text-xs">
                          {readiness.blockers.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            )}
            {step < 3 && <Button onClick={() => setStep((s) => s + 1)}>Continuar</Button>}
            {step === 3 && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar rascunho'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importação de XML autorizado */}
      <Dialog open={!!importTarget} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar XML autorizado</DialogTitle>
            <DialogDescription>
              O XML é analisado no servidor: exige protocolo real da SEFAZ, chave válida e ambiente coerente.
              Nada é marcado como autorizado sem essas provas.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="file"
            accept=".xml,text/xml,application/xml"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && importTarget) importXml(importTarget, file);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportTarget(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FiscalDocumentsPanel;
