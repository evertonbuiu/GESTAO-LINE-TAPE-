// Substituto do Supabase Realtime.
//
// Cada tabela tem gatilhos (gerados no esquema) que gravam em _changes um
// número de versão sempre que algo muda — inclusive mudanças feitas pelas
// regras automáticas. O app consulta GET /realtime/v1/changes?since=N a cada
// poucos segundos e atualiza as telas abertas quando alguma tabela mudou.
import { json } from './util.js';

export function afterWrite() {
  // As alterações já são registradas pelos gatilhos do banco.
}

export async function handleChanges(request, db) {
  const url = new URL(request.url);
  const since = Number(url.searchParams.get('since') || 0);
  const rows = await db.all('SELECT tbl, version, changed_at FROM _changes WHERE version > ? ORDER BY version', [since]);
  const top = await db.first('SELECT COALESCE(MAX(version), 0) AS v FROM _changes');
  return json({ version: top ? top.v : 0, changes: rows.map((r) => ({ table: r.tbl, version: r.version, at: r.changed_at })) });
}
