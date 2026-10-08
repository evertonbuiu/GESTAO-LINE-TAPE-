import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const secret = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Segredo ${name} não configurado`);
  return value.replace(/\\n/g, '\n');
};

const text = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' ? value.trim() : '';
};

const numberValue = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
      const parsed = Number(normalized.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const isoDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const isoTime = (...values: unknown[]) => {
  for (const value of values) {
    const raw = text(value);
    if (!raw) continue;
    const match = raw.match(/(?:T|\s)?(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (match) return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;
  }
  return null;
};

const fingerprint = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

type NormalizedEntry = {
  description: string;
  source_description: string;
  amount: number;
  transaction_type: 'income' | 'expense';
  transaction_date: string;
  transaction_time: string | null;
  external_id: string;
  receipt_url: string | null;
};

const normalizeEntry = (entry: Record<string, unknown>): NormalizedEntry | null => {
  const credit = numberValue(entry.credit, entry.credit_amount, entry.creditAmount, entry.entry_amount);
  const debit = numberValue(entry.debit, entry.debit_amount, entry.debitAmount);
  const rawAmount = numberValue(entry.amount, entry.value, entry.transaction_amount, entry.transactionAmount, entry.valor);
  // operation_type informa a natureza contábil (débito/crédito). Já
  // transaction_type costuma informar apenas o meio (PIX, TED etc.).
  const rawType = text(entry.operation_type, entry.operationType, entry.nature,
    entry.credit_debit_indicator, entry.creditDebitIndicator, entry.kind).toLowerCase();
  const movementText = text(entry.transaction_type, entry.transactionType, entry.title,
    entry.description, entry.memo, entry.history, entry.historic).toLowerCase();
  const sourceDescription = text(entry.description, entry.title, entry.memo, entry.history, entry.historic,
    entry.transaction_description, entry.transactionDescription, entry.name, entry.descricao) || 'Movimentação C6 Bank';
  const receipt = entry.receipt && typeof entry.receipt === 'object'
    ? entry.receipt as Record<string, unknown>
    : {};
  const isCredit = /credit|credito|crédito|income|incoming|entrada|received|recebido|\bc\b/.test(rawType) ||
    /pix\s+(recebido|entrada)|cr[eé]dito\s+(de\s+)?boleto|boleto\s+(creditado|recebido)/.test(movementText);
  const isDebit = /debit|debito|débito|expense|outgoing|saida|saída|sent|enviado|\bd\b/.test(rawType) ||
    /pix\s+(enviado|sa[ií]da)|sa[ií]da\s+pix|d[eé]bito\s+(de\s+)?cart[aã]o|\bpgto\b|\bcdb\b|recarga\s+(de\s+)?celular|\bpagamentos?\b/.test(movementText);
  const signedAmount = credit != null && credit !== 0
    ? Math.abs(credit)
    : debit != null && debit !== 0
      ? -Math.abs(debit)
      : rawAmount;
  if (signedAmount == null || signedAmount === 0) return null;

  const date = isoDate(entry.date ?? entry.entry_date ?? entry.entryDate ?? entry.transaction_date ?? entry.transactionDate ??
    entry.booking_date ?? entry.bookingDate ?? entry.created_at ?? entry.createdAt ?? entry.data);
  if (!date) return null;
  const transactionTime = isoTime(
    entry.transaction_time, entry.transactionTime, entry.entry_time, entry.entryTime,
    entry.time, entry.hour, entry.hora, entry.date, entry.entry_date, entry.entryDate,
    entry.transaction_date, entry.transactionDate, entry.created_at, entry.createdAt,
  );

  const transactionType: 'income' | 'expense' = isDebit
    ? 'expense'
    : isCredit
      ? 'income'
      : signedAmount >= 0 ? 'income' : 'expense';
  const rawPixRecipient = text(entry.recipient_name, entry.recipientName, entry.receiver_name, entry.receiverName,
    entry.beneficiary_name, entry.beneficiaryName, entry.counterparty_name, entry.counterpartyName,
    receipt.recipient_name, receipt.recipientName, receipt.receiver_name, receipt.receiverName,
    receipt.beneficiary_name, receipt.beneficiaryName, receipt.payee_name, receipt.payeeName,
    receipt.name, entry.title);
  const pixRecipient = rawPixRecipient.replace(/^pix\s+enviado\s+para\s+/i, '').trim();
  const isOutgoingPix = isDebit && /pix/.test(movementText);
  const recipientIsGeneric = /pix|transfer|transf|pagamento|payment|enviad|sa[ií]da/i.test(pixRecipient);
  const description = isOutgoingPix && pixRecipient && !recipientIsGeneric
    ? `PIX enviado — ${pixRecipient}`
    : sourceDescription;
  const externalId = text(entry.id, entry.external_id, entry.externalId, entry.transaction_id, entry.transactionId, entry.reference_id,
    entry.referenceId, entry.external_reference_id, entry.externalReferenceId, entry.fitid);

  return {
    description,
    source_description: sourceDescription,
    amount: Math.abs(signedAmount),
    transaction_type: transactionType,
    transaction_date: date,
    transaction_time: transactionTime,
    external_id: externalId,
    receipt_url: typeof entry.receipt === 'string' && entry.receipt.startsWith('/') ? entry.receipt : null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  let client: Deno.HttpClient | undefined;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const today = new Date();
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - Math.min(30, Math.max(1, Number(body.days) || 3)));
    const startDate = isoDate(body.start_date) ?? start.toISOString().slice(0, 10);
    const endDate = isoDate(body.end_date) ?? today.toISOString().slice(0, 10);
    const environment = (Deno.env.get('C6_API_ENV') || 'sandbox').toLowerCase();
    const baseUrl = environment === 'production'
      ? 'https://baas-api.c6bank.info/v1'
      : 'https://baas-api-sandbox.c6bank.info/v1';

    client = Deno.createHttpClient({ cert: secret('C6_MTLS_CERT'), key: secret('C6_MTLS_KEY') });
    const authResponse = await fetch(`${baseUrl}/auth/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: secret('C6_CLIENT_ID'),
        client_secret: secret('C6_CLIENT_SECRET'),
        grant_type: 'client_credentials',
      }),
      client,
      signal: AbortSignal.timeout(20_000),
    });
    const auth = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok || typeof auth.access_token !== 'string') {
      return json({ ok: false, error: 'Autenticação recusada pelo C6' }, 502);
    }

    const statementUrl = new URL(`${baseUrl}/statement/`);
    statementUrl.searchParams.set('start_date', startDate);
    statementUrl.searchParams.set('end_date', endDate);
    const statementResponse = await fetch(statementUrl, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      client,
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await statementResponse.json().catch(() => ({}));
    if (!statementResponse.ok) return json({ ok: false, error: 'Consulta de extrato recusada pelo C6' }, 502);

    const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
    const normalized = rawEntries
      .map((entry: unknown) => entry && typeof entry === 'object' ? normalizeEntry(entry as Record<string, unknown>) : null)
      .filter((entry: NormalizedEntry | null): entry is NormalizedEntry => Boolean(entry));

    if (body.dry_run === true) {
      return json({
        ok: true,
        environment,
        received: rawEntries.length,
        recognized: normalized.length,
        direction_counts: normalized.reduce((counts, entry) => {
          counts[entry.transaction_type] = (counts[entry.transaction_type] ?? 0) + 1;
          return counts;
        }, {} as Record<string, number>),
        operation_types: Array.from(new Set(rawEntries.map((entry: unknown) =>
          entry && typeof entry === 'object'
            ? text((entry as Record<string, unknown>).operation_type, (entry as Record<string, unknown>).operationType)
            : ''
        ).filter(Boolean))).sort(),
        entry_keys: rawEntries[0] && typeof rawEntries[0] === 'object' ? Object.keys(rawEntries[0]).sort() : [],
        start_date: startDate,
        end_date: endDate,
      });
    }

    const admin = createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'));
    let { data: account } = await admin.from('bank_accounts').select('id').ilike('name', 'C6 BANK').limit(1).maybeSingle();
    if (!account) {
      const created = await admin.from('bank_accounts')
        .insert({ name: 'C6 BANK', account_type: 'checking', balance: 0 })
        .select('id').single();
      if (created.error) throw created.error;
      account = created.data;
    }

    const rows = await Promise.all(normalized.map(async (entry) => ({
      bank_account_id: account!.id,
      description: entry.description,
      source_description: entry.source_description,
      amount: entry.amount,
      transaction_type: entry.transaction_type,
      category: 'Extrato C6',
      transaction_date: entry.transaction_date,
      transaction_time: entry.transaction_time,
      receipt_url: entry.receipt_url,
      import_fingerprint: await fingerprint([
        account!.id, entry.external_id, entry.transaction_date, entry.transaction_type,
        entry.transaction_time ?? '', Math.round(entry.amount * 100),
        entry.description.toLowerCase().replace(/\s+/g, ' ').trim(),
      ].join('|')),
    })));

    let imported = 0;
    if (rows.length) {
      const currentResult = await admin.from('bank_transactions')
        .select('id,description,amount,transaction_type,transaction_date,transaction_time,import_fingerprint,receipt_url')
        .eq('bank_account_id', account.id)
        .eq('category', 'Extrato C6')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate);
      if (currentResult.error) throw currentResult.error;

      // Corrige lançamentos antigos classificados pelo meio da transação
      // (por exemplo PIX) em vez da natureza débito/crédito.
      const known = new Set((currentResult.data ?? []).map((row) => row.import_fingerprint));
      for (const row of rows) {
        const matches = (currentResult.data ?? []).filter((current) =>
          current.transaction_date === row.transaction_date &&
          Number(current.amount) === Number(row.amount) &&
          (current.description === row.description || current.description === row.source_description) &&
          // Dois lançamentos podem ter a mesma data, valor e destinatário.
          // Quando ambos possuem horário, eles só representam a mesma
          // transação se o horário também for igual.
          (!current.transaction_time || !row.transaction_time || current.transaction_time === row.transaction_time)
        );
        if (matches.length) {
          // Mesmo que o registro antigo tenha outro fingerprint, a transação
          // já existe e não deve ser inserida novamente.
          known.add(row.import_fingerprint);
          for (const match of matches.filter((current) =>
            current.transaction_type !== row.transaction_type || current.description !== row.description ||
            current.transaction_time !== row.transaction_time || current.receipt_url !== row.receipt_url
          )) {
            const corrected = await admin.from('bank_transactions').update({
              transaction_type: row.transaction_type,
              description: row.description,
              transaction_time: row.transaction_time,
              receipt_url: row.receipt_url,
            }).eq('id', match.id);
            if (corrected.error) throw corrected.error;
            match.transaction_type = row.transaction_type;
          }
        }
      }

      // Usa os registros já carregados no intervalo. Além de poupar uma
      // consulta, evita URLs excessivamente longas quando o extrato tem
      // centenas de movimentações.
      const pending = rows.filter((row) => !known.has(row.import_fingerprint));
      if (pending.length) {
        const insertRows = pending.map(({ source_description: _sourceDescription, ...row }) => row);
        const result = await admin.from('bank_transactions')
          .insert(insertRows)
          .select('id');
        if (result.error) throw result.error;
        imported = result.data?.length ?? 0;
      }
    }

    return json({
      ok: true,
      environment,
      account_id: account.id,
      received: rawEntries.length,
      recognized: normalized.length,
      imported,
      ignored: normalized.length - imported,
      start_date: startDate,
      end_date: endDate,
    });
  } catch (error) {
    console.error('C6 statement sync failed', error instanceof Error ? error.message : JSON.stringify(error));
    return json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao sincronizar o extrato C6' }, 500);
  } finally {
    client?.close();
  }
});

