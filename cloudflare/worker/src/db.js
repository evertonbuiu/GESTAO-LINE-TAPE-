// Acesso ao Cloudflare D1.
//
// As regras automáticas (gatilhos) que no PostgreSQL usavam auth.uid() leem o
// usuário da requisição na tabela _ctx. Toda escrita roda dentro de um batch do
// D1 (que é uma transação única): grava o contexto, executa os comandos e limpa
// o contexto, então gatilhos sempre veem o usuário certo.
import { ApiError } from './util.js';

export class Db {
  constructor(d1, ctx = {}) {
    this.d1 = d1;
    this.ctx = ctx; // { uid, role, email }
  }

  withCtx(ctx) {
    return new Db(this.d1, ctx);
  }

  async all(sql, params = []) {
    try {
      const r = await this.d1.prepare(sql).bind(...params).all();
      return r.results || [];
    } catch (e) {
      throw mapSqlError(e, sql);
    }
  }

  async first(sql, params = []) {
    const rows = await this.all(sql, params);
    return rows[0] ?? null;
  }

  /**
   * Executa vários comandos numa transação, com o contexto do usuário.
   * statements: [{ sql, params, rows: boolean }]
   * Retorna os resultados (linhas) de cada comando, na mesma ordem.
   */
  async tx(statements) {
    const ctxRows = [
      ['uid', this.ctx.uid ?? null],
      ['role', this.ctx.role ?? null],
      ['email', this.ctx.email ?? null],
      ['service', this.ctx.service ? '1' : null],
    ];
    const pre = [this.d1.prepare('DELETE FROM _ctx')];
    for (const [k, v] of ctxRows) {
      if (v != null) pre.push(this.d1.prepare('INSERT INTO _ctx (k, v) VALUES (?, ?)').bind(k, String(v)));
    }
    const main = statements.map((s) => this.d1.prepare(s.sql).bind(...(s.params || [])));
    const post = [this.d1.prepare('DELETE FROM _ctx')];
    let results;
    try {
      results = await this.d1.batch([...pre, ...main, ...post]);
    } catch (e) {
      throw mapSqlError(e, statements.map((s) => s.sql).join(' ; '));
    }
    return results.slice(pre.length, pre.length + main.length).map((r) => r.results || []);
  }

  async run(sql, params = []) {
    const [rows] = await this.tx([{ sql, params }]);
    return rows;
  }
}

/** Converte erros do SQLite nos códigos que o app conhece do PostgreSQL. */
export function mapSqlError(e, sql = '') {
  if (e instanceof ApiError) return e;
  const msg = String((e && (e.cause?.message || e.message)) || e);
  let m;
  if ((m = msg.match(/UNIQUE constraint failed: ([\w.]+(?:, [\w.]+)*)/))) {
    return new ApiError(409, '23505', `duplicate key value violates unique constraint`, `Key (${m[1]}) already exists.`);
  }
  if (/FOREIGN KEY constraint failed/.test(msg)) {
    return new ApiError(409, '23503', 'insert or update on table violates foreign key constraint', msg);
  }
  if ((m = msg.match(/NOT NULL constraint failed: ([\w.]+)/))) {
    const col = m[1].split('.').pop();
    return new ApiError(400, '23502', `null value in column "${col}" violates not-null constraint`, msg);
  }
  if ((m = msg.match(/CHECK constraint failed: (\S+)/))) {
    return new ApiError(400, '23514', `new row violates check constraint "${m[1]}"`, msg);
  }
  // RAISE(ABORT, 'P0001:mensagem') vindo das regras automáticas
  if ((m = msg.match(/(P0001|42501|23514|23505|22023|P0002):(.*?)(?::\s*SQLITE_CONSTRAINT.*)?$/s))) {
    const code = m[1];
    const status = code === '42501' ? 403 : 400;
    return new ApiError(status, code, m[2].trim());
  }
  if (/no such column/.test(msg)) {
    return new ApiError(400, '42703', msg.replace(/^.*?no such column/, 'column does not exist'));
  }
  if (/no such table/.test(msg)) {
    return new ApiError(404, '42P01', msg);
  }
  console.error('SQL falhou:', msg, sql.slice(0, 500));
  return new ApiError(500, 'XX000', msg);
}
