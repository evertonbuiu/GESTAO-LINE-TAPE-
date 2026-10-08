import React, { useState, useEffect, useMemo, useCallback } from "react";
import { FinancialReportsPanel } from "@/components/finance/FinancialReportsPanel";
import { AccountsPanel } from "@/components/finance/AccountsPanel";


import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { LogoUpload } from "@/components/LogoUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calculator, Plus, Download, TrendingUp, TrendingDown, DollarSign, FileText, Search, Edit, Trash2, Eye, CalendarIcon, Calendar as CalendarDaysIcon, RefreshCw, CreditCard, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { formatTransactionDateTime } from "@/lib/transactionDateTime";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { findBankAccountByName } from "@/utils/bankAccountMatch";
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/ui/BulkActionsBar";
import { EventTaxReportModal } from "@/components/EventTaxReportModal";

interface CashFlowEntry {
  id: string;
  date: string;
  time?: string | null;
  createdAt?: string | null;
  description: string;
  category: string;
  type: 'income' | 'expense';
  amount: number;
  account: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

interface BudgetEntry {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
}

interface AccountBalance {
  id: string;
  name: string;
  balance: number;
  type: 'checking' | 'savings' | 'cash';
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  acquisitionValue: number;
  acquisitionDate: string;
  condition: string;
  quantity: number;
  serialNumber?: string;
  location: string;
  description?: string;
  currentValue: number;
}

export const FinancialManagement = () => {
  console.log('FinancialManagement component initialized');
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [budget, setBudget] = useState<BudgetEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { logoUrl } = useLogo();
  const { settings } = useCompanySettings();
  const [selectedPeriod, setSelectedPeriod] = useState("custom");
  const [newEntry, setNewEntry] = useState({
    description: "",
    category: "",
    type: "expense" as 'income' | 'expense',
    amount: 0,
    account: "",
    date: new Date().toISOString().split('T')[0]
  });
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [isEditingInventoryItem, setIsEditingInventoryItem] = useState(false);
  const [isViewingInventoryItem, setIsViewingInventoryItem] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isEditingEntry, setIsEditingEntry] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CashFlowEntry | null>(null);
  const [budgetValues, setBudgetValues] = useState<Record<string, number>>({});
  const [isEditingPersonalBudget, setIsEditingPersonalBudget] = useState(false);
  const [personalBudget, setPersonalBudget] = useState<BudgetEntry[]>([]);
  const [personalBudgetValues, setPersonalBudgetValues] = useState<Record<string, number>>({});
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null);
  const [viewInventoryItem, setViewInventoryItem] = useState<InventoryItem | null>(null);
  const [isPreviewingPatrimonyReport, setIsPreviewingPatrimonyReport] = useState(false);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  
  // Estado para regime tributário do DRE
  type DRETaxRegime = 'simples' | 'lucro_presumido' | 'lucro_real' | 'reforma_2026';
  const [dreTaxRegime, setDreTaxRegime] = useState<DRETaxRegime>('lucro_presumido');

  // Constantes para reforma tributária 2026
  const TAX_RATES_2026 = {
    CBS: 0.009, // 0.9% - Contribuição sobre Bens e Serviços (federal)
    IBS: 0.001, // 0.1% - Imposto sobre Bens e Serviços (estadual/municipal)
  };
  
  const SIMPLES_NACIONAL_RATES_DRE = [
    { max: 180000, rate: 0.06, deduction: 0 },
    { max: 360000, rate: 0.112, deduction: 9360 },
    { max: 720000, rate: 0.135, deduction: 17640 },
    { max: 1800000, rate: 0.16, deduction: 35640 },
    { max: 3600000, rate: 0.21, deduction: 125640 },
    { max: 4800000, rate: 0.33, deduction: 648000 },
  ];

  const INCOME_TAX_RATES_DRE = {
    IRPJ: 0.15,
    IRPJ_adicional: 0.10,
    CSLL: 0.09,
  };
  
  
  const [newInventoryItem, setNewInventoryItem] = useState({
    name: "",
    category: "",
    acquisitionValue: 0,
    acquisitionDate: new Date().toISOString().split('T')[0],
    condition: "",
    quantity: 1,
    serialNumber: "",
    location: "",
    description: ""
  });
  const [dateFilter, setDateFilter] = useState({
    startDate: null as Date | null,
    endDate: null as Date | null
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(Date.now()); // Para forçar re-render
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isRecalculatingBalances, setIsRecalculatingBalances] = useState(false);
  
  // Estados para transferência entre contas

  // Estados para criação de cartões

  // Estado para transações bancárias diretas
  const [bankTransactions, setBankTransactions] = useState<any[]>([]);
  
  // Estados para filtros do inventário
  const [inventorySearchTerm, setInventorySearchTerm] = useState("");
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState("todos");
  const [selectedInventoryCondition, setSelectedInventoryCondition] = useState("todos");

  // Estados para exclusão em lote
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  
  const { toast } = useToast();

  // Hook para seleção múltipla no fluxo de caixa
  const cashFlowSelection = useBulkSelection({
    items: cashFlow,
    getItemId: useCallback((entry: CashFlowEntry) => entry.id, [])
  });

  // Função para exclusão em lote do fluxo de caixa
  const handleBulkDeleteCashFlow = async () => {
    if (cashFlowSelection.selectedCount === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${cashFlowSelection.selectedCount} lançamento(s)?`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const idsToDelete = Array.from(cashFlowSelection.selectedIds);

      // Mapa de prefixo sintético -> tabela de origem
      const prefixToTable: Array<{ prefix: string; table: string }> = [
        { prefix: 'bank-', table: 'bank_transactions' },
        { prefix: 'event-expense-', table: 'event_expenses' },
        { prefix: 'company-expense-', table: 'company_expenses' },
        { prefix: 'collab-payment-', table: 'collaborator_payments' },
        { prefix: 'collab-advance-', table: 'collaborator_advances' },
        { prefix: 'collab-expense-advance-', table: 'collaborator_expense_advances' },
        { prefix: 'collab-food-', table: 'collaborator_food_allowances' },
        { prefix: 'daily-rate-', table: 'daily_rates' },
        { prefix: 'recurring-payment-', table: 'recurring_expense_monthly_payments' },
        { prefix: 'company-fixed-', table: 'company_fixed_expense_monthly_payments' },
        { prefix: 'worker-expense-advance-', table: 'worker_expense_advances' },
        { prefix: 'worker-advance-', table: 'worker_advances' },
      ];

      // Agrupar por tabela (ordem importa: prefixos mais longos primeiro)
      const buckets: Record<string, string[]> = {};
      const eventPaymentIds: string[] = [];
      const eventRemainingIds: string[] = [];
      const unhandled: string[] = [];

      for (const rawId of idsToDelete) {
        if (rawId.startsWith('event-payment-')) {
          eventPaymentIds.push(rawId.replace('event-payment-', ''));
          continue;
        }
        if (rawId.startsWith('event-remaining-')) {
          eventRemainingIds.push(rawId.replace('event-remaining-', ''));
          continue;
        }
        const match = prefixToTable.find(({ prefix }) => rawId.startsWith(prefix));
        if (match) {
          const uuid = rawId.slice(match.prefix.length);
          (buckets[match.table] ||= []).push(uuid);
        } else {
          // Sem prefixo: assumir bank_transactions
          unhandled.push(rawId);
        }
      }

      if (unhandled.length > 0) {
        (buckets['bank_transactions'] ||= []).push(...unhandled);
      }

      // Executar deleções por tabela
      for (const [table, ids] of Object.entries(buckets)) {
        if (ids.length === 0) continue;
        const { error } = await supabase.from(table as any).delete().in('id', ids);
        if (error) throw error;
      }

      // Pagamentos de eventos: desmarcar campos (não há registro isolado para excluir)
      if (eventPaymentIds.length > 0) {
        const { error } = await supabase
          .from('events')
          .update({
            is_paid: false,
            payment_amount: 0,
            payment_date: null,
            payment_bank_account: null,
          } as any)
          .in('id', eventPaymentIds);
        if (error) throw error;
      }
      if (eventRemainingIds.length > 0) {
        const { error } = await supabase
          .from('events')
          .update({
            is_remaining_paid: false,
            remaining_payment_amount: 0,
            remaining_payment_date: null,
            remaining_payment_bank_account: null,
          } as any)
          .in('id', eventRemainingIds);
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: `${idsToDelete.length} lançamento(s) excluído(s) com sucesso`
      });

      cashFlowSelection.clearSelection();
      // Recarregar todos os dados financeiros para atualizar totais
      await loadFinancialData();
      await loadBankTransactions();
      await loadBankAccounts();
    } catch (error) {
      console.error('Erro ao excluir lançamentos em lote:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir os lançamentos",
        variant: "destructive"
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };






  const loadBankTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          bank_accounts!inner(name, id)
        `)
        .order('transaction_date', { ascending: false });

      if (error) throw error;

      setBankTransactions(data || []);
    } catch (error) {
      console.error("Error loading bank transactions:", error);
      setBankTransactions([]);
    }
  };

  const handleDeleteBankTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação removida com sucesso"
      });

      // Recarregar dados
      await loadBankTransactions();
      await loadBankAccounts();
    } catch (error) {
      console.error('Erro ao deletar transação:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a transação",
        variant: "destructive"
      });
    }
  };

  const loadBankAccounts = async () => {
    try {
      // Buscar contas bancárias com saldos calculados em tempo real
      console.log('🏦 Carregando contas bancárias...');

      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select(`
          id,
          name,
          balance,
          account_type,
          created_at
        `)
        .order('created_at', { ascending: true });

      if (bankAccountsError) throw bankAccountsError;

      // Buscar eventos pagos (para incluir no saldo das contas)
      const { data: paidEvents } = await supabase
        .from('events')
        .select('*')
        .eq('is_paid', true);

      // Buscar pagamentos restantes de eventos
      const { data: remainingPaidEvents } = await supabase
        .from('events')
        .select('*')
        .eq('is_remaining_paid', true)
        .not('remaining_payment_amount', 'is', null);

      // Buscar despesas de eventos com conta bancária vinculada (subtrair do saldo das contas)
      // Considera todas as despesas com conta bancária, independente do status is_paid
      const { data: eventExpensesWithAccount } = await supabase
        .from('event_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '');

      // Buscar adiantamentos de colaboradores
      const { data: collaboratorAdvances } = await supabase
        .from('collaborator_advances')
        .select('*');

      // Buscar adiantamentos de despesas de colaboradores
      const { data: collaboratorExpenseAdvances } = await supabase
        .from('collaborator_expense_advances')
        .select('*');

      // Buscar diárias de alimentação de colaboradores
      const { data: collaboratorFoodAllowances } = await supabase
        .from('collaborator_food_allowances')
        .select('*');

      // Buscar pagamentos de colaboradores
      const { data: collaboratorPayments } = await supabase
        .from('collaborator_payments')
        .select('*')
        .eq('is_paid', true);

      // Buscar despesas da empresa com conta bancária vinculada
      const { data: companyExpensesWithAccount } = await supabase
        .from('company_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '');

      if (bankAccountsData) {
        // Para cada conta, calcular o saldo baseado nas transações (extrato) + pagamentos de eventos - despesas de eventos
        const accountsWithCalculatedBalances = await Promise.all(
          bankAccountsData.map(async (account) => {
            // Buscar todas as transações da conta
            const { data: transactions, error: transError } = await supabase
              .from('bank_transactions')
              .select('id, amount, transaction_type, description, reference_type, reference_id, transaction_date')
              .eq('bank_account_id', account.id);

            if (transError) {
              console.error(`Error loading transactions for account ${account.name}:`, transError);
              return {
                id: account.id,
                name: account.name,
                balance: account.balance || 0,
                type: account.account_type as 'checking' | 'savings' | 'cash'
              };
            }

            const txs = (transactions || []).map((t: any) => ({
              ...t,
              amount: Number(t.amount) || 0,
              transaction_type: t.transaction_type as 'income' | 'expense',
              transaction_date: t.transaction_date as string | null,
              reference_id: t.reference_id as string | null,
              reference_type: t.reference_type as string | null,
              description: (t.description || '') as string,
            }));

            const hasMatchingTx = (params: {
              type: 'income' | 'expense';
              amount: number;
              date?: string | null;
              referenceId?: string | null;
            }) => {
              const targetAmount = Number(params.amount) || 0;
              const targetDate = params.date || null;
              const targetRef = params.referenceId || null;

              // Preferência: match por reference_id (mais confiável)
              if (targetRef) {
                const refMatch = txs.some((t) => t.reference_id === targetRef);
                if (refMatch) return true;
              }

              // Fallback: match por tipo + valor + data (ignora descrição)
              return txs.some((t) => {
                const typeOk = t.transaction_type === params.type;
                const amountOk = Math.abs(Number(t.amount) - targetAmount) < 0.01;
                const dateOk = !targetDate || t.transaction_date === targetDate;
                return typeOk && amountOk && dateOk;
              });
            };

            // Calcular saldo baseado no extrato de bank_transactions
            let calculatedBalance = txs.reduce((sum, transaction) => {
              return transaction.transaction_type === 'income'
                ? sum + Number(transaction.amount)
                : sum - Number(transaction.amount);
            }, 0) || 0;

            // Adicionar pagamentos de eventos que foram feitos nesta conta
            paidEvents?.forEach(event => {
              if (event.payment_amount && event.payment_amount > 0) {
                // Verificar se o pagamento foi feito nesta conta (case insensitive e trim)
                if (event.payment_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
                  // Verificar se já existe em bank_transactions (por reference_id ou data+valor)
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

            // Adicionar pagamentos restantes de eventos
            remainingPaidEvents?.forEach(event => {
              if (event.remaining_payment_amount && event.remaining_payment_amount > 0) {
                if (event.remaining_payment_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
                  const alreadyInTransactions = hasMatchingTx({
                    type: 'income',
                    amount: Number(event.remaining_payment_amount) || 0,
                    date: event.remaining_payment_date || null,
                    referenceId: event.id || null,
                  });
                  
                  if (!alreadyInTransactions) {
                    calculatedBalance += event.remaining_payment_amount;
                  }
                }
              }
            });

            // Subtrair despesas de eventos que têm conta bancária vinculada
            eventExpensesWithAccount?.forEach(expense => {
              if (expense.total_price && expense.total_price > 0) {
                if (expense.expense_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
                  const alreadyInTransactions = hasMatchingTx({
                    type: 'expense',
                    amount: Number(expense.total_price) || 0,
                    date: (expense.payment_date || expense.expense_date) || null,
                    referenceId: expense.id || null,
                  });
                  
                  if (!alreadyInTransactions) {
                    calculatedBalance -= expense.total_price;
                  }
                }
              }
            });

            // Subtrair adiantamentos de colaboradores
            collaboratorAdvances?.forEach(advance => {
              if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
                // Se este lançamento está vinculado a um evento (ex.: importado como despesa do evento),
                // ele já será contabilizado via event_expenses. Evita "saldo dobrado".
                const isEventLinked = typeof advance.notes === 'string' &&
                  advance.notes.toLowerCase().includes('[evento');
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

            // Subtrair adiantamentos de despesas de colaboradores
            collaboratorExpenseAdvances?.forEach(advance => {
              if (advance.amount && advance.amount > 0 && advance.bank_account_id === account.id) {
                // Se este lançamento está vinculado a um evento (ex.: importado como despesa do evento),
                // ele já é contabilizado em event_expenses. Evita duplicidade no saldo.
                const isEventLinked = typeof advance.notes === 'string' &&
                  advance.notes.toLowerCase().includes('[evento');
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

            // Subtrair diárias de alimentação de colaboradores
            // Skip individual allowances that are part of batch transactions (already recorded in bank_transactions)
            collaboratorFoodAllowances?.forEach(allowance => {
              if (allowance.amount && allowance.amount > 0 && allowance.bank_account_id === account.id) {
                // Alimentação vinculada a evento é contabilizada via event_expenses.
                // Para evitar “saldo dobrado”, nunca descontar novamente pela tabela de colaboradores.
                const isEventLinked = !!allowance.event_id || allowance.allowance_type === 'evento';
                if (isEventLinked) return;

                // Check if this allowance is part of a batch transaction
                const isPartOfBatch = transactions?.some(t => 
                  t.reference_type === 'food_allowance_batch' &&
                  t.description?.includes(allowance.id)
                ) || transactions?.some(t => 
                  t.reference_type === 'food_allowance_batch' &&
                  t.description?.toLowerCase().includes('alimentação')
                );
                
                // Check if there's an individual transaction for this allowance
                const hasIndividualTransaction = transactions?.some(t => 
                  (t.reference_type === 'food_allowance' || t.reference_type === 'food_allowance_batch') &&
                  t.transaction_type === 'expense'
                );
                
                // Only subtract if NOT already in transactions (batch or individual)
                if (!isPartOfBatch && !hasIndividualTransaction) {
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
              }
            });

            // Subtrair pagamentos de colaboradores
            // Pagamentos com is_paid=true já foram consolidados em uma transação total no banco,
            // então não devem ser subtraídos novamente aqui para evitar débito duplo.
            collaboratorPayments?.forEach(payment => {
              if (payment.amount && payment.amount > 0 && payment.bank_account_id === account.id) {
                // Pagamentos vinculados a evento podem estar registrados como event_expenses.
                const isEventLinked = typeof payment.notes === 'string' &&
                  payment.notes.toLowerCase().includes('[evento');
                if (isEventLinked) return;

                // Se o pagamento já foi consolidado via "Pagar Total Líquido", a transação
                // bancária total já está registrada - não subtrair individualmente
                if (payment.is_paid) return;

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

            // Subtrair despesas da empresa que têm conta bancária vinculada
            companyExpensesWithAccount?.forEach(expense => {
              if (expense.total_price && expense.total_price > 0) {
                if (expense.expense_bank_account?.toLowerCase().trim() === account.name.toLowerCase().trim()) {
                  const alreadyInTransactions = hasMatchingTx({
                    type: 'expense',
                    amount: Number(expense.total_price) || 0,
                    date: (expense.payment_date || expense.expense_date) || null,
                    referenceId: expense.id || null,
                  });
                  
                  if (!alreadyInTransactions) {
                    calculatedBalance -= expense.total_price;
                  }
                }
              }
            });

            console.log(`🏦 Saldo calculado para conta ${account.name}:`, {
              accountId: account.id,
              transactionCount: transactions?.length || 0,
              calculatedBalance,
              storedBalance: account.balance
            });

            // Arredondar para evitar resíduos de ponto flutuante que exibem "-R$ 0,00"
            const roundedBalance = Math.round(calculatedBalance * 100) / 100;
            return {
              id: account.id,
              name: account.name,
              balance: Object.is(roundedBalance, -0) ? 0 : roundedBalance,
              type: account.account_type as 'checking' | 'savings' | 'cash'
            };

          })
        );

        setAccounts(accountsWithCalculatedBalances);
        setLastUpdate(Date.now());
      }
    } catch (error) {
      console.error("Error loading bank accounts:", error);
    }
  };

  const loadInventoryData = async () => {
    try {
      const { data, error } = await supabase
        .from('patrimony_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const inventoryItems: InventoryItem[] = data?.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        acquisitionValue: item.acquisition_value,
        acquisitionDate: item.acquisition_date,
        condition: item.condition,
        quantity: item.quantity,
        serialNumber: item.serial_number || '',
        location: item.location,
        description: item.description || '',
        currentValue: item.current_value
      })) || [];

      setInventory(inventoryItems);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      setInventory([]);
    }
  };

  useEffect(() => {
    loadFinancialData();
    loadInventoryData();
    loadBankTransactions();
    loadBankAccounts();

    // Debounce para evitar cascata de refetches quando várias linhas mudam de uma vez (ex: importações)
    let financialTimer: ReturnType<typeof setTimeout> | null = null;
    let inventoryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleFinancialRefresh = () => {
      if (financialTimer) clearTimeout(financialTimer);
      financialTimer = setTimeout(() => {
        loadFinancialData({ silent: true });
        loadBankAccounts();
        loadBankTransactions();
      }, 600);
    };

    const scheduleInventoryRefresh = () => {
      if (inventoryTimer) clearTimeout(inventoryTimer);
      inventoryTimer = setTimeout(() => {
        loadInventoryData();
      }, 600);
    };

    const channel = supabase
      .channel('financial-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_expenses' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_expenses' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_expenses' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transactions' }, scheduleFinancialRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patrimony_inventory' }, scheduleInventoryRefresh)
      .subscribe();

    return () => {
      if (financialTimer) clearTimeout(financialTimer);
      if (inventoryTimer) clearTimeout(inventoryTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedPeriod]);


  // Recarregar todos os dados financeiros quando os filtros mudam
  useEffect(() => {
    console.log('🔄 Filtros mudaram - recarregando todos os dados financeiros:', { selectedMonth, selectedYear, selectedPeriod });
    loadFinancialData();
    loadBankAccounts();
  }, [selectedMonth, selectedYear, selectedPeriod]);

  const loadFinancialData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      
      let startDate: string;
      let endDate: string;
      
      // Determinar as datas baseadas no filtro de período ou nos filtros específicos
      if (selectedPeriod !== "custom") {
        const now = new Date();
        
        // Helper to get local date string YYYY-MM-DD without timezone shift
        const toLocalDateString = (d: Date) => {
          const year = d.getFullYear();
          const month = (d.getMonth() + 1).toString().padStart(2, '0');
          const day = d.getDate().toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        switch (selectedPeriod) {
          case "week":
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startDate = toLocalDateString(startOfWeek);
            
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endDate = toLocalDateString(endOfWeek);
            break;
            
          case "month":
            startDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${lastDay}`;
            break;
            
          case "quarter":
            const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
            startDate = `${now.getFullYear()}-${(quarterStartMonth + 1).toString().padStart(2, '0')}-01`;
            const quarterEndMonth = quarterStartMonth + 2;
            const quarterLastDay = new Date(now.getFullYear(), quarterEndMonth + 1, 0).getDate();
            endDate = `${now.getFullYear()}-${(quarterEndMonth + 1).toString().padStart(2, '0')}-${quarterLastDay}`;
            break;
            
          case "year":
            startDate = `${now.getFullYear()}-01-01`;
            endDate = `${now.getFullYear()}-12-31`;
            break;
            
          default:
            // Usar filtros específicos de mês e ano
            startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
            const customLastDay = new Date(selectedYear, selectedMonth, 0).getDate();
            endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${customLastDay}`;
        }
      } else {
        // Usar filtros específicos de mês e ano quando "custom" está selecionado
        startDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`;
        const customLastDay = new Date(selectedYear, selectedMonth, 0).getDate();
        endDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${customLastDay}`;
      }
      
      console.log(`Loading financial data for period: ${startDate} to ${endDate}`);
      
      // Buscar TODAS as transações de bank_transactions do período (sincronizadas + manuais)
      const { data: allTransactions, error: transactionsError } = await supabase
        .from('bank_transactions')
        .select('*, bank_accounts!inner(name)')
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });

      if (transactionsError) throw transactionsError;

      // Criar sets de referências que já existem em bank_transactions para evitar duplicatas
      // - existingReferenceKeys: reference_type-reference_id (quando o trigger preenche ambos)
      // - existingReferenceIdValues: apenas reference_id (para cobrir inconsistências de reference_type)
      const existingReferenceKeys = new Set(
        (allTransactions || [])
          .filter((t) => t.reference_type && t.reference_id)
          .map((t) => `${t.reference_type}-${t.reference_id}`)
      );

      const existingReferenceIdValues = new Set(
        (allTransactions || [])
          .filter((t) => t.reference_id)
          .map((t) => String(t.reference_id))
      );

      // Buscar contas bancárias para mapear nomes
      const { data: bankAccountsList } = await supabase
        .from('bank_accounts')
        .select('id, name');

      // Buscar eventos pagos no período (pagamentos de locações)
      const { data: paidEvents, error: eventsPaymentError } = await supabase
        .from('events')
        .select('*')
        .eq('is_paid', true)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (eventsPaymentError) console.error('Error fetching paid events:', eventsPaymentError);

      // Buscar pagamentos restantes de eventos
      const { data: remainingPayments, error: remainingError } = await supabase
        .from('events')
        .select('*')
        .eq('is_remaining_paid', true)
        .not('remaining_payment_date', 'is', null)
        .gte('remaining_payment_date', startDate)
        .lte('remaining_payment_date', endDate);

      if (remainingError) console.error('Error fetching remaining payments:', remainingError);

      // Buscar despesas de eventos no período (pagas e pendentes) para incluir no fluxo de caixa
      const { data: eventExpenses, error: eventExpensesError } = await supabase
        .from('event_expenses')
        .select('*, events(name, client_name)')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (eventExpensesError) console.error('Error fetching event expenses:', eventExpensesError);

      // Buscar despesas da empresa no período (pagas e pendentes) para incluir no fluxo de caixa
      const { data: companyExpensesForCashFlow, error: companyExpensesForCashFlowError } = await supabase
        .from('company_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate);

      if (companyExpensesForCashFlowError) console.error('Error fetching company expenses:', companyExpensesForCashFlowError);

      // Buscar lançamentos de colaboradores/diaristas e despesas fixas vinculados a contas
      const { data: collaboratorPaymentsForCashFlow, error: collaboratorPaymentsForCashFlowError } = await supabase
        .from('collaborator_payments')
        .select('*, collaborators(name), events(name)')
        .not('bank_account_id', 'is', null)
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (collaboratorPaymentsForCashFlowError) console.error('Error fetching collaborator payments:', collaboratorPaymentsForCashFlowError);

      const { data: collaboratorAdvancesForCashFlow, error: collaboratorAdvancesForCashFlowError } = await supabase
        .from('collaborator_advances')
        .select('*, collaborators(name)')
        .not('bank_account_id', 'is', null)
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);

      if (collaboratorAdvancesForCashFlowError) console.error('Error fetching collaborator advances:', collaboratorAdvancesForCashFlowError);

      const { data: collaboratorExpenseAdvancesForCashFlow, error: collaboratorExpenseAdvancesForCashFlowError } = await supabase
        .from('collaborator_expense_advances')
        .select('*, collaborators(name)')
        .not('bank_account_id', 'is', null)
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);

      if (collaboratorExpenseAdvancesForCashFlowError) console.error('Error fetching collaborator expense advances:', collaboratorExpenseAdvancesForCashFlowError);

      const { data: collaboratorFoodAllowancesForCashFlow, error: collaboratorFoodAllowancesForCashFlowError } = await supabase
        .from('collaborator_food_allowances')
        .select('*, collaborators(name)')
        .not('bank_account_id', 'is', null)
        .gte('allowance_date', startDate)
        .lte('allowance_date', endDate);

      if (collaboratorFoodAllowancesForCashFlowError) console.error('Error fetching collaborator food allowances:', collaboratorFoodAllowancesForCashFlowError);

      const { data: dailyRatesForCashFlow, error: dailyRatesForCashFlowError } = await supabase
        .from('daily_rates')
        .select('*')
        .not('bank_account_id', 'is', null)
        .gte('date', startDate)
        .lte('date', endDate);

      if (dailyRatesForCashFlowError) console.error('Error fetching daily rates:', dailyRatesForCashFlowError);

      const { data: recurringMonthlyPaymentsForCashFlow, error: recurringMonthlyPaymentsForCashFlowError } = await supabase
        .from('recurring_expense_monthly_payments')
        .select('*, recurring_expenses(name, category)')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (recurringMonthlyPaymentsForCashFlowError) console.error('Error fetching recurring monthly payments:', recurringMonthlyPaymentsForCashFlowError);

      const { data: companyFixedPaymentsForCashFlow, error: companyFixedPaymentsForCashFlowError } = await supabase
        .from('company_fixed_expense_monthly_payments')
        .select('*')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (companyFixedPaymentsForCashFlowError) console.error('Error fetching company fixed payments:', companyFixedPaymentsForCashFlowError);

      const { data: workerAdvancesForCashFlow, error: workerAdvancesForCashFlowError } = await supabase
        .from('worker_advances')
        .select('*')
        .not('bank_account_id', 'is', null)
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);

      if (workerAdvancesForCashFlowError) console.error('Error fetching worker advances:', workerAdvancesForCashFlowError);

      const { data: workerExpenseAdvancesForCashFlow, error: workerExpenseAdvancesForCashFlowError } = await supabase
        .from('worker_expense_advances')
        .select('*')
        .not('bank_account_id', 'is', null)
        .gte('advance_date', startDate)
        .lte('advance_date', endDate);

      if (workerExpenseAdvancesForCashFlowError) console.error('Error fetching worker expense advances:', workerExpenseAdvancesForCashFlowError);

      // ==========================================================
      // Deduplicação: Vales/adiantamentos de diaristas vinculados a evento
      // ==========================================================
      // Cenário do bug:
      // - Inserção em worker_advances cria bank_transactions (reference_type='worker_advance', reference_id=<id>) via trigger
      // - Como também criamos/temos event_expenses (reference_type='worker_advance', reference_id=<id>),
      //   o sync cria OUTRA bank_transaction (reference_type='expense', reference_id=<event_expense_id>)
      // Resultado: aparece duplicado no Fluxo de Caixa / Extrato.
      // Solução aqui: se existir a transação sincronizada (expense -> event_expense.id), escondemos a transação automática worker_advance.
      const getWorkerRefIdsToHideFromBankTx = (refType: 'worker_advance' | 'worker_expense_advance') => {
        const refToEventExpenseId = new Map<string, string>();
        (eventExpenses || []).forEach((expense: any) => {
          if (expense?.reference_type === refType && expense?.reference_id) {
            refToEventExpenseId.set(String(expense.reference_id), String(expense.id));
          }
        });

        if (refToEventExpenseId.size === 0) return new Set<string>();

        const eventExpenseIds = new Set(Array.from(refToEventExpenseId.values()));
        const eventExpenseIdsWithSyncedBankTx = new Set(
          (allTransactions || [])
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

      const workerAdvanceRefIdsToHide = getWorkerRefIdsToHideFromBankTx('worker_advance');
      const workerExpenseAdvanceRefIdsToHide = getWorkerRefIdsToHideFromBankTx('worker_expense_advance');

      const bankTransactionsForDisplay = (allTransactions || []).filter((t: any) => {
        const refId = t?.reference_id ? String(t.reference_id) : '';
        if (t?.reference_type === 'worker_advance' && refId && workerAdvanceRefIdsToHide.has(refId)) return false;
        if (t?.reference_type === 'worker_expense_advance' && refId && workerExpenseAdvanceRefIdsToHide.has(refId)) return false;
        return true;
      });

      // ==========================================================
      // Deduplicação: Despesas fixas importadas duplicando
      // ==========================================================
      // Cenário:
      // - Importação "Despesa Fixa" inseria manualmente um bank_transaction com descrição
      //   "Despesa Fixa - <Nome>: <descrição do extrato>"
      // - Triggers do banco também criam outro bank_transaction (geralmente sem o sufixo ": ...")
      // Resultado: duas linhas no Fluxo de Caixa e no Extrato.
      // Solução: quando houver dois registros de recurring_expense com o MESMO "base" (antes de ':')
      // no mesmo dia/valor/conta, manter o registro "canônico" (sem ':').
      const bankTransactionsForDisplayDeduped = (() => {
        const output: any[] = [];
        const keyToIndex = new Map<string, number>();

        const isFixedExpenseTx = (t: any) =>
          t?.reference_type === 'recurring_expense' &&
          typeof t?.description === 'string' &&
          t.description.toLowerCase().startsWith('despesa fixa');

        const baseFixedExpenseDesc = (desc: string) => desc.split(':')[0].trim();

        for (const t of bankTransactionsForDisplay) {
          if (!isFixedExpenseTx(t)) {
            output.push(t);
            continue;
          }

          const desc = String(t.description || '');
          const hasColon = desc.includes(':');
          const baseDesc = baseFixedExpenseDesc(desc);

          const key = `${String(t.bank_account_id || '')}|${String(t.transaction_type || '')}|${String(
            t.transaction_date || ''
          )}|${String(t.amount ?? '')}|${baseDesc}`;

          const existingIndex = keyToIndex.get(key);
          if (existingIndex === undefined) {
            keyToIndex.set(key, output.length);
            output.push(t);
            continue;
          }

          const current = output[existingIndex];
          const currentDesc = String(current?.description || '');
          const currentHasColon = currentDesc.includes(':');

          // Só deduplicar quando um tem ':' e o outro não.
          // Isso evita colapsar pagamentos legítimos (ex.: dois lançamentos do mesmo tipo no mesmo dia).
          if (currentHasColon !== hasColon) {
            // Preferir o registro sem ':' (canônico do trigger)
            output[existingIndex] = currentHasColon ? t : current;
          } else {
            // Mesmo padrão, tratar como lançamento distinto
            output.push(t);
          }
        }

        return output;
      })();

      // Transformar transações em entradas do fluxo de caixa
      const allEntries: CashFlowEntry[] = bankTransactionsForDisplayDeduped?.map(transaction => {
        return {
          id: transaction.id,
          date: transaction.transaction_date,
          time: transaction.transaction_time ?? null,
          createdAt: transaction.created_at ?? null,
          description: transaction.description,
          category: transaction.category || "Outros",
          type: transaction.transaction_type as 'income' | 'expense',
          amount: transaction.amount,
          account: transaction.bank_accounts?.name || 'Não especificada',
          status: "confirmed" as const
        };
      }) || [];

      // Adicionar pagamentos de eventos que não estão em bank_transactions
      paidEvents?.forEach(event => {
        if (event.payment_amount && event.payment_amount > 0) {
          // Verificar se já existe em bank_transactions
          const exists = allEntries.some(e => 
            e.description.toLowerCase().includes(event.name.toLowerCase()) && 
            e.type === 'income' &&
            Math.abs(e.amount - event.payment_amount) < 0.01
          );
          
          if (!exists) {
            const matchedAccount = findBankAccountByName(bankAccountsList || [], event.payment_bank_account);
            
            allEntries.push({
              id: `event-payment-${event.id}`,
              date: event.payment_date,
              description: `Pagamento Locação: ${event.name} - ${event.client_name}`,
              category: "Locações",
              type: 'income',
              amount: event.payment_amount,
              account: matchedAccount?.name || event.payment_bank_account || 'Não especificada',
              status: "confirmed"
            });
          }
        }
      });

      // Adicionar pagamentos restantes de eventos
      remainingPayments?.forEach(event => {
        if (event.remaining_payment_amount && event.remaining_payment_amount > 0) {
          // Verificar se já existe em bank_transactions
          const exists = allEntries.some(e => 
            e.description.toLowerCase().includes('restante') &&
            e.description.toLowerCase().includes(event.name.toLowerCase()) && 
            e.type === 'income' &&
            Math.abs(e.amount - event.remaining_payment_amount) < 0.01
          );
          
          if (!exists) {
            const matchedAccount = findBankAccountByName(bankAccountsList || [], event.remaining_payment_bank_account);
            
            allEntries.push({
              id: `event-remaining-${event.id}`,
              date: event.remaining_payment_date,
              description: `Restante Locação: ${event.name} - ${event.client_name}`,
              category: "Locações",
              type: 'income',
              amount: event.remaining_payment_amount,
              account: matchedAccount?.name || event.remaining_payment_bank_account || 'Não especificada',
              status: "confirmed"
            });
          }
        }
      });

      // Adicionar despesas de eventos (pagas e pendentes) ao fluxo de caixa
      eventExpenses?.forEach(expense => {
        if (expense.total_price && expense.total_price > 0) {
          // Verificar se já existe em bank_transactions por reference_id (mais confiável que descrição)
          const hasLinkedBankTx = existingReferenceIdValues.has(String(expense.id)) ||
            existingReferenceKeys.has(`expense-${expense.id}`);
          
          if (hasLinkedBankTx) return; // Já existe bank_transaction vinculada, pular

          // Fallback: verificar por descrição
          const exists = allEntries.some(e => 
            e.description.toLowerCase().includes(expense.description.toLowerCase()) && 
            e.type === 'expense' &&
            Math.abs(e.amount - expense.total_price) < 0.01
          );
          
          if (!exists) {
            const matchedAccount = findBankAccountByName(bankAccountsList || [], expense.expense_bank_account);
            
            const eventInfo = expense.events ? ` (${expense.events.name})` : '';
            
            allEntries.push({
              id: `event-expense-${expense.id}`,
              date: expense.expense_date || expense.created_at.split('T')[0],
              description: `${expense.description}${eventInfo}`,
              category: expense.category || "Despesas Evento",
              type: 'expense',
              amount: expense.total_price,
              account: matchedAccount?.name || expense.expense_bank_account || 'Não especificada',
              status: expense.is_paid ? 'confirmed' : 'pending'
            });
          }
        }
      });

      // Adicionar despesas da empresa (pagas e pendentes) ao fluxo de caixa
      companyExpensesForCashFlow?.forEach(expense => {
        if (expense.total_price && expense.total_price > 0) {
          const exists = allEntries.some(e =>
            e.description.toLowerCase().includes(expense.description.toLowerCase()) &&
            e.type === 'expense' &&
            Math.abs(e.amount - expense.total_price) < 0.01
          );

          if (!exists) {
            const matchedAccount = findBankAccountByName(bankAccountsList || [], expense.expense_bank_account);

            allEntries.push({
              id: `company-expense-${expense.id}`,
              date: expense.expense_date || expense.payment_date || expense.created_at.split('T')[0],
              description: `Despesa Empresa: ${expense.description}`,
              category: expense.category || "Despesas Empresa",
              type: 'expense',
              amount: expense.total_price,
              account: matchedAccount?.name || expense.expense_bank_account || 'Não especificada',
              status: expense.is_paid ? 'confirmed' : 'pending'
            });
          }
        }
      });

      // Adicionar pagamentos de colaboradores ao fluxo de caixa
      // Pagamentos marcados como pagos (is_paid) já estão incluídos na transação total
      // criada pelo relatório, então não devem ser exibidos individualmente
      collaboratorPaymentsForCashFlow?.forEach(payment => {
        if (payment.amount && payment.amount > 0 && !payment.is_paid) {
          const matchedAccount = bankAccountsList?.find(a => a.id === payment.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `collab-payment-${payment.id}` ||
            (e.description.toLowerCase().includes((payment.collaborators as any)?.name?.toLowerCase() || '') &&
             e.type === 'expense' &&
             Math.abs(e.amount - payment.amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `collab-payment-${payment.id}`,
              date: payment.payment_date,
              description: `Pagamento Colaborador: ${(payment.collaborators as any)?.name || 'N/A'}${(payment.events as any)?.name ? ` - ${(payment.events as any).name}` : ''}`,
              category: 'Pagamento Colaborador',
              type: 'expense',
              amount: payment.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: payment.is_paid ? 'confirmed' : 'pending'
            });
          }
        }
      });

      // Adicionar adiantamentos de colaboradores ao fluxo de caixa
      collaboratorAdvancesForCashFlow?.forEach(advance => {
        if (advance.amount && advance.amount > 0) {
          const matchedAccount = bankAccountsList?.find(a => a.id === advance.bank_account_id);
          const collabName = (advance.collaborators as any)?.name?.toLowerCase() || '';
          
          // Check if a bank_transaction already exists for this advance via trigger
          // The trigger creates a transaction with reference_type='collaborator_vale' and reference_id=advance.id
          const hasTriggerTransaction = allTransactions?.some(t =>
            t.reference_type === 'collaborator_vale' && t.reference_id === advance.id
          );
          
          if (hasTriggerTransaction) return; // Trigger already created the bank_transaction, skip
          
          const exists = allEntries.some(e => 
            e.id === `collab-advance-${advance.id}` ||
            (e.description.toLowerCase().includes('adiantamento') &&
             e.description.toLowerCase().includes(collabName) &&
             Math.abs(e.amount - advance.amount) < 0.01) ||
            (e.description.toLowerCase().includes('vale') &&
             e.description.toLowerCase().includes(collabName) &&
             Math.abs(e.amount - advance.amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `collab-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Adiantamento: ${(advance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Adiantamento Colaborador',
              type: 'expense',
              amount: advance.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: 'confirmed'
            });
          }
        }
      });

      // Adicionar adiantamentos de despesas de colaboradores ao fluxo de caixa
      collaboratorExpenseAdvancesForCashFlow?.forEach(advance => {
        if (advance.amount && advance.amount > 0) {
          const matchedAccount = bankAccountsList?.find(a => a.id === advance.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `collab-expense-advance-${advance.id}` ||
            (e.description.toLowerCase().includes('adiantamento despesa') &&
             e.description.toLowerCase().includes((advance.collaborators as any)?.name?.toLowerCase() || '') &&
             Math.abs(e.amount - advance.amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `collab-expense-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Adiantamento Despesa: ${(advance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Adiantamento Despesa Colaborador',
              type: 'expense',
              amount: advance.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: 'confirmed'
            });
          }
        }
      });

      // Adicionar diárias de alimentação de colaboradores ao fluxo de caixa
      // Pular individuais quando já existe um lançamento batch no bank_transactions
      // ou quando já existe uma event_expense correspondente adicionada ao fluxo
      collaboratorFoodAllowancesForCashFlow?.forEach(allowance => {
        if (allowance.amount && allowance.amount > 0) {
          const collabName = (allowance.collaborators as any)?.name?.toLowerCase() || '';

          // Verificar se já existe uma transação batch que cobre este colaborador
          const hasBatchTransaction = allEntries.some(e => {
            const desc = e.description.toLowerCase();
            return (
              desc.includes('diárias de alimentação') &&
              desc.includes(collabName) &&
              e.type === 'expense'
            );
          }) || allTransactions?.some(t =>
            t.reference_type === 'food_allowance_batch' &&
            t.description?.toLowerCase().includes(collabName)
          );

          if (hasBatchTransaction) return; // Batch já registrado, pular individual

          // Verificar se já existe uma event_expense correspondente (reference_id = allowance.id)
          // que já foi adicionada ao fluxo de caixa
          const hasEventExpenseEntry = (eventExpenses || []).some((ee: any) =>
            ee.reference_type === 'food_allowance' &&
            ee.reference_id === allowance.id
          );

          if (hasEventExpenseEntry) return; // Já coberto por event_expense, pular

          const matchedAccount = bankAccountsList?.find(a => a.id === allowance.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `collab-food-${allowance.id}` ||
            (e.description.toLowerCase().includes('alimentação') &&
             e.description.toLowerCase().includes(collabName) &&
             Math.abs(e.amount - allowance.amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `collab-food-${allowance.id}`,
              date: allowance.allowance_date,
              description: `Alimentação: ${(allowance.collaborators as any)?.name || 'Colaborador'}`,
              category: 'Alimentação Colaborador',
              type: 'expense',
              amount: allowance.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: 'confirmed'
            });
          }
        }
      });

      // Adicionar diárias ao fluxo de caixa
      dailyRatesForCashFlow?.forEach(rate => {
        if (rate.amount && rate.amount > 0) {
          const matchedAccount = bankAccountsList?.find(a => a.id === rate.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `daily-rate-${rate.id}` ||
            (e.description.toLowerCase().includes('diária') &&
             e.description.toLowerCase().includes(rate.worker_name?.toLowerCase() || '') &&
             Math.abs(e.amount - rate.amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `daily-rate-${rate.id}`,
              date: rate.date,
              description: `Diária: ${rate.worker_name || 'Diarista'}`,
              category: 'Diárias',
              type: 'expense',
              amount: rate.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: rate.is_finalized ? 'confirmed' : 'pending'
            });
          }
        }
      });

      // Adicionar pagamentos mensais de despesas fixas ao fluxo de caixa
      recurringMonthlyPaymentsForCashFlow?.forEach(payment => {
        if (payment.payment_amount && payment.payment_amount > 0) {
          // Se já existe a transação bancária sincronizada (criada por trigger), não duplicar no Fluxo de Caixa.
          // O trigger usa reference_type='recurring_expense' e reference_id=<id do pagamento mensal>.
          if (
            existingReferenceIdValues.has(String(payment.id)) ||
            existingReferenceKeys.has(`recurring_expense-${payment.id}`)
          ) {
            return;
          }

          const matchedAccount = bankAccountsList?.find(a => a.id === payment.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `recurring-payment-${payment.id}` ||
            (e.description.toLowerCase().includes((payment.recurring_expenses as any)?.name?.toLowerCase() || '') &&
             e.type === 'expense' &&
             Math.abs(e.amount - payment.payment_amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `recurring-payment-${payment.id}`,
              date: payment.payment_date,
              description: `Despesa Fixa: ${(payment.recurring_expenses as any)?.name || 'N/A'}`,
              category: (payment.recurring_expenses as any)?.category || 'Despesas Fixas',
              type: 'expense',
              amount: payment.payment_amount,
              account: matchedAccount?.name || 'Não especificada',
              status: 'confirmed'
            });
          }
        }
      });

      // Adicionar pagamentos de gastos fixos da empresa ao fluxo de caixa
      companyFixedPaymentsForCashFlow?.forEach(payment => {
        if (payment.payment_amount && payment.payment_amount > 0) {
          const matchedAccount = bankAccountsList?.find(a => a.id === payment.bank_account_id);
          const exists = allEntries.some(e => 
            e.id === `company-fixed-${payment.id}` ||
            (e.description.toLowerCase().includes(payment.category?.toLowerCase() || '') &&
             e.type === 'expense' &&
             Math.abs(e.amount - payment.payment_amount) < 0.01)
          );
          
          if (!exists) {
            allEntries.push({
              id: `company-fixed-${payment.id}`,
              date: payment.payment_date,
              description: `Gasto Fixo Empresa: ${payment.category || 'N/A'}`,
              category: payment.category || 'Gastos Fixos',
              type: 'expense',
              amount: payment.payment_amount,
              account: matchedAccount?.name || 'Não especificada',
              status: 'confirmed'
            });
          }
        }
      });

      // Adicionar vales de diaristas ao fluxo de caixa
      // NOTA: worker_advances possuem trigger criando bank_transactions, então preferimos o extrato.
      workerAdvancesForCashFlow?.forEach((advance) => {
        if (advance.amount && advance.amount > 0) {
          // Se já existe transação bancária ligada a este lançamento, não duplicar
          if (existingReferenceIdValues.has(String(advance.id))) {
            return;
          }

          // Fallback: checar a chave reference_type-reference_id
          const refKey = `worker_advance-${advance.id}`;
          if (existingReferenceKeys.has(refKey)) {
            return;
          }

          const matchedAccount = bankAccountsList?.find((a) => a.id === advance.bank_account_id);
          const existsManual = allEntries.some((e) => e.id === `worker-advance-${advance.id}`);

          if (!existsManual) {
            allEntries.push({
              id: `worker-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Vale Diarista: ${advance.worker_name || 'Diarista'}`,
              category: 'Vales Diaristas',
              type: 'expense',
              amount: advance.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: advance.is_finalized ? 'confirmed' : 'pending',
            });
          }
        }
      });

      // Adicionar adiantamentos de despesas ("notinhas") de diaristas ao fluxo de caixa
      // Observação: pode haver trigger gerando bank_transactions; então usamos a mesma estratégia anti-duplicidade.
      workerExpenseAdvancesForCashFlow?.forEach((advance) => {
        if (advance.amount && advance.amount > 0) {
          // Se já existe transação bancária ligada a este lançamento, não duplicar
          if (existingReferenceIdValues.has(String(advance.id))) {
            return;
          }

          // Fallback: checar a chave reference_type-reference_id
          const refKey = `worker_expense_advance-${advance.id}`;
          if (existingReferenceKeys.has(refKey)) {
            return;
          }

          const matchedAccount = bankAccountsList?.find((a) => a.id === advance.bank_account_id);
          const existsManual = allEntries.some((e) => e.id === `worker-expense-advance-${advance.id}`);

          if (!existsManual) {
            allEntries.push({
              id: `worker-expense-advance-${advance.id}`,
              date: advance.advance_date,
              description: `Adiantamento Despesa Diarista: ${advance.worker_name || 'Diarista'}`,
              category: 'Adiantamento Despesa Diarista',
              type: 'expense',
              amount: advance.amount,
              account: matchedAccount?.name || 'Não especificada',
              status: advance.is_finalized ? 'confirmed' : 'pending',
            });
          }
        }
      });

      // Ordenar por data
      allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log('💰 Total de entradas no fluxo de caixa:', {
        totalEntries: allEntries.length,
        incomeEntries: allEntries.filter(e => e.type === 'income').length,
        expenseEntries: allEntries.filter(e => e.type === 'expense').length,
        totalIncome: allEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0),
        totalExpenses: allEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0),
        eventPayments: paidEvents?.length || 0,
        remainingPayments: remainingPayments?.length || 0,
        eventExpenses: eventExpenses?.length || 0,
        companyExpenses: companyExpensesForCashFlow?.length || 0,
        collaboratorPayments: collaboratorPaymentsForCashFlow?.length || 0,
        collaboratorAdvances: collaboratorAdvancesForCashFlow?.length || 0,
        collaboratorFoodAllowances: collaboratorFoodAllowancesForCashFlow?.length || 0,
        dailyRates: dailyRatesForCashFlow?.length || 0,
        recurringPayments: recurringMonthlyPaymentsForCashFlow?.length || 0,
        workerAdvances: workerAdvancesForCashFlow?.length || 0
      });
      
      setCashFlow(allEntries);

      // Buscar eventos para calcular orçamento
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .gte('event_date', startDate)
        .lte('event_date', endDate);

      // Buscar despesas dos eventos do período selecionado para orçamento
      const { data: expensesData, error: expensesError } = await supabase
        .from('event_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      if (expensesError) throw expensesError;

      // Buscar despesas da empresa do período selecionado para orçamento
      const { data: companyExpensesData, error: companyExpensesError } = await supabase
        .from('company_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

      if (companyExpensesError) throw companyExpensesError;

      // Calcular orçamento baseado nas categorias de despesas (eventos + empresa)
      const allExpenses = [...(expensesData || []), ...(companyExpensesData || [])];
      
      const allExpensesWithRecurring = [...allExpenses];
      
      const categorySpending = allExpensesWithRecurring.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.total_price;
        return acc;
      }, {} as Record<string, number>) || {};

      // Carregar orçamentos salvos do localStorage ou usar padrões
      const budgetKey = `company_budget_${selectedMonth}_${selectedYear}`;
      const savedBudget = localStorage.getItem(budgetKey);
      
      let budgetDefaults;
      if (savedBudget) {
        // Se existe orçamento salvo, usar os valores salvos
        const savedBudgetData = JSON.parse(savedBudget);
        budgetDefaults = savedBudgetData.reduce((acc: Record<string, number>, item: BudgetEntry) => {
          acc[item.category] = item.budgeted;
          return acc;
        }, {});
      } else {
        // Usar valores padrão zerados para que o usuário defina seus próprios valores
        budgetDefaults = {
          "Equipamentos": 0,
          "Despesas Operacionais": 0,
          "Pessoal": 0,
          "Marketing": 0,
          "Alimentação": 0,
          "Transporte": 0,
          "Outros": 0
        };
      }

      const calculatedBudget: BudgetEntry[] = Object.entries(budgetDefaults).map(([category, budgeted]) => {
        const budgetedAmount = Number(budgeted);
        const spent = categorySpending[category] || 0;
        const remaining = budgetedAmount - spent;
        const percentage = (spent / budgetedAmount) * 100;
        
        return {
          id: category,
          category,
          budgeted: budgetedAmount,
          spent,
          remaining,
          percentage: Math.round(percentage)
        };
      });

      setBudget(calculatedBudget);

      // Inicializar valores de orçamento se não existirem
      if (Object.keys(budgetValues).length === 0) {
        const initialBudgetValues = Object.entries(budgetDefaults).reduce((acc, [category, value]) => {
          acc[category] = Number(value);
          return acc;
        }, {} as Record<string, number>);
        setBudgetValues(initialBudgetValues);
      }

      // Carregar orçamento pessoal salvo do localStorage ou usar padrões
      const personalBudgetKey = `personal_budget_${selectedMonth}_${selectedYear}`;
      const savedPersonalBudget = localStorage.getItem(personalBudgetKey);
      
      let personalBudgetDefaults;
      if (savedPersonalBudget) {
        // Se existe orçamento pessoal salvo, usar os valores salvos
        const savedPersonalBudgetData = JSON.parse(savedPersonalBudget);
        personalBudgetDefaults = savedPersonalBudgetData.reduce((acc: Record<string, number>, item: BudgetEntry) => {
          acc[item.category] = item.budgeted;
          return acc;
        }, {});
      } else {
        // Usar valores padrão zerados para que o usuário defina seus próprios valores
        personalBudgetDefaults = {
          "Moradia": 0,
          "Alimentação": 0,
          "Transporte": 0,
          "Saúde": 0,
          "Educação": 0,
          "Lazer": 0,
          "Roupas": 0,
          "Poupança": 0,
          "Outros": 0
        };
      }

      const personalBudgetData: BudgetEntry[] = Object.entries(personalBudgetDefaults).map(([category, budgeted]) => {
        const budgetedAmount = Number(budgeted);
        const spent = 0; // Por enquanto, sem gastos reais
        const remaining = budgetedAmount - spent;
        const percentage = 0;
        
        return {
          id: category,
          category,
          budgeted: budgetedAmount,
          spent,
          remaining,
          percentage
        };
      });

      setPersonalBudget(personalBudgetData);

      // Inicializar valores de orçamento pessoal se não existirem
      if (Object.keys(personalBudgetValues).length === 0) {
        const initialPersonalBudgetValues = Object.entries(personalBudgetDefaults).reduce((acc, [category, value]) => {
          acc[category] = Number(value);
          return acc;
        }, {} as Record<string, number>);
        setPersonalBudgetValues(initialPersonalBudgetValues);
      }

      // Buscar contas bancárias do banco de dados (os saldos são gerenciados automaticamente)
      const { data: bankAccountsData, error: bankAccountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('created_at', { ascending: true });

      if (bankAccountsError) throw bankAccountsError;

      // Se não há contas no banco, criar contas padrão com saldo zero
      if (!bankAccountsData || bankAccountsData.length === 0) {
        const defaultAccounts = [
          {
            name: "Conta Corrente Principal",
            account_type: "checking",
            balance: 0
          },
          {
            name: "Conta Poupança",
            account_type: "savings", 
            balance: 0
          },
          {
            name: "Dinheiro em Caixa",
            account_type: "cash",
            balance: 0
          }
        ];

        // Inserir contas padrão no banco
        const { error: insertError } = await supabase
          .from('bank_accounts')
          .insert(defaultAccounts);

        if (!insertError) {
          // Garantir que a UI use o cálculo unificado de saldos
          await loadBankAccounts();
        }
      } else {
        // IMPORTANT: saldos são carregados por loadBankAccounts() para evitar divergência/race condition
        // com a lista de lançamentos e extratos.
      }

    } catch (error) {
      console.error("Error loading financial data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados financeiros.",
        variant: "destructive",
      });
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };


  const handleAddEntry = async () => {
    if (!newEntry.description || !newEntry.category || !newEntry.amount || !newEntry.account) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Salvar diretamente na tabela bank_transactions
      const { error: transactionError } = await supabase
        .from('bank_transactions')
        .insert({
          bank_account_id: newEntry.account,
          description: newEntry.description,
          amount: newEntry.amount,
          transaction_type: newEntry.type,
          category: newEntry.category,
          transaction_date: newEntry.date,
          reference_type: null
        });

      if (transactionError) {
        console.error("Error saving transaction:", transactionError);
        throw transactionError;
      }

      // Recarregar dados para mostrar o novo lançamento e saldo atualizado
      await loadBankTransactions();
      await loadBankAccounts();
      await loadFinancialData();
      
      setNewEntry({
        description: "",
        category: "",
        type: "expense",
        amount: 0,
        account: "",
        date: new Date().toISOString().split('T')[0]
      });
      setIsAddingEntry(false);
      
      toast({
        title: "Sucesso",
        description: "Lançamento adicionado e saldo atualizado com sucesso!",
      });
    } catch (error) {
      console.error("Error adding entry:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o lançamento.",
        variant: "destructive",
      });
    }
  };

  const handleEditEntry = async () => {
    if (!selectedEntry) return;

    try {
      // Edição deve persistir no banco. Só conseguimos editar com segurança lançamentos
      // que existam em bank_transactions (lançamentos manuais / extrato).
      const realId = selectedEntry.id.startsWith('bank-')
        ? selectedEntry.id.replace('bank-', '')
        : selectedEntry.id;

      // Verificar se existe em bank_transactions e se não é um lançamento sincronizado
      // (que pode ser recriado por rotinas de sync).
      const { data: existingTx, error: existingTxError } = await supabase
        .from('bank_transactions')
        .select('id, bank_account_id, reference_type')
        .eq('id', realId)
        .maybeSingle();

      if (existingTxError) throw existingTxError;

      if (!existingTx) {
        toast({
          title: 'Atenção',
          description: 'Esta movimentação é gerada a partir de outros módulos e não pode ser editada aqui. Edite no registro de origem.',
          variant: 'destructive',
        });
        return;
      }

      const isSynced = existingTx.reference_type && !String(existingTx.reference_type).startsWith('manual');
      if (isSynced) {
        toast({
          title: 'Atenção',
          description: 'Esta movimentação é sincronizada automaticamente. Para não perder alterações, edite no registro de origem (evento/despesa/etc.).',
          variant: 'destructive',
        });
        return;
      }

      // Converter o nome da conta (UI) para o bank_account_id
      const bankAccountId = accounts.find((a) => a.name === selectedEntry.account)?.id
        ?? (typeof selectedEntry.account === 'string' && selectedEntry.account.length === 36 ? selectedEntry.account : null)
        ?? existingTx.bank_account_id;

      const { error: updateError } = await supabase
        .from('bank_transactions')
        .update({
          bank_account_id: bankAccountId,
          description: selectedEntry.description,
          category: selectedEntry.category,
          transaction_type: selectedEntry.type,
          amount: selectedEntry.amount,
          transaction_date: selectedEntry.date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', realId);

      if (updateError) throw updateError;

      // Recarregar dados para refletir no saldo e na lista
      await loadBankTransactions();
      await loadBankAccounts();
      await loadFinancialData();

      setIsEditingEntry(false);
      setSelectedEntry(null);

      toast({
        title: 'Sucesso',
        description: 'Lançamento atualizado e saldo recalculado.',
      });
    } catch (error) {
      console.error("Error updating entry:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o lançamento.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const realId = entryId.startsWith('bank-') ? entryId.replace('bank-', '') : entryId;

      // 1) Buscar a transação bancária para descobrir a origem (reference_type/reference_id)
      const { data: bankTx } = await supabase
        .from('bank_transactions')
        .select('id, reference_type, reference_id')
        .eq('id', realId)
        .maybeSingle();

      const refType = bankTx?.reference_type as string | null;
      const refId = bankTx?.reference_id as string | null;

      // 2) Mapa de reference_type -> tabela de origem (cascata em todas as abas vinculadas)
      const sourceTableMap: Record<string, string> = {
        worker_advance: 'worker_advances',
        worker_expense_advance: 'worker_expense_advances',
        worker_food_allowance: 'worker_food_allowances',
        collaborator_vale: 'collaborator_advances',
        collaborator_advance: 'collaborator_advances',
        collaborator_expense_advance: 'collaborator_expense_advances',
        collaborator_payment: 'collaborator_payments',
        food_allowance: 'collaborator_food_allowances',
        food_allowance_batch: 'collaborator_food_allowances',
        daily_rate: 'daily_rates',
        recurring_expense: 'recurring_expense_monthly_payments',
        event_expense: 'event_expenses',
        expense: 'event_expenses',
        company_expense: 'company_expenses',
        company_fixed_expense: 'company_fixed_expense_monthly_payments',
      };

      // 3) Deletar do registro de origem (triggers removem bank_transactions/event_expenses vinculadas)
      if (refType && refId && sourceTableMap[refType]) {
        const srcTable = sourceTableMap[refType];
        const { error: srcError } = await supabase
          .from(srcTable as any)
          .delete()
          .eq('id', refId);
        if (srcError) console.error(`Error deleting from ${srcTable}:`, srcError);

        // Garantir remoção também de event_expenses ligadas pelo mesmo reference
        await supabase
          .from('event_expenses')
          .delete()
          .eq('reference_type', refType)
          .eq('reference_id', refId);
      }

      // 4) Remover a bank_transaction (caso não tenha caído via trigger)
      const { error: bankError } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('id', realId);
      if (bankError) console.error('Error deleting from bank_transactions:', bankError);

      // 5) Remover quaisquer outras bank_transactions vinculadas ao mesmo reference
      if (refType && refId) {
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', refType)
          .eq('reference_id', refId);
      }

      const updatedCashFlow = cashFlow.filter(entry => entry.id !== entryId);
      setCashFlow(updatedCashFlow);

      await loadBankTransactions();
      await loadBankAccounts();
      await loadFinancialData();

      toast({
        title: "Sucesso",
        description: "Lançamento removido de todas as abas vinculadas!",
      });
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o lançamento.",
        variant: "destructive",
      });
    }
  };

  const openEditEntry = (entry: CashFlowEntry) => {
    setSelectedEntry({ ...entry });
    setIsEditingEntry(true);
  };

  const getTotalBalance = () => {
    const total = accounts.reduce((total, account) => total + account.balance, 0);
    console.log('Calculating total balance:', { accounts: accounts.length, total, lastUpdate });
    return total;
  };

  // Função para calcular saldo filtrado de uma conta específica
  // Usa as mesmas transações exibidas em getAccountTransactions para garantir
  // que o "Saldo" reflita exatamente as movimentações visíveis no extrato.
  const getFilteredAccountBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return 0;

    // Sem filtro de data específico, retornar o saldo total já calculado da conta
    if (!dateFilter.startDate && !dateFilter.endDate) {
      return account.balance ?? 0;
    }

    // Com filtro, somar exatamente as movimentações visíveis (cashFlow + bank_transactions)
    const txs = getAccountTransactions(account.name);
    let total = 0;
    for (const t of txs) {
      const amount = Number(t.amount || 0);
      if (t.type === 'income') total += amount;
      else if (t.type === 'expense') total -= amount;
    }
    return total;
  };

  // Função para calcular total de despesas do período filtrado
  const getFilteredAccountExpenses = (accountId: string) => {
    if (!dateFilter.startDate && !dateFilter.endDate) {
      return 0;
    }
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return 0;

    const txs = getAccountTransactions(account.name);
    let totalExpenses = 0;
    for (const t of txs) {
      if (t.type === 'expense') totalExpenses += Number(t.amount || 0);
    }
    return totalExpenses;
  };


  const handleSyncBalances = async () => {
    try {
      setIsRecalculatingBalances(true);
      
      console.log('🔄 Iniciando sincronização manual de saldos...');
      
      toast({
        title: "Sincronizando",
        description: "Atualizando saldos das contas..."
      });

      // Chamar função do Supabase para sincronizar transações e saldos
      const { data: syncResult, error } = await supabase.rpc('force_sync_all_balances');
      
      if (error) throw error;
      
      console.log('🔄 Resultado da sincronização:', syncResult);
      
      // Recarregar dados das contas após sincronização
      await loadBankAccounts();
      await loadFinancialData();
      await loadBankTransactions();
      
      toast({
        title: "Sucesso",
        description: "Saldos sincronizados com sucesso!"
      });
      
    } catch (error) {
      console.error('Erro ao sincronizar saldos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível sincronizar os saldos",
        variant: "destructive"
      });
    } finally {
      setIsRecalculatingBalances(false);
    }
  };

  // Helpers
  const normalizeCategory = useCallback((value?: string | null) =>
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim(), []);

  const isTransferCategory = useCallback((category?: string | null) => {
    const c = normalizeCategory(category);
    // cobre variações como "Transferência", "Transferências", "Transferência entre contas"
    return c.includes('transferencia');
  }, [normalizeCategory]);

  const isPotentialTransferText = useCallback((text?: string | null) => {
    const t = normalizeCategory(text);
    // "pix" sozinho pode ser pagamento real; aqui focamos nos marcadores de transferência
    return t.includes('transfer') || t.includes('transf') || t.includes('ted') || t.includes('doc');
  }, [normalizeCategory]);

  // Detecta transferências entre contas por padrão de pares: mesma data+valor com
  // 1 entrada e 1 saída (contas diferentes). Assim não removemos PIX/pagamentos reais.
  const transferEntryIds = useMemo(() => {
    const keyToGroup = new Map<
      string,
      { incomes: CashFlowEntry[]; expenses: CashFlowEntry[] }
    >();

    for (const entry of cashFlow) {
      if (entry.status === 'cancelled') continue;
      if (!isTransferCategory(entry.category) && !isPotentialTransferText(entry.description)) continue;

      const cents = Math.round((Number(entry.amount) || 0) * 100);
      const key = `${entry.date}|${cents}`;
      const group = keyToGroup.get(key) || { incomes: [], expenses: [] };

      if (entry.type === 'income') group.incomes.push(entry);
      if (entry.type === 'expense') group.expenses.push(entry);

      keyToGroup.set(key, group);
    }

    const ids = new Set<string>();
    for (const group of keyToGroup.values()) {
      if (group.incomes.length === 0 || group.expenses.length === 0) continue;

      // Só considerar transferência se houver contas diferentes no par
      const hasDifferentAccounts = group.incomes.some((i) =>
        group.expenses.some((e) => normalizeCategory(i.account) !== normalizeCategory(e.account))
      );
      if (!hasDifferentAccounts) continue;

      group.incomes.forEach((i) => ids.add(i.id));
      group.expenses.forEach((e) => ids.add(e.id));
    }

    return ids;
  }, [cashFlow, isPotentialTransferText, isTransferCategory]);

  const isTransferEntry = (entry: CashFlowEntry) =>
    isTransferCategory(entry.category) || transferEntryIds.has(entry.id);

  // Resumo (cards): considerar lançamentos confirmados + pendentes (exclui cancelados e transferências)
  const includeInSummary = (entry: CashFlowEntry) =>
    !isTransferEntry(entry) && entry.status !== 'cancelled';

  const getTotalIncome = useMemo(() => {
    const incomeEntries = cashFlow.filter(entry => entry.type === 'income' && entry.status !== 'cancelled');
    const filtered = incomeEntries.filter(entry => {
      const isCatTransfer = isTransferCategory(entry.category);
      const isIdTransfer = transferEntryIds.has(entry.id);
      if (isCatTransfer || isIdTransfer) {
        console.log('🚫 Excluindo transferência da receita:', { id: entry.id, desc: entry.description, category: entry.category, amount: entry.amount, isCatTransfer, isIdTransfer });
        return false;
      }
      return true;
    });
    const total = filtered.reduce((sum, entry) => sum + entry.amount, 0);
    console.log('💰 getTotalIncome recalculado:', { totalBruto: incomeEntries.reduce((s, e) => s + e.amount, 0), totalLiquido: total, excluidas: incomeEntries.length - filtered.length });
    return total;
  }, [cashFlow, transferEntryIds, isTransferCategory]);

  const getTotalExpenses = useMemo(() => {
    const expenseEntries = cashFlow.filter(entry => entry.type === 'expense' && entry.status !== 'cancelled');
    const filtered = expenseEntries.filter(entry => {
      const isCatTransfer = isTransferCategory(entry.category);
      const isIdTransfer = transferEntryIds.has(entry.id);
      if (isCatTransfer || isIdTransfer) {
        console.log('🚫 Excluindo transferência da despesa:', { id: entry.id, desc: entry.description, category: entry.category, amount: entry.amount, isCatTransfer, isIdTransfer });
        return false;
      }
      return true;
    });
    const total = filtered.reduce((sum, entry) => sum + entry.amount, 0);
    console.log('💸 getTotalExpenses recalculado:', { totalBruto: expenseEntries.reduce((s, e) => s + e.amount, 0), totalLiquido: total, excluidas: expenseEntries.length - filtered.length });
    return total;
  }, [cashFlow, transferEntryIds, isTransferCategory]);

  const getNetResult = useMemo(() => {
    return getTotalIncome - getTotalExpenses;
  }, [getTotalIncome, getTotalExpenses]);








  const handleSaveBudgetValues = () => {
    // Recalcular o orçamento com os novos valores
    const updatedBudget = budget.map(item => {
      const newBudgeted = budgetValues[item.category] ?? item.budgeted;
      const remaining = newBudgeted - item.spent;
      const percentage = item.spent > 0 ? (item.spent / newBudgeted) * 100 : 0;
      
      return {
        ...item,
        budgeted: newBudgeted,
        remaining,
        percentage: Math.round(percentage)
      };
    });
    
    setBudget(updatedBudget);
    
    // Salvar no localStorage para persistir os valores
    const budgetKey = `company_budget_${selectedMonth}_${selectedYear}`;
    localStorage.setItem(budgetKey, JSON.stringify(updatedBudget));
    
    setBudgetValues({});
    setIsEditingBudget(false);
    
    toast({
      title: "Sucesso",
      description: "Valores orçamentários atualizados com sucesso!",
    });
  };

  const handleSavePersonalBudgetValues = () => {
    // Recalcular o orçamento pessoal com os novos valores
    const updatedPersonalBudget = personalBudget.map(item => {
      const newBudgeted = personalBudgetValues[item.category] ?? item.budgeted;
      const remaining = newBudgeted - item.spent;
      const percentage = item.spent > 0 ? (item.spent / newBudgeted) * 100 : 0;
      
      return {
        ...item,
        budgeted: newBudgeted,
        remaining,
        percentage: Math.round(percentage)
      };
    });
    
    setPersonalBudget(updatedPersonalBudget);
    
    // Salvar no localStorage para persistir os valores
    const personalBudgetKey = `personal_budget_${selectedMonth}_${selectedYear}`;
    localStorage.setItem(personalBudgetKey, JSON.stringify(updatedPersonalBudget));
    
    setPersonalBudgetValues({});
    setIsEditingPersonalBudget(false);
    
    toast({
      title: "Sucesso",
      description: "Orçamento pessoal atualizado com sucesso!",
    });
  };


  const handleEditInventoryItem = (item: InventoryItem) => {
    setSelectedInventoryItem(item);
    setNewInventoryItem({
      name: item.name,
      category: item.category,
      acquisitionValue: item.acquisitionValue,
      acquisitionDate: item.acquisitionDate,
      condition: item.condition,
      quantity: item.quantity,
      serialNumber: item.serialNumber || "",
      location: item.location,
      description: item.description || ""
    });
    setIsEditingInventoryItem(true);
  };

  const handleAddInventoryItem = async () => {
    if (!newInventoryItem.name || !newInventoryItem.category || !newInventoryItem.acquisitionValue || !newInventoryItem.location) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios (Nome, Categoria, Valor de Aquisição e Localização).",
        variant: "destructive",
      });
      return;
    }

    try {
      // Salvar no banco de dados (tabela patrimony_inventory)
      const { data, error } = await supabase
        .from('patrimony_inventory')
        .insert({
          name: newInventoryItem.name,
          category: newInventoryItem.category,
          acquisition_value: newInventoryItem.acquisitionValue,
          acquisition_date: newInventoryItem.acquisitionDate,
          condition: newInventoryItem.condition,
          quantity: newInventoryItem.quantity,
          serial_number: newInventoryItem.serialNumber,
          location: newInventoryItem.location,
          description: newInventoryItem.description,
          current_value: newInventoryItem.acquisitionValue
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar estado local
      const newItem: InventoryItem = {
        id: data.id,
        name: newInventoryItem.name,
        category: newInventoryItem.category,
        acquisitionValue: newInventoryItem.acquisitionValue,
        acquisitionDate: newInventoryItem.acquisitionDate,
        condition: newInventoryItem.condition,
        quantity: newInventoryItem.quantity,
        serialNumber: newInventoryItem.serialNumber,
        location: newInventoryItem.location,
        description: newInventoryItem.description,
        currentValue: newInventoryItem.acquisitionValue
      };

      setInventory([...inventory, newItem]);
      
      // Limpar formulário
      setNewInventoryItem({
        name: "",
        category: "",
        acquisitionValue: 0,
        acquisitionDate: new Date().toISOString().split('T')[0],
        condition: "",
        quantity: 1,
        serialNumber: "",
        location: "",
        description: ""
      });
      
      setIsAddingEntry(false);
      
      toast({
        title: "Sucesso",
        description: "Item adicionado ao inventário com sucesso!",
      });
    } catch (error) {
      console.error('Error adding inventory item:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar item ao inventário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInventoryItem = async () => {
    if (!selectedInventoryItem) return;

    try {
      // Calcular valor atual com depreciação simples (5% ao ano)
      const currentValue = Math.max(
        newInventoryItem.acquisitionValue * 0.7, 
        newInventoryItem.acquisitionValue - (newInventoryItem.acquisitionValue * 0.05 * 
          Math.max(1, new Date().getFullYear() - new Date(newInventoryItem.acquisitionDate).getFullYear()))
      );

      // Atualizar no banco de dados
      const { error } = await supabase
        .from('patrimony_inventory')
        .update({
          name: newInventoryItem.name,
          category: newInventoryItem.category,
          acquisition_value: newInventoryItem.acquisitionValue,
          acquisition_date: newInventoryItem.acquisitionDate,
          condition: newInventoryItem.condition,
          quantity: newInventoryItem.quantity,
          serial_number: newInventoryItem.serialNumber,
          location: newInventoryItem.location,
          description: newInventoryItem.description,
          current_value: currentValue
        })
        .eq('id', selectedInventoryItem.id);

      if (error) throw error;

      const updatedItem: InventoryItem = {
        ...selectedInventoryItem,
        name: newInventoryItem.name,
        category: newInventoryItem.category,
        acquisitionValue: newInventoryItem.acquisitionValue,
        acquisitionDate: newInventoryItem.acquisitionDate,
        condition: newInventoryItem.condition,
        quantity: newInventoryItem.quantity,
        serialNumber: newInventoryItem.serialNumber,
        location: newInventoryItem.location,
        description: newInventoryItem.description,
        currentValue: currentValue
      };

      setInventory(inventory.map(item => 
        item.id === selectedInventoryItem.id ? updatedItem : item
      ));

      setIsEditingInventoryItem(false);
      setSelectedInventoryItem(null);
      setNewInventoryItem({
        name: "",
        category: "",
        acquisitionValue: 0,
        acquisitionDate: new Date().toISOString().split('T')[0],
        condition: "",
        quantity: 1,
        serialNumber: "",
        location: "",
        description: ""
      });

      toast({
        title: "Sucesso",
        description: "Item do inventário atualizado com sucesso!",
      });
    } catch (error) {
      console.error('Error updating inventory item:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar item do inventário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteInventoryItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('patrimony_inventory')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      setInventory(inventory.filter(item => item.id !== itemId));
      toast({
        title: "Sucesso",
        description: "Item removido do inventário com sucesso!",
      });
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover item do inventário. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleViewInventoryItem = (item: InventoryItem) => {
    setViewInventoryItem(item);
    setIsViewingInventoryItem(true);
  };

  const generatePatrimonyPDF = async () => {
    const doc = new jsPDF({
      compress: true
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Função para adicionar papel timbrado
    const addLetterhead = () => {
      // Borda superior decorativa
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(3);
      doc.line(10, 15, pageWidth - 10, 15);
      
      // Borda lateral esquerda
      doc.setLineWidth(1);
      doc.line(10, 15, 10, pageHeight - 15);
      
      // Borda lateral direita
      doc.line(pageWidth - 10, 15, pageWidth - 10, pageHeight - 15);
      
      // Borda inferior
      doc.line(10, pageHeight - 15, pageWidth - 10, pageHeight - 15);
    };

    // Função para adicionar cabeçalho oficial
    const addOfficialHeader = async () => {
      // Adicionar logo se disponível
      if (logoUrl) {
        try {
          const logoImg = new Image();
          logoImg.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
            logoImg.src = logoUrl;
          });
          
          // Logo no canto superior esquerdo
          const logoSize = 20;
          doc.addImage(logoImg, 'JPEG', 15, 20, logoSize, logoSize);
        } catch (error) {
          console.error('Erro ao carregar logo:', error);
        }
      }
      
      // Cabeçalho da empresa usando dados dinâmicos das configurações
      const companyName = settings?.company_name || 'LUZ LOCAÇÃO';
      const tagline = settings?.tagline || 'Controle de Estoque e Patrimônio';
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 102, 204);
      doc.text(companyName, pageWidth - 15, 25, { align: 'right' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(102, 102, 102);
      doc.text(tagline, pageWidth - 15, 32, { align: 'right' });
      
      // Informações adicionais da empresa
      let yPos = 38;
      if (settings?.cnpj) {
        doc.text(`CNPJ: ${settings.cnpj}`, pageWidth - 15, yPos, { align: 'right' });
        yPos += 6;
      }
      if (settings?.phone) {
        doc.text(`Tel: ${settings.phone}`, pageWidth - 15, yPos, { align: 'right' });
        yPos += 6;
      }
      if (settings?.email) {
        doc.text(settings.email, pageWidth - 15, yPos, { align: 'right' });
        yPos += 6;
      }
      
      // Linha divisória
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.5);
      doc.line(15, yPos + 3, pageWidth - 15, yPos + 3);
    };

    // Função para adicionar rodapé oficial
    const addOfficialFooter = () => {
      const footerY = pageHeight - 25;
      
      // Linha divisória superior
      doc.setDrawColor(0, 102, 204);
      doc.setLineWidth(0.5);
      doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
      
      // Informações da empresa usando dados dinâmicos das configurações
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(102, 102, 102);
      
      const companyInfo = [
        `${settings?.company_name || 'GESTAO LINE TAPE'} - ${settings?.tagline || 'Controle de Estoque e Patrimônio'}`,
        settings?.address ? `Endereço: ${settings.address}` : '',
        `Data de emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`
      ].filter(Boolean); // Remove linhas vazias
      
      companyInfo.forEach((line, index) => {
        doc.text(line, pageWidth / 2, footerY + (index * 4), { align: 'center' });
      });
    };

    // Função para adicionar marca d'água
    const addWatermark = () => {
      doc.saveGraphicsState();
      doc.setTextColor(300, 300, 300);
      doc.setFontSize(50);
      doc.setFont('helvetica', 'bold');
      
      const watermarkText = 'CONFIDENCIAL';
      
      // Rotacionar e posicionar a marca d'água
      doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
        align: 'center',
        angle: 45,
        baseline: 'middle'
      });
      
      doc.restoreGraphicsState();
    };

    // Inicializar primeira página
    addLetterhead();
    await addOfficialHeader();
    addWatermark();
    addOfficialFooter();
    
    // Título principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('RELATÓRIO PATRIMONIAL', pageWidth / 2, 65, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(102, 102, 102);
    doc.text('Para Fins Bancários e Financeiros', pageWidth / 2, 75, { align: 'center' });
    
    // Número do documento
    const docNumber = `REL-PAT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    doc.setFontSize(10);
    doc.text(`Documento Nº: ${docNumber}`, pageWidth / 2, 85, { align: 'center' });
    
    // Resumo geral
    const totalItems = inventory.reduce((total, item) => total + item.quantity, 0);
    const totalValue = inventory.reduce((total, item) => total + (item.acquisitionValue * item.quantity), 0);
    const totalDepreciation = inventory.reduce((total, item) => {
      const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
      const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
      const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue * item.quantity;
      return total + depreciation;
    }, 0);
    const currentValue = totalValue - totalDepreciation;
    
    let yPosition = 100;
    
    // Caixa de resumo com fundo
    doc.setFillColor(245, 248, 255);
    doc.rect(20, yPosition - 5, pageWidth - 40, 45, 'F');
    doc.setDrawColor(0, 102, 204);
    doc.setLineWidth(0.5);
    doc.rect(20, yPosition - 5, pageWidth - 40, 45);
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('RESUMO EXECUTIVO', 25, yPosition + 5);
    
    yPosition += 15;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`• Total de Itens: ${totalItems} unidades`, 25, yPosition);
    yPosition += 8;
    doc.text(`• Valor Total de Aquisição: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPosition);
    yPosition += 8;
    doc.text(`• Depreciação Acumulada: R$ ${totalDepreciation.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPosition);
    yPosition += 8;
    doc.setFontSize(12);
    doc.setTextColor(0, 102, 0);
    doc.text(`• Valor Patrimonial Atual: R$ ${currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPosition);
    yPosition += 25;
    
    // Detalhamento por categoria
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 51, 102);
    doc.text('DETALHAMENTO POR CATEGORIA', 20, yPosition);
    yPosition += 15;
    
    const categories = [...new Set(inventory.map(item => item.category))];
    
    categories.forEach(category => {
      const categoryItems = inventory.filter(item => item.category === category);
      const categoryValue = categoryItems.reduce((total, item) => total + (item.acquisitionValue * item.quantity), 0);
      const categoryDepreciation = categoryItems.reduce((total, item) => {
        const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
        const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
        const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue * item.quantity;
        return total + depreciation;
      }, 0);
      
      const categoryName = {
        'equipamentos-som': 'Equipamentos de Som',
        'equipamentos-iluminacao': 'Equipamentos de Iluminação',
        'moveis': 'Móveis e Utensílios',
        'veiculos': 'Veículos',
        'informatica': 'Informática',
        'ferramentas': 'Ferramentas',
        'outros': 'Outros'
      }[category] || category;
      
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        addLetterhead();
        addWatermark();
        addOfficialFooter();
        yPosition = 55;
      }
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(categoryName, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Itens: ${categoryItems.reduce((total, item) => total + item.quantity, 0)}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Valor de Aquisição: R$ ${categoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPosition);
      yPosition += 6;
      doc.text(`Valor Atual: R$ ${(categoryValue - categoryDepreciation).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 25, yPosition);
      yPosition += 15;
    });
    
    // Lista detalhada de itens
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      addLetterhead();
      addWatermark();
      addOfficialFooter();
      yPosition = 55;
    }
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INVENTÁRIO DETALHADO', 20, yPosition);
    yPosition += 15;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Item', 20, yPosition);
    doc.text('Qtd', 80, yPosition);
    doc.text('Aquisição', 100, yPosition);
    doc.text('Valor Atual', 140, yPosition);
    doc.text('Localização', 180, yPosition);
    yPosition += 8;
    
    doc.setFont('helvetica', 'normal');
    
    inventory.forEach((item) => {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        addLetterhead();
        addWatermark();
        addOfficialFooter();
        yPosition = 55;
      }
      
      const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
      const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
      const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue;
      const currentItemValue = Math.max(item.acquisitionValue - depreciation, item.acquisitionValue * 0.1);
      
      const itemName = item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name;
      const location = item.location.length > 20 ? item.location.substring(0, 20) + '...' : item.location;
      
      doc.text(itemName, 20, yPosition);
      doc.text(item.quantity.toString(), 80, yPosition);
      doc.text(`R$ ${(item.acquisitionValue * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, yPosition);
      doc.text(`R$ ${(currentItemValue * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 140, yPosition);
      doc.text(location, 180, yPosition);
      yPosition += 6;
    });
    
    // Rodapé
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 30, pageHeight - 10);
      doc.text('Documento gerado automaticamente pelo sistema', 20, pageHeight - 10);
    }
    
    // Salvar o PDF
    doc.save(`relatorio-patrimonial-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "Sucesso",
      description: "Relatório patrimonial gerado com sucesso!",
    });
  };

  const getConditionBadgeVariant = (condition: string) => {
    switch (condition) {
      case 'novo': return 'default';
      case 'otimo': return 'secondary';
      case 'bom': return 'outline';
      case 'regular': return 'secondary';
      case 'ruim': return 'destructive';
      default: return 'outline';
    }
  };

  const getConditionLabel = (condition: string) => {
    switch (condition) {
      case 'novo': return 'Novo';
      case 'otimo': return 'Ótimo';
      case 'bom': return 'Bom';
      case 'regular': return 'Regular';
      case 'ruim': return 'Ruim';
      case 'pessimo': return 'Péssimo';
      default: return condition;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'equipamentos-som': return 'Equipamentos de Som';
      case 'equipamentos-iluminacao': return 'Equipamentos de Iluminação';
      case 'moveis': return 'Móveis e Utensílios';
      case 'veiculos': return 'Veículos';
      case 'informatica': return 'Informática';
      case 'ferramentas': return 'Ferramentas';
      case 'outros': return 'Outros';
      default: return category;
    }
  };

  const getAccountTransactions = (accountName: string) => {
    // Buscar transações do fluxo de caixa (eventos, despesas, etc)
    const cashFlowTransactions = cashFlow.filter(entry => {
      const entryMatches = entry.account === accountName;
      
      // Sempre filtrar pelo mês/ano selecionado
      const entryDate = new Date(entry.date + 'T00:00:00');
      const entryMonth = entryDate.getMonth() + 1;
      const entryYear = entryDate.getFullYear();
      const monthYearMatches = entryMonth === selectedMonth && entryYear === selectedYear;
      
      if (!monthYearMatches) return false;
      
      // Aplicar filtro adicional de data se definido
      if (!dateFilter.startDate && !dateFilter.endDate) {
        return entryMatches;
      }
      
      // Normalizar as datas para comparação sem timezone
      const entryDateStr = entry.date; // Já vem no formato YYYY-MM-DD
      // Converter Date para string YYYY-MM-DD usando horário local (não UTC)
      const formatLocalDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const startDateStr = dateFilter.startDate ? formatLocalDate(dateFilter.startDate) : null;
      const endDateStr = dateFilter.endDate ? formatLocalDate(dateFilter.endDate) : null;
      
      if (startDateStr && endDateStr) {
        return entryMatches && entryDateStr >= startDateStr && entryDateStr <= endDateStr;
      } else if (startDateStr) {
        return entryMatches && entryDateStr >= startDateStr;
      } else if (endDateStr) {
        return entryMatches && entryDateStr <= endDateStr;
      }
      
      return entryMatches;
    });

    // Criar um Set com os IDs das transações já incluídas no cashFlow
    const cashFlowIds = new Set(cashFlowTransactions.map(entry => entry.id));

    // Buscar transações bancárias que não estejam já incluídas no cashFlow
    // Filtrar usando o ID para evitar duplicação
    const directTransactions = bankTransactions
      .filter(transaction => {
        // Verificar se pertence à conta correta
        if (transaction.bank_accounts?.name !== accountName) return false;
        
        // Excluir transações de despesas fixas (recurring_expense) pois já aparecem no cashFlow
        // via recurring_expense_monthly_payments
        if (transaction.reference_type === 'recurring_expense') return false;
        
        // Verificar se já está no cashFlow usando o ID
        return !cashFlowIds.has(transaction.id);
      })
      .map(transaction => ({
        id: `bank-${transaction.id}`,
        date: transaction.transaction_date,
        description: transaction.description,
        category: transaction.category || 'Movimentação',
        type: transaction.transaction_type as 'income' | 'expense',
        amount: transaction.amount,
        account: accountName,
        status: 'confirmed' as const,
        reference_type: transaction.reference_type,
        reference_id: transaction.reference_id
      }))
      .filter(entry => {
        // Sempre filtrar pelo mês/ano selecionado
        const entryDate = new Date(entry.date + 'T00:00:00');
        const entryMonth = entryDate.getMonth() + 1;
        const entryYear = entryDate.getFullYear();
        const monthYearMatches = entryMonth === selectedMonth && entryYear === selectedYear;
        
        if (!monthYearMatches) return false;
        
        // Aplicar filtro adicional de data se definido
        if (!dateFilter.startDate && !dateFilter.endDate) {
          return true;
        }
        
        // Normalizar as datas para comparação sem timezone
        const entryDateStr = entry.date; // Já vem no formato YYYY-MM-DD
        // Converter Date para string YYYY-MM-DD usando horário local (não UTC)
        const formatLocalDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const startDateStr = dateFilter.startDate ? formatLocalDate(dateFilter.startDate) : null;
        const endDateStr = dateFilter.endDate ? formatLocalDate(dateFilter.endDate) : null;
        
        if (startDateStr && endDateStr) {
          return entryDateStr >= startDateStr && entryDateStr <= endDateStr;
        } else if (startDateStr) {
          return entryDateStr >= startDateStr;
        } else if (endDateStr) {
          return entryDateStr <= endDateStr;
        }
        
        return true;
      });

    // Combinar e ordenar todas as transações por data
    const allTransactions = [...cashFlowTransactions, ...directTransactions];
    return allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Generate financial reports
  const generateReport = async (reportType: string) => {
    setIsGeneratingReport(true);
    setActiveReport(reportType);
    
    try {
      let generatedData = null;
      
      switch (reportType) {
        case 'income-statement':
          generatedData = generateIncomeStatement();
          break;
        case 'cash-flow-projection':
          generatedData = await generateCashFlowProjection();
          break;
        case 'profitability-analysis':
          generatedData = generateProfitabilityAnalysis();
          break;
        case 'tax-report':
          generatedData = generateTaxReport();
          break;
        case 'deductible-expenses':
          generatedData = generateDeductibleExpensesReport();
          break;
        default:
          throw new Error('Tipo de relatório não suportado');
      }
      
      setReportData(generatedData);
      
      toast({
        title: "Relatório gerado",
        description: "O relatório foi gerado com sucesso!",
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível gerar o relatório.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Generate Income Statement (DRE) com suporte a múltiplos regimes tributários
  const generateIncomeStatement = () => {
    const totalRevenue = getTotalIncome;
    const totalExpenses = getTotalExpenses;
    
    // Group expenses by category (excluindo transferências entre contas - são apenas fluxo de caixa interno)
    const expensesByCategory = cashFlow
      .filter(
        entry =>
          entry.type === 'expense' &&
          entry.status === 'confirmed' &&
          !isTransferEntry(entry)
      )
      .reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
        return acc;
      }, {} as Record<string, number>);

    // 1. Receita Bruta
    const receitaBruta = totalRevenue;
    
    // 2. Deduções e Impostos - CÁLCULO DINÂMICO POR REGIME
    let deducoesImpostos = 0;
    let taxaImpostos = 0;
    const detalhamentoImpostos = {
      ISS: 0,
      PIS_COFINS: 0,
      CBS: 0,
      IBS: 0,
      simplesTotal: 0,
    };
    let regimeNome = '';
    
    switch (dreTaxRegime) {
      case 'simples':
        // Simples Nacional - usando Anexo III para serviços
        regimeNome = 'Simples Nacional';
        const receitaAnual = receitaBruta * 12;
        const simplesRate = SIMPLES_NACIONAL_RATES_DRE.find(r => receitaAnual <= r.max) || SIMPLES_NACIONAL_RATES_DRE[5];
        const effectiveSimplesRate = ((receitaAnual * simplesRate.rate) - simplesRate.deduction) / receitaAnual;
        taxaImpostos = Math.max(effectiveSimplesRate, 0.06);
        deducoesImpostos = receitaBruta * taxaImpostos;
        detalhamentoImpostos.simplesTotal = deducoesImpostos;
        break;
        
      case 'lucro_presumido':
        // Lucro Presumido - ISS 5% + PIS 0,65% + COFINS 3%
        regimeNome = 'Lucro Presumido';
        detalhamentoImpostos.ISS = receitaBruta * 0.05;
        detalhamentoImpostos.PIS_COFINS = receitaBruta * 0.0365;
        taxaImpostos = 0.0865;
        deducoesImpostos = detalhamentoImpostos.ISS + detalhamentoImpostos.PIS_COFINS;
        break;
        
      case 'lucro_real':
        // Lucro Real - ISS 5% + PIS/COFINS não cumulativo 9,25%
        regimeNome = 'Lucro Real';
        detalhamentoImpostos.ISS = receitaBruta * 0.05;
        detalhamentoImpostos.PIS_COFINS = receitaBruta * 0.0925;
        taxaImpostos = 0.1425;
        deducoesImpostos = detalhamentoImpostos.ISS + detalhamentoImpostos.PIS_COFINS;
        break;
        
      case 'reforma_2026':
        // Reforma Tributária 2026 - CBS + IBS substituem PIS/COFINS/ISS gradualmente
        regimeNome = 'Reforma 2026 (Fase Teste)';
        detalhamentoImpostos.CBS = receitaBruta * TAX_RATES_2026.CBS;
        detalhamentoImpostos.IBS = receitaBruta * TAX_RATES_2026.IBS;
        // Na fase de teste, ainda cobra ISS e PIS/COFINS reduzidos
        detalhamentoImpostos.ISS = receitaBruta * 0.04; // Redução gradual
        detalhamentoImpostos.PIS_COFINS = receitaBruta * 0.029; // Redução gradual
        taxaImpostos = 0.079; // 7.9% total na fase de transição
        deducoesImpostos = detalhamentoImpostos.CBS + detalhamentoImpostos.IBS + detalhamentoImpostos.ISS + detalhamentoImpostos.PIS_COFINS;
        break;
    }
    
    // 3. Receita Líquida
    const receitaLiquida = receitaBruta - deducoesImpostos;
    
    // 4. Custos dos Serviços Prestados (despesas diretas de eventos)
    const custoServicos = Object.entries(expensesByCategory)
      .filter(([cat]) => ['Diárias', 'Equipamentos', 'Transporte', 'Alimentação'].includes(cat))
      .reduce((sum, [, val]) => sum + val, 0);
    
    // 5. Lucro Bruto
    const lucroBruto = receitaLiquida - custoServicos;
    
    // 6. Despesas Operacionais
    const despesasAdministrativas = Object.entries(expensesByCategory)
      .filter(([cat]) => ['Salários', 'Aluguel', 'Água', 'Luz', 'Internet', 'Telefone', 'Material de Escritório'].includes(cat))
      .reduce((sum, [, val]) => sum + val, 0);
    
    const despesasComerciais = Object.entries(expensesByCategory)
      .filter(([cat]) => ['Marketing', 'Publicidade', 'Comissões'].includes(cat))
      .reduce((sum, [, val]) => sum + val, 0);
    
    const despesasFinanceiras = Object.entries(expensesByCategory)
      .filter(([cat]) => ['Juros', 'Taxas Bancárias', 'IOF'].includes(cat))
      .reduce((sum, [, val]) => sum + val, 0);
    
    const receitasFinanceiras = 0; // Pode ser adicionado se houver receitas financeiras
    
    const totalDespesasOperacionais = despesasAdministrativas + despesasComerciais + despesasFinanceiras - receitasFinanceiras;
    
    // 7. Resultado Operacional
    const resultadoOperacional = lucroBruto - totalDespesasOperacionais;
    
    // 8. Outras Receitas/Despesas
    const outrasReceitasDespesas = Object.entries(expensesByCategory)
      .filter(([cat]) => !['Diárias', 'Equipamentos', 'Transporte', 'Alimentação', 'Salários', 'Aluguel', 'Água', 'Luz', 'Internet', 'Telefone', 'Material de Escritório', 'Marketing', 'Publicidade', 'Comissões', 'Juros', 'Taxas Bancárias', 'IOF'].includes(cat))
      .reduce((sum, [, val]) => sum - val, 0); // Negativo pois são despesas
    
    // 9. Resultado Antes IR/CSLL
    const resultadoAntesIR = resultadoOperacional + outrasReceitasDespesas;
    
    // 10. IR e CSLL - CÁLCULO DINÂMICO POR REGIME
    let irCSLL = 0;
    let taxaIRCSLL = 0;
    const detalhamentoIRCSLL = {
      IRPJ: 0,
      IRPJ_adicional: 0,
      CSLL: 0,
    };
    
    if (resultadoAntesIR > 0) {
      switch (dreTaxRegime) {
        case 'simples':
          // Simples Nacional - IR/CSLL já inclusos na alíquota única
          irCSLL = 0;
          taxaIRCSLL = 0;
          break;
          
        case 'lucro_presumido':
        case 'reforma_2026':
          // Base presumida de 32% para serviços
          const presumedProfit = receitaBruta * 0.32;
          detalhamentoIRCSLL.IRPJ = presumedProfit * INCOME_TAX_RATES_DRE.IRPJ;
          if (presumedProfit > 20000) {
            detalhamentoIRCSLL.IRPJ_adicional = (presumedProfit - 20000) * INCOME_TAX_RATES_DRE.IRPJ_adicional;
          }
          detalhamentoIRCSLL.CSLL = presumedProfit * INCOME_TAX_RATES_DRE.CSLL;
          irCSLL = detalhamentoIRCSLL.IRPJ + detalhamentoIRCSLL.IRPJ_adicional + detalhamentoIRCSLL.CSLL;
          taxaIRCSLL = receitaBruta > 0 ? irCSLL / receitaBruta : 0;
          break;
          
        case 'lucro_real':
          // Base de lucro real (resultado antes do IR)
          detalhamentoIRCSLL.IRPJ = resultadoAntesIR * INCOME_TAX_RATES_DRE.IRPJ;
          if (resultadoAntesIR > 20000) {
            detalhamentoIRCSLL.IRPJ_adicional = (resultadoAntesIR - 20000) * INCOME_TAX_RATES_DRE.IRPJ_adicional;
          }
          detalhamentoIRCSLL.CSLL = resultadoAntesIR * INCOME_TAX_RATES_DRE.CSLL;
          irCSLL = detalhamentoIRCSLL.IRPJ + detalhamentoIRCSLL.IRPJ_adicional + detalhamentoIRCSLL.CSLL;
          taxaIRCSLL = resultadoAntesIR > 0 ? irCSLL / resultadoAntesIR : 0;
          break;
      }
    }
    
    // 11. Lucro Líquido
    const lucroLiquido = resultadoAntesIR - irCSLL;

    return {
      type: 'income-statement',
      title: 'Demonstrativo de Resultados do Exercício (DRE)',
      period: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      data: {
        receitaBruta,
        deducoesImpostos,
        receitaLiquida,
        custoServicos,
        lucroBruto,
        despesasOperacionais: {
          administrativas: despesasAdministrativas,
          comerciais: despesasComerciais,
          financeiras: despesasFinanceiras,
          receitasFinanceiras,
          total: totalDespesasOperacionais
        },
        resultadoOperacional,
        outrasReceitasDespesas,
        resultadoAntesIR,
        irCSLL,
        lucroLiquido,
        margemLiquida: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0,
        margemBruta: receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0,
        // Novos campos para detalhamento por regime
        regimeTributario: dreTaxRegime,
        regimeNome,
        taxaImpostos,
        taxaIRCSLL,
        detalhamentoImpostos,
        detalhamentoIRCSLL,
        // Manter compatibilidade com código existente
        revenue: {
          total: totalRevenue,
          events: cashFlow
            .filter(entry => entry.type === 'income' && entry.status === 'confirmed')
            .reduce((acc, entry) => acc + entry.amount, 0)
        },
        expenses: {
          total: totalExpenses,
          byCategory: expensesByCategory
        },
        netIncome: lucroLiquido,
        netMargin: receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0
      }
    };
  };

  // Generate Cash Flow Projection - busca dados diretamente do banco para cada mês
  // Obs: não depende do estado `cashFlow` (que é filtrado pelo período selecionado na tela)
  const generateCashFlowProjection = async () => {
    const currentMonth = new Date();
    const projections: Array<{ month: string; income: number; expenses: number; netFlow: number }> = [];

    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1);
      const monthKey = format(monthDate, 'yyyy-MM');
      const startDate = `${monthKey}-01`;
      const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      const endDate = `${monthKey}-${lastDay.toString().padStart(2, '0')}`;

      // Carregar tudo em paralelo para reduzir latência
      const [
        transactionsRes,
        paidEventsRes,
        remainingPaymentsRes,
        eventExpensesRes,
        companyExpensesRes,
        collaboratorPaymentsRes,
        collaboratorAdvancesRes,
        collaboratorExpenseAdvancesRes,
        foodAllowancesRes,
        dailyRatesRes,
        recurringPaymentsRes,
        companyFixedPaymentsRes,
      ] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('amount, transaction_type, category, reference_type, reference_id, description, transaction_date')
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate),
        supabase
          .from('events')
          .select('id, name, payment_amount, payment_date')
          .eq('is_paid', true)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        supabase
          .from('events')
          .select('id, name, remaining_payment_amount, remaining_payment_date')
          .eq('is_remaining_paid', true)
          .not('remaining_payment_date', 'is', null)
          .gte('remaining_payment_date', startDate)
          .lte('remaining_payment_date', endDate),
        supabase
          .from('event_expenses')
          .select('id, description, total_price, category, expense_date, created_at')
          .not('expense_bank_account', 'is', null)
          .neq('expense_bank_account', '')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate),
        supabase
          .from('company_expenses')
          .select('id, description, total_price, category, expense_date, payment_date, created_at')
          .not('expense_bank_account', 'is', null)
          .neq('expense_bank_account', '')
          .gte('expense_date', startDate)
          .lte('expense_date', endDate),
        supabase
          .from('collaborator_payments')
          .select('id, amount, payment_date, is_paid')
          .not('bank_account_id', 'is', null)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        supabase
          .from('collaborator_advances')
          .select('id, amount, advance_date')
          .not('bank_account_id', 'is', null)
          .gte('advance_date', startDate)
          .lte('advance_date', endDate),
        supabase
          .from('collaborator_expense_advances')
          .select('id, amount, advance_date')
          .not('bank_account_id', 'is', null)
          .gte('advance_date', startDate)
          .lte('advance_date', endDate),
        supabase
          .from('collaborator_food_allowances')
          .select('id, amount, allowance_date, collaborator_id, collaborators(name)')
          .not('bank_account_id', 'is', null)
          .gte('allowance_date', startDate)
          .lte('allowance_date', endDate),
        supabase
          .from('daily_rates')
          .select('id, amount, date')
          .not('bank_account_id', 'is', null)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('recurring_expense_monthly_payments')
          .select('id, payment_amount, payment_date')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        supabase
          .from('company_fixed_expense_monthly_payments')
          .select('id, payment_amount, payment_date')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
      ]);

      const transactions = (transactionsRes.data || []) as any[];
      const paidEvents = (paidEventsRes.data || []) as any[];
      const remainingPayments = (remainingPaymentsRes.data || []) as any[];
      const eventExpenses = (eventExpensesRes.data || []) as any[];
      const companyExpenses = (companyExpensesRes.data || []) as any[];
      const collaboratorPayments = (collaboratorPaymentsRes.data || []) as any[];
      const collaboratorAdvances = (collaboratorAdvancesRes.data || []) as any[];
      const collaboratorExpenseAdvances = (collaboratorExpenseAdvancesRes.data || []) as any[];
      const foodAllowances = (foodAllowancesRes.data || []) as any[];
      const dailyRates = (dailyRatesRes.data || []) as any[];
      const recurringPayments = (recurringPaymentsRes.data || []) as any[];
      const companyFixedPayments = (companyFixedPaymentsRes.data || []) as any[];

      // Set de referências existentes (mesma estratégia do loadFinancialData)
      const existingReferenceKeys = new Set(
        transactions
          .filter((t) => t.reference_type && t.reference_id)
          .map((t) => `${t.reference_type}-${t.reference_id}`)
      );

      const existingReferenceIdValues = new Set(
        transactions
          .filter((t) => t.reference_id)
          .map((t) => String(t.reference_id))
      );

      const hasReference = (referenceType: string | null | undefined, referenceId: string | null | undefined) => {
        if (!referenceId) return false;
        if (referenceType && existingReferenceKeys.has(`${referenceType}-${referenceId}`)) return true;
        return existingReferenceIdValues.has(String(referenceId));
      };

      const hasTx = (opts: {
        type: 'income' | 'expense';
        amount?: number | null;
        // "date" é opcional, mas não usamos match exato para evitar duplicar quando
        // o lançamento tem data diferente no extrato vs. no cadastro do sistema.
        date?: string | null;
        descriptionNeedle?: string | null;
      }) => {
        if (!opts.amount) return false;
        const needle = (opts.descriptionNeedle || '').toLowerCase().trim();

        return transactions.some((t) => {
          if (t.transaction_type !== opts.type) return false;
          if (typeof t.amount !== 'number') return false;
          if (Math.abs(t.amount - opts.amount) >= 0.01) return false;

          // Regra: quando temos descrição, não bater data exatamente (extrato vs sistema).
          // Quando NÃO temos descrição, usar a data para não "confundir" lançamentos iguais.
          if (!needle && opts.date && t.transaction_date !== opts.date) return false;

          if (needle) {
            const desc = String(t.description || '').toLowerCase();
            if (!desc.includes(needle)) return false;
          }
          return true;
        });
      };

      // Detectar transferências entre contas por pares (mesma data+valor: 1 entrada + 1 saída em contas diferentes)
      const transferBankTxIds = (() => {
        const keyToGroup = new Map<string, { incomes: any[]; expenses: any[] }>();

        for (const t of transactions) {
          if (!t) continue;
          const looksTransfer = isTransferCategory(t.category) || isPotentialTransferText(t.description);
          if (!looksTransfer) continue;

          const cents = Math.round((Number(t.amount) || 0) * 100);
          const key = `${String(t.transaction_date || '')}|${cents}`;
          const group = keyToGroup.get(key) || { incomes: [], expenses: [] };

          if (t.transaction_type === 'income') group.incomes.push(t);
          if (t.transaction_type === 'expense') group.expenses.push(t);

          keyToGroup.set(key, group);
        }

        const ids = new Set<string>();
        for (const group of keyToGroup.values()) {
          if (group.incomes.length === 0 || group.expenses.length === 0) continue;
          const hasDifferentAccounts = group.incomes.some((i) =>
            group.expenses.some((e) => String(i.bank_account_id || '') !== String(e.bank_account_id || ''))
          );
          if (!hasDifferentAccounts) continue;

          group.incomes.forEach((i) => i?.id && ids.add(String(i.id)));
          group.expenses.forEach((e) => e?.id && ids.add(String(e.id)));
        }
        return ids;
      })();

      // 1) Base: somar bank_transactions (excluindo transferências)
      let monthIncome = 0;
      let monthExpenses = 0;

      transactions.forEach((t) => {
        if (isTransferCategory(t.category) || transferBankTxIds.has(String(t.id))) return;
        if (t.transaction_type === 'income') monthIncome += t.amount || 0;
        if (t.transaction_type === 'expense') monthExpenses += t.amount || 0;
      });

      // 2) Complementos (somente se NÃO existir em bank_transactions)
      // Pagamento de eventos (reference_type esperado: 'event')
      paidEvents.forEach((event) => {
        const amount = event.payment_amount;
        const date = event.payment_date;
        if (!amount || amount <= 0) return;

        const exists =
          hasReference('event', event.id) ||
          hasTx({ type: 'income', amount, date, descriptionNeedle: event.name });

        if (!exists) monthIncome += amount;
      });

      // Pagamentos restantes (reference_type esperado: 'event_remaining')
      remainingPayments.forEach((event) => {
        const amount = event.remaining_payment_amount;
        const date = event.remaining_payment_date;
        if (!amount || amount <= 0) return;

        const exists =
          hasReference('event_remaining', event.id) ||
          hasTx({ type: 'income', amount, date, descriptionNeedle: event.name });

        if (!exists) monthIncome += amount;
      });

      // Despesas de eventos (reference_type esperado: 'expense')
      eventExpenses.forEach((expense) => {
        const amount = expense.total_price;
        const date = expense.expense_date || (expense.created_at ? String(expense.created_at).split('T')[0] : null);
        const category = expense.category;
        const description = expense.description;
        if (!amount || amount <= 0) return;
        if (isTransferCategory(category)) return;

        const exists =
          hasReference('expense', expense.id) ||
          hasReference(undefined, expense.id) ||
          hasTx({ type: 'expense', amount, date, descriptionNeedle: description });

        if (!exists) monthExpenses += amount;
      });

      // Despesas da empresa (pode não ter reference_* padronizado)
      companyExpenses.forEach((expense) => {
        const amount = expense.total_price;
        const date =
          expense.expense_date ||
          expense.payment_date ||
          (expense.created_at ? String(expense.created_at).split('T')[0] : null);
        const category = expense.category;
        if (!amount || amount <= 0) return;
        if (isTransferCategory(category)) return;

        const exists =
          hasReference('company_expense', expense.id) ||
          hasReference(undefined, expense.id) ||
          hasTx({ type: 'expense', amount, date, descriptionNeedle: expense.description });

        if (!exists) monthExpenses += amount;
      });

      // Pagamentos de colaboradores
      // Pagamentos com is_paid=true já foram consolidados em uma transação total,
      // não devem ser contabilizados novamente para evitar débito duplo.
      collaboratorPayments.forEach((p) => {
        const amount = p.amount;
        const date = p.payment_date;
        if (!amount || amount <= 0) return;
        if (p.is_paid) return;

        const exists = hasReference('collab_payment', p.id) || hasReference(undefined, p.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      // Adiantamentos colaboradores
      collaboratorAdvances.forEach((a) => {
        const amount = a.amount;
        const date = a.advance_date;
        if (!amount || amount <= 0) return;

        const exists = hasReference('collaborator_vale', a.id) || hasReference('collab_advance', a.id) || hasReference(undefined, a.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      // Adiantamentos de despesas colaboradores
      collaboratorExpenseAdvances.forEach((a) => {
        const amount = a.amount;
        const date = a.advance_date;
        if (!amount || amount <= 0) return;

        const exists = hasReference('collab_expense_advance', a.id) || hasReference(undefined, a.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      // Alimentação colaboradores
      // Verifica se existe uma transação batch (food_allowance_batch) que já cobre esta alimentação
      const batchTransactions = transactions.filter((t: any) => t.reference_type === 'food_allowance_batch');
      
      foodAllowances.forEach((a) => {
        const amount = a.amount;
        const date = a.allowance_date;
        if (!amount || amount <= 0) return;

        // Check direct reference match first
        const directMatch = hasReference('food_allowance', a.id) || hasReference('food_allowance_batch', a.id) || hasReference(undefined, a.id) || hasTx({ type: 'expense', amount, date });
        if (directMatch) return;

        // Check if this allowance is covered by a batch transaction (batch only stores first allowance ID as reference)
        const collabName = ((a.collaborators as any)?.name || '').toLowerCase();
        const isCoveredByBatch = collabName && batchTransactions.some((bt: any) =>
          bt.description?.toLowerCase().includes(collabName) &&
          bt.description?.toLowerCase().includes('alimentação')
        );
        if (isCoveredByBatch) return;

        monthExpenses += amount;
      });

      // Diárias
      dailyRates.forEach((r) => {
        const amount = r.amount;
        const date = r.date;
        if (!amount || amount <= 0) return;

        const exists = hasReference('daily_rate', r.id) || hasReference(undefined, r.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      // Recorrentes (mensais)
      recurringPayments.forEach((p) => {
        const amount = p.payment_amount;
        const date = p.payment_date;
        if (!amount || amount <= 0) return;

        const exists = hasReference('recurring_payment', p.id) || hasReference(undefined, p.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      // Fixas da empresa (mensais)
      companyFixedPayments.forEach((p) => {
        const amount = p.payment_amount;
        const date = p.payment_date;
        if (!amount || amount <= 0) return;

        const exists = hasReference('company_fixed_payment', p.id) || hasReference(undefined, p.id) || hasTx({ type: 'expense', amount, date });
        if (!exists) monthExpenses += amount;
      });

      projections.push({
        month: monthDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        income: monthIncome,
        expenses: monthExpenses,
        netFlow: monthIncome - monthExpenses,
      });
    }

    return {
      type: 'cash-flow-projection',
      title: 'Projeção de Fluxo de Caixa',
      period: 'Próximos 6 meses',
      data: projections,
    };
  };

  // Generate Profitability Analysis
  const generateProfitabilityAnalysis = () => {
    const events = cashFlow.filter(
      entry =>
        entry.type === 'income' &&
        entry.status === 'confirmed' &&
        entry.category === 'Receita de Eventos'
    );

    const confirmedNonTransferExpenses = cashFlow.filter(
      entry =>
        entry.type === 'expense' &&
        entry.status === 'confirmed' &&
        !isTransferEntry(entry)
    );

    const totalEventRevenue = events.reduce((sum, event) => sum + event.amount, 0);
    const totalEventExpenses = confirmedNonTransferExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const profitMargin =
      totalEventRevenue > 0
        ? ((totalEventRevenue - totalEventExpenses) / totalEventRevenue) * 100
        : 0;

    // Analyze by category (exclui transferências entre contas)
    const categoryAnalysis = Object.entries(
      confirmedNonTransferExpenses.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + entry.amount;
        return acc;
      }, {} as Record<string, number>)
    ).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalEventExpenses > 0 ? (amount / totalEventExpenses) * 100 : 0,
    }));

    return {
      type: 'profitability-analysis',
      title: 'Análise de Lucratividade',
      period: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      data: {
        revenue: totalEventRevenue,
        expenses: totalEventExpenses,
        profit: totalEventRevenue - totalEventExpenses,
        profitMargin,
        categoryAnalysis,
      },
    };
  };

  // Render report content based on type
  const renderReportContent = () => {
    if (!reportData) return null;

    switch (reportData.type) {
      case 'income-statement':
        return (
          <div className="space-y-6">
            {/* Cabeçalho da DRE */}
            <div className="border-4 border-blue-600 p-6 rounded-lg bg-white">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-blue-900 mb-2">
                  DEMONSTRATIVO DE RESULTADOS DO EXERCÍCIO (DRE)
                </h3>
                <p className="text-gray-600">Formato Padrão Contábil</p>
                <div className="mt-4 text-sm text-gray-700">
                  <p className="font-semibold">{settings?.company_name || 'Empresa'}</p>
                  {settings?.cnpj && <p>CNPJ: {settings.cnpj}</p>}
                  <p className="mt-2">Período: {reportData.period}</p>
                  {reportData.data.regimeNome && (
                    <Badge className="mt-2 bg-blue-600">
                      Regime: {reportData.data.regimeNome}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabela DRE */}
              <div className="border border-gray-300 rounded">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50">
                      <TableHead className="font-bold text-black">Descrição</TableHead>
                      <TableHead className="text-right font-bold text-black">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* 1. Receita Bruta */}
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-bold">1. Receita Bruta de Vendas e Serviços</TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {formatCurrency(reportData.data.receitaBruta)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 2. Deduções com detalhamento por regime */}
                    <TableRow>
                      <TableCell className="pl-8 font-semibold">(-) Deduções e Impostos sobre Vendas</TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">
                        ({formatCurrency(reportData.data.deducoesImpostos)})
                      </TableCell>
                    </TableRow>
                    
                    {/* Detalhamento dos impostos por regime */}
                    {reportData.data.regimeTributario === 'simples' && (
                      <TableRow>
                        <TableCell className="pl-12 text-sm text-gray-600">
                          • Simples Nacional (alíquota efetiva: {(reportData.data.taxaImpostos * 100).toFixed(2)}%)
                        </TableCell>
                        <TableCell className="text-right text-sm text-red-500">
                          ({formatCurrency(reportData.data.detalhamentoImpostos.simplesTotal)})
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {reportData.data.regimeTributario === 'lucro_presumido' && (
                      <>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• ISS (5%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.ISS)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• PIS/COFINS (3,65%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                    
                    {reportData.data.regimeTributario === 'lucro_real' && (
                      <>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• ISS (5%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.ISS)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• PIS/COFINS não cumulativo (9,25%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                    
                    {reportData.data.regimeTributario === 'reforma_2026' && (
                      <>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-orange-600 font-medium">
                            • CBS - Contribuição sobre Bens e Serviços (0,9%)
                          </TableCell>
                          <TableCell className="text-right text-sm text-orange-600">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.CBS)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-orange-600 font-medium">
                            • IBS - Imposto sobre Bens e Serviços (0,1%)
                          </TableCell>
                          <TableCell className="text-right text-sm text-orange-600">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.IBS)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• ISS em transição (4%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.ISS)})
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="pl-12 text-sm text-gray-600">• PIS/COFINS em transição (2,9%)</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            ({formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                    
                    {/* 3. Receita Líquida */}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-600">
                      <TableCell className="font-bold">= Receita Líquida</TableCell>
                      <TableCell className="text-right font-bold text-blue-700">
                        {formatCurrency(reportData.data.receitaLiquida)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 4. Custos */}
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-bold">2. Custos dos Serviços Prestados / Produtos Vendidos (CSP/CMV)</TableCell>
                      <TableCell className="text-right font-bold text-red-600">
                        ({formatCurrency(reportData.data.custoServicos)})
                      </TableCell>
                    </TableRow>
                    
                    {/* 5. Lucro Bruto */}
                    <TableRow className="bg-green-50 border-t-2 border-green-600">
                      <TableCell className="font-bold">= Lucro Bruto</TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {formatCurrency(reportData.data.lucroBruto)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 6. Despesas Operacionais */}
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-bold">3. Despesas Operacionais</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="pl-8">• Despesas Administrativas</TableCell>
                      <TableCell className="text-right text-red-600">
                        ({formatCurrency(reportData.data.despesasOperacionais.administrativas)})
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="pl-8">• Despesas Comerciais</TableCell>
                      <TableCell className="text-right text-red-600">
                        ({formatCurrency(reportData.data.despesasOperacionais.comerciais)})
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="pl-8">• Despesas Financeiras</TableCell>
                      <TableCell className="text-right text-red-600">
                        ({formatCurrency(reportData.data.despesasOperacionais.financeiras)})
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell className="pl-8">(+) Receitas Financeiras</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(reportData.data.despesasOperacionais.receitasFinanceiras)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 7. Resultado Operacional */}
                    <TableRow className="bg-blue-50 border-t-2 border-blue-600">
                      <TableCell className="font-bold">= Resultado Operacional Antes do IR e CSLL</TableCell>
                      <TableCell className={`text-right font-bold ${reportData.data.resultadoOperacional >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        {formatCurrency(reportData.data.resultadoOperacional)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 8. Outras Receitas/Despesas */}
                    <TableRow className="bg-gray-50">
                      <TableCell className="font-bold">4. Outras Receitas / Despesas</TableCell>
                      <TableCell className={`text-right font-bold ${reportData.data.outrasReceitasDespesas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {reportData.data.outrasReceitasDespesas >= 0 ? formatCurrency(reportData.data.outrasReceitasDespesas) : `(${formatCurrency(Math.abs(reportData.data.outrasReceitasDespesas))})`}
                      </TableCell>
                    </TableRow>
                    
                    {/* 9. Resultado Antes IR */}
                    <TableRow className="bg-yellow-50 border-t-2 border-yellow-600">
                      <TableCell className="font-bold">= Resultado Antes do IR e CSLL</TableCell>
                      <TableCell className={`text-right font-bold ${reportData.data.resultadoAntesIR >= 0 ? 'text-yellow-700' : 'text-red-600'}`}>
                        {formatCurrency(reportData.data.resultadoAntesIR)}
                      </TableCell>
                    </TableRow>
                    
                    {/* 10. IR e CSLL - com detalhamento por regime */}
                    {reportData.data.regimeTributario !== 'simples' && (
                      <>
                        <TableRow>
                          <TableCell className="font-bold">(-) Imposto de Renda (IRPJ) e Contribuição Social (CSLL)</TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            ({formatCurrency(reportData.data.irCSLL)})
                          </TableCell>
                        </TableRow>
                        {reportData.data.detalhamentoIRCSLL && (
                          <>
                            <TableRow>
                              <TableCell className="pl-12 text-sm text-gray-600">
                                • IRPJ (15% sobre base {reportData.data.regimeTributario === 'lucro_real' ? 'real' : 'presumida 32%'})
                              </TableCell>
                              <TableCell className="text-right text-sm text-red-500">
                                ({formatCurrency(reportData.data.detalhamentoIRCSLL.IRPJ)})
                              </TableCell>
                            </TableRow>
                            {reportData.data.detalhamentoIRCSLL.IRPJ_adicional > 0 && (
                              <TableRow>
                                <TableCell className="pl-12 text-sm text-gray-600">• IRPJ Adicional (10% excedente R$ 20.000)</TableCell>
                                <TableCell className="text-right text-sm text-red-500">
                                  ({formatCurrency(reportData.data.detalhamentoIRCSLL.IRPJ_adicional)})
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow>
                              <TableCell className="pl-12 text-sm text-gray-600">
                                • CSLL (9% sobre base {reportData.data.regimeTributario === 'lucro_real' ? 'real' : 'presumida'})
                              </TableCell>
                              <TableCell className="text-right text-sm text-red-500">
                                ({formatCurrency(reportData.data.detalhamentoIRCSLL.CSLL)})
                              </TableCell>
                            </TableRow>
                          </>
                        )}
                      </>
                    )}
                    
                    {reportData.data.regimeTributario === 'simples' && (
                      <TableRow>
                        <TableCell className="pl-8 text-sm text-gray-600 italic">
                          * IR e CSLL já inclusos na alíquota única do Simples Nacional
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-500">-</TableCell>
                      </TableRow>
                    )}
                    
                    {/* 11. Lucro Líquido */}
                    <TableRow className="bg-green-100 border-t-4 border-green-700">
                      <TableCell className="font-bold text-lg">= LUCRO LÍQUIDO DO EXERCÍCIO</TableCell>
                      <TableCell className={`text-right font-bold text-lg ${reportData.data.lucroLiquido >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {formatCurrency(reportData.data.lucroLiquido)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Indicadores */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Margem Bruta</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {reportData.data.margemBruta.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Margem Líquida</div>
                    <div className="text-2xl font-bold text-green-700">
                      {reportData.data.margemLiquida.toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Eficiência Operacional</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {reportData.data.receitaLiquida > 0 ? ((reportData.data.resultadoOperacional / reportData.data.receitaLiquida) * 100).toFixed(1) : 0}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-600">Carga Tributária Efetiva</div>
                    <div className="text-2xl font-bold text-orange-700">
                      {reportData.data.receitaBruta > 0 ? (((reportData.data.deducoesImpostos + reportData.data.irCSLL) / reportData.data.receitaBruta) * 100).toFixed(1) : 0}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Nota dinâmica por regime */}
              <div className="mt-6 p-4 bg-gray-50 border border-gray-300 rounded text-xs text-gray-600">
                <p className="font-semibold mb-2">Notas - Regime: {reportData.data.regimeNome}</p>
                
                {reportData.data.regimeTributario === 'simples' && (
                  <>
                    <p>• Simples Nacional: Alíquota única que inclui ISS, PIS, COFINS, IRPJ, CSLL e CPP</p>
                    <p>• Anexo III utilizado para serviços - alíquota varia de 6% a 33% conforme faturamento anual</p>
                    <p>• A alíquota efetiva considera as deduções progressivas por faixa de receita</p>
                  </>
                )}
                
                {reportData.data.regimeTributario === 'lucro_presumido' && (
                  <>
                    <p>• ISS: 5% sobre receita bruta de serviços</p>
                    <p>• PIS (0,65%) + COFINS (3%) = 3,65% cumulativo sobre receita bruta</p>
                    <p>• Base presumida de 32% sobre receita para cálculo de IRPJ (15%) e CSLL (9%)</p>
                    <p>• IRPJ adicional de 10% sobre base presumida excedente a R$ 20.000/mês</p>
                  </>
                )}
                
                {reportData.data.regimeTributario === 'lucro_real' && (
                  <>
                    <p>• ISS: 5% sobre receita bruta de serviços</p>
                    <p>• PIS (1,65%) + COFINS (7,6%) = 9,25% não cumulativo (permite créditos)</p>
                    <p>• IRPJ (15%) e CSLL (9%) calculados sobre o lucro real apurado</p>
                    <p>• IRPJ adicional de 10% sobre lucro real excedente a R$ 20.000/mês</p>
                  </>
                )}
                
                {reportData.data.regimeTributario === 'reforma_2026' && (
                  <>
                    <p className="text-orange-600 font-medium">⚠️ REFORMA TRIBUTÁRIA 2026 - FASE DE TESTE</p>
                    <p>• CBS (0,9%): Contribuição sobre Bens e Serviços - substitui gradualmente PIS/COFINS federal</p>
                    <p>• IBS (0,1%): Imposto sobre Bens e Serviços - substitui gradualmente ICMS e ISS</p>
                    <p>• ISS e PIS/COFINS ainda aplicados com redução gradual durante transição</p>
                    <p>• IRPJ e CSLL continuam inalterados na reforma</p>
                    <p>• Transição completa prevista para 2033</p>
                  </>
                )}
                
                <p className="mt-2">• Custos de Serviços incluem: Diárias, Equipamentos, Transporte e Alimentação</p>
                <p>• Despesas Administrativas incluem: Salários, Aluguel, Água, Luz, Internet, Telefone, Material de Escritório</p>
                <p>• Despesas Comerciais incluem: Marketing, Publicidade, Comissões</p>
                <p>• Despesas Financeiras incluem: Juros, Taxas Bancárias, IOF</p>
              </div>
            </div>
          </div>
        );

      case 'cash-flow-projection':
        return (
          <div className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Fluxo Líquido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.data.map((month: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{month.month}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(month.income)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(month.expenses)}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${month.netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(month.netFlow)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case 'profitability-analysis':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold mb-4">Resumo Financeiro</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Receita Total:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(reportData.data.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Despesas Totais:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(reportData.data.expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span>Lucro:</span>
                    <span className={`font-bold ${reportData.data.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(reportData.data.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Margem de Lucro:</span>
                    <span className="font-semibold">
                      {reportData.data.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-lg font-semibold mb-4">Distribuição de Despesas</h4>
                <div className="space-y-2">
                  {reportData.data.categoryAnalysis.map((item: any) => (
                    <div key={item.category} className="flex justify-between">
                      <span className="text-sm">{item.category}:</span>
                      <div className="text-right">
                        <span className="text-sm font-medium">{formatCurrency(item.amount)}</span>
                        <div className="text-xs text-muted-foreground">
                          {item.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'tax-report':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Receita Bruta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(reportData.data.totalIncome)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Dedutíveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(reportData.data.deductibleExpenses)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Base de Cálculo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(reportData.data.taxableIncome)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Imposto Estimado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(reportData.data.estimatedTax)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Taxa: {reportData.data.effectiveRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Detalhamento de Todas as Despesas */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Detalhamento de Todas as Despesas</h4>
              
              {Object.entries(reportData.data.expensesByCategory).map(([category, expenses]) => (
                <Card key={category} className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{category}</CardTitle>
                    <CardDescription>
                      Total: {formatCurrency((expenses as CashFlowEntry[]).reduce((sum: number, exp: CashFlowEntry) => sum + exp.amount, 0))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(expenses as CashFlowEntry[]).map((expense: CashFlowEntry) => (
                          <TableRow key={expense.id}>
                            <TableCell>
                              {expense.date.split('-').reverse().join('/')}
                            </TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell>{expense.account}</TableCell>
                            <TableCell className="text-right text-red-600">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
              
              {reportData.data.allExpenses.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma despesa encontrada no período.
                </div>
              )}
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Aviso:</strong> Este é um cálculo estimativo. Consulte um contador para 
                informações fiscais precisas e atualizadas.
              </p>
            </div>
          </div>
        );

      case 'deductible-expenses':
        return (
          <div className="space-y-6">
            {/* Resumo das Despesas Dedutíveis */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Dedutível</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData.data.totalDeductible)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {reportData.data.deductiblePercentage.toFixed(1)}% do total
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Não Dedutível</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(reportData.data.totalNonDeductible)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(100 - reportData.data.deductiblePercentage).toFixed(1)}% do total
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total de Despesas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(reportData.data.totalExpenses)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Economia Fiscal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(reportData.data.totalDeductible * 0.15)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Est. 15% de redução
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Resumo por Categoria */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo por Categoria Dedutível</CardTitle>
                <CardDescription>Despesas organizadas por categoria fiscal</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">% do Dedutível</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.data.categoryTotals.map((category: any) => (
                      <TableRow key={category.category}>
                        <TableCell className="font-medium">{category.category}</TableCell>
                        <TableCell className="text-right">{category.count}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(category.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {((category.total / reportData.data.totalDeductible) * 100).toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detalhamento por Categoria */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">Detalhamento de Despesas Dedutíveis</h4>
              
              {Object.entries(reportData.data.deductibleByCategory).map(([category, expenses]) => (
                <Card key={category} className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-green-700">{category}</CardTitle>
                    <CardDescription>
                      {(expenses as CashFlowEntry[]).length} lançamentos - Total: {formatCurrency((expenses as CashFlowEntry[]).reduce((sum: number, exp: CashFlowEntry) => sum + exp.amount, 0))}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Conta</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(expenses as CashFlowEntry[]).map((expense: CashFlowEntry) => (
                          <TableRow key={expense.id}>
                            <TableCell>
                              {expense.date.split('-').reverse().join('/')}
                            </TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell>{expense.account}</TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Despesas Não Dedutíveis */}
            {reportData.data.nonDeductibleExpenses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-700">Despesas Não Dedutíveis</CardTitle>
                  <CardDescription>
                    {reportData.data.nonDeductibleExpenses.length} lançamentos - Total: {formatCurrency(reportData.data.totalNonDeductible)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.data.nonDeductibleExpenses.slice(0, 10).map((expense: any) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            {expense.date.split('-').reverse().join('/')}
                          </TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell>{expense.account}</TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {reportData.data.nonDeductibleExpenses.length > 10 && (
                    <p className="text-sm text-muted-foreground mt-2">
                      E mais {reportData.data.nonDeductibleExpenses.length - 10} despesas...
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Observações Legais */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 className="font-semibold text-blue-800 mb-2">Categorias Consideradas Dedutíveis:</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-blue-700">
                {reportData.data.deductibleCategories.map((category: string) => (
                  <div key={category} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    {category}
                  </div>
                ))}
              </div>
              <p className="text-sm text-blue-800 mt-3">
                <strong>Importante:</strong> Esta classificação é baseada na legislação geral. 
                Consulte sempre um contador qualificado para orientações específicas do seu caso.
              </p>
            </div>
          </div>
        );

      default:
        return <div>Tipo de relatório não reconhecido.</div>;
    }
  };

  // Generate Deductible Expenses Report
  const generateDeductibleExpensesReport = () => {
    const currentMonth = new Date();
    const startOfYear = new Date(currentMonth.getFullYear(), 0, 1);
    const endOfYear = new Date(currentMonth.getFullYear(), 11, 31);
    
    // Categorias dedutíveis segundo a legislação brasileira
    const deductibleCategories = [
      'Equipamentos',
      'Despesas Operacionais', 
      'Marketing',
      'Transporte',
      'Pessoal',
      'Alimentação', // Para viagens de negócios
      'Manutenção',
      'Combustível',
      'Telefone',
      'Internet',
      'Material de Escritório',
      'Seguros',
      'Depreciação'
    ];
    
    const yearTransactions = cashFlow.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startOfYear && 
             entryDate <= endOfYear && 
             entry.status === 'confirmed' &&
             entry.type === 'expense' &&
             !isTransferEntry(entry);
    });
    
    // Separar despesas dedutíveis e não dedutíveis
    const deductibleExpenses = yearTransactions.filter(expense => 
      deductibleCategories.includes(expense.category)
    );
    
    const nonDeductibleExpenses = yearTransactions.filter(expense => 
      !deductibleCategories.includes(expense.category)
    );
    
    // Agrupar despesas dedutíveis por categoria
    const deductibleByCategory = deductibleExpenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = [];
      }
      acc[expense.category].push(expense);
      return acc;
    }, {} as Record<string, CashFlowEntry[]>);
    
    // Calcular totais por categoria
    const categoryTotals = Object.entries(deductibleByCategory).map(([category, expenses]) => ({
      category,
      total: expenses.reduce((sum, exp) => sum + exp.amount, 0),
      count: expenses.length,
      expenses
    })).sort((a, b) => b.total - a.total);
    
    const totalDeductible = deductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalNonDeductible = nonDeductibleExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpenses = totalDeductible + totalNonDeductible;
    
    return {
      type: 'deductible-expenses',
      title: 'Relatório de Despesas Dedutíveis',
      period: `Ano ${currentMonth.getFullYear()}`,
      data: {
        totalDeductible,
        totalNonDeductible,
        totalExpenses,
        deductiblePercentage: totalExpenses > 0 ? (totalDeductible / totalExpenses) * 100 : 0,
        categoryTotals,
        deductibleByCategory,
        nonDeductibleExpenses,
        deductibleCategories
      }
    };
  };

  // Generate Tax Report
  const generateTaxReport = () => {
    const currentMonth = new Date();
    const startOfYear = new Date(currentMonth.getFullYear(), 0, 1);
    const endOfYear = new Date(currentMonth.getFullYear(), 11, 31);
    
    const yearTransactions = cashFlow.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startOfYear && entryDate <= endOfYear && entry.status === 'confirmed';
    });
    
    const totalIncome = yearTransactions
      .filter(entry => entry.type === 'income' && !isTransferEntry(entry))
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const allExpenses = yearTransactions
      .filter(entry => entry.type === 'expense' && !isTransferEntry(entry))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const deductibleExpenses = yearTransactions
      .filter(entry => entry.type === 'expense' && 
        !isTransferEntry(entry) &&
        ['Equipamentos', 'Despesas Operacionais', 'Marketing', 'Transporte'].includes(entry.category))
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const taxableIncome = totalIncome - deductibleExpenses;
    const estimatedTax = taxableIncome * 0.15; // Simplified 15% tax rate
    
    // Agrupar despesas por categoria
    const expensesByCategory = allExpenses.reduce((acc, expense) => {
      if (!acc[expense.category]) {
        acc[expense.category] = [];
      }
      acc[expense.category].push(expense);
      return acc;
    }, {} as Record<string, any[]>);
    
    return {
      type: 'tax-report',
      title: 'Relatório Fiscal Detalhado',
      period: `Ano ${currentMonth.getFullYear()}`,
      data: {
        totalIncome,
        deductibleExpenses,
        taxableIncome,
        estimatedTax,
        effectiveRate: totalIncome > 0 ? (estimatedTax / totalIncome) * 100 : 0,
        allExpenses,
        expensesByCategory
      }
    };
  };

  // Download report as PDF/Excel
  const downloadReport = (format: 'pdf' | 'excel') => {
    console.log('Download initiated:', format, 'reportData:', reportData);
    if (!reportData) {
      console.log('No report data available');
      return;
    }
    
    // Calcular dados do resumo baseado no tipo de relatório
    let summaryData = {
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      profitMargin: 0
    };

    if (reportData.type === 'income-statement') {
      summaryData = {
        totalIncome: reportData.data?.revenue?.total || 0,
        totalExpenses: reportData.data?.expenses?.total || 0,
        netProfit: reportData.data?.netIncome || 0,
        profitMargin: reportData.data?.netMargin || 0
      };
    } else if (reportData.summary) {
      summaryData = reportData.summary;
    } else {
      // Fallback para outros tipos de relatório
      summaryData = {
        totalIncome: getTotalIncome,
        totalExpenses: getTotalExpenses,
        netProfit: getTotalIncome - getTotalExpenses,
        profitMargin: getTotalIncome > 0 ? ((getTotalIncome - getTotalExpenses) / getTotalIncome) * 100 : 0
      };
    }
    
    if (format === 'excel') {
      // Criar workbook do Excel
      const wb = XLSX.utils.book_new();
      
      // Dados do resumo
      const excelData = [
        ['RELATÓRIO FINANCEIRO'],
        ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
        [''],
        ['RESUMO GERAL'],
        ['Total de Receitas:', `R$ ${summaryData.totalIncome.toFixed(2).replace('.', ',')}`],
        ['Total de Despesas:', `R$ ${summaryData.totalExpenses.toFixed(2).replace('.', ',')}`],
        ['Lucro Líquido:', `R$ ${summaryData.netProfit.toFixed(2).replace('.', ',')}`],
        ['Margem de Lucro:', `${summaryData.profitMargin.toFixed(1)}%`],
        ['']
      ];

      // Adicionar receitas por categoria se disponível
      if (reportData.incomeByCategory && Object.keys(reportData.incomeByCategory).length > 0) {
        excelData.push(['RECEITAS POR CATEGORIA']);
        Object.entries(reportData.incomeByCategory).forEach(([category, amount]) => {
          excelData.push([category, `R$ ${Number(amount).toFixed(2).replace('.', ',')}`]);
        });
        excelData.push(['']);
      }

      // Adicionar despesas por categoria se disponível
      if (reportData.expensesByCategory && Object.keys(reportData.expensesByCategory).length > 0) {
        excelData.push(['DESPESAS POR CATEGORIA']);
        Object.entries(reportData.expensesByCategory).forEach(([category, amount]) => {
          excelData.push([category, `R$ ${Number(amount).toFixed(2).replace('.', ',')}`]);
        });
      } else if (reportData.data?.expenses?.byCategory) {
        excelData.push(['DESPESAS POR CATEGORIA']);
        Object.entries(reportData.data.expenses.byCategory).forEach(([category, amount]) => {
          excelData.push([category, `R$ ${Number(amount).toFixed(2).replace('.', ',')}`]);
        });
      }

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      
      // Download do arquivo
      XLSX.writeFile(wb, `relatorio_financeiro_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast({
        title: "Excel baixado",
        description: "Relatório baixado em formato Excel com sucesso!",
      });
    } else if (format === 'pdf') {
      // Criar PDF
      const doc = new jsPDF({
        compress: true
      });
      
      // Título
      doc.setFontSize(20);
      doc.text('RELATÓRIO FINANCEIRO', 20, 30);
      
      // Data
      doc.setFontSize(12);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')}`, 20, 45);
      
      // Linha separadora
      doc.line(20, 50, 190, 50);
      
      let y = 70;
      
      // Resumo geral
      doc.setFontSize(16);
      doc.text('RESUMO GERAL', 20, y);
      y += 15;
      
      doc.setFontSize(12);
      doc.text(`Total de Receitas: R$ ${Number(summaryData.totalIncome).toFixed(2).replace('.', ',')}`, 20, y);
      y += 10;
      doc.text(`Total de Despesas: R$ ${Number(summaryData.totalExpenses).toFixed(2).replace('.', ',')}`, 20, y);
      y += 10;
      doc.text(`Lucro Líquido: R$ ${Number(summaryData.netProfit).toFixed(2).replace('.', ',')}`, 20, y);
      y += 10;
      doc.text(`Margem de Lucro: ${Number(summaryData.profitMargin).toFixed(1)}%`, 20, y);
      y += 20;

      // Receitas por categoria
      if (reportData.incomeByCategory && Object.keys(reportData.incomeByCategory).length > 0) {
        doc.setFontSize(14);
        doc.text('RECEITAS POR CATEGORIA', 20, y);
        y += 15;
        
        doc.setFontSize(10);
        Object.entries(reportData.incomeByCategory).forEach(([category, amount]) => {
          doc.text(`${category}: R$ ${Number(amount).toFixed(2).replace('.', ',')}`, 25, y);
          y += 8;
        });
        y += 10;
      }

      // Despesas por categoria
      if (reportData.expensesByCategory && Object.keys(reportData.expensesByCategory).length > 0) {
        doc.setFontSize(14);
        doc.text('DESPESAS POR CATEGORIA', 20, y);
        y += 15;
        
        doc.setFontSize(10);
        Object.entries(reportData.expensesByCategory).forEach(([category, amount]) => {
          if (y > 270) { // Nova página se necessário
            doc.addPage();
            y = 30;
          }
          doc.text(`${category}: R$ ${Number(amount).toFixed(2).replace('.', ',')}`, 25, y);
          y += 8;
        });
      }
      
      // Download do PDF
      doc.save(`relatorio_financeiro_${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF baixado",
        description: "Relatório baixado em formato PDF com sucesso!",
      });
    }
  };

  // Funções de exportação para planilhas individuais
  const exportCashFlowToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const data = [
      ['FLUXO DE CAIXA'],
      ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
      [''],
      ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Conta', 'Status'],
      ...cashFlow.map(entry => [
        entry.date,
        entry.description,
        entry.category,
        entry.type === 'income' ? 'Receita' : 'Despesa',
        `R$ ${entry.amount.toFixed(2).replace('.', ',')}`,
        entry.account,
        entry.status === 'confirmed' ? 'Confirmado' : entry.status === 'pending' ? 'Pendente' : 'Cancelado'
      ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa');
    XLSX.writeFile(wb, `fluxo_caixa_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Excel baixado",
      description: "Fluxo de caixa exportado com sucesso!",
    });
  };

  const exportCashFlowToPDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('FLUXO DE CAIXA', 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, yPos + 8);
    yPos += 25;
    
    const tableData = cashFlow.map(entry => [
      entry.date,
      entry.description.substring(0, 20),
      entry.category,
      entry.type === 'income' ? 'Receita' : 'Despesa',
      `R$ ${entry.amount.toFixed(2).replace('.', ',')}`,
      entry.status
    ]);
    
    // Verificar se existem dados
    if (tableData.length === 0) {
      doc.text('Nenhum dado encontrado para o período selecionado.', 15, yPos);
    } else {
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status']],
        body: tableData,
        startY: yPos,
        theme: 'grid',
        styles: { fontSize: 8 }
      });
    }
    
    addFooter(doc);
    doc.save(`fluxo_caixa_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Fluxo de caixa exportado com sucesso!",
    });
  };

  const exportBudgetToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    const data = [
      ['CONTROLE ORÇAMENTÁRIO'],
      ['Data de Geração:', new Date().toLocaleDateString('pt-BR')],
      [''],
      ['Categoria', 'Orçado', 'Realizado', 'Restante', 'Percentual'],
      ...budget.map(item => [
        item.category,
        `R$ ${item.budgeted.toFixed(2).replace('.', ',')}`,
        `R$ ${item.spent.toFixed(2).replace('.', ',')}`,
        `R$ ${item.remaining.toFixed(2).replace('.', ',')}`,
        `${item.percentage.toFixed(1)}%`
      ])
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento');
    XLSX.writeFile(wb, `orcamento_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Excel baixado",
      description: "Orçamento exportado com sucesso!",
    });
  };

  const exportBudgetToPDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTROLE ORÇAMENTÁRIO', 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, yPos + 8);
    yPos += 25;
    
    const tableData = budget.map(item => [
      item.category,
      `R$ ${item.budgeted.toFixed(2).replace('.', ',')}`,
      `R$ ${item.spent.toFixed(2).replace('.', ',')}`,
      `R$ ${item.remaining.toFixed(2).replace('.', ',')}`,
      `${item.percentage.toFixed(1)}%`
    ]);
    
    autoTable(doc, {
      head: [['Categoria', 'Orçado', 'Realizado', 'Restante', 'Percentual']],
      body: tableData,
      startY: yPos,
      theme: 'grid',
      styles: { fontSize: 10 }
    });
    
    addFooter(doc);
    doc.save(`orcamento_${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Orçamento exportado com sucesso!",
    });
  };



  // PDF generation functions for each report type with letterhead
  const addLetterhead = (doc: jsPDF) => {
    // Cabeçalho com logo e informações da empresa
    if (logoUrl) {
      doc.addImage(logoUrl, 'PNG', 15, 15, 40, 40);
    }
    
    // Informações da empresa usando dados dinâmicos das configurações
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.company_name || 'GESTAO LINE TAPE', logoUrl ? 65 : 15, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(settings?.tagline || 'Controle de Estoque', logoUrl ? 65 : 15, 35);
    
    let yPosition = 42;
    if (settings?.address) {
      doc.text(settings.address, logoUrl ? 65 : 15, yPosition);
      yPosition += 7;
    }
    if (settings?.phone) {
      doc.text(`Tel: ${settings.phone}`, logoUrl ? 65 : 15, yPosition);
      yPosition += 7;
    }
    if (settings?.email) {
      doc.text(`Email: ${settings.email}`, logoUrl ? 65 : 15, yPosition);
      yPosition += 7;
    }
    if (settings?.website) {
      doc.text(`Site: ${settings.website}`, logoUrl ? 65 : 15, yPosition);
      yPosition += 7;
    }
    
    // Linha separadora
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, yPosition + 5, 195, yPosition + 5);
    
    return yPosition + 15; // Retorna a posição Y após o cabeçalho
  };

  const addFooter = (doc: jsPDF) => {
    const pageHeight = doc.internal.pageSize.height;
    
    // Linha separadora do rodapé
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(15, pageHeight - 25, 195, pageHeight - 25);
    
    // Informações do rodapé usando dados dinâmicos das configurações
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(settings?.company_name || 'GESTAO LINE TAPE', 15, pageHeight - 18);
    
    if (settings?.cnpj) {
      doc.text(`CNPJ: ${settings.cnpj}`, 15, pageHeight - 12);
    }
    
    // Data de geração
    const currentDate = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Gerado em: ${currentDate}`, 130, pageHeight - 15);
  };

  const generateIncomeStatementPDF = () => {
    if (!reportData || reportData.type !== 'income-statement') return;

    const doc = new jsPDF({
      compress: true,
      orientation: 'portrait'
    });
    
    let yPos = addLetterhead(doc);

    // Título principal
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('DEMONSTRATIVO DE RESULTADOS DO EXERCÍCIO (DRE)', 105, yPos, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Formato Padrão Contábil', 105, yPos + 7, { align: 'center' });
    
    yPos += 15;
    
    // Informações da empresa e regime
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(settings?.company_name || 'Empresa', 105, yPos, { align: 'center' });
    yPos += 5;
    
    if (settings?.cnpj) {
      doc.setFont('helvetica', 'normal');
      doc.text(`CNPJ: ${settings.cnpj}`, 105, yPos, { align: 'center' });
      yPos += 5;
    }
    
    doc.text(`Período: ${reportData.period}`, 105, yPos, { align: 'center' });
    yPos += 5;
    
    // Badge do regime tributário
    if (reportData.data.regimeNome) {
      doc.setFont('helvetica', 'bold');
      if (reportData.data.regimeTributario === 'reforma_2026') {
        doc.setTextColor(234, 88, 12); // orange
      } else {
        doc.setTextColor(37, 99, 235); // blue
      }
      doc.text(`Regime: ${reportData.data.regimeNome}`, 105, yPos, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
    yPos += 15;

    // Construir tabela DRE dinamicamente baseada no regime
    const tableData: any[] = [
      // 1. Receita Bruta
      [
        { content: '1. Receita Bruta de Vendas e Serviços', styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
        { content: formatCurrency(reportData.data.receitaBruta), styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240], halign: 'right' as const, textColor: [34, 139, 34] } }
      ],
      
      // 2. Deduções
      [
        { content: '  (-) Deduções e Impostos sobre Vendas', styles: { textColor: [100, 100, 100] } },
        { content: `(${formatCurrency(reportData.data.deducoesImpostos)})`, styles: { halign: 'right' as const, textColor: [220, 20, 60] } }
      ],
    ];
    
    // Detalhamento de impostos por regime
    if (reportData.data.regimeTributario === 'simples') {
      tableData.push([
        { content: `      • Simples Nacional (${(reportData.data.taxaImpostos * 100).toFixed(2)}% efetivo)`, styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.simplesTotal)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
    } else if (reportData.data.regimeTributario === 'lucro_presumido') {
      tableData.push([
        { content: '      • ISS (5%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.ISS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
      tableData.push([
        { content: '      • PIS/COFINS (3,65%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
    } else if (reportData.data.regimeTributario === 'lucro_real') {
      tableData.push([
        { content: '      • ISS (5%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.ISS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
      tableData.push([
        { content: '      • PIS/COFINS não cumulativo (9,25%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
    } else if (reportData.data.regimeTributario === 'reforma_2026') {
      tableData.push([
        { content: '      • CBS - Contribuição sobre Bens e Serviços (0,9%)', styles: { fontSize: 9, textColor: [234, 88, 12] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.CBS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [234, 88, 12] } }
      ]);
      tableData.push([
        { content: '      • IBS - Imposto sobre Bens e Serviços (0,1%)', styles: { fontSize: 9, textColor: [234, 88, 12] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.IBS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [234, 88, 12] } }
      ]);
      tableData.push([
        { content: '      • ISS em transição (4%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.ISS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
      tableData.push([
        { content: '      • PIS/COFINS em transição (2,9%)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: `(${formatCurrency(reportData.data.detalhamentoImpostos.PIS_COFINS)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
      ]);
    }
    
    // Restante da tabela DRE
    tableData.push(
      // 3. Receita Líquida
      [
        { content: '= RECEITA LÍQUIDA', styles: { fontStyle: 'bold' as const, fillColor: [220, 237, 255] } },
        { content: formatCurrency(reportData.data.receitaLiquida), styles: { fontStyle: 'bold' as const, fillColor: [220, 237, 255], halign: 'right' as const, textColor: [0, 102, 204] } }
      ],
      
      // 4. Custos
      [
        { content: '2. Custos dos Serviços Prestados / Produtos Vendidos (CSP/CMV)', styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
        { content: `(${formatCurrency(reportData.data.custoServicos)})`, styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240], halign: 'right' as const, textColor: [220, 20, 60] } }
      ],
      [
        { content: '  • Diárias, Equipamentos, Transporte, Alimentação', styles: { fontSize: 9, textColor: [130, 130, 130] } },
        { content: '', styles: { halign: 'right' as const } }
      ],
      
      // 5. Lucro Bruto
      [
        { content: '= LUCRO BRUTO', styles: { fontStyle: 'bold' as const, fillColor: [220, 255, 220] } },
        { content: formatCurrency(reportData.data.lucroBruto), styles: { fontStyle: 'bold' as const, fillColor: [220, 255, 220], halign: 'right' as const, textColor: [34, 139, 34] } }
      ],
      
      // 6. Despesas Operacionais
      [
        { content: '3. Despesas Operacionais', styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
        { content: '', styles: { fillColor: [240, 240, 240] } }
      ],
      [
        { content: '  • Despesas Administrativas', styles: { textColor: [100, 100, 100] } },
        { content: `(${formatCurrency(reportData.data.despesasOperacionais.administrativas)})`, styles: { halign: 'right' as const, textColor: [220, 20, 60] } }
      ],
      [
        { content: '  • Despesas Comerciais', styles: { textColor: [100, 100, 100] } },
        { content: `(${formatCurrency(reportData.data.despesasOperacionais.comerciais)})`, styles: { halign: 'right' as const, textColor: [220, 20, 60] } }
      ],
      [
        { content: '  • Despesas Financeiras', styles: { textColor: [100, 100, 100] } },
        { content: `(${formatCurrency(reportData.data.despesasOperacionais.financeiras)})`, styles: { halign: 'right' as const, textColor: [220, 20, 60] } }
      ],
      [
        { content: '  (+) Receitas Financeiras', styles: { textColor: [100, 100, 100] } },
        { content: formatCurrency(reportData.data.despesasOperacionais.receitasFinanceiras), styles: { halign: 'right' as const, textColor: [34, 139, 34] } }
      ],
      
      // 7. Resultado Operacional
      [
        { content: '= RESULTADO OPERACIONAL ANTES DO IR E CSLL', styles: { fontStyle: 'bold' as const, fillColor: [220, 237, 255] } },
        { content: formatCurrency(reportData.data.resultadoOperacional), styles: { fontStyle: 'bold' as const, fillColor: [220, 237, 255], halign: 'right' as const, textColor: reportData.data.resultadoOperacional >= 0 ? [0, 102, 204] : [220, 20, 60] } }
      ],
      
      // 8. Outras Receitas/Despesas
      [
        { content: '4. Outras Receitas / Despesas', styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240] } },
        { content: reportData.data.outrasReceitasDespesas >= 0 ? formatCurrency(reportData.data.outrasReceitasDespesas) : `(${formatCurrency(Math.abs(reportData.data.outrasReceitasDespesas))})`, styles: { fontStyle: 'bold' as const, fillColor: [240, 240, 240], halign: 'right' as const, textColor: reportData.data.outrasReceitasDespesas >= 0 ? [34, 139, 34] : [220, 20, 60] } }
      ],
      
      // 9. Resultado Antes IR
      [
        { content: '= RESULTADO ANTES DO IR E CSLL', styles: { fontStyle: 'bold' as const, fillColor: [255, 248, 220] } },
        { content: formatCurrency(reportData.data.resultadoAntesIR), styles: { fontStyle: 'bold' as const, fillColor: [255, 248, 220], halign: 'right' as const, textColor: reportData.data.resultadoAntesIR >= 0 ? [184, 134, 11] : [220, 20, 60] } }
      ],
    );
    
    // 10. IR e CSLL - detalhamento por regime
    if (reportData.data.regimeTributario !== 'simples') {
      tableData.push([
        { content: '(-) Imposto de Renda (IRPJ) e Contribuição Social (CSLL)', styles: { fontStyle: 'bold' as const } },
        { content: `(${formatCurrency(reportData.data.irCSLL)})`, styles: { fontStyle: 'bold' as const, halign: 'right' as const, textColor: [220, 20, 60] } }
      ]);
      
      if (reportData.data.detalhamentoIRCSLL) {
        const baseLabel = reportData.data.regimeTributario === 'lucro_real' ? 'real' : 'presumida 32%';
        tableData.push([
          { content: `      • IRPJ 15% (base ${baseLabel})`, styles: { fontSize: 9, textColor: [130, 130, 130] } },
          { content: `(${formatCurrency(reportData.data.detalhamentoIRCSLL.IRPJ)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
        ]);
        
        if (reportData.data.detalhamentoIRCSLL.IRPJ_adicional > 0) {
          tableData.push([
            { content: '      • IRPJ Adicional 10% (excedente R$ 20.000)', styles: { fontSize: 9, textColor: [130, 130, 130] } },
            { content: `(${formatCurrency(reportData.data.detalhamentoIRCSLL.IRPJ_adicional)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
          ]);
        }
        
        tableData.push([
          { content: `      • CSLL 9% (base ${baseLabel})`, styles: { fontSize: 9, textColor: [130, 130, 130] } },
          { content: `(${formatCurrency(reportData.data.detalhamentoIRCSLL.CSLL)})`, styles: { fontSize: 9, halign: 'right' as const, textColor: [130, 130, 130] } }
        ]);
      }
    } else {
      tableData.push([
        { content: '* IR e CSLL já inclusos na alíquota única do Simples Nacional', styles: { fontSize: 9, fontStyle: 'italic' as const, textColor: [100, 100, 100] } },
        { content: '-', styles: { halign: 'right' as const, textColor: [100, 100, 100] } }
      ]);
    }
    
    // 11. Lucro Líquido
    tableData.push([
      { content: '= LUCRO LÍQUIDO DO EXERCÍCIO', styles: { fontStyle: 'bold' as const, fontSize: 12, fillColor: [220, 255, 220] } },
      { content: formatCurrency(reportData.data.lucroLiquido), styles: { fontStyle: 'bold' as const, fontSize: 12, fillColor: [220, 255, 220], halign: 'right' as const, textColor: reportData.data.lucroLiquido >= 0 ? [34, 139, 34] : [220, 20, 60] } }
    ]);

    autoTable(doc, {
      body: tableData,
      startY: yPos,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 60 }
      },
      margin: { left: 15, right: 15 }
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Indicadores de Performance
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('INDICADORES DE PERFORMANCE', 15, yPos);
    yPos += 10;

    const cargaTributariaEfetiva = reportData.data.receitaBruta > 0 
      ? ((reportData.data.deducoesImpostos + reportData.data.irCSLL) / reportData.data.receitaBruta * 100).toFixed(2) 
      : '0.00';

    const indicadores = [
      ['Margem Bruta', `${reportData.data.margemBruta.toFixed(2)}%`, 'Lucro Bruto / Receita Líquida'],
      ['Margem Líquida', `${reportData.data.margemLiquida.toFixed(2)}%`, 'Lucro Líquido / Receita Bruta'],
      ['Carga Tributária Efetiva', `${cargaTributariaEfetiva}%`, '(Impostos + IR/CSLL) / Receita Bruta'],
      ['Eficiência Operacional', `${reportData.data.receitaBruta > 0 ? (reportData.data.despesasOperacionais.total / reportData.data.receitaBruta * 100).toFixed(2) : '0.00'}%`, 'Despesas Operacionais / Receita Bruta']
    ];

    autoTable(doc, {
      head: [['Indicador', 'Valor', 'Cálculo']],
      body: indicadores,
      startY: yPos,
      theme: 'striped',
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [0, 102, 204],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      margin: { left: 15, right: 15 }
    });

    // Notas explicativas dinâmicas por regime
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`NOTAS EXPLICATIVAS - ${reportData.data.regimeNome}:`, 15, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    let notas: string[] = [];
    
    if (reportData.data.regimeTributario === 'simples') {
      notas = [
        '1. Simples Nacional: Alíquota única que inclui ISS, PIS, COFINS, IRPJ, CSLL e CPP.',
        '2. Anexo III utilizado para serviços - alíquota varia de 6% a 33% conforme faturamento anual.',
        '3. A alíquota efetiva considera as deduções progressivas por faixa de receita.',
      ];
    } else if (reportData.data.regimeTributario === 'lucro_presumido') {
      notas = [
        '1. ISS: 5% sobre receita bruta de serviços.',
        '2. PIS (0,65%) + COFINS (3%) = 3,65% cumulativo sobre receita bruta.',
        '3. Base presumida de 32% sobre receita para cálculo de IRPJ (15%) e CSLL (9%).',
        '4. IRPJ adicional de 10% sobre base presumida excedente a R$ 20.000/mês.',
      ];
    } else if (reportData.data.regimeTributario === 'lucro_real') {
      notas = [
        '1. ISS: 5% sobre receita bruta de serviços.',
        '2. PIS (1,65%) + COFINS (7,6%) = 9,25% não cumulativo (permite créditos).',
        '3. IRPJ (15%) e CSLL (9%) calculados sobre o lucro real apurado.',
        '4. IRPJ adicional de 10% sobre lucro real excedente a R$ 20.000/mês.',
      ];
    } else if (reportData.data.regimeTributario === 'reforma_2026') {
      notas = [
        '⚠️ REFORMA TRIBUTÁRIA 2026 - FASE DE TESTE',
        '1. CBS (0,9%): Contribuição sobre Bens e Serviços - substitui gradualmente PIS/COFINS federal.',
        '2. IBS (0,1%): Imposto sobre Bens e Serviços - substitui gradualmente ICMS e ISS.',
        '3. ISS e PIS/COFINS ainda aplicados com redução gradual durante transição.',
        '4. IRPJ e CSLL continuam inalterados na reforma.',
        '5. Transição completa prevista para 2033.',
      ];
    }
    
    notas.push('Demonstrativo elaborado conforme princípios contábeis geralmente aceitos.');
    notas.push('Os valores apresentados referem-se ao regime de competência.');
    
    notas.forEach(nota => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const splitText = doc.splitTextToSize(nota, 180);
      doc.text(splitText, 15, yPos);
      yPos += splitText.length * 5;
    });

    // Adicionar rodapé
    addFooter(doc);

    doc.save(`demonstrativo-resultados-${reportData.data.regimeTributario}-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: `Demonstrativo de Resultados (${reportData.data.regimeNome}) exportado com sucesso!`,
    });
  };

  const generateCashFlowProjectionPDF = () => {
    if (!reportData || reportData.type !== 'cash-flow-projection') return;

    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);

    // Título do documento
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title, 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${reportData.period}`, 15, yPos + 8);
    yPos += 25;

    // Projeção mensal
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Projeção de Fluxo de Caixa', 15, yPos);
    yPos += 15;

    reportData.data.forEach((month: any) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(month.month, 15, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Receitas: ${formatCurrency(month.income)}`, 20, yPos);
      yPos += 6;
      doc.text(`Despesas: ${formatCurrency(month.expenses)}`, 20, yPos);
      yPos += 6;
      doc.text(`Fluxo Líquido: ${formatCurrency(month.netFlow)}`, 20, yPos);
      yPos += 12;
    });

    // Adicionar rodapé
    addFooter(doc);

    doc.save(`projecao-fluxo-caixa-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Projeção de Fluxo de Caixa exportada com sucesso!",
    });
  };

  const generateProfitabilityAnalysisPDF = () => {
    if (!reportData || reportData.type !== 'profitability-analysis') return;

    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);

    // Título do documento
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title, 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${reportData.period}`, 15, yPos + 8);
    yPos += 25;

    // Análise de lucratividade
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Financeiro', 15, yPos);
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receita Total: ${formatCurrency(reportData.data.revenue)}`, 15, yPos);
    yPos += 8;
    doc.text(`Despesas Totais: ${formatCurrency(reportData.data.expenses)}`, 15, yPos);
    yPos += 8;
    doc.text(`Lucro: ${formatCurrency(reportData.data.profit)}`, 15, yPos);
    yPos += 8;
    doc.text(`Margem de Lucro: ${reportData.data.profitMargin.toFixed(1)}%`, 15, yPos);
    yPos += 20;

    // Análise por categoria
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Análise por Categoria', 15, yPos);
    yPos += 15;

    reportData.data.categoryAnalysis.forEach((category: any) => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(category.category, 15, yPos);
      yPos += 8;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Valor: ${formatCurrency(category.amount)}`, 20, yPos);
      yPos += 6;
      doc.text(`Percentual: ${category.percentage.toFixed(1)}%`, 20, yPos);
      yPos += 12;
    });

    // Adicionar rodapé
    addFooter(doc);

    doc.save(`analise-lucratividade-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Análise de Lucratividade exportada com sucesso!",
    });
  };

  const generateTaxReportPDF = () => {
    if (!reportData || reportData.type !== 'tax-report') return;

    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);

    // Título do documento
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title, 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${reportData.period}`, 15, yPos + 8);
    yPos += 25;

    // Informações fiscais
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Fiscal', 15, yPos);
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receita Bruta: ${formatCurrency(reportData.data.grossRevenue)}`, 15, yPos);
    yPos += 8;
    doc.text(`Despesas Dedutíveis: ${formatCurrency(reportData.data.deductibleExpenses)}`, 15, yPos);
    yPos += 8;
    doc.text(`Base de Cálculo: ${formatCurrency(reportData.data.taxableIncome)}`, 15, yPos);
    yPos += 8;
    doc.text(`Impostos Estimados: ${formatCurrency(reportData.data.estimatedTaxes)}`, 15, yPos);
    yPos += 20;

    // Tributos por regime
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Tributos por Regime', 15, yPos);
    yPos += 15;

    if (reportData.data.taxRegimes && typeof reportData.data.taxRegimes === 'object') {
      Object.entries(reportData.data.taxRegimes).forEach(([regime, data]: [string, any]) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(regime.toUpperCase(), 15, yPos);
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Alíquota: ${data?.rate || 0}%`, 20, yPos);
        yPos += 6;
        doc.text(`Valor: ${formatCurrency(data?.amount || 0)}`, 20, yPos);
        yPos += 12;
      });
    } else {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Nenhum dado de regime tributário disponível.', 15, yPos);
      yPos += 15;
    }

    // Adicionar rodapé
    addFooter(doc);

    doc.save(`relatorio-fiscal-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Relatório Fiscal exportado com sucesso!",
    });
  };

  const generateDeductibleExpensesPDF = () => {
    if (!reportData || reportData.type !== 'deductible-expenses') return;

    const doc = new jsPDF({
      compress: true
    });
    let yPos = addLetterhead(doc);

    // Título do documento
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(reportData.title, 15, yPos);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${reportData.period}`, 15, yPos + 8);
    yPos += 25;

    // Resumo das despesas dedutíveis
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo das Despesas Dedutíveis', 15, yPos);
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Dedutível: ${formatCurrency(reportData.data.totalDeductible || 0)}`, 15, yPos);
    yPos += 8;
    doc.text(`Total Não Dedutível: ${formatCurrency(reportData.data.totalNonDeductible || 0)}`, 15, yPos);
    yPos += 8;
    doc.text(`Percentual Dedutível: ${(reportData.data.deductiblePercentage || 0).toFixed(1)}%`, 15, yPos);
    yPos += 20;

    // Despesas por categoria
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas por Categoria', 15, yPos);
    yPos += 15;

    if (reportData.data.categoryTotals && reportData.data.categoryTotals.length > 0) {
      reportData.data.categoryTotals.forEach((category: any) => {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(category.category, 15, yPos);
        yPos += 8;
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Valor: ${formatCurrency(category.total || 0)}`, 20, yPos);
        yPos += 6;
        doc.text(`Quantidade: ${category.count || 0} despesas`, 20, yPos);
        yPos += 12;
      });
    } else {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Nenhuma categoria de despesa encontrada.', 15, yPos);
      yPos += 15;
    }

    // Adicionar rodapé
    addFooter(doc);

    doc.save(`despesas-dedutiveis-${new Date().toISOString().split('T')[0]}.pdf`);
    
    toast({
      title: "PDF baixado",
      description: "Relatório de Despesas Dedutíveis exportado com sucesso!",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando dados financeiros...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Controle Financeiro</h2>
          <p className="text-muted-foreground">Planilhas e controles financeiros completos</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </div>

      {/* Filtro de Período */}
      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm font-medium">Ano:</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => {
            setSelectedYear(parseInt(value));
            if (selectedPeriod !== "week" && selectedPeriod !== "quarter" && selectedPeriod !== "year") {
              setSelectedPeriod("custom");
            }
          }}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2023">2023</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            {[
              { value: "week", label: "Semana" },
              { value: "quarter", label: "Trimestre" },
              { value: "year", label: "Anual" },
            ].map((period) => (
              <Button
                key={period.value}
                variant={selectedPeriod === period.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.value)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 1, label: "Jan" },
            { value: 2, label: "Fev" },
            { value: 3, label: "Mar" },
            { value: 4, label: "Abr" },
            { value: 5, label: "Mai" },
            { value: 6, label: "Jun" },
            { value: 7, label: "Jul" },
            { value: 8, label: "Ago" },
            { value: 9, label: "Set" },
            { value: 10, label: "Out" },
            { value: 11, label: "Nov" },
            { value: 12, label: "Dez" },
          ].map((month) => (
            <Button
              key={month.value}
              variant={selectedMonth === month.value && selectedPeriod === "custom" ? "default" : "outline"}
              size="sm"
              className="min-w-[3.5rem]"
              onClick={() => {
                setSelectedMonth(month.value);
                setSelectedPeriod("custom");
              }}
            >
              {month.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncBalances}
                disabled={isRecalculatingBalances}
                className="h-8 w-8 p-0"
                title="Sincronizar Saldos"
              >
                <RefreshCw className={`h-4 w-4 ${isRecalculatingBalances ? 'animate-spin' : ''}`} />
              </Button>
              <Calculator className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(getTotalBalance())}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {isRecalculatingBalances ? 'Sincronizando...' : 'Clique no ícone para sincronizar'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(getTotalIncome)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(getTotalExpenses)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resultado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getNetResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(getNetResult)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs das Planilhas */}
      <Tabs defaultValue="cashflow" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="budget-company">Orçamento Empresa</TabsTrigger>
          <TabsTrigger value="budget-personal">Orçamento Pessoal</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
          <TabsTrigger value="inventory">Inventário</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="cashflow" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fluxo de Caixa</CardTitle>
                  <CardDescription>Controle detalhado de entradas e saídas</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportCashFlowToPDF}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={exportCashFlowToExcel}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                   {/* Filtro de Data */}
                   <div className="text-sm text-muted-foreground">Filtrar:</div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[140px] justify-start text-left font-normal",
                            !dateFilter.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFilter.startDate ? format(dateFilter.startDate, "dd/MM/yyyy") : "Data inicial"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFilter.startDate}
                          onSelect={(date) => setDateFilter({...dateFilter, startDate: date})}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "w-[140px] justify-start text-left font-normal",
                            !dateFilter.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFilter.endDate ? format(dateFilter.endDate, "dd/MM/yyyy") : "Data final"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFilter.endDate}
                          onSelect={(date) => setDateFilter({...dateFilter, endDate: date})}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDateFilter({startDate: null, endDate: null})}
                    >
                      Limpar
                    </Button>
                  </div>
                  <Dialog open={isAddingEntry} onOpenChange={setIsAddingEntry}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Lançamento
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Lançamento</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Input
                            id="description"
                            value={newEntry.description}
                            onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                            placeholder="Digite a descrição..."
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="type">Tipo</Label>
                            <Select value={newEntry.type} onValueChange={(value: 'income' | 'expense') => setNewEntry({...newEntry, type: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="income">Receita</SelectItem>
                                <SelectItem value="expense">Despesa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="category">Categoria</Label>
                            <Select value={newEntry.category} onValueChange={(value) => setNewEntry({...newEntry, category: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="Receita de Eventos">Receita de Eventos</SelectItem>
                                 <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                                 <SelectItem value="Despesas Operacionais">Despesas Operacionais</SelectItem>
                                 <SelectItem value="Pessoal">Pessoal</SelectItem>
                                 <SelectItem value="Marketing">Marketing</SelectItem>
                                 <SelectItem value="Alimentação">Alimentação</SelectItem>
                                 <SelectItem value="Transporte">Transporte</SelectItem>
                                 <SelectItem value="Outros">Outros</SelectItem>
                               </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="amount">Valor</Label>
                            <CurrencyInput
                              id="amount"
                              value={newEntry.amount}
                              onChange={(value) => setNewEntry({...newEntry, amount: value})}
                              placeholder="R$ 0,00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="date">Data</Label>
                            <Input
                              id="date"
                              type="date"
                              value={newEntry.date}
                              onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="account">Conta</Label>
                          <Select value={newEntry.account} onValueChange={(value) => setNewEntry({...newEntry, account: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                             <SelectContent>
                               {accounts.map((account) => (
                                 <SelectItem key={account.id} value={account.id}>
                                   {account.name}
                                 </SelectItem>
                               ))}
                             </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsAddingEntry(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleAddEntry}>
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Modal de Edição de Lançamento */}
                  <Dialog open={isEditingEntry} onOpenChange={setIsEditingEntry}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar Lançamento</DialogTitle>
                      </DialogHeader>
                      {selectedEntry && (
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-description">Descrição</Label>
                            <Input
                              id="edit-description"
                              value={selectedEntry.description}
                              onChange={(e) => setSelectedEntry({...selectedEntry, description: e.target.value})}
                              placeholder="Digite a descrição..."
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="edit-type">Tipo</Label>
                              <Select value={selectedEntry.type} onValueChange={(value: 'income' | 'expense') => setSelectedEntry({...selectedEntry, type: value})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="income">Receita</SelectItem>
                                  <SelectItem value="expense">Despesa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="edit-category">Categoria</Label>
                              <Select value={selectedEntry.category} onValueChange={(value) => setSelectedEntry({...selectedEntry, category: value})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Receita de Eventos">Receita de Eventos</SelectItem>
                                  <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                                  <SelectItem value="Despesas Operacionais">Despesas Operacionais</SelectItem>
                                  <SelectItem value="Pessoal">Pessoal</SelectItem>
                                  <SelectItem value="Marketing">Marketing</SelectItem>
                                  <SelectItem value="Alimentação">Alimentação</SelectItem>
                                  <SelectItem value="Transporte">Transporte</SelectItem>
                                  <SelectItem value="Outros">Outros</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="edit-amount">Valor</Label>
                              <CurrencyInput
                                id="edit-amount"
                                value={selectedEntry.amount}
                                onChange={(value) => setSelectedEntry({...selectedEntry, amount: value})}
                                placeholder="R$ 0,00"
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-date">Data</Label>
                              <Input
                                id="edit-date"
                                type="date"
                                value={selectedEntry.date}
                                onChange={(e) => setSelectedEntry({...selectedEntry, date: e.target.value})}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="edit-account">Conta</Label>
                            <Select value={selectedEntry.account} onValueChange={(value) => setSelectedEntry({...selectedEntry, account: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {accounts.map((account) => (
                                  <SelectItem key={account.id} value={account.name}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="edit-status">Status</Label>
                            <Select value={selectedEntry.status} onValueChange={(value: 'pending' | 'confirmed' | 'cancelled') => setSelectedEntry({...selectedEntry, status: value})}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="confirmed">Confirmado</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsEditingEntry(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={handleEditEntry}>
                              Salvar
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={cashFlowSelection.isAllSelected}
                        onCheckedChange={() => cashFlowSelection.toggleSelectAll()}
                      />
                    </TableHead>
                    <TableHead>Data e hora</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlow
                    .filter(entry => {
                      if (!dateFilter.startDate && !dateFilter.endDate) return true;
                      
                      // Extract only YYYY-MM-DD from entry date to avoid timezone issues
                      const entryDateStr = entry.date.split('T')[0];
                      
                      // Helper to get local date string YYYY-MM-DD without timezone shift
                      const toLocalDateString = (d: Date) => {
                        const year = d.getFullYear();
                        const month = (d.getMonth() + 1).toString().padStart(2, '0');
                        const day = d.getDate().toString().padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };
                      
                      const startStr = dateFilter.startDate ? toLocalDateString(dateFilter.startDate) : null;
                      const endStr = dateFilter.endDate ? toLocalDateString(dateFilter.endDate) : null;
                      
                      if (startStr && endStr) {
                        return entryDateStr >= startStr && entryDateStr <= endStr;
                      } else if (startStr) {
                        return entryDateStr >= startStr;
                      } else if (endStr) {
                        return entryDateStr <= endStr;
                      }
                      return true;
                    })
                    .map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Checkbox
                          checked={cashFlowSelection.isSelected(entry.id)}
                          onCheckedChange={() => cashFlowSelection.toggleSelection(entry.id)}
                        />
                      </TableCell>
                      <TableCell>
                        {formatTransactionDateTime(entry.date, entry.time, entry.createdAt)}
                      </TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell>{entry.category}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === 'income' ? 'default' : 'secondary'}>
                          {entry.type === 'income' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell className={entry.type === 'income' ? 'text-green-600' : 'text-red-600'}>
                        {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                      </TableCell>
                      <TableCell>{entry.account}</TableCell>
                      <TableCell>
                        <Badge variant={
                          entry.status === 'confirmed' ? 'default' : 
                          entry.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {entry.status === 'confirmed' ? 'Confirmado' : 
                           entry.status === 'pending' ? 'Pendente' : 'Cancelado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditEntry(entry)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <BulkActionsBar
                selectedCount={cashFlowSelection.selectedCount}
                onDelete={handleBulkDeleteCashFlow}
                onCancel={cashFlowSelection.clearSelection}
                isDeleting={isDeletingBulk}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Controle Orçamentário</CardTitle>
                  <CardDescription>Acompanhe o orçamento vs realizado por categoria</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setIsEditingBudget(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Orçamentos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budget.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{item.category}</h4>
                      <span className="text-sm text-muted-foreground">{item.percentage}% utilizado</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Orçado</div>
                        <div className="font-bold">{formatCurrency(item.budgeted)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Gasto</div>
                        <div className="font-bold text-red-600">{formatCurrency(item.spent)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Restante</div>
                        <div className="font-bold text-green-600">{formatCurrency(item.remaining)}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.percentage > 90 ? 'bg-red-500' : 
                            item.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <AccountsPanel />

        </TabsContent>


        <TabsContent value="budget-company" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Controle Orçamentário da Empresa</CardTitle>
                  <CardDescription>Acompanhe o orçamento vs realizado por categoria empresarial</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setIsEditingBudget(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Orçamentos
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budget.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{item.category}</h4>
                      <span className="text-sm text-muted-foreground">{item.percentage}% utilizado</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Orçado</div>
                        <div className="font-bold">{formatCurrency(item.budgeted)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Gasto</div>
                        <div className="font-bold text-red-600">{formatCurrency(item.spent)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Restante</div>
                        <div className="font-bold text-green-600">{formatCurrency(item.remaining)}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.percentage > 90 ? 'bg-red-500' : 
                            item.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Modal para Editar Orçamentos */}
          <Dialog open={isEditingBudget} onOpenChange={setIsEditingBudget}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Valores Orçamentários</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {budget.map((item) => (
                  <div key={item.category} className="grid grid-cols-3 gap-4 items-center">
                    <Label className="font-medium">{item.category}</Label>
                    <CurrencyInput
                      value={budgetValues[item.category] ?? item.budgeted}
                      onChange={(value) => setBudgetValues({
                        ...budgetValues,
                        [item.category]: value
                      })}
                      placeholder="R$ 0,00"
                    />
                    <div className="text-sm text-muted-foreground">
                      Gasto: {formatCurrency(item.spent)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsEditingBudget(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveBudgetValues}>
                    Salvar Orçamentos
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="budget-personal" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Controle Orçamentário Pessoal</CardTitle>
                  <CardDescription>Acompanhe seu orçamento pessoal vs gastos realizados</CardDescription>
                </div>
                <Button variant="outline" onClick={() => setIsEditingPersonalBudget(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Orçamento Pessoal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {personalBudget.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{item.category}</h4>
                      <span className="text-sm text-muted-foreground">{item.percentage}% utilizado</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Orçado</div>
                        <div className="font-bold">{formatCurrency(item.budgeted)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Gasto</div>
                        <div className="font-bold text-red-600">{formatCurrency(item.spent)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Restante</div>
                        <div className="font-bold text-green-600">{formatCurrency(item.remaining)}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            item.percentage > 90 ? 'bg-red-500' : 
                            item.percentage > 70 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(item.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Modal para Editar Orçamento Pessoal */}
          <Dialog open={isEditingPersonalBudget} onOpenChange={setIsEditingPersonalBudget}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Orçamento Pessoal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {personalBudget.map((item) => (
                  <div key={item.category} className="grid grid-cols-3 gap-4 items-center">
                    <Label className="font-medium">{item.category}</Label>
                    <CurrencyInput
                      value={personalBudgetValues[item.category] ?? item.budgeted}
                      onChange={(value) => setPersonalBudgetValues({
                        ...personalBudgetValues,
                        [item.category]: value
                      })}
                      placeholder="R$ 0,00"
                    />
                    <div className="text-sm text-muted-foreground">
                      Gasto: {formatCurrency(item.spent)}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsEditingPersonalBudget(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSavePersonalBudgetValues}>
                    Salvar Orçamento Pessoal
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inventário Patrimonial</CardTitle>
                  <CardDescription>Controle de bens e patrimônio da empresa</CardDescription>
                </div>
                <div className="flex gap-2">
                  <LogoUpload />
                  <Button 
                    variant="outline"
                    onClick={() => setIsPreviewingPatrimonyReport(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar Relatório
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={generatePatrimonyPDF}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar PDF Patrimonial
                  </Button>
                  <Dialog open={isAddingEntry} onOpenChange={setIsAddingEntry}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Item
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Adicionar Item ao Patrimônio</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="itemName">Nome do Item</Label>
                          <Input
                            id="itemName"
                            value={newInventoryItem.name}
                            onChange={(e) => setNewInventoryItem({...newInventoryItem, name: e.target.value})}
                            placeholder="Ex: Computador Dell, Mesa de Som..."
                          />
                        </div>
                        <div>
                          <Label htmlFor="itemCategory">Categoria</Label>
                          <Select 
                            value={newInventoryItem.category} 
                            onValueChange={(value) => setNewInventoryItem({...newInventoryItem, category: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equipamentos">Equipamentos</SelectItem>
                              <SelectItem value="som">Som</SelectItem>
                              <SelectItem value="iluminacao">Iluminação</SelectItem>
                              <SelectItem value="cabeamento">Cabeamento</SelectItem>
                              <SelectItem value="insumos">Insumos</SelectItem>
                              <SelectItem value="efeitos">Efeitos</SelectItem>
                              <SelectItem value="estruturas">Estruturas</SelectItem>
                              <SelectItem value="decoracao">Decoração</SelectItem>
                              <SelectItem value="mobiliario">Mobiliário</SelectItem>
                              <SelectItem value="veiculos">Veículos</SelectItem>
                              <SelectItem value="informatica">Informática</SelectItem>
                              <SelectItem value="ferramentas">Ferramentas</SelectItem>
                              <SelectItem value="maquinarios">Maquinários</SelectItem>
                              <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor="acquisitionValue">Valor de Aquisição</Label>
                          <CurrencyInput
                            id="acquisitionValue"
                            value={newInventoryItem.acquisitionValue}
                            onChange={(value) => setNewInventoryItem({...newInventoryItem, acquisitionValue: value})}
                            placeholder="R$ 0,00"
                          />
                        </div>
                        <div>
                          <Label htmlFor="acquisitionDate">Data de Aquisição</Label>
                          <Input
                            id="acquisitionDate"
                            type="date"
                            value={newInventoryItem.acquisitionDate}
                            onChange={(e) => setNewInventoryItem({...newInventoryItem, acquisitionDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="quantity">Quantidade</Label>
                          <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={newInventoryItem.quantity}
                            onChange={(e) => setNewInventoryItem({...newInventoryItem, quantity: parseInt(e.target.value) || 1})}
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="condition">Estado de Conservação</Label>
                          <Select 
                            value={newInventoryItem.condition} 
                            onValueChange={(value) => setNewInventoryItem({...newInventoryItem, condition: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="novo">Novo</SelectItem>
                              <SelectItem value="otimo">Ótimo</SelectItem>
                              <SelectItem value="bom">Bom</SelectItem>
                              <SelectItem value="regular">Regular</SelectItem>
                              <SelectItem value="ruim">Ruim</SelectItem>
                              <SelectItem value="pessimo">Péssimo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="serialNumber">Número de Série</Label>
                          <Input
                            id="serialNumber"
                            value={newInventoryItem.serialNumber}
                            onChange={(e) => setNewInventoryItem({...newInventoryItem, serialNumber: e.target.value})}
                            placeholder="Opcional"
                          />
                        </div>
                        <div>
                          <Label htmlFor="location">Localização</Label>
                          <Input
                            id="location"
                            value={newInventoryItem.location}
                            onChange={(e) => setNewInventoryItem({...newInventoryItem, location: e.target.value})}
                            placeholder="Ex: Escritório, Almoxarifado..."
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="description">Descrição/Observações</Label>
                        <Input
                          id="description"
                          value={newInventoryItem.description}
                          onChange={(e) => setNewInventoryItem({...newInventoryItem, description: e.target.value})}
                          placeholder="Detalhes adicionais, marca, modelo..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddingEntry(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddInventoryItem}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Resumo do Patrimônio */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total de Itens</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{inventory.reduce((total, item) => total + item.quantity, 0)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(inventory.reduce((total, item) => total + (item.acquisitionValue * item.quantity), 0))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Depreciação Acumulada</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(inventory.reduce((total, item) => {
                          const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                          const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                          const maxDepreciationYears = item.category === 'veiculos' ? 5 : item.category === 'informatica' ? 3 : 10;
                          const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue * item.quantity;
                          return total + depreciation;
                        }, 0))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Valor Atual</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(inventory.reduce((total, item) => {
                          const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                          const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                          const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue;
                          const currentValue = Math.max(item.acquisitionValue - depreciation, item.acquisitionValue * 0.1);
                          return total + (currentValue * item.quantity);
                        }, 0))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Filtros */}
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <Input
                      placeholder="Buscar item..."
                      className="w-64"
                      value={inventorySearchTerm}
                      onChange={(e) => setInventorySearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={selectedInventoryCategory} onValueChange={setSelectedInventoryCategory}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as Categorias</SelectItem>
                      <SelectItem value="equipamentos">Equipamentos</SelectItem>
                      <SelectItem value="som">Som</SelectItem>
                      <SelectItem value="iluminacao">Iluminação</SelectItem>
                      <SelectItem value="cabeamento">Cabeamento</SelectItem>
                      <SelectItem value="insumos">Insumos</SelectItem>
                      <SelectItem value="efeitos">Efeitos</SelectItem>
                      <SelectItem value="estruturas">Estruturas</SelectItem>
                      <SelectItem value="decoracao">Decoração</SelectItem>
                      <SelectItem value="mobiliario">Mobiliário</SelectItem>
                      <SelectItem value="veiculos">Veículos</SelectItem>
                      <SelectItem value="informatica">Informática</SelectItem>
                      <SelectItem value="ferramentas">Ferramentas</SelectItem>
                      <SelectItem value="maquinarios">Maquinários</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedInventoryCondition} onValueChange={setSelectedInventoryCondition}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Estados</SelectItem>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="otimo">Ótimo</SelectItem>
                      <SelectItem value="bom">Bom</SelectItem>
                      <SelectItem value="regular">Regular</SelectItem>
                      <SelectItem value="ruim">Ruim</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Tabela de Itens */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor Aquisição</TableHead>
                      <TableHead>Data Aquisição</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory
                      .filter(item => {
                        // Filtro por busca (nome, categoria, localização, descrição)
                        const searchMatch = inventorySearchTerm === "" || 
                          item.name.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
                          item.category.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
                          item.location.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
                          (item.description && item.description.toLowerCase().includes(inventorySearchTerm.toLowerCase()));
                        
                        // Filtro por categoria
                        const categoryMatch = selectedInventoryCategory === "todos" || 
                          item.category.toLowerCase() === selectedInventoryCategory.toLowerCase();
                        
                        // Filtro por condição/estado
                        const conditionMatch = selectedInventoryCondition === "todos" || 
                          item.condition.toLowerCase() === selectedInventoryCondition.toLowerCase();
                        
                        return searchMatch && categoryMatch && conditionMatch;
                      })
                      .map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.serialNumber && (
                              <div className="text-sm text-muted-foreground">SN: {item.serialNumber}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.acquisitionValue)}</TableCell>
                        <TableCell>{new Date(item.acquisitionDate).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant={getConditionBadgeVariant(item.condition)}>
                            {getConditionLabel(item.condition)}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.currentValue)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewInventoryItem(item)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditInventoryItem(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteInventoryItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <FinancialReportsPanel />

          <Card>

            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Relatórios Financeiros</CardTitle>
                  <CardDescription>Análises e relatórios detalhados</CardDescription>
                </div>
                {reportData && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadReport('pdf')}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadReport('excel')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Seletor de Regime Tributário para DRE */}
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <Label className="font-semibold">Regime Tributário (DRE):</Label>
                  <Select value={dreTaxRegime} onValueChange={(v) => setDreTaxRegime(v as DRETaxRegime)}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Simples Nacional</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      <SelectItem value="reforma_2026">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">NOVO</Badge>
                          Reforma 2026 (Fase Teste)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {dreTaxRegime === 'reforma_2026' && (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                      CBS 0,9% + IBS 0,1% + Transição PIS/COFINS/ISS
                    </Badge>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => generateReport('income-statement')}
                  disabled={isGeneratingReport}
                >
                  <FileText className="h-8 w-8 mb-2" />
                  <span>Demonstrativo de Resultados</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => generateReport('cash-flow-projection')}
                  disabled={isGeneratingReport}
                >
                  <Calculator className="h-8 w-8 mb-2" />
                  <span>Fluxo de Caixa Projetado</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => generateReport('profitability-analysis')}
                  disabled={isGeneratingReport}
                >
                  <TrendingUp className="h-8 w-8 mb-2" />
                  <span>Análise de Lucratividade</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => generateReport('tax-report')}
                  disabled={isGeneratingReport}
                >
                  <FileText className="h-8 w-8 mb-2" />
                  <span>Relatório Fiscal</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => setTaxModalOpen(true)}
                >
                  <Receipt className="h-8 w-8 mb-2" />
                  <span>Impostos por Evento</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col items-center justify-center"
                  onClick={() => generateReport('deductible-expenses')}
                  disabled={isGeneratingReport}
                >
                  <Calculator className="h-8 w-8 mb-2" />
                  <span>Despesas Dedutíveis</span>
                </Button>
              </div>
              
              {isGeneratingReport && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-primary bg-muted">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Gerando relatório...
                  </div>
                </div>
              )}

              {reportData && (
                <Card className="mt-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{reportData.title}</CardTitle>
                        <CardDescription>Período: {reportData.period}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          switch (reportData.type) {
                            case 'income-statement':
                              generateIncomeStatementPDF();
                              break;
                            case 'cash-flow-projection':
                              generateCashFlowProjectionPDF();
                              break;
                            case 'profitability-analysis':
                              generateProfitabilityAnalysisPDF();
                              break;
                            case 'tax-report':
                              generateTaxReportPDF();
                              break;
                            case 'deductible-expenses':
                              generateDeductibleExpensesPDF();
                              break;
                          }
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Baixar PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {renderReportContent()}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar item do inventário */}
      <Dialog open={isEditingInventoryItem} onOpenChange={setIsEditingInventoryItem}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Item do Inventário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editItemName">Nome do Item</Label>
                <Input
                  id="editItemName"
                  value={newInventoryItem.name}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, name: e.target.value})}
                  placeholder="Ex: Computador Dell, Mesa de Som..."
                />
              </div>
              <div>
                <Label htmlFor="editItemCategory">Categoria</Label>
                <Select 
                  value={newInventoryItem.category} 
                  onValueChange={(value) => setNewInventoryItem({...newInventoryItem, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipamentos">Equipamentos</SelectItem>
                    <SelectItem value="som">Som</SelectItem>
                    <SelectItem value="iluminacao">Iluminação</SelectItem>
                    <SelectItem value="cabeamento">Cabeamento</SelectItem>
                    <SelectItem value="insumos">Insumos</SelectItem>
                    <SelectItem value="efeitos">Efeitos</SelectItem>
                    <SelectItem value="estruturas">Estruturas</SelectItem>
                    <SelectItem value="decoracao">Decoração</SelectItem>
                    <SelectItem value="mobiliario">Mobiliário</SelectItem>
                    <SelectItem value="veiculos">Veículos</SelectItem>
                    <SelectItem value="informatica">Informática</SelectItem>
                    <SelectItem value="ferramentas">Ferramentas</SelectItem>
                    <SelectItem value="maquinarios">Maquinários</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="editAcquisitionValue">Valor de Aquisição</Label>
                <CurrencyInput
                  id="editAcquisitionValue"
                  value={newInventoryItem.acquisitionValue}
                  onChange={(value) => setNewInventoryItem({...newInventoryItem, acquisitionValue: value})}
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label htmlFor="editAcquisitionDate">Data de Aquisição</Label>
                <Input
                  id="editAcquisitionDate"
                  type="date"
                  value={newInventoryItem.acquisitionDate}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, acquisitionDate: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="editQuantity">Quantidade</Label>
                <Input
                  id="editQuantity"
                  type="number"
                  min="1"
                  value={newInventoryItem.quantity}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, quantity: parseInt(e.target.value) || 1})}
                  placeholder="1"
                />
              </div>
              <div>
                <Label htmlFor="editCondition">Estado de Conservação</Label>
                <Select 
                  value={newInventoryItem.condition} 
                  onValueChange={(value) => setNewInventoryItem({...newInventoryItem, condition: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="otimo">Ótimo</SelectItem>
                    <SelectItem value="bom">Bom</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="ruim">Ruim</SelectItem>
                    <SelectItem value="pessimo">Péssimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editSerialNumber">Número de Série</Label>
                <Input
                  id="editSerialNumber"
                  value={newInventoryItem.serialNumber}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, serialNumber: e.target.value})}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label htmlFor="editLocation">Localização</Label>
                <Input
                  id="editLocation"
                  value={newInventoryItem.location}
                  onChange={(e) => setNewInventoryItem({...newInventoryItem, location: e.target.value})}
                  placeholder="Ex: Escritório, Almoxarifado..."
                />
              </div>
            </div>
            <div>
              <Label htmlFor="editDescription">Descrição/Observações</Label>
              <Input
                id="editDescription"
                value={newInventoryItem.description}
                onChange={(e) => setNewInventoryItem({...newInventoryItem, description: e.target.value})}
                placeholder="Detalhes adicionais, marca, modelo..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditingInventoryItem(false);
                  setSelectedInventoryItem(null);
                  setNewInventoryItem({
                    name: "",
                    category: "",
                    acquisitionValue: 0,
                    acquisitionDate: new Date().toISOString().split('T')[0],
                    condition: "",
                    quantity: 1,
                    serialNumber: "",
                    location: "",
                    description: ""
                  });
                }}
              >
                Cancelar
              </Button>
              <Button onClick={handleUpdateInventoryItem}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para visualizar item do inventário */}
      <Dialog open={isViewingInventoryItem} onOpenChange={setIsViewingInventoryItem}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Item</DialogTitle>
          </DialogHeader>
          {viewInventoryItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Nome do Item</Label>
                  <div className="p-2 bg-muted rounded-md">{viewInventoryItem.name}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Categoria</Label>
                  <div className="p-2 bg-muted rounded-md">
                    {viewInventoryItem.category === 'equipamentos-som' && 'Equipamentos de Som'}
                    {viewInventoryItem.category === 'equipamentos-iluminacao' && 'Equipamentos de Iluminação'}
                    {viewInventoryItem.category === 'moveis' && 'Móveis e Utensílios'}
                    {viewInventoryItem.category === 'veiculos' && 'Veículos'}
                    {viewInventoryItem.category === 'informatica' && 'Informática'}
                    {viewInventoryItem.category === 'ferramentas' && 'Ferramentas'}
                    {viewInventoryItem.category === 'outros' && 'Outros'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Valor de Aquisição</Label>
                  <div className="p-2 bg-muted rounded-md">{formatCurrency(viewInventoryItem.acquisitionValue)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data de Aquisição</Label>
                  <div className="p-2 bg-muted rounded-md">{new Date(viewInventoryItem.acquisitionDate).toLocaleDateString('pt-BR')}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Quantidade</Label>
                  <div className="p-2 bg-muted rounded-md">{viewInventoryItem.quantity}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Estado de Conservação</Label>
                  <div className="p-2 bg-muted rounded-md">
                    <Badge variant={getConditionBadgeVariant(viewInventoryItem.condition)}>
                      {getConditionLabel(viewInventoryItem.condition)}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Número de Série</Label>
                  <div className="p-2 bg-muted rounded-md">{viewInventoryItem.serialNumber || 'Não informado'}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Localização</Label>
                  <div className="p-2 bg-muted rounded-md">{viewInventoryItem.location}</div>
                </div>
              </div>
              {viewInventoryItem.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Descrição/Observações</Label>
                  <div className="p-2 bg-muted rounded-md">{viewInventoryItem.description}</div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Valor Total de Aquisição</Label>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(viewInventoryItem.acquisitionValue * viewInventoryItem.quantity)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Depreciação Acumulada</Label>
                  <div className="text-lg font-semibold text-orange-600">
                    {formatCurrency((() => {
                      const yearsOld = (new Date().getFullYear() - new Date(viewInventoryItem.acquisitionDate).getFullYear());
                      const depreciationRate = viewInventoryItem.category === 'veiculos' ? 0.20 : viewInventoryItem.category === 'informatica' ? 0.33 : 0.10;
                      const depreciation = Math.min(yearsOld * depreciationRate, 1) * viewInventoryItem.acquisitionValue;
                      return depreciation * viewInventoryItem.quantity;
                    })())}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Valor Atual Estimado</Label>
                  <div className="text-lg font-semibold text-blue-600">
                    {formatCurrency((() => {
                      const yearsOld = (new Date().getFullYear() - new Date(viewInventoryItem.acquisitionDate).getFullYear());
                      const depreciationRate = viewInventoryItem.category === 'veiculos' ? 0.20 : viewInventoryItem.category === 'informatica' ? 0.33 : 0.10;
                      const depreciation = Math.min(yearsOld * depreciationRate, 1) * viewInventoryItem.acquisitionValue;
                      const currentValue = Math.max(viewInventoryItem.acquisitionValue - depreciation, viewInventoryItem.acquisitionValue * 0.1);
                      return currentValue * viewInventoryItem.quantity;
                    })())}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsViewingInventoryItem(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Dialog para visualização do relatório patrimonial */}
      <Dialog open={isPreviewingPatrimonyReport} onOpenChange={setIsPreviewingPatrimonyReport}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Visualização do Relatório Patrimonial</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[75vh]">
            <div className="space-y-6 p-6 bg-white text-black">
              {/* Cabeçalho do relatório */}
              <div className="border-4 border-blue-600 p-6 rounded-lg">
                <div className="flex items-start justify-between mb-6">
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain" />
                  )}
                  <div className="text-right">
                    <h1 className="text-2xl font-bold text-blue-600">{settings?.company_name || 'LUZ LOCAÇÃO'}</h1>
                    <p className="text-sm text-gray-600">{settings?.tagline || 'Controle de Estoque e Patrimônio'}</p>
                    {settings?.cnpj && <p className="text-xs text-gray-500 mt-1">CNPJ: {settings.cnpj}</p>}
                    {settings?.phone && <p className="text-xs text-gray-500">Tel: {settings.phone}</p>}
                    {settings?.email && <p className="text-xs text-gray-500">{settings.email}</p>}
                  </div>
                </div>
                
                <div className="border-t-2 border-blue-600 pt-6">
                  <h2 className="text-3xl font-bold text-blue-900 text-center mb-2">RELATÓRIO PATRIMONIAL</h2>
                  <p className="text-center text-gray-600 mb-2">Para Fins Bancários e Financeiros</p>
                  <p className="text-center text-sm text-gray-500">
                    Documento Nº: REL-PAT-{new Date().getFullYear()}-{String(Date.now()).slice(-6)}
                  </p>
                </div>
                
                {/* Marca d'água visual */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                    <span className="text-8xl font-bold text-gray-400 transform rotate-45">CONFIDENCIAL</span>
                  </div>
                  
                  {/* Resumo Executivo */}
                  <div className="bg-blue-50 border-2 border-blue-600 p-6 rounded-lg relative">
                    <h3 className="text-xl font-bold text-blue-900 mb-4">RESUMO EXECUTIVO</h3>
                    <div className="space-y-3">
                      <p className="text-base font-bold">
                        • Total de Itens: {inventory.reduce((total, item) => total + item.quantity, 0)} unidades
                      </p>
                      <p className="text-base font-bold">
                        • Valor Total de Aquisição: R$ {inventory.reduce((total, item) => total + (item.acquisitionValue * item.quantity), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-base font-bold">
                        • Depreciação Acumulada: R$ {inventory.reduce((total, item) => {
                          const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                          const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                          const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue * item.quantity;
                          return total + depreciation;
                        }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-lg font-bold text-green-700">
                        • Valor Patrimonial Atual: R$ {inventory.reduce((total, item) => {
                          const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                          const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                          const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue;
                          const currentValue = Math.max(item.acquisitionValue - depreciation, item.acquisitionValue * 0.1);
                          return total + (currentValue * item.quantity);
                        }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Detalhamento por Categoria */}
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">DETALHAMENTO POR CATEGORIA</h3>
                  <div className="space-y-3">
                    {[...new Set(inventory.map(item => item.category))].map(category => {
                      const categoryItems = inventory.filter(item => item.category === category);
                      const categoryValue = categoryItems.reduce((total, item) => total + (item.acquisitionValue * item.quantity), 0);
                      const categoryDepreciation = categoryItems.reduce((total, item) => {
                        const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                        const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                        const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue * item.quantity;
                        return total + depreciation;
                      }, 0);
                      const categoryCurrent = categoryValue - categoryDepreciation;
                      
                      const categoryLabels: Record<string, string> = {
                        'equipamentos': 'Equipamentos',
                        'som': 'Som',
                        'iluminacao': 'Iluminação',
                        'cabeamento': 'Cabeamento',
                        'insumos': 'Insumos',
                        'efeitos': 'Efeitos',
                        'estruturas': 'Estruturas',
                        'decoracao': 'Decoração',
                        'mobiliario': 'Mobiliário',
                        'veiculos': 'Veículos',
                        'informatica': 'Informática',
                        'ferramentas': 'Ferramentas',
                        'maquinarios': 'Maquinários',
                        'outros': 'Outros'
                      };
                      
                      return (
                        <div key={category} className="mb-3">
                          <p className="font-bold text-base">{categoryLabels[category] || category}</p>
                          <p className="text-sm ml-2">Itens: {categoryItems.reduce((t, i) => t + i.quantity, 0)}</p>
                          <p className="text-sm ml-2">Valor de Aquisição: R$ {categoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-sm ml-2">Valor Atual: R$ {categoryCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Inventário Detalhado */}
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-blue-900 mb-4">INVENTÁRIO DETALHADO</h3>
                  <div className="border border-gray-300">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-2 border-b font-bold">Item</th>
                          <th className="text-left p-2 border-b font-bold">Qtd</th>
                          <th className="text-left p-2 border-b font-bold">Aquisição</th>
                          <th className="text-left p-2 border-b font-bold">Valor Atual</th>
                          <th className="text-left p-2 border-b font-bold">Localização</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.map((item) => {
                          const yearsOld = (new Date().getFullYear() - new Date(item.acquisitionDate).getFullYear());
                          const depreciationRate = item.category === 'veiculos' ? 0.20 : item.category === 'informatica' ? 0.33 : 0.10;
                          const depreciation = Math.min(yearsOld * depreciationRate, 1) * item.acquisitionValue;
                          const currentItemValue = Math.max(item.acquisitionValue - depreciation, item.acquisitionValue * 0.1);
                          
                          return (
                            <tr key={item.id} className="border-b hover:bg-gray-50">
                              <td className="p-2">{item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name}</td>
                              <td className="p-2">{item.quantity}</td>
                              <td className="p-2">R$ {(item.acquisitionValue * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2">R$ {(currentItemValue * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2">{item.location.length > 20 ? item.location.substring(0, 20) + '...' : item.location}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Rodapé */}
                <div className="border-t-2 border-blue-600 pt-4 mt-8">
                  <p className="text-xs text-center text-gray-600">
                    {settings?.company_name || 'GESTAO LINE TAPE'} - {settings?.tagline || 'Controle de Estoque e Patrimônio'}
                  </p>
                  {settings?.address && (
                    <p className="text-xs text-center text-gray-600">Endereço: {settings.address}</p>
                  )}
                  <p className="text-xs text-center text-gray-500 mt-1">
                    Data de emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                  </p>
                  <p className="text-xs text-center text-gray-400 mt-1">
                    Documento gerado automaticamente pelo sistema
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          {/* Botões de ação */}
          <div className="flex justify-end gap-2 p-4 border-t">
            <Button variant="outline" onClick={() => setIsPreviewingPatrimonyReport(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setIsPreviewingPatrimonyReport(false);
              generatePatrimonyPDF();
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Gerar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      

      
      
      <EventTaxReportModal open={taxModalOpen} onOpenChange={setTaxModalOpen} />
      </div>
    </>
  );
};
