// Copiado de supabase/functions/fiscal-document/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
// Edge Function `fiscal-document`
// Única responsável por transmissão / consulta / cancelamento / encerramento e
// importação de XML autorizado. NUNCA aceita status, chave ou protocolo vindos
// do cliente como verdade e NUNCA simula autorização.

import { createClient } from "../../compat/supabase.js";
import { corsHeaders, jsonResponse } from './cors.ts';
import {
  diagnoseSecrets,
  isValidAccessKey,
  parseAuthorizedXml,
  sha256Hex,
  TRANSMISSION_BLOCKED_MESSAGE,
} from './fiscal.ts';

const BUCKET = 'fiscal-documents';
const ALLOWED_ROLES = ['admin', 'financeiro'];

type Action = 'preflight' | 'transmit' | 'query' | 'cancel' | 'close' | 'import_xml';

const admin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

async function authorize(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Não autenticado.', status: 401 as const };

  const client = admin();
  const { data: userData, error } = await client.auth.getUser(token);
  if (error || !userData?.user) return { error: 'Sessão inválida.', status: 401 as const };

  const { data: roleRow } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  const role = roleRow?.role ?? null;
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return { error: 'Permissão insuficiente para operar documentos fiscais.', status: 403 as const };
  }
  return { client, userId: userData.user.id, role };
}

async function logEvent(
  client: ReturnType<typeof admin>,
  documentId: string,
  action: string,
  payload: Record<string, unknown>
) {
  await client.from('fiscal_document_events').insert({
    document_id: documentId,
    action,
    payload: { ...payload, redacted: true },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Método não suportado.' }, 405);

  const auth = await authorize(req);
  if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status);
  const { client, userId } = auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Corpo inválido.' }, 400);
  }

  const action = String(body.action ?? '') as Action;
  const documentId = typeof body.document_id === 'string' ? body.document_id : '';
  const secrets = diagnoseSecrets((k) => Deno.env.get(k));

  if (action === 'preflight') {
    return jsonResponse({
      ready: secrets.configured,
      secrets_configured: secrets.configured,
      missing_secrets: secrets.missing,
      present_secrets: secrets.present,
      mode: secrets.configured ? 'transmission' : 'preparation_only',
      message: secrets.configured
        ? 'Credenciais presentes. A transmissão ainda exige perfil fiscal confirmado pelo contador.'
        : TRANSMISSION_BLOCKED_MESSAGE,
    });
  }

  if (!documentId) return jsonResponse({ error: 'document_id é obrigatório.' }, 400);

  const { data: doc, error: docError } = await client
    .from('fiscal_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle();

  if (docError || !doc) return jsonResponse({ error: 'Documento não encontrado.' }, 404);

  // -------------------------------------------------------------------------
  // Importação de XML autorizado de emissor externo
  // -------------------------------------------------------------------------
  if (action === 'import_xml') {
    const xml = typeof body.xml === 'string' ? body.xml : '';
    if (!xml.trim()) return jsonResponse({ error: 'Conteúdo XML é obrigatório.' }, 400);
    if (xml.length > 3_000_000) return jsonResponse({ error: 'XML acima do limite (3 MB).' }, 413);

    const parsed = parseAuthorizedXml(xml);
    if (!parsed.ok) {
      await logEvent(client, documentId, 'import_rejected', { reason: parsed.error });
      return jsonResponse({ error: parsed.error }, 422);
    }

    if (parsed.model && parsed.model !== doc.model) {
      return jsonResponse(
        { error: `Modelo do XML (${parsed.model}) difere do documento (${doc.model}).` },
        422
      );
    }
    if (parsed.environment && parsed.environment !== doc.environment) {
      return jsonResponse(
        { error: `Ambiente do XML (${parsed.environment}) difere do documento (${doc.environment}).` },
        422
      );
    }

    // Idempotência: mesma chave já importada não duplica.
    const { data: existing } = await client
      .from('fiscal_documents')
      .select('id, status')
      .eq('access_key', parsed.access_key)
      .maybeSingle();
    if (existing && existing.id !== documentId) {
      return jsonResponse(
        { error: 'Esta chave de acesso já está vinculada a outro documento.', document_id: existing.id },
        409
      );
    }
    if (doc.status === 'autorizado' && doc.access_key === parsed.access_key) {
      return jsonResponse({ ok: true, idempotent: true, status: doc.status, access_key: doc.access_key });
    }

    const hash = await sha256Hex(xml);
    const path = `fiscal-documents/${documentId}/autorizado-${parsed.access_key}.xml`;
    const upload = await client.storage
      .from(BUCKET)
      .upload(path, new Blob([xml], { type: 'application/xml' }), { upsert: true });
    if (upload.error) return jsonResponse({ error: `Falha ao armazenar XML: ${upload.error.message}` }, 500);

    // Transição auditada: garante passagem por "enviado" antes de "autorizado".
    if (doc.status !== 'enviado') {
      const bridge = doc.status === 'rascunho' ? ['validado', 'enviado'] : ['enviado'];
      for (const step of bridge) {
        const { error } = await client
          .from('fiscal_documents')
          .update({ status: step, source: 'external_import' })
          .eq('id', documentId);
        if (error) return jsonResponse({ error: `Transição inválida (${step}): ${error.message}` }, 409);
      }
    }

    const { error: authErr } = await client
      .from('fiscal_documents')
      .update({
        status: 'autorizado',
        access_key: parsed.access_key,
        protocol_number: parsed.protocol_number,
        protocol_date: parsed.authorized_at,
        authorized_at: parsed.authorized_at,
        authorization_source: 'external_import',
        source: 'external_import',
        xml_path: path,
        xml_sha256: hash,
        rejection_code: null,
        rejection_message: null,
      })
      .eq('id', documentId);

    if (authErr) return jsonResponse({ error: authErr.message }, 409);

    await logEvent(client, documentId, 'imported_authorized_xml', {
      access_key: parsed.access_key,
      xml_sha256: hash,
      actor: userId,
    });

    return jsonResponse({
      ok: true,
      status: 'autorizado',
      access_key: parsed.access_key,
      protocol_number: parsed.protocol_number,
      xml_sha256: hash,
      xml_path: path,
    });
  }

  // -------------------------------------------------------------------------
  // Operações que dependem do provedor/certificado
  // -------------------------------------------------------------------------
  if (!secrets.configured) {
    await logEvent(client, documentId, `${action}_blocked`, { missing_secrets: secrets.missing });
    return jsonResponse(
      {
        error: TRANSMISSION_BLOCKED_MESSAGE,
        blocked: true,
        mode: 'preparation_only',
        missing_secrets: secrets.missing,
        instructions:
          'Cadastre os secrets FISCAL_PROVIDER_URL, FISCAL_PROVIDER_API_KEY, FISCAL_CERT_A1_BASE64 e ' +
          'FISCAL_CERT_A1_PASSWORD. Enquanto isso, use a preparação/homologação ou importe um XML ' +
          'autorizado emitido por sistema externo.',
        alternatives: ['import_xml'],
      },
      503
    );
  }

  if (action === 'query') {
    const key = typeof body.access_key === 'string' ? body.access_key : (doc.access_key ?? '');
    if (!isValidAccessKey(key) && !doc.receipt_number) {
      return jsonResponse({ error: 'Informe uma chave de 44 dígitos ou recibo para consulta.' }, 400);
    }
    // Sem provedor homologado não há consulta real; nunca inventamos resposta.
    return jsonResponse(
      { error: 'Consulta indisponível: provedor configurado, porém adaptador de consulta não homologado.' },
      501
    );
  }

  if (action === 'transmit' || action === 'cancel' || action === 'close') {
    await logEvent(client, documentId, `${action}_unavailable`, {});
    return jsonResponse(
      {
        error:
          'Adaptador de transmissão SEFAZ ainda não homologado nesta instalação. ' +
          'Nenhum documento foi enviado e nada foi marcado como autorizado.',
        blocked: true,
        mode: 'preparation_only',
      },
      501
    );
  }

  return jsonResponse({ error: 'Ação desconhecida.' }, 400);
});
