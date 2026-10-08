// Copiado de supabase/functions/whatsapp-webhook/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { createClient } from "../../compat/supabase.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';
const APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? '';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY') ?? '';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

async function hasValidMetaSignature(rawBody: string, signature: string | null) {
  if (!APP_SECRET || !signature?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const expected = signature.slice('sha256='.length);
  if (!/^[a-f0-9]{64}$/i.test(expected)) return false;
  const bytes = new Uint8Array(expected.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(rawBody));
}

interface WhatsAppMessage {
  sender_phone: string;
  sender_name?: string;
  message_content?: string;
  message_type?: 'text' | 'image' | 'document';
  attachment_url?: string;
  attachment_type?: string;
  received_at?: string;
}

interface ReceiptData {
  amount: number | null;
  date: string | null;
  time: string | null;
  name: string | null;
  description: string | null;
  confidence: number | null;
}

interface MatchedPerson {
  id: string;
  name: string;
  type: 'collaborator' | 'worker';
}

function nationalPhone(value: string | null | undefined) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  return digits;
}

function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
  const a = nationalPhone(left);
  const b = nationalPhone(right);
  if (!a || !b) return false;
  if (a === b) return true;
  // Compatibilidade com cadastros antigos sem o nono dígito.
  const withoutNinth = (value: string) => value.length === 11 && value[2] === '9'
    ? `${value.slice(0, 2)}${value.slice(3)}`
    : value;
  return withoutNinth(a) === withoutNinth(b);
}

async function findPersonByPhone(supabase: any, senderPhone: string): Promise<MatchedPerson | null> {
  for (const source of [
    { table: 'collaborators', type: 'collaborator' as const },
    { table: 'workers', type: 'worker' as const },
  ]) {
    const { data, error } = await supabase.from(source.table).select('id, name, phone, whatsapp');
    if (error) {
      console.error(`Falha ao buscar ${source.table}:`, error.message);
      continue;
    }
    const person = (data || []).find((item: any) =>
      phonesMatch(senderPhone, item.whatsapp) || phonesMatch(senderPhone, item.phone)
    );
    if (person) return { id: person.id, name: person.name, type: source.type };
  }
  return null;
}

async function downloadMetaMedia(mediaId: string) {
  if (!WHATSAPP_ACCESS_TOKEN) throw new Error('WHATSAPP_ACCESS_TOKEN não configurado');
  const metadataResponse = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!metadataResponse.ok) throw new Error(`Falha ao consultar mídia: ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  const mediaResponse = await fetch(metadata.url, {
    headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
  });
  if (!mediaResponse.ok) throw new Error(`Falha ao baixar mídia: ${mediaResponse.status}`);
  return {
    bytes: new Uint8Array(await mediaResponse.arrayBuffer()),
    mimeType: mediaResponse.headers.get('content-type') || metadata.mime_type || 'application/octet-stream',
  };
}

function parseReceiptJson(raw: string): ReceiptData {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  const amount = typeof parsed.amount === 'number' ? parsed.amount : Number(String(parsed.amount || '').replace(',', '.'));
  return {
    amount: Number.isFinite(amount) && amount > 0 ? amount : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date || '') ? parsed.date : null,
    time: /^\d{2}:\d{2}(?::\d{2})?$/.test(parsed.time || '') ? parsed.time : null,
    name: typeof parsed.name === 'string' ? parsed.name.slice(0, 160) : null,
    description: typeof parsed.description === 'string' ? parsed.description.slice(0, 200) : null,
    confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : null,
  };
}

async function extractReceipt(bytes: Uint8Array, mimeType: string): Promise<ReceiptData> {
  const base64 = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
  const prompt = 'Leia este comprovante brasileiro. Retorne SOMENTE JSON válido com amount (número), date (YYYY-MM-DD), time (HH:mm:ss), name (nome do pagador ou recebedor mais relevante), description (resumo curto) e confidence (0 a 1). Use null quando não estiver legível. Não invente dados.';
  const isPdf = mimeType.includes('pdf');

  if (LOVABLE_API_KEY && !isPdf) {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ] }],
      }),
    });
    if (!response.ok) throw new Error(`Falha na leitura do comprovante: ${response.status}`);
    const result = await response.json();
    return parseReceiptJson(result.choices?.[0]?.message?.content || '{}');
  }

  if (OPENAI_API_KEY) {
    const content = isPdf
      ? [{ type: 'input_text', text: prompt }, { type: 'input_file', filename: 'comprovante.pdf', file_data: `data:${mimeType};base64,${base64}` }]
      : [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` }];
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4.1-mini', input: [{ role: 'user', content }] }),
    });
    if (!response.ok) throw new Error(`Falha na leitura do comprovante: ${response.status}`);
    const result = await response.json();
    const outputText = result.output
      ?.flatMap((item: any) => item.content || [])
      .find((item: any) => item.type === 'output_text')?.text;
    return parseReceiptJson(outputText || '{}');
  }

  throw new Error('Configure LOVABLE_API_KEY (imagens) ou OPENAI_API_KEY (imagens e PDF)');
}

// Função para extrair dados do formato Meta Webhook
function parseMetaWebhook(body: any): WhatsAppMessage | null {
  try {
    console.log('Parsing Meta webhook body:', JSON.stringify(body));
    
    // Estrutura do webhook da Meta
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        
        let messageContent = '';
        let messageType: 'text' | 'image' | 'document' = 'text';
        let attachmentUrl = '';
        let attachmentType = '';
        
        if (message.type === 'text') {
          messageContent = message.text?.body || '';
          messageType = 'text';
        } else if (message.type === 'image') {
          messageType = 'image';
          attachmentUrl = message.image?.id || '';
          attachmentType = 'image';
          messageContent = message.image?.caption || '';
        } else if (message.type === 'document') {
          messageType = 'document';
          attachmentUrl = message.document?.id || '';
          attachmentType = message.document?.mime_type || 'document';
          messageContent = message.document?.caption || message.document?.filename || '';
        }
        
        return {
          sender_phone: message.from,
          sender_name: contact?.profile?.name || '',
          message_content: messageContent,
          message_type: messageType,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          received_at: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing Meta webhook:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== VERIFICAÇÃO DO WEBHOOK (GET) ==========
    // A Meta envia um GET request para verificar o webhook
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('Webhook verified successfully!');
        return new Response(challenge, { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        });
      } else {
        console.log('Webhook verification failed - invalid token');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    }

    // ========== PROCESSAR MENSAGENS (POST) ==========
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawText = await req.text();
    if (!(await hasValidMetaSignature(rawText, req.headers.get('x-hub-signature-256')))) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const rawBody = JSON.parse(rawText);
    console.log('Received webhook POST:', JSON.stringify(rawBody));

    // Tentar parsear como formato Meta primeiro
    let messageData: WhatsAppMessage | null = parseMetaWebhook(rawBody);
    
    // Se não for formato Meta, usar formato direto (Make.com ou manual)
    if (!messageData && rawBody.sender_phone) {
      messageData = {
        sender_phone: rawBody.sender_phone,
        sender_name: rawBody.sender_name || null,
        message_content: rawBody.message_content || null,
        message_type: rawBody.message_type || 'text',
        attachment_url: rawBody.attachment_url || null,
        attachment_type: rawBody.attachment_type || null,
        received_at: rawBody.received_at || new Date().toISOString(),
      };
    }

    // Se ainda não temos dados válidos, retornar OK (Meta envia status updates também)
    if (!messageData || !messageData.sender_phone) {
      console.log('No valid message data found, acknowledging webhook');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook acknowledged, no message to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed message data:', JSON.stringify(messageData));

    const matchedPerson = await findPersonByPhone(supabase, messageData.sender_phone);
    if (matchedPerson) console.log('WhatsApp contact matched:', matchedPerson.type, matchedPerson.id);

    // O vínculo com Evento ou Galpão é sempre confirmado manualmente.
    let matchedEventId: string | null = null;
    let matchedEventName: string | null = null;
    let extractedAmount: number | null = null;
    let extractedDescription: string | null = null;

    if (messageData.message_content) {
      // Extrair valor monetário da mensagem (R$ XX,XX ou R$XX.XX)
      const valueMatch = messageData.message_content.match(/R\$\s*(\d+(?:[.,]\d{1,2})?)/i);
      if (valueMatch) {
        extractedAmount = parseFloat(valueMatch[1].replace(',', '.'));
      }

      // Extrair descrição (primeiras 100 caracteres da mensagem sem o valor)
      extractedDescription = messageData.message_content
        .replace(/R\$\s*\d+(?:[.,]\d{1,2})?/gi, '')
        .trim()
        .slice(0, 100);
    }

    let receiptPath: string | null = null;
    let receiptData: ReceiptData | null = null;
    let extractionStatus = 'not_applicable';
    let extractionError: string | null = null;
    if ((messageData.message_type === 'image' || messageData.message_type === 'document') && messageData.attachment_url) {
      extractionStatus = 'processing';
      try {
        const media = await downloadMetaMedia(messageData.attachment_url);
        const extension = media.mimeType.includes('pdf') ? 'pdf' : media.mimeType.includes('png') ? 'png' : media.mimeType.includes('webp') ? 'webp' : 'jpg';
        receiptPath = `${messageData.sender_phone}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('whatsapp-receipts').upload(receiptPath, media.bytes, { contentType: media.mimeType });
        if (uploadError) throw uploadError;
        receiptData = await extractReceipt(media.bytes, media.mimeType);
        extractionStatus = 'completed';
      } catch (error) {
        extractionStatus = 'failed';
        extractionError = String(error).slice(0, 500);
        console.error('Receipt extraction failed:', error);
      }
    }

    // Inserir mensagem na tabela
    const { data: insertedMessage, error: insertError } = await supabase
      .from('whatsapp_messages')
      .insert({
        sender_phone: messageData.sender_phone,
        sender_name: messageData.sender_name || null,
        message_content: messageData.message_content || null,
        message_type: messageData.message_type || 'text',
        attachment_url: receiptPath || messageData.attachment_url || null,
        attachment_type: messageData.attachment_type || null,
        event_id: matchedEventId,
        matched_event_name: matchedEventName,
        extracted_amount: receiptData?.amount ?? extractedAmount,
        extracted_description: receiptData?.description ?? extractedDescription,
        extracted_date: receiptData?.date ?? null,
        extracted_time: receiptData?.time ?? null,
        extracted_name: receiptData?.name ?? null,
        extraction_confidence: receiptData?.confidence ?? null,
        extraction_status: extractionStatus,
        processing_notes: extractionError,
        person_type: matchedPerson?.type ?? null,
        person_id: matchedPerson?.id ?? null,
        person_name: matchedPerson?.name ?? null,
        status: 'pending',
        received_at: messageData.received_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Todo comprovante de uma pessoa cadastrada já aparece nas Notinhas dela.
    // Evento/Galpão continua pendente para conferência manual na tela do WhatsApp.
    if (matchedPerson && messageData.attachment_url) {
      const amount = receiptData?.amount ?? extractedAmount ?? 0;
      const detail = receiptData?.description ?? extractedDescription ?? 'Comprovante recebido pelo WhatsApp';
      const description = `${matchedPerson.name} - ${detail}`;
      const { data: personExpense, error: expenseError } = await supabase
        .from('event_expenses')
        .insert({
          event_id: null,
          category: matchedPerson.type === 'worker' ? 'Despesas de Diaristas' : 'Reembolsos',
          description,
          quantity: 1,
          unit_price: amount,
          total_price: amount,
          supplier: receiptData?.name ?? matchedPerson.name,
          notes: 'Recebido via WhatsApp; destino pendente de confirmação',
          receipt_url: receiptPath || null,
          expense_date: receiptData?.date ?? new Date().toISOString().split('T')[0],
          reference_type: matchedPerson.type,
          reference_id: matchedPerson.id,
        })
        .select('id')
        .single();

      if (expenseError) {
        console.error('Falha ao criar notinha da pessoa:', expenseError.message);
      } else {
        await supabase.from('whatsapp_messages').update({
          event_expense_id: personExpense.id,
          status: 'linked',
          processing_notes: extractionError || `Notinha vinculada automaticamente a ${matchedPerson.name}`,
        }).eq('id', insertedMessage.id);
      }
    }

    console.log('Message saved successfully:', insertedMessage.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: insertedMessage.id,
        matched_event: matchedEventName,
        extracted_amount: extractedAmount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
