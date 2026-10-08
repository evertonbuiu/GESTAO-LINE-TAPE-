import { useState, useEffect, useCallback } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { IdCard } from 'lucide-react';
import { PersonProfileDialog } from '@/components/people/PersonProfileDialog';
import { WorkerAvailabilityBoard } from '@/components/people/WorkerAvailabilityBoard';
import { DailyRateReportsDialog } from '@/components/people/DailyRateReportsDialog';
import { DailyRatePaymentDialog, type PayableDailyRate } from '@/components/people/DailyRatePaymentDialog';
import {
  DailyRateOperationsFields,
  emptyOperations,
  type DailyRateOperationsValue,
} from '@/components/people/DailyRateOperationsFields';
import {
  detectDailyRateConflicts,
  resolveWorkerLink,
  validateAttendance,
  buildPaymentMemo,
  type WorkerOption,
} from '@/lib/dailyRates';
import { canViewFinancials, PAYMENT_STATUS_LABELS, type AttendanceStatus, type PaymentStatus } from '@/lib/people';
import { CalendarDays, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar as CalendarIcon, Trash2, User, Eye, Download, Wallet, Upload, Image as ImageIcon, Receipt, Check, UtensilsCrossed } from 'lucide-react';
import { WorkerFoodAllowanceCalendar } from './WorkerFoodAllowanceCalendar';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/ui/BulkActionsBar";
import { buildReceiptPath, resolveReceiptDisplayUrl, validateReceiptUpload, fileExtension, FINANCE_RECEIPT_BUCKET } from '@/lib/storageUrls';

interface DailyRate {
  id: string;
  worker_name: string;
  date: string;
  event_id: string | null;
  amount: number;
  notes: string | null;
  is_finalized: boolean;
  created_at?: string;
  events?: {
    name: string;
  };
}

interface Worker {
  name: string;
  totalAmount: number;
  workDays: number;
  image_url?: string | null;
}

interface WorkerAdvance {
  id: string;
  worker_name: string;
  amount: number;
  advance_date: string;
  bank_account_id: string;
  notes: string | null;
  is_finalized: boolean;
  bank_accounts?: {
    name: string;
  };
}

interface WorkerExpenseAdvance {
  id: string;
  worker_name: string;
  amount: number;
  advance_date: string;
  bank_account_id: string;
  notes: string | null;
  is_finalized: boolean;
  receipt_url: string | null;
  bank_accounts?: {
    name: string;
  };
}

interface WorkerExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  event_id: string;
  is_finalized: boolean;
  category?: string;
  events?: {
    name: string;
  };
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

export const DailyRates = () => {
  const { user, userRole } = useCustomAuth();
  const { toast } = useToast();
  const { canViewValues, formatValue } = useValueVisibility();
  const { settings: companySettings } = useCompanySettings();
  const { logoUrl } = useLogo();
  const [dailyRates, setDailyRates] = useState<DailyRate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [selectedBankAccountForPayment, setSelectedBankAccountForPayment] = useState<string>('');
  const [totalLiquidoToPay, setTotalLiquidoToPay] = useState(0);
  
  // Advances management
  const [advancesDialog, setAdvancesDialog] = useState(false);
  const [selectedWorkerAdvances, setSelectedWorkerAdvances] = useState<string | null>(null);
  const [advances, setAdvances] = useState<WorkerAdvance[]>([]);
  const [workerExpenses, setWorkerExpenses] = useState<WorkerExpense[]>([]);
  const [addAdvanceDialog, setAddAdvanceDialog] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<WorkerAdvance | null>(null);
  const [advanceFormData, setAdvanceFormData] = useState({
    amount: 0,
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    bank_account_id: '',
    notes: ''
  });
  
  // Expense Advances management
  const [expenseAdvancesDialog, setExpenseAdvancesDialog] = useState(false);
  const [selectedWorkerExpenseAdvances, setSelectedWorkerExpenseAdvances] = useState<string | null>(null);
  const [expenseAdvances, setExpenseAdvances] = useState<WorkerExpenseAdvance[]>([]);
  const [addExpenseAdvanceDialog, setAddExpenseAdvanceDialog] = useState(false);
  const [expenseAdvanceFormData, setExpenseAdvanceFormData] = useState({
    amount: 0,
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    bank_account_id: '',
    notes: '',
    receipt_file: null as File | null
  });
  const [uploadingExpenseAdvanceReceipt, setUploadingExpenseAdvanceReceipt] = useState(false);
  
  // Month/Year filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(new Date().getMonth());
  
  // Worker management
  const [addWorkerDialog, setAddWorkerDialog] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState('');
  const [workerPhoto, setWorkerPhoto] = useState<File | null>(null);
  const [workerPhotoPreview, setWorkerPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  // Calendar dialog
  const [calendarDialog, setCalendarDialog] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  // Day details dialog
  const [dayDialog, setDayDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayRate, setSelectedDayRate] = useState<DailyRate | null>(null);
  const [eventFilterMonth, setEventFilterMonth] = useState<number | 'all'>('all');
  const [dayFormData, setDayFormData] = useState({
    event_id: 'none',
    amount: 0,
    notes: ''
  });
  const [dayOps, setDayOps] = useState<DailyRateOperationsValue>(emptyOperations());
  const [dayConflicts, setDayConflicts] = useState<string[]>([]);
  const [workerOptions, setWorkerOptions] = useState<WorkerOption[]>([]);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [paymentRate, setPaymentRate] = useState<PayableDailyRate | null>(null);

  // View dialog
  const [viewDialog, setViewDialog] = useState(false);
  const [viewWorker, setViewWorker] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);

  // Notinhas dialog
  const [notinhasDialog, setNotinhasDialog] = useState(false);
  const [selectedWorkerNotinhas, setSelectedWorkerNotinhas] = useState<string | null>(null);
  const [notinhasEventFilterMonth, setNotinhasEventFilterMonth] = useState<number | 'all'>('all');
  const [pendingWhatsAppReceiptUrl, setPendingWhatsAppReceiptUrl] = useState<string | null>(null);
  const NOTINHA_CATEGORIES = ['Alimentação', 'Transporte', 'Combustível', 'Materiais', 'Ferramentas', 'Hospedagem', 'Estacionamento', 'Pedágio', 'Outros'];
  const [notinhasCategoryFilter, setNotinhasCategoryFilter] = useState<string>('all');
  const [notinhaFormData, setNotinhaFormData] = useState({
    expense_type: 'evento' as 'evento' | 'galpao',
    event_id: '',
    category: 'Outros',
    amount: 0,
    description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    receipt_file: null as File | null
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Receipt viewer dialog
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  /** Abre comprovante usando URL assinada temporária (bucket privado). */
  const openReceipt = async (stored: string | null | undefined) => {
    const url = await resolveReceiptDisplayUrl(stored);
    if (!url) {
      toast({
        title: 'Comprovante indisponível',
        description: 'Não foi possível gerar o acesso ao comprovante.',
        variant: 'destructive',
      });
      return;
    }
    setReceiptUrl(url);
    setReceiptDialog(true);
  };

  // Food allowance calendar
  const [foodAllowanceDialog, setFoodAllowanceDialog] = useState(false);
  const [selectedWorkerFoodAllowance, setSelectedWorkerFoodAllowance] = useState<string | null>(null);

  // Bulk selection states
  const [isDeletingBulkAdvances, setIsDeletingBulkAdvances] = useState(false);
  const [isDeletingBulkExpenseAdvances, setIsDeletingBulkExpenseAdvances] = useState(false);

  const canEdit = userRole === 'admin' || userRole === 'financeiro';
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileWorkerName, setProfileWorkerName] = useState<string | null>(null);

  // Hook para seleção múltipla de vales
  const advanceSelection = useBulkSelection({
    items: advances,
    getItemId: useCallback((adv: WorkerAdvance) => adv.id, [])
  });

  // Hook para seleção múltipla de adiantamentos para notinhas
  const expenseAdvanceSelection = useBulkSelection({
    items: expenseAdvances,
    getItemId: useCallback((adv: WorkerExpenseAdvance) => adv.id, [])
  });

  // Função para exclusão em lote de vales
  const handleBulkDeleteAdvances = async () => {
    if (advanceSelection.selectedCount === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${advanceSelection.selectedCount} vale(s)?`)) {
      return;
    }

    setIsDeletingBulkAdvances(true);
    try {
      const idsToDelete = Array.from(advanceSelection.selectedIds);
      
      for (const id of idsToDelete) {
        await handleDeleteAdvance(id);
      }

      toast({
        title: "Sucesso",
        description: `${idsToDelete.length} vale(s) excluído(s) com sucesso`
      });

      advanceSelection.clearSelection();
    } catch (error) {
      console.error('Erro ao excluir vales em lote:', error);
    } finally {
      setIsDeletingBulkAdvances(false);
    }
  };

  // Função para exclusão em lote de adiantamentos para notinhas
  const handleBulkDeleteExpenseAdvances = async () => {
    if (expenseAdvanceSelection.selectedCount === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${expenseAdvanceSelection.selectedCount} adiantamento(s)?`)) {
      return;
    }

    setIsDeletingBulkExpenseAdvances(true);
    try {
      const idsToDelete = Array.from(expenseAdvanceSelection.selectedIds);
      
      for (const id of idsToDelete) {
        await handleDeleteExpenseAdvance(id);
      }

      toast({
        title: "Sucesso",
        description: `${idsToDelete.length} adiantamento(s) excluído(s) com sucesso`
      });

      expenseAdvanceSelection.clearSelection();
    } catch (error) {
      console.error('Erro ao excluir adiantamentos em lote:', error);
    } finally {
      setIsDeletingBulkExpenseAdvances(false);
    }
  };

  useEffect(() => {
    // Configure PDF.js worker - use the npm package version
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    
    fetchDailyRates();
    fetchEvents();
    fetchBankAccounts();
    fetchWorkerOptions();
  }, []);

  // Lista de diaristas cadastrados com ID estável (usada para gravar worker_id em novos lançamentos).
  const fetchWorkerOptions = async () => {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, status, primary_role, default_daily_rate, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao carregar diaristas:', error);
      return;
    }
    // Cadastro legado tem uma linha por mês: mantém a mais recente por nome.
    const unique = new Map<string, WorkerOption>();
    for (const worker of (data ?? []) as WorkerOption[]) {
      const key = worker.name.trim().toLowerCase();
      if (!unique.has(key)) unique.set(key, worker);
    }
    setWorkerOptions(Array.from(unique.values()));
  };

  const handleToggleFinalized = async (rateId: string, isFinalized: boolean) => {
    try {
      const { error } = await supabase
        .from('daily_rates')
        .update({ is_finalized: isFinalized })
        .eq('id', rateId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: isFinalized ? "Lançamento finalizado" : "Lançamento reaberto"
      });

      // Atualizar a lista local
      setDailyRates(prev => prev.map(rate => 
        rate.id === rateId ? { ...rate, is_finalized: isFinalized } : rate
      ));
    } catch (error: any) {
      console.error('Error toggling finalized status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };


  const handleToggleAdvanceFinalized = async (advanceId: string, isFinalized: boolean) => {
    try {
      const { error } = await supabase
        .from('worker_advances')
        .update({ is_finalized: isFinalized })
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: isFinalized ? "Vale finalizado" : "Vale reaberto"
      });

      setAdvances(prev => prev.map(adv => 
        adv.id === advanceId ? { ...adv, is_finalized: isFinalized } : adv
      ));
    } catch (error: any) {
      console.error('Error toggling advance finalized status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const handleToggleExpenseFinalized = async (expenseId: string, isFinalized: boolean) => {
    try {
      const { error } = await supabase
        .from('event_expenses')
        .update({ is_finalized: isFinalized })
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: isFinalized ? "Notinha finalizada" : "Notinha reaberta"
      });

      setWorkerExpenses(prev => prev.map(exp => 
        exp.id === expenseId ? { ...exp, is_finalized: isFinalized } : exp
      ));
    } catch (error: any) {
      console.error('Error toggling expense finalized status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const handleToggleExpenseAdvanceFinalized = async (advanceId: string, isFinalized: boolean) => {
    try {
      const { error } = await supabase
        .from('worker_expense_advances')
        .update({ is_finalized: isFinalized })
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: isFinalized ? "Adiantamento finalizado" : "Adiantamento reaberto"
      });

      setExpenseAdvances(prev => prev.map(adv => 
        adv.id === advanceId ? { ...adv, is_finalized: isFinalized } : adv
      ));
    } catch (error: any) {
      console.error('Error toggling expense advance finalized status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
    }
  };

  const handlePayAll = async () => {
    if (!viewWorker) return;
    
    // Calcular total líquido a receber
    const totalLiquido = 
      Object.values(getWorkedDaysByMonth())
        .flat()
        .reduce((sum, rate) => sum + rate.amount, 0) +
      Object.values(getExpensesByMonth())
        .flat()
        .reduce((sum, expense) => sum + expense.amount, 0) -
      Object.values(getAdvancesByMonth())
        .flat()
        .reduce((sum, advance) => sum + advance.amount, 0) -
      Object.values(getExpenseAdvancesByMonth())
        .flat()
        .reduce((sum, advance) => sum + advance.amount, 0);
    
    setTotalLiquidoToPay(totalLiquido);
    setSelectedBankAccountForPayment('');
    setPaymentDialog(true);
  };

  // Função auxiliar para processar em lotes menores
  const processBatch = async (table: 'daily_rates' | 'worker_advances' | 'worker_expense_advances' | 'event_expenses', ids: string[], finalizeStatus: boolean, batchSize = 10) => {
    const batches = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize));
    }
    
    for (const batch of batches) {
      const { error } = await supabase
        .from(table as any)
        .update({ is_finalized: finalizeStatus })
        .in('id', batch);
      
      if (error) throw error;
    }
  };

  const processPayment = async () => {
    if (!viewWorker || !selectedBankAccountForPayment) {
      toast({
        title: "Erro",
        description: "Selecione uma conta bancária para debitar o valor.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const errors = [];
      
      // Finalizar todas as diárias em lotes
      const dailyRateIds = Object.values(getWorkedDaysByMonth()).flat().map(r => r.id);
      if (dailyRateIds.length > 0) {
        try {
          await processBatch('daily_rates', dailyRateIds, true);
        } catch (error: any) {
          errors.push('diárias: ' + error.message);
        }
      }
      
      // Finalizar todos os vales em lotes
      const advanceIds = Object.values(getAdvancesByMonth()).flat().map(a => a.id);
      if (advanceIds.length > 0) {
        try {
          await processBatch('worker_advances', advanceIds, true);
        } catch (error: any) {
          errors.push('vales: ' + error.message);
        }
      }
      
      // Finalizar todos os adiantamentos para notinhas em lotes
      const expenseAdvanceIds = Object.values(getExpenseAdvancesByMonth()).flat().map(a => a.id);
      if (expenseAdvanceIds.length > 0) {
        try {
          await processBatch('worker_expense_advances', expenseAdvanceIds, true);
        } catch (error: any) {
          errors.push('adiantamentos: ' + error.message);
        }
      }
      
      // Finalizar todas as despesas (notinhas) em lotes
      const expenseIds = Object.values(getExpensesByMonth()).flat().map(e => e.id);
      if (expenseIds.length > 0) {
        try {
          await processBatch('event_expenses', expenseIds, true);
        } catch (error: any) {
          errors.push('despesas: ' + error.message);
        }
      }
      
      // Atualizar saldo da conta bancária
      const selectedAccount = bankAccounts.find(acc => acc.id === selectedBankAccountForPayment);
      if (selectedAccount) {
        const newBalance = selectedAccount.balance - totalLiquidoToPay;
        const { error } = await supabase
          .from('bank_accounts')
          .update({ balance: newBalance })
          .eq('id', selectedBankAccountForPayment);
        if (error) errors.push('conta bancária: ' + error.message);
        
        // Criar transação bancária para aparecer no extrato
        if (!error) {
          const { error: transactionError } = await supabase
            .from('bank_transactions')
            .insert({
              bank_account_id: selectedBankAccountForPayment,
              description: `Pagamento de Diárias - ${viewWorker}`,
              amount: totalLiquidoToPay,
              transaction_type: 'expense',
              category: 'Pagamento de Diárias',
              transaction_date: format(new Date(), 'yyyy-MM-dd')
            });
          if (transactionError) errors.push('transação bancária: ' + transactionError.message);
        }
      }
      
      if (errors.length > 0) {
        toast({
          title: "Erro parcial ao finalizar",
          description: `Alguns registros não foram finalizados: ${errors.join(', ')}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Pagamento finalizado!",
          description: `Todos os lançamentos de ${viewWorker} foram marcados como finalizados e o saldo foi debitado.`,
        });
        setPaymentDialog(false);
        
        // Recarregar os dados
        fetchDailyRates();
        fetchBankAccounts();
        if (viewWorker) {
          fetchAdvances(viewWorker);
          fetchExpenseAdvances(viewWorker);
          fetchWorkerExpenses(viewWorker);
        }
      }
    } catch (error: any) {
      console.error('Error finalizing all records:', error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar os lançamentos",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    calculateWorkers();
  }, [dailyRates, selectedMonthFilter, selectedYear]);

  const toLocalDateStr = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const fetchDailyRates = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_rates')
        .select(`
          *,
          events (
            name
          )
        `)
        .order('date', { ascending: false });

      if (error) throw error;
      setDailyRates(data || []);
    } catch (error) {
      console.error('Error fetching daily rates:', error);
      toast({
        title: "Erro ao carregar diárias",
        description: "Não foi possível carregar as diárias.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('name');

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchAdvances = async (
    workerName: string,
    rangeStart?: string | null,
    rangeEnd?: string | null
  ) => {
    try {
      const useCustomRange = Boolean(rangeStart || rangeEnd);
      // Criar datas de início e fim do mês selecionado
      const startDate = new Date(selectedYear, selectedMonthFilter, 1);
      const endDate = new Date(selectedYear, selectedMonthFilter + 1, 0);

      const startDateStr = useCustomRange ? rangeStart : toLocalDateStr(startDate);
      const endDateStr = useCustomRange ? rangeEnd : toLocalDateStr(endDate);

      let query = supabase
        .from('worker_advances')
        .select(`
          *,
          bank_accounts (
            name
          )
        `)
        .eq('worker_name', workerName);

      if (startDateStr) query = query.gte('advance_date', startDateStr);
      if (endDateStr) query = query.lte('advance_date', endDateStr);

      const { data, error } = await query.order('advance_date', { ascending: false });

      if (error) throw error;
      setAdvances(data || []);
    } catch (error: any) {
      console.error('Error fetching advances:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar vales",
        variant: "destructive"
      });
    }
  };

  const fetchWorkerExpenses = async (workerName: string) => {
    try {
      const { data, error } = await supabase
        .from('event_expenses')
        .select(`
          id,
          description,
          total_price,
          expense_date,
          receipt_url,
          event_id,
          is_finalized,
          category,
          events (
            name
          )
        `)
        .ilike('description', `${workerName} - %`)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      
      const expenses: WorkerExpense[] = (data || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        amount: item.total_price,
        expense_date: item.expense_date,
        receipt_url: item.receipt_url,
        event_id: item.event_id,
        is_finalized: item.is_finalized,
        category: item.category,
        events: Array.isArray(item.events) ? item.events[0] : item.events
      }));
      
      setWorkerExpenses(expenses);
    } catch (error: any) {
      console.error('Error fetching worker expenses:', error);
    }
  };

  const openAdvancesDialog = (workerName: string) => {
    setSelectedWorkerAdvances(workerName);
    fetchAdvances(workerName);
    setAdvancesDialog(true);
  };

  const handleAddAdvance = async () => {
    if (!selectedWorkerAdvances || !user?.id) return;
    
    if (advanceFormData.amount <= 0) {
      toast({
        title: "Erro",
        description: "O valor do vale deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    if (!advanceFormData.bank_account_id) {
      toast({
        title: "Erro",
        description: "Selecione uma conta bancária",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('worker_advances')
        .insert({
          worker_name: selectedWorkerAdvances,
          amount: advanceFormData.amount,
          advance_date: advanceFormData.advance_date,
          bank_account_id: advanceFormData.bank_account_id,
          notes: advanceFormData.notes || null,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Vale adicionado com sucesso"
      });

      setAddAdvanceDialog(false);
      setAdvanceFormData({
        amount: 0,
        advance_date: format(new Date(), 'yyyy-MM-dd'),
        bank_account_id: '',
        notes: ''
      });
      fetchAdvances(selectedWorkerAdvances);
    } catch (error: any) {
      console.error('Error adding advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar vale",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este vale?')) return;

    try {
      // First, fetch the advance data to get worker name, date, and amount for company_expenses cleanup
      const { data: advanceData, error: fetchError } = await supabase
        .from('worker_advances')
        .select('*')
        .eq('id', advanceId)
        .single();

      if (fetchError) {
        console.error('Error fetching advance data:', fetchError);
      }

      // Delete any linked event_expenses (for advances linked to events)
      const { error: eventExpenseError } = await supabase
        .from('event_expenses')
        .delete()
        .eq('reference_type', 'worker_advance')
        .eq('reference_id', advanceId);

      if (eventExpenseError) {
        console.error('Error deleting linked event expense:', eventExpenseError);
        // Continue with main deletion even if this fails
      }

      // Delete from company_expenses if this was a "Galpão" advance (no event linked)
      // This handles advances imported via bank reconciliation
      if (advanceData) {
        const { error: companyExpenseError } = await supabase
          .from('company_expenses')
          .delete()
          .eq('category', 'Diarista - Vale/Adiantamento')
          .eq('supplier', advanceData.worker_name)
          .eq('expense_date', advanceData.advance_date)
          .eq('total_price', advanceData.amount);

        if (companyExpenseError) {
          console.error('Error deleting linked company expense:', companyExpenseError);
        }
      }

      // Then delete the worker advance (trigger handles bank_transactions)
      const { error } = await supabase
        .from('worker_advances')
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Vale excluído com sucesso"
      });

      if (selectedWorkerAdvances) {
        fetchAdvances(selectedWorkerAdvances);
      }
    } catch (error: any) {
      console.error('Error deleting advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir vale",
        variant: "destructive"
      });
    }
  };

  // Expense Advances functions
  const fetchExpenseAdvances = async (
    workerName: string,
    rangeStart?: string | null,
    rangeEnd?: string | null
  ) => {
    try {
      const useCustomRange = Boolean(rangeStart || rangeEnd);
      // Criar datas de início e fim do mês selecionado
      const startDate = new Date(selectedYear, selectedMonthFilter, 1);
      const endDate = new Date(selectedYear, selectedMonthFilter + 1, 0);

      const startDateStr = useCustomRange ? rangeStart : toLocalDateStr(startDate);
      const endDateStr = useCustomRange ? rangeEnd : toLocalDateStr(endDate);

      let query = supabase
        .from('worker_expense_advances')
        .select(`
          *,
          bank_accounts (
            name
          )
        `)
        .eq('worker_name', workerName);

      if (startDateStr) query = query.gte('advance_date', startDateStr);
      if (endDateStr) query = query.lte('advance_date', endDateStr);

      const { data, error } = await query.order('advance_date', { ascending: false });

      if (error) throw error;
      setExpenseAdvances(data || []);
    } catch (error: any) {
      console.error('Error fetching expense advances:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar adiantamentos para notinhas",
        variant: "destructive"
      });
    }
  };

  const openExpenseAdvancesDialog = (workerName: string) => {
    setSelectedWorkerExpenseAdvances(workerName);
    fetchExpenseAdvances(workerName);
    setExpenseAdvancesDialog(true);
  };

  const handleAddExpenseAdvance = async () => {
    if (!selectedWorkerExpenseAdvances || !user?.id) return;
    
    if (expenseAdvanceFormData.amount <= 0) {
      toast({
        title: "Erro",
        description: "O valor do adiantamento deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    if (!expenseAdvanceFormData.bank_account_id) {
      toast({
        title: "Erro",
        description: "Selecione uma conta bancária",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploadingExpenseAdvanceReceipt(true);
      let receiptUrl: string | null = null;

      // Upload receipt if provided (bucket privado: guardamos o caminho, nunca URL pública)
      if (expenseAdvanceFormData.receipt_file) {
        const validation = validateReceiptUpload(expenseAdvanceFormData.receipt_file);
        if (!validation.ok) {
          toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' });
          setUploadingExpenseAdvanceReceipt(false);
          return;
        }

        const filePath = `expense-advance-receipts/${user.id}-${Date.now()}.${fileExtension(
          expenseAdvanceFormData.receipt_file.name
        )}`;

        const { error: uploadError } = await supabase.storage
          .from(FINANCE_RECEIPT_BUCKET)
          .upload(filePath, expenseAdvanceFormData.receipt_file);

        if (uploadError) throw uploadError;

        receiptUrl = filePath;
      }

      const { error } = await supabase
        .from('worker_expense_advances')
        .insert({
          worker_name: selectedWorkerExpenseAdvances,
          amount: expenseAdvanceFormData.amount,
          advance_date: expenseAdvanceFormData.advance_date,
          bank_account_id: expenseAdvanceFormData.bank_account_id,
          notes: expenseAdvanceFormData.notes || null,
          receipt_url: receiptUrl,
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Adiantamento para notinhas adicionado com sucesso"
      });

      setAddExpenseAdvanceDialog(false);
      setExpenseAdvanceFormData({
        amount: 0,
        advance_date: format(new Date(), 'yyyy-MM-dd'),
        bank_account_id: '',
        notes: '',
        receipt_file: null
      });
      fetchExpenseAdvances(selectedWorkerExpenseAdvances);
    } catch (error: any) {
      console.error('Error adding expense advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar adiantamento",
        variant: "destructive"
      });
    } finally {
      setUploadingExpenseAdvanceReceipt(false);
    }
  };

  const handleDeleteExpenseAdvance = async (advanceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este adiantamento?')) return;

    try {
      // First, fetch the expense advance data for company_expenses cleanup
      const { data: advanceData, error: fetchError } = await supabase
        .from('worker_expense_advances')
        .select('*')
        .eq('id', advanceId)
        .single();

      if (fetchError) {
        console.error('Error fetching expense advance data:', fetchError);
      }

      // Remove linked event expense (when this advance was tied to an event)
      const { error: eventExpenseError } = await supabase
        .from('event_expenses')
        .delete()
        .eq('reference_type', 'worker_expense_advance')
        .eq('reference_id', advanceId);

      if (eventExpenseError) {
        console.error('Error deleting linked event expense:', eventExpenseError);
        // Continue with main deletion even if this fails
      }

      // Delete from company_expenses if this was a "Galpão" advance
      // This handles advances imported via bank reconciliation
      if (advanceData) {
        const { error: companyExpenseError } = await supabase
          .from('company_expenses')
          .delete()
          .eq('category', 'Diarista - Adiantamento de Notinhas')
          .eq('supplier', advanceData.worker_name)
          .eq('expense_date', advanceData.advance_date)
          .eq('total_price', advanceData.amount);

        if (companyExpenseError) {
          console.error('Error deleting linked company expense:', companyExpenseError);
        }
      }

      const { error } = await supabase
        .from('worker_expense_advances')
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Adiantamento excluído com sucesso"
      });

      if (selectedWorkerExpenseAdvances) {
        fetchExpenseAdvances(selectedWorkerExpenseAdvances);
      }
    } catch (error: any) {
      console.error('Error deleting expense advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir adiantamento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteNotinha = async (expenseId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta notinha?')) return;

    try {
      const { error } = await supabase
        .from('event_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Notinha excluída com sucesso"
      });

      if (viewWorker) {
        fetchWorkerExpenses(viewWorker);
      }
    } catch (error: any) {
      console.error('Error deleting expense advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir adiantamento",
        variant: "destructive"
      });
    }
  };

  const calculateWorkers = async () => {
    const workerMap = new Map<string, Worker>();
    
    // Calculate start and end of selected month
    const startDate = new Date(selectedYear, selectedMonthFilter, 1);
    const endDate = new Date(selectedYear, selectedMonthFilter + 1, 0);
    
    // Fetch workers created in the selected month
    const { data: workersCreatedThisMonth } = await supabase
      .from('workers')
      .select('name, image_url, created_at')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    // Initialize workers created this month with zero values
    if (workersCreatedThisMonth) {
      workersCreatedThisMonth.forEach(worker => {
        workerMap.set(worker.name, {
          name: worker.name,
          totalAmount: 0,
          workDays: 0,
          image_url: worker.image_url
        });
      });
    }
    
    // Filter rates by selected month and year
    const filteredRates = dailyRates.filter(rate => {
      const [year, month, day] = rate.date.split('-').map(Number);
      const rateDate = new Date(year, month - 1, day);
      return rateDate.getMonth() === selectedMonthFilter && 
             rateDate.getFullYear() === selectedYear;
    });
    
    // Update or add workers that have daily rates in the selected month
    filteredRates.forEach(rate => {
      const existing = workerMap.get(rate.worker_name);
      if (existing) {
        existing.totalAmount += rate.amount;
        existing.workDays += 1;
      } else {
        workerMap.set(rate.worker_name, {
          name: rate.worker_name,
          totalAmount: rate.amount,
          workDays: 1
        });
      }
    });

    // Fetch photos for workers that have rates but weren't created this month
    const workersNeedingPhotos = Array.from(workerMap.keys()).filter(
      name => !workersCreatedThisMonth?.some(w => w.name === name)
    );
    
    if (workersNeedingPhotos.length > 0) {
      const { data: additionalWorkers } = await supabase
        .from('workers')
        .select('name, image_url')
        .in('name', workersNeedingPhotos);

      if (additionalWorkers) {
        additionalWorkers.forEach(worker => {
          const existing = workerMap.get(worker.name);
          if (existing) {
            existing.image_url = worker.image_url;
          }
        });
      }
    }

    setWorkers(Array.from(workerMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
  };

  const handleWorkerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A foto deve ter no máximo 5MB.",
          variant: "destructive"
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Formato inválido",
          description: "Por favor, selecione uma imagem.",
          variant: "destructive"
        });
        return;
      }

      setWorkerPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setWorkerPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddWorker = async () => {
    if (!user || !newWorkerName.trim()) {
      toast({
        title: "Nome inválido",
        description: "Digite o nome do diarista.",
        variant: "destructive"
      });
      return;
    }

    try {
      const trimmedName = newWorkerName.trim();
      console.log('Tentando adicionar diarista:', trimmedName);
      
      // Check if worker already exists in this specific month
      const createdAtDate = new Date(selectedYear, selectedMonthFilter, 1);
      const monthStart = new Date(selectedYear, selectedMonthFilter, 1);
      const monthEnd = new Date(selectedYear, selectedMonthFilter + 1, 0);
      
      const { data: existingWorkerInMonth, error: checkError } = await supabase
        .from('workers')
        .select('name')
        .eq('name', trimmedName)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      console.log('Resultado da busca no mês:', existingWorkerInMonth, 'Erro:', checkError);

      if (existingWorkerInMonth && existingWorkerInMonth.length > 0) {
        console.log('Diarista já existe neste mês:', existingWorkerInMonth);
        toast({
          title: "Diarista já cadastrado",
          description: "Este diarista já está registrado neste mês.",
          variant: "destructive"
        });
        return;
      }

      setUploadingPhoto(true);
      let imageUrl: string | null = null;

      // Upload photo if provided or get existing photo
      if (workerPhoto) {
        const fileExt = workerPhoto.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('worker-photos')
          .upload(filePath, workerPhoto);

        if (uploadError) {
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('worker-photos')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      } else {
        // Try to get photo from existing worker with same name
        const { data: existingWorker } = await supabase
          .from('workers')
          .select('image_url')
          .eq('name', trimmedName)
          .limit(1)
          .maybeSingle();
        
        if (existingWorker?.image_url) {
          imageUrl = existingWorker.image_url;
        }
      }

      // Save worker to database with the selected month/year from filter
      console.log('Inserindo diarista no banco:', trimmedName, 'com data:', createdAtDate.toISOString());
      
      const { error: insertError } = await supabase
        .from('workers')
        .insert({
          name: trimmedName,
          image_url: imageUrl,
          created_by: user.id,
          created_at: createdAtDate.toISOString()
        });

      if (insertError) {
        console.error('Erro ao inserir:', insertError);
        throw insertError;
      }

      console.log('Diarista inserido com sucesso!');
      await calculateWorkers();
      setNewWorkerName('');
      setWorkerPhoto(null);
      setWorkerPhotoPreview(null);
      setAddWorkerDialog(false);
      
      toast({
        title: "Diarista adicionado!",
        description: "Agora você pode adicionar dias de trabalho.",
      });
    } catch (error: any) {
      console.error('Error adding worker:', error);
      
      toast({
        title: "Erro ao adicionar diarista",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeleteWorker = async (workerName: string) => {
    const monthName = new Date(selectedYear, selectedMonthFilter).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    if (!confirm(`Tem certeza que deseja excluir o diarista "${workerName}" do mês de ${monthName}?`)) return;

    try {
      // Calculate month range
      const monthStart = new Date(selectedYear, selectedMonthFilter, 1);
      const monthEnd = new Date(selectedYear, selectedMonthFilter + 1, 0);

      // Get worker record for this specific month
      const { data: workerInMonth } = await supabase
        .from('workers')
        .select('id, image_url')
        .eq('name', workerName)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
        .maybeSingle();

      if (!workerInMonth) {
        toast({
          title: "Erro",
          description: "Diarista não encontrado neste mês.",
          variant: "destructive"
        });
        return;
      }

      // Get daily rates for this worker in this month only
      const { data: workerRates, error: fetchError } = await supabase
        .from('daily_rates')
        .select('id, event_id, date')
        .eq('worker_name', workerName)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (fetchError) {
        console.error('Error fetching worker rates:', fetchError);
        throw fetchError;
      }

      console.log('Worker rates found for this month:', workerRates);

      // Remove associated expenses and collaborators from events
      if (workerRates && workerRates.length > 0) {
        const eventIds = [...new Set(workerRates.filter(r => r.event_id).map(r => r.event_id))];
        
        console.log('Event IDs to clean:', eventIds);
        
        for (const eventId of eventIds) {
          if (eventId) {
            // Delete expenses for this worker in this event
            const { data: expenses } = await supabase
              .from('event_expenses')
              .select('id')
              .eq('event_id', eventId)
              .eq('description', `Diária - ${workerName}`);

            if (expenses && expenses.length > 0) {
              for (const expense of expenses) {
                const { error: expenseError } = await supabase
                  .from('event_expenses')
                  .delete()
                  .eq('id', expense.id);

                if (expenseError) {
                  console.error('Error deleting expense:', expenseError);
                }
              }
              console.log(`Deleted ${expenses.length} expense(s) for ${workerName}`);
            }

            // Remove collaborators
            const { error: collaboratorError } = await supabase
              .from('event_collaborators')
              .delete()
              .eq('event_id', eventId)
              .eq('collaborator_name', workerName)
              .eq('role', 'diarista');

            if (collaboratorError) {
              console.error('Error deleting collaborators:', collaboratorError);
            }
          }
        }

        // Delete daily rates for this worker in this month
        const { error: deleteError } = await supabase
          .from('daily_rates')
          .delete()
          .eq('worker_name', workerName)
          .gte('date', format(monthStart, 'yyyy-MM-dd'))
          .lte('date', format(monthEnd, 'yyyy-MM-dd'));

        if (deleteError) {
          console.error('Error deleting daily rates:', deleteError);
          throw deleteError;
        }
      }

      // Delete worker record for this month only
      await supabase
        .from('workers')
        .delete()
        .eq('id', workerInMonth.id);

      toast({
        title: "Diarista excluído!",
        description: `${workerName} foi removido do mês de ${monthName}.`,
      });

      await calculateWorkers();
    } catch (error) {
      console.error('Error deleting worker:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o diarista.",
        variant: "destructive"
      });
    }
  };

  const openCalendar = (workerName: string) => {
    setSelectedWorker(workerName);
    setSelectedMonth(new Date());
    setCalendarDialog(true);
  };

  const openDayDialog = (date: Date) => {
    if (!selectedWorker) return;
    
    setSelectedDate(date);
    setEventFilterMonth('all'); // Reset filter when opening dialog
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingRate = dailyRates.find(
      r => r.worker_name === selectedWorker && r.date === dateStr
    );

    setDayConflicts([]);

    if (existingRate) {
      const rate = existingRate as DailyRate & Record<string, unknown>;
      setSelectedDayRate(existingRate);
      setDayFormData({
        event_id: existingRate.event_id || 'none',
        amount: existingRate.amount,
        notes: existingRate.notes || ''
      });
      setDayOps({
        event_role: (rate.event_role as string) || '',
        attendance_status: ((rate.attendance_status as AttendanceStatus) || 'prevista'),
        substituted_worker_name: (rate.substituted_worker_name as string) || '',
        planned_start_time: ((rate.planned_start_time as string) || '').slice(0, 5),
        planned_end_time: ((rate.planned_end_time as string) || '').slice(0, 5),
        actual_start_time: ((rate.actual_start_time as string) || '').slice(0, 5),
        actual_end_time: ((rate.actual_end_time as string) || '').slice(0, 5),
        overtime_amount: Number(rate.overtime_amount ?? 0),
        food_amount: Number(rate.food_amount ?? 0),
        transport_amount: Number(rate.transport_amount ?? 0),
        lodging_amount: Number(rate.lodging_amount ?? 0),
        discount_amount: Number(rate.discount_amount ?? 0),
      });
    } else {
      setSelectedDayRate(null);
      const suggested = workerOptions.find(
        (w) => w.name.trim().toLowerCase() === selectedWorker.trim().toLowerCase()
      );
      setDayFormData({
        event_id: 'none',
        amount: Number(suggested?.default_daily_rate ?? 0),
        notes: ''
      });
      setDayOps({ ...emptyOperations(), event_role: suggested?.primary_role || '' });
    }
    
    setDayDialog(true);
  };

  const getFilteredEvents = () => {
    if (eventFilterMonth === 'all') {
      return events;
    }
    
    return events.filter(event => {
      const eventDate = new Date(event.event_date + 'T12:00:00');
      return eventDate.getMonth() === eventFilterMonth;
    });
  };

  const handleSaveDay = async () => {
    if (!user || !selectedWorker || !selectedDate) return;

    const attendanceErrors = validateAttendance(dayOps);
    if (attendanceErrors.length > 0) {
      toast({
        title: 'Revise a presença',
        description: attendanceErrors.join(' '),
        variant: 'destructive',
      });
      return;
    }

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const eventId = dayFormData.event_id === 'none' ? null : dayFormData.event_id;

      // Vínculo estável: grava worker_id quando a pessoa existe no cadastro;
      // registros legados/ambíguos continuam apenas pelo nome.
      const link = resolveWorkerLink(
        { workerId: (selectedDayRate as (DailyRate & { worker_id?: string | null }) | null)?.worker_id, workerName: selectedWorker },
        workerOptions
      );

      // Conflito/duplicidade antes de gravar.
      const conflicts = detectDailyRateConflicts(
        {
          id: selectedDayRate?.id,
          worker_id: link?.worker_id ?? null,
          worker_name: selectedWorker,
          event_id: eventId,
          date: dateStr,
          planned_start_time: dayOps.planned_start_time || null,
          planned_end_time: dayOps.planned_end_time || null,
        },
        (dailyRates as Array<DailyRate & Record<string, unknown>>).map((r) => ({
          id: r.id,
          worker_id: (r.worker_id as string) ?? null,
          worker_name: r.worker_name,
          event_id: r.event_id,
          date: r.date,
          planned_start_time: (r.planned_start_time as string) ?? null,
          planned_end_time: (r.planned_end_time as string) ?? null,
        }))
      );

      if (conflicts.length > 0) {
        const messages = conflicts.map((c) => c.message);
        setDayConflicts(messages);
        const proceed = window.confirm(
          `${messages.join('\n')}\n\nDeseja salvar mesmo assim?`
        );
        if (!proceed) return;
      } else {
        setDayConflicts([]);
      }

      const operationalPayload = {
        event_role: dayOps.event_role || null,
        attendance_status: dayOps.attendance_status,
        substituted_worker_name: dayOps.substituted_worker_name || null,
        planned_start_time: dayOps.planned_start_time || null,
        planned_end_time: dayOps.planned_end_time || null,
        actual_start_time: dayOps.actual_start_time || null,
        actual_end_time: dayOps.actual_end_time || null,
        overtime_amount: dayOps.overtime_amount || 0,
        food_amount: dayOps.food_amount || 0,
        transport_amount: dayOps.transport_amount || 0,
        lodging_amount: dayOps.lodging_amount || 0,
        discount_amount: dayOps.discount_amount || 0,
      };

      if (selectedDayRate) {
        // Update existing
        const { error } = await supabase
          .from('daily_rates')
          .update({
            event_id: eventId,
            amount: dayFormData.amount,
            notes: dayFormData.notes || null,
            worker_id: link?.worker_id ?? null,
            ...operationalPayload,
          })
          .eq('id', selectedDayRate.id);

        if (error) throw error;

        toast({
          title: "Dia atualizado!",
          description: "As alterações foram salvas.",
        });
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('daily_rates')
          .insert({
            worker_name: selectedWorker,
            date: dateStr,
            event_id: eventId,
            amount: dayFormData.amount,
            notes: dayFormData.notes || null,
            created_by: user.id,
            worker_id: link?.worker_id ?? null,
            ...operationalPayload,
          });

        if (insertError) throw insertError;

        toast({
          title: "Dia adicionado!",
          description: dayFormData.event_id !== 'none' 
            ? "A diária foi registrada. Despesa e colaborador serão automaticamente adicionados ao evento."
            : "A diária foi registrada.",
        });
      }

      setDayDialog(false);
      fetchDailyRates();
    } catch (error) {
      console.error('Error saving day:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as informações.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDay = async () => {
    if (!selectedDayRate || !confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      // Delete associated bank transactions (for cash flow and statement)
      const { error: bankTransactionError } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('reference_type', 'daily_rate')
        .eq('reference_id', selectedDayRate.id);

      if (bankTransactionError) {
        console.error('Error deleting bank transaction for daily rate:', bankTransactionError);
      }

      // If it's a "Galpão" daily rate (no event_id), delete from company_expenses as well
      if (!selectedDayRate.event_id) {
        // Delete company expense that matches this worker and description pattern
        const { error: companyExpenseError } = await supabase
          .from('company_expenses')
          .delete()
          .eq('category', 'Diarista - Diária')
          .eq('supplier', selectedDayRate.worker_name)
          .eq('expense_date', selectedDayRate.date)
          .eq('total_price', selectedDayRate.amount);

        if (companyExpenseError) {
          console.error('Error deleting company expense for daily rate:', companyExpenseError);
        }
      }

      // Delete the daily rate (triggers will automatically remove associated expense and collaborator)
      const { error } = await supabase
        .from('daily_rates')
        .delete()
        .eq('id', selectedDayRate.id);

      if (error) throw error;

      toast({
        title: "Registro excluído!",
        description: selectedDayRate.event_id 
          ? "O dia foi removido. Despesa, colaborador e transação bancária serão automaticamente excluídos."
          : "O dia foi removido. Gasto empresa também foi excluído.",
      });

      setDayDialog(false);
      fetchDailyRates();
    } catch (error) {
      console.error('Error deleting day:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o registro.",
        variant: "destructive"
      });
    }
  };

  const getWorkedDays = (workerName: string, month: Date) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    
    return dailyRates.filter(r => {
      if (r.worker_name !== workerName) return false;
      const rateDate = new Date(r.date + 'T12:00:00');
      return rateDate >= start && rateDate <= end;
    }).map(r => new Date(r.date + 'T12:00:00'));
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);

  const openViewDialog = (workerName: string) => {
    setViewWorker(workerName);
    setFilterStartDate(null);
    setFilterEndDate(null);
    fetchAdvances(workerName);
    fetchWorkerExpenses(workerName);
    fetchExpenseAdvances(workerName);
    setViewDialog(true);
  };

  // Recarrega vales e adiantamentos conforme o período filtrado no relatório
  useEffect(() => {
    if (!viewDialog || !viewWorker) return;
    const start = filterStartDate ? toLocalDateStr(filterStartDate) : null;
    const end = filterEndDate ? toLocalDateStr(filterEndDate) : null;
    void fetchAdvances(viewWorker, start, end);
    void fetchExpenseAdvances(viewWorker, start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDialog, viewWorker, filterStartDate, filterEndDate, selectedMonthFilter, selectedYear]);


  const getWorkedDaysByMonth = () => {
    if (!viewWorker) return {};
    
    // Filter by worker and date range from view dialog filters
    const filtered = dailyRates.filter(r => {
      if (r.worker_name !== viewWorker) return false;
      
      const [year, month, day] = r.date.split('-').map(Number);
      const rateDate = new Date(year, month - 1, day);
      
      // Apply date range filter if set
      if (filterStartDate) {
        const startOfDay = new Date(filterStartDate);
        startOfDay.setHours(0, 0, 0, 0);
        if (rateDate < startOfDay) return false;
      }
      
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (rateDate > endOfDay) return false;
      }
      
      // If no custom filter is set, apply the external month/year filter
      if (!filterStartDate && !filterEndDate) {
        if (rateDate.getMonth() !== selectedMonthFilter || rateDate.getFullYear() !== selectedYear) {
          return false;
        }
      }
      
      return true;
    });
    
    // Deduplicate by date (keep the most recent one if duplicates exist)
    const uniqueByDate = new Map<string, DailyRate>();
    filtered.forEach(rate => {
      const existing = uniqueByDate.get(rate.date);
      if (!existing || new Date(rate.created_at || 0) > new Date(existing.created_at || 0)) {
        uniqueByDate.set(rate.date, rate);
      }
    });
    
    const groupedByMonth: Record<string, DailyRate[]> = {};
    
    uniqueByDate.forEach(rate => {
      const [year, month, day] = rate.date.split('-').map(Number);
      const rateDate = new Date(year, month - 1, day);
      const monthYear = format(rateDate, 'yyyy-MM');
      
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(rate);
    });
    
    // Sort each month's rates by date (most recent first)
    Object.keys(groupedByMonth).forEach(monthYear => {
      groupedByMonth[monthYear].sort((a, b) => {
        const [yearA, monthA, dayA] = a.date.split('-').map(Number);
        const [yearB, monthB, dayB] = b.date.split('-').map(Number);
        return new Date(yearB, monthB - 1, dayB).getTime() - new Date(yearA, monthA - 1, dayA).getTime();
      });
    });
    
    return groupedByMonth;
  };

  const getAdvancesByMonth = () => {
    if (!viewWorker) return {};
    
    // Filter by worker and date range from view dialog filters
    const filtered = advances.filter(adv => {
      if (adv.worker_name !== viewWorker) return false;
      
      const [year, month, day] = adv.advance_date.split('-').map(Number);
      const advanceDate = new Date(year, month - 1, day);
      
      // Apply date range filter if set
      if (filterStartDate) {
        const startOfDay = new Date(filterStartDate);
        startOfDay.setHours(0, 0, 0, 0);
        if (advanceDate < startOfDay) return false;
      }
      
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (advanceDate > endOfDay) return false;
      }
      
      // If no custom filter is set, apply the external month/year filter
      if (!filterStartDate && !filterEndDate) {
        if (advanceDate.getMonth() !== selectedMonthFilter || advanceDate.getFullYear() !== selectedYear) {
          return false;
        }
      }
      
      return true;
    });
    
    const groupedByMonth: Record<string, WorkerAdvance[]> = {};
    
    filtered.forEach(advance => {
      const [year, month, day] = advance.advance_date.split('-').map(Number);
      const advanceDate = new Date(year, month - 1, day);
      const monthYear = format(advanceDate, 'yyyy-MM');
      
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(advance);
    });
    
    // Sort each month's advances by date (most recent first)
    Object.keys(groupedByMonth).forEach(monthYear => {
      groupedByMonth[monthYear].sort((a, b) => {
        const [yearA, monthA, dayA] = a.advance_date.split('-').map(Number);
        const [yearB, monthB, dayB] = b.advance_date.split('-').map(Number);
        return new Date(yearB, monthB - 1, dayB).getTime() - new Date(yearA, monthA - 1, dayA).getTime();
      });
    });
    
    return groupedByMonth;
  };

  const getExpensesByMonth = () => {
    if (!viewWorker) return {};
    
    // Filter by worker and date range from view dialog filters
    const filtered = workerExpenses.filter(exp => {
      const [year, month, day] = exp.expense_date.split('-').map(Number);
      const expenseDate = new Date(year, month - 1, day);
      
      // Apply date range filter if set
      if (filterStartDate) {
        const startOfDay = new Date(filterStartDate);
        startOfDay.setHours(0, 0, 0, 0);
        if (expenseDate < startOfDay) return false;
      }
      
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (expenseDate > endOfDay) return false;
      }
      
      // If no custom filter is set, apply the external month/year filter
      if (!filterStartDate && !filterEndDate) {
        if (expenseDate.getMonth() !== selectedMonthFilter || expenseDate.getFullYear() !== selectedYear) {
          return false;
        }
      }
      
      return true;
    });
    
    const groupedByMonth: Record<string, WorkerExpense[]> = {};
    
    filtered.forEach(expense => {
      const [year, month, day] = expense.expense_date.split('-').map(Number);
      const expenseDate = new Date(year, month - 1, day);
      const monthYear = format(expenseDate, 'yyyy-MM');
      
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(expense);
    });
    
    // Sort each month's expenses by date (most recent first)
    Object.keys(groupedByMonth).forEach(monthYear => {
      groupedByMonth[monthYear].sort((a, b) => {
        const [yearA, monthA, dayA] = a.expense_date.split('-').map(Number);
        const [yearB, monthB, dayB] = b.expense_date.split('-').map(Number);
        return new Date(yearB, monthB - 1, dayB).getTime() - new Date(yearA, monthA - 1, dayA).getTime();
      });
    });
    
    return groupedByMonth;
  };

  const getExpenseAdvancesByMonth = () => {
    if (!viewWorker) return {};
    
    // Filter by worker and date range from view dialog filters
    const filtered = expenseAdvances.filter(adv => {
      if (adv.worker_name !== viewWorker) return false;
      
      const [year, month, day] = adv.advance_date.split('-').map(Number);
      const advanceDate = new Date(year, month - 1, day);
      
      // Apply date range filter if set
      if (filterStartDate) {
        const startOfDay = new Date(filterStartDate);
        startOfDay.setHours(0, 0, 0, 0);
        if (advanceDate < startOfDay) return false;
      }
      
      if (filterEndDate) {
        const endOfDay = new Date(filterEndDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (advanceDate > endOfDay) return false;
      }
      
      // If no custom filter is set, apply the external month/year filter
      if (!filterStartDate && !filterEndDate) {
        if (advanceDate.getMonth() !== selectedMonthFilter || advanceDate.getFullYear() !== selectedYear) {
          return false;
        }
      }
      
      return true;
    });
    
    const groupedByMonth: Record<string, WorkerExpenseAdvance[]> = {};
    
    filtered.forEach(advance => {
      const [year, month, day] = advance.advance_date.split('-').map(Number);
      const advanceDate = new Date(year, month - 1, day);
      const monthYear = format(advanceDate, 'yyyy-MM');
      
      if (!groupedByMonth[monthYear]) {
        groupedByMonth[monthYear] = [];
      }
      groupedByMonth[monthYear].push(advance);
    });
    
    // Sort each month's advances by date (most recent first)
    Object.keys(groupedByMonth).forEach(monthYear => {
      groupedByMonth[monthYear].sort((a, b) => {
        const [yearA, monthA, dayA] = a.advance_date.split('-').map(Number);
        const [yearB, monthB, dayB] = b.advance_date.split('-').map(Number);
        return new Date(yearB, monthB - 1, dayB).getTime() - new Date(yearA, monthA - 1, dayA).getTime();
      });
    });
    
    return groupedByMonth;
  };

  const generatePDF = async () => {
    const doc = new jsPDF({
      compress: true
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const workedDaysByMonth = getWorkedDaysByMonth();
    const allFilteredDays = Object.values(workedDaysByMonth).flat();
    const advancesByMonth = getAdvancesByMonth();
    const workerAdvances = Object.values(advancesByMonth).flat();
    const expensesByMonth = getExpensesByMonth();
    const workerExpensesFlat = Object.values(expensesByMonth).flat();
    const expenseAdvancesByMonth = getExpenseAdvancesByMonth();
    const workerExpenseAdvances = Object.values(expenseAdvancesByMonth).flat();
    
    // Função para adicionar cabeçalho timbrado
    const addLetterhead = async (pageNumber: number) => {
      // Adicionar logo se disponível
      if (logoUrl) {
        try {
          // Carregar logo como imagem
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoUrl;
          });
          
          // Adicionar logo com compressão (ajustar tamanho conforme necessário)
          doc.addImage(img, 'JPEG', 14, 10, 30, 30, undefined, 'MEDIUM');
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }
      
      // Informações da empresa
      const startX = logoUrl ? 50 : 14;
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(companySettings?.company_name || 'Empresa', startX, 15);
      
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      let yPos = 20;
      
      if (companySettings?.cnpj) {
        doc.text(`CNPJ: ${companySettings.cnpj}`, startX, yPos);
        yPos += 4;
      }
      if (companySettings?.address) {
        doc.text(companySettings.address, startX, yPos);
        yPos += 4;
      }
      if (companySettings?.phone || companySettings?.email) {
        const contact = [companySettings.phone, companySettings.email].filter(Boolean).join(' | ');
        doc.text(contact, startX, yPos);
      }
      
      // Linha separadora
      doc.setLineWidth(0.5);
      doc.line(14, 45, pageWidth - 14, 45);
      
      // Número da página
      doc.setFontSize(8);
      doc.text(`Página ${pageNumber}`, pageWidth - 30, 10);
    };
    
    // Adicionar cabeçalho na primeira página
    await addLetterhead(1);
    
    // Título do relatório
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Relatório de Diárias - ${viewWorker}`, 14, 52);
    
    // Tabela de Diárias
    const tableData = allFilteredDays.map(rate => [
      format(new Date(rate.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      rate.events?.name || 'Sem evento',
      formatCurrency(rate.amount),
      rate.notes || '-'
    ]);
    
    const totalDiarias = allFilteredDays.reduce((sum, rate) => sum + rate.amount, 0);
    
    autoTable(doc, {
      startY: 58,
      head: [['Data', 'Evento', 'Valor', 'Observações']],
      body: tableData,
      foot: [['', 'TOTAL DIÁRIAS', formatCurrency(totalDiarias), '']],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      footStyles: { fillColor: [59, 130, 246], fontStyle: 'bold' },
      margin: { top: 50 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          addLetterhead(data.pageNumber);
        }
      }
    });
    
    let finalYLast = (doc as any).lastAutoTable.finalY || 58;
    const totalVales = workerAdvances.reduce((sum, advance) => sum + advance.amount, 0);
    
    // Tabela de Vales
    if (workerAdvances.length > 0) {
      const advancesData = workerAdvances
        .sort((a, b) => new Date(b.advance_date).getTime() - new Date(a.advance_date).getTime())
        .map(advance => [
          format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
          formatCurrency(advance.amount),
          advance.bank_accounts?.name || '-',
          advance.notes || '-'
        ]);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Vales (Adiantamentos)', 14, finalYLast + 10);
      
      autoTable(doc, {
        startY: finalYLast + 15,
        head: [['Data', 'Valor', 'Conta', 'Observações']],
        body: advancesData,
        foot: [['', 'TOTAL VALES', formatCurrency(totalVales), '']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [239, 68, 68] },
        footStyles: { fillColor: [239, 68, 68], fontStyle: 'bold' },
        margin: { top: 50 },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addLetterhead(data.pageNumber);
          }
        }
      });
      
      finalYLast = (doc as any).lastAutoTable.finalY || finalYLast;
    }
    
    // Tabela de Notinhas (Reembolsos)
    if (workerExpensesFlat.length > 0) {
      const expensesData = workerExpensesFlat
        .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        .map(expense => [
          format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
          expense.events?.name || 'Sem evento',
          formatCurrency(expense.amount),
          expense.description || '-'
        ]);
      
      const totalNotinhas = workerExpensesFlat.reduce((sum, exp) => sum + exp.amount, 0);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Notinhas (Reembolsos)', 14, finalYLast + 10);
      
      autoTable(doc, {
        startY: finalYLast + 15,
        head: [['Data', 'Evento', 'Valor', 'Descrição']],
        body: expensesData,
        foot: [['', 'TOTAL NOTINHAS', formatCurrency(totalNotinhas), '']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fillColor: [34, 197, 94], fontStyle: 'bold' },
        margin: { top: 50 },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addLetterhead(data.pageNumber);
          }
        }
      });
      
      finalYLast = (doc as any).lastAutoTable.finalY || finalYLast;
    }
    
    // Tabela de Adiantamentos para Notinhas
    if (workerExpenseAdvances.length > 0) {
      const expAdvData = workerExpenseAdvances
        .sort((a, b) => new Date(b.advance_date).getTime() - new Date(a.advance_date).getTime())
        .map(advance => [
          format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
          formatCurrency(advance.amount),
          advance.bank_accounts?.name || '-',
          advance.notes || '-'
        ]);
      
      const totalExpAdvances = workerExpenseAdvances.reduce((sum, adv) => sum + adv.amount, 0);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Adiantamentos para Notinhas', 14, finalYLast + 10);
      
      autoTable(doc, {
        startY: finalYLast + 15,
        head: [['Data', 'Valor', 'Conta', 'Observações']],
        body: expAdvData,
        foot: [['', 'TOTAL ADIANTAMENTOS', formatCurrency(totalExpAdvances), '']],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [251, 146, 60] },
        footStyles: { fillColor: [251, 146, 60], fontStyle: 'bold' },
        margin: { top: 50 },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            addLetterhead(data.pageNumber);
          }
        }
      });
      
      finalYLast = (doc as any).lastAutoTable.finalY || finalYLast;
    }
    
    // Total Líquido
    const totalNotinhas = workerExpensesFlat.reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpAdvances = workerExpenseAdvances.reduce((sum, adv) => sum + adv.amount, 0);
    const totalLiquido = totalDiarias + totalNotinhas - totalVales - totalExpAdvances;
    
    // Adicionar barras de totais coloridas - apenas quando há valores
    const hasTotals = totalDiarias > 0 || totalVales > 0 || totalExpAdvances > 0 || totalNotinhas > 0;
    
    if (hasTotals) {
      let currentY = finalYLast + 10;
      const barHeight = 10;
      const barSpacing = 2;
      const barWidth = pageWidth - 28;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      
      // Barra 1: Total em Diárias (vermelha) - apenas se houver diárias
      if (totalDiarias > 0) {
        doc.setFillColor(220, 38, 38);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Diárias:', 18, currentY + 7);
        doc.text(formatCurrency(totalDiarias), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Barra 2: Total em Vales (vermelha) - apenas se houver vales
      if (totalVales > 0) {
        doc.setFillColor(220, 38, 38);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Vales:', 18, currentY + 7);
        doc.text(formatCurrency(totalVales), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Barra 3: Total em Adiantamentos para Notinhas (vermelha) - apenas se houver
      if (totalExpAdvances > 0) {
        doc.setFillColor(220, 38, 38);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Adiantamentos para Notinhas:', 18, currentY + 7);
        doc.text(formatCurrency(totalExpAdvances), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Barra 4: Total em Notinhas (verde clara) - apenas se houver
      if (totalNotinhas > 0) {
        doc.setFillColor(187, 247, 208);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text('Total em Notinhas (Reembolsos):', 18, currentY + 7);
        doc.text(`+ ${formatCurrency(totalNotinhas)}`, pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Barra 5: Total Líquido a Receber (azul clara)
      doc.setFillColor(191, 219, 254);
      doc.rect(14, currentY, barWidth, barHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('Total Líquido a Receber:', 18, currentY + 7);
      doc.text(formatCurrency(totalLiquido), pageWidth - 18, currentY + 7, { align: 'right' });
    }
    
    // Resetar cor do texto para preto
    doc.setTextColor(0, 0, 0);
    
    // Rodapé com data de emissão
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(
        `Emitido em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
        14,
        doc.internal.pageSize.getHeight() - 10
      );
    }
    
    doc.save(`relatorio_${viewWorker}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setAvailabilityOpen(true)}>
          <CalendarDays className="h-4 w-4 mr-2" aria-hidden="true" />
          Disponibilidade
        </Button>
        <Button variant="outline" onClick={() => setReportsOpen(true)}>
          <BarChart3 className="h-4 w-4 mr-2" aria-hidden="true" />
          Relatórios
        </Button>
      </div>

      {/* Month/Year Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="year-select" className="text-sm font-medium">Ano:</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(value) => setSelectedYear(parseInt(value))}
                >
                  <SelectTrigger id="year-select" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
            </div>
            
            
            <div className="flex gap-2 overflow-x-auto pb-2">
              {months.map((month, index) => (
                <Button
                  key={month}
                  variant={selectedMonthFilter === index ? "default" : "outline"}
                  onClick={() => setSelectedMonthFilter(index)}
                  className="min-w-[70px]"
                >
                  {month}
                </Button>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground text-center">
              {months[selectedMonthFilter]} {selectedYear} - {workers.length} diarista(s)
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Diaristas</CardTitle>
              <CardDescription>Gerencie os diaristas e seus dias de trabalho</CardDescription>
            </div>
            {canEdit && (
              <Dialog open={addWorkerDialog} onOpenChange={(open) => {
                setAddWorkerDialog(open);
                if (!open) {
                  setNewWorkerName('');
                  setWorkerPhoto(null);
                  setWorkerPhotoPreview(null);
                }
              }}>
                <Button onClick={() => setAddWorkerDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Diarista
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Diarista</DialogTitle>
                    <DialogDescription>Digite o nome e adicione a foto do novo diarista</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="worker_name">Nome do Diarista *</Label>
                      <Input
                        id="worker_name"
                        value={newWorkerName}
                        onChange={(e) => setNewWorkerName(e.target.value)}
                        placeholder="Ex: João Silva"
                        onKeyDown={(e) => e.key === 'Enter' && !workerPhoto && handleAddWorker()}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="worker_photo">Foto do Diarista</Label>
                      <div className="flex flex-col gap-2">
                        {workerPhotoPreview ? (
                          <div className="relative w-32 h-32 mx-auto">
                            <img 
                              src={workerPhotoPreview} 
                              alt="Preview" 
                              className="w-full h-full object-cover rounded-lg border-2 border-border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => {
                                setWorkerPhoto(null);
                                setWorkerPhotoPreview(null);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center w-full">
                            <label
                              htmlFor="worker_photo"
                              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 transition-colors"
                            >
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  Clique para adicionar foto
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  PNG, JPG até 5MB
                                </p>
                              </div>
                              <Input
                                id="worker_photo"
                                type="file"
                                accept="image/*"
                                onChange={handleWorkerPhotoChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button onClick={handleAddWorker} className="w-full" disabled={uploadingPhoto}>
                      {uploadingPhoto ? 'Carregando...' : 'Adicionar'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum diarista cadastrado</p>
              {canEdit && <p className="text-sm mt-2">Clique em "Adicionar Diarista" para começar</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.map((worker) => (
                <Card key={worker.name} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                          {worker.image_url ? (
                            <img 
                              src={worker.image_url} 
                              alt={worker.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-6 w-6 text-primary" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold">{worker.name}</h3>
                          <p className="text-sm text-muted-foreground">{worker.workDays} dias trabalhados</p>
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteWorker(worker.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {canViewValues && (
                      <div className="mb-4 p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground">Total recebido</p>
                        <p className="text-lg font-bold">{formatValue(worker.totalAmount)}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2 mb-2">
                      <Button 
                        className="flex-1" 
                        variant="outline"
                        onClick={() => openCalendar(worker.name)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Calendário
                      </Button>
                      <Button 
                        className="flex-1" 
                        variant="outline"
                        onClick={() => openViewDialog(worker.name)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </Button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <Button
                        className="flex-1"
                        variant="outline"
                        onClick={() => {
                          setProfileWorkerName(worker.name);
                          setProfileDialogOpen(true);
                        }}
                      >
                        <IdCard className="mr-2 h-4 w-4" />
                        Ficha completa
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      {canEdit && (
                        <>
                          <Button 
                            className="flex-1" 
                            variant="default"
                            onClick={() => openAdvancesDialog(worker.name)}
                          >
                            <Wallet className="mr-2 h-4 w-4" />
                            Vales
                          </Button>
                          <Button 
                            className="flex-1" 
                            variant="secondary"
                            onClick={() => {
                              setSelectedWorkerNotinhas(worker.name);
                              setNotinhasDialog(true);
                            }}
                          >
                            <Receipt className="mr-2 h-4 w-4" />
                            Notinhas
                          </Button>
                        </>
                      )}
                    </div>
                    {canEdit && (
                      <>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            className="flex-1" 
                            variant="outline"
                            onClick={() => openExpenseAdvancesDialog(worker.name)}
                          >
                            <Wallet className="mr-2 h-4 w-4" />
                            Adiant. Notinhas
                          </Button>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            className="flex-1" 
                            variant="secondary"
                            onClick={() => {
                              setSelectedWorkerFoodAllowance(worker.name);
                              setFoodAllowanceDialog(true);
                            }}
                          >
                            <UtensilsCrossed className="mr-2 h-4 w-4" />
                            Alimentação
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Dialog */}
      <Dialog open={calendarDialog} onOpenChange={setCalendarDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Calendário - {selectedWorker}</DialogTitle>
            <DialogDescription>Clique em um dia para adicionar ou editar a diária</DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}
              >
                Mês Anterior
              </Button>
              <h3 className="text-lg font-semibold min-w-[200px] text-center">
                {format(selectedMonth, 'MMMM yyyy', { locale: ptBR })}
              </h3>
              <Button
                variant="outline"
                onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}
              >
                Próximo Mês
              </Button>
            </div>

            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={(date) => {
                if (date && canEdit) {
                  openDayDialog(date);
                }
              }}
              month={selectedMonth}
              onMonthChange={setSelectedMonth}
              locale={ptBR}
              modifiers={{
                worked: selectedWorker ? getWorkedDays(selectedWorker, selectedMonth) : []
              }}
              modifiersStyles={{
                worked: {
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontWeight: 'bold'
                }
              }}
              modifiersClassNames={{
                worked: 'cursor-pointer',
                day: 'cursor-pointer hover:bg-accent'
              }}
              disabled={!canEdit}
              className="pointer-events-auto"
            />

            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-primary"></div>
                <span>Dias trabalhados</span>
              </div>
              {canEdit && (
                <p className="text-xs">Clique em qualquer dia para adicionar ou editar</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Details Dialog */}
      <Dialog open={dayDialog} onOpenChange={setDayDialog}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDayRate ? 'Editar' : 'Adicionar'} Diária
            </DialogTitle>
            <DialogDescription>
              {selectedWorker} - {selectedDate && format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event_filter">Filtrar Eventos por Mês</Label>
              <Select 
                value={eventFilterMonth.toString()} 
                onValueChange={(value) => setEventFilterMonth(value === 'all' ? 'all' : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {months.map((month, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_id">Evento</Label>
              <Select 
                value={dayFormData.event_id} 
                onValueChange={(value) => setDayFormData({ ...dayFormData, event_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum evento</SelectItem>
                  {getFilteredEvents().map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor da Diária *</Label>
              <CurrencyInput
                id="amount"
                value={dayFormData.amount}
                onChange={(value) => setDayFormData({ ...dayFormData, amount: value })}
                placeholder="R$ 0,00"
              />
            </div>

            <DailyRateOperationsFields
              value={dayOps}
              onChange={setDayOps}
              canEditFinancials={canViewFinancials(userRole)}
            />

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={dayFormData.notes}
                onChange={(e) => setDayFormData({ ...dayFormData, notes: e.target.value })}
                placeholder="Anotações sobre o dia de trabalho"
                rows={3}
              />
            </div>

            {dayConflicts.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {dayConflicts.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {selectedDayRate && canViewFinancials(userRole) && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Pagamento</span>
                  <Badge variant="outline">
                    {PAYMENT_STATUS_LABELS[
                      (((selectedDayRate as DailyRate & { payment_status?: string }).payment_status ??
                        'pendente') as PaymentStatus)
                    ]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Líquido estimado:{' '}
                  {formatCurrency(
                    buildPaymentMemo({ amount: dayFormData.amount, ...dayOps }).breakdown.net
                  )}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const rate = selectedDayRate as DailyRate & Record<string, unknown>;
                    setPaymentRate({
                      id: rate.id,
                      worker_name: rate.worker_name,
                      date: rate.date,
                      event_id: rate.event_id,
                      event_name: rate.events?.name ?? null,
                      amount: dayFormData.amount,
                      overtime_amount: dayOps.overtime_amount,
                      food_amount: dayOps.food_amount,
                      transport_amount: dayOps.transport_amount,
                      lodging_amount: dayOps.lodging_amount,
                      discount_amount: dayOps.discount_amount,
                      attendance_status: dayOps.attendance_status,
                      payment_status: (rate.payment_status as string) ?? 'pendente',
                      payment_method: (rate.payment_method as string) ?? null,
                      receipt_url: (rate.receipt_url as string) ?? null,
                      bank_account_id: (rate.bank_account_id as string) ?? null,
                    });
                  }}
                >
                  <Wallet className="h-4 w-4 mr-2" aria-hidden="true" />
                  Registrar pagamento
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveDay} className="flex-1">
                {selectedDayRate ? 'Atualizar' : 'Salvar'}
              </Button>
              {selectedDayRate && canEdit && (
                <Button onClick={handleDeleteDay} variant="destructive" aria-label="Excluir diária">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advances Dialog */}
      <Dialog open={advancesDialog} onOpenChange={setAdvancesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vales - {selectedWorkerAdvances}</DialogTitle>
            <DialogDescription>Gerencie os vales dados ao diarista</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {canEdit && (
              <Dialog open={addAdvanceDialog} onOpenChange={setAddAdvanceDialog}>
                <Button onClick={() => setAddAdvanceDialog(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Vale
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Vale</DialogTitle>
                    <DialogDescription>Registre um novo vale para o diarista</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="advance_amount">Valor do Vale *</Label>
                      <CurrencyInput
                        id="advance_amount"
                        value={advanceFormData.amount}
                        onChange={(value) => setAdvanceFormData({ ...advanceFormData, amount: value })}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance_date">Data do Vale *</Label>
                      <Input
                        id="advance_date"
                        type="date"
                        value={advanceFormData.advance_date}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, advance_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance_bank">Conta Bancária *</Label>
                      <Select
                        value={advanceFormData.bank_account_id}
                        onValueChange={(value) => setAdvanceFormData({ ...advanceFormData, bank_account_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="advance_notes">Observações</Label>
                      <Textarea
                        id="advance_notes"
                        value={advanceFormData.notes}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                        placeholder="Observações sobre o vale..."
                        rows={3}
                      />
                    </div>

                    <Button onClick={handleAddAdvance} className="w-full">
                      Adicionar Vale
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {advances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum vale registrado</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEdit && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={advanceSelection.isAllSelected}
                              onCheckedChange={() => advanceSelection.toggleSelectAll()}
                            />
                          </TableHead>
                        )}
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Conta Bancária</TableHead>
                        <TableHead>Observações</TableHead>
                        {canEdit && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advances.map((advance) => (
                        <TableRow key={advance.id}>
                          {canEdit && (
                            <TableCell>
                              <Checkbox
                                checked={advanceSelection.isSelected(advance.id)}
                                onCheckedChange={() => advanceSelection.toggleSelection(advance.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {canViewValues ? formatValue(advance.amount) : '---'}
                          </TableCell>
                          <TableCell>
                            {advance.bank_accounts?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {advance.notes || '-'}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAdvance(advance.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {canEdit && (
                  <BulkActionsBar
                    selectedCount={advanceSelection.selectedCount}
                    onDelete={handleBulkDeleteAdvances}
                    onCancel={advanceSelection.clearSelection}
                    isDeleting={isDeletingBulkAdvances}
                  />
                )}
              </>
            )}

            {canViewValues && advances.length > 0 && (
              <div className="p-4 bg-muted rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total de Vales:</span>
                  <span className="text-lg font-bold">
                    {formatValue(advances.reduce((sum, adv) => sum + adv.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Advances Dialog */}
      <Dialog open={expenseAdvancesDialog} onOpenChange={setExpenseAdvancesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adiantamentos para Notinhas - {selectedWorkerExpenseAdvances}</DialogTitle>
            <DialogDescription>Registre o dinheiro enviado para o diarista fazer despesas de notinhas</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {canEdit && (
              <Dialog open={addExpenseAdvanceDialog} onOpenChange={setAddExpenseAdvanceDialog}>
                <Button onClick={() => setAddExpenseAdvanceDialog(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Adiantamento
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Adiantamento para Notinhas</DialogTitle>
                    <DialogDescription>Registre o valor enviado para o diarista fazer despesas</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="expense_advance_amount">Valor do Adiantamento *</Label>
                      <CurrencyInput
                        id="expense_advance_amount"
                        value={expenseAdvanceFormData.amount}
                        onChange={(value) => setExpenseAdvanceFormData({ ...expenseAdvanceFormData, amount: value })}
                        placeholder="R$ 0,00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense_advance_date">Data do Adiantamento *</Label>
                      <Input
                        id="expense_advance_date"
                        type="date"
                        value={expenseAdvanceFormData.advance_date}
                        onChange={(e) => setExpenseAdvanceFormData({ ...expenseAdvanceFormData, advance_date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense_advance_bank">Conta Bancária *</Label>
                      <Select
                        value={expenseAdvanceFormData.bank_account_id}
                        onValueChange={(value) => setExpenseAdvanceFormData({ ...expenseAdvanceFormData, bank_account_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense_advance_notes">Observações</Label>
                      <Textarea
                        id="expense_advance_notes"
                        value={expenseAdvanceFormData.notes}
                        onChange={(e) => setExpenseAdvanceFormData({ ...expenseAdvanceFormData, notes: e.target.value })}
                        placeholder="Observações sobre o adiantamento..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expense_advance_receipt">Comprovante</Label>
                      <Input
                        id="expense_advance_receipt"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast({
                                title: "Arquivo muito grande",
                                description: "O comprovante deve ter no máximo 10MB.",
                                variant: "destructive"
                              });
                              e.target.value = '';
                              return;
                            }
                            setExpenseAdvanceFormData({ ...expenseAdvanceFormData, receipt_file: file });
                          }
                        }}
                      />
                      {expenseAdvanceFormData.receipt_file && (
                        <p className="text-sm text-muted-foreground">
                          Arquivo selecionado: {expenseAdvanceFormData.receipt_file.name}
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={handleAddExpenseAdvance} 
                      className="w-full"
                      disabled={uploadingExpenseAdvanceReceipt}
                    >
                      {uploadingExpenseAdvanceReceipt ? 'Enviando...' : 'Adicionar Adiantamento'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {expenseAdvances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum adiantamento registrado</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canEdit && (
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={expenseAdvanceSelection.isAllSelected}
                              onCheckedChange={() => expenseAdvanceSelection.toggleSelectAll()}
                            />
                          </TableHead>
                        )}
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Conta Bancária</TableHead>
                        <TableHead>Observações</TableHead>
                        <TableHead>Comprovante</TableHead>
                        {canEdit && <TableHead className="text-right">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseAdvances.map((advance) => (
                        <TableRow key={advance.id}>
                          {canEdit && (
                            <TableCell>
                              <Checkbox
                                checked={expenseAdvanceSelection.isSelected(advance.id)}
                                onCheckedChange={() => expenseAdvanceSelection.toggleSelection(advance.id)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {canViewValues ? formatValue(advance.amount) : '---'}
                          </TableCell>
                          <TableCell>
                            {advance.bank_accounts?.name || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {advance.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {advance.receipt_url ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void openReceipt(advance.receipt_url)}
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteExpenseAdvance(advance.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {canEdit && (
                  <BulkActionsBar
                    selectedCount={expenseAdvanceSelection.selectedCount}
                    onDelete={handleBulkDeleteExpenseAdvances}
                    onCancel={expenseAdvanceSelection.clearSelection}
                    isDeleting={isDeletingBulkExpenseAdvances}
                  />
                )}
              </>
            )}

            {canViewValues && expenseAdvances.length > 0 && (
              <div className="p-4 bg-muted rounded-md">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total de Adiantamentos:</span>
                  <span className="text-lg font-bold">
                    {formatValue(expenseAdvances.reduce((sum, adv) => sum + adv.amount, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório - {viewWorker}</DialogTitle>
            <DialogDescription>
              Visualize os dias trabalhados e vales do diarista agrupados por mês
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Date Filter */}
            <div className="flex flex-wrap gap-4 p-4 bg-muted rounded-lg">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filterStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterStartDate ? format(filterStartDate, 'dd/MM/yyyy', { locale: ptBR }) : "Selecione a data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterStartDate || undefined}
                      onSelect={(date) => setFilterStartDate(date || null)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1 min-w-[200px] space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filterEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filterEndDate ? format(filterEndDate, 'dd/MM/yyyy', { locale: ptBR }) : "Selecione a data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterEndDate || undefined}
                      onSelect={(date) => setFilterEndDate(date || null)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilterStartDate(null);
                    setFilterEndDate(null);
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                onClick={handlePayAll}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Pagar e Finalizar Tudo
              </Button>
              <Button onClick={generatePDF}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
            </div>

            {/* Dias Trabalhados por Mês */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dias Trabalhados por Mês</h3>
              {Object.keys(getWorkedDaysByMonth()).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dia trabalhado encontrado
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(getWorkedDaysByMonth())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([monthYear, rates]) => {
                      const [year, month] = monthYear.split('-');
                      const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                      const monthTotal = rates.reduce((sum, rate) => sum + rate.amount, 0);
                      
                      return (
                        <Card key={monthYear}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <CardTitle className="text-base">
                                {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
                              </CardTitle>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  {rates.length} {rates.length === 1 ? 'dia' : 'dias'}
                                </span>
                                {canViewValues && (
                                  <span className="font-semibold">
                                    {formatValue(monthTotal)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                 <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Observações</TableHead>
                                    {canEdit && <TableHead className="text-center">Status</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rates.map((rate) => (
                                    <TableRow key={rate.id} className={rate.is_finalized ? 'opacity-60' : ''}>
                                      <TableCell>
                                        {format(new Date(rate.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                      </TableCell>
                                      <TableCell>{rate.events?.name || 'Sem evento'}</TableCell>
                                      <TableCell>{canViewValues ? formatValue(rate.amount) : '••••'}</TableCell>
                                      <TableCell className="text-muted-foreground">{rate.notes || '-'}</TableCell>
                                      {canEdit && (
                                        <TableCell className="text-center">
                                          <Button
                                            variant={rate.is_finalized ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => handleToggleFinalized(rate.id, !rate.is_finalized)}
                                            disabled={rate.is_finalized}
                                          >
                                            {rate.is_finalized ? '✓ Finalizado' : 'OK'}
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Vales por Mês */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">Vales (Adiantamentos) por Mês</h3>
              {Object.keys(getAdvancesByMonth()).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum vale registrado
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(getAdvancesByMonth())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([monthYear, monthAdvances]) => {
                      const [year, month] = monthYear.split('-');
                      const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                      const monthTotal = monthAdvances.reduce((sum, adv) => sum + adv.amount, 0);
                      
                      return (
                        <Card key={monthYear}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <CardTitle className="text-base">
                                {format(monthDate, 'MMMM yyyy', { locale: ptBR })}
                              </CardTitle>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-muted-foreground">
                                  {monthAdvances.length} {monthAdvances.length === 1 ? 'vale' : 'vales'}
                                </span>
                                {canViewValues && (
                                  <span className="font-semibold text-destructive">
                                    {formatValue(monthTotal)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                 <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Banco</TableHead>
                                    <TableHead>Observações</TableHead>
                                    {canEdit && <TableHead className="text-center">Status</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {monthAdvances.map((advance) => (
                                    <TableRow key={advance.id} className={advance.is_finalized ? 'opacity-60' : ''}>
                                      <TableCell>
                                        {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                      </TableCell>
                                      <TableCell className="font-semibold text-destructive">
                                        {canViewValues ? formatValue(advance.amount) : '••••'}
                                      </TableCell>
                                      <TableCell>{advance.bank_accounts?.name || '-'}</TableCell>
                                      <TableCell className="text-muted-foreground">{advance.notes || '-'}</TableCell>
                                      {canEdit && (
                                        <TableCell className="text-center">
                                          <Button
                                            variant={advance.is_finalized ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => handleToggleAdvanceFinalized(advance.id, !advance.is_finalized)}
                                            disabled={advance.is_finalized}
                                          >
                                            {advance.is_finalized ? '✓ Finalizado' : 'OK'}
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Notinhas (Despesas) por Mês */}
            {Object.keys(getExpensesByMonth()).length > 0 && (
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Notinhas (Despesas)
                  </h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Categoria:</Label>
                    <Select value={notinhasCategoryFilter} onValueChange={setNotinhasCategoryFilter}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        <SelectItem value="all">Todas as categorias</SelectItem>
                        {NOTINHA_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        <SelectItem value="Sem categoria">Sem categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  {Object.entries(getExpensesByMonth())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([monthYear, expenses]) => {
                      const [year, month] = monthYear.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                      const monthName = format(date, 'MMMM yyyy', { locale: ptBR });
                      const extractCategory = (exp: any) => {
                        if (exp?.category && exp.category !== 'Despesas de Diaristas') return exp.category;
                        const m = exp?.description?.match(/\[([^\]]+)\]/);
                        return m ? m[1] : (exp?.category || 'Sem categoria');
                      };
                      const stripCategory = (desc: string) => (desc || '').replace(/\s*\[[^\]]+\]\s*/, ' ').trim();
                      const filteredExpenses = expenses.filter((exp) => {
                        if (notinhasCategoryFilter === 'all') return true;
                        return extractCategory(exp) === notinhasCategoryFilter;
                      });
                      if (filteredExpenses.length === 0) return null;
                      const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

                      return (
                        <Card key={monthYear}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <CardTitle className="text-base capitalize">{monthName}</CardTitle>
                              {canViewValues && (
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  Total: {formatValue(totalExpenses)}
                                </span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                 <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Categoria</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Descrição</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Comprovante</TableHead>
                                    {canEdit && <TableHead className="text-center">Status</TableHead>}
                                    {canEdit && <TableHead className="text-right">Ações</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredExpenses.map((expense) => (
                                    <TableRow key={expense.id} className={expense.is_finalized ? 'opacity-60' : ''}>
                                      <TableCell className="text-muted-foreground">
                                        {format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                      </TableCell>
                                      <TableCell>
                                        <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                          {extractCategory(expense)}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {expense.events?.name || 'Galpão'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {stripCategory(expense.description.replace(`${viewWorker} - `, ''))}
                                      </TableCell>
                                      <TableCell className="font-semibold text-green-600 dark:text-green-400">
                                        {canViewValues ? formatValue(expense.amount) : '***'}
                                      </TableCell>
                                      <TableCell>
                                        {expense.receipt_url ? (
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => void openReceipt(expense.receipt_url)}
                                          >
                                            <ImageIcon className="h-4 w-4" />
                                          </Button>
                                        ) : (
                                          <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                      </TableCell>
                                      {canEdit && (
                                        <TableCell className="text-center">
                                          <Button
                                            variant={expense.is_finalized ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => handleToggleExpenseFinalized(expense.id, !expense.is_finalized)}
                                            disabled={expense.is_finalized}
                                          >
                                            {expense.is_finalized ? '✓ Finalizado' : 'OK'}
                                          </Button>
                                        </TableCell>
                                      )}
                                      {canEdit && (
                                        <TableCell className="text-right">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteNotinha(expense.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Adiantamentos para Notinhas por Mês */}
            {Object.keys(getExpenseAdvancesByMonth()).length > 0 && (
              <div className="space-y-4 mt-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Adiantamentos para Notinhas
                </h3>
                <div className="space-y-4">
                  {Object.entries(getExpenseAdvancesByMonth())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([monthYear, advances]) => {
                      const [year, month] = monthYear.split('-');
                      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                      const monthName = format(date, 'MMMM yyyy', { locale: ptBR });
                      const totalAdvances = advances.reduce((sum, adv) => sum + adv.amount, 0);

                      return (
                        <Card key={monthYear}>
                          <CardHeader className="pb-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <CardTitle className="text-base capitalize">{monthName}</CardTitle>
                              {canViewValues && (
                                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                                  Total: {formatValue(totalAdvances)}
                                </span>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                 <TableHeader>
                                  <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Banco</TableHead>
                                    <TableHead>Observações</TableHead>
                                    {canEdit && <TableHead className="text-center">Status</TableHead>}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {advances.map((advance) => (
                                    <TableRow key={advance.id} className={advance.is_finalized ? 'opacity-60' : ''}>
                                      <TableCell className="text-muted-foreground">
                                        {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                      </TableCell>
                                      <TableCell className="font-semibold text-orange-600 dark:text-orange-400">
                                        {canViewValues ? formatValue(advance.amount) : '***'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {advance.bank_accounts?.name || '-'}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground">
                                        {advance.notes || '-'}
                                      </TableCell>
                                      {canEdit && (
                                        <TableCell className="text-center">
                                          <Button
                                            variant={advance.is_finalized ? "outline" : "default"}
                                            size="sm"
                                            onClick={() => handleToggleExpenseAdvanceFinalized(advance.id, !advance.is_finalized)}
                                            disabled={advance.is_finalized}
                                          >
                                            {advance.is_finalized ? '✓ Finalizado' : 'OK'}
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Total Geral */}
            {canViewValues && Object.keys(getWorkedDaysByMonth()).length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                  <span className="font-semibold">Total em Diárias:</span>
                  <span className="text-lg font-bold">
                    {formatValue(
                      Object.values(getWorkedDaysByMonth())
                        .flat()
                        .reduce((sum, rate) => sum + rate.amount, 0)
                    )}
                  </span>
                </div>
                
                {Object.keys(getAdvancesByMonth()).length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="font-semibold">Total em Vales:</span>
                    <span className="text-lg font-bold text-destructive">
                      {formatValue(
                        Object.values(getAdvancesByMonth())
                          .flat()
                          .reduce((sum, advance) => sum + advance.amount, 0)
                      )}
                    </span>
                  </div>
                )}

                {Object.keys(getExpensesByMonth()).length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-lg border border-green-500">
                    <span className="font-semibold">Total em Notinhas (Reembolso):</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      + {formatValue(
                        Object.values(getExpensesByMonth())
                          .flat()
                          .reduce((sum, expense) => sum + expense.amount, 0)
                      )}
                    </span>
                  </div>
                )}
                
                {Object.keys(getExpenseAdvancesByMonth()).length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg border border-orange-500">
                    <span className="font-semibold">Total Adiantado para Notinhas:</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      - {formatValue(
                        Object.values(getExpenseAdvancesByMonth())
                          .flat()
                          .reduce((sum, advance) => sum + advance.amount, 0)
                      )}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-end items-center gap-4 p-4 bg-primary/10 rounded-lg border-2 border-primary">
                  <span className="text-lg font-semibold">Total Líquido a Receber:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatValue(
                      Object.values(getWorkedDaysByMonth())
                        .flat()
                        .reduce((sum, rate) => sum + rate.amount, 0) +
                      Object.values(getExpensesByMonth())
                        .flat()
                        .reduce((sum, expense) => sum + expense.amount, 0) -
                      Object.values(getAdvancesByMonth())
                        .flat()
                        .reduce((sum, advance) => sum + advance.amount, 0) -
                      Object.values(getExpenseAdvancesByMonth())
                        .flat()
                        .reduce((sum, advance) => sum + advance.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notinhas Dialog */}
      <Dialog open={notinhasDialog} onOpenChange={setNotinhasDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notinhas - {selectedWorkerNotinhas}</DialogTitle>
            <DialogDescription>
              Adicione despesas de evento com comprovante
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Despesa *</Label>
              <RadioGroup
                value={notinhaFormData.expense_type}
                onValueChange={(value: 'evento' | 'galpao') => 
                  setNotinhaFormData({ ...notinhaFormData, expense_type: value, event_id: value === 'galpao' ? '' : notinhaFormData.event_id })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="evento" id="tipo-evento" />
                  <Label htmlFor="tipo-evento" className="font-normal cursor-pointer">Evento</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="galpao" id="tipo-galpao" />
                  <Label htmlFor="tipo-galpao" className="font-normal cursor-pointer">Galpão</Label>
                </div>
              </RadioGroup>
            </div>

            {notinhaFormData.expense_type === 'evento' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="notinha_event_filter">Filtrar Eventos por Mês</Label>
                  <Select 
                    value={notinhasEventFilterMonth.toString()} 
                    onValueChange={(value) => setNotinhasEventFilterMonth(value === 'all' ? 'all' : parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os meses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {months.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notinha_event">Evento *</Label>
                  <Select
                    value={notinhaFormData.event_id}
                    onValueChange={(value) => setNotinhaFormData({ ...notinhaFormData, event_id: value })}
                  >
                    <SelectTrigger id="notinha_event">
                      <SelectValue placeholder="Selecione o evento" />
                    </SelectTrigger>
                    <SelectContent>
                      {events
                        .filter(event => {
                          if (notinhasEventFilterMonth === 'all') return true;
                          const eventDate = new Date(event.event_date + 'T12:00:00');
                          return eventDate.getMonth() === notinhasEventFilterMonth;
                        })
                        .map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} - {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notinha_category">Categoria *</Label>
              <Select
                value={notinhaFormData.category}
                onValueChange={(value) => setNotinhaFormData({ ...notinhaFormData, category: value })}
              >
                <SelectTrigger id="notinha_category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {NOTINHA_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notinha_amount">Valor Gasto *</Label>
              <CurrencyInput
                id="notinha_amount"
                value={notinhaFormData.amount}
                onChange={(value) => setNotinhaFormData({ ...notinhaFormData, amount: value })}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notinha_description">Descrição do Gasto *</Label>
              <Textarea
                id="notinha_description"
                value={notinhaFormData.description}
                onChange={(e) => setNotinhaFormData({ ...notinhaFormData, description: e.target.value })}
                placeholder="Descreva o gasto realizado..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notinha_date">Data do Gasto *</Label>
              <Input
                id="notinha_date"
                type="date"
                value={notinhaFormData.expense_date}
                onChange={(e) => setNotinhaFormData({ ...notinhaFormData, expense_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notinha_receipt">Upload da Notinha</Label>
              <div className="flex flex-col gap-2">
                {notinhaFormData.receipt_file ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">
                      {notinhaFormData.receipt_file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setNotinhaFormData({ ...notinhaFormData, receipt_file: null })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center w-full">
                    <label
                      htmlFor="notinha_receipt"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Clique para fazer upload da notinha
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, PDF até 5MB
                        </p>
                      </div>
                      <Input
                        id="notinha_receipt"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                title: "Arquivo muito grande",
                                description: "O arquivo deve ter no máximo 5MB.",
                                variant: "destructive"
                              });
                              return;
                            }
                            setNotinhaFormData({ ...notinhaFormData, receipt_file: file });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <Button 
              onClick={async () => {
                if (!selectedWorkerNotinhas || !user?.id) return;
                
                // Validate based on expense type
                const eventIdRequired = notinhaFormData.expense_type === 'evento';
                if ((eventIdRequired && !notinhaFormData.event_id) || notinhaFormData.amount <= 0 || !notinhaFormData.description.trim()) {
                  toast({
                    title: "Campos obrigatórios",
                    description: eventIdRequired 
                      ? "Preencha todos os campos obrigatórios incluindo o evento" 
                      : "Preencha o valor e a descrição do gasto",
                    variant: "destructive"
                  });
                  return;
                }

                // Buscar a conta bancária do último adiantamento do diarista (apenas para gastos de galpão)
                let lastAdvance = null;
                if (notinhaFormData.expense_type === 'galpao') {
                  const { data, error: advanceError } = await supabase
                    .from('worker_expense_advances')
                    .select('bank_account_id, bank_accounts(name)')
                    .eq('worker_name', selectedWorkerNotinhas)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                  if (advanceError || !data?.bank_account_id) {
                    toast({
                      title: "Erro",
                      description: "Não foi possível encontrar o adiantamento com conta bancária associada",
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  lastAdvance = data;
                }

                try {
                  setUploadingReceipt(true);
                  let receiptUrl: string | null = null;

                  // Upload receipt if provided with PDF to image conversion
                  if (notinhaFormData.receipt_file) {
                    let uploadFile = notinhaFormData.receipt_file;
                    let fileExt = notinhaFormData.receipt_file.name.split('.').pop()?.toLowerCase();

                    // Check if it's a PDF and convert to image
                    if (fileExt === 'pdf') {
                      toast({
                        title: "Processando PDF",
                        description: "Convertendo PDF para imagem..."
                      });

                      try {
                        const arrayBuffer = await notinhaFormData.receipt_file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                        const page = await pdf.getPage(1);

                        const viewport = page.getViewport({ scale: 2.0 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');

                        if (!context) {
                          throw new Error('Could not get canvas context');
                        }

                        canvas.width = viewport.width;
                        canvas.height = viewport.height;

                        await page.render({
                          canvasContext: context,
                          viewport: viewport,
                          canvas: canvas as any
                        }).promise;

                        const blob = await new Promise<Blob>((resolveBlob) => {
                          canvas.toBlob((blob) => {
                            if (blob) resolveBlob(blob);
                          }, 'image/jpeg', 0.95);
                        });

                        uploadFile = new File([blob], notinhaFormData.receipt_file.name.replace('.pdf', '.jpg'), { type: 'image/jpeg' });
                        fileExt = 'jpg';
                      } catch (pdfError) {
                        console.error('Error converting PDF:', pdfError);
                        throw new Error('Erro ao converter PDF para imagem');
                      }
                    }

                    const validation = validateReceiptUpload(uploadFile);
                    if (!validation.ok) {
                      throw new Error(validation.error);
                    }

                    const filePath = buildReceiptPath(user.id, `f.${fileExt}`);

                    const { error: uploadError } = await supabase.storage
                      .from('worker-receipts')
                      .upload(filePath, uploadFile, { contentType: uploadFile.type });

                    if (uploadError) throw uploadError;

                    // Bucket privado: guardamos o caminho e assinamos ao exibir.
                    receiptUrl = filePath;

                    if (fileExt === 'jpg' && notinhaFormData.receipt_file.name.endsWith('.pdf')) {
                      toast({
                        title: "PDF convertido",
                        description: "PDF convertido e enviado como imagem"
                      });
                    }
                  } else if (pendingWhatsAppReceiptUrl) {
                    // Se não houver novo arquivo mas houver URL do WhatsApp, usar ela
                    receiptUrl = pendingWhatsAppReceiptUrl;
                  }

                  // Insert expense
                  const { error } = await supabase
                    .from('event_expenses')
                    .insert({
                      event_id: notinhaFormData.expense_type === 'galpao' ? null : notinhaFormData.event_id,
                      category: notinhaFormData.category || 'Outros',
                      description: `${selectedWorkerNotinhas} - ${notinhaFormData.description}`,
                      quantity: 1,
                      unit_price: notinhaFormData.amount,
                      total_price: notinhaFormData.amount,
                      expense_date: notinhaFormData.expense_date,
                      expense_bank_account: notinhaFormData.expense_type === 'galpao' ? (lastAdvance?.bank_accounts as any)?.name : null,
                      receipt_url: receiptUrl,
                      created_by: user.id
                    });

                  if (error) throw error;

                  toast({
                    title: "Sucesso",
                    description: "Notinha adicionada com sucesso"
                  });

                  setNotinhasDialog(false);
                  setPendingWhatsAppReceiptUrl(null);
                  setNotinhaFormData({
                    expense_type: 'evento',
                    event_id: '',
                    category: 'Outros',
                    amount: 0,
                    description: '',
                    expense_date: format(new Date(), 'yyyy-MM-dd'),
                    receipt_file: null
                  });
                } catch (error: any) {
                  console.error('Error adding notinha:', error);
                  toast({
                    title: "Erro",
                    description: error.message || "Erro ao adicionar notinha",
                    variant: "destructive"
                  });
                } finally {
                  setUploadingReceipt(false);
                }
              }}
              className="w-full"
              disabled={uploadingReceipt}
            >
              {uploadingReceipt ? 'Salvando...' : 'Adicionar Notinha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advances (Vales) Dialog */}
      <Dialog open={advancesDialog} onOpenChange={setAdvancesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Vales - {selectedWorkerAdvances}</DialogTitle>
            <DialogDescription>
              Gerencie os vales (adiantamentos) dados ao diarista
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {canEdit && (
              <Dialog open={addAdvanceDialog} onOpenChange={setAddAdvanceDialog}>
                <Button onClick={() => setAddAdvanceDialog(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Vale
                </Button>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Vale</DialogTitle>
                    <DialogDescription>
                      Registre um novo vale para {selectedWorkerAdvances}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="advance_amount">Valor *</Label>
                      <CurrencyInput
                        id="advance_amount"
                        value={advanceFormData.amount}
                        onChange={(value) => setAdvanceFormData({ ...advanceFormData, amount: value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advance_date">Data *</Label>
                      <Input
                        id="advance_date"
                        type="date"
                        value={advanceFormData.advance_date}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, advance_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advance_bank">Conta Bancária *</Label>
                      <Select 
                        value={advanceFormData.bank_account_id}
                        onValueChange={(value) => setAdvanceFormData({ ...advanceFormData, bank_account_id: value })}
                      >
                        <SelectTrigger id="advance_bank">
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name} - {formatValue(account.balance)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advance_notes">Observações</Label>
                      <Textarea
                        id="advance_notes"
                        value={advanceFormData.notes}
                        onChange={(e) => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                        placeholder="Observações adicionais (opcional)"
                      />
                    </div>
                    <Button onClick={handleAddAdvance} className="w-full">
                      Adicionar Vale
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Observações</TableHead>
                      {canEdit && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 5 : 4} className="text-center text-muted-foreground py-8">
                          Nenhum vale registrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      advances.map((advance) => (
                        <TableRow key={advance.id}>
                          <TableCell>
                            {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {canViewValues ? formatValue(advance.amount) : '••••'}
                          </TableCell>
                          <TableCell>{advance.bank_accounts?.name || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{advance.notes || '-'}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteAdvance(advance.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {canViewValues && advances.length > 0 && (
              <div className="flex justify-end items-center gap-4 p-4 bg-muted rounded-lg">
                <span className="font-semibold">Total em Vales:</span>
                <span className="text-lg font-bold">
                  {formatValue(advances.reduce((sum, advance) => sum + advance.amount, 0))}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Viewer Dialog */}
      <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Visualizar Comprovante</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {receiptUrl && (
              <img 
                src={receiptUrl} 
                alt="Comprovante" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Selecione a conta bancária para debitar o valor do pagamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Diarista:</p>
                <p className="font-semibold">{viewWorker}</p>
              </div>
              <div className="space-y-2 mt-4">
                <p className="text-sm text-muted-foreground">Total Líquido a Pagar:</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalLiquidoToPay)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-account">Conta Bancária</Label>
              <Select
                value={selectedBankAccountForPayment}
                onValueChange={setSelectedBankAccountForPayment}
              >
                <SelectTrigger id="bank-account">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} - Saldo: {formatCurrency(account.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Esta ação irá:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Finalizar todas as diárias</li>
                  <li>Finalizar todos os vales</li>
                  <li>Finalizar todos os adiantamentos</li>
                  <li>Finalizar todas as despesas (notinhas)</li>
                  <li>Debitar {formatCurrency(totalLiquidoToPay)} da conta selecionada</li>
                </ul>
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPaymentDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={processPayment}
                disabled={!selectedBankAccountForPayment}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Worker Food Allowance Calendar */}
      {selectedWorkerFoodAllowance && (
        <WorkerFoodAllowanceCalendar
          workerName={selectedWorkerFoodAllowance}
          open={foodAllowanceDialog}
          onOpenChange={(open) => {
            setFoodAllowanceDialog(open);
            if (!open) setSelectedWorkerFoodAllowance(null);
          }}
          selectedMonth={selectedMonthFilter}
          selectedYear={selectedYear}
          canEdit={canEdit}
        />
      )}

      <WorkerAvailabilityBoard
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        initialWorkerName={selectedWorker}
      />

      <DailyRateReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} />

      <DailyRatePaymentDialog
        open={!!paymentRate}
        onOpenChange={(open) => !open && setPaymentRate(null)}
        rate={paymentRate}
        onPaid={() => {
          setPaymentRate(null);
          setDayDialog(false);
          fetchDailyRates();
        }}
      />

      <PersonProfileDialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) setProfileWorkerName(null);
        }}
        personType="worker"
        personName={profileWorkerName}
      />
    </div>
  );
};
