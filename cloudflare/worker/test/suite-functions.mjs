// Funções de servidor portadas (criação/gestão de usuários, aprovação de orçamento).
export default async function ({ setup, client, ok }) {
  const { env, d1, mkUser } = await setup();
  env.SERVICE_ROLE_KEY = 'service-key-teste';
  env.ANON_KEY = 'anon-key-teste';
  await mkUser('admin', 'admin');
  await mkUser('ana', 'funcionario');
  const c = client(env);
  await c.login('admin');

  // create-employee: cria login + cadastro + papel
  let r = await c.call('POST', '/functions/v1/create-employee', { body: { username: 'joao', password: 'segredo1', name: 'João', role: 'deposito' } });
  ok(r.status === 200 && r.data.user && r.data.user.username === 'joao', 'create-employee cria usuário', r.data);
  const role = await d1.prepare("SELECT ur.role FROM user_roles ur JOIN user_credentials uc ON uc.id = ur.user_id WHERE uc.username = 'joao'").first();
  ok(role && role.role === 'deposito', 'papel gravado', role);
  const j = client(env);
  const s = await j.login('joao', 'segredo1').catch((e) => ({ error: e.message }));
  ok(s.access_token, 'novo funcionário consegue entrar', s);

  // funcionário comum não cria usuários
  const ana = client(env);
  await ana.login('ana');
  r = await ana.call('POST', '/functions/v1/create-employee', { body: { username: 'x', password: 'segredo1', name: 'X' } });
  ok(r.status >= 400, 'funcionário não cria usuário', r.data);

  // manage-employee: trocar senha / desativar
  const joaoId = s.user && s.user.id;
  if (joaoId) {
    r = await c.call('POST', '/functions/v1/manage-employee', { body: { action: 'update', user_id: joaoId, password: 'nova-senha-1' } });
    ok(r.status === 200, 'manage-employee troca a senha', r.data);
    const j2 = client(env);
    const s2 = await j2.login('joao', 'nova-senha-1').catch((e) => ({ error: e.message }));
    ok(s2.access_token, 'entra com a senha nova', s2);
    r = await c.call('POST', '/functions/v1/manage-employee', { body: { action: 'update', user_id: joaoId, is_active: false } });
    const s3 = await client(env).login('joao', 'nova-senha-1').catch((e) => ({ error: e.message }));
    ok(r.status === 200 && s3.error, 'usuário desativado não entra', [r.data, s3]);
  }

  // função inexistente
  r = await c.call('POST', '/functions/v1/nao-existe', { body: {} });
  ok(r.status === 404, 'função inexistente = 404', r.data);
}
