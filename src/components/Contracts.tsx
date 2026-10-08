import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Copy,
  DollarSign,
  Download,
  Eye,
  FileText,
  History,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';
import { ContractWizard, ContractDraft } from '@/components/contracts/ContractWizard';
import { ContractPreviewDialog } from '@/components/contracts/ContractPreviewDialog';
import { downloadContractPdf } from '@/lib/contractPdf';
import {
  CONTRACT_TEMPLATE_NAME,
  CONTRACT_TEMPLATE_VERSION,
  ContractHistoryEntry,
  ContractRecord,
  ContractStatus,
  STATUS_COLORS,
  STATUS_LABELS,
  allowedTransitions,
  buildDuplicate,
  buildWhatsAppLink,
  cloneDefaultSections,
  emptyDetails,
  hydrateContract,
  isContentLocked,
  nextContractNumber,
  normalizeStatus,
  validateContract,
} from '@/lib/contracts';

interface ContractPayment {
  id: string;
  contract_id: string;
  payment_date: string;
  payment_amount: number;
  payment_method: string | null;
  payment_status: 'pending' | 'paid' | 'overdue';
  notes: string | null;
}

const AUTOSAVE_KEY = 'linetape:contract-draft';

function emptyDraft(): ContractDraft {
  return {
    contract_number: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_document: '',
    service_description: '',
    start_date: '',
    end_date: '',
    total_value: 0,
    payment_terms: '',
    status: 'rascunho',
    locked: false,
    sections_snapshot: cloneDefaultSections(),
    details: emptyDetails(),
  };
}

export const Contracts = () => {
  const { userRole } = useCustomAuth();
  const { formatValue, canViewValues } = useValueVisibility();
  const { settings } = useCompanySettings();
  const { logoUrl } = useLogo();

  const [contracts, setContracts] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ContractDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [previewContract, setPreviewContract] = useState<ContractRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ContractHistoryEntry[]>([]);

  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);
  const [payments, setPayments] = useState<ContractPayment[]>([]);
  const [paymentData, setPaymentData] = useState({
    payment_date: '',
    payment_amount: 0,
    payment_method: '',
    payment_status: 'pending' as ContractPayment['payment_status'],
    notes: '',
  });

  const [pendingTransition, setPendingTransition] = useState<{
    contract: ContractRecord;
    to: ContractStatus;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractRecord | null>(null);

  const canManage = userRole === 'admin' || userRole === 'financeiro';

  /* --------------------------- carregamento --------------------------- */
  const loadContracts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao carregar contratos:', error);
      toast.error('Erro ao carregar contratos');
    } else {
      setContracts((data || []).map(hydrateContract));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const loadPayments = async (contractId: string) => {
    const { data, error } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('payment_date', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar pagamentos');
      return;
    }
    setPayments((data || []) as ContractPayment[]);
  };

  const loadHistory = async (contractId: string) => {
    const { data, error } = await supabase
      .from('contract_history')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Erro ao carregar histórico');
      return;
    }
    setHistory((data || []) as ContractHistoryEntry[]);
  };

  /* ------------------------------ editor ------------------------------ */
  const openNewContract = () => {
    const base = emptyDraft();
    base.contract_number = nextContractNumber(contracts.map((c) => c.contract_number));
    base.details.parties.companyName = settings?.company_name || 'LINE TAPE';
    base.details.parties.companyDocument = settings?.cnpj || '';
    base.details.parties.companyAddress = settings?.address || '';
    base.details.parties.companyPhone = settings?.phone || '';
    base.details.parties.companyEmail = settings?.email || '';
    base.details.signature.place = 'Goiânia/GO';

    // Recuperação de rascunho local não salvo.
    try {
      const stored = localStorage.getItem(AUTOSAVE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ContractDraft;
        if (parsed?.client_name || parsed?.service_description) {
          setDraft({ ...base, ...parsed, status: 'rascunho', locked: false });
          setEditingId(null);
          setEditorOpen(true);
          toast.info('Rascunho local recuperado.');
          return;
        }
      }
    } catch {
      /* ignora rascunho corrompido */
    }

    setDraft(base);
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = (contract: ContractRecord) => {
    setDraft({
      contract_number: contract.contract_number,
      client_name: contract.client_name || '',
      client_email: contract.client_email || '',
      client_phone: contract.client_phone || '',
      client_document: contract.client_document || '',
      service_description: contract.service_description || '',
      start_date: (contract.start_date || '').split('T')[0],
      end_date: (contract.end_date || '').split('T')[0],
      total_value: contract.total_value || 0,
      payment_terms: contract.payment_terms || '',
      status: contract.status,
      locked: contract.locked,
      sections_snapshot: contract.sections_snapshot || cloneDefaultSections(),
      details: contract.details || emptyDetails(),
      client_id: contract.client_id,
      event_id: contract.event_id,
      quote_id: contract.quote_id,
    });
    setEditingId(contract.id);
    setEditorOpen(true);
  };

  const persistDraft = async (statusOverride?: ContractStatus) => {
    if (!canManage) {
      toast.error('Você não tem permissão para gerenciar contratos');
      return null;
    }
    if (saving) return null;
    setSaving(true);
    try {
      const payload = {
        contract_number:
          draft.contract_number || nextContractNumber(contracts.map((c) => c.contract_number)),
        client_name: draft.client_name,
        client_email: draft.client_email || null,
        client_phone: draft.client_phone || null,
        client_document: draft.client_document || null,
        service_description: draft.service_description,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        total_value: draft.total_value || 0,
        payment_terms: draft.payment_terms || null,
        status: statusOverride || draft.status || 'rascunho',
        template_name: CONTRACT_TEMPLATE_NAME,
        template_version: CONTRACT_TEMPLATE_VERSION,
        sections_snapshot: draft.sections_snapshot as any,
        details: draft.details as any,
        client_id: draft.client_id ?? null,
        event_id: draft.event_id ?? null,
        quote_id: draft.quote_id ?? null,
      };

      const query = editingId
        ? supabase.from('contracts').update(payload).eq('id', editingId).select('*').single()
        : supabase.from('contracts').insert(payload).select('*').single();

      const { data, error } = await query;
      if (error) throw error;

      localStorage.removeItem(AUTOSAVE_KEY);
      toast.success(editingId ? 'Contrato atualizado.' : 'Contrato salvo.');
      await loadContracts();
      return hydrateContract(data);
    } catch (error: any) {
      console.error('Erro ao salvar contrato:', error);
      toast.error(error?.message || 'Erro ao salvar contrato');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const saved = await persistDraft();
    if (saved) {
      setEditingId(saved.id);
      setDraft((current) => ({ ...current, contract_number: saved.contract_number }));
    }
  };

  const handleFinalize = async () => {
    const issues = validateContract(draft);
    if (issues.length > 0) {
      toast.error('Resolva as pendências antes de finalizar.');
      return;
    }
    const saved = await persistDraft('enviado');
    if (saved) {
      setEditorOpen(false);
      setPreviewContract(saved);
      setPreviewOpen(true);
    }
  };

  /* ------------------------------ ações ------------------------------ */
  const handleView = (contract: ContractRecord) => {
    setPreviewContract(contract);
    setPreviewOpen(true);
  };

  const handleDownload = async (contract: ContractRecord) => {
    try {
      await downloadContractPdf(contract, { logoUrl, canViewValues });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar o PDF do contrato');
    }
  };

  const handleDuplicate = async (contract: ContractRecord) => {
    if (!canManage) return;
    const number = nextContractNumber(contracts.map((c) => c.contract_number));
    const payload = buildDuplicate(contract, number);
    const { error } = await supabase.from('contracts').insert(payload as any);
    if (error) {
      toast.error('Erro ao duplicar contrato');
      return;
    }
    toast.success(`Duplicado como rascunho ${number}.`);
    loadContracts();
  };

  const handleWhatsApp = (contract: ContractRecord) => {
    const message =
      `Olá, ${contract.client_name}! Segue o contrato ${contract.contract_number} ` +
      `referente ao evento de ${(contract.details?.event.date || contract.start_date || '')
        .split('T')[0]
        .split('-')
        .reverse()
        .join('/')}. Qualquer dúvida, estamos à disposição.`;
    window.open(buildWhatsAppLink(contract.client_phone, message), '_blank', 'noopener');
  };

  const applyTransition = async () => {
    if (!pendingTransition) return;
    const { contract, to } = pendingTransition;
    const patch: Record<string, any> = { status: to };
    if (to === 'enviado') patch.sent_at = new Date().toISOString();
    if (to === 'cancelado') patch.cancelled_at = new Date().toISOString();

    const { error } = await supabase.from('contracts').update(patch).eq('id', contract.id);
    setPendingTransition(null);
    if (error) {
      toast.error(error.message || 'Erro ao alterar status');
      return;
    }
    toast.success(`Status alterado para ${STATUS_LABELS[to]}.`);
    loadContracts();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('contracts').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    if (error) {
      toast.error('Erro ao excluir contrato');
      return;
    }
    toast.success('Contrato excluído.');
    loadContracts();
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || !selectedContract) return;
    const { error } = await supabase.from('contract_payments').insert({
      ...paymentData,
      contract_id: selectedContract.id,
    });
    if (error) {
      toast.error('Erro ao adicionar pagamento');
      return;
    }
    toast.success('Pagamento adicionado.');
    setPaymentData({
      payment_date: '',
      payment_amount: 0,
      payment_method: '',
      payment_status: 'pending',
      notes: '',
    });
    loadPayments(selectedContract.id);
  };

  /* ------------------------------ lista ------------------------------ */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contracts.filter((contract) => {
      const matchesStatus =
        statusFilter === 'all' || normalizeStatus(contract.status) === statusFilter;
      const matchesTerm =
        !term ||
        [contract.contract_number, contract.client_name, contract.service_description]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesStatus && matchesTerm;
    });
  }, [contracts, search, statusFilter]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-muted-foreground">
            Editor em seções, versionamento de modelo, histórico e emissão em PDF A4.
          </p>
        </div>
        {canManage && (
          <Button onClick={openNewContract} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Contrato
          </Button>
        )}
      </header>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Lista de Contratos</CardTitle>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Buscar contratos"
                placeholder="Buscar por número, cliente ou objeto…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
              <SelectTrigger className="md:w-56" aria-label="Filtrar por status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABELS) as ContractStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando contratos…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Nenhum contrato encontrado.</p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="grid gap-3 md:hidden">
                {filtered.map((contract) => {
                  const status = normalizeStatus(contract.status);
                  return (
                    <div key={contract.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{contract.contract_number}</p>
                          <p className="text-sm text-muted-foreground">{contract.client_name}</p>
                        </div>
                        <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                      </div>
                      {canViewValues && (
                        <p className="text-sm font-medium">{formatValue(contract.total_value)}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleView(contract)}>
                          <Eye className="h-4 w-4 mr-1" /> Ver
                        </Button>
                        {canManage && (
                          <Button size="sm" variant="outline" onClick={() => openEdit(contract)}>
                            <Pencil className="h-4 w-4 mr-1" />
                            {isContentLocked(contract) ? 'Abrir' : 'Editar'}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(contract)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Objeto</TableHead>
                      <TableHead>Período</TableHead>
                      {canViewValues && <TableHead>Valor</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((contract) => {
                      const status = normalizeStatus(contract.status);
                      const locked = isContentLocked(contract);
                      return (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">
                            {contract.contract_number}
                            {locked && (
                              <span className="block text-[11px] text-muted-foreground">travado</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{contract.client_name}</div>
                            {contract.client_email && (
                              <div className="text-xs text-muted-foreground">
                                {contract.client_email}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={contract.service_description}>
                              {contract.service_description}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{new Date(contract.start_date).toLocaleDateString('pt-BR')}</div>
                            <div className="text-muted-foreground">
                              até {new Date(contract.end_date).toLocaleDateString('pt-BR')}
                            </div>
                          </TableCell>
                          {canViewValues && (
                            <TableCell className="font-medium">
                              {formatValue(contract.total_value)}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Ver contrato ${contract.contract_number}`}
                                onClick={() => handleView(contract)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Ações do contrato ${contract.contract_number}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                  {canManage && (
                                    <DropdownMenuItem onClick={() => openEdit(contract)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      {locked ? 'Abrir (somente leitura)' : 'Editar rascunho'}
                                    </DropdownMenuItem>
                                  )}
                                  {canManage && (
                                    <DropdownMenuItem onClick={() => handleDuplicate(contract)}>
                                      <Copy className="h-4 w-4 mr-2" /> Duplicar como rascunho
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => handleDownload(contract)}>
                                    <Download className="h-4 w-4 mr-2" /> Baixar PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleWhatsApp(contract)}>
                                    <MessageCircle className="h-4 w-4 mr-2" /> Enviar via WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedContract(contract);
                                      loadHistory(contract.id);
                                      setHistoryOpen(true);
                                    }}
                                  >
                                    <History className="h-4 w-4 mr-2" /> Histórico
                                  </DropdownMenuItem>
                                  {canManage && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedContract(contract);
                                        loadPayments(contract.id);
                                        setPaymentsOpen(true);
                                      }}
                                    >
                                      <DollarSign className="h-4 w-4 mr-2" /> Pagamentos
                                    </DropdownMenuItem>
                                  )}
                                  {canManage && allowedTransitions(contract.status).length > 0 && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
                                      {allowedTransitions(contract.status).map((to) => (
                                        <DropdownMenuItem
                                          key={to}
                                          onClick={() => setPendingTransition({ contract, to })}
                                        >
                                          <FileText className="h-4 w-4 mr-2" /> {STATUS_LABELS[to]}
                                        </DropdownMenuItem>
                                      ))}
                                    </>
                                  )}
                                  {canManage && !locked && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setDeleteTarget(contract)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Editor em seções */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-5xl h-[92vh] flex flex-col min-h-0">
          <DialogHeader>
            <DialogTitle>
              {editingId ? `Contrato ${draft.contract_number}` : 'Novo Contrato'}
            </DialogTitle>
            <DialogDescription>
              Modelo {CONTRACT_TEMPLATE_NAME} — v{CONTRACT_TEMPLATE_VERSION}. O texto das cláusulas é
              gravado como snapshot no contrato emitido.
            </DialogDescription>
          </DialogHeader>
          <ContractWizard
            draft={draft}
            onChange={setDraft}
            onSaveDraft={handleSaveDraft}
            onFinalize={handleFinalize}
            saving={saving}
            autosaveKey={editingId ? undefined : AUTOSAVE_KEY}
            onPreview={() =>
              handleView(
                hydrateContract({
                  id: editingId || 'preview',
                  ...draft,
                  template_name: CONTRACT_TEMPLATE_NAME,
                  template_version: CONTRACT_TEMPLATE_VERSION,
                }),
              )
            }
          />
        </DialogContent>
      </Dialog>

      <ContractPreviewDialog
        contract={previewContract}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        canViewValues={canViewValues}
        logoUrl={logoUrl}
        onDownloadPdf={handleDownload}
      />

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {selectedContract?.contract_number}</DialogTitle>
            <DialogDescription>Alterações e mudanças de status registradas.</DialogDescription>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              Nenhum registro de histórico para este contrato.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
              {history.map((entry) => (
                <li key={entry.id} className="border border-border/60 rounded-md p-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{entry.action}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {entry.from_status ? `${entry.from_status} → ` : ''}
                    {entry.to_status || '—'} · {entry.actor_name || 'Sistema'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {/* Pagamentos */}
      <Dialog open={paymentsOpen} onOpenChange={setPaymentsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagamentos — {selectedContract?.contract_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="payment_date">Data*</Label>
                <Input
                  id="payment_date"
                  type="date"
                  required
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payment_amount">Valor</Label>
                <CurrencyInput
                  id="payment_amount"
                  value={paymentData.payment_amount}
                  onChange={(value) => setPaymentData({ ...paymentData, payment_amount: value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Método</Label>
                <Select
                  value={paymentData.payment_method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={paymentData.payment_status}
                  onValueChange={(value: any) =>
                    setPaymentData({ ...paymentData, payment_status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_notes">Observações</Label>
              <Textarea
                id="payment_notes"
                rows={2}
                value={paymentData.notes}
                onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Adicionar pagamento
            </Button>
          </form>

          {payments.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  {canViewValues && <TableHead>Valor</TableHead>}
                  <TableHead>Método</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      {new Date(payment.payment_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    {canViewValues && <TableCell>{formatValue(payment.payment_amount)}</TableCell>}
                    <TableCell>{payment.payment_method || '-'}</TableCell>
                    <TableCell>{payment.payment_status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de transição de status */}
      <AlertDialog
        open={!!pendingTransition}
        onOpenChange={(open) => !open && setPendingTransition(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Alterar status para {pendingTransition ? STATUS_LABELS[pendingTransition.to] : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingTransition?.to === 'assinado'
                ? 'Ao marcar como assinado, o conteúdo do contrato é travado permanentemente e não poderá mais ser editado.'
                : 'A mudança de status fica registrada no histórico do contrato.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyTransition}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato {deleteTarget?.contract_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Contratos assinados não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
