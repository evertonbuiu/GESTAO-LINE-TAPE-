import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Filter, ArrowUpCircle, ArrowDownCircle, Calendar, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { findBankAccountByName } from '@/utils/bankAccountMatch';
import { formatTransactionDateTime } from '@/lib/transactionDateTime';


interface UnifiedTransaction {
  id: string;
  date: string;
  time?: string | null;
  createdAt?: string | null;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  account_id: string | null;
  account_name: string | null;
  source: string;
}

// Date-only strings (YYYY-MM-DD) avoid timezone shifting when formatting/filtering.
const toDateOnly = (date: string) => (date ?? '').split('T')[0];

const formatDateBR = (date: string) => {
  const d = toDateOnly(date);
  if (!d) return '-';
  const [yyyy, mm, dd] = d.split('-');
  if (!yyyy || !mm || !dd) return d;
  return `${dd}/${mm}/${yyyy}`;
};

export const AccountsReport = () => {
  const { canViewValues, formatValue } = useValueVisibility();
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [transactionType, setTransactionType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bank-accounts-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all transaction sources and unify them
  const { data: unifiedTransactions = [], isLoading, refetch } = useQuery({
    queryKey: ['unified-transactions-report'],
    queryFn: async () => {
      const transactions: UnifiedTransaction[] = [];

      // 1. Bank transactions
      const { data: bankTx } = await supabase
        .from('bank_transactions')
        .select('*, bank_accounts(name)')
        .order('transaction_date', { ascending: false });

      // 1.1 Buscar despesas de evento (precisa antes para deduplicar worker_advance duplicado)
      const { data: eventExpenses } = await supabase
        .from('event_expenses')
        .select('id, reference_type, reference_id, description, total_price, category, expense_date, payment_date, created_at, expense_bank_account, payment_bank_account, is_paid, events(name)')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '');
      
      // Criar sets de reference_ids que já existem em bank_transactions para evitar duplicatas
      const existingReferenceKeys = new Set(
        (bankTx || [])
          .filter(t => t.reference_type && t.reference_id)
          .map(t => `${t.reference_type}-${t.reference_id}`)
      );
      const existingReferenceIdValues = new Set(
        (bankTx || [])
          .filter(t => t.reference_id)
          .map(t => String(t.reference_id))
      );

      // Deduplicação específica: quando um vale/adiantamento de diarista está vinculado a um event_expense
      // e já existe a transação sincronizada dessa despesa (reference_type='expense', reference_id=event_expense.id),
      // escondemos a transação automática do trigger (reference_type='worker_advance').
      const getWorkerRefIdsToHide = (refType: 'worker_advance' | 'worker_expense_advance') => {
        const refToEventExpenseId = new Map<string, string>();
        (eventExpenses || []).forEach((expense: any) => {
          if (expense?.reference_type === refType && expense?.reference_id) {
            refToEventExpenseId.set(String(expense.reference_id), String(expense.id));
          }
        });
        if (refToEventExpenseId.size === 0) return new Set<string>();

        const eventExpenseIds = new Set(Array.from(refToEventExpenseId.values()));
        const eventExpenseIdsWithSyncedBankTx = new Set(
          (bankTx || [])
            .filter((t: any) => t?.reference_type === 'expense' && t?.reference_id && eventExpenseIds.has(String(t.reference_id)))
            .map((t: any) => String(t.reference_id))
        );

        const refIdsToHide = new Set<string>();
        for (const [refId, eventExpenseId] of refToEventExpenseId.entries()) {
          if (eventExpenseIdsWithSyncedBankTx.has(String(eventExpenseId))) {
            refIdsToHide.add(String(refId));
          }
        }
        return refIdsToHide;
      };

      const workerAdvanceIdsToHide = getWorkerRefIdsToHide('worker_advance');
      const workerExpenseAdvanceIdsToHide = getWorkerRefIdsToHide('worker_expense_advance');

      const bankTxForDisplay = (bankTx || []).filter((t: any) => {
        const refId = t?.reference_id ? String(t.reference_id) : '';
        if (t?.reference_type === 'worker_advance' && refId && workerAdvanceIdsToHide.has(refId)) return false;
        if (t?.reference_type === 'worker_expense_advance' && refId && workerExpenseAdvanceIdsToHide.has(refId)) return false;
        return true;
      });
      
      if (bankTxForDisplay) {
        bankTxForDisplay.forEach((tx: any) => {
          transactions.push({
            id: tx.id,
            date: tx.transaction_date,
            time: tx.transaction_time ?? null,
            createdAt: tx.created_at ?? null,
            description: tx.description,
            category: tx.category || 'Transação Bancária',
            type: tx.transaction_type as 'income' | 'expense',
            amount: Number(tx.amount),
            account_id: tx.bank_account_id,
            account_name: (tx.bank_accounts as any)?.name || null,
            source: 'bank_transactions'
          });
        });
      }

      // 2. Events with payments (only show if is_paid = true)
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('is_paid', true);
      
      if (events) {
        for (const event of events) {
          // Main payment - only add if payment_amount > 0
          if (event.payment_amount && event.payment_amount > 0) {
            // Check if already exists in bank_transactions
            const exists = transactions.some(
              t => t.source === 'bank_transactions' && 
                   t.description.toLowerCase().includes(event.name.toLowerCase()) && 
                   t.type === 'income'
            );
            
            if (!exists) {
              // Find account by name (case insensitive)
              const matchedAccount = findBankAccountByName(bankAccounts, event.payment_bank_account);
              const accountId = matchedAccount?.id || null;
              const accountName = matchedAccount?.name || event.payment_bank_account || null;
              
              transactions.push({
                id: `event-payment-${event.id}`,
                date: event.payment_date || event.event_date,
                description: `Pagamento Evento: ${event.name}`,
                category: 'Receita de Eventos',
                type: 'income',
                amount: Number(event.payment_amount),
                account_id: accountId,
                account_name: accountName,
                source: 'events'
              });
            }
          }
          
          // Remaining payment - only add if is_remaining_paid = true AND remaining_payment_amount > 0
          if (event.is_remaining_paid && event.remaining_payment_amount && event.remaining_payment_amount > 0) {
            const existsRemaining = transactions.some(
              t => t.description.toLowerCase().includes('restante') && 
                   t.description.toLowerCase().includes(event.name.toLowerCase())
            );
            
            if (!existsRemaining) {
              // Find account by name (case insensitive)
              const matchedAccount = findBankAccountByName(bankAccounts, event.remaining_payment_bank_account);
              const accountId = matchedAccount?.id || null;
              const accountName = matchedAccount?.name || event.remaining_payment_bank_account || null;
              
              transactions.push({
                id: `event-remaining-${event.id}`,
                date: event.remaining_payment_date || event.event_date,
                description: `Pagamento Restante: ${event.name}`,
                category: 'Receita de Eventos',
                type: 'income',
                amount: Number(event.remaining_payment_amount),
                account_id: accountId,
                account_name: accountName,
                source: 'events'
              });
            }
          }
        }
      }

      // 3. Event expenses (paid and pending)
      if (eventExpenses) {
        for (const expense of eventExpenses) {
          // Verificar por reference_id (mais confiável que descrição)
          if (existingReferenceIdValues.has(String(expense.id)) ||
              existingReferenceKeys.has(`expense-${expense.id}`)) {
            continue;
          }

          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.toLowerCase().includes(expense.description.toLowerCase()) &&
                 t.type === 'expense' &&
                 Math.abs(t.amount - expense.total_price) < 0.01
          );
          
          if (!exists) {
            // Find account by name (case insensitive) - expense_bank_account is a string name, not an ID
            const accountName = expense.expense_bank_account || expense.payment_bank_account || null;
            const matchedAccount = findBankAccountByName(bankAccounts, accountName);
            
            transactions.push({
              id: `event-expense-${expense.id}`,
              date: expense.expense_date || expense.payment_date || expense.created_at.split('T')[0],
              description: `Despesa Evento: ${expense.description}${(expense.events as any)?.name ? ` - ${(expense.events as any).name}` : ''}`,
              category: expense.category,
              type: 'expense',
              amount: Number(expense.total_price),
              account_id: matchedAccount?.id || null,
              account_name: matchedAccount?.name || accountName,
              source: 'event_expenses'
            });
          }
        }
      }

      // 4. Company expenses (paid and pending)
      const { data: companyExpenses } = await supabase
        .from('company_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '');
      
      if (companyExpenses) {
        for (const expense of companyExpenses) {
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.toLowerCase().includes(expense.description.toLowerCase()) &&
                 t.type === 'expense' &&
                 Math.abs(t.amount - expense.total_price) < 0.01
          );
          
          if (!exists) {
            // Find account by name (case insensitive)
            const accountName = expense.expense_bank_account || expense.payment_bank_account || null;
            const matchedAccount = findBankAccountByName(bankAccounts, accountName);
            
            transactions.push({
              id: `company-expense-${expense.id}`,
              date: expense.expense_date || expense.payment_date || expense.created_at.split('T')[0],
              description: `Despesa Empresa: ${expense.description}`,
              category: expense.category,
              type: 'expense',
              amount: Number(expense.total_price),
              account_id: matchedAccount?.id || null,
              account_name: matchedAccount?.name || accountName,
              source: 'company_expenses'
            });
          }
        }
      }

      // 5. Daily rates paid
      const { data: dailyRates } = await supabase
        .from('daily_rates')
        .select('*, events(name), bank_accounts(name)')
        .eq('is_finalized', true);
      
      if (dailyRates) {
        for (const rate of dailyRates) {
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.includes(rate.worker_name) &&
                 t.description.toLowerCase().includes('diária')
          );
          
          if (!exists) {
            transactions.push({
              id: `daily-rate-${rate.id}`,
              date: rate.date,
              description: `Diária: ${rate.worker_name}${(rate.events as any)?.name ? ` - ${(rate.events as any).name}` : ''}`,
              category: 'Diárias',
              type: 'expense',
              amount: Number(rate.amount),
              account_id: rate.bank_account_id,
              account_name: (rate.bank_accounts as any)?.name || null,
              source: 'daily_rates'
            });
          }
        }
      }

      // 6. Collaborator payments paid
      const { data: collabPayments } = await supabase
        .from('collaborator_payments')
        .select('*, collaborators(name), events(name), bank_accounts(name)')
        .eq('is_paid', true);
      
      if (collabPayments) {
        for (const payment of collabPayments) {
          // Pagamentos marcados como pagos já estão na transação total do relatório
          if (payment.is_paid) continue;
          
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.includes((payment.collaborators as any)?.name || '')
          );
          
          if (!exists) {
            transactions.push({
              id: `collab-payment-${payment.id}`,
              date: payment.payment_date,
              description: `Pagamento: ${(payment.collaborators as any)?.name || 'Colaborador'}${(payment.events as any)?.name ? ` - ${(payment.events as any).name}` : ''}`,
              category: 'Pagamento Colaborador',
              type: 'expense',
              amount: Number(payment.amount),
              account_id: payment.bank_account_id,
              account_name: (payment.bank_accounts as any)?.name || null,
              source: 'collaborator_payments'
            });
          }
        }
      }

      // 7. Collaborator advances (adiantamentos)
      const { data: collabAdvances } = await supabase
        .from('collaborator_advances')
        .select('*, collaborators(name), bank_accounts(name)');
      
      if (collabAdvances) {
        for (const advance of collabAdvances) {
          const collabName = (advance.collaborators as any)?.name || '';
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && (
              // Verificar por descrição (adiantamento ou vale)
              ((t.description.toLowerCase().includes('adiantamento') || t.description.toLowerCase().includes('vale')) &&
               t.description.includes(collabName)) ||
              // Verificar por reference_id direto (trigger cria com reference_type='collaborator_vale')
              (t.id === advance.id)
            )
          ) || (bankTx || []).some((t: any) =>
            t.reference_type === 'collaborator_vale' && t.reference_id === advance.id
          );
          
          if (!exists) {
            transactions.push({
              id: `collab-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Adiantamento: ${(advance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Adiantamento Colaborador',
              type: 'expense',
              amount: Number(advance.amount),
              account_id: advance.bank_account_id,
              account_name: (advance.bank_accounts as any)?.name || null,
              source: 'collaborator_advances'
            });
          }
        }
      }

      // 8. Collaborator expense advances (adiantamentos de despesas)
      const { data: collabExpenseAdvances } = await supabase
        .from('collaborator_expense_advances')
        .select('*, collaborators(name), bank_accounts(name)');
      
      if (collabExpenseAdvances) {
        for (const advance of collabExpenseAdvances) {
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.toLowerCase().includes('adiantamento despesa') &&
                 t.description.includes((advance.collaborators as any)?.name || '')
          );
          
          if (!exists) {
            transactions.push({
              id: `collab-expense-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Adiantamento Despesa: ${(advance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Adiantamento Despesa Colaborador',
              type: 'expense',
              amount: Number(advance.amount),
              account_id: advance.bank_account_id,
              account_name: (advance.bank_accounts as any)?.name || null,
              source: 'collaborator_expense_advances'
            });
          }
        }
      }

      // 9. Collaborator food allowances (diárias de alimentação)
      const { data: collabFoodAllowances } = await supabase
        .from('collaborator_food_allowances')
        .select('*, collaborators(name), bank_accounts(name)');
      
      if (collabFoodAllowances) {
        for (const allowance of collabFoodAllowances) {
          const exists = transactions.some(
            t => t.source === 'bank_transactions' && 
                 t.description.toLowerCase().includes('alimentação') &&
                 t.description.includes((allowance.collaborators as any)?.name || '')
          );
          
          if (!exists) {
            transactions.push({
              id: `collab-food-allowance-${allowance.id}`,
              date: allowance.allowance_date,
              description: `Alimentação: ${(allowance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Alimentação Colaborador',
              type: 'expense',
              amount: Number(allowance.amount),
              account_id: allowance.bank_account_id,
              account_name: (allowance.bank_accounts as any)?.name || null,
              source: 'collaborator_food_allowances'
            });
          }
        }
      }

      // 10. Worker advances (vales de diaristas) - só adiciona se não existir em bank_transactions
      const { data: workerAdvances } = await supabase
        .from('worker_advances')
        .select('*, bank_accounts(name)');
      
      if (workerAdvances) {
        for (const advance of workerAdvances) {
          // Checar se já existe via trigger (reference_type = worker_advance)
          const refKey = `worker_advance-${advance.id}`;
           if (existingReferenceKeys.has(refKey)) {
            continue; // Já existe no extrato
          }
          
          transactions.push({
            id: `worker-advance-${advance.id}`,
            date: advance.advance_date,
            description: `Vale Diarista: ${advance.worker_name || 'Diarista'}`,
            category: 'Vale Diarista',
            type: 'expense',
            amount: Number(advance.amount),
            account_id: advance.bank_account_id,
            account_name: (advance.bank_accounts as any)?.name || null,
            source: 'worker_advances'
          });
        }
      }

      // 11. Worker expense advances (adiantamentos de despesas de diaristas)
      const { data: workerExpenseAdvances } = await supabase
        .from('worker_expense_advances')
        .select('*, bank_accounts(name)');
      
      if (workerExpenseAdvances) {
        for (const advance of workerExpenseAdvances) {
          // Checar se existe via trigger (por segurança)
          const refKey = `worker_expense_advance-${advance.id}`;
          if (existingReferenceKeys.has(refKey)) {
            continue;
          }
          
          transactions.push({
            id: `worker-expense-advance-${advance.id}`,
            date: advance.advance_date,
            description: `Adiantamento Despesa Diarista: ${advance.worker_name || 'Diarista'}`,
            category: 'Adiantamento Despesa Diarista',
            type: 'expense',
            amount: Number(advance.amount),
            account_id: advance.bank_account_id,
            account_name: (advance.bank_accounts as any)?.name || null,
            source: 'worker_expense_advances'
          });
        }
      }

      // Normalize to YYYY-MM-DD to avoid timezone shifting (date-only parsed as UTC)
      // and sort by date descending (lexicographic works for YYYY-MM-DD)
      return transactions
        .map((t) => ({ ...t, date: toDateOnly(t.date) }))
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: bankAccounts.length > 0
  });

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return unifiedTransactions.filter(transaction => {
      // Filter by account
      if (selectedAccount !== 'all' && transaction.account_id !== selectedAccount) {
        return false;
      }

      // Filter by transaction type
      if (transactionType !== 'all' && transaction.type !== transactionType) {
        return false;
      }

      // Filter by date - use date string comparison (YYYY-MM-DD format)
      // Extract just the date part to avoid timezone issues
      const txDateOnly = transaction.date.split('T')[0];
      
      // Filter by start date
      if (startDate && txDateOnly < startDate) {
        return false;
      }

      // Filter by end date
      if (endDate && txDateOnly > endDate) {
        return false;
      }

      return true;
    });
  }, [unifiedTransactions, selectedAccount, transactionType, startDate, endDate]);

  const normalizeCategory = useCallback((value?: string | null) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim(), []);

  const isTransferCategory = useCallback((category?: string | null) => {
    const c = normalizeCategory(category);
    return c === 'transferencia' || c === 'transferencias';
  }, [normalizeCategory]);

  const isPotentialTransferText = useCallback((text?: string | null) => {
    const t = normalizeCategory(text);
    // Evita considerar "pix" sozinho como transferência (pode ser pagamento real)
    return t.includes('transfer') || t.includes('transf') || t.includes('ted') || t.includes('doc');
  }, [normalizeCategory]);

  // Detecta transferências entre contas pelo padrão de par (mesma data+valor: 1 entrada + 1 saída)
  const transferTxIds = useMemo(() => {
    const keyToGroup = new Map<
      string,
      { incomes: UnifiedTransaction[]; expenses: UnifiedTransaction[] }
    >();

    for (const tx of filteredTransactions) {
      if (!isTransferCategory(tx.category) && !isPotentialTransferText(tx.description)) continue;

      const cents = Math.round((Number(tx.amount) || 0) * 100);
      const key = `${toDateOnly(tx.date)}|${cents}`;
      const group = keyToGroup.get(key) || { incomes: [], expenses: [] };

      if (tx.type === 'income') group.incomes.push(tx);
      if (tx.type === 'expense') group.expenses.push(tx);

      keyToGroup.set(key, group);
    }

    const ids = new Set<string>();
    for (const group of keyToGroup.values()) {
      if (group.incomes.length === 0 || group.expenses.length === 0) continue;

      const hasDifferentAccounts = group.incomes.some((i) =>
        group.expenses.some((e) => String(i.account_id || '') !== String(e.account_id || ''))
      );
      if (!hasDifferentAccounts) continue;

      group.incomes.forEach((i) => ids.add(i.id));
      group.expenses.forEach((e) => ids.add(e.id));
    }
    return ids;
  }, [filteredTransactions, isPotentialTransferText, isTransferCategory]);

  const isTransferTx = useCallback((tx: UnifiedTransaction) =>
    isTransferCategory(tx.category) || transferTxIds.has(tx.id),
  [isTransferCategory, transferTxIds]);

  // Calculate totals (excluindo transferências entre contas - são apenas fluxo de caixa interno)
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income' && !isTransferTx(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const expense = filteredTransactions
      .filter(t => t.type === 'expense' && !isTransferTx(t))
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      income,
      expense,
      balance: income - expense
    };
  }, [filteredTransactions, isTransferTx]);

  const clearFilters = () => {
    setSelectedAccount('all');
    setTransactionType('all');
    setStartDate('');
    setEndDate('');
  };

  const exportToCSV = () => {
    const headers = ['Data e hora', 'Conta', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Origem'];
    const rows = filteredTransactions.map(t => [
      formatTransactionDateTime(t.date, t.time, t.createdAt),
      t.account_name || '-',
      t.description,
      t.category || '-',
      t.type === 'income' ? 'Entrada' : 'Saída',
      t.amount.toFixed(2).replace('.', ','),
      t.source
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-contas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Relatório de Contas</h1>
            <p className="text-muted-foreground">Visualize e filtre suas transações</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>


      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as contas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={transactionType} onValueChange={setTransactionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="income">Entradas</SelectItem>
                  <SelectItem value="expense">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entradas</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatValue(totals.income)}
                </p>
              </div>
              <ArrowUpCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Saídas</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatValue(totals.expense)}
                </p>
              </div>
              <ArrowDownCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saldo</p>
                <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatValue(totals.balance)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Transações ({filteredTransactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando transações...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma transação encontrada com os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data e hora</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map(transaction => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {formatTransactionDateTime(transaction.date, transaction.time, transaction.createdAt)}
                      </TableCell>
                      <TableCell>
                        {transaction.account_name || '-'}
                      </TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell>{transaction.category || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={transaction.type === 'income' ? 'default' : 'destructive'}>
                          {transaction.type === 'income' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatValue(transaction.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
