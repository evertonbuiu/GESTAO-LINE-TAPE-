// Funções do banco chamadas pelo app com supabase.rpc(...).
// Cada uma reproduz a lógica da função PL/pgSQL original.
import { ApiError, json, readJson } from './util.js';
import { hasPermission } from './policies.js';
import { syncBankTransactionsSql, updateAllBalancesSql } from './rules/bank.js';

const RPC = {
  // has_permission(_user_id, _permission_name, _access_type)
  async has_permission(db, ctx, args) {
    const uid = args._user_id || ctx.uid;
    if (!uid) return false;
    if (uid === ctx.uid) return hasPermission(ctx, args._permission_name, args._access_type || 'view');
    const role = await db.first('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1', [uid]);
    if (!role) return false;
    if (role.role === 'admin') return true;
    const col = (args._access_type || 'view') === 'view' ? 'can_view' : 'can_edit';
    const r = await db.first(
      `SELECT rp.${col} AS ok FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = ? AND p.name = ?`,
      [role.role, args._permission_name],
    );
    return !!(r && r.ok);
  },

  async has_role(db, ctx, args) {
    const r = await db.first('SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = ?', [args._user_id, args._role]);
    return !!r;
  },

  async get_user_role(db, ctx, args) {
    const r = await db.first('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1', [args._user_id]);
    return r ? r.role : null;
  },

  async is_current_user_admin(db, ctx) {
    return ctx.roles.has('admin');
  },

  async current_user_has_any_role(db, ctx, args) {
    return (args._roles || []).some((r) => ctx.roles.has(r));
  },

  // next_quote_number(): '#001', '#002', ... sem repetir números existentes
  async next_quote_number(db) {
    for (let attempts = 0; attempts < 1000; attempts++) {
      const [rows] = await db.tx([
        {
          sql: `INSERT INTO _sequences (name, value) VALUES ('quote_number_seq',
                  COALESCE((SELECT MAX(CAST(NULLIF(REPLACE(REPLACE(quote_number, '#', ''), ' ', ''), '') AS INTEGER)) FROM external_quotes), 0) + 1)
                ON CONFLICT (name) DO UPDATE SET value = value + 1
                RETURNING value`,
        },
      ]);
      const n = rows[0].value;
      const candidate = '#' + String(n).padStart(3, '0');
      const used = await db.first('SELECT 1 AS x FROM external_quotes WHERE quote_number = ?', [candidate]);
      if (!used) return candidate;
    }
    throw new ApiError(400, 'P0001', 'Não foi possível gerar um número de orçamento único');
  },

  // sync_bank_transactions(): recria os lançamentos automáticos e saldos.
  // O original engolia erros (RAISE WARNING); aqui também.
  async sync_bank_transactions(db) {
    try {
      await db.tx(syncBankTransactionsSql());
    } catch (e) {
      console.warn('Error in sync_bank_transactions:', e.message);
    }
    return null;
  },

  // force_sync_all_balances(): sincroniza e devolve o resumo por conta
  async force_sync_all_balances(db) {
    try {
      await db.tx(syncBankTransactionsSql());
    } catch (e) {
      console.warn('Error in sync_bank_transactions:', e.message);
    }
    const before = await db.all('SELECT id, name, balance FROM bank_accounts');
    await db.tx(updateAllBalancesSql());
    const out = [];
    for (const acc of before) {
      const r = await db.first(
        `SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) AS inc,
                COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS exp,
                COUNT(*) AS n
           FROM bank_transactions WHERE bank_account_id = ?`,
        [acc.id],
      );
      out.push({
        account_name: acc.name,
        old_balance: acc.balance,
        new_balance: Math.round((r.inc - r.exp) * 100) / 100,
        income_total: r.inc,
        expense_total: r.exp,
        transaction_count: r.n,
      });
    }
    return out;
  },
};

export async function handleRpc(request, env, db, ctx, name) {
  const fn = RPC[name];
  if (!fn) {
    throw new ApiError(404, 'PGRST202', `Could not find the function public.${name} in the schema cache`);
  }
  if (!ctx.uid && !ctx.service) throw new ApiError(401, '42501', 'permission denied for function ' + name);
  let args = {};
  if (request.method === 'GET') {
    for (const [k, v] of new URL(request.url).searchParams) args[k] = v;
  } else {
    args = (await readJson(request)) || {};
  }
  const result = await fn(db, ctx, args, env);
  return json(result === undefined ? null : result);
}
