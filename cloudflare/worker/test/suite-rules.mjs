// Regras automáticas: lançamentos bancários, saldos, estoque, diárias,
// financeiro, contratos e auditoria.
export default async function ({ setup, client, ok }) {
  const { env, d1, mkUser } = await setup();
  const admin = await mkUser('admin', 'admin');
  const c = client(env);
  await c.login('admin');
  const ins = async (table, body, select = '*') => {
    const r = await c.call('POST', `/rest/v1/${table}?select=${select}`, { body, headers: { Prefer: 'return=representation' } });
    if (r.status !== 201) console.log('   (insert falhou)', table, r.status, JSON.stringify(r.data));
    return r;
  };
  const get = async (q) => (await c.call('GET', '/rest/v1/' + q)).data;
  const first = async (sql, ...p) => d1.prepare(sql).bind(...p).first();

  // ---------------- contas e sincronização ----------------
  const acct = (await ins('bank_accounts', { name: 'Conta Corrente Principal' })).data[0];
  const acct2 = (await ins('bank_accounts', { name: 'Caixa' })).data[0];

  const ev = (await ins('events', {
    name: 'Show Rock', client_name: 'Prefeitura', event_date: '2026-11-01', total_budget: 10000,
    is_paid: true, payment_amount: 6000, payment_date: '2026-10-15',
  })).data[0];
  // No sistema original, marcar como pago não lança na hora: o lançamento
  // aparece quando a sincronização (sync_bank_transactions) roda.
  const sync = () => c.call('POST', '/rest/v1/rpc/sync_bank_transactions', { body: {} });
  let txs = await get(`bank_transactions?select=*&reference_id=eq.${ev.id}`);
  ok(txs.length === 0, 'sem lançamento antes da sincronização (igual ao original)', txs);
  await sync();
  txs = await get(`bank_transactions?select=*&reference_id=eq.${ev.id}`);
  ok(txs.length === 1 && txs[0].amount === 6000 && txs[0].transaction_type === 'income' && txs[0].bank_account_id === acct.id,
    'evento pago gera receita na conta padrão', txs);
  ok(txs[0] && txs[0].description === 'Receita - Show Rock (Prefeitura)', 'descrição igual ao original', txs[0]);
  let a = await get(`bank_accounts?select=balance,current_balance&id=eq.${acct.id}`);
  ok(a[0].balance === 6000 && a[0].current_balance === 6000, 'saldo atualizado', a);

  const exp = (await ins('event_expenses', { event_id: ev.id, description: 'Gerador', total_price: 1500, expense_bank_account: 'Conta Corrente Principal' })).data[0];
  await sync();
  txs = await get(`bank_transactions?select=*&reference_id=eq.${exp.id}`);
  ok(txs.length === 1 && txs[0].transaction_type === 'expense' && txs[0].description === 'Gerador - Show Rock', 'despesa com conta gera saída', txs);
  a = await get(`bank_accounts?select=balance&id=eq.${acct.id}`);
  ok(a[0].balance === 4500, 'saldo 6000 - 1500', a);
  let e = await get(`events?select=total_expenses,profit_margin&id=eq.${ev.id}`);
  ok(e[0].total_expenses === 1500 && e[0].profit_margin === 8500, 'totais do evento', e);

  await c.call('DELETE', `/rest/v1/event_expenses?id=eq.${exp.id}`);
  await sync();
  e = await get(`events?select=total_expenses&id=eq.${ev.id}`);
  a = await get(`bank_accounts?select=balance&id=eq.${acct.id}`);
  ok(e[0].total_expenses === 0 && a[0].balance === 6000, 'apagar despesa recalcula tudo', [e, a]);

  // período fechado bloqueia lançamento manual
  await ins('bank_account_closings', { bank_account_id: acct2.id, closed_through: '2026-12-31', closing_balance: 0 });
  const closing = await first('SELECT closed_by, created_at FROM bank_account_closings');
  ok(closing.closed_by === admin.id, 'fechamento registra quem fechou', closing);
  let r = await c.call('POST', '/rest/v1/bank_transactions', {
    body: { bank_account_id: acct2.id, description: 'Manual', amount: 10, transaction_type: 'expense', transaction_date: '2026-06-01' },
  });
  ok(r.status === 400 && /Período já fechado/.test(r.data.message), 'período fechado bloqueia', r.data);
  await c.call('DELETE', `/rest/v1/bank_account_closings?bank_account_id=eq.${acct2.id}`);
  const still = await first('SELECT COUNT(*) AS n FROM bank_account_closings');
  ok(still.n === 1, 'fechamento não pode ser apagado', still);

  // ---------------- despesas fixas ----------------
  const rec = (await ins('recurring_expenses', { name: 'Aluguel Galpão', category: 'Aluguel', amount: 2000, created_by: admin.id })).data[0];
  if (rec) {
    const pay = (await ins('recurring_expense_monthly_payments', {
      recurring_expense_id: rec.id, payment_month: 10, payment_year: 2026, payment_date: '2026-10-05',
      payment_amount: 2000, bank_account_id: acct.id, created_by: admin.id,
    })).data[0];
    txs = await get(`bank_transactions?select=*&reference_id=eq.${pay.id}`);
    ok(txs.length === 1 && txs[0].description === 'Despesa Fixa - Aluguel Galpão' && txs[0].category === 'Aluguel', 'pagamento de despesa fixa gera saída', txs);
  }

  // ---------------- vale de colaborador ----------------
  const adv = await ins('worker_advances', { worker_name: 'Carlos', amount: 100, advance_date: '2026-10-08', bank_account_id: acct.id, created_by: admin.id });
  ok(adv.status === 201, 'vale de colaborador é cadastrado (antes falhava)', adv.data);
  if (adv.status === 201) {
    const vt = await get(`bank_transactions?select=*&reference_id=eq.${adv.data[0].id}`);
    ok(vt.length === 1 && vt[0].transaction_type === 'expense' && vt[0].amount === 100, 'vale gera uma única saída', vt);
    await c.call('DELETE', `/rest/v1/worker_advances?id=eq.${adv.data[0].id}`);
    const vt2 = await get(`bank_transactions?select=id&reference_id=eq.${adv.data[0].id}`);
    ok(vt2.length === 0, 'apagar vale remove a saída', vt2);
  }

  const nota = await ins('worker_expense_advances', { worker_name: 'Carlos', amount: 40, advance_date: '2026-10-08', bank_account_id: acct.id, created_by: admin.id });
  ok(nota.status === 201, 'notinha de diarista é cadastrada', nota.data);
  if (nota.status === 201) {
    const nt = await get(`bank_transactions?select=*&reference_id=eq.${nota.data[0].id}`);
    ok(nt.length === 1 && nt[0].description === 'Adiantamento - Carlos', 'notinha gera saída', nt);
  }

  // ---------------- estoque ----------------
  const eq = (await ins('equipment', { name: 'Moving Head 230', category: 'Iluminação', total_stock: 10, available: 10, rented: 0 })).data[0];
  await ins('event_equipment', { event_id: ev.id, equipment_name: 'Moving Head 230', quantity: 4, status: 'confirmed', assigned_by: admin.id });
  let q = await get(`equipment?select=rented,available,status&id=eq.${eq.id}`);
  ok(q[0].rented === 4 && q[0].available === 6 && q[0].status === 'available', 'alocar baixa estoque', q);
  await ins('maintenance_records', { equipment_name: 'Moving Head 230', maintenance_type: 'corretiva', status: 'agendada', scheduled_date: '2026-10-10', description: 'Lâmpada', quantity: 5 });
  q = await get(`equipment?select=available,status&id=eq.${eq.id}`);
  ok(q[0].available === 6, 'manutenção não mexe no estoque (regra removida no banco real)', q);
  await c.call('PATCH', `/rest/v1/events?id=eq.${ev.id}`, { body: { status: 'completed' } });
  const ee = await get(`event_equipment?select=status&event_id=eq.${ev.id}`);
  q = await get(`equipment?select=rented,available&id=eq.${eq.id}`);
  ok(ee[0].status === 'returned' && q[0].rented === 0 && q[0].available === 5, 'concluir evento devolve equipamento (desconta os 5 em manutenção)', [ee, q]);

  // ---------------- diárias ----------------
  const ev2 = (await ins('events', { name: 'Formatura', event_date: '2026-12-10' })).data[0];
  const worker = (await ins('workers', { name: 'Carlos', created_by: admin.id, email: 'carlos@x.com' })).data[0];
  const dr = (await ins('daily_rates', { worker_name: 'Carlos', worker_id: worker.id, event_id: ev2.id, date: '2026-12-10', amount: 250, created_by: admin.id })).data[0];
  const ex = await get(`event_expenses?select=*&reference_id=eq.${dr.id}`);
  ok(ex.length === 1 && ex[0].description === 'Diária - Carlos' && ex[0].total_price === 250, 'diária gera despesa no evento', ex);
  const col = await get(`event_collaborators?select=*&event_id=eq.${ev2.id}`);
  ok(col.length === 1 && col[0].collaborator_name === 'Carlos' && col[0].role === 'diarista' && col[0].reference_type === 'daily_rate', 'diária inclui pessoa na equipe', col);
  r = await c.call('POST', '/rest/v1/daily_rates', { body: { worker_name: 'Carlos', date: '2026-12-11', amount: 10, attendance_status: 'xyz', created_by: admin.id } });
  ok(r.status === 400 && /Presença inválida/.test(r.data.message), 'validação de presença', r.data);
  await c.call('PATCH', `/rest/v1/daily_rates?id=eq.${dr.id}`, { body: { amount: 300 } });
  const ex2 = await get(`event_expenses?select=total_price&reference_id=eq.${dr.id}`);
  const ev2t = await get(`events?select=total_expenses&id=eq.${ev2.id}`);
  ok(ex2[0].total_price === 250 && ev2t[0].total_expenses === 250, 'alterar diária não mexe na despesa (sem regra de atualização no banco real)', [ex2, ev2t]);
  await c.call('DELETE', `/rest/v1/daily_rates?id=eq.${dr.id}`);
  const ex3 = await get(`event_expenses?select=id&reference_id=eq.${dr.id}`);
  ok(ex3.length === 0, 'apagar diária apaga despesa', ex3);

  // ---------------- financeiro ----------------
  const title = (await ins('finance_titles', { kind: 'receber', status: 'pendente', description: 'Contrato X', total_amount: 1000, issue_date: '2026-10-01', due_date: '2026-10-30' })).data[0];
  if (title) {
    r = await c.call('PATCH', `/rest/v1/finance_titles?id=eq.${title.id}`, { body: { status: 'rascunho' } });
    ok(r.status === 400 && /Transição de status inválida/.test(r.data.message), 'transição inválida bloqueada', r.data);
    r = await c.call('POST', '/rest/v1/finance_payments', { body: { title_id: title.id, amount: 1200, paid_at: '2026-10-10' } });
    ok(r.status === 400 && /excede/.test(r.data.message), 'pagamento acima do saldo bloqueado', r.data);
    r = await ins('finance_payments', { title_id: title.id, amount: 400, paid_at: '2026-10-10' });
    ok(r.status === 201, 'pagamento parcial aceito', r.data);
    await c.call('DELETE', `/rest/v1/finance_titles?id=eq.${title.id}`);
    const t2 = await first('SELECT COUNT(*) AS n FROM finance_titles');
    ok(t2.n === 1, 'título não pode ser apagado', t2);
    const aud = await first("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'finance_titles'");
    ok(aud.n >= 1, 'auditoria financeira registrada', aud);
  }

  // ---------------- contratos ----------------
  const ct = (await ins('contracts', {
    contract_number: 'C-001', client_name: 'Maria', service_description: 'Iluminação', start_date: '2026-11-01', end_date: '2026-11-02', status: 'rascunho', total_value: 3000,
  })).data[0];
  if (ct) {
    r = await c.call('PATCH', `/rest/v1/contracts?id=eq.${ct.id}&select=*`, { body: { status: 'assinado' }, headers: { Prefer: 'return=representation' } });
    ok(r.data[0].locked === true && r.data[0].signed_at, 'assinar trava o contrato', r.data);
    r = await c.call('PATCH', `/rest/v1/contracts?id=eq.${ct.id}`, { body: { total_value: 1 } });
    ok(r.status === 400 && /assinado não pode ter seu conteúdo alterado/.test(r.data.message), 'contrato assinado é imutável', r.data);
    const hist = await get(`contract_history?select=action&contract_id=eq.${ct.id}&order=created_at`);
    ok(hist.length === 2 && hist[0].action === 'created' && hist[1].action === 'status_changed', 'histórico do contrato', hist);
  }

  // ---------------- auditoria geral ----------------
  const au = await first("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'events'");
  ok(au.n >= 2, 'auditoria de eventos', au);
  const au2 = await first("SELECT new_data FROM audit_logs WHERE entity_type = 'bank_accounts' AND action = 'INSERT' LIMIT 1");
  ok(au2 && JSON.parse(au2.new_data).is_active === true, 'auditoria guarda JSON com tipos corretos', au2);

  // ---------------- finanças pessoais ----------------
  const pc = (await ins('personal_categories', { name: 'Mercado', kind: 'expense' })).data[0];
  ok(pc && pc.owner_id === admin.id, 'dono preenchido automaticamente', pc);

  // ---------------- comportamento herdado do original ----------------
  // Índice único em bank_transactions(reference_id): um evento com pagamento
  // principal E restante gera duas receitas com o mesmo reference_id, a
  // sincronização falha e (como no original) o erro é ignorado.
  const before = await first("SELECT COUNT(*) AS n FROM bank_transactions WHERE reference_type = 'event'");
  const ev3 = (await ins('events', { name: 'Feira', event_date: '2026-09-01', is_paid: true, payment_amount: 100,
    is_remaining_paid: true, remaining_payment_amount: 50 })).data[0];
  const after = await first("SELECT COUNT(*) AS n FROM bank_transactions WHERE reference_type = 'event'");
  ok(ev3 && after.n === before.n, 'evento com dois pagamentos trava a sincronização (igual ao original)', [before, after]);
}
