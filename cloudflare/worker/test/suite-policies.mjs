// Permissões por perfil (equivalentes às políticas RLS do original).
export default async function ({ setup, client, ok }) {
  const { env, mkUser } = await setup();
  await mkUser('admin', 'admin');
  await mkUser('ana', 'funcionario');
  await mkUser('bia', 'financeiro');
  await mkUser('davi', 'deposito');

  const adm = client(env);
  await adm.login('admin');
  await adm.call('POST', '/rest/v1/bank_accounts', { body: { name: 'Conta' } });
  await adm.call('POST', '/rest/v1/clients', { body: { name: 'Cliente A' } });
  await adm.call('POST', '/rest/v1/equipment', { body: { name: 'Par LED', category: 'Luz', total_stock: 5 } });

  // funcionário: lê clientes e equipamentos, não vê contas bancárias
  const ana = client(env);
  await ana.login('ana');
  let r = await ana.call('GET', '/rest/v1/clients?select=name');
  ok(r.data.length === 1, 'funcionário lê clientes', r.data);
  r = await ana.call('POST', '/rest/v1/clients', { body: { name: 'Novo' } });
  ok(r.status === 403, 'funcionário não cria cliente (só admin/financeiro)', r.data);
  r = await ana.call('GET', '/rest/v1/bank_accounts?select=name');
  ok(Array.isArray(r.data) && r.data.length === 0, 'funcionário não vê contas bancárias', r.data);
  r = await ana.call('POST', '/rest/v1/equipment', { body: { name: 'Fumaça', category: 'Efeitos', total_stock: 1 } });
  ok(r.status === 201, 'funcionário cadastra equipamento', r.data);
  r = await ana.call('PATCH', '/rest/v1/bank_accounts?name=eq.Conta&select=*', { body: { name: 'Hack' }, headers: { Prefer: 'return=representation' } });
  ok(Array.isArray(r.data) && r.data.length === 0, 'funcionário não altera conta bancária', r.data);

  // financeiro: vê contas, não cadastra equipamento
  const bia = client(env);
  await bia.login('bia');
  r = await bia.call('GET', '/rest/v1/bank_accounts?select=name');
  ok(r.data.length === 1, 'financeiro vê contas', r.data);
  r = await bia.call('POST', '/rest/v1/equipment', { body: { name: 'X', category: 'Y', total_stock: 1 } });
  ok(r.status === 403, 'financeiro não cadastra equipamento', r.data);

  // depósito: não lê WhatsApp
  const davi = client(env);
  await davi.login('davi');
  r = await davi.call('GET', '/rest/v1/whatsapp_messages?select=*');
  ok(Array.isArray(r.data) && r.data.length === 0, 'depósito não lê WhatsApp', r.data);

  // finanças pessoais: cada um só vê o seu
  r = await ana.call('POST', '/rest/v1/personal_categories?select=*', { body: { name: 'Casa', kind: 'expense' }, headers: { Prefer: 'return=representation' } });
  ok(r.status === 201, 'funcionário cria categoria pessoal', r.data);
  r = await bia.call('GET', '/rest/v1/personal_categories?select=*');
  ok(r.data.length === 0, 'outro usuário não vê categoria pessoal', r.data);
  r = await ana.call('GET', '/rest/v1/personal_categories?select=*');
  ok(r.data.length === 1, 'dono vê a própria categoria', r.data);
  r = await ana.call('DELETE', '/rest/v1/personal_categories?name=eq.Casa', { headers: { Prefer: 'return=representation' } });
  ok(Array.isArray(r.data) && r.data.length === 0, 'categoria pessoal não pode ser apagada (como no original)', r.data);

  // usuários: funcionário só vê o próprio cadastro
  r = await ana.call('GET', '/rest/v1/user_credentials?select=username');
  ok(r.data.length === 1 && r.data[0].username === 'ana', 'funcionário só vê o próprio usuário', r.data);
  r = await adm.call('GET', '/rest/v1/user_credentials?select=username');
  ok(r.data.length === 4, 'admin vê todos os usuários', r.data);
  r = await ana.call('POST', '/rest/v1/user_roles', { body: { user_id: '00000000-0000-0000-0000-000000000000', role: 'admin' } });
  ok(r.status === 403, 'funcionário não se promove a admin', r.data);
}
