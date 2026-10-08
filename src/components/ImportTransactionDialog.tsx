import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, ArrowDownCircle, Calendar, Filter, Users, HardHat, Repeat, Warehouse, PartyPopper } from "lucide-react";

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  balanceAfter?: number;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  client_name?: string;
}

interface ImportTransactionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: Transaction[];
  accountId: string;
  onImportComplete: () => void | Promise<void>;
}

type ExpenseType = 'company' | 'income' | 'event' | 'collaborator' | 'worker' | 'fixed_expense';
type CollaboratorLocationType = 'galpao' | 'evento';

interface Collaborator {
  id: string;
  name: string;
}

interface Worker {
  name: string;
}

interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
}

// Categories per expense type
const COMPANY_EXPENSE_CATEGORIES = [
  'Material de Escritório',
  'Manutenção',
  'Combustível',
  'Alimentação',
  'Transporte',
  'Equipamentos',
  'Serviços',
  'Impostos',
  'Aluguel',
  'Utilidades (Água, Luz, Internet)',
  'Marketing',
  'Outros'
];

const EVENT_EXPENSE_CATEGORIES = [
  'Materiais do Evento',
  'Decoração',
  'Iluminação',
  'Som',
  'Transporte',
  'Alimentação Equipe',
  'Hospedagem',
  'Aluguel de Equipamentos',
  'Mão de Obra',
  'Fornecedores',
  'Outros'
];

const INCOME_CATEGORIES = [
  'Pagamento de Evento',
  'Sinal/Entrada',
  'Restante do Pagamento',
  'Aluguel de Equipamentos',
  'Serviços Avulsos',
  'Reembolso',
  'Outros'
];

// Categorias específicas para receita de evento
const EVENT_INCOME_CATEGORIES = [
  'Pagamento Total',
  'Restante do Pagamento',
  'Sinal/Entrada',
  'Outros'
];

const COLLABORATOR_CATEGORIES = [
  'Vale',
  'Adiantamento de Despesa',
  'Alimentação',
  'Pagamento',
  'Salário',
  'Eventos',
  'Outros'
];

const WORKER_CATEGORIES = [
  'Diária',
  'Vale/Adiantamento',
  'Adiantamento de Notinhas',
  'Alimentação',
  'Eventos',
  'Outros'
];

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' }
];

export const ImportTransactionDialog: React.FC<ImportTransactionDialogProps> = ({
  isOpen,
  onOpenChange,
  transactions,
  accountId,
  onImportComplete
}) => {
  const [expenseType, setExpenseType] = useState<ExpenseType>('company');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [events, setEvents] = useState<Event[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('');
  const [selectedWorkerName, setSelectedWorkerName] = useState<string>('');
  const [selectedRecurringExpenseId, setSelectedRecurringExpenseId] = useState<string>('');
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingCollaborators, setIsLoadingCollaborators] = useState(false);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [isLoadingRecurringExpenses, setIsLoadingRecurringExpenses] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Collaborator location dialog state
  const [showCollaboratorLocationDialog, setShowCollaboratorLocationDialog] = useState(false);
  const [collaboratorLocationType, setCollaboratorLocationType] = useState<CollaboratorLocationType>('galpao');
  const [collaboratorEventId, setCollaboratorEventId] = useState<string>('');
  const [collaboratorEventMonth, setCollaboratorEventMonth] = useState<number>(new Date().getMonth() + 1);
  const [collaboratorEventYear, setCollaboratorEventYear] = useState<number>(new Date().getFullYear());
  
  // Worker location dialog state (similar to collaborator)
  const [showWorkerLocationDialog, setShowWorkerLocationDialog] = useState(false);
  const [workerLocationType, setWorkerLocationType] = useState<CollaboratorLocationType>('galpao');
  const [workerEventId, setWorkerEventId] = useState<string>('');
  const [workerEventMonth, setWorkerEventMonth] = useState<number>(new Date().getMonth() + 1);
  const [workerEventYear, setWorkerEventYear] = useState<number>(new Date().getFullYear());
  
  // Income location dialog state (for revenue)
  const [showIncomeLocationDialog, setShowIncomeLocationDialog] = useState(false);
  const [incomeLocationType, setIncomeLocationType] = useState<CollaboratorLocationType>('galpao');
  const [incomeEventId, setIncomeEventId] = useState<string>('');
  const [incomeEventMonth, setIncomeEventMonth] = useState<number>(new Date().getMonth() + 1);
  const [incomeEventYear, setIncomeEventYear] = useState<number>(new Date().getFullYear());
  
  const { toast } = useToast();

  // Reset category and selections when expense type changes
  useEffect(() => {
    setCategory('');
    setSelectedEventId('');
    setSelectedCollaboratorId('');
    setSelectedWorkerName('');
    setSelectedRecurringExpenseId('');
    // Reset collaborator location state
    setCollaboratorLocationType('galpao');
    setCollaboratorEventId('');
    // Reset worker location state
    setWorkerLocationType('galpao');
    setWorkerEventId('');
    // Reset income location state
    setIncomeLocationType('galpao');
    setIncomeEventId('');
  }, [expenseType]);

  // Filter events by collaborator event month/year
  const filteredCollaboratorEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date + 'T12:00:00');
      return eventDate.getMonth() + 1 === collaboratorEventMonth && eventDate.getFullYear() === collaboratorEventYear;
    });
  }, [events, collaboratorEventMonth, collaboratorEventYear]);

  // Filter events by worker event month/year
  const filteredWorkerEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date + 'T12:00:00');
      return eventDate.getMonth() + 1 === workerEventMonth && eventDate.getFullYear() === workerEventYear;
    });
  }, [events, workerEventMonth, workerEventYear]);

  // Filter events by income event month/year
  const filteredIncomeEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date + 'T12:00:00');
      return eventDate.getMonth() + 1 === incomeEventMonth && eventDate.getFullYear() === incomeEventYear;
    });
  }, [events, incomeEventMonth, incomeEventYear]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchEvents();
      fetchCollaborators();
      fetchWorkers();
      fetchRecurringExpenses();
    }
  }, [isOpen]);

  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date, client_name')
        .order('event_date', { ascending: false })
        .limit(200);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de eventos",
        variant: "destructive"
      });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const fetchCollaborators = async () => {
    setIsLoadingCollaborators(true);
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select('id, name')
        .in('status', ['active', 'ativo'])
        .order('name', { ascending: true });

      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error('Erro ao carregar colaboradores:', error);
    } finally {
      setIsLoadingCollaborators(false);
    }
  };

  const fetchWorkers = async () => {
    setIsLoadingWorkers(true);
    try {
      // Fetch from workers table (registered workers)
      const { data: workersData, error: workersError } = await supabase
        .from('workers')
        .select('id, name')
        .order('name', { ascending: true });

      if (workersError) throw workersError;
      
      // Also get unique worker names from daily_rates for backward compatibility
      const { data: ratesData, error: ratesError } = await supabase
        .from('daily_rates')
        .select('worker_name')
        .order('worker_name', { ascending: true });
      
      if (ratesError) throw ratesError;
      
      // Combine both sources and get unique names
      const workersFromTable = workersData?.map(w => w.name) || [];
      const workersFromRates = ratesData?.map(d => d.worker_name) || [];
      const allWorkerNames = [...new Set([...workersFromTable, ...workersFromRates])];
      
      setWorkers(allWorkerNames.sort().map(name => ({ name })));
    } catch (error) {
      console.error('Erro ao carregar diaristas:', error);
    } finally {
      setIsLoadingWorkers(false);
    }
  };

  const fetchRecurringExpenses = async () => {
    setIsLoadingRecurringExpenses(true);
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('id, name, category, amount')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setRecurringExpenses(data || []);
    } catch (error) {
      console.error('Erro ao carregar despesas fixas:', error);
    } finally {
      setIsLoadingRecurringExpenses(false);
    }
  };

  // Filter events by selected month/year
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.event_date + 'T12:00:00');
      return eventDate.getMonth() + 1 === selectedMonth && eventDate.getFullYear() === selectedYear;
    });
  }, [events, selectedMonth, selectedYear]);

  // Get categories based on expense type
  const availableCategories = useMemo(() => {
    switch (expenseType) {
      case 'company':
        return COMPANY_EXPENSE_CATEGORIES;
      case 'income':
        // When Evento is selected for income, use event-specific income categories
        if (incomeLocationType === 'evento') {
          return EVENT_INCOME_CATEGORIES;
        }
        return INCOME_CATEGORIES;
      case 'event':
        return EVENT_EXPENSE_CATEGORIES;
      case 'collaborator':
        return COLLABORATOR_CATEGORIES;
      case 'worker':
        // When Galpão is selected, remove "Eventos" category
        if (workerLocationType === 'galpao') {
          return WORKER_CATEGORIES.filter(cat => cat !== 'Eventos');
        }
        return WORKER_CATEGORIES;
      default:
        return [];
    }
  }, [expenseType, workerLocationType, incomeLocationType]);

  // Generate year options
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const handleImport = async () => {
    if (expenseType === 'event' && !selectedEventId) {
      toast({
        title: "Atenção",
        description: "Selecione um evento para vincular as transações",
        variant: "destructive"
      });
      return;
    }

    if (expenseType === 'collaborator' && !selectedCollaboratorId) {
      toast({
        title: "Atenção",
        description: "Selecione um colaborador para vincular as transações",
        variant: "destructive"
      });
      return;
    }

    if (expenseType === 'worker' && !selectedWorkerName) {
      toast({
        title: "Atenção",
        description: "Selecione um diarista para vincular as transações",
        variant: "destructive"
      });
      return;
    }

    if (expenseType === 'fixed_expense' && !selectedRecurringExpenseId) {
      toast({
        title: "Atenção",
        description: "Selecione uma despesa fixa para vincular as transações",
        variant: "destructive"
      });
      return;
    }

    // ============================================================
    // VERIFICAÇÃO ANTI-DUPLICIDADE
    // Antes de importar, checa se já existe algum lançamento
    // (bank_transactions ou nas tabelas de origem) com mesma
    // conta + data + valor. Se sim, pede confirmação.
    // ============================================================
    try {
      const duplicates: string[] = [];
      for (const t of transactions) {
        const amt = Number(t.amount);
        if (!amt || !t.date) continue;

        // 1) bank_transactions (extrato)
        const { data: bt } = await supabase
          .from('bank_transactions')
          .select('id, description')
          .eq('bank_account_id', accountId)
          .eq('transaction_date', t.date)
          .eq('amount', amt)
          .limit(1);
        if (bt && bt.length > 0) {
          duplicates.push(`• ${t.date} R$ ${amt.toFixed(2)} — já existe no extrato`);
          continue;
        }

        // 2) Tabelas de origem (podem existir sem bank_transaction quando
        //    o registro foi criado em contexto de evento)
        const runCheck = async (
          table: any,
          dateField: string,
          label: string
        ): Promise<{ found: boolean; label: string }> => {
          const { data } = await (supabase.from(table) as any)
            .select('id')
            .eq('bank_account_id', accountId)
            .eq(dateField, t.date)
            .eq('amount', amt)
            .limit(1);
          return { found: !!(data && data.length > 0), label };
        };

        const results = await Promise.all([
          runCheck('collaborator_advances', 'advance_date', 'Vale de colaborador'),
          runCheck('collaborator_expense_advances', 'advance_date', 'Adiantamento de despesa (colaborador)'),
          runCheck('collaborator_food_allowances', 'allowance_date', 'Alimentação (colaborador)'),
          runCheck('collaborator_payments', 'payment_date', 'Pagamento de colaborador'),
          runCheck('worker_advances', 'advance_date', 'Vale de diarista'),
          runCheck('worker_expense_advances', 'advance_date', 'Adiantamento de notinhas (diarista)'),
          runCheck('worker_food_allowances', 'allowance_date', 'Alimentação (diarista)'),
          runCheck('daily_rates', 'date', 'Diária'),
        ]);
        const hit = results.find((r) => r.found);
        if (hit) {
          duplicates.push(`• ${t.date} R$ ${amt.toFixed(2)} — já existe como "${hit.label}"`);
        }
      }

      if (duplicates.length > 0) {
        const proceed = window.confirm(
          `Foram encontrados lançamentos que já existem no sistema:\n\n${duplicates.join('\n')}\n\n` +
          `Isso pode significar que essa(s) transação(ões) já foi(ram) importada(s) antes.\n\n` +
          `Deseja importar mesmo assim?`
        );
        if (!proceed) {
          return;
        }
      }
    } catch (dupErr) {
      console.warn('Duplicate check failed (continuing):', dupErr);
    }

    setIsImporting(true);

    try {
      // Resolve bank account name once (some tables store account name, while others store account id)
      let bankAccountName = '';
      try {
        const { data: accountRow, error: accountRowError } = await supabase
          .from('bank_accounts')
          .select('name')
          .eq('id', accountId)
          .single();

        if (!accountRowError) {
          bankAccountName = accountRow?.name || '';
        }
      } catch {
        // noop (fallback to empty string)
      }

      for (const transaction of transactions) {
        if (expenseType === 'event' && selectedEventId) {
          // Insert into event_expenses (store bank account NAME on expense_bank_account)
          const { data: insertedExpense, error: expenseError } = await supabase
            .from('event_expenses')
            .insert({
              event_id: selectedEventId,
              description: transaction.description,
              total_price: transaction.amount,
              expense_date: transaction.date,
              category: category || transaction.category || 'Outros',
              notes: notes || null,
              is_paid: true,
              payment_date: transaction.date,
              expense_bank_account: bankAccountName || null,
              payment_bank_account: bankAccountName || null,
              is_finalized: true
            })
            .select('id')
            .single();

          if (expenseError) throw expenseError;

          // Also insert into bank_transactions for the statement (link to the expense id)
          const { error: bankError } = await supabase
            .from('bank_transactions')
            .insert({
              bank_account_id: accountId,
              description: transaction.description,
              amount: transaction.amount,
              transaction_type: transaction.type,
              category: category || transaction.category || 'Outros',
              transaction_date: transaction.date,
              // IMPORTANT: use the same reference_type used by sync_bank_transactions
              reference_type: 'expense',
              reference_id: insertedExpense?.id,
              balance_after: typeof transaction.balanceAfter === 'number' ? transaction.balanceAfter : null,
              notes: notes || null
            });

          if (bankError) throw bankError;

        } else if (expenseType === 'company') {
          // Insert into company_expenses (store bank account NAME on expense_bank_account)
          const { data: insertedCompanyExpense, error: companyError } = await supabase
            .from('company_expenses')
            .insert({
              description: transaction.description,
              total_price: transaction.amount,
              expense_date: transaction.date,
              category: category || transaction.category || 'Outros',
              notes: notes || null,
              is_paid: true,
              payment_date: transaction.date,
              expense_bank_account: bankAccountName || null,
              payment_bank_account: bankAccountName || null
            })
            .select('id')
            .single();

          if (companyError) throw companyError;

          // Also insert into bank_transactions (link to the company_expense id)
          const { error: bankError } = await supabase
            .from('bank_transactions')
            .insert({
              bank_account_id: accountId,
              description: transaction.description,
              amount: transaction.amount,
              transaction_type: transaction.type,
              category: category || transaction.category || 'Outros',
              transaction_date: transaction.date,
              reference_type: 'company_expense',
              reference_id: insertedCompanyExpense?.id,
              balance_after: typeof transaction.balanceAfter === 'number' ? transaction.balanceAfter : null,
              notes: notes || null
            });

          if (bankError) throw bankError;

        } else if (expenseType === 'income') {
          const isEventContext = incomeLocationType === 'evento' && !!incomeEventId;
          const eventName = incomeEventId ? events.find(e => e.id === incomeEventId)?.name || '' : '';
          const incomeDescription = isEventContext 
            ? `${category || 'Receita'}: ${eventName}${transaction.description ? ` - ${transaction.description}` : ''}`
            : transaction.description;
          
          if (isEventContext) {
            // Update event payment fields based on category
            const selectedEvent = events.find(e => e.id === incomeEventId);
            if (selectedEvent) {
              const updateData: Record<string, any> = {};
              
              if (category === 'Pagamento Total') {
                updateData.payment_amount = transaction.amount;
                updateData.is_paid = true;
                updateData.payment_date = transaction.date;
                updateData.payment_bank_account = bankAccountName;
                updateData.payment_type = 'total';
              } else if (category === 'Restante do Pagamento') {
                updateData.remaining_payment_amount = transaction.amount;
                updateData.is_remaining_paid = true;
                updateData.remaining_payment_date = transaction.date;
                updateData.remaining_payment_bank_account = bankAccountName;
              } else if (category === 'Sinal/Entrada') {
                updateData.payment_amount = transaction.amount;
                updateData.is_paid = true;
                updateData.payment_date = transaction.date;
                updateData.payment_bank_account = bankAccountName;
                updateData.payment_type = 'entrada';
              }
              
              if (Object.keys(updateData).length > 0) {
                const { error: updateEventError } = await supabase
                  .from('events')
                  .update(updateData)
                  .eq('id', incomeEventId);
                
                if (updateEventError) {
                  console.error('Error updating event payment:', updateEventError);
                }
              }
            }
          }
          
          // Insert into bank_transactions as income
          const { error: bankError } = await supabase
            .from('bank_transactions')
            .insert({
              bank_account_id: accountId,
              description: incomeDescription,
              amount: transaction.amount,
              transaction_type: 'income',
              category: category || 'Receitas',
              transaction_date: transaction.date,
              reference_type: isEventContext ? 'event_income' : 'manual_income',
              reference_id: isEventContext ? incomeEventId : null,
              balance_after: typeof transaction.balanceAfter === 'number' ? transaction.balanceAfter : null,
              notes: notes || null
            });

          if (bankError) throw bankError;

        } else if (expenseType === 'collaborator' && selectedCollaboratorId) {
          // Get collaborator name for description
          const collaborator = collaborators.find(c => c.id === selectedCollaboratorId);
          const collaboratorName = collaborator?.name || 'Colaborador';

          const isEventContext = collaboratorLocationType === 'evento' && !!collaboratorEventId;
          
          // Determine location type prefix for description
          const eventName = collaboratorEventId ? events.find(e => e.id === collaboratorEventId)?.name || '' : '';
          const locationPrefix = collaboratorLocationType === 'evento' 
            ? `Evento${eventName ? ` (${eventName})` : ''}`
            : 'Galpão';

          // Use a canonical description so FinancialManagement can reliably de-duplicate
          // (it uses string includes checks like "adiantamento despesa" / "adiantamento" / "alimentação")
          const canonicalPrefix = (() => {
            switch (category) {
              case 'Adiantamento de Despesa':
                return 'Adiantamento Despesa';
              case 'Vale':
                return 'Adiantamento';
              case 'Alimentação':
                return 'Alimentação';
              case 'Pagamento':
                return 'Pagamento Colaborador';
              case 'Salário':
                return 'Salário';
              case 'Eventos':
                return 'Evento';
              default:
                return 'Colaborador';
            }
          })();

          const canonicalDescription = `${canonicalPrefix}: ${collaboratorName}` +
            `${isEventContext && eventName ? ` (Evento: ${eventName})` : ''}` +
            `${transaction.description ? ` - ${transaction.description}` : ''}`;

          // Track created collaborator record id (to optionally reference it)
          let collaboratorRecordId: string | null = null;

          // Insert based on category
          if (category === 'Vale') {
            const { data, error } = await supabase
              .from('collaborator_advances')
              .insert({
                collaborator_id: selectedCollaboratorId,
                amount: transaction.amount,
                advance_date: transaction.date,
                bank_account_id: accountId,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Adiantamento de Despesa') {
            const { data, error } = await supabase
              .from('collaborator_expense_advances')
              .insert({
                collaborator_id: selectedCollaboratorId,
                amount: transaction.amount,
                advance_date: transaction.date,
                bank_account_id: accountId,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Alimentação') {
            const { data, error } = await supabase
              .from('collaborator_food_allowances')
              .insert({
                collaborator_id: selectedCollaboratorId,
                amount: transaction.amount,
                allowance_date: transaction.date,
                bank_account_id: accountId,
                allowance_type: collaboratorLocationType,
                event_id: collaboratorLocationType === 'evento' ? collaboratorEventId : null,
                notes: notes || transaction.description
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Pagamento') {
            const { data, error } = await supabase
              .from('collaborator_payments')
              .insert({
                collaborator_id: selectedCollaboratorId,
                amount: transaction.amount,
                payment_date: transaction.date,
                bank_account_id: accountId,
                is_paid: true,
                event_id: collaboratorLocationType === 'evento' ? collaboratorEventId : null,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Salário') {
            // Insert salary into collaborator_monthly_salaries
            // IMPORTANT: Use 0-indexed month (getMonth()) to match Collaborators.tsx selectedMonthFilter
            const salaryDate = new Date(transaction.date + 'T12:00:00');
            const salaryMonth = salaryDate.getMonth(); // 0-indexed: Janeiro = 0, Dezembro = 11
            const salaryYear = salaryDate.getFullYear();
            
            const { data, error } = await supabase
              .from('collaborator_monthly_salaries')
              .insert({
                collaborator_id: selectedCollaboratorId,
                salary_amount: transaction.amount,
                salary_month: salaryMonth,
                salary_year: salaryYear
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Eventos') {
            // Insert into collaborator_payments linked to the selected event
            const { data, error } = await supabase
              .from('collaborator_payments')
              .insert({
                collaborator_id: selectedCollaboratorId,
                amount: transaction.amount,
                payment_date: transaction.date,
                bank_account_id: accountId,
                is_paid: true,
                event_id: collaboratorLocationType === 'evento' ? collaboratorEventId : null,
                notes: `[Evento] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            collaboratorRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          }

          // Determine reference type for collaborator records
          const collaboratorReferenceType = (() => {
            switch (category) {
              case 'Vale':
                return 'collaborator_vale';
              case 'Adiantamento de Despesa':
                return 'collab_expense_advance';
              case 'Alimentação':
                return 'food_allowance';
              case 'Pagamento':
                return 'collab_payment';
              case 'Salário':
                return 'collaborator_salary';
              case 'Eventos':
                return 'collaborator_event';
              default:
                return 'collaborator_import';
            }
          })();

          // If linked to an event, add to event_expenses.
          // DO NOT create a separate bank_transaction - the event_expense itself will be
          // synced to bank_transactions via the sync function or shown in financial flows.
          // This prevents duplicates in Fluxo de Caixa/Extrato.
          if (isEventContext && collaboratorEventId) {
            // For "Vale" category, the collaborator_advances trigger already creates
            // a bank_transaction. Setting expense_bank_account to null prevents the
            // event_expense sync from generating a SECOND transaction (double debit).
            const triggerHandlesTransaction = category === 'Vale';

            const { error: eventExpenseError } = await supabase
              .from('event_expenses')
              .insert({
                event_id: collaboratorEventId,
                description: canonicalDescription,
                total_price: transaction.amount,
                unit_price: transaction.amount,
                quantity: 1,
                expense_date: transaction.date,
                category: category || 'Colaboradores',
                notes: notes || null,
                is_paid: true,
                payment_date: transaction.date,
                expense_bank_account: triggerHandlesTransaction ? null : (bankAccountName || ''),
                is_finalized: true,
                // Reference the original collaborator record so we can trace back
                reference_type: collaboratorReferenceType,
                reference_id: collaboratorRecordId
              });

            if (eventExpenseError) throw eventExpenseError;

            // IMPORTANT: We DO NOT create a bank_transaction here!
            // The event_expense entry is sufficient and will be picked up by
            // the financial management system. Creating both would cause duplication.
          } else {
            // Galpão context:
            // For "Vale" category, the collaborator_advances table has a database trigger
            // (create_collaborator_vale_transaction) that automatically creates a bank_transaction.
            // So we must NOT create a manual one here, or it will duplicate.
            const hasTriggerAutoTransaction = category === 'Vale';

            if (!hasTriggerAutoTransaction) {
              const { error: bankError } = await supabase
                .from('bank_transactions')
                .insert({
                  bank_account_id: accountId,
                  description: canonicalDescription,
                  amount: transaction.amount,
                  transaction_type: transaction.type,
                  category: category || 'Colaboradores',
                  transaction_date: transaction.date,
                  reference_type: collaboratorRecordId ? collaboratorReferenceType : null,
                  reference_id: collaboratorRecordId,
                  balance_after: typeof transaction.balanceAfter === 'number' ? transaction.balanceAfter : null,
                  notes: notes || null
                });

              if (bankError) throw bankError;
            }
          }

        } else if (expenseType === 'worker' && selectedWorkerName) {
          const isEventContext = workerLocationType === 'evento' && !!workerEventId;
          
          // Determine location type prefix for description
          const eventName = workerEventId ? events.find(e => e.id === workerEventId)?.name || '' : '';
          const locationPrefix = workerLocationType === 'evento' 
            ? `Evento${eventName ? ` (${eventName})` : ''}`
            : 'Galpão';

          // Use a canonical description for proper tracking
          const canonicalPrefix = (() => {
            switch (category) {
              case 'Diária':
                return 'Diária';
              case 'Vale/Adiantamento':
                return 'Adiantamento';
              case 'Adiantamento de Notinhas':
                return 'Adiantamento Despesa';
              case 'Alimentação':
                return 'Alimentação';
              case 'Eventos':
                return 'Evento';
              default:
                return 'Diarista';
            }
          })();

          const canonicalDescription = `${canonicalPrefix}: ${selectedWorkerName}` +
            `${isEventContext && eventName ? ` (Evento: ${eventName})` : ''}` +
            `${transaction.description ? ` - ${transaction.description}` : ''}`;

          // Track created worker record id (to optionally reference it)
          let workerRecordId: string | null = null;

          // Insert based on category
          if (category === 'Diária') {
            const { data, error } = await supabase
              .from('daily_rates')
              .insert({
                worker_name: selectedWorkerName,
                amount: transaction.amount,
                date: transaction.date,
                bank_account_id: accountId,
                event_id: isEventContext ? workerEventId : null,
                is_finalized: true,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            workerRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Vale/Adiantamento') {
            const { data, error } = await supabase
              .from('worker_advances')
              .insert({
                worker_name: selectedWorkerName,
                amount: transaction.amount,
                advance_date: transaction.date,
                bank_account_id: accountId,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            workerRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Adiantamento de Notinhas') {
            const { data, error } = await supabase
              .from('worker_expense_advances')
              .insert({
                worker_name: selectedWorkerName,
                amount: transaction.amount,
                advance_date: transaction.date,
                bank_account_id: accountId,
                is_finalized: true,
                notes: `[${locationPrefix}] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            workerRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Alimentação') {
            const { data, error } = await supabase
              .from('worker_food_allowances')
              .insert({
                worker_name: selectedWorkerName,
                amount: transaction.amount,
                allowance_date: transaction.date,
                bank_account_id: accountId,
                allowance_type: workerLocationType,
                event_id: isEventContext ? workerEventId : null,
                notes: notes || transaction.description
              })
              .select('id');
            if (error) throw error;
            workerRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          } else if (category === 'Eventos') {
            // Insert daily rate linked to the event
            const { data, error } = await supabase
              .from('daily_rates')
              .insert({
                worker_name: selectedWorkerName,
                amount: transaction.amount,
                date: transaction.date,
                bank_account_id: accountId,
                event_id: workerEventId || null,
                is_finalized: true,
                notes: `[Evento] ${notes || transaction.description}`
              })
              .select('id');
            if (error) throw error;
            workerRecordId = (Array.isArray(data) && data?.[0]?.id) ? data[0].id : null;
          }

          // Determine reference type for worker records
          const workerReferenceType = (() => {
            switch (category) {
              case 'Diária':
                return 'daily_rate';
              case 'Vale/Adiantamento':
                return 'worker_advance';
              case 'Adiantamento de Notinhas':
                return 'worker_expense_advance';
              case 'Alimentação':
                return 'worker_food_allowance';
              case 'Eventos':
                return 'worker_event';
              default:
                return 'worker_import';
            }
          })();

          // If linked to an event, handle event_expenses.
          // IMPORTANT: For 'Diária' and 'Eventos' categories, the database trigger
          // `create_event_expense_from_daily_rate` ALREADY creates an event_expense record
          // automatically when we insert into `daily_rates` with an `event_id`.
          // So we should NOT insert a new event_expense for these categories - 
          // instead, we update the auto-created one with additional info.
          if (isEventContext && workerEventId) {
            const triggerAutoCreatesExpense = category === 'Diária' || category === 'Eventos';
            
            if (triggerAutoCreatesExpense && workerRecordId) {
              // The trigger already created the event_expense record with reference_type='daily_rate'
              // and reference_id=workerRecordId. We just need to update it with bank account info.
              const { error: updateError } = await supabase
                .from('event_expenses')
                .update({
                  expense_bank_account: bankAccountName || '',
                  is_paid: true,
                  is_finalized: true,
                  notes: notes || null
                })
                .eq('reference_type', 'daily_rate')
                .eq('reference_id', workerRecordId);

              if (updateError) {
                console.warn('Could not update auto-created event_expense:', updateError);
              }
            } else {
              // For other categories (Vale, Alimentação, Adiantamento de Notinhas),
              // we need to manually insert the event_expense since no trigger handles them.
              // IMPORTANT: 
              // - For Vale/Adiantamento and Adiantamento de Notinhas: Do NOT set expense_bank_account!
              //   The bank transaction is already created by the trigger on worker_advances/worker_expense_advances.
              // - For Alimentação: MUST set expense_bank_account because there's NO trigger for worker_food_allowances.
              //   The expense_bank_account will cause the sync_bank_transactions to create the bank transaction.
              const hasDbTriggerForBankTransaction = 
                category === 'Vale/Adiantamento' || 
                category === 'Adiantamento de Notinhas';
              
              const { error: eventExpenseError } = await supabase
                .from('event_expenses')
                .insert({
                  event_id: workerEventId,
                  description: canonicalDescription,
                  total_price: transaction.amount,
                  unit_price: transaction.amount,
                  quantity: 1,
                  expense_date: transaction.date,
                  category: category || 'Diaristas',
                  notes: notes || null,
                  is_paid: true,
                  payment_date: transaction.date,
                  // Only set expense_bank_account for categories without DB triggers (like Alimentação)
                  expense_bank_account: hasDbTriggerForBankTransaction ? null : bankAccountName,
                  is_finalized: true,
                  reference_type: workerReferenceType,
                  reference_id: workerRecordId
                });

              if (eventExpenseError) throw eventExpenseError;
            }

            // IMPORTANT: We DO NOT create a bank_transaction here!
            // The event_expense entry is sufficient and will be picked up by
            // the financial management system. Creating both would cause duplication.
          } else {
            // Galpão: For categories that have database triggers creating bank_transactions
            // (Vale/Adiantamento -> worker_advances, Adiantamento de Notinhas -> worker_expense_advances),
            // we must NOT create another bank_transaction manually - the trigger already handles it.
            // Only create manual bank_transaction for categories without triggers.
            const triggerCreatesTransactionForGalpao = 
              category === 'Vale/Adiantamento' || 
              category === 'Adiantamento de Notinhas';
            
            // Create company_expenses record for Galpão worker expenses
            // This ensures they appear in the "Gastos Empresa" section
            // IMPORTANT: For Vale/Adiantamento and Adiantamento de Notinhas, do NOT set
            // expense_bank_account because the database trigger already creates the bank_transaction.
            // Setting expense_bank_account would cause sync_bank_transactions to create a duplicate.
            const { error: companyExpenseError } = await supabase
              .from('company_expenses')
              .insert({
                description: canonicalDescription,
                category: `Diarista - ${category}`,
                expense_date: transaction.date,
                total_price: transaction.amount,
                unit_price: transaction.amount,
                quantity: 1,
                // Only set expense_bank_account for categories WITHOUT DB triggers
                expense_bank_account: triggerCreatesTransactionForGalpao ? null : bankAccountName,
                is_paid: true,
                payment_date: transaction.date,
                notes: notes || null,
                supplier: selectedWorkerName
              });
            
            if (companyExpenseError) {
              console.error('Error creating company expense for worker:', companyExpenseError);
            }
            
            if (!triggerCreatesTransactionForGalpao) {
              const { error: bankError } = await supabase
                .from('bank_transactions')
                .insert({
                  bank_account_id: accountId,
                  description: canonicalDescription,
                  amount: transaction.amount,
                  transaction_type: transaction.type,
                  category: category || 'Diaristas',
                  transaction_date: transaction.date,
                  reference_type: workerRecordId ? workerReferenceType : null,
                  reference_id: workerRecordId,
                  balance_after: typeof transaction.balanceAfter === 'number' ? transaction.balanceAfter : null,
                  notes: notes || null
                });

              if (bankError) throw bankError;
            }
            // For Vale/Adiantamento and Adiantamento de Notinhas, the database trigger
            // on worker_advances and worker_expense_advances already creates the bank_transaction
          }

        } else if (expenseType === 'fixed_expense' && selectedRecurringExpenseId) {
          // Get month and year from transaction date
          const transactionDate = new Date(transaction.date + 'T12:00:00');
          const paymentMonth = transactionDate.getMonth() + 1;
          const paymentYear = transactionDate.getFullYear();

          // Insert into recurring_expense_monthly_payments
          const { error: paymentError } = await supabase
            .from('recurring_expense_monthly_payments')
            .insert({
              recurring_expense_id: selectedRecurringExpenseId,
              payment_amount: transaction.amount,
              payment_date: transaction.date,
              payment_month: paymentMonth,
              payment_year: paymentYear,
              bank_account_id: accountId
            });

          if (paymentError) throw paymentError;

          // Se o valor pago foi inferior ao valor cadastrado da despesa fixa,
          // atualizar o valor da despesa para refletir o pago (evita "restante pendente").
          const selectedRecurringExpense = recurringExpenses.find(r => r.id === selectedRecurringExpenseId);
          if (selectedRecurringExpense && transaction.amount < Number(selectedRecurringExpense.amount || 0) - 0.005) {
            const { error: updateExpenseError } = await supabase
              .from('recurring_expenses')
              .update({ amount: transaction.amount })
              .eq('id', selectedRecurringExpenseId);
            if (updateExpenseError) {
              console.error('Erro ao atualizar valor da despesa fixa:', updateExpenseError);
            }
          }

          // IMPORTANT:
          // bank_transactions para despesas fixas é criado automaticamente pelos triggers do banco
          // em recurring_expense_monthly_payments. Inserir manualmente aqui gera duplicidade.
        }

      }

      toast({
        title: "Sucesso",
        description: `${transactions.length} transação(ões) importada(s) com sucesso!`
      });

      // Reset and close
      setExpenseType('company');
      setSelectedEventId('');
      setSelectedCollaboratorId('');
      setSelectedWorkerName('');
      setSelectedRecurringExpenseId('');
      setCategory('');
      setNotes('');
      onOpenChange(false);
      await onImportComplete();

    } catch (error) {
      console.error('Erro ao importar transações:', error);
      toast({
        title: "Erro",
        description: "Erro ao importar transações",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  const totalAmount = transactions.reduce((sum, t) => {
    return sum + (t.type === 'expense' ? -t.amount : t.amount);
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Transações</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Transaction Summary */}
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-medium">
              {transactions.length} transação(ões) selecionada(s)
            </p>
            <p className={`text-lg font-bold ${totalAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalAmount >= 0 ? '+' : ''}R$ {totalAmount.toFixed(2).replace('.', ',')}
            </p>
          </div>

          {/* Transaction Details Preview */}
          {transactions.length <= 3 && (
            <div className="space-y-2 text-sm">
              {transactions.map((t, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="truncate max-w-[200px]">{t.description}</span>
                  <span className={t.type === 'expense' ? 'text-red-600' : 'text-green-600'}>
                    {t.type === 'expense' ? '-' : '+'}R$ {t.amount.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Expense Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Lançamento</Label>
            <ScrollArea className="h-[280px] pr-3">
              <RadioGroup 
                value={expenseType} 
                onValueChange={(value) => setExpenseType(value as ExpenseType)}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="company" id="company" />
                  <Label htmlFor="company" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Building2 className="h-4 w-4 text-orange-600" />
                    <div>
                      <p className="font-medium">Gasto da Empresa</p>
                      <p className="text-xs text-muted-foreground">Despesa operacional geral da empresa</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="flex items-center gap-2 cursor-pointer flex-1">
                    <ArrowDownCircle className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium">Receita / Entrada</p>
                      <p className="text-xs text-muted-foreground">Recebimento, pagamento de cliente, etc.</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="event" id="event" />
                  <Label htmlFor="event" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Despesa de Evento</p>
                      <p className="text-xs text-muted-foreground">Vincular a um evento específico</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="collaborator" id="collaborator" />
                  <Label htmlFor="collaborator" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Users className="h-4 w-4 text-purple-600" />
                    <div>
                      <p className="font-medium">Colaborador</p>
                      <p className="text-xs text-muted-foreground">Vale, alimentação, pagamento de colaborador</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="worker" id="worker" />
                  <Label htmlFor="worker" className="flex items-center gap-2 cursor-pointer flex-1">
                    <HardHat className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="font-medium">Diarista</p>
                      <p className="text-xs text-muted-foreground">Diária, vale, alimentação de diarista</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="fixed_expense" id="fixed_expense" />
                  <Label htmlFor="fixed_expense" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Repeat className="h-4 w-4 text-teal-600" />
                    <div>
                      <p className="font-medium">Despesa Fixa</p>
                      <p className="text-xs text-muted-foreground">Aluguel, internet, energia, etc.</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </ScrollArea>
          </div>

          {/* Income Location Selection */}
          {expenseType === 'income' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Tipo de Receita</Label>
                <div 
                  className="p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => setShowIncomeLocationDialog(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {incomeLocationType === 'galpao' ? (
                        <Warehouse className="h-4 w-4 text-orange-600" />
                      ) : (
                        <PartyPopper className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-sm font-medium">
                        {incomeLocationType === 'galpao' 
                          ? 'Receita Geral (Galpão)' 
                          : `Receita de Evento${incomeEventId ? ` - ${events.find(e => e.id === incomeEventId)?.name || ''}` : ''}`
                        }
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Alterar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Event Selection (when event type is selected) */}
          {expenseType === 'event' && (
            <div className="space-y-3">
              {/* Month/Year Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtrar Eventos por Mês
                </Label>
                <div className="flex gap-2">
                  <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Event Selection */}
              <div className="space-y-2">
                <Label>Selecione o Evento</Label>
                {isLoadingEvents ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                    Nenhum evento encontrado em {MONTHS.find(m => m.value === selectedMonth)?.label} de {selectedYear}
                  </p>
                ) : (
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um evento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          <div className="flex flex-col">
                            <span>{event.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              {event.client_name && ` - ${event.client_name}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          {/* Collaborator Selection */}
          {expenseType === 'collaborator' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Selecione o Colaborador</Label>
                {isLoadingCollaborators ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : collaborators.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                    Nenhum colaborador ativo encontrado
                  </p>
                ) : (
                  <Select 
                    value={selectedCollaboratorId} 
                    onValueChange={(value) => {
                      setSelectedCollaboratorId(value);
                      setShowCollaboratorLocationDialog(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um colaborador..." />
                    </SelectTrigger>
                    <SelectContent>
                      {collaborators.map((collaborator) => (
                        <SelectItem key={collaborator.id} value={collaborator.id}>
                          {collaborator.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Show location info if already configured */}
              {selectedCollaboratorId && (
                <div 
                  className="p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => setShowCollaboratorLocationDialog(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {collaboratorLocationType === 'galpao' ? (
                        <Warehouse className="h-4 w-4 text-orange-600" />
                      ) : (
                        <PartyPopper className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-sm font-medium">
                        {collaboratorLocationType === 'galpao' 
                          ? 'Lançamento de Galpão' 
                          : `Lançamento de Evento${collaboratorEventId ? ` - ${events.find(e => e.id === collaboratorEventId)?.name || ''}` : ''}`
                        }
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Alterar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Worker Selection */}
          {expenseType === 'worker' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Selecione o Diarista</Label>
                {isLoadingWorkers ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : workers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                    Nenhum diarista encontrado
                  </p>
                ) : (
                  <Select 
                    value={selectedWorkerName} 
                    onValueChange={(value) => {
                      setSelectedWorkerName(value);
                      setShowWorkerLocationDialog(true);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um diarista..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workers.map((worker) => (
                        <SelectItem key={worker.name} value={worker.name}>
                          {worker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Show location info if already configured */}
              {selectedWorkerName && (
                <div 
                  className="p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => setShowWorkerLocationDialog(true)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {workerLocationType === 'galpao' ? (
                        <Warehouse className="h-4 w-4 text-orange-600" />
                      ) : (
                        <PartyPopper className="h-4 w-4 text-blue-600" />
                      )}
                      <span className="text-sm font-medium">
                        {workerLocationType === 'galpao' 
                          ? 'Lançamento de Galpão' 
                          : `Lançamento de Evento${workerEventId ? ` - ${events.find(e => e.id === workerEventId)?.name || ''}` : ''}`
                        }
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Alterar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recurring Expense Selection */}
          {expenseType === 'fixed_expense' && (
            <div className="space-y-2">
              <Label>Selecione a Despesa Fixa</Label>
              {isLoadingRecurringExpenses ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : recurringExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                  Nenhuma despesa fixa ativa encontrada
                </p>
              ) : (
                <Select value={selectedRecurringExpenseId} onValueChange={setSelectedRecurringExpenseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha uma despesa fixa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recurringExpenses.map((expense) => (
                      <SelectItem key={expense.id} value={expense.id}>
                        <div className="flex flex-col">
                          <span>{expense.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {expense.category} - R$ {expense.amount.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label>{expenseType === 'income' && incomeLocationType === 'evento' ? 'Tipo de Pagamento' : 'Categoria'}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria..." />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações se necessário..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={
              isImporting || 
              (expenseType === 'event' && !selectedEventId) ||
              (expenseType === 'collaborator' && (!selectedCollaboratorId || (collaboratorLocationType === 'evento' && !collaboratorEventId))) ||
              (expenseType === 'worker' && (!selectedWorkerName || (workerLocationType === 'evento' && !workerEventId))) ||
              (expenseType === 'fixed_expense' && !selectedRecurringExpenseId) ||
              (expenseType === 'income' && incomeLocationType === 'evento' && !incomeEventId)
            }
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importando...
              </>
            ) : (
              `Importar ${transactions.length} Transação(ões)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Collaborator Location Dialog */}
      <Dialog open={showCollaboratorLocationDialog} onOpenChange={setShowCollaboratorLocationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tipo de Lançamento do Colaborador</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup 
              value={collaboratorLocationType} 
              onValueChange={(value) => {
                setCollaboratorLocationType(value as CollaboratorLocationType);
                if (value === 'galpao') {
                  setCollaboratorEventId('');
                }
              }}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="galpao" id="loc-galpao" />
                <Label htmlFor="loc-galpao" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Warehouse className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Galpão</p>
                    <p className="text-xs text-muted-foreground">Lançamento de trabalho no galpão</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="evento" id="loc-evento" />
                <Label htmlFor="loc-evento" className="flex items-center gap-2 cursor-pointer flex-1">
                  <PartyPopper className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Evento</p>
                    <p className="text-xs text-muted-foreground">Vincular a um evento específico</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Event selection when evento is selected */}
            {collaboratorLocationType === 'evento' && (
              <div className="space-y-3 border-t pt-4">
                {/* Month/Year Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar Eventos por Mês
                  </Label>
                  <div className="flex gap-2">
                    <Select value={collaboratorEventMonth.toString()} onValueChange={(v) => setCollaboratorEventMonth(parseInt(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={collaboratorEventYear.toString()} onValueChange={(v) => setCollaboratorEventYear(parseInt(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Event Selection */}
                <div className="space-y-2">
                  <Label>Selecione o Evento</Label>
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : filteredCollaboratorEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                      Nenhum evento encontrado em {MONTHS.find(m => m.value === collaboratorEventMonth)?.label} de {collaboratorEventYear}
                    </p>
                  ) : (
                    <Select value={collaboratorEventId} onValueChange={setCollaboratorEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredCollaboratorEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex flex-col">
                              <span>{event.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {event.client_name && ` - ${event.client_name}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCollaboratorLocationDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setShowCollaboratorLocationDialog(false)}
              disabled={collaboratorLocationType === 'evento' && !collaboratorEventId}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Worker Location Dialog */}
      <Dialog open={showWorkerLocationDialog} onOpenChange={setShowWorkerLocationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tipo de Lançamento do Diarista</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup 
              value={workerLocationType} 
              onValueChange={(value) => {
                setWorkerLocationType(value as CollaboratorLocationType);
                if (value === 'galpao') {
                  setWorkerEventId('');
                }
              }}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="galpao" id="worker-loc-galpao" />
                <Label htmlFor="worker-loc-galpao" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Warehouse className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Galpão</p>
                    <p className="text-xs text-muted-foreground">Lançamento de trabalho no galpão</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="evento" id="worker-loc-evento" />
                <Label htmlFor="worker-loc-evento" className="flex items-center gap-2 cursor-pointer flex-1">
                  <PartyPopper className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Evento</p>
                    <p className="text-xs text-muted-foreground">Vincular a um evento específico</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Event selection when evento is selected */}
            {workerLocationType === 'evento' && (
              <div className="space-y-3 border-t pt-4">
                {/* Month/Year Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar Eventos por Mês
                  </Label>
                  <div className="flex gap-2">
                    <Select value={workerEventMonth.toString()} onValueChange={(v) => setWorkerEventMonth(parseInt(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={workerEventYear.toString()} onValueChange={(v) => setWorkerEventYear(parseInt(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Event Selection */}
                <div className="space-y-2">
                  <Label>Selecione o Evento</Label>
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : filteredWorkerEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                      Nenhum evento encontrado em {MONTHS.find(m => m.value === workerEventMonth)?.label} de {workerEventYear}
                    </p>
                  ) : (
                    <Select value={workerEventId} onValueChange={setWorkerEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredWorkerEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex flex-col">
                              <span>{event.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {event.client_name && ` - ${event.client_name}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWorkerLocationDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setShowWorkerLocationDialog(false)}
              disabled={workerLocationType === 'evento' && !workerEventId}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Income Location Dialog */}
      <Dialog open={showIncomeLocationDialog} onOpenChange={setShowIncomeLocationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tipo de Receita</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <RadioGroup 
              value={incomeLocationType} 
              onValueChange={(value) => {
                setIncomeLocationType(value as CollaboratorLocationType);
                if (value === 'galpao') {
                  setIncomeEventId('');
                }
                // Reset category when changing location type
                setCategory('');
              }}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="galpao" id="income-loc-galpao" />
                <Label htmlFor="income-loc-galpao" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Warehouse className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-medium">Galpão</p>
                    <p className="text-xs text-muted-foreground">Receita geral da empresa</p>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="evento" id="income-loc-evento" />
                <Label htmlFor="income-loc-evento" className="flex items-center gap-2 cursor-pointer flex-1">
                  <PartyPopper className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Evento</p>
                    <p className="text-xs text-muted-foreground">Pagamento de cliente vinculado a evento</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>

            {/* Event selection when evento is selected */}
            {incomeLocationType === 'evento' && (
              <div className="space-y-3 border-t pt-4">
                {/* Month/Year Filter */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar Eventos por Mês
                  </Label>
                  <div className="flex gap-2">
                    <Select value={incomeEventMonth.toString()} onValueChange={(v) => setIncomeEventMonth(parseInt(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={incomeEventYear.toString()} onValueChange={(v) => setIncomeEventYear(parseInt(v))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Event Selection */}
                <div className="space-y-2">
                  <Label>Selecione o Evento</Label>
                  {isLoadingEvents ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : filteredIncomeEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg text-center">
                      Nenhum evento encontrado em {MONTHS.find(m => m.value === incomeEventMonth)?.label} de {incomeEventYear}
                    </p>
                  ) : (
                    <Select value={incomeEventId} onValueChange={setIncomeEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredIncomeEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            <div className="flex flex-col">
                              <span>{event.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.event_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {event.client_name && ` - ${event.client_name}`}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIncomeLocationDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setShowIncomeLocationDialog(false)}
              disabled={incomeLocationType === 'evento' && !incomeEventId}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
