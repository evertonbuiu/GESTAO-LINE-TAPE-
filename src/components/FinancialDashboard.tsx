import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Loader2, TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle2, Calendar, Info } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const FinancialDashboard = () => {
  const { userRole } = useCustomAuth();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Buscar eventos
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['financial-events'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar despesas fixas
  const { data: recurringExpenses, isLoading: recurringLoading } = useQuery({
    queryKey: ['financial-recurring-expenses'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar contas bancárias com saldo calculado em tempo real (igual FinancialManagement)
  const { data: bankAccountsWithBalance, isLoading: accountsLoading } = useQuery({
    queryKey: ['financial-bank-accounts-calculated'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      // Buscar contas bancárias
      const { data: accounts, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('*');
      if (accountsError) throw accountsError;
      
      if (!accounts || accounts.length === 0) return [];
      
      // Buscar todas as transações bancárias
      const { data: transactions, error: transError } = await supabase
        .from('bank_transactions')
        .select('*');
      if (transError) throw transError;
      
      // Buscar eventos pagos
      const { data: paidEventsData } = await supabase
        .from('events')
        .select('*')
        .eq('is_paid', true);
      
      // Buscar pagamentos restantes de eventos
      const { data: remainingPaidEventsData } = await supabase
        .from('events')
        .select('*')
        .eq('is_remaining_paid', true)
        .not('remaining_payment_amount', 'is', null);
      
      // Buscar despesas não sincronizadas para cálculo correto do saldo
      const { data: collaboratorAdvancesData } = await supabase
        .from('collaborator_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: collaboratorExpenseAdvancesData } = await supabase
        .from('collaborator_expense_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: collaboratorPaymentsData } = await supabase
        .from('collaborator_payments')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: collaboratorFoodAllowancesData } = await supabase
        .from('collaborator_food_allowances')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: workerAdvancesData } = await supabase
        .from('worker_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: workerExpenseAdvancesData } = await supabase
        .from('worker_expense_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      const { data: dailyRatesData } = await supabase
        .from('daily_rates')
        .select('*')
        .not('bank_account_id', 'is', null);
      
      // Calcular saldo para cada conta
      return accounts.map(account => {
        const accountTransactions = (transactions || []).filter((t: any) => t.bank_account_id === account.id);
        
        // Helper para verificar se já existe transação correspondente
        const hasMatchingTx = (params: {
          type: 'income' | 'expense';
          amount: number;
          date?: string | null;
          referenceId?: string | null;
        }) => {
          const targetAmount = Number(params.amount) || 0;
          const targetDate = params.date || null;
          const targetRef = params.referenceId || null;

          if (targetRef) {
            const refMatch = accountTransactions.some((t: any) => t.reference_id === targetRef);
            if (refMatch) return true;
          }

          return accountTransactions.some((t: any) => {
            const typeOk = t.transaction_type === params.type;
            const amountOk = Math.abs(Number(t.amount) - targetAmount) < 0.01;
            const dateOk = !targetDate || t.transaction_date === targetDate;
            return typeOk && amountOk && dateOk;
          });
        };
        
        // Calcular saldo baseado nas transações
        let calculatedBalance = accountTransactions.reduce((sum: number, t: any) => {
          return t.transaction_type === 'income'
            ? sum + Number(t.amount)
            : sum - Number(t.amount);
        }, 0);
        
        // Adicionar pagamentos de eventos não sincronizados
        paidEventsData?.forEach((event: any) => {
          if (event.payment_amount && event.payment_amount > 0) {
            if (event.payment_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
              const alreadyInTransactions = hasMatchingTx({
                type: 'income',
                amount: Number(event.payment_amount) || 0,
                date: event.payment_date || null,
                referenceId: event.id || null,
              });
              
              if (!alreadyInTransactions) {
                calculatedBalance += event.payment_amount;
              }
            }
          }
        });
        
        // Adicionar pagamentos restantes de eventos não sincronizados
        remainingPaidEventsData?.forEach((event: any) => {
          if (event.remaining_payment_amount && event.remaining_payment_amount > 0) {
            if (event.remaining_payment_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
              const alreadyInTransactions = hasMatchingTx({
                type: 'income',
                amount: Number(event.remaining_payment_amount) || 0,
                date: event.remaining_payment_date || null,
                referenceId: event.id ? `${event.id}-remaining` : null,
              });
              
              if (!alreadyInTransactions) {
                calculatedBalance += event.remaining_payment_amount;
              }
            }
          }
        });
        
        // Subtrair adiantamentos de colaboradores não sincronizados
        collaboratorAdvancesData?.forEach((advance: any) => {
          if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
            const isEventLinked = typeof advance.notes === 'string' && advance.notes.toLowerCase().includes('[evento');
            if (isEventLinked) return;
            
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(advance.amount) || 0,
              date: advance.advance_date || null,
              referenceId: advance.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= advance.amount;
            }
          }
        });
        
        // Subtrair adiantamentos de despesas de colaboradores não sincronizados
        collaboratorExpenseAdvancesData?.forEach((advance: any) => {
          if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
            const isEventLinked = typeof advance.notes === 'string' && advance.notes.toLowerCase().includes('[evento');
            if (isEventLinked) return;
            
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(advance.amount) || 0,
              date: advance.advance_date || null,
              referenceId: advance.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= advance.amount;
            }
          }
        });
        
        // Subtrair pagamentos de colaboradores não sincronizados
        collaboratorPaymentsData?.forEach((payment: any) => {
          if (payment.amount && payment.amount > 0 && payment.bank_account_id === account.id) {
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(payment.amount) || 0,
              date: payment.payment_date || null,
              referenceId: payment.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= payment.amount;
            }
          }
        });
        
        // Subtrair diárias de alimentação de colaboradores não sincronizadas
        collaboratorFoodAllowancesData?.forEach((allowance: any) => {
          if (allowance.amount && allowance.amount > 0 && allowance.bank_account_id === account.id) {
            const isEventLinked = !!allowance.event_id || allowance.allowance_type === 'evento';
            if (isEventLinked) return;
            
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(allowance.amount) || 0,
              date: allowance.allowance_date || null,
              referenceId: allowance.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= allowance.amount;
            }
          }
        });
        
        // Subtrair adiantamentos de diaristas não sincronizados
        workerAdvancesData?.forEach((advance: any) => {
          if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(advance.amount) || 0,
              date: advance.advance_date || null,
              referenceId: advance.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= advance.amount;
            }
          }
        });
        
        // Subtrair adiantamentos de despesas de diaristas não sincronizados
        workerExpenseAdvancesData?.forEach((advance: any) => {
          if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(advance.amount) || 0,
              date: advance.advance_date || null,
              referenceId: advance.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= advance.amount;
            }
          }
        });
        
        // Subtrair diárias finalizadas não sincronizadas
        dailyRatesData?.forEach((daily: any) => {
          if (daily.amount && daily.amount > 0 && daily.bank_account_id === account.id && daily.is_finalized) {
            const alreadyInTransactions = hasMatchingTx({
              type: 'expense',
              amount: Number(daily.amount) || 0,
              date: daily.date || null,
              referenceId: daily.id || null,
            });
            
            if (!alreadyInTransactions) {
              calculatedBalance -= daily.amount;
            }
          }
        });
        
        return {
          ...account,
          calculated_balance: calculatedBalance
        };
      });
    },
  });
  
  // Alias para compatibilidade
  const bankAccounts = bankAccountsWithBalance;

  // Buscar despesas de eventos
  const { data: eventExpenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['financial-event-expenses'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_expenses')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar despesas da empresa
  const { data: companyExpenses, isLoading: companyExpensesLoading } = useQuery({
    queryKey: ['financial-company-expenses'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_expenses')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar pagamentos mensais de despesas fixas
  const { data: monthlyPayments, isLoading: monthlyPaymentsLoading } = useQuery({
    queryKey: ['financial-monthly-payments'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_expense_monthly_payments')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar pagamentos de gastos fixos da empresa
  const { data: companyFixedPayments, isLoading: companyFixedLoading } = useQuery({
    queryKey: ['financial-company-fixed-payments'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_fixed_expense_monthly_payments')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar diárias vinculadas a contas bancárias
  const { data: dailyRates, isLoading: dailyRatesLoading } = useQuery({
    queryKey: ['financial-daily-rates'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_rates')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar pagamentos de colaboradores vinculados a contas bancárias
  const { data: collaboratorPayments, isLoading: collaboratorPaymentsLoading } = useQuery({
    queryKey: ['financial-collaborator-payments'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_payments')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar adiantamentos de colaboradores vinculados a contas bancárias
  const { data: collaboratorAdvances, isLoading: collaboratorAdvancesLoading } = useQuery({
    queryKey: ['financial-collaborator-advances'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar adiantamentos de despesas de colaboradores vinculados a contas bancárias
  const { data: collaboratorExpenseAdvances, isLoading: collaboratorExpenseAdvancesLoading } = useQuery({
    queryKey: ['financial-collaborator-expense-advances'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_expense_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar vales de diaristas vinculados a contas bancárias
  const { data: workerAdvances, isLoading: workerAdvancesLoading } = useQuery({
    queryKey: ['financial-worker-advances'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar adiantamentos de despesas de diaristas vinculados a contas bancárias
  const { data: workerExpenseAdvances, isLoading: workerExpenseAdvancesLoading } = useQuery({
    queryKey: ['financial-worker-expense-advances'],
    enabled: userRole === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('worker_expense_advances')
        .select('*')
        .not('bank_account_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = eventsLoading || recurringLoading || accountsLoading || expensesLoading || 
                     companyExpensesLoading || monthlyPaymentsLoading || companyFixedLoading ||
                     dailyRatesLoading || collaboratorPaymentsLoading || collaboratorAdvancesLoading ||
                     collaboratorExpenseAdvancesLoading || workerAdvancesLoading || workerExpenseAdvancesLoading;

  if (userRole !== 'admin') {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Apenas administradores podem visualizar o Dashboard Financeiro.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Cálculos financeiros
  const today = startOfDay(new Date());
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Total em contas bancárias (usando saldo calculado em tempo real)
  const totalBankBalance = bankAccounts?.reduce((sum, acc) => sum + (Number((acc as any).calculated_balance) || 0), 0) || 0;

  // Receitas totais (eventos pagos)
  const paidEvents = events?.filter(e => e.is_paid) || [];
  const totalRevenue = paidEvents.reduce((sum, e) => sum + (Number(e.payment_amount) || Number(e.total_budget) || 0), 0);

  // Receitas a receber - pagamento total pendente
  const unpaidTotalEvents = events?.filter(e => !e.is_paid && e.payment_type !== 'entrada') || [];
  const totalReceivableTotal = unpaidTotalEvents.reduce((sum, e) => sum + (Number(e.total_budget) || 0), 0);

  // Receitas a receber - entrada pendente
  const unpaidDownPaymentEvents = events?.filter(e => !e.is_paid && e.payment_type === 'entrada') || [];
  const totalReceivableDownPayment = unpaidDownPaymentEvents.reduce((sum, e) => sum + (Number(e.payment_amount) || Number(e.total_budget) || 0), 0);

  // Receitas com pagamento restante a receber (entrada já foi paga)
  const remainingPayments = events?.filter(e => {
    const hasDownPayment = e.payment_type === 'entrada';
    const downPaymentPaid = e.is_paid === true;
    const remainingNotPaid = e.is_remaining_paid === false || e.is_remaining_paid === null;
    
    return hasDownPayment && downPaymentPaid && remainingNotPaid;
  }).map(e => {
    // Calcular o valor restante se não estiver preenchido
    const calculatedRemaining = Number(e.remaining_payment_amount) || (Number(e.total_budget) - Number(e.payment_amount));
    return {
      ...e,
      calculated_remaining: calculatedRemaining
    };
  }) || [];
  
  const totalRemainingReceivable = remainingPayments.reduce((sum, e) => sum + (e.calculated_remaining || 0), 0);

  // Total a receber
  const totalToReceive = totalReceivableTotal + totalReceivableDownPayment + totalRemainingReceivable;

  // Despesas totais - APENAS vinculadas a contas bancárias
  const totalEventExpenses = eventExpenses?.filter(e => e.expense_bank_account && e.expense_bank_account.trim() !== '')
    .reduce((sum, e) => sum + (Number(e.total_price) || 0), 0) || 0;
  const totalCompanyExpenses = companyExpenses?.filter(e => e.expense_bank_account && e.expense_bank_account.trim() !== '')
    .reduce((sum, e) => sum + (Number(e.total_price) || 0), 0) || 0;
  const totalMonthlyPayments = monthlyPayments?.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0) || 0;
  const totalCompanyFixedPayments = companyFixedPayments?.reduce((sum, e) => sum + (Number(e.payment_amount) || 0), 0) || 0;
  const totalDailyRates = dailyRates?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const totalCollaboratorPayments = collaboratorPayments?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const totalCollaboratorAdvances = collaboratorAdvances?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const totalCollaboratorExpenseAdvances = collaboratorExpenseAdvances?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const totalWorkerAdvances = workerAdvances?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  const totalWorkerExpenseAdvances = workerExpenseAdvances?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;
  
  const totalExpenses = totalEventExpenses + totalCompanyExpenses + totalMonthlyPayments + totalCompanyFixedPayments +
                        totalDailyRates + totalCollaboratorPayments + totalCollaboratorAdvances + totalCollaboratorExpenseAdvances +
                        totalWorkerAdvances + totalWorkerExpenseAdvances;

  // Despesas fixas não pagas e atrasadas
  const overdueRecurringExpenses = recurringExpenses?.filter(expense => {
    if (expense.is_paid) return false;
    if (!expense.payment_date) return false;
    const paymentDate = startOfDay(parseISO(expense.payment_date));
    return isBefore(paymentDate, today);
  }) || [];

  // Verificar despesas fixas da empresa que estão atrasadas (que não têm pagamento registrado para meses vencidos)
  const overdueCompanyFixedPayments: any[] = [];
  
  recurringExpenses?.forEach(expense => {
    if (!expense.is_active) return;
    if (!expense.due_day) return;
    
    // Verificar se tem meses selecionados (por seleção)
    const selectedMonths = expense.selected_months as number[] || [];
    const selectedYear = expense.selected_year;
    
    // Verificar se tem período por datas (start_date e end_date)
    const hasDateRange = expense.start_date && expense.end_date;
    
    const monthsToCheck: Array<{month: number, year: number}> = [];
    
    if (hasDateRange) {
      // Usar range de datas
      const startDate = new Date(expense.start_date + 'T00:00:00');
      const endDate = new Date(expense.end_date + 'T00:00:00');
      
      // Criar array de meses dentro do range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();
        
        // Verificar se a data de vencimento já passou
        const dueDate = new Date(year, month - 1, expense.due_day);
        if (isBefore(startOfDay(dueDate), today)) {
          monthsToCheck.push({ month, year });
        }
        
        // Avançar para o próximo mês
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    } else if (selectedMonths.length > 0 && selectedYear) {
      // Usar meses selecionados
      selectedMonths.forEach(month => {
        const dueDate = new Date(selectedYear, month - 1, expense.due_day);
        if (isBefore(startOfDay(dueDate), today)) {
          monthsToCheck.push({ month, year: selectedYear });
        }
      });
    } else {
      // Despesa indefinida - verificar todos os meses do ano atual até o mês atual
      for (let month = 1; month <= currentMonth; month++) {
        const dueDate = new Date(currentYear, month - 1, expense.due_day);
        if (isBefore(startOfDay(dueDate), today)) {
          monthsToCheck.push({ month, year: currentYear });
        }
      }
    }
    
    // Verificar cada mês se tem pagamento
    monthsToCheck.forEach(({ month, year }) => {
      const hasPayment = monthlyPayments?.some(payment => 
        payment.recurring_expense_id === expense.id &&
        payment.payment_month === month &&
        payment.payment_year === year
      );
      
      if (!hasPayment) {
        const dueDate = new Date(year, month - 1, expense.due_day);
        overdueCompanyFixedPayments.push({
          id: `${expense.id}-${month}-${year}`,
          name: expense.name,
          category: expense.category,
          amount: expense.amount,
          payment_date: dueDate.toISOString().split('T')[0],
          payment_month: month,
          payment_year: year
        });
      }
    });
  });

  const totalOverdue = overdueRecurringExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) +
                       overdueCompanyFixedPayments.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Saúde financeira
  const profitMargin = totalRevenue - totalExpenses;
  const healthPercentage = totalRevenue > 0 ? ((profitMargin / totalRevenue) * 100) : 0;

  // Dados para gráfico de receitas vs despesas - por mês do ano atual
  const monthlyFinancialData = [];
  
  for (let month = 0; month < 12; month++) {
    const monthDate = new Date(currentYear, month, 1);
    const monthName = format(monthDate, 'MMM', { locale: ptBR });
    
    // Receitas do mês
    const monthRevenue = events?.filter(event => {
      if (!event.is_paid || !event.payment_date) return false;
      const paymentDate = parseISO(event.payment_date);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === currentYear;
    }).reduce((sum, event) => sum + (Number(event.payment_amount) || Number(event.total_budget) || 0), 0) || 0;
    
    // Adicionar pagamentos restantes
    const monthRemainingRevenue = events?.filter(event => {
      if (!event.is_remaining_paid || !event.remaining_payment_date) return false;
      const paymentDate = parseISO(event.remaining_payment_date);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === currentYear;
    }).reduce((sum, event) => sum + (Number(event.remaining_payment_amount) || 0), 0) || 0;
    
    // Despesas do mês - APENAS vinculadas a contas bancárias
    const monthEventExpenses = eventExpenses?.filter(expense => {
      if (!expense.expense_date) return false;
      if (!expense.expense_bank_account || expense.expense_bank_account.trim() === '') return false;
      const expenseDate = parseISO(expense.expense_date);
      return expenseDate.getMonth() === month && expenseDate.getFullYear() === currentYear;
    }).reduce((sum, expense) => sum + (Number(expense.total_price) || 0), 0) || 0;
    
    const monthCompanyExpenses = companyExpenses?.filter(expense => {
      if (!expense.expense_date) return false;
      if (!expense.expense_bank_account || expense.expense_bank_account.trim() === '') return false;
      const expenseDate = parseISO(expense.expense_date);
      return expenseDate.getMonth() === month && expenseDate.getFullYear() === currentYear;
    }).reduce((sum, expense) => sum + (Number(expense.total_price) || 0), 0) || 0;
    
    const monthMonthlyPayments = monthlyPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === currentYear;
    }).reduce((sum, payment) => sum + (Number(payment.payment_amount) || 0), 0) || 0;
    
    const monthCompanyFixedPayments = companyFixedPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === currentYear;
    }).reduce((sum, payment) => sum + (Number(payment.payment_amount) || 0), 0) || 0;
    
    const monthDailyRates = dailyRates?.filter(rate => {
      if (!rate.date) return false;
      const rateDate = parseISO(rate.date);
      return rateDate.getMonth() === month && rateDate.getFullYear() === currentYear;
    }).reduce((sum, rate) => sum + (Number(rate.amount) || 0), 0) || 0;
    
    const monthCollaboratorPayments = collaboratorPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === month && paymentDate.getFullYear() === currentYear;
    }).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) || 0;
    
    const monthCollaboratorAdvances = collaboratorAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === month && advanceDate.getFullYear() === currentYear;
    }).reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0) || 0;
    
    const monthCollaboratorExpenseAdvances = collaboratorExpenseAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === month && advanceDate.getFullYear() === currentYear;
    }).reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0) || 0;
    
    const monthWorkerAdvances = workerAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === month && advanceDate.getFullYear() === currentYear;
    }).reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0) || 0;
    
    const monthWorkerExpenseAdvances = workerExpenseAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === month && advanceDate.getFullYear() === currentYear;
    }).reduce((sum, advance) => sum + (Number(advance.amount) || 0), 0) || 0;
    
    const monthExpenses = monthEventExpenses + monthCompanyExpenses + monthMonthlyPayments + monthCompanyFixedPayments +
                          monthDailyRates + monthCollaboratorPayments + monthCollaboratorAdvances + monthCollaboratorExpenseAdvances +
                          monthWorkerAdvances + monthWorkerExpenseAdvances;
    
    monthlyFinancialData.push({
      month: monthName,
      receitas: monthRevenue + monthRemainingRevenue,
      despesas: monthExpenses,
      lucro: (monthRevenue + monthRemainingRevenue) - monthExpenses,
    });
  }

  // Dados para gráfico de fluxo de caixa
  const cashFlowData = [
    { name: 'Saldo Atual', value: totalBankBalance, fill: 'hsl(var(--chart-1))' },
    { name: 'A Receber', value: totalToReceive, fill: 'hsl(var(--chart-2))' },
    { name: 'Atrasado', value: totalOverdue, fill: 'hsl(var(--chart-3))' },
  ];

  // Configuração dos gráficos
  const chartConfig = {
    receitas: {
      label: "Receitas",
      color: "hsl(var(--chart-1))",
    },
    despesas: {
      label: "Despesas",
      color: "hsl(var(--chart-2))",
    },
    lucro: {
      label: "Lucro",
      color: "hsl(var(--chart-3))",
    },
    saldoAtual: {
      label: "Saldo Atual",
      color: "hsl(var(--chart-1))",
    },
    aReceber: {
      label: "A Receber",
      color: "hsl(var(--chart-2))",
    },
    atrasado: {
      label: "Atrasado",
      color: "hsl(var(--chart-5))",
    },
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para obter detalhes de um mês específico
  const getMonthDetails = (monthIndex: number) => {
    if (monthIndex === null) return null;

    // Receitas do mês
    const monthRevenueEvents = events?.filter(event => {
      if (!event.is_paid || !event.payment_date) return false;
      const paymentDate = parseISO(event.payment_date);
      return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === currentYear;
    }) || [];

    const monthRemainingEvents = events?.filter(event => {
      if (!event.is_remaining_paid || !event.remaining_payment_date) return false;
      const paymentDate = parseISO(event.remaining_payment_date);
      return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === currentYear;
    }) || [];

    // Despesas do mês - APENAS vinculadas a contas bancárias
    const monthEventExpensesList = eventExpenses?.filter(expense => {
      if (!expense.expense_date) return false;
      if (!expense.expense_bank_account || expense.expense_bank_account.trim() === '') return false;
      const expenseDate = parseISO(expense.expense_date);
      return expenseDate.getMonth() === monthIndex && expenseDate.getFullYear() === currentYear;
    }) || [];

    const monthCompanyExpensesList = companyExpenses?.filter(expense => {
      if (!expense.expense_date) return false;
      if (!expense.expense_bank_account || expense.expense_bank_account.trim() === '') return false;
      const expenseDate = parseISO(expense.expense_date);
      return expenseDate.getMonth() === monthIndex && expenseDate.getFullYear() === currentYear;
    }) || [];

    const monthMonthlyPaymentsList = monthlyPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === currentYear;
    }) || [];

    const monthCompanyFixedPaymentsList = companyFixedPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === currentYear;
    }) || [];

    const monthDailyRatesList = dailyRates?.filter(rate => {
      if (!rate.date) return false;
      const rateDate = parseISO(rate.date);
      return rateDate.getMonth() === monthIndex && rateDate.getFullYear() === currentYear;
    }) || [];

    const monthCollaboratorPaymentsList = collaboratorPayments?.filter(payment => {
      if (!payment.payment_date) return false;
      const paymentDate = parseISO(payment.payment_date);
      return paymentDate.getMonth() === monthIndex && paymentDate.getFullYear() === currentYear;
    }) || [];

    const monthCollaboratorAdvancesList = collaboratorAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === monthIndex && advanceDate.getFullYear() === currentYear;
    }) || [];

    const monthCollaboratorExpenseAdvancesList = collaboratorExpenseAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === monthIndex && advanceDate.getFullYear() === currentYear;
    }) || [];

    const monthWorkerAdvancesList = workerAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === monthIndex && advanceDate.getFullYear() === currentYear;
    }) || [];

    const monthWorkerExpenseAdvancesList = workerExpenseAdvances?.filter(advance => {
      if (!advance.advance_date) return false;
      const advanceDate = parseISO(advance.advance_date);
      return advanceDate.getMonth() === monthIndex && advanceDate.getFullYear() === currentYear;
    }) || [];

    return {
      revenues: {
        events: monthRevenueEvents,
        remaining: monthRemainingEvents,
      },
      expenses: {
        eventExpenses: monthEventExpensesList,
        companyExpenses: monthCompanyExpensesList,
        monthlyPayments: monthMonthlyPaymentsList,
        companyFixedPayments: monthCompanyFixedPaymentsList,
        dailyRates: monthDailyRatesList,
        collaboratorPayments: monthCollaboratorPaymentsList,
        collaboratorAdvances: monthCollaboratorAdvancesList,
        collaboratorExpenseAdvances: monthCollaboratorExpenseAdvancesList,
        workerAdvances: monthWorkerAdvancesList,
        workerExpenseAdvances: monthWorkerExpenseAdvancesList,
      }
    };
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}

      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBankBalance)}</div>
            <p className="text-xs text-muted-foreground">
              Em contas bancárias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalToReceive)}</div>
            <p className="text-xs text-muted-foreground">
              {unpaidTotalEvents.length + unpaidDownPaymentEvents.length + remainingPayments.length} pagamento(s) pendente(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contas Atrasadas</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">
              {overdueRecurringExpenses.length} conta(s) vencida(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saúde Financeira</CardTitle>
            {healthPercentage >= 20 ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${healthPercentage >= 20 ? 'text-green-600' : 'text-red-600'}`}>
              {healthPercentage.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Margem de lucro
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Receitas vs Despesas - {currentYear}</CardTitle>
                <CardDescription>Evolução mensal do fluxo financeiro</CardDescription>
              </div>
              <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Info className="h-4 w-4 mr-2" />
                    Ver Detalhes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Detalhes do Fluxo Financeiro</DialogTitle>
                    <DialogDescription>
                      Selecione um mês para ver todos os lançamentos
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs defaultValue="0" className="w-full" onValueChange={(value) => setSelectedMonth(Number(value))}>
                    <TabsList className="months-grid grid h-auto w-full grid-cols-6 gap-1 md:grid-cols-12">
                      {monthlyFinancialData.map((data, index) => (
                        <TabsTrigger key={index} value={index.toString()}>
                          {data.month}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    {monthlyFinancialData.map((data, monthIndex) => {
                      const details = getMonthDetails(monthIndex);
                      if (!details) return null;

                      return (
                        <TabsContent key={monthIndex} value={monthIndex.toString()} className="space-y-4">
                          {/* Resumo */}
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Receitas</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                  {formatCurrency(data.receitas)}
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Despesas</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                  {formatCurrency(data.despesas)}
                                </div>
                              </CardContent>
                            </Card>
                            <Card>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">Lucro</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className={`text-2xl font-bold ${data.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(data.lucro)}
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Receitas Detalhadas */}
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Receitas</h3>
                            {details.revenues.events.length === 0 && details.revenues.remaining.length === 0 ? (
                              <p className="text-muted-foreground text-sm">Nenhuma receita neste mês</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {details.revenues.events.map((event) => (
                                    <TableRow key={event.id}>
                                      <TableCell>
                                        {event.payment_date ? format(parseISO(event.payment_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>{event.name}</TableCell>
                                      <TableCell>{event.client_name}</TableCell>
                                      <TableCell>
                                        <Badge variant="default">
                                          {event.payment_type === 'entrada' ? 'Entrada' : 'Total'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-green-600">
                                        {formatCurrency(Number(event.payment_amount) || Number(event.total_budget) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.revenues.remaining.map((event) => (
                                    <TableRow key={`remaining-${event.id}`}>
                                      <TableCell>
                                        {event.remaining_payment_date ? format(parseISO(event.remaining_payment_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>{event.name}</TableCell>
                                      <TableCell>{event.client_name}</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Restante</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-green-600">
                                        {formatCurrency(Number(event.remaining_payment_amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>

                          {/* Despesas Detalhadas */}
                          <div>
                            <h3 className="text-lg font-semibold mb-2">Despesas</h3>
                            {details.expenses.eventExpenses.length === 0 && 
                             details.expenses.companyExpenses.length === 0 && 
                             details.expenses.monthlyPayments.length === 0 && 
                             details.expenses.companyFixedPayments.length === 0 &&
                             details.expenses.dailyRates.length === 0 &&
                             details.expenses.collaboratorPayments.length === 0 &&
                             details.expenses.collaboratorAdvances.length === 0 &&
                             details.expenses.collaboratorExpenseAdvances.length === 0 &&
                             details.expenses.workerAdvances.length === 0 &&
                             details.expenses.workerExpenseAdvances.length === 0 ? (
                              <p className="text-muted-foreground text-sm">Nenhuma despesa neste mês</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {details.expenses.eventExpenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                      <TableCell>
                                        {expense.expense_date ? format(parseISO(expense.expense_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>{expense.description}</TableCell>
                                      <TableCell>{expense.category}</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">Evento</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(expense.total_price) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.companyExpenses.map((expense) => (
                                    <TableRow key={`company-${expense.id}`}>
                                      <TableCell>
                                        {expense.expense_date ? format(parseISO(expense.expense_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>{expense.description}</TableCell>
                                      <TableCell>{expense.category}</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Empresa</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(expense.total_price) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.monthlyPayments.map((payment) => (
                                    <TableRow key={`monthly-${payment.id}`}>
                                      <TableCell>
                                        {payment.payment_date ? format(parseISO(payment.payment_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Pagamento Mensal</TableCell>
                                      <TableCell>Despesa Fixa</TableCell>
                                      <TableCell>
                                        <Badge variant="default">Recorrente</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(payment.payment_amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.companyFixedPayments.map((payment) => (
                                    <TableRow key={`fixed-${payment.id}`}>
                                      <TableCell>
                                        {payment.payment_date ? format(parseISO(payment.payment_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Gasto Fixo Empresa</TableCell>
                                      <TableCell>{payment.category}</TableCell>
                                      <TableCell>
                                        <Badge variant="destructive">Fixo</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(payment.payment_amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.dailyRates.map((rate) => (
                                    <TableRow key={`daily-${rate.id}`}>
                                      <TableCell>
                                        {rate.date ? format(parseISO(rate.date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>{rate.worker_name}</TableCell>
                                      <TableCell>Diária</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Colaborador</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(rate.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.collaboratorPayments.map((payment) => (
                                    <TableRow key={`collab-payment-${payment.id}`}>
                                      <TableCell>
                                        {payment.payment_date ? format(parseISO(payment.payment_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Pagamento Colaborador</TableCell>
                                      <TableCell>Pagamento</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Colaborador</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(payment.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.collaboratorAdvances.map((advance) => (
                                    <TableRow key={`collab-advance-${advance.id}`}>
                                      <TableCell>
                                        {advance.advance_date ? format(parseISO(advance.advance_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Adiantamento Colaborador</TableCell>
                                      <TableCell>Adiantamento</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">Colaborador</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(advance.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.collaboratorExpenseAdvances.map((advance) => (
                                    <TableRow key={`collab-expense-${advance.id}`}>
                                      <TableCell>
                                        {advance.advance_date ? format(parseISO(advance.advance_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Adiantamento Despesa Colaborador</TableCell>
                                      <TableCell>Adiantamento Despesa</TableCell>
                                      <TableCell>
                                        <Badge variant="outline">Colaborador</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(advance.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.workerAdvances.map((advance) => (
                                    <TableRow key={`worker-advance-${advance.id}`}>
                                      <TableCell>
                                        {advance.advance_date ? format(parseISO(advance.advance_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Vale - {advance.worker_name}</TableCell>
                                      <TableCell>Vale Diarista</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Diarista</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(advance.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                  {details.expenses.workerExpenseAdvances.map((advance) => (
                                    <TableRow key={`worker-expense-${advance.id}`}>
                                      <TableCell>
                                        {advance.advance_date ? format(parseISO(advance.advance_date), 'dd/MM/yyyy') : '-'}
                                      </TableCell>
                                      <TableCell>Adiantamento Notinha - {advance.worker_name}</TableCell>
                                      <TableCell>Adiantamento Despesa</TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">Diarista</Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold text-red-600">
                                        {formatCurrency(Number(advance.amount) || 0)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={monthlyFinancialData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent 
                    labelFormatter={(value) => `Mês: ${value}`}
                    formatter={(value, name) => {
                      const labels = {
                        receitas: 'Receitas',
                        despesas: 'Despesas',
                        lucro: 'Lucro'
                      };
                      return [formatCurrency(Number(value)), labels[name as keyof typeof labels] || name];
                    }}
                  />}
                />
                <Line 
                  type="monotone" 
                  dataKey="receitas" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="despesas" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-2))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="lucro" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-3))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
            
            {/* Legenda do gráfico */}
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                <span className="text-sm text-muted-foreground">Receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                <span className="text-sm text-muted-foreground">Despesas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                <span className="text-sm text-muted-foreground">Lucro</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Caixa</CardTitle>
            <CardDescription>Fluxo de caixa atual</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={cashFlowData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {cashFlowData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Valores a receber */}
      <Card>
        <CardHeader>
          <CardTitle>Valores a Receber</CardTitle>
          <CardDescription>Eventos e pagamentos pendentes</CardDescription>
        </CardHeader>
        <CardContent>
          {unpaidTotalEvents.length === 0 && unpaidDownPaymentEvents.length === 0 && remainingPayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum valor a receber</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidTotalEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{event.client_name}</TableCell>
                    <TableCell>
                      {event.event_date ? format(parseISO(event.event_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Total</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(event.total_budget) || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {unpaidDownPaymentEvents.map((event) => (
                  <TableRow key={`downpayment-${event.id}`}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{event.client_name}</TableCell>
                    <TableCell>
                      {event.event_date ? format(parseISO(event.event_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">Entrada</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(event.payment_amount) || Number(event.total_budget) || 0)}
                    </TableCell>
                  </TableRow>
                ))}
                {remainingPayments.map((event) => (
                  <TableRow key={`remaining-${event.id}`}>
                    <TableCell className="font-medium">{event.name}</TableCell>
                    <TableCell>{event.client_name}</TableCell>
                    <TableCell>
                      {event.remaining_payment_date ? format(parseISO(event.remaining_payment_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Restante</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(event.calculated_remaining || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Contas atrasadas */}
      <Card>
        <CardHeader>
          <CardTitle>Contas Atrasadas</CardTitle>
          <CardDescription>Despesas fixas vencidas</CardDescription>
        </CardHeader>
        <CardContent>
          {overdueRecurringExpenses.length === 0 && overdueCompanyFixedPayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
              <p className="text-muted-foreground">Nenhuma conta atrasada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Despesa</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias Atrasados</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueRecurringExpenses.map((expense) => {
                  const paymentDate = parseISO(expense.payment_date!);
                  const daysOverdue = Math.floor((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        {format(paymentDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{daysOverdue} dias</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(Number(expense.amount) || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {overdueCompanyFixedPayments.map((expense) => {
                  const paymentDate = parseISO(expense.payment_date);
                  const daysOverdue = Math.floor((today.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>
                        {format(paymentDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{daysOverdue} dias</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(Number(expense.amount) || 0)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
