// Ambiente mínimo do Deno para rodar as funções originais (supabase/functions)
// dentro do Worker sem reescrevê-las: Deno.env.get, Deno.serve e serve().
//
// Variáveis que as funções leem e de onde vêm no Cloudflare:
//   SUPABASE_URL / VITE_SUPABASE_URL         -> PUBLIC_API_URL (endereço do Worker)
//   SUPABASE_SERVICE_ROLE_KEY                -> SERVICE_ROLE_KEY (segredo)
//   SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY -> ANON_KEY
//   demais (NFSE_CERT_PASSWORD, C6_*, PLUGGY_*, WHATSAPP_*, OPENAI_API_KEY...)
//   com o mesmo nome, cadastrados como segredos do Worker.
let ENV = {};
let CAPTURED = null;

const ALIASES = {
  SUPABASE_URL: 'PUBLIC_API_URL',
  VITE_SUPABASE_URL: 'PUBLIC_API_URL',
  SUPABASE_SERVICE_ROLE_KEY: 'SERVICE_ROLE_KEY',
  SUPABASE_ANON_KEY: 'ANON_KEY',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'ANON_KEY',
};

export function setEnv(env) {
  ENV = env || {};
}

function get(name) {
  const v = ENV[name] ?? ENV[ALIASES[name]];
  if (v !== undefined && v !== null) return String(v);
  if (name === 'SUPABASE_SERVICE_ROLE_KEY' || name === 'SUPABASE_ANON_KEY' || name === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
    // Sem chave configurada, o cliente interno usa o modo serviço / público.
    return name === 'SUPABASE_SERVICE_ROLE_KEY' ? '__service__' : '__anon__';
  }
  if (name === 'SUPABASE_URL' || name === 'VITE_SUPABASE_URL') return 'http://local';
  // Certificado do C6 (mTLS): no Cloudflare fica num "mTLS certificate"
  // ligado ao Worker (binding C6_MTLS), não em variáveis de texto.
  if ((name === 'C6_MTLS_CERT' || name === 'C6_MTLS_KEY') && ENV.C6_MTLS) return 'via-binding-C6_MTLS';
  return undefined;
}

export function serve(handler) {
  CAPTURED = typeof handler === 'function' ? handler : handler && handler.fetch;
}

export function takeHandler() {
  const h = CAPTURED;
  CAPTURED = null;
  return h;
}

// Deno.createHttpClient({cert, key}) era usado para o certificado de cliente
// do banco C6. No Worker, o fetch com esse "client" passa pelo binding mTLS.
const MTLS = { __mtls: true, close() {} };

globalThis.Deno = globalThis.Deno || {
  env: { get, toObject: () => ({ ...ENV }) },
  serve: (a, b) => serve(typeof a === 'function' ? a : b),
  createHttpClient: () => MTLS,
};

const baseFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = function fetchWithMtls(input, init) {
  if (init && init.client && init.client.__mtls) {
    const { client, ...rest } = init;
    if (!ENV.C6_MTLS || typeof ENV.C6_MTLS.fetch !== 'function') {
      return Promise.reject(new Error('Certificado mTLS do C6 não configurado (binding C6_MTLS no wrangler.toml)'));
    }
    return ENV.C6_MTLS.fetch(input, rest);
  }
  // Chamadas ao próprio Worker (ex.: imagens dos produtos guardadas no R2)
  // são atendidas aqui mesmo: o Cloudflare não deixa um Worker chamar a si
  // próprio pela rede.
  const url = typeof input === 'string' ? input : input && input.url;
  const self = ENV.PUBLIC_API_URL && String(ENV.PUBLIC_API_URL).replace(/\/+$/, '');
  if (self && url && url.startsWith(self + '/')) {
    return import('../index.js').then((m) => m.default.fetch(new Request(url, init), ENV, { waitUntil() {} }));
  }
  return baseFetch(input, init);
};
