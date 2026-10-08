// Sincronização de lançamentos bancários automáticos e saldos.
// Tradução fiel de public.sync_bank_transactions() e
// public.update_all_account_balances_from_transactions().
//
// O original percorria eventos/despesas em laços (FOR ... LOOP); aqui são
// comandos em conjunto (INSERT ... SELECT) que produzem o mesmo resultado,
// executados numa única transação.

const NOW = "strftime('%Y-%m-%dT%H:%M:%f+00:00','now')";

const ACCOUNT_BY_NAME = (nameExpr) =>
  `(SELECT id FROM bank_accounts WHERE trim(lower(name)) = trim(lower(${nameExpr})) LIMIT 1)`;

const BALANCE = `(SELECT COALESCE(SUM(CASE WHEN bt.transaction_type = 'income' THEN bt.amount ELSE 0 END), 0) -
                         COALESCE(SUM(CASE WHEN bt.transaction_type = 'expense' THEN bt.amount ELSE 0 END), 0)
                    FROM bank_transactions bt WHERE bt.bank_account_id = bank_accounts.id)`;

export function syncBankTransactionsSql() {
  return [
    // 1) Limpeza segura (apenas lançamentos sincronizados do sistema)
    { sql: `DELETE FROM bank_transactions WHERE reference_type = 'event'` },
    { sql: `DELETE FROM bank_transactions WHERE reference_type = 'event_remaining'` },
    // receitas event_income que correspondem exatamente ao pagamento principal
    {
      sql: `DELETE FROM bank_transactions
             WHERE reference_type = 'event_income'
               AND EXISTS (SELECT 1 FROM events e
                            WHERE e.id = bank_transactions.reference_id AND e.is_paid = 1
                              AND COALESCE(e.payment_amount, 0) > 0
                              AND bank_transactions.amount = e.payment_amount
                              AND bank_transactions.transaction_date = COALESCE(date(e.payment_date), e.event_date))`,
    },
    // ... e ao pagamento restante
    {
      sql: `DELETE FROM bank_transactions
             WHERE reference_type = 'event_income'
               AND EXISTS (SELECT 1 FROM events e
                            WHERE e.id = bank_transactions.reference_id AND e.is_remaining_paid = 1
                              AND COALESCE(e.remaining_payment_amount, 0) > 0
                              AND bank_transactions.amount = e.remaining_payment_amount
                              AND bank_transactions.transaction_date = COALESCE(date(e.remaining_payment_date), e.event_date))`,
    },
    { sql: `DELETE FROM bank_transactions WHERE reference_type IN ('expense', 'event_expense') AND reference_id IS NOT NULL` },
    { sql: `DELETE FROM bank_transactions WHERE reference_type = 'recurring_expense' AND reference_id IS NOT NULL` },
    // Eventos pagos -> receitas (pagamento principal)
    {
      sql: `INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category,
                                           reference_type, reference_id, transaction_date)
            SELECT ${ACCOUNT_BY_NAME("COALESCE(e.payment_bank_account, 'Conta Corrente Principal')")},
                   'Receita - ' || e.name || ' (' || COALESCE(e.client_name, 'Cliente') || ')',
                   e.payment_amount, 'income', 'Receita de Eventos', 'event_income', e.id,
                   COALESCE(date(e.payment_date), e.event_date)
              FROM events e
             WHERE e.is_paid = 1 AND COALESCE(e.payment_amount, 0) > 0
               AND ${ACCOUNT_BY_NAME("COALESCE(e.payment_bank_account, 'Conta Corrente Principal')")} IS NOT NULL`,
    },
    // Pagamentos restantes de eventos
    {
      sql: `INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category,
                                           reference_type, reference_id, transaction_date)
            SELECT ${ACCOUNT_BY_NAME("COALESCE(e.remaining_payment_bank_account, 'Conta Corrente Principal')")},
                   'Restante - ' || e.name || ' (' || COALESCE(e.client_name, 'Cliente') || ')',
                   e.remaining_payment_amount, 'income', 'Receita de Eventos', 'event_remaining', e.id,
                   COALESCE(date(e.remaining_payment_date), e.event_date)
              FROM events e
             WHERE e.is_remaining_paid = 1 AND COALESCE(e.remaining_payment_amount, 0) > 0
               AND ${ACCOUNT_BY_NAME("COALESCE(e.remaining_payment_bank_account, 'Conta Corrente Principal')")} IS NOT NULL`,
    },
    // Despesas de eventos com conta bancária vinculada
    {
      sql: `INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category,
                                           reference_type, reference_id, transaction_date)
            SELECT ${ACCOUNT_BY_NAME('ee.expense_bank_account')},
                   COALESCE(ee.description, 'Despesa') || COALESCE(' - ' || e.name, ''),
                   ee.total_price, 'expense', COALESCE(ee.category, 'Despesas Evento'), 'expense', ee.id,
                   COALESCE(date(ee.expense_date), date(ee.created_at))
              FROM event_expenses ee
              LEFT JOIN events e ON ee.event_id = e.id
             WHERE ee.expense_bank_account IS NOT NULL AND ee.expense_bank_account != ''
               AND ee.total_price > 0
               AND ${ACCOUNT_BY_NAME('ee.expense_bank_account')} IS NOT NULL`,
    },
    // Pagamentos de despesas fixas
    {
      sql: `INSERT INTO bank_transactions (bank_account_id, description, amount, transaction_type, category,
                                           reference_type, reference_id, transaction_date)
            SELECT remp.bank_account_id, 'Despesa Fixa - ' || COALESCE(re.name, 'N/A'),
                   remp.payment_amount, 'expense', COALESCE(re.category, 'Despesas Fixas'),
                   'recurring_expense', remp.id, remp.payment_date
              FROM recurring_expense_monthly_payments remp
              LEFT JOIN recurring_expenses re ON remp.recurring_expense_id = re.id
             WHERE remp.bank_account_id IS NOT NULL AND remp.payment_amount > 0`,
    },
    // Saldos de todas as contas
    {
      sql: `UPDATE bank_accounts SET balance = round(${BALANCE}, 2), current_balance = round(${BALANCE}, 2),
                                     updated_at = ${NOW}`,
    },
  ];
}

export function updateAllBalancesSql() {
  return [{ sql: `UPDATE bank_accounts SET balance = round(${BALANCE}, 2), updated_at = ${NOW}` }];
}
