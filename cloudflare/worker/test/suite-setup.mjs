// Criação do primeiro administrador.
export default async function ({ setup, client, ok }) {
  const { env } = await setup();
  env.SETUP_TOKEN = 'token-de-configuracao';
  const c = client(env);
  let r = await c.call('POST', '/setup/first-admin', { body: { token: 'errado', username: 'admin', password: 'senha123' } });
  ok(r.status === 403, 'token errado é recusado', r.data);
  r = await c.call('POST', '/setup/first-admin', { body: { token: 'token-de-configuracao', username: 'Admin', password: 'senha123', name: 'Everton' } });
  ok(r.status === 200 && r.data.ok, 'primeiro admin criado', r.data);
  const s = await c.login('admin');
  ok(s.access_token, 'admin entra', s);
  r = await c.call('GET', '/rest/v1/user_roles?select=role');
  ok(r.data.length === 1 && r.data[0].role === 'admin', 'papel admin', r.data);
  r = await c.call('POST', '/setup/first-admin', { body: { token: 'token-de-configuracao', username: 'outro', password: 'senha123' } });
  ok(r.status === 409, 'não cria segundo admin pela configuração', r.data);
}
