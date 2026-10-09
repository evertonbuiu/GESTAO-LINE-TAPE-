// Importação do Supabase antigo: área de espera, ordem das tabelas, troca de
// ids, regras desligadas durante a gravação e religadas no fim.
export default async function ({ setup, client, ok }) {
  const { d1, env, mkUser } = await setup();
  const novo = await mkUser('everton', 'admin');
  await mkUser('func', 'funcionario');
  const c = client(env);

  // conta padrão criada antes da importação (deve sumir)
  await c.login('everton');
  await c.call('POST', '/rest/v1/bank_accounts', { body: { name: 'Conta Corrente Principal' } });
  const nTrig = async () => (await d1.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger'").first()).n;
  const before = await nTrig();

  // só administrador abre a importação
  await c.login('func');
  let r = await c.call('POST', '/import/start', { body: {} });
  ok(r.status === 403, 'funcionário não abre importação', r.data);
  await c.login('everton');

  const OLD_EVERTON = '60c48212-667c-4aff-bad8-1abc8aaa9374';
  const ADMIN = '3f07c3f0-14c3-4437-8c25-a9fc99d0a378';
  r = await c.call('POST', '/import/start', {
    body: {
      source: 'https://antigo.supabase.co',
      remap: { [OLD_EVERTON]: novo.id },
      skipUsers: [OLD_EVERTON],
      replace: [['https://antigo.supabase.co', 'https://novo.workers.dev']],
    },
  });
  ok(r.status === 200 && r.data.token, 'importação aberta', r.data);
  const token = r.data.token;

  r = await c.call('POST', '/import/rows', { body: { token: 'errado', table: 'events', rows: [] } });
  ok(r.status === 403, 'token errado é recusado', r.data);

  c.logout(); // as próximas chamadas usam só o token
  const stage = (table, rows) => c.call('POST', '/import/rows', { body: { token, table, rows } });
  // fora de ordem de propósito: filhos antes dos pais
  const acc = 'aaaaaaaa-0000-4000-8000-000000000001';
  const ev = 'eeeeeeee-0000-4000-8000-000000000001';
  const adv = 'dddddddd-0000-4000-8000-000000000001';
  await stage('bank_transactions', [
    { id: 'bbbbbbbb-0000-4000-8000-000000000001', bank_account_id: acc, description: 'Vale Diarista: Carlos', amount: 100, transaction_type: 'expense', reference_type: 'worker_advance', reference_id: adv, transaction_date: '2026-09-01' },
  ]);
  await stage('worker_advances', [{ id: adv, worker_name: 'Carlos', amount: 100, advance_date: '2026-09-01', bank_account_id: acc, created_by: OLD_EVERTON, is_finalized: false }]);
  await stage('events', [{ id: ev, name: 'Show', client_name: 'Cliente', event_date: '2026-09-10', is_paid: true, payment_amount: 500, total_budget: 500, created_by: ADMIN, description: 'foto em https://antigo.supabase.co/storage/v1/object/public/logos/x.png', coluna_que_nao_existe: 1 }]);
  await stage('bank_accounts', [{ id: acc, name: 'Conta Corrente Principal', balance: -100, current_balance: -100 }]);
  await stage('user_credentials', [{ id: ADMIN, username: 'admin', password_hash: 'x', name: 'Administrador', is_active: true }]);
  await stage('user_roles', [{ user_id: ADMIN, role: 'admin' }, { user_id: OLD_EVERTON, role: 'admin' }]);
  await stage('__auth_users', [
    { id: ADMIN, email: 'admin@linetape.local', meta: { username: 'admin' }, created_at: '2026-07-07T19:16:46+00:00' },
    { id: OLD_EVERTON, email: 'everton@linetape.local', meta: {} },
  ]);
  await stage('__sequences', [{ name: 'quote_number_seq', value: 101 }]);
  r = await c.call('POST', '/import/files', { body: { token, files: [{ bucket: 'logos', name: 'x.png', mimetype: 'image/png', content_b64: btoa('png'), owner: OLD_EVERTON }] } });
  ok(r.status === 200 && r.data.ok === 1, 'arquivo importado', r.data);

  // aplica em partes até terminar
  let last;
  for (let i = 0; i < 40; i++) {
    last = await c.call('POST', '/import/apply', { body: { token } });
    if (last.status !== 200 || last.data.phase === 'done') break;
    if (i === 0) ok((await nTrig()) < before, 'regras desligadas durante a gravação');
  }
  ok(last.data.phase === 'done', 'importação concluída', last.data);
  ok((await nTrig()) === before, 'regras religadas no fim', { antes: before, depois: await nTrig() });

  const q = async (sql, ...p) => (await d1.prepare(sql).bind(...p).all()).results;
  const accs = await q('SELECT id, balance FROM bank_accounts');
  ok(accs.length === 1 && accs[0].id === acc && accs[0].balance === -100, 'contas: só as importadas, com saldo original', accs);
  const txs = await q('SELECT * FROM bank_transactions');
  ok(txs.length === 1, 'vale não gerou lançamento em dobro', txs);
  const a = await q('SELECT created_by FROM worker_advances');
  ok(a[0] && a[0].created_by === novo.id, 'id do everton antigo trocado pelo novo', a);
  const e = await q('SELECT description, is_paid FROM events');
  ok(e[0] && e[0].description.includes('https://novo.workers.dev/') && e[0].is_paid === 1, 'endereços trocados e sim/não convertido', e);
  const users = await q('SELECT id, email, password_hash FROM auth_users ORDER BY email');
  ok(users.length === 3 && users.some((u) => u.id === ADMIN && u.password_hash === ''), 'admin importado sem senha; everton antigo não duplicado', users);
  const roles = await q('SELECT user_id, role FROM user_roles ORDER BY user_id');
  ok(roles.filter((x) => x.user_id === novo.id).length === 1, 'perfil do everton não duplicou', roles);
  const obj = await q("SELECT owner FROM storage_objects WHERE bucket_id = 'logos' AND name = 'x.png'");
  ok(obj[0] && obj[0].owner === novo.id, 'arquivo com dono trocado', obj);
  ok(Array.isArray(last.data.errors) && last.data.errors.some((x) => (x.cols || []).includes('events.coluna_que_nao_existe')), 'coluna desconhecida avisada', last.data.errors);

  // admin importado não entra (sem senha) até o administrador definir uma
  r = await c.call('POST', '/auth/v1/token?grant_type=password', { body: { email: 'admin@linetape.local', password: '' } });
  ok(r.status === 400, 'admin importado sem senha não entra', r.data);

  // depois do fim o token não vale mais
  r = await c.call('POST', '/import/rows', { body: { token, table: 'events', rows: [] } });
  ok(r.status === 403, 'token encerrado', r.data);

  const seq = await q("SELECT value FROM _sequences WHERE name = 'quote_number_seq'");
  ok(seq[0] && seq[0].value === 101, 'contador de orçamentos copiado', seq);

  // regras voltaram a funcionar: novo vale gera lançamento
  await c.login('everton');
  r = await c.call('POST', '/rest/v1/worker_advances', { body: { worker_name: 'Novo', amount: 10, advance_date: '2026-10-01', bank_account_id: acc, created_by: novo.id }, headers: { Prefer: 'return=representation' } });
  const t2 = await q('SELECT COUNT(*) AS n FROM bank_transactions');
  ok(r.status === 201 && t2[0].n === 2, 'regras ativas de novo depois da importação', [r.status, t2]);
}
