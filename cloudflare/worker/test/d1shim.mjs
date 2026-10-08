// Simulador local do Cloudflare D1 usando o SQLite embutido do Node (node:sqlite).
// Usado só nos testes: o D1 real também é SQLite, com a mesma API.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

class Stmt {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }
  bind(...params) {
    const s = new Stmt(this.db, this.sql);
    s.params = params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
    return s;
  }
  _exec() {
    const st = this.db.prepare(this.sql);
    const returnsRows = /^\s*(SELECT|WITH|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql);
    if (returnsRows) {
      const rows = st.all(...this.params).map((r) => ({ ...r }));
      return { results: rows, success: true, meta: {} };
    }
    const info = st.run(...this.params);
    return { results: [], success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
  }
  async all() {
    return this._exec();
  }
  async run() {
    return this._exec();
  }
  async first(col) {
    const r = this._exec().results[0] ?? null;
    return col && r ? r[col] : r;
  }
}

export class D1Shim {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON');
  }
  prepare(sql) {
    return new Stmt(this.db, sql);
  }
  async batch(stmts) {
    this.db.exec('BEGIN');
    try {
      const out = stmts.map((s) => s._exec());
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  async exec(sql) {
    this.db.exec(sql);
  }
  applyFile(path) {
    this.db.exec(readFileSync(path, 'utf8'));
  }
}
