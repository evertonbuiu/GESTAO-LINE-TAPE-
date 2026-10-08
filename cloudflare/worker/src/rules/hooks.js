// Partes das regras automáticas que alteravam a própria linha antes de gravar
// (NEW.campo := ... em gatilhos BEFORE do PostgreSQL). O SQLite não permite
// isso dentro de gatilhos, então o Worker aplica antes de gravar.
import { HOOKS } from '../generated/hooks.js';
import { ApiError, nowIso } from '../util.js';

export function hooksFor(table) {
  return HOOKS[table] || {};
}

/** Ajusta o objeto que vai ser inserido. */
export function beforeInsert(ctx, table, row) {
  const h = hooksFor(table);
  if (h.personalOwner) {
    // force_personal_owner
    row.owner_id = ctx.uid ?? row.owner_id ?? null;
    if (!row.owner_id) throw new ApiError(400, 'P0001', 'owner_id obrigatorio');
  }
  if (h.closingActor) {
    // force_closing_actor
    row.closed_by = ctx.uid ?? null;
    row.created_at = nowIso();
  }
  if (h.reconciliationActor) {
    // force_reconciliation_actor
    row.reconciled_by = ctx.uid ?? null;
    row.updated_at = nowIso();
    row.created_at = nowIso();
  }
  return row;
}

/** Ajusta o objeto de alteração (igual para todas as linhas). */
export function beforeUpdate(ctx, table, patch) {
  const h = hooksFor(table);
  if (h.updatedAt) patch.updated_at = nowIso(); // update_updated_at_column e similares
  if (h.personalOwner) delete patch.owner_id; // force_personal_owner: dono não muda
  if (h.reconciliationActor) {
    patch.reconciled_by = ctx.uid ?? null;
    patch.updated_at = nowIso();
  }
  return patch;
}

/** A alteração depende dos valores antigos de cada linha? */
export function needsPerRowUpdate(table) {
  return !!hooksFor(table).contractSign;
}

/**
 * enforce_signed_contract_immutability (parte que altera NEW):
 * ao passar para "assinado" trava o contrato e registra signed_at;
 * contrato já travado continua travado.
 */
export function perRowPatch(ctx, table, oldRow, patch) {
  const h = hooksFor(table);
  const p = { ...patch };
  if (h.contractSign) {
    const newStatus = 'status' in p ? p.status : oldRow.status;
    const wasLocked = !!oldRow.locked || oldRow.status === 'assinado';
    if (newStatus === 'assinado' && oldRow.status !== 'assinado') {
      p.locked = true;
      const signed = 'signed_at' in p ? p.signed_at : oldRow.signed_at;
      if (signed == null) p.signed_at = nowIso();
    }
    if (wasLocked) p.locked = true;
  }
  return p;
}
