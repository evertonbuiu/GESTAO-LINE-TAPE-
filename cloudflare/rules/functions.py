"""Tradução das funções de gatilho do PostgreSQL para o Cloudflare D1 (SQLite).

Cada função PL/pgSQL original vira, por operação (INSERT/UPDATE/DELETE),
uma lista de comandos SQLite que rodam dentro de um gatilho com o mesmo nome.

Marcadores aceitos nos textos:
  {T}         nome da tabela do gatilho
  {UID}       usuário logado na requisição (antes: auth.uid())
  {UNAME}     nome do usuário logado (user_credentials.name)
  {NOW}       data/hora atual em UTC (antes: now())
  {NEWJSON}   linha nova em JSON (antes: to_jsonb(NEW))
  {OLDJSON}   linha antiga em JSON (antes: to_jsonb(OLD))
  {CHANGED}   JSON com os nomes das colunas alteradas
  {ANY_CHANGED} verdadeiro se alguma coluna mudou
Funções que alteram a própria linha antes de gravar (NEW.x := ...) não têm
equivalente em gatilho SQLite; elas viram "ganchos" do Worker (WORKER).

As mensagens de erro são as mesmas do original, sem os valores variáveis
(o SQLite só aceita texto fixo em RAISE).
"""

WORKER = "worker"


def R(msg):
    """Equivalente a RAISE EXCEPTION com mensagem fixa."""
    return "SELECT RAISE(ABORT, 'P0001:" + msg.replace("'", "''") + "')"


def RW(cond, msg):
    """RAISE condicional (SELECT RAISE ... WHERE cond)."""
    return R(msg) + " WHERE " + cond


def BAL(acct):
    """Saldo de uma conta pela soma das transações (income - expense)."""
    return (
        "(SELECT COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) - "
        "COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) "
        f"FROM bank_transactions WHERE bank_account_id = {acct})"
    )


def INS_BT(acct, desc, amount, ttype, category, ref_type, ref_id, date, where=None):
    s = (
        "INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category, "
        "reference_type, reference_id, transaction_date) "
        f"SELECT {acct}, {desc}, {amount}, '{ttype}', {category}, '{ref_type}', {ref_id}, {date}"
    )
    if where:
        s += f" WHERE {where}"
    return s


def DEL_BT(ref_type, ref_id, where=None):
    s = f"DELETE FROM bank_transactions WHERE reference_type = '{ref_type}' AND reference_id = {ref_id}"
    if where:
        s += f" AND ({where})"
    return s


AUDIT_INSERT = (
    "INSERT INTO audit_logs (actor_id, actor_name, action, entity_type, entity_id, old_data, new_data) "
    "VALUES ({UID}, {UNAME}, '%s', '{T}', %s, %s, %s)"
)

# ---------------------------------------------------------------------------
# Reconciliação da equipe do evento a partir das diárias
# (reconcile_daily_rate_event_team, chamada por sync_event_team_from_daily_rate)
# ---------------------------------------------------------------------------


def reconcile(E, W, N):
    guard = f"{E} IS NOT NULL AND NULLIF(trim({N}), '') IS NOT NULL"
    first_rate = (
        "(SELECT * FROM daily_rates dr WHERE dr.event_id = {E} AND "
        "(({W} IS NOT NULL AND dr.worker_id = {W}) OR lower(trim(dr.worker_name)) = lower(trim({N}))) "
        "ORDER BY dr.date, dr.created_at, dr.id LIMIT 1)"
    ).format(E=E, W=W, N=N)
    manual_exists = (
        "EXISTS (SELECT 1 FROM event_collaborators ec WHERE ec.event_id = {E} "
        "AND ec.reference_type IS NOT 'daily_rate' AND ("
        "(COALESCE(r.worker_id, {W}) IS NOT NULL AND ec.worker_id = COALESCE(r.worker_id, {W})) "
        "OR lower(trim(ec.collaborator_name)) = lower(trim(r.worker_name))))"
    ).format(E=E, W=W)
    return [
        "DELETE FROM event_collaborators WHERE {g} AND event_id = {E} AND reference_type = 'daily_rate' AND ("
        "({W} IS NOT NULL AND worker_id = {W}) OR lower(trim(collaborator_name)) = lower(trim({N})))".format(
            g=guard, E=E, W=W, N=N
        ),
        "INSERT INTO event_collaborators (event_id, collaborator_name, collaborator_email, role, reference_type, "
        "reference_id, assigned_by, worker_id, collaborator_id, person_type) "
        "SELECT {E}, r.worker_name, COALESCE((SELECT COALESCE(w.email, '') FROM workers w "
        "WHERE w.id = COALESCE(r.worker_id, {W}) LIMIT 1), ''), "
        "COALESCE(NULLIF(trim(r.event_role), ''), 'diarista'), 'daily_rate', r.id, r.created_by, "
        "COALESCE(r.worker_id, {W}), NULL, 'worker' "
        "FROM {fr} r WHERE {g} AND NOT {me}".format(E=E, W=W, fr=first_rate, g=guard, me=manual_exists),
    ]


# ---------------------------------------------------------------------------
# Estoque de equipamentos
# ---------------------------------------------------------------------------


def stock(name):
    rented = (
        f"(SELECT COALESCE(SUM(quantity), 0) FROM event_equipment WHERE equipment_name = {name} "
        "AND status IN ('confirmed', 'active', 'pending', 'allocated'))"
    )
    returned = (
        f"(SELECT COALESCE(SUM(quantity), 0) FROM event_equipment WHERE equipment_name = {name} AND status = 'returned')"
    )
    maint = (
        f"(SELECT COALESCE(SUM(quantity), 0) FROM maintenance_records WHERE equipment_name = {name} "
        "AND status IN ('agendada', 'em_andamento'))"
    )
    net = f"max(0, {rented} - {returned})"
    avail = f"(total_stock - {net} - {maint})"
    return [
        f"UPDATE equipment SET rented = {net}, available = {avail}, "
        f"status = CASE WHEN {avail} <= 0 THEN 'out_of_stock' WHEN {avail} <= total_stock * 0.2 THEN 'low_stock' "
        "ELSE 'available' END, updated_at = {NOW} "
        f"WHERE id = (SELECT id FROM equipment WHERE name = {name} LIMIT 1)"
    ]


def maintenance(name):
    maint = (
        f"(SELECT COALESCE(SUM(quantity), 0) FROM maintenance_records WHERE equipment_name = {name} "
        "AND status IN ('agendada', 'em_andamento'))"
    )
    avail = f"(total_stock - rented - {maint})"
    return [
        f"UPDATE equipment SET available = {avail}, "
        f"status = CASE WHEN {avail} <= 0 THEN 'out_of_stock' WHEN {avail} <= total_stock * 0.2 THEN 'low_stock' "
        "ELSE 'available' END, updated_at = {NOW} "
        f"WHERE id = (SELECT id FROM equipment WHERE name = {name} LIMIT 1)"
    ]


def event_totals(eid):
    s = f"(SELECT COALESCE(SUM(total_price), 0) FROM event_expenses WHERE event_id = {eid})"
    return [f"UPDATE events SET total_expenses = {s}, profit_margin = total_budget - {s}, updated_at = {{NOW}} WHERE id = {eid}"]


def balance_update(acct, current=True):
    sets = f"balance = round({BAL(acct)}, 2)"
    if current:
        sets += f", current_balance = round({BAL(acct)}, 2)"
    return [f"UPDATE bank_accounts SET {sets}, updated_at = {{NOW}} WHERE id = {acct}"]


# Situações permitidas nas transições (finance_title_guard etc.)
def transition_not_ok(old, new, table):
    cases = " ".join(f"WHEN '{frm}' THEN {new} IN ({', '.join(repr(t) for t in tos)})" for frm, tos in table)
    return f"NOT (CASE {old} {cases} ELSE 0 END)"


TITLE_TRANSITIONS = [
    ("rascunho", ["pendente", "cancelado"]),
    ("pendente", ["aprovado", "pago", "cancelado"]),
    ("aprovado", ["pago", "cancelado"]),
    ("pago", ["estornado"]),
]
INSTALLMENT_TRANSITIONS = [
    ("pendente", ["parcial", "pago", "cancelado"]),
    ("parcial", ["pago", "cancelado"]),
    ("pago", ["parcial", "pendente"]),
]
FISCAL_TRANSITIONS = [
    ("rascunho", ["validado", "cancelado"]),
    ("validado", ["rascunho", "aguardando_assinatura", "enviado", "cancelado"]),
    ("aguardando_assinatura", ["validado", "enviado", "rejeitado", "cancelado"]),
    ("enviado", ["autorizado", "rejeitado", "cancelado"]),
    ("rejeitado", ["rascunho", "validado", "enviado", "cancelado"]),
    ("autorizado", ["cancelado", "encerrado"]),
]


def digits(expr, n):
    return f"(length({expr}) = {n} AND {expr} NOT GLOB '*[^0-9]*')"


def distinct_any(cols):
    return "(" + " OR ".join(f"NEW.{c} IS NOT OLD.{c}" for c in cols) + ")"


# ---------------------------------------------------------------------------
# Mapa função -> tradução
# ---------------------------------------------------------------------------

FUNCS = {
    # -- ganchos do Worker (alteram a própria linha antes de gravar) --
    "update_updated_at_column": WORKER,
    "touch_personal_updated_at": WORKER,
    "update_whatsapp_expenses_updated_at": WORKER,
    "update_bank_card_transactions_updated_at": WORKER,
    "force_personal_owner": WORKER,
    "force_closing_actor": WORKER,
    "force_reconciliation_actor": WORKER,
    # Sincronização automática de lançamentos: o original rodava
    # sync_bank_transactions() a cada alteração e ignorava erros; aqui o Worker
    # roda a mesma sincronização logo após gravar (e também ignora erros).
    "auto_sync_transactions_on_event_change": WORKER,
    "auto_sync_transactions_on_expense_change": WORKER,
    "auto_sync_transactions_on_company_expense_change": WORKER,
    "auto_sync_transactions_on_recurring_expense_change": WORKER,
    "sync_transactions_on_event_change": WORKER,
    "sync_transactions_on_expense_change": WORKER,
    # gatilho em auth.users que não roda no sistema atual (ver README)
    "handle_new_user": WORKER,
    # -- auditoria --
    "record_audit_log": {
        "INSERT": [AUDIT_INSERT % ("INSERT", "NEW.id", "NULL", "{NEWJSON}")],
        "UPDATE": {"when": "{OLDJSON} IS NOT {NEWJSON}", "do": [AUDIT_INSERT % ("UPDATE", "NEW.id", "{OLDJSON}", "{NEWJSON}")]},
        "DELETE": [AUDIT_INSERT % ("DELETE", "OLD.id", "{OLDJSON}", "NULL")],
    },
    "record_ledger_extra_audit": {
        "INSERT": [AUDIT_INSERT % ("INSERT", "NEW.id", "NULL", "json_object('redacted', json('true'))")],
        "UPDATE": [AUDIT_INSERT % ("UPDATE", "NEW.id", "NULL", "json_object('redacted', json('true'))")],
        "DELETE": [AUDIT_INSERT % ("DELETE", "OLD.id", "NULL", "json_object('redacted', json('true'))")],
    },
    "record_finance_audit": {
        "INSERT": [AUDIT_INSERT % ("INSERT", "NEW.id", "NULL", "json_object('changed_fields', json('[]'), 'redacted', json('true'))")],
        "UPDATE": {
            "when": "{ANY_CHANGED}",
            "do": [AUDIT_INSERT % ("UPDATE", "NEW.id", "NULL", "json_object('changed_fields', json({CHANGED}), 'redacted', json('true'))")],
        },
    },
    "record_sensitive_data_audit": {
        "INSERT": [AUDIT_INSERT % ("INSERT", "NEW.id", "NULL",
                   "json_object('person_type', NEW.person_type, 'person_id', NEW.person_id, 'changed_fields', json('[]'), 'redacted', json('true'))")],
        "UPDATE": {
            "when": distinct_any(["cpf", "rg", "pix_key", "pix_key_type", "bank_name", "bank_agency", "bank_account", "bank_account_type", "account_holder_name"]),
            "do": [AUDIT_INSERT % ("UPDATE", "NEW.id", "NULL",
                   "json_object('person_type', NEW.person_type, 'person_id', NEW.person_id, 'changed_fields', "
                   "(SELECT json_group_array(c) FROM (" + " UNION ALL ".join(
                       f"SELECT '{c}' AS c WHERE NEW.{c} IS NOT OLD.{c}" for c in
                       ["cpf", "rg", "pix_key", "pix_key_type", "bank_name", "bank_agency", "bank_account", "bank_account_type", "account_holder_name"]
                   ) + ")), 'redacted', json('true'))")],
        },
        "DELETE": [AUDIT_INSERT % ("DELETE", "OLD.id", "NULL",
                   "json_object('person_type', OLD.person_type, 'person_id', OLD.person_id, 'changed_fields', json('[]'), 'redacted', json('true'))")],
    },
    "record_contract_history": {
        "INSERT": [
            "INSERT INTO contract_history (contract_id, action, from_status, to_status, actor_id, actor_name) "
            "VALUES (NEW.id, 'created', NULL, NEW.status, {UID}, {UNAME})"
        ],
        "UPDATE": {
            "when": "{OLDJSON} IS NOT {NEWJSON}",
            "do": [
                "INSERT INTO contract_history (contract_id, action, from_status, to_status, actor_id, actor_name, changes) "
                "VALUES (NEW.id, CASE WHEN NEW.status IS NOT OLD.status THEN 'status_changed' ELSE 'updated' END, "
                "OLD.status, NEW.status, {UID}, {UNAME}, json_object('total_value', NEW.total_value, "
                "'template_version', NEW.template_version, 'locked', CASE WHEN NEW.locked IS NULL THEN NULL "
                "WHEN NEW.locked THEN json('true') ELSE json('false') END))"
            ],
        },
    },
    "record_fiscal_document_event": {
        "INSERT": [
            "INSERT INTO fiscal_document_events (document_id, action, from_status, to_status, actor_id, actor_name) "
            "VALUES (NEW.id, 'created', NULL, NEW.status, {UID}, "
            "(SELECT p.name FROM profiles p WHERE p.user_id = {UID} LIMIT 1))"
        ],
        "UPDATE": {
            "when": "NEW.status IS NOT OLD.status",
            "do": [
                "INSERT INTO fiscal_document_events (document_id, action, from_status, to_status, actor_id, actor_name, payload) "
                "VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, {UID}, "
                "(SELECT p.name FROM profiles p WHERE p.user_id = {UID} LIMIT 1), "
                "json_object('access_key', NEW.access_key, 'protocol_number', NEW.protocol_number, "
                "'authorization_source', NEW.authorization_source, 'environment', NEW.environment, 'redacted', json('true')))"
            ],
        },
    },
    # -- saldos bancários --
    # O original recalculava só a conta nova quando um lançamento mudava de
    # conta; aqui a conta antiga também é recalculada (evita saldo errado).
    "auto_update_account_balance_on_transaction": {
        "INSERT": balance_update("NEW.bank_account_id"),
        "UPDATE": balance_update("NEW.bank_account_id") + [
            s + " AND OLD.bank_account_id IS NOT NEW.bank_account_id" for s in balance_update("OLD.bank_account_id")
        ],
        "DELETE": balance_update("OLD.bank_account_id"),
    },
    "update_account_balance_on_transaction_change": {
        "INSERT": balance_update("NEW.bank_account_id", current=False),
        "UPDATE": balance_update("COALESCE(NEW.bank_account_id, OLD.bank_account_id)", current=False),
        "DELETE": balance_update("OLD.bank_account_id", current=False),
    },
    "prevent_duplicate_bank_transaction_reference": {
        "INSERT": [RW(
            "NEW.reference_type IS NOT NULL AND NEW.reference_id IS NOT NULL AND EXISTS (SELECT 1 FROM bank_transactions bt "
            "WHERE bt.reference_type = NEW.reference_type AND bt.reference_id = NEW.reference_id AND bt.id <> NEW.id)",
            "Já existe lançamento bancário para esta origem.",
        )],
        "UPDATE": {
            "when": "NOT (NEW.reference_type IS OLD.reference_type AND NEW.reference_id IS OLD.reference_id)",
            "do": [RW(
                "NEW.reference_type IS NOT NULL AND NEW.reference_id IS NOT NULL AND EXISTS (SELECT 1 FROM bank_transactions bt "
                "WHERE bt.reference_type = NEW.reference_type AND bt.reference_id = NEW.reference_id AND bt.id <> NEW.id)",
                "Já existe lançamento bancário para esta origem.",
            )],
        },
    },
    "enforce_bank_period_closing": {
        "INSERT": [RW(
            "EXISTS (SELECT 1 FROM bank_account_closings c WHERE c.bank_account_id = NEW.bank_account_id AND NEW.transaction_date <= c.closed_through)",
            "Período já fechado para esta conta na data informada.",
        )],
        "UPDATE": [
            RW(
                "EXISTS (SELECT 1 FROM bank_account_closings c WHERE c.bank_account_id = OLD.bank_account_id AND OLD.transaction_date <= c.closed_through)",
                "Período já fechado para esta conta até a data do lançamento original.",
            ),
            RW(
                "EXISTS (SELECT 1 FROM bank_account_closings c WHERE c.bank_account_id = NEW.bank_account_id AND NEW.transaction_date <= c.closed_through)",
                "Período já fechado para esta conta na data informada.",
            ),
        ],
        "DELETE": [RW(
            "EXISTS (SELECT 1 FROM bank_account_closings c WHERE c.bank_account_id = OLD.bank_account_id AND OLD.transaction_date <= c.closed_through)",
            "Período já fechado para esta conta até a data do lançamento original.",
        )],
    },
    "enforce_closing_immutability": {
        "UPDATE": [R("Fechamento de período é imutável (UPDATE bloqueado).")],
        "DELETE": [R("Fechamento de período é imutável (DELETE bloqueado).")],
    },
    # -- adiantamentos e vales (lançamentos bancários automáticos) --
    "create_bank_transaction_for_advance": {
        "INSERT": [INS_BT("NEW.bank_account_id", "'Adiantamento - ' || NEW.worker_name", "NEW.amount", "expense",
                          "'Adiantamentos de Diaristas'", "worker_advance", "NEW.id", "NEW.advance_date")],
    },
    "update_bank_transaction_for_advance": {
        "UPDATE": [
            "UPDATE bank_transactions SET bank_account_id = NEW.bank_account_id, description = 'Adiantamento - ' || NEW.worker_name, "
            "amount = NEW.amount, transaction_date = NEW.advance_date, updated_at = {NOW} "
            "WHERE reference_type = 'worker_advance' AND reference_id = NEW.id"
        ],
    },
    "delete_bank_transaction_for_advance": {"DELETE": [DEL_BT("worker_advance", "OLD.id")]},
    "create_bank_transaction_for_worker_advance": {
        "INSERT": [INS_BT("NEW.bank_account_id", "'Vale Diarista: ' || NEW.worker_name", "NEW.amount", "expense",
                          "'Vale Diarista'", "worker_advance", "NEW.id", "NEW.advance_date", where="NEW.bank_account_id IS NOT NULL")],
    },
    "update_bank_transaction_for_worker_advance": {
        "UPDATE": [
            DEL_BT("worker_advance", "OLD.id", where="OLD.bank_account_id IS NOT NULL"),
            INS_BT("NEW.bank_account_id", "'Vale Diarista: ' || NEW.worker_name", "NEW.amount", "expense",
                   "'Vale Diarista'", "worker_advance", "NEW.id", "NEW.advance_date", where="NEW.bank_account_id IS NOT NULL"),
        ],
    },
    "delete_bank_transaction_for_worker_advance": {"DELETE": [DEL_BT("worker_advance", "OLD.id")]},
    "create_bank_transaction_for_worker_vale": {
        "INSERT": [INS_BT("NEW.bank_account_id", "'Vale - ' || NEW.worker_name", "NEW.amount", "expense",
                          "'Vales de Diaristas'", "worker_vale", "NEW.id", "NEW.advance_date")],
    },
    "update_bank_transaction_for_worker_vale": {
        "UPDATE": [
            "UPDATE bank_transactions SET bank_account_id = NEW.bank_account_id, description = 'Vale - ' || NEW.worker_name, "
            "amount = NEW.amount, transaction_date = NEW.advance_date, updated_at = {NOW} "
            "WHERE reference_type = 'worker_vale' AND reference_id = NEW.id"
        ],
    },
    "delete_bank_transaction_for_worker_vale": {"DELETE": [DEL_BT("worker_vale", "OLD.id")]},
    "create_bank_transaction_for_collaborator_vale": {
        "INSERT": [INS_BT("NEW.bank_account_id",
                          "'Vale - ' || COALESCE((SELECT name FROM collaborators WHERE id = NEW.collaborator_id), 'Colaborador')",
                          "NEW.amount", "expense", "'Vales de Colaboradores'", "collaborator_vale", "NEW.id", "NEW.advance_date")],
    },
    "update_bank_transaction_for_collaborator_vale": {
        "UPDATE": [
            "UPDATE bank_transactions SET bank_account_id = NEW.bank_account_id, description = 'Vale - ' || "
            "COALESCE((SELECT name FROM collaborators WHERE id = NEW.collaborator_id), 'Colaborador'), "
            "amount = NEW.amount, transaction_date = NEW.advance_date, updated_at = {NOW} "
            "WHERE reference_type = 'collaborator_vale' AND reference_id = NEW.id"
        ],
    },
    "delete_bank_transaction_for_collaborator_vale": {"DELETE": [DEL_BT("collaborator_vale", "OLD.id")]},
    "delete_bank_transaction_for_collaborator_expense_advance": {"DELETE": [DEL_BT("collaborator_advance", "OLD.id")]},
    "create_bank_transaction_for_worker_expense_advance": {
        "INSERT": [INS_BT("NEW.bank_account_id", "'Adiantamento de Despesa - ' || NEW.worker_name", "NEW.amount", "expense",
                          "'Adiantamentos de Despesas de Diaristas'", "worker_expense_advance", "NEW.id", "NEW.advance_date")],
    },
    "update_bank_transaction_for_worker_expense_advance": {
        "UPDATE": [
            "UPDATE bank_transactions SET bank_account_id = NEW.bank_account_id, description = 'Adiantamento de Despesa - ' || NEW.worker_name, "
            "amount = NEW.amount, transaction_date = NEW.advance_date, updated_at = {NOW} "
            "WHERE reference_type = 'worker_expense_advance' AND reference_id = NEW.id"
        ],
    },
    "delete_bank_transaction_for_worker_expense_advance": {"DELETE": [DEL_BT("worker_expense_advance", "OLD.id")]},
    "create_bank_transaction_for_recurring_expense_payment": {
        "INSERT": [INS_BT("NEW.bank_account_id",
                          "'Despesa Fixa - ' || COALESCE((SELECT name FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'N/A')",
                          "NEW.payment_amount", "expense",
                          "COALESCE((SELECT category FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'Despesas Fixas')",
                          "recurring_expense", "NEW.id", "NEW.payment_date", where="NEW.bank_account_id IS NOT NULL")],
    },
    "update_bank_transaction_for_recurring_expense_payment": {
        "UPDATE": [
            DEL_BT("recurring_expense", "OLD.id"),
            INS_BT("NEW.bank_account_id",
                   "'Despesa Fixa - ' || COALESCE((SELECT name FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'N/A')",
                   "NEW.payment_amount", "expense",
                   "COALESCE((SELECT category FROM recurring_expenses WHERE id = NEW.recurring_expense_id), 'Despesas Fixas')",
                   "recurring_expense", "NEW.id", "NEW.payment_date", where="NEW.bank_account_id IS NOT NULL"),
        ],
    },
    "delete_bank_transaction_for_recurring_expense_payment": {"DELETE": [DEL_BT("recurring_expense", "OLD.id")]},
    # -- diárias --
    "validate_daily_rate_fields": {
        **{op: [
            RW("NEW.attendance_status IS NOT NULL AND NEW.attendance_status NOT IN ('prevista','presente','falta','substituido','cancelada')",
               "Presença inválida. Use prevista, presente, falta, substituido ou cancelada."),
            RW("NEW.payment_status IS NOT NULL AND NEW.payment_status NOT IN ('pendente','aprovado','pago','cancelado')",
               "Status de pagamento inválido. Use pendente, aprovado, pago ou cancelado."),
            RW("COALESCE(NEW.overtime_amount, 0) < 0", "Hora extra não pode ser negativa."),
            RW("COALESCE(NEW.food_amount, 0) < 0", "Alimentação não pode ser negativa."),
            RW("COALESCE(NEW.transport_amount, 0) < 0", "Transporte não pode ser negativo."),
            RW("COALESCE(NEW.lodging_amount, 0) < 0", "Hospedagem não pode ser negativa."),
        ] for op in ("INSERT", "UPDATE")}
    },
    "create_event_expense_from_daily_rate": {
        "INSERT": [
            "INSERT INTO event_expenses (event_id, category, description, quantity, unit_price, total_price, expense_date, "
            "reference_type, reference_id, created_by) "
            "SELECT NEW.event_id, 'Diárias', 'Diária - ' || NEW.worker_name, 1, NEW.amount, NEW.amount, NEW.date, "
            "'daily_rate', NEW.id, NEW.created_by WHERE NEW.event_id IS NOT NULL AND NOT EXISTS "
            "(SELECT 1 FROM event_expenses WHERE reference_type = 'daily_rate' AND reference_id = NEW.id)"
        ],
    },
    "update_event_expense_from_daily_rate": {
        "UPDATE": [
            "UPDATE event_expenses SET event_id = NEW.event_id, description = 'Diária - ' || NEW.worker_name, "
            "unit_price = NEW.amount, total_price = NEW.amount, expense_date = NEW.date, updated_at = {NOW} "
            "WHERE reference_type = 'daily_rate' AND reference_id = NEW.id",
            "INSERT INTO event_expenses (event_id, category, description, quantity, unit_price, total_price, expense_date, "
            "reference_type, reference_id, created_by) "
            "SELECT NEW.event_id, 'Diárias', 'Diária - ' || NEW.worker_name, 1, NEW.amount, NEW.amount, NEW.date, "
            "'daily_rate', NEW.id, NEW.created_by WHERE NEW.event_id IS NOT NULL AND NOT EXISTS "
            "(SELECT 1 FROM event_expenses WHERE reference_type = 'daily_rate' AND reference_id = NEW.id)",
            "DELETE FROM event_expenses WHERE OLD.event_id IS NOT NULL AND NEW.event_id IS NULL "
            "AND reference_type = 'daily_rate' AND reference_id = NEW.id",
        ],
    },
    "delete_event_expense_from_daily_rate": {
        "DELETE": ["DELETE FROM event_expenses WHERE reference_type = 'daily_rate' AND reference_id = OLD.id"],
    },
    "create_event_collaborator_from_daily_rate": {
        "INSERT": [
            "INSERT INTO event_collaborators (event_id, collaborator_name, collaborator_email, role, reference_type, reference_id, assigned_by) "
            "SELECT NEW.event_id, NEW.worker_name, '', 'diarista', 'daily_rate', NEW.id, NEW.created_by "
            "WHERE NEW.event_id IS NOT NULL AND NOT EXISTS "
            "(SELECT 1 FROM event_collaborators WHERE reference_type = 'daily_rate' AND reference_id = NEW.id)"
        ],
    },
    "update_event_collaborator_from_daily_rate": {
        "UPDATE": [
            "UPDATE event_collaborators SET event_id = NEW.event_id, collaborator_name = NEW.worker_name, updated_at = {NOW} "
            "WHERE reference_type = 'daily_rate' AND reference_id = NEW.id",
            "INSERT INTO event_collaborators (event_id, collaborator_name, collaborator_email, role, reference_type, reference_id, assigned_by) "
            "SELECT NEW.event_id, NEW.worker_name, '', 'diarista', 'daily_rate', NEW.id, NEW.created_by "
            "WHERE NEW.event_id IS NOT NULL AND NOT EXISTS "
            "(SELECT 1 FROM event_collaborators WHERE reference_type = 'daily_rate' AND reference_id = NEW.id)",
            "DELETE FROM event_collaborators WHERE OLD.event_id IS NOT NULL AND NEW.event_id IS NULL "
            "AND reference_type = 'daily_rate' AND reference_id = NEW.id",
        ],
    },
    "delete_event_collaborator_from_daily_rate": {
        "DELETE": ["DELETE FROM event_collaborators WHERE reference_type = 'daily_rate' AND reference_id = OLD.id"],
    },
    "sync_event_team_from_daily_rate": {
        "INSERT": reconcile("NEW.event_id", "NEW.worker_id", "NEW.worker_name"),
        "UPDATE": reconcile("OLD.event_id", "OLD.worker_id", "OLD.worker_name") + reconcile("NEW.event_id", "NEW.worker_id", "NEW.worker_name"),
        "DELETE": reconcile("OLD.event_id", "OLD.worker_id", "OLD.worker_name"),
    },
    # -- estoque, manutenção e totais de evento --
    "update_equipment_stock": {
        "INSERT": stock("NEW.equipment_name"),
        "UPDATE": stock("NEW.equipment_name"),
        "DELETE": stock("OLD.equipment_name"),
    },
    "update_equipment_with_maintenance": {
        "INSERT": maintenance("NEW.equipment_name"),
        "UPDATE": maintenance("NEW.equipment_name"),
        "DELETE": maintenance("OLD.equipment_name"),
    },
    # O original atualizava só o evento novo quando a despesa mudava de
    # evento; aqui o evento antigo também é recalculado.
    "update_event_totals": {
        "INSERT": event_totals("NEW.event_id"),
        "UPDATE": event_totals("NEW.event_id") + [
            s + " AND OLD.event_id IS NOT NEW.event_id" for s in event_totals("OLD.event_id")
        ],
        "DELETE": event_totals("OLD.event_id"),
    },
    "return_equipment_on_event_completion": {
        "UPDATE": {
            "when": "NEW.status = 'completed' AND OLD.status != 'completed'",
            "do": [
                "UPDATE event_equipment SET status = 'returned', updated_at = {NOW} "
                "WHERE event_id = NEW.id AND status IN ('confirmed', 'active', 'pending')"
            ],
        },
    },
    # -- validações de cadastro --
    "validate_person_fields": {
        op: [
            RW("NEW.status IS NOT NULL AND NEW.status NOT IN ('ativo','inativo','ferias','afastado','bloqueado')",
               "Status inválido. Use ativo, inativo, ferias, afastado ou bloqueado."),
            RW("NEW.employment_type IS NOT NULL AND NEW.employment_type NOT IN ('fixo','diarista','freelancer')",
               "Tipo de vínculo inválido. Use fixo, diarista ou freelancer."),
        ] for op in ("INSERT", "UPDATE")
    },
    "validate_person_type": {
        op: [RW("NEW.person_type IS NOT NULL AND NEW.person_type NOT IN ('collaborator','worker')",
                "person_type inválido. Use collaborator ou worker.")]
        for op in ("INSERT", "UPDATE")
    },
    "validate_worker_availability": {
        op: [
            RW("NEW.period IS NOT NULL AND NEW.period NOT IN ('integral','manha','tarde','noite')",
               "Período inválido. Use integral, manha, tarde ou noite."),
            RW("NEW.availability IS NOT NULL AND NEW.availability NOT IN ('disponivel','indisponivel','parcial')",
               "Disponibilidade inválida. Use disponivel, indisponivel ou parcial."),
        ] for op in ("INSERT", "UPDATE")
    },
    "validate_interstate_transport": {
        op: ([
            RW("NEW.status IS NULL OR NEW.status NOT IN ('planned','in_transit','completed','cancelled')",
               "Status invalido. Use planned, in_transit, completed ou cancelled.")
            if op == "INSERT" else
            RW("NEW.status IS NOT OLD.status AND (NEW.status IS NULL OR NEW.status NOT IN ('planned','in_transit','completed','cancelled'))",
               "Status invalido. Use planned, in_transit, completed ou cancelled."),
        ] + [
            RW("NEW.distance_km < 0 OR NEW.fuel_consumption_kmpl < 0 OR (NEW.vehicle_capacity_kg IS NOT NULL AND NEW.vehicle_capacity_kg < 0)",
               "Quilometragem, consumo e capacidade nao podem ser negativos."),
            RW("NEW.fuel_price_cents < 0 OR NEW.fuel_cost_cents < 0 OR NEW.toll_cents < 0 OR NEW.lodging_cents < 0 "
               "OR NEW.meals_cents < 0 OR NEW.daily_rate_cents < 0 OR NEW.maintenance_cents < 0 OR NEW.freight_cents < 0 "
               "OR NEW.advance_cents < 0 OR NEW.extra_cents < 0 OR NEW.revenue_cents < 0",
               "Valores monetarios nao podem ser negativos."),
            RW("json_type(NEW.legs) <> 'array'", "legs deve ser um array JSON."),
            RW("json_type(NEW.helpers) <> 'array'", "helpers deve ser um array JSON."),
            RW("NEW.arrival_date IS NOT NULL AND NEW.arrival_date < NEW.transport_date",
               "A data de chegada nao pode ser anterior a data de saida."),
            RW("NEW.expected_return_date IS NOT NULL AND NEW.expected_return_date < NEW.transport_date",
               "A data de retorno nao pode ser anterior a data de saida."),
        ]) for op in ("INSERT", "UPDATE")
    },
    # -- financeiro (títulos, parcelas e pagamentos) --
    "finance_title_guard": {
        "UPDATE": [
            RW("OLD.status IN ('pago','estornado','cancelado') AND "
               + distinct_any(["total_amount", "kind", "client_id", "event_id", "contract_id", "quote_id", "supplier_name", "source_type", "source_id"]),
               "Título está fechado e não pode ter dados materiais alterados."),
            RW("NEW.status IS NOT OLD.status AND " + transition_not_ok("OLD.status", "NEW.status", TITLE_TRANSITIONS),
               "Transição de status inválida."),
        ],
    },
    "finance_installment_guard": {
        "UPDATE": [
            RW("OLD.status IN ('pago','cancelado') AND " + distinct_any(["amount", "title_id", "number"]),
               "Parcela está fechada e não pode ter valor/vínculo alterado."),
            RW("NEW.status IS NOT OLD.status AND " + transition_not_ok("OLD.status", "NEW.status", INSTALLMENT_TRANSITIONS),
               "Transição de status inválida na parcela."),
        ],
    },
    "finance_payment_guard": {
        "INSERT": [
            RW("NOT EXISTS (SELECT 1 FROM finance_titles WHERE id = NEW.title_id)", "Título inexistente."),
            RW("NEW.installment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM finance_installments i "
               "WHERE i.id = NEW.installment_id AND i.title_id = NEW.title_id)", "Parcela inválida para este título."),
            # estorno
            RW("NEW.is_reversal AND NEW.reverses_payment_id IS NULL", "Estorno exige o pagamento de origem."),
            RW("NEW.is_reversal AND NOT EXISTS (SELECT 1 FROM finance_payments WHERE id = NEW.reverses_payment_id)",
               "Pagamento de origem inexistente."),
            RW("NEW.is_reversal AND (SELECT is_reversal FROM finance_payments WHERE id = NEW.reverses_payment_id)",
               "Não é possível estornar um estorno."),
            RW("NEW.is_reversal AND EXISTS (SELECT 1 FROM finance_payments o WHERE o.id = NEW.reverses_payment_id AND "
               "(o.title_id <> NEW.title_id OR o.installment_id IS NOT NEW.installment_id))",
               "O estorno deve referenciar o mesmo título e parcela do pagamento original."),
            RW("NEW.is_reversal AND (SELECT amount FROM finance_payments WHERE id = NEW.reverses_payment_id) <> NEW.amount",
               "O estorno deve ser pelo valor integral do pagamento original."),
            RW("NEW.is_reversal AND EXISTS (SELECT 1 FROM finance_payments WHERE reverses_payment_id = NEW.reverses_payment_id)",
               "Este pagamento já possui estorno."),
            # pagamento normal
            RW("NOT NEW.is_reversal AND NEW.reverses_payment_id IS NOT NULL", "Pagamento normal não pode referenciar estorno."),
            RW("NOT NEW.is_reversal AND (SELECT status FROM finance_titles WHERE id = NEW.title_id) IN ('cancelado','estornado')",
               "Título não aceita pagamentos."),
            RW("NOT NEW.is_reversal AND NEW.installment_id IS NOT NULL AND "
               "(SELECT status FROM finance_installments WHERE id = NEW.installment_id) = 'cancelado'",
               "Parcela cancelada não aceita pagamentos."),
            RW("NOT NEW.is_reversal AND (CASE WHEN NEW.installment_id IS NOT NULL THEN "
               "(SELECT amount FROM finance_installments WHERE id = NEW.installment_id) - "
               "(SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0) FROM finance_payments WHERE installment_id = NEW.installment_id) "
               "ELSE (SELECT total_amount FROM finance_titles WHERE id = NEW.title_id) - "
               "(SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0) FROM finance_payments WHERE title_id = NEW.title_id) "
               "END) <= 0", "Não há saldo em aberto para receber pagamento."),
            RW("NOT NEW.is_reversal AND NEW.amount > (CASE WHEN NEW.installment_id IS NOT NULL THEN "
               "(SELECT amount FROM finance_installments WHERE id = NEW.installment_id) - "
               "(SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0) FROM finance_payments WHERE installment_id = NEW.installment_id) "
               "ELSE (SELECT total_amount FROM finance_titles WHERE id = NEW.title_id) - "
               "(SELECT COALESCE(SUM(CASE WHEN is_reversal THEN -amount ELSE amount END), 0) FROM finance_payments WHERE title_id = NEW.title_id) "
               "END) + 0.005", "Pagamento excede o saldo em aberto."),
        ],
    },
    "forbid_finance_delete": {"DELETE": ["SELECT RAISE(ABORT, 'P0001:Exclusão não permitida em {T}. Use cancelamento ou estorno.')"]},
    "forbid_finance_payment_update": {"UPDATE": [R("Pagamentos são imutáveis. Registre um estorno.")]},
    # -- documentos fiscais --
    "fiscal_document_guard": {
        "INSERT": [
            RW("NEW.status NOT IN ('rascunho','validado')",
               "Novo documento só pode nascer como rascunho ou validado. Autorização ocorre por transição auditada."),
            RW("NEW.protocol_number IS NOT NULL OR NEW.access_key IS NOT NULL OR NEW.authorized_at IS NOT NULL",
               "Chave, protocolo e data de autorização não podem ser informados na criação."),
        ],
        "UPDATE": [
            RW("NEW.status IS NOT OLD.status AND " + transition_not_ok("OLD.status", "NEW.status", FISCAL_TRANSITIONS),
               "Transição de situação inválida."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND (NEW.access_key IS NULL OR NOT " + digits("NEW.access_key", 44) + ")",
               "Autorização exige chave de acesso com 44 dígitos."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND COALESCE(NEW.protocol_number, '') = ''",
               "Autorização exige número de protocolo real da SEFAZ."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND NEW.authorized_at IS NULL",
               "Autorização exige data/hora de autorização."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND (COALESCE(NEW.xml_path, '') = '' OR NEW.xml_sha256 IS NULL "
               "OR NOT (length(NEW.xml_sha256) = 64 AND NEW.xml_sha256 NOT GLOB '*[^0-9a-f]*'))",
               "Autorização exige XML autorizado armazenado com hash SHA-256 válido."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND (NEW.authorization_source IS NULL "
               "OR NEW.authorization_source NOT IN ('sefaz_provider','external_import'))",
               "Autorização exige origem válida (sefaz_provider ou external_import)."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND NEW.environment IS NOT OLD.environment",
               "Ambiente não pode mudar durante a autorização."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'autorizado' AND NEW.authorization_source = 'external_import' "
               "AND NEW.source <> 'external_import'", "Origem da autorização incoerente com a origem do documento."),
            RW("NEW.status IS NOT OLD.status AND NEW.status = 'encerrado' AND NEW.model <> '58'",
               "Encerramento aplica-se somente ao MDF-e (modelo 58)."),
            RW("OLD.status = 'autorizado' AND " + distinct_any(["access_key", "protocol_number", "authorized_at", "xml_sha256", "xml_path", "environment", "model", "total_document_cents"]),
               "Documento autorizado é imutável. Use cancelamento ou encerramento."),
        ],
    },
    # -- contratos (a parte que altera NEW é feita no Worker) --
    "enforce_signed_contract_immutability": {
        "UPDATE": [
            RW("(COALESCE(OLD.locked, 0) OR OLD.status = 'assinado') AND COALESCE(NEW.locked, 0) = 0",
               "Contrato assinado não pode ser destravado."),
            RW("(COALESCE(OLD.locked, 0) OR OLD.status = 'assinado') AND ("
               + " OR ".join(
                   f"json(NEW.{c}) IS NOT json(OLD.{c})" if c in ("sections_snapshot", "details") else f"NEW.{c} IS NOT OLD.{c}"
                   for c in ["client_name", "client_document", "client_email", "client_phone", "service_description", "start_date",
                             "end_date", "total_value", "payment_terms", "sections_snapshot", "details", "template_id",
                             "template_version", "template_name", "contract_number", "client_id", "event_id", "quote_id", "signed_at"]
               ) + ")",
               "Contrato assinado não pode ter seu conteúdo alterado. Somente status, anexos e metadados autorizados."),
        ],
    },
    # -- finanças pessoais --
    "validate_personal_reversal": {
        "INSERT": [
            RW("NEW.reverses_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM personal_expenses WHERE id = NEW.reverses_id)",
               "Lancamento original inexistente"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT owner_id FROM personal_expenses WHERE id = NEW.reverses_id) <> NEW.owner_id",
               "Estorno deve pertencer ao mesmo proprietario"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT reverses_id FROM personal_expenses WHERE id = NEW.reverses_id) IS NOT NULL",
               "Nao e permitido estornar um estorno"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT kind FROM personal_expenses WHERE id = NEW.reverses_id) = NEW.kind",
               "Estorno deve ter natureza oposta ao lancamento original"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT amount_cents FROM personal_expenses WHERE id = NEW.reverses_id) <> NEW.amount_cents",
               "Estorno deve ter o mesmo valor do lancamento original"),
        ],
        "UPDATE": [
            RW("NEW.reverses_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM personal_expenses WHERE id = NEW.reverses_id)",
               "Lancamento original inexistente"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT owner_id FROM personal_expenses WHERE id = NEW.reverses_id) <> NEW.owner_id",
               "Estorno deve pertencer ao mesmo proprietario"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT reverses_id FROM personal_expenses WHERE id = NEW.reverses_id) IS NOT NULL",
               "Nao e permitido estornar um estorno"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT kind FROM personal_expenses WHERE id = NEW.reverses_id) = NEW.kind",
               "Estorno deve ter natureza oposta ao lancamento original"),
            RW("NEW.reverses_id IS NOT NULL AND (SELECT amount_cents FROM personal_expenses WHERE id = NEW.reverses_id) <> NEW.amount_cents",
               "Estorno deve ter o mesmo valor do lancamento original"),
            RW("NEW.reverses_id IS NOT NULL AND OLD.reverses_id IS NOT NEW.reverses_id", "Vinculo de estorno nao pode ser alterado"),
            RW("NEW.reverses_id IS NULL AND OLD.reverses_id IS NOT NULL", "Vinculo de estorno nao pode ser removido"),
        ],
    },
    "guard_personal_expense_reversed": {
        "UPDATE": [RW("EXISTS (SELECT 1 FROM personal_expenses e WHERE e.reverses_id = NEW.id)",
                      "Lancamento estornado nao pode ser alterado")],
    },
}

# Funções de gatilho que, além do SQLite, pedem um ajuste da linha no Worker.
# (atualizam updated_at/NEW antes de gravar)
WORKER_UPDATED_AT_TOO = {
    "finance_title_guard",
    "finance_installment_guard",
    "fiscal_document_guard",
    "validate_interstate_transport",
    "force_reconciliation_actor",
}
