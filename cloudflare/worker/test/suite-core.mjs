// Login, API de dados (filtros, relações, contagem, single), arquivos e RPC.
export default async function ({ setup, client, ok }) {
  const { env, mkUser } = await setup();
  await mkUser('admin', 'admin');
  const c = client(env);

  // --- login ---
  let r = await c.call('POST', '/auth/v1/token?grant_type=password', { body: { email: 'admin@linetape.local', password: 'errada' } });
  ok(r.status === 400 && r.data.error_code === 'invalid_credentials', 'senha errada é recusada', r.data);
  const session = await c.login('admin');
  ok(session.user && session.user.email === 'admin@linetape.local', 'login devolve usuário');
  r = await c.call('GET', '/auth/v1/user');
  ok(r.status === 200 && r.data.id === session.user.id, '/user devolve o usuário logado', r.data);
  r = await c.call('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
  ok(r.status === 200 && r.data.access_token, 'refresh_token funciona', r.data);
  r = await c.call('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
  ok(r.status === 400, 'refresh_token não pode ser reutilizado');

  // --- inserir / ler ---
  r = await c.call('POST', '/rest/v1/bank_accounts?select=*', {
    body: { name: 'Conta Corrente Principal', bank_name: 'C6', initial_balance: '100.50' },
    headers: { Prefer: 'return=representation' },
  });
  ok(r.status === 201 && r.data[0].id && r.data[0].is_active === true, 'insert com padrões (uuid, booleano)', r.data);
  const acct = r.data[0];
  ok(acct.initial_balance === 100.5 && typeof acct.created_at === 'string', 'número e data convertidos', acct);

  r = await c.call('POST', '/rest/v1/clients', {
    body: [{ name: 'Maria Souza', email: 'maria@x.com' }, { name: 'joão lima' }, { name: 'Ana Prado', phone: '62999' }],
    headers: { Prefer: 'return=representation' },
  });
  ok(r.status === 201 && r.data.length === 3, 'insert em lote', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=name&order=name.asc');
  ok(r.data.map((x) => x.name).join('|') === 'Ana Prado|joão lima|Maria Souza', 'ordem sem diferenciar maiúsculas', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=name&name=ilike.*SOUZA*');
  ok(r.data.length === 1 && r.data[0].name === 'Maria Souza', 'ilike', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=name&or=(name.eq.Ana%20Prado,email.eq.maria@x.com)&order=name');
  ok(r.data.length === 2, 'filtro or', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=name&email=not.is.null');
  ok(r.data.length === 1, 'not.is.null', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=id,nome:name&name=in.(Ana%20Prado,"joão lima")', { headers: { Prefer: 'count=exact' } });
  ok(r.data.length === 2 && r.data[0].nome && r.headers.get('content-range').endsWith('/2'), 'in + apelido + count', [r.data, r.headers.get('content-range')]);

  r = await c.call('GET', '/rest/v1/clients?select=*&name=eq.Ninguém', { headers: { Accept: 'application/vnd.pgrst.object+json' } });
  ok(r.status === 406 && r.data.code === 'PGRST116', 'single sem resultado = PGRST116', r.data);

  r = await c.call('GET', '/rest/v1/clients?select=*&limit=1&offset=1&order=name');
  ok(r.data.length === 1 && r.data[0].name === 'joão lima', 'limit/offset', r.data);

  r = await c.call('POST', '/rest/v1/clients', { body: { name: 'X', coluna_que_nao_existe: 1 } });
  ok(r.status === 400 && r.data.code === 'PGRST204', 'coluna inexistente = PGRST204', r.data);

  // --- eventos e relações ---
  r = await c.call('POST', '/rest/v1/events?select=*', {
    body: { name: 'Casamento Silva', client_name: 'Maria Souza', event_date: '2026-11-20', total_budget: 5000 },
    headers: { Prefer: 'return=representation' },
  });
  const ev = r.data[0];
  ok(r.status === 201 && ev.status === 'pending', 'evento criado', r.data);

  r = await c.call('POST', '/rest/v1/event_expenses?select=*,events(name)', {
    body: { event_id: ev.id, description: 'Gerador', total_price: 800, category: 'Equipamentos' },
    headers: { Prefer: 'return=representation' },
  });
  ok(r.status === 201 && r.data[0].events && r.data[0].events.name === 'Casamento Silva', 'insert devolvendo relação', r.data);

  r = await c.call('GET', `/rest/v1/events?select=name,event_expenses(description,total_price)&id=eq.${ev.id}`);
  ok(Array.isArray(r.data[0].event_expenses) && r.data[0].event_expenses.length === 1, 'relação um-para-muitos', r.data);

  r = await c.call('GET', `/rest/v1/event_expenses?select=*,events!inner(name)&events.name=eq.Outro`);
  ok(r.data.length === 0, '!inner com filtro na relação', r.data);
  r = await c.call('GET', `/rest/v1/event_expenses?select=*,events!inner(name)&events.name=eq.Casamento%20Silva`);
  ok(r.data.length === 1, '!inner com filtro que bate', r.data);

  // --- update / upsert / delete ---
  r = await c.call('PATCH', `/rest/v1/clients?name=eq.Ana%20Prado&select=*`, { body: { phone: '62888' }, headers: { Prefer: 'return=representation' } });
  ok(r.data.length === 1 && r.data[0].phone === '62888' && r.data[0].updated_at, 'update com retorno', r.data);

  r = await c.call('POST', '/rest/v1/company_settings?on_conflict=id&select=*', {
    body: { company_name: 'Line Tape' },
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  });
  ok(r.status === 201, 'upsert', r.data);

  r = await c.call('DELETE', `/rest/v1/clients?name=eq.joão%20lima`, { headers: { Prefer: 'return=representation' } });
  ok(r.data.length === 1, 'delete com retorno', r.data);

  // --- RPC ---
  r = await c.call('POST', '/rest/v1/rpc/next_quote_number', { body: {} });
  ok(r.data === '#001', 'next_quote_number começa em #001', r.data);
  r = await c.call('POST', '/rest/v1/rpc/next_quote_number', { body: {} });
  ok(r.data === '#002', 'next_quote_number incrementa', r.data);
  r = await c.call('POST', '/rest/v1/rpc/has_permission', { body: { _user_id: session.user.id, _permission_name: 'x', _access_type: 'view' } });
  ok(r.data === true, 'admin tem permissão', r.data);

  // --- arquivos ---
  let res = await c.call('POST', '/storage/v1/object/logos/teste.png', { raw: true, body: 'abc' });
  ok(res.status === 200, 'upload de arquivo');
  res = await c.call('GET', '/storage/v1/object/public/logos/teste.png', { raw: true });
  ok(res.status === 200 && (await res.text()) === '"abc"', 'leitura pública');
  r = await c.call('POST', '/storage/v1/object/list/logos', { body: { prefix: '' } });
  ok(Array.isArray(r.data) && r.data[0].name === 'teste.png', 'listar arquivos', r.data);
  r = await c.call('POST', '/storage/v1/object/sign/receipts/a/b.pdf', { body: { expiresIn: 60 } });
  ok(r.data.signedURL && r.data.signedURL.includes('token='), 'link assinado', r.data);

  // --- atualização automática das telas ---
  r = await c.call('GET', '/realtime/v1/changes?since=0');
  ok(r.data.changes.some((x) => x.table === 'events'), 'registro de alterações', r.data);

  // --- sem login ---
  c.logout();
  r = await c.call('GET', '/rest/v1/clients?select=*');
  ok(Array.isArray(r.data) && r.data.length === 0, 'sem login não lê clientes', r.data);
  r = await c.call('POST', '/rest/v1/clients', { body: { name: 'Invasor' } });
  ok(r.status === 403, 'sem login não grava', r.data);
}
