import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Lock, MessageCircle, Printer, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import {
  PERSON_STATUSES,
  PERSON_STATUS_LABELS,
  buildWhatsAppLink,
  canEditSensitiveData,
  canViewSensitiveData,
  findDuplicateCandidates,
  formatCPF,
  formatPhone,
  isValidCPF,
  maskCPF,
  maskSensitive,
  normalizePersonStatus,
  onlyDigits,
  type PersonStatus,
  type PersonType,
} from '@/lib/people';

interface PersonProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personType: PersonType;
  /** ID quando conhecido. Para diaristas legados pode vir só o nome. */
  personId?: string | null;
  personName?: string | null;
  onSaved?: () => void;
}

interface ProfileState {
  id: string;
  name: string;
  social_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  birth_date: string;
  primary_role: string;
  secondary_roles: string;
  skills: string;
  uniform_size: string;
  shoe_size: string;
  address_street: string;
  address_number: string;
  address_district: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  internal_notes: string;
  status: PersonStatus;
  status_reason: string;
  default_daily_rate: string;
}

interface SensitiveState {
  cpf: string;
  rg: string;
  pix_key: string;
  pix_key_type: string;
  bank_name: string;
  bank_agency: string;
  bank_account: string;
  account_holder_name: string;
}

const EMPTY_PROFILE: ProfileState = {
  id: '',
  name: '',
  social_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  birth_date: '',
  primary_role: '',
  secondary_roles: '',
  skills: '',
  uniform_size: '',
  shoe_size: '',
  address_street: '',
  address_number: '',
  address_district: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  internal_notes: '',
  status: 'ativo',
  status_reason: '',
  default_daily_rate: '',
};

const EMPTY_SENSITIVE: SensitiveState = {
  cpf: '',
  rg: '',
  pix_key: '',
  pix_key_type: '',
  bank_name: '',
  bank_agency: '',
  bank_account: '',
  account_holder_name: '',
};

const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value));
const list = (value: unknown): string => (Array.isArray(value) ? value.join(', ') : '');
const toArray = (value: string): string[] =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

interface StatusHistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  actor_name: string | null;
  created_at: string;
}

export const PersonProfileDialog = ({
  open,
  onOpenChange,
  personType,
  personId,
  personName,
  onSaved,
}: PersonProfileDialogProps) => {
  const { user, userRole } = useCustomAuth();
  const { toast } = useToast();

  const table = personType === 'worker' ? 'workers' : 'collaborators';
  const showSensitive = canViewSensitiveData(userRole);
  const mayEditSensitive = canEditSensitiveData(userRole);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [initialStatus, setInitialStatus] = useState<PersonStatus>('ativo');
  const [sensitive, setSensitive] = useState<SensitiveState>(EMPTY_SENSITIVE);
  const [sensitiveExists, setSensitiveExists] = useState(false);
  const [revealSensitive, setRevealSensitive] = useState(false);
  const [history, setHistory] = useState<StatusHistoryRow[]>([]);
  const [duplicates, setDuplicates] = useState<{ id: string; name: string; matchedBy: string[] }[]>([]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setRevealSensitive(false);
    setDuplicates([]);
    try {
      let query = supabase.from(table).select('*').limit(1);
      query = personId ? query.eq('id', personId) : query.eq('name', personName ?? '');
      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (!data) {
        setProfile({ ...EMPTY_PROFILE, name: personName ?? '' });
        setSensitive(EMPTY_SENSITIVE);
        setSensitiveExists(false);
        setHistory([]);
        return;
      }

      const record = data as Record<string, unknown>;
      const status = normalizePersonStatus(str(record.status));
      setInitialStatus(status);
      setProfile({
        id: str(record.id),
        name: str(record.name),
        social_name: str(record.social_name),
        email: str(record.email),
        phone: str(record.phone),
        whatsapp: str(record.whatsapp),
        birth_date: str(record.birth_date),
        primary_role: str(record.primary_role ?? record.role),
        secondary_roles: list(record.secondary_roles),
        skills: list(record.skills),
        uniform_size: str(record.uniform_size),
        shoe_size: str(record.shoe_size),
        address_street: str(record.address_street),
        address_number: str(record.address_number),
        address_district: str(record.address_district),
        address_city: str(record.address_city),
        address_state: str(record.address_state),
        address_zip: str(record.address_zip),
        emergency_contact_name: str(record.emergency_contact_name),
        emergency_contact_phone: str(record.emergency_contact_phone),
        internal_notes: str(record.internal_notes),
        status,
        status_reason: str(record.status_reason),
        default_daily_rate: str(record.default_daily_rate),
      });

      const id = str(record.id);

      if (showSensitive && id) {
        const { data: sens } = await supabase
          .from('person_sensitive_data')
          .select('*')
          .eq('person_type', personType)
          .eq('person_id', id)
          .maybeSingle();
        if (sens) {
          const s = sens as Record<string, unknown>;
          setSensitiveExists(true);
          setSensitive({
            cpf: str(s.cpf),
            rg: str(s.rg),
            pix_key: str(s.pix_key),
            pix_key_type: str(s.pix_key_type),
            bank_name: str(s.bank_name),
            bank_agency: str(s.bank_agency),
            bank_account: str(s.bank_account),
            account_holder_name: str(s.account_holder_name),
          });
        } else {
          setSensitiveExists(false);
          setSensitive({
            ...EMPTY_SENSITIVE,
            pix_key: str(record.pix_key),
            bank_account: str(record.bank_account),
          });
        }
      }

      if (id) {
        const { data: hist } = await supabase
          .from('person_status_history')
          .select('id, from_status, to_status, reason, actor_name, created_at')
          .eq('person_type', personType)
          .eq('person_id', id)
          .order('created_at', { ascending: false })
          .limit(30);
        setHistory((hist as StatusHistoryRow[]) ?? []);
      }
    } catch (error) {
      console.error('Erro ao carregar ficha:', error);
      toast({
        title: 'Erro ao carregar ficha',
        description: 'Não foi possível carregar os dados desta pessoa.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [table, personId, personName, personType, showSensitive, toast]);

  useEffect(() => {
    if (open) loadProfile();
  }, [open, loadProfile]);

  const checkDuplicates = useCallback(async () => {
    const { data } = await supabase.from(table).select('id, name, phone').limit(1000);
    const found = findDuplicateCandidates(
      { name: profile.name, phone: profile.phone || profile.whatsapp, cpf: sensitive.cpf },
      ((data as { id: string; name: string; phone: string | null }[]) ?? []),
      profile.id || undefined
    );
    setDuplicates(found.map((d) => ({ id: d.id, name: d.name, matchedBy: d.matchedBy })));
    return found;
  }, [table, profile.name, profile.phone, profile.whatsapp, profile.id, sensitive.cpf]);

  const cpfInvalid = sensitive.cpf.length > 0 && !isValidCPF(sensitive.cpf);

  const whatsappLink = useMemo(
    () => buildWhatsAppLink(profile.whatsapp || profile.phone),
    [profile.whatsapp, profile.phone]
  );

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!profile.name.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    if (cpfInvalid) {
      toast({ title: 'CPF inválido', description: 'Confira os dígitos informados.', variant: 'destructive' });
      return;
    }
    if (profile.status !== initialStatus && !profile.status_reason.trim()) {
      toast({
        title: 'Informe o motivo',
        description: 'Mudanças de status exigem um motivo para o histórico.',
        variant: 'destructive',
      });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await checkDuplicates();

      const payload: Record<string, unknown> = {
        name: profile.name.trim(),
        social_name: profile.social_name || null,
        email: profile.email || null,
        phone: profile.phone || null,
        whatsapp: profile.whatsapp || null,
        birth_date: profile.birth_date || null,
        secondary_roles: toArray(profile.secondary_roles),
        skills: toArray(profile.skills),
        uniform_size: profile.uniform_size || null,
        shoe_size: profile.shoe_size || null,
        address_street: profile.address_street || null,
        address_number: profile.address_number || null,
        address_district: profile.address_district || null,
        address_city: profile.address_city || null,
        address_state: profile.address_state || null,
        address_zip: profile.address_zip || null,
        emergency_contact_name: profile.emergency_contact_name || null,
        emergency_contact_phone: profile.emergency_contact_phone || null,
        internal_notes: profile.internal_notes || null,
        status: profile.status,
        status_reason: profile.status_reason || null,
        default_daily_rate: profile.default_daily_rate ? Number(profile.default_daily_rate) : null,
      };

      if (personType === 'worker') {
        payload.primary_role = profile.primary_role || null;
      } else {
        payload.role = profile.primary_role || null;
      }

      let targetId = profile.id;

      if (targetId) {
        const { error } = await supabase.from(table).update(payload).eq('id', targetId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from(table)
          .insert({ ...payload, created_by: user?.id ?? null })
          .select('id')
          .single();
        if (error) throw error;
        targetId = str((data as { id: string }).id);
        setProfile((prev) => ({ ...prev, id: targetId }));
      }

      if (profile.status !== initialStatus && targetId) {
        await supabase.from('person_status_history').insert({
          person_type: personType,
          person_id: targetId,
          person_name: profile.name.trim(),
          from_status: initialStatus,
          to_status: profile.status,
          reason: profile.status_reason || null,
          actor_id: user?.id ?? null,
        });
        setInitialStatus(profile.status);
      }

      if (mayEditSensitive && targetId) {
        const sensitivePayload = {
          person_type: personType,
          person_id: targetId,
          cpf: onlyDigits(sensitive.cpf) || null,
          rg: sensitive.rg || null,
          pix_key: sensitive.pix_key || null,
          pix_key_type: sensitive.pix_key_type || null,
          bank_name: sensitive.bank_name || null,
          bank_agency: sensitive.bank_agency || null,
          bank_account: sensitive.bank_account || null,
          account_holder_name: sensitive.account_holder_name || null,
        };

        if (sensitiveExists) {
          await supabase
            .from('person_sensitive_data')
            .update(sensitivePayload)
            .eq('person_type', personType)
            .eq('person_id', targetId);
        } else if (Object.values(sensitivePayload).some((v) => v && v !== personType && v !== targetId)) {
          await supabase
            .from('person_sensitive_data')
            .insert({ ...sensitivePayload, created_by: user?.id ?? null });
          setSensitiveExists(true);
        }
      }

      toast({ title: 'Ficha salva', description: `${profile.name} foi atualizado.` });
      onSaved?.();
      await loadProfile();
    } catch (error) {
      console.error('Erro ao salvar ficha:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /** Impressão operacional: nunca inclui CPF, RG, PIX ou dados bancários. */
  const handlePrint = () => {
    const rows: [string, string][] = [
      ['Nome', profile.name],
      ['Nome social', profile.social_name],
      ['Função', profile.primary_role],
      ['Funções secundárias', profile.secondary_roles],
      ['Habilidades', profile.skills],
      ['Telefone', formatPhone(profile.phone)],
      ['WhatsApp', formatPhone(profile.whatsapp)],
      ['Uniforme', profile.uniform_size],
      ['Calçado', profile.shoe_size],
      ['Cidade', [profile.address_city, profile.address_state].filter(Boolean).join(' / ')],
      ['Emergência', [profile.emergency_contact_name, formatPhone(profile.emergency_contact_phone)].filter(Boolean).join(' — ')],
      ['Status', PERSON_STATUS_LABELS[profile.status]],
    ].filter((row): row is [string, string] => Boolean(row[1]));

    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) return;
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Ficha operacional — ${profile.name}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p.sub { font-size: 11px; color: #666; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { text-align: left; width: 34%; padding: 6px 8px; background: #f4f4f5; border: 1px solid #e4e4e7; }
        td { padding: 6px 8px; border: 1px solid #e4e4e7; }
        footer { margin-top: 18px; font-size: 10px; color: #777; }
      </style></head><body>
      <h1>Ficha operacional</h1>
      <p class="sub">Documento sem dados bancários ou documentos pessoais.</p>
      <table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
      <footer>LINE TAPE — gerado em ${new Date().toLocaleString('pt-BR')}</footer>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const isWorker = personType === 'worker';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {profile.name || 'Nova ficha'}
            <Badge variant={profile.status === 'ativo' ? 'default' : 'secondary'}>
              {PERSON_STATUS_LABELS[profile.status]}
            </Badge>
            <Badge variant="outline">{isWorker ? 'Diarista' : 'Colaborador'}</Badge>
          </DialogTitle>
          <DialogDescription>
            Ficha cadastral, situação operacional e histórico. Dados bancários e documentos ficam
            restritos aos perfis autorizados.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <Tabs defaultValue="ficha">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="ficha">Ficha</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="sensivel">
                {showSensitive ? 'Documentos e banco' : 'Restrito'}
              </TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            {duplicates.length > 0 && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Possível cadastro duplicado</AlertTitle>
                <AlertDescription>
                  Encontramos {duplicates.length} cadastro(s) parecido(s):{' '}
                  {duplicates.map((d) => `${d.name} (${d.matchedBy.join(', ')})`).join('; ')}. Nada foi
                  mesclado — revise manualmente se necessário.
                </AlertDescription>
              </Alert>
            )}

            <TabsContent value="ficha" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-name">Nome completo *</Label>
                  <Input
                    id="pp-name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-social">Nome social / apelido</Label>
                  <Input
                    id="pp-social"
                    value={profile.social_name}
                    onChange={(e) => setProfile({ ...profile, social_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-birth">Nascimento</Label>
                  <Input
                    id="pp-birth"
                    type="date"
                    value={profile.birth_date}
                    onChange={(e) => setProfile({ ...profile, birth_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-role">Função principal</Label>
                  <Input
                    id="pp-role"
                    value={profile.primary_role}
                    onChange={(e) => setProfile({ ...profile, primary_role: e.target.value })}
                    placeholder="Iluminador, montador..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-secondary">Funções secundárias</Label>
                  <Input
                    id="pp-secondary"
                    value={profile.secondary_roles}
                    onChange={(e) => setProfile({ ...profile, secondary_roles: e.target.value })}
                    placeholder="separadas por vírgula"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-skills">Habilidades</Label>
                  <Input
                    id="pp-skills"
                    value={profile.skills}
                    onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                    placeholder="separadas por vírgula"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-uniform">Uniforme / EPI</Label>
                  <Input
                    id="pp-uniform"
                    value={profile.uniform_size}
                    onChange={(e) => setProfile({ ...profile, uniform_size: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-shoe">Calçado</Label>
                  <Input
                    id="pp-shoe"
                    value={profile.shoe_size}
                    onChange={(e) => setProfile({ ...profile, shoe_size: e.target.value })}
                  />
                </div>
                {isWorker && canViewSensitiveData(userRole) && (
                  <div className="space-y-2">
                    <Label htmlFor="pp-rate">Valor padrão da diária</Label>
                    <Input
                      id="pp-rate"
                      inputMode="decimal"
                      value={profile.default_daily_rate}
                      onChange={(e) => setProfile({ ...profile, default_daily_rate: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pp-status">Situação</Label>
                  <Select
                    value={profile.status}
                    onValueChange={(value: PersonStatus) => setProfile({ ...profile, status: value })}
                  >
                    <SelectTrigger id="pp-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSON_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {PERSON_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-reason">
                    Motivo {profile.status !== initialStatus && <span aria-hidden>*</span>}
                  </Label>
                  <Input
                    id="pp-reason"
                    value={profile.status_reason}
                    onChange={(e) => setProfile({ ...profile, status_reason: e.target.value })}
                    placeholder="Obrigatório ao mudar a situação"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pp-notes">Observações internas</Label>
                <Textarea
                  id="pp-notes"
                  value={profile.internal_notes}
                  onChange={(e) => setProfile({ ...profile, internal_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="contato" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pp-phone">Telefone</Label>
                  <Input
                    id="pp-phone"
                    value={formatPhone(profile.phone)}
                    onChange={(e) => setProfile({ ...profile, phone: onlyDigits(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-whats">WhatsApp</Label>
                  <Input
                    id="pp-whats"
                    value={formatPhone(profile.whatsapp)}
                    onChange={(e) => setProfile({ ...profile, whatsapp: onlyDigits(e.target.value) })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pp-email">E-mail</Label>
                  <Input
                    id="pp-email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pp-street">Endereço</Label>
                  <Input
                    id="pp-street"
                    value={profile.address_street}
                    onChange={(e) => setProfile({ ...profile, address_street: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-number">Número</Label>
                  <Input
                    id="pp-number"
                    value={profile.address_number}
                    onChange={(e) => setProfile({ ...profile, address_number: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-district">Bairro</Label>
                  <Input
                    id="pp-district"
                    value={profile.address_district}
                    onChange={(e) => setProfile({ ...profile, address_district: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-city">Cidade</Label>
                  <Input
                    id="pp-city"
                    value={profile.address_city}
                    onChange={(e) => setProfile({ ...profile, address_city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-state">UF</Label>
                  <Input
                    id="pp-state"
                    maxLength={2}
                    value={profile.address_state}
                    onChange={(e) => setProfile({ ...profile, address_state: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-zip">CEP</Label>
                  <Input
                    id="pp-zip"
                    value={profile.address_zip}
                    onChange={(e) => setProfile({ ...profile, address_zip: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-emg-name">Contato de emergência</Label>
                  <Input
                    id="pp-emg-name"
                    value={profile.emergency_contact_name}
                    onChange={(e) => setProfile({ ...profile, emergency_contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-emg-phone">Telefone de emergência</Label>
                  <Input
                    id="pp-emg-phone"
                    value={formatPhone(profile.emergency_contact_phone)}
                    onChange={(e) =>
                      setProfile({ ...profile, emergency_contact_phone: onlyDigits(e.target.value) })
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sensivel" className="space-y-4 pt-4">
              {!showSensitive ? (
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Conteúdo restrito</AlertTitle>
                  <AlertDescription>
                    Documentos e dados bancários são visíveis apenas para administradores e financeiro.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Alert>
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Dados protegidos</AlertTitle>
                    <AlertDescription>
                      Estes campos ficam ocultos por padrão, não aparecem em listas, impressões ou
                      WhatsApp, e cada alteração é registrada sem gravar o conteúdo.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      CPF: {maskCPF(sensitive.cpf) || '—'} · PIX: {maskSensitive(sensitive.pix_key) || '—'} ·
                      Conta: {maskSensitive(sensitive.bank_account) || '—'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRevealSensitive((prev) => !prev)}
                    >
                      {revealSensitive ? 'Ocultar' : 'Exibir'}
                    </Button>
                  </div>

                  {revealSensitive && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="pp-cpf">CPF</Label>
                        <Input
                          id="pp-cpf"
                          value={formatCPF(sensitive.cpf)}
                          disabled={!mayEditSensitive}
                          aria-invalid={cpfInvalid}
                          onChange={(e) => setSensitive({ ...sensitive, cpf: onlyDigits(e.target.value) })}
                        />
                        {cpfInvalid && <p className="text-xs text-destructive">CPF inválido.</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-rg">RG (opcional)</Label>
                        <Input
                          id="pp-rg"
                          value={sensitive.rg}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, rg: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-pix">Chave PIX</Label>
                        <Input
                          id="pp-pix"
                          value={sensitive.pix_key}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, pix_key: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-pix-type">Tipo da chave</Label>
                        <Input
                          id="pp-pix-type"
                          value={sensitive.pix_key_type}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, pix_key_type: e.target.value })}
                          placeholder="CPF, telefone, e-mail, aleatória"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-bank">Banco</Label>
                        <Input
                          id="pp-bank"
                          value={sensitive.bank_name}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, bank_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-agency">Agência</Label>
                        <Input
                          id="pp-agency"
                          value={sensitive.bank_agency}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, bank_agency: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-account">Conta</Label>
                        <Input
                          id="pp-account"
                          value={sensitive.bank_account}
                          disabled={!mayEditSensitive}
                          onChange={(e) => setSensitive({ ...sensitive, bank_account: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pp-holder">Titular</Label>
                        <Input
                          id="pp-holder"
                          value={sensitive.account_holder_name}
                          disabled={!mayEditSensitive}
                          onChange={(e) =>
                            setSensitive({ ...sensitive, account_holder_name: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="historico" className="pt-4">
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma mudança de situação registrada ainda.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((item) => (
                    <li key={item.id} className="rounded-md border p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {PERSON_STATUS_LABELS[normalizePersonStatus(item.from_status)]} →{' '}
                          {PERSON_STATUS_LABELS[normalizePersonStatus(item.to_status)]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleString('pt-BR')}
                          {item.actor_name ? ` · ${item.actor_name}` : ''}
                        </span>
                      </div>
                      {item.reason && <p className="mt-1 text-muted-foreground">{item.reason}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar ficha'}
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint} disabled={loading}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir ficha
          </Button>
          {whatsappLink && (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(whatsappLink, '_blank', 'noopener')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          )}
          <Button type="button" variant="ghost" className="ml-auto" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PersonProfileDialog;
