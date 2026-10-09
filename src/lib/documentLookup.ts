// Busca os dados do tomador a partir do CNPJ ou CPF digitado.
// CNPJ: consulta pública da Receita (BrasilAPI, com a CNPJ.ws de reserva)
//       e completa e-mail/telefone com o que já existe no sistema.
// CPF:  a Receita não libera dados de CPF, então só usa o que já existe no
//       sistema (notas anteriores e orçamentos).
import { supabase } from "@/integrations/supabase/client";

export interface TakerData {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city_code?: string;
  state?: string;
  cep?: string;
}

export interface LookupResult {
  data: TakerData;
  source: "receita" | "sistema" | "receita+sistema";
}

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

function fmtCnpj(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
function fmtCpf(d: string) {
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
function fmtCep(d: string) {
  const c = onlyDigits(d);
  return c.length === 8 ? `${c.slice(0, 5)}-${c.slice(5)}` : d || "";
}
function fmtPhone(d: string) {
  const p = onlyDigits(d);
  if (p.length === 11) return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`;
  if (p.length === 10) return `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}`;
  return d || "";
}
const title = (s?: string | null) =>
  (s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, sp, ch) => sp + ch.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

function joinAddress(parts: (string | null | undefined)[]) {
  return parts.map((p) => (p || "").trim()).filter(Boolean).join(", ");
}

async function fetchJson(url: string, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function ibgeCode(uf?: string, city?: string): Promise<string | undefined> {
  if (!uf || !city) return undefined;
  const list = await fetchJson(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
  if (!Array.isArray(list)) return undefined;
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const hit = list.find((m: { nome: string }) => norm(m.nome) === norm(city));
  return hit ? String(hit.id) : undefined;
}

// Três serviços públicos, na ordem: se um estiver fora do ar, tenta o próximo.
async function fromReceita(cnpj: string): Promise<TakerData | null> {
  const b = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (b && b.razao_social) {
    return {
      name: b.razao_social,
      email: (b.email || "").toLowerCase() || undefined,
      phone: b.ddd_telefone_1 ? fmtPhone(b.ddd_telefone_1) : undefined,
      address: joinAddress([
        title(`${b.descricao_tipo_de_logradouro || ""} ${b.logradouro || ""}`),
        b.numero,
        title(b.complemento),
        title(b.bairro),
        title(b.municipio),
      ]),
      city_code: b.codigo_municipio_ibge ? String(b.codigo_municipio_ibge) : undefined,
      state: b.uf || undefined,
      cep: b.cep ? fmtCep(String(b.cep)) : undefined,
    };
  }
  const w = await fetchJson(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  if (w && w.razao_social) {
    const e = w.estabelecimento || {};
    return {
      name: w.razao_social,
      email: (e.email || "").toLowerCase() || undefined,
      phone: e.ddd1 && e.telefone1 ? fmtPhone(`${e.ddd1}${e.telefone1}`) : undefined,
      address: joinAddress([
        title(`${e.tipo_logradouro || ""} ${e.logradouro || ""}`),
        e.numero,
        title(e.complemento),
        title(e.bairro),
        title(e.cidade?.nome),
      ]),
      city_code: e.cidade?.ibge_id ? String(e.cidade.ibge_id) : undefined,
      state: e.estado?.sigla || undefined,
      cep: e.cep ? fmtCep(e.cep) : undefined,
    };
  }
  const o = await fetchJson(`https://api.opencnpj.org/${cnpj}`);
  if (o && o.razao_social) {
    const tel = Array.isArray(o.telefones) ? o.telefones.find((t: { is_fax?: boolean }) => !t.is_fax) : null;
    return {
      name: o.razao_social,
      email: (o.email || "").toLowerCase() || undefined,
      phone: tel ? fmtPhone(`${tel.ddd}${tel.numero}`) : undefined,
      address: joinAddress([
        title(`${o.tipo_logradouro || ""} ${o.logradouro || ""}`),
        o.numero,
        title(o.complemento),
        title(o.bairro),
        title(o.municipio),
      ]),
      city_code: await ibgeCode(o.uf, o.municipio),
      state: o.uf || undefined,
      cep: o.cep ? fmtCep(o.cep) : undefined,
    };
  }
  return null;
}

async function fromSystem(digits: string, formatted: string): Promise<TakerData | null> {
  const list = [digits, formatted];
  const { data: inv } = await supabase
    .from("nfse_invoices")
    .select("taker_name,taker_email,taker_phone,taker_address,taker_city_code,taker_state,taker_cep")
    .in("taker_document", list)
    .order("created_at", { ascending: false })
    .limit(1);
  const i = inv?.[0];
  if (i) {
    return {
      name: i.taker_name || undefined,
      email: i.taker_email || undefined,
      phone: i.taker_phone || undefined,
      address: i.taker_address || undefined,
      city_code: i.taker_city_code || undefined,
      state: i.taker_state || undefined,
      cep: i.taker_cep || undefined,
    };
  }
  const { data: q } = await supabase
    .from("external_quotes")
    .select("client_name,client_email,client_phone,client_address")
    .in("client_document", list)
    .order("created_at", { ascending: false })
    .limit(1);
  const o = q?.[0];
  if (o) {
    return {
      name: o.client_name || undefined,
      email: o.client_email || undefined,
      phone: o.client_phone || undefined,
      address: o.client_address || undefined,
    };
  }
  return null;
}

/** Retorna null quando o documento está incompleto ou nada foi encontrado. */
export async function lookupTaker(document: string): Promise<LookupResult | null> {
  const d = onlyDigits(document);
  if (d.length === 14) {
    const [rec, sys] = await Promise.all([fromReceita(d), fromSystem(d, fmtCnpj(d)).catch(() => null)]);
    if (rec) {
      if (sys) {
        // contato já usado pela empresa no sistema vale mais que o da Receita
        return {
          data: { ...rec, email: sys.email || rec.email, phone: sys.phone || rec.phone },
          source: "receita+sistema",
        };
      }
      return { data: rec, source: "receita" };
    }
    return sys ? { data: sys, source: "sistema" } : null;
  }
  if (d.length === 11) {
    const sys = await fromSystem(d, fmtCpf(d)).catch(() => null);
    return sys ? { data: sys, source: "sistema" } : null;
  }
  return null;
}

export interface CepData {
  street: string;
  district: string;
  city: string;
  state: string;
  city_code: string;
}

/** Endereço pelo CEP (ViaCEP, com a OpenCEP de reserva). */
export async function lookupCep(cep: string): Promise<CepData | null> {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  for (const url of [`https://viacep.com.br/ws/${d}/json/`, `https://opencep.com/v1/${d}`]) {
    const r = await fetchJson(url, 6000);
    if (r && !r.erro && r.localidade) {
      return {
        street: r.logradouro || "",
        district: r.bairro || "",
        city: r.localidade || "",
        state: r.uf || "",
        city_code: r.ibge ? String(r.ibge) : "",
      };
    }
  }
  return null;
}
