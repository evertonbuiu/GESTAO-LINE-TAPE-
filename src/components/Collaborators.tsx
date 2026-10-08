import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { IdCard } from 'lucide-react';
import { PersonProfileDialog } from '@/components/people/PersonProfileDialog';
import { canViewSensitiveData, maskSensitive } from '@/lib/people';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, User, Eye, Download, Wallet, Calendar as CalendarIcon, DollarSign, Receipt, ImageIcon, Upload, UtensilsCrossed } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { handlePhoneInput } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import { FoodAllowanceCalendar } from './FoodAllowanceCalendar';
import { buildReceiptPath, resolveReceiptDisplayUrl, validateReceiptUpload } from '@/lib/storageUrls';

interface CollaboratorPayment {
  id: string;
  collaborator_id: string;
  event_id: string | null;
  amount: number;
  payment_date: string;
  is_paid: boolean;
  bank_account_id: string | null;
  notes: string | null;
  events?: {
    name: string;
    event_date: string;
  };
  bank_accounts?: {
    name: string;
  };
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  pix_key: string | null;
  totalAmount: number;
  eventCount: number;
}

interface CollaboratorMonthlySalary {
  id: string;
  collaborator_id: string;
  salary_month: number;
  salary_year: number;
  salary_amount: number;
  is_paid?: boolean;
  payment_date?: string;
  bank_account_id?: string;
}

interface CollaboratorAdvance {
  id: string;
  collaborator_id: string;
  amount: number;
  advance_date: string;
  bank_account_id: string;
  notes: string | null;
  bank_accounts?: {
    name: string;
  };
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

interface CollaboratorExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  event_id: string;
  category?: string;
  created_at?: string;
  created_by?: string;
  expense_bank_account?: string;
  is_paid?: boolean;
  notes?: string;
  payment_bank_account?: string;
  payment_date?: string;
  quantity?: number;
  reference_id?: string;
  reference_type?: string;
  supplier?: string;
  total_price?: number;
  unit_price?: number;
  updated_at?: string;
  events?: {
    name: string;
  };
}

interface CollaboratorExpenseAdvance {
  id: string;
  collaborator_id: string;
  amount: number;
  advance_date: string;
  bank_account_id: string;
  notes: string | null;
  bank_accounts?: {
    name: string;
  };
}


export const Collaborators = () => {
  const { user, userRole } = useCustomAuth();
  const { toast } = useToast();
  const { canViewValues, formatValue } = useValueVisibility();
  const { settings: companySettings } = useCompanySettings();
  const { logoUrl } = useLogo();
  const [payments, setPayments] = useState<CollaboratorPayment[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  
  // Advances management
  const [advancesDialog, setAdvancesDialog] = useState(false);
  const [selectedCollaboratorAdvances, setSelectedCollaboratorAdvances] = useState<string | null>(null);
  const [advances, setAdvances] = useState<CollaboratorAdvance[]>([]);
  const [addAdvanceDialog, setAddAdvanceDialog] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    amount: 0,
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    bank_account_id: '',
    notes: ''
  });
  
  // Month/Year filter
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthFilter, setSelectedMonthFilter] = useState(new Date().getMonth());
  
  // Collaborator management
  const [addCollaboratorDialog, setAddCollaboratorDialog] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState({
    name: '',
    phone: '',
    pix_key: '',
    registerInAllMonths: false
  });
  
  // Event dialog for linking collaborators to events
  const [eventDialog, setEventDialog] = useState(false);
  const [selectedCollaboratorForEvent, setSelectedCollaboratorForEvent] = useState<Collaborator | null>(null);
  const [eventPayment, setEventPayment] = useState({
    event_id: '',
    amount: 0,
    notes: ''
  });
  const [eventFilterMonth, setEventFilterMonth] = useState(new Date().getMonth());
  const [eventFilterYear, setEventFilterYear] = useState(new Date().getFullYear());

  // View dialog
  const [viewDialog, setViewDialog] = useState(false);
  const [viewCollaborator, setViewCollaborator] = useState<Collaborator | null>(null);
  const [viewPayments, setViewPayments] = useState<CollaboratorPayment[]>([]);
  const [viewAdvances, setViewAdvances] = useState<CollaboratorAdvance[]>([]);
  const [viewExpenses, setViewExpenses] = useState<CollaboratorExpense[]>([]);
  const [viewExpenseAdvances, setViewExpenseAdvances] = useState<CollaboratorExpenseAdvance[]>([]);

  // Salary dialog
  const [salaryDialog, setSalaryDialog] = useState(false);
  const [selectedCollaboratorSalary, setSelectedCollaboratorSalary] = useState<Collaborator | null>(null);
  const [salaryAmount, setSalaryAmount] = useState(0);
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth());
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [monthlySalaries, setMonthlySalaries] = useState<CollaboratorMonthlySalary[]>([]);
  const [viewSalaryTotal, setViewSalaryTotal] = useState(0);
  const [viewSalaryPaid, setViewSalaryPaid] = useState(false);

  // Notinhas (Expenses) management
  const [notinhasDialog, setNotinhasDialog] = useState(false);
  const [selectedCollaboratorNotinhas, setSelectedCollaboratorNotinhas] = useState<Collaborator | null>(null);
  const [collaboratorExpenses, setCollaboratorExpenses] = useState<CollaboratorExpense[]>([]);
  const [notinhasEventFilterMonth, setNotinhasEventFilterMonth] = useState<number | 'all'>('all');
  const [notinhasDisplayMonth, setNotinhasDisplayMonth] = useState(new Date().getMonth());
  const NOTINHA_CATEGORIES = ['Alimentação', 'Transporte', 'Combustível', 'Materiais', 'Ferramentas', 'Hospedagem', 'Estacionamento', 'Pedágio', 'Outros'];
  const [notinhaFormData, setNotinhaFormData] = useState({
    expense_type: 'evento' as 'evento' | 'galpao',
    event_id: '',
    category: 'Outros',
    amount: 0,
    description: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    receipt_file: null as File | null
  });
  const [notinhasCategoryFilter, setNotinhasCategoryFilter] = useState<string>('all');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Expense Advances management
  const [expenseAdvancesDialog, setExpenseAdvancesDialog] = useState(false);
  const [selectedCollaboratorExpenseAdvances, setSelectedCollaboratorExpenseAdvances] = useState<Collaborator | null>(null);
  const [collaboratorExpenseAdvances, setCollaboratorExpenseAdvances] = useState<CollaboratorExpenseAdvance[]>([]);
  const [addExpenseAdvanceDialog, setAddExpenseAdvanceDialog] = useState(false);
  const [expenseAdvanceFormData, setExpenseAdvanceFormData] = useState({
    amount: 0,
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    bank_account_id: '',
    notes: ''
  });

  // Food Allowances management (using calendar component)
  const [foodAllowancesDialog, setFoodAllowancesDialog] = useState(false);
  const [selectedCollaboratorFoodAllowances, setSelectedCollaboratorFoodAllowances] = useState<Collaborator | null>(null);

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

  // WhatsApp pending receipt
  const [pendingWhatsAppReceiptUrl, setPendingWhatsAppReceiptUrl] = useState<string | null>(null);

  // Payment dialog
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    bank_account_id: '',
    notes: '',
    payment_date: format(new Date(), 'yyyy-MM-dd')
  });
  const [payItems, setPayItems] = useState({
    payments: true,
    expenses: true,
    salary: true,
  });

  const canEdit = userRole === 'admin' || userRole === 'financeiro';
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profilePerson, setProfilePerson] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    // Configure PDF.js worker - use the npm package version
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    
    fetchPayments();
    fetchEvents();
    fetchBankAccounts();
    fetchMonthlySalaries();
  }, []);

  useEffect(() => {
    calculateCollaborators();
  }, [payments, selectedMonthFilter, selectedYear]);

  // Resolve salary totals for the collaborator report/PDF.
  // Why: legacy imports saved salary_month with +1 offset; however the bank_transaction always has the correct transaction_date.
  // So for imported salaries we trust bank_transactions filtered by month; manual salaries still use salary_month/year.
  const getMonthDateRange = (year: number, month0: number) => {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month0 + 1, 0).getDate();
    const start = `${year}-${pad2(month0 + 1)}-01`;
    const end = `${year}-${pad2(month0 + 1)}-${pad2(lastDay)}`;
    return { start, end };
  };

  const resolveMonthlySalaryTotal = async (collaboratorId: string, month0: number, year: number): Promise<{ total: number; isPaid: boolean }> => {
    const { start, end } = getMonthDateRange(year, month0);

    // 1) Imported salaries: derive by month date from bank_transactions
    const { data: salaryTxs, error: txErr } = await supabase
      .from('bank_transactions')
      .select('reference_id')
      .eq('reference_type', 'collaborator_salary')
      .not('reference_id', 'is', null)
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (txErr) {
      console.error('Error fetching salary bank transactions:', txErr);
    }

    const importedIds = Array.from(
      new Set((salaryTxs || []).map((t: any) => t.reference_id).filter(Boolean))
    ) as string[];

    let importedTotal = 0;
    if (importedIds.length > 0) {
      const { data: salaryRows, error: salaryErr } = await supabase
        .from('collaborator_monthly_salaries')
        .select('id, salary_amount')
        .eq('collaborator_id', collaboratorId)
        .in('id', importedIds);

      if (salaryErr) {
        console.error('Error fetching imported salary rows:', salaryErr);
      }

      importedTotal = (salaryRows || []).reduce((sum: number, r: any) => sum + (Number(r.salary_amount) || 0), 0);
    }

    // 2) Manual salaries (no bank_transaction reference): use stored month/year but avoid double-counting imported rows
    const { data: monthRows, error: monthErr } = await supabase
      .from('collaborator_monthly_salaries')
      .select('id, salary_amount, is_paid')
      .eq('collaborator_id', collaboratorId)
      .eq('salary_year', year)
      .eq('salary_month', month0);

    if (monthErr) {
      console.error('Error fetching salary rows by month:', monthErr);
    }

    const importedIdSet = new Set(importedIds);
    const manualRows = (monthRows || []).filter((r: any) => !importedIdSet.has(r.id));
    const manualTotal = manualRows.reduce((sum: number, r: any) => sum + (Number(r.salary_amount) || 0), 0);

    // Check if salary is paid
    const isPaid = (monthRows || []).some((r: any) => r.is_paid === true);

    return { total: importedTotal + manualTotal, isPaid };
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!viewDialog || !viewCollaborator) return;
      const result = await resolveMonthlySalaryTotal(viewCollaborator.id, selectedMonthFilter, selectedYear);
      if (!cancelled) {
        setViewSalaryTotal(result.total);
        setViewSalaryPaid(result.isPaid);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [viewDialog, viewCollaborator?.id, selectedMonthFilter, selectedYear]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborator_payments')
        .select(`
          *,
          events (
            name,
            event_date
          ),
          bank_accounts (
            name
          )
        `)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Erro ao carregar pagamentos",
        description: "Não foi possível carregar os pagamentos.",
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
        .select('id, name, event_date, status')
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

  const fetchAdvances = async (collaboratorId: string) => {
    try {
      const { data, error } = await supabase
        .from('collaborator_advances')
        .select(`
          *,
          bank_accounts (
            name
          )
        `)
        .eq('collaborator_id', collaboratorId)
        .order('advance_date', { ascending: false });

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

  const calculateCollaborators = async () => {
    // Get all collaborators from database
    const { data: allCollaborators, error } = await supabase
      .from('collaborators')
      .select('id, name, email, phone, pix_key')
      .in('status', ['active', 'ativo'])
      .order('name');

    if (error) {
      console.error('Error fetching collaborators:', error);
      return;
    }

    // Filter payments by selected month and year
    const filteredPayments = payments.filter(payment => {
      const paymentDate = new Date(payment.payment_date + 'T12:00:00');
      return paymentDate.getMonth() === selectedMonthFilter && 
             paymentDate.getFullYear() === selectedYear;
    });
    
    // Show all active collaborators, with or without payments in the selected period
    const collaboratorMap = new Map<string, Collaborator>();
    
    // Initialize all collaborators
    allCollaborators?.forEach(collab => {
      collaboratorMap.set(collab.id, {
        id: collab.id,
        name: collab.name,
        email: collab.email,
        phone: collab.phone,
        pix_key: collab.pix_key,
        totalAmount: 0,
        eventCount: 0
      });
    });
    
    // Add payment data
    filteredPayments.forEach(payment => {
      const existing = collaboratorMap.get(payment.collaborator_id);
      if (existing) {
        existing.totalAmount += payment.amount;
        existing.eventCount += 1;
      }
    });

    const result = Array.from(collaboratorMap.values());
    setCollaborators(result);
  };

  const handleAddCollaborator = async () => {
    if (!user || !newCollaborator.name.trim()) {
      toast({
        title: "Nome inválido",
        description: "Digite o nome do colaborador.",
        variant: "destructive"
      });
      return;
    }

    // Check if collaborator already exists
    if (collaborators.some(c => c.name.toLowerCase() === newCollaborator.name.trim().toLowerCase())) {
      toast({
        title: "Colaborador já existe",
        description: "Este colaborador já está cadastrado.",
        variant: "destructive"
      });
      return;
    }

    try {
      const timestamp = Date.now();
      const emailBase = newCollaborator.name.toLowerCase().replace(/\s+/g, '.');
      const uniqueEmail = `${emailBase}.${timestamp}@colaborador.local`;
      
      const { data: newCollabData, error: insertError } = await supabase
        .from('collaborators')
        .insert({
          name: newCollaborator.name.trim(),
          email: uniqueEmail,
          phone: newCollaborator.phone || null,
          pix_key: newCollaborator.pix_key || null,
          role: 'funcionario',
          status: 'ativo',
          created_by: user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Criar pagamento inicial para o colaborador
      if (newCollabData) {
        const paymentsToInsert = [];
        
        if (newCollaborator.registerInAllMonths) {
          // Criar pagamentos vazios para todos os meses do ano selecionado
          for (let month = 0; month < 12; month++) {
            const date = new Date(selectedYear, month, 15);
            paymentsToInsert.push({
              collaborator_id: newCollabData.id,
              event_id: null,
              amount: 0,
              payment_date: format(date, 'yyyy-MM-dd'),
              is_paid: false,
              notes: 'Registro mensal (sem valor)'
            });
          }
        } else {
          // Criar pagamento apenas para o mês atual do filtro
          const date = new Date(selectedYear, selectedMonthFilter, 15);
          paymentsToInsert.push({
            collaborator_id: newCollabData.id,
            event_id: null,
            amount: 0,
            payment_date: format(date, 'yyyy-MM-dd'),
            is_paid: false,
            notes: 'Registro mensal (sem valor)'
          });
        }
        
        const { error: paymentsError } = await supabase
          .from('collaborator_payments')
          .insert(paymentsToInsert);
        
        if (paymentsError) {
          console.error('Error creating monthly records:', paymentsError);
        }
      }

      setNewCollaborator({ name: '', phone: '', pix_key: '', registerInAllMonths: false });
      setAddCollaboratorDialog(false);
      await fetchPayments();
      await calculateCollaborators();
      
      toast({
        title: "Colaborador adicionado!",
        description: newCollaborator.registerInAllMonths 
          ? "Colaborador registrado em todos os meses de " + selectedYear 
          : "Use o botão 'Eventos' para vincular a eventos quando necessário.",
      });
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      toast({
        title: "Erro ao adicionar colaborador",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleAddEventPayment = async () => {
    if (!selectedCollaboratorForEvent || !eventPayment.event_id || eventPayment.amount <= 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione um evento e informe o valor.",
        variant: "destructive"
      });
      return;
    }

    try {
      const selectedEvent = events.find(e => e.id === eventPayment.event_id);
      if (!selectedEvent) throw new Error("Evento não encontrado");

      // 1. Criar pagamento do colaborador usando o mês/ano do filtro
      const paymentDate = new Date(eventFilterYear, eventFilterMonth, 15);
      const { data: paymentData, error: paymentError } = await supabase
        .from('collaborator_payments')
        .insert({
          collaborator_id: selectedCollaboratorForEvent.id,
          event_id: eventPayment.event_id,
          amount: eventPayment.amount,
          payment_date: format(paymentDate, 'yyyy-MM-dd'),
          is_paid: false,
          notes: eventPayment.notes || `Evento: ${selectedEvent.name}`
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // 2. Criar despesa no evento (aba Locações) com referência ao pagamento
      const { error: expenseError } = await supabase
        .from('event_expenses')
        .insert({
          event_id: eventPayment.event_id,
          category: 'Colaboradores',
          description: `Pagamento - ${selectedCollaboratorForEvent.name}`,
          quantity: 1,
          unit_price: eventPayment.amount,
          total_price: eventPayment.amount,
          expense_date: format(paymentDate, 'yyyy-MM-dd'),
          notes: eventPayment.notes || '',
          reference_type: 'collaborator_payment',
          reference_id: paymentData.id,
          created_by: user.id
        });

      if (expenseError) throw expenseError;

      // 3. Adicionar colaborador na aba Equipamentos Evento
      const { error: eventCollabError } = await supabase
        .from('event_collaborators')
        .insert({
          event_id: eventPayment.event_id,
          collaborator_name: selectedCollaboratorForEvent.name,
          collaborator_email: selectedCollaboratorForEvent.email,
          role: 'funcionario',
          assigned_by: user.id
        });

      if (eventCollabError) throw eventCollabError;

      setEventDialog(false);
      setEventPayment({ event_id: '', amount: 0, notes: '' });
      setSelectedCollaboratorForEvent(null);
      await fetchPayments();
      await calculateCollaborators();
      
      toast({
        title: "Pagamento adicionado!",
        description: "Despesa e colaborador adicionados ao evento.",
      });
    } catch (error: any) {
      console.error('Error adding event payment:', error);
      toast({
        title: "Erro ao adicionar pagamento",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCollaborator = async (collaborator: Collaborator) => {
    if (!confirm(`Tem certeza que deseja excluir "${collaborator.name}" e todos os seus registros?`)) return;

    try {
      // Delete collaborator (CASCADE will handle payments and advances)
      const { error } = await supabase
        .from('collaborators')
        .delete()
        .eq('id', collaborator.id);

      if (error) throw error;

      toast({
        title: "Colaborador excluído",
        description: `${collaborator.name} foi excluído com sucesso.`
      });

      await fetchPayments();
      await calculateCollaborators();
    } catch (error: any) {
      console.error('Error deleting collaborator:', error);
      toast({
        title: "Erro ao excluir",
        description: error.message || "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const openAdvancesDialog = (collaborator: Collaborator) => {
    setSelectedCollaboratorAdvances(collaborator.id);
    fetchAdvances(collaborator.id);
    setAdvancesDialog(true);
  };

  const openSalaryDialog = async (collaborator: Collaborator) => {
    setSelectedCollaboratorSalary(collaborator);
    setSalaryMonth(selectedMonthFilter);
    setSalaryYear(selectedYear);
    
    // Buscar salário do mês selecionado
    const { data } = await supabase
      .from('collaborator_monthly_salaries')
      .select('*')
      .eq('collaborator_id', collaborator.id)
      .eq('salary_month', selectedMonthFilter)
      .eq('salary_year', selectedYear)
      .maybeSingle();
    
    setSalaryAmount(data?.salary_amount || 0);
    setSalaryDialog(true);
  };

  const handleSaveSalary = async () => {
    if (!selectedCollaboratorSalary || !user?.id) return;

    try {
      const { data: existing } = await supabase
        .from('collaborator_monthly_salaries')
        .select('id')
        .eq('collaborator_id', selectedCollaboratorSalary.id)
        .eq('salary_month', salaryMonth)
        .eq('salary_year', salaryYear)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('collaborator_monthly_salaries')
          .update({ salary_amount: salaryAmount })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('collaborator_monthly_salaries')
          .insert({
            collaborator_id: selectedCollaboratorSalary.id,
            salary_month: salaryMonth,
            salary_year: salaryYear,
            salary_amount: salaryAmount,
            created_by: user.id
          });

        if (error) throw error;
      }

      toast({
        title: "Salário atualizado",
        description: `Salário de ${monthNames[salaryMonth]} ${salaryYear} foi salvo com sucesso`
      });

      setSalaryDialog(false);
      await fetchMonthlySalaries();
    } catch (error: any) {
      console.error('Error updating salary:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar salário",
        variant: "destructive"
      });
    }
  };

  const fetchMonthlySalaries = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborator_monthly_salaries')
        .select('*');

      if (error) throw error;
      setMonthlySalaries(data || []);
    } catch (error) {
      console.error('Error fetching monthly salaries:', error);
    }
  };

  const handleAddAdvance = async () => {
    if (!selectedCollaboratorAdvances || !user?.id) return;
    
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
        .from('collaborator_advances')
        .insert({
          collaborator_id: selectedCollaboratorAdvances,
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
      fetchAdvances(selectedCollaboratorAdvances);
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
      const { error } = await supabase
        .from('collaborator_advances')
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Vale excluído com sucesso"
      });

      if (selectedCollaboratorAdvances) {
        fetchAdvances(selectedCollaboratorAdvances);
      }

      // Update view dialog if open
      if (viewCollaborator) {
        openViewDialog(viewCollaborator);
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

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este pagamento?')) return;

    try {
      // Get payment details first
      const { data: payment } = await supabase
        .from('collaborator_payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle();

      if (payment) {
        // Check if there's a related event_expense entry
        const { data: relatedExpense } = await supabase
          .from('event_expenses')
          .select('id')
          .eq('event_id', payment.event_id)
          .eq('reference_type', 'collaborator_payment')
          .eq('reference_id', paymentId)
          .maybeSingle();

        if (relatedExpense) {
          // Delete related event_expenses entry
          await supabase
            .from('event_expenses')
            .delete()
            .eq('id', relatedExpense.id);
        }
      }

      // Finally, delete the payment itself
      const { error } = await supabase
        .from('collaborator_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pagamento excluído com sucesso"
      });

      // Refresh view if open
      if (viewCollaborator) {
        openViewDialog(viewCollaborator);
      }
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir pagamento",
        variant: "destructive"
      });
    }
  };

  // Notinhas functions
  const fetchCollaboratorExpenses = async (collaboratorId: string, monthFilter?: number) => {
    try {
      const { data: collaboratorData } = await supabase
        .from('collaborators')
        .select('name')
        .eq('id', collaboratorId)
        .single();

      if (!collaboratorData) return;

      // Buscar notinhas de event_expenses (inclui despesas do WhatsApp)
      // Buscar por: 
      // 1. Categoria "Despesas de Colaboradores" com nome na descrição OU
      // 2. Categoria "Reembolsos" (criados via WhatsApp) com reference_type = 'collaborator' e reference_id = collaboratorId
      let query = supabase
        .from('event_expenses')
        .select(`
          id,
          description,
          total_price,
          expense_date,
          receipt_url,
          event_id,
          category,
          reference_type,
          reference_id,
          events (
            name
          )
        `)
        .or(`and(category.eq.Despesas de Colaboradores,description.ilike.${collaboratorData.name}%),and(reference_type.in.(collaborator,colaborador),reference_id.eq.${collaboratorId}),and(category.eq.Reembolsos,reference_type.in.(collaborator,colaborador),reference_id.eq.${collaboratorId})`);

      // Filtrar por mês se fornecido
      if (monthFilter !== undefined) {
        const year = selectedYear;
        const startDate = new Date(year, monthFilter, 1);
        const endDate = new Date(year, monthFilter + 1, 0);
        
        query = query
          .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
          .lte('expense_date', format(endDate, 'yyyy-MM-dd'));
      }

      const { data, error } = await query.order('expense_date', { ascending: false });

      if (error) throw error;
      
      const expenses: CollaboratorExpense[] = (data || []).map((item: any) => ({
        id: item.id,
        description: item.description,
        amount: item.total_price,
        expense_date: item.expense_date,
        receipt_url: item.receipt_url,
        event_id: item.event_id,
        category: item.category,
        events: Array.isArray(item.events) ? item.events[0] : item.events
      }));
      
      setCollaboratorExpenses(expenses);
    } catch (error: any) {
      console.error('Error fetching collaborator expenses:', error);
    }
  };

  const openNotinhasDialog = (collaborator: Collaborator) => {
    setSelectedCollaboratorNotinhas(collaborator);
    setNotinhasDisplayMonth(selectedMonthFilter);
    fetchCollaboratorExpenses(collaborator.id, selectedMonthFilter);
    setNotinhasDialog(true);
  };

  const handleDeleteNotinha = async (expenseId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta notinha?')) return;

    try {
      // Buscar dados antes de deletar para remover também do Fluxo de Caixa / Extrato
      const { data: expenseData } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('id', expenseId)
        .maybeSingle();

      const { error } = await supabase
        .from('event_expenses')
        .delete()
        .eq('id', expenseId);

      if (error) throw error;

      if (expenseData) {
        // 1) Referência padrão
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'expense')
          .eq('reference_id', expenseId);

        // 2) Compatibilidade com imports antigos
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'event_expense')
          .eq('reference_id', expenseId);

        // 3) Compatibilidade: bug antigo gravou reference_id = event_id
        const txDate = expenseData.expense_date || expenseData.payment_date || (expenseData.created_at ? String(expenseData.created_at).slice(0, 10) : null);
        if (expenseData.event_id && txDate) {
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'event_expense')
            .eq('reference_id', expenseData.event_id)
            .eq('transaction_date', txDate)
            .eq('amount', expenseData.total_price);
        }

        // 4) Matching por dados (para extrato com descrição diferente)
        if (expenseData.expense_bank_account && txDate) {
          const bankAccountName = String(expenseData.expense_bank_account || '').trim();
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .ilike('name', bankAccountName)
            .maybeSingle();

          if (bankAccount) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expenseData.total_price)
              .eq('transaction_type', 'expense')
              .or('reference_type.is.null,reference_type.eq.expense,reference_type.eq.event_expense');
          }
        }
      }

      toast({
        title: "Sucesso",
        description: "Notinha excluída com sucesso"
      });

      if (selectedCollaboratorNotinhas) {
        fetchCollaboratorExpenses(selectedCollaboratorNotinhas.id, notinhasDisplayMonth);
        
        // Atualizar janela de visualização se estiver aberta para este colaborador
        if (viewCollaborator && viewCollaborator.id === selectedCollaboratorNotinhas.id) {
          openViewDialog(selectedCollaboratorNotinhas);
        }
      }
    } catch (error: any) {
      console.error('Error deleting notinha:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir notinha",
        variant: "destructive"
      });
    }
  };

  // Expense Advances functions
  const fetchCollaboratorExpenseAdvances = async (collaboratorId: string) => {
    try {
      const { data, error } = await supabase
        .from('collaborator_expense_advances')
        .select(`
          *,
          bank_accounts (
            name
          )
        `)
        .eq('collaborator_id', collaboratorId)
        .order('advance_date', { ascending: false });

      if (error) throw error;
      setCollaboratorExpenseAdvances(data || []);
    } catch (error: any) {
      console.error('Error fetching expense advances:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar adiantamentos para notinhas",
        variant: "destructive"
      });
    }
  };

  const openExpenseAdvancesDialog = (collaborator: Collaborator) => {
    setSelectedCollaboratorExpenseAdvances(collaborator);
    fetchCollaboratorExpenseAdvances(collaborator.id);
    setExpenseAdvancesDialog(true);
  };

  const handleAddExpenseAdvance = async () => {
    if (!selectedCollaboratorExpenseAdvances || !user?.id) return;
    
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
      const { error } = await supabase
        .from('collaborator_expense_advances')
        .insert({
          collaborator_id: selectedCollaboratorExpenseAdvances.id,
          amount: expenseAdvanceFormData.amount,
          advance_date: expenseAdvanceFormData.advance_date,
          bank_account_id: expenseAdvanceFormData.bank_account_id,
          notes: expenseAdvanceFormData.notes || null,
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
        notes: ''
      });
      fetchCollaboratorExpenseAdvances(selectedCollaboratorExpenseAdvances.id);
      
      // Atualizar janela de visualização se estiver aberta para este colaborador
      if (viewCollaborator && viewCollaborator.id === selectedCollaboratorExpenseAdvances.id) {
        openViewDialog(selectedCollaboratorExpenseAdvances);
      }
    } catch (error: any) {
      console.error('Error adding expense advance:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar adiantamento",
        variant: "destructive"
      });
    }
  };

  const handleDeleteExpenseAdvance = async (advanceId: string) => {
    if (!confirm('Tem certeza que deseja excluir este adiantamento?')) return;

    try {
      const { error } = await supabase
        .from('collaborator_expense_advances')
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Adiantamento excluído com sucesso"
      });

      if (selectedCollaboratorExpenseAdvances) {
        fetchCollaboratorExpenseAdvances(selectedCollaboratorExpenseAdvances.id);
        
        // Atualizar janela de visualização se estiver aberta para este colaborador
        if (viewCollaborator && viewCollaborator.id === selectedCollaboratorExpenseAdvances.id) {
          openViewDialog(selectedCollaboratorExpenseAdvances);
        }
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

  // Food Allowances - simplified function using new calendar component
  const openFoodAllowancesDialog = (collaborator: Collaborator) => {
    setSelectedCollaboratorFoodAllowances(collaborator);
    setFoodAllowancesDialog(true);
  };

  const openViewDialog = async (collaborator: Collaborator) => {
    setViewCollaborator(collaborator);
    
    // Fetch all payments for this collaborator
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('collaborator_payments')
      .select(`
        *,
        events (
          name,
          event_date
        ),
        bank_accounts (
          name
        )
      `)
      .eq('collaborator_id', collaborator.id)
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
    }

    // Fetch all advances for this collaborator
    const { data: advancesData, error: advancesError } = await supabase
      .from('collaborator_advances')
      .select(`
        *,
        bank_accounts (
          name
        )
      `)
      .eq('collaborator_id', collaborator.id)
      .order('advance_date', { ascending: false});

    if (advancesError) {
      console.error('Error fetching advances:', advancesError);
    }

    // Fetch all expenses (notinhas) for this collaborator
    const { data: expensesData, error: expensesError } = await supabase
      .from('event_expenses')
      .select(`
        *,
        events (
          name
        )
      `)
      .eq('reference_id', collaborator.id)
      .in('reference_type', ['collaborator', 'colaborador'])
      .order('expense_date', { ascending: false });

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
    }

    // Map expenses to the correct format
    const mappedExpenses: CollaboratorExpense[] = (expensesData || []).map(item => ({
      id: item.id,
      description: item.description,
      amount: item.total_price,
      expense_date: item.expense_date,
      receipt_url: item.receipt_url,
      event_id: item.event_id,
      category: item.category,
      is_paid: item.is_paid,
      payment_date: item.payment_date,
      payment_bank_account: item.payment_bank_account,
      events: item.events
    }));


    // Fetch all expense advances (adiantamentos de notinhas) for this collaborator
    const { data: expenseAdvancesData, error: expenseAdvancesError } = await supabase
      .from('collaborator_expense_advances')
      .select(`
        *,
        bank_accounts (
          name
        )
      `)
      .eq('collaborator_id', collaborator.id)
      .order('advance_date', { ascending: false});

    if (expenseAdvancesError) {
      console.error('Error fetching expense advances:', expenseAdvancesError);
    }

    setViewPayments(paymentsData || []);
    setViewAdvances(advancesData || []);
    setViewExpenses(mappedExpenses);
    setViewExpenseAdvances(expenseAdvancesData || []);
    setViewDialog(true);
  };

  const getFilteredPayments = () => {
    if (!viewCollaborator) return [];
    
    const filtered = viewPayments.filter(payment => {
      // Use event_date if available, otherwise fall back to payment_date
      const dateToUse = payment.events?.event_date || payment.payment_date;
      const paymentDate = new Date(dateToUse + 'T12:00:00');
      return paymentDate.getMonth() === selectedMonthFilter && 
             paymentDate.getFullYear() === selectedYear;
    });
    
    return filtered;
  };

  const getFilteredAdvances = () => {
    if (!viewCollaborator) return [];
    
    const filtered = viewAdvances.filter(advance => {
      const advanceDate = new Date(advance.advance_date + 'T12:00:00');
      return advanceDate.getMonth() === selectedMonthFilter && 
             advanceDate.getFullYear() === selectedYear;
    });
    
    return filtered;
  };

  const getFilteredExpenses = () => {
    if (!viewCollaborator) return [];
    
    const filtered = viewExpenses.filter(exp => {
      const expenseDate = new Date(exp.expense_date + 'T12:00:00');
      return expenseDate.getMonth() === selectedMonthFilter && 
             expenseDate.getFullYear() === selectedYear;
    });
    
    return filtered;
  };

  const getFilteredExpenseAdvances = () => {
    if (!viewCollaborator) return [];
    
    const filtered = viewExpenseAdvances.filter(advance => {
      const advanceDate = new Date(advance.advance_date + 'T12:00:00');
      return advanceDate.getMonth() === selectedMonthFilter && 
             advanceDate.getFullYear() === selectedYear;
    });
    
    return filtered;
  };

  const generatePDF = async (collaborator: Collaborator) => {
    const doc = new jsPDF({
      compress: true
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Get filtered data
    const filteredPayments = getFilteredPayments();
    const filteredAdvances = getFilteredAdvances();
    const filteredExpenses = getFilteredExpenses();
    const filteredExpenseAdvances = getFilteredExpenseAdvances();
    
    // Resolve monthly salary total (handles legacy imports where salary_month was shifted)
    const resolvedSalaryResult = await resolveMonthlySalaryTotal(collaborator.id, selectedMonthFilter, selectedYear);
    const monthlySalary = resolvedSalaryResult.total > 0 ? ({ salary_amount: resolvedSalaryResult.total } as any) : null;
    
    // Função para adicionar cabeçalho timbrado
    const addLetterhead = async (pageNumber: number) => {
      // Adicionar logo se disponível
      if (logoUrl) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoUrl;
          });
          
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
    const monthName = monthNames[selectedMonthFilter];
    doc.text(`Relatório de Colaborador - ${collaborator.name}`, 14, 52);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${monthName}/${selectedYear}`, 14, 58);
    
    let finalY = 65;
    
    // Adicionar Salário Mensal se existir
    if (monthlySalary && monthlySalary.salary_amount > 0) {
      doc.setFillColor(59, 130, 246);
      doc.rect(14, finalY, pageWidth - 28, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Salário Mensal:', 18, finalY + 8);
      doc.text(formatCurrency(monthlySalary.salary_amount), pageWidth - 18, finalY + 8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      finalY += 20;
    }
    
    // Tabela de Pagamentos por Eventos
    if (filteredPayments.length > 0) {
      const paymentsData = filteredPayments.map(payment => [
        format(new Date(payment.payment_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        payment.events?.name || 'Sem evento',
        formatCurrency(payment.amount),
        payment.notes || '-'
      ]);
      
      const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Pagamentos por Eventos', 14, finalY);
      
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Data', 'Evento', 'Valor', 'Observações']],
        body: paymentsData,
        foot: [['', 'TOTAL', formatCurrency(totalPayments), '']],
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
      
      finalY = (doc as any).lastAutoTable.finalY || finalY;
    }
    
    // Tabela de Vales
    if (filteredAdvances.length > 0) {
      const advancesData = filteredAdvances.map(advance => [
        format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        formatCurrency(advance.amount),
        advance.bank_accounts?.name || '-',
        advance.notes || '-'
      ]);
      
      const totalAdvances = filteredAdvances.reduce((sum, a) => sum + a.amount, 0);
      
      // Check if section title fits, if not add new page
      if (finalY + 25 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        const newPageNum = (doc as any).internal.getNumberOfPages();
        await addLetterhead(newPageNum);
        finalY = 50;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Vales (Adiantamentos)', 14, finalY + 10);
      
      autoTable(doc, {
        startY: finalY + 15,
        head: [['Data', 'Valor', 'Conta', 'Observações']],
        body: advancesData,
        foot: [['', 'TOTAL VALES', formatCurrency(totalAdvances), '']],
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
      
      finalY = (doc as any).lastAutoTable.finalY || finalY;
    }
    
    // Tabela de Notinhas
    if (filteredExpenses.length > 0) {
      const expensesData = filteredExpenses.map(expense => [
        format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        expense.events?.name || 'Sem evento',
        formatCurrency(expense.amount),
        expense.description || '-'
      ]);
      
      const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      // Check if section title fits, if not add new page
      if (finalY + 25 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        const newPageNum = (doc as any).internal.getNumberOfPages();
        await addLetterhead(newPageNum);
        finalY = 50;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Notinhas (Reembolsos)', 14, finalY + 10);
      
      autoTable(doc, {
        startY: finalY + 15,
        head: [['Data', 'Evento', 'Valor', 'Descrição']],
        body: expensesData,
        foot: [['', 'TOTAL NOTINHAS', formatCurrency(totalExpenses), '']],
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
      
      finalY = (doc as any).lastAutoTable.finalY || finalY;
    }
    
    // Tabela de Adiantamentos para Notinhas
    if (filteredExpenseAdvances.length > 0) {
      const expAdvData = filteredExpenseAdvances.map(advance => [
        format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        formatCurrency(advance.amount),
        advance.bank_accounts?.name || '-',
        advance.notes || '-'
      ]);
      
      const totalExpAdvances = filteredExpenseAdvances.reduce((sum, a) => sum + a.amount, 0);
      
      // Check if section title fits, if not add new page
      if (finalY + 25 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        const newPageNum = (doc as any).internal.getNumberOfPages();
        await addLetterhead(newPageNum);
        finalY = 50;
      }
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Adiantamentos para Notinhas', 14, finalY + 10);
      
      autoTable(doc, {
        startY: finalY + 15,
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
      
      finalY = (doc as any).lastAutoTable.finalY || finalY;
    }
    
    // Calcular totais
    const totalPayments = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAdvances = filteredAdvances.reduce((sum, a) => sum + a.amount, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalExpAdvances = filteredExpenseAdvances.reduce((sum, a) => sum + a.amount, 0);
    const salaryAmount = monthlySalary?.salary_amount || 0;
    const totalLiquido = salaryAmount + totalPayments + totalExpenses - totalAdvances - totalExpAdvances;
    
    // Adicionar barras de totais coloridas
    const hasTotals = salaryAmount > 0 || totalPayments > 0 || totalAdvances > 0 || totalExpenses > 0 || totalExpAdvances > 0;
    
    if (hasTotals) {
      let currentY = finalY + 10;
      const barHeight = 10;
      const barSpacing = 2;
      const barWidth = pageWidth - 28;
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Count how many bars we need
      const barsCount = [salaryAmount > 0, totalPayments > 0, totalAdvances > 0, totalExpAdvances > 0, totalExpenses > 0, true].filter(Boolean).length;
      const totalBarsHeight = barsCount * (barHeight + barSpacing);
      
      // Check if totals fit on current page, if not add new page
      if (currentY + totalBarsHeight > pageHeight - 20) {
        doc.addPage();
        const newPageNum = (doc as any).internal.getNumberOfPages();
        await addLetterhead(newPageNum);
        currentY = 55;
      }
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      
      // Salário Mensal (roxo)
      if (salaryAmount > 0) {
        doc.setFillColor(147, 51, 234);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Salário Mensal:', 18, currentY + 7);
        doc.text(formatCurrency(salaryAmount), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Total em Pagamentos (azul)
      if (totalPayments > 0) {
        doc.setFillColor(59, 130, 246);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Pagamentos:', 18, currentY + 7);
        doc.text(formatCurrency(totalPayments), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Total em Vales (vermelho)
      if (totalAdvances > 0) {
        doc.setFillColor(239, 68, 68);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Vales:', 18, currentY + 7);
        doc.text(formatCurrency(totalAdvances), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Total em Adiantamentos para Notinhas (laranja)
      if (totalExpAdvances > 0) {
        doc.setFillColor(251, 146, 60);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total em Adiantamentos para Notinhas:', 18, currentY + 7);
        doc.text(formatCurrency(totalExpAdvances), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Total em Notinhas (verde)
      if (totalExpenses > 0) {
        doc.setFillColor(187, 247, 208);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(0, 0, 0);
        doc.text('Total em Notinhas (Reembolsos):', 18, currentY + 7);
        doc.text(`+ ${formatCurrency(totalExpenses)}`, pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      // Total Líquido (azul claro)
      doc.setFillColor(191, 219, 254);
      doc.rect(14, currentY, barWidth, barHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text('Total Líquido a Receber:', 18, currentY + 7);
      doc.text(formatCurrency(totalLiquido), pageWidth - 18, currentY + 7, { align: 'right' });
    }
    
    // Resetar cor do texto
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
    
    doc.save(`relatorio_${collaborator.name}_${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    
    toast({
      title: "PDF gerado com sucesso",
      description: `Relatório de ${collaborator.name} foi baixado`
    });
  };

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const monthAbbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const getTotalCollaboratorsInPeriod = () => {
    return collaborators.length;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground">Gerencie pagamentos por evento</p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddCollaboratorDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Colaborador
          </Button>
        )}
      </div>

      {/* Month/Year filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Ano:</Label>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {monthAbbr.map((month, index) => (
                <Button
                  key={index}
                  variant={selectedMonthFilter === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMonthFilter(index)}
                  className={cn(
                    "min-w-[60px]",
                    selectedMonthFilter === index && "bg-primary text-primary-foreground"
                  )}
                >
                  {month}
                </Button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {monthNames[selectedMonthFilter]} {selectedYear} - {getTotalCollaboratorsInPeriod()} colaborador(es)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collaborators list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collaborators.map((collaborator) => (
          <Card key={collaborator.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{collaborator.name}</CardTitle>
                    <CardDescription>{collaborator.eventCount} evento(s)</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {canViewValues && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Total do Período</span>
                  <span className="text-lg font-bold text-primary">
                    {formatValue(collaborator.totalAmount)}
                  </span>
                </div>
              )}

              {collaborator.phone && (
                <p className="text-sm text-muted-foreground">📱 {collaborator.phone}</p>
              )}
              {collaborator.pix_key && (
                <p className="text-sm text-muted-foreground">
                  💳 PIX: {canViewSensitiveData(userRole) ? maskSensitive(collaborator.pix_key) : '••••'}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setProfilePerson({ id: collaborator.id, name: collaborator.name });
                    setProfileDialogOpen(true);
                  }}
                >
                  <IdCard className="w-4 h-4 mr-1" />
                  Ficha
                </Button>
                {canEdit && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setSelectedCollaboratorForEvent(collaborator);
                        setEventFilterMonth(selectedMonthFilter);
                        setEventFilterYear(selectedYear);
                        setEventDialog(true);
                      }}
                    >
                      <CalendarIcon className="w-4 h-4 mr-1" />
                      Eventos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openAdvancesDialog(collaborator)}
                    >
                      <Wallet className="w-4 h-4 mr-1" />
                      Vales
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openSalaryDialog(collaborator)}
                    >
                      <DollarSign className="w-4 h-4 mr-1" />
                      Salário
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openNotinhasDialog(collaborator)}
                    >
                      <Receipt className="w-4 h-4 mr-1" />
                      Notinhas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openExpenseAdvancesDialog(collaborator)}
                    >
                      <Wallet className="w-4 h-4 mr-1" />
                      Adiant. Notinhas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openFoodAllowancesDialog(collaborator)}
                    >
                      <UtensilsCrossed className="w-4 h-4 mr-1" />
                      Alimentação
                    </Button>
                  </>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => openViewDialog(collaborator)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver
                </Button>
                {canEdit && canViewValues && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => generatePDF(collaborator)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                )}
                {canEdit && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteCollaborator(collaborator)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Collaborator Dialog */}
      <Dialog open={addCollaboratorDialog} onOpenChange={setAddCollaboratorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={newCollaborator.name}
                onChange={(e) => setNewCollaborator({ ...newCollaborator, name: e.target.value })}
                placeholder="Nome do colaborador"
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={newCollaborator.phone}
                onChange={(e) => {
                  const formatted = handlePhoneInput(e.target.value);
                  setNewCollaborator({ ...newCollaborator, phone: formatted });
                }}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label htmlFor="pix_key">Chave PIX</Label>
              <Input
                id="pix_key"
                value={newCollaborator.pix_key}
                onChange={(e) => setNewCollaborator({ ...newCollaborator, pix_key: e.target.value })}
                placeholder="Email, CPF, celular ou chave aleatória"
              />
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-medium">Período de Registro</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="registerCurrentMonth"
                    name="registerPeriod"
                    checked={!newCollaborator.registerInAllMonths}
                    onChange={() => setNewCollaborator({ ...newCollaborator, registerInAllMonths: false })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="registerCurrentMonth" className="cursor-pointer font-normal">
                    Apenas {monthNames[selectedMonthFilter]} {selectedYear}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="registerAllMonths"
                    name="registerPeriod"
                    checked={newCollaborator.registerInAllMonths}
                    onChange={() => setNewCollaborator({ ...newCollaborator, registerInAllMonths: true })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="registerAllMonths" className="cursor-pointer font-normal">
                    Todos os meses de {selectedYear}
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {newCollaborator.registerInAllMonths 
                  ? 'O colaborador aparecerá em todos os meses (sem valor inicial)'
                  : `O colaborador não será registrado automaticamente em nenhum mês`
                }
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddCollaboratorDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddCollaborator}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advances Dialog */}
      <Dialog open={advancesDialog} onOpenChange={setAdvancesDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vales do Colaborador</DialogTitle>
            <DialogDescription>
              Gerencie os adiantamentos do colaborador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {canEdit && (
              <Button onClick={() => setAddAdvanceDialog(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Vale
              </Button>
            )}

            {(() => {
              // Filter advances by selected month/year
              const filteredAdvances = advances.filter(advance => {
                const advanceDate = new Date(advance.advance_date + 'T12:00:00');
                return advanceDate.getMonth() === selectedMonthFilter && 
                       advanceDate.getFullYear() === selectedYear;
              });

              return filteredAdvances.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum vale registrado para {monthNames[selectedMonthFilter]} de {selectedYear}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Observações</TableHead>
                      {canEdit && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvances.map(advance => (
                      <TableRow key={advance.id}>
                        <TableCell>
                          {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{canViewValues ? formatValue(advance.amount) : '***'}</TableCell>
                        <TableCell>{advance.bank_accounts?.name || '-'}</TableCell>
                        <TableCell>{advance.notes || '-'}</TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteAdvance(advance.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Advance Dialog */}
      <Dialog open={addAdvanceDialog} onOpenChange={setAddAdvanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Vale</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="advance_amount">Valor *</Label>
              <CurrencyInput
                id="advance_amount"
                value={advanceFormData.amount}
                onChange={(value) => setAdvanceFormData({ ...advanceFormData, amount: value })}
              />
            </div>
            <div>
              <Label htmlFor="advance_date">Data *</Label>
              <Input
                id="advance_date"
                type="date"
                value={advanceFormData.advance_date}
                onChange={(e) => setAdvanceFormData({ ...advanceFormData, advance_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="advance_bank">Conta Bancária *</Label>
              <Select value={advanceFormData.bank_account_id} onValueChange={(v) => setAdvanceFormData({ ...advanceFormData, bank_account_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="advance_notes">Observações</Label>
              <Textarea
                id="advance_notes"
                value={advanceFormData.notes}
                onChange={(e) => setAdvanceFormData({ ...advanceFormData, notes: e.target.value })}
                placeholder="Observações sobre o vale"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddAdvanceDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddAdvance}>
                Adicionar Vale
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para vincular colaborador a evento */}
      <Dialog open={eventDialog} onOpenChange={setEventDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Evento - {selectedCollaboratorForEvent?.name}</DialogTitle>
            <DialogDescription>
              Vincule o colaborador a um evento e crie automaticamente uma despesa
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filtro de Mês/Ano */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-medium">Filtrar Eventos por Período</Label>
              <div className="flex gap-2">
                <Select value={eventFilterYear.toString()} onValueChange={(v) => setEventFilterYear(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={eventFilterMonth.toString()} onValueChange={(v) => setEventFilterMonth(parseInt(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {monthNames.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Evento *</Label>
              <Select 
                value={eventPayment.event_id} 
                onValueChange={(v) => setEventPayment({ ...eventPayment, event_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {events
                    .filter(event => {
                      const eventDate = new Date(event.event_date + 'T12:00:00');
                      return eventDate.getMonth() === eventFilterMonth && 
                             eventDate.getFullYear() === eventFilterYear;
                    })
                    .map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy')}
                      </SelectItem>
                    ))}
                  {events.filter(event => {
                    const eventDate = new Date(event.event_date + 'T12:00:00');
                    return eventDate.getMonth() === eventFilterMonth && 
                           eventDate.getFullYear() === eventFilterYear;
                  }).length === 0 && (
                    <SelectItem value="no-events" disabled>
                      Nenhum evento neste período
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="event_amount">Valor a Pagar *</Label>
              <CurrencyInput
                id="event_amount"
                value={eventPayment.amount}
                onChange={(value) => setEventPayment({ ...eventPayment, amount: value })}
              />
            </div>

            <div>
              <Label htmlFor="event_notes">Observações</Label>
              <Input
                id="event_notes"
                value={eventPayment.notes}
                onChange={(e) => setEventPayment({ ...eventPayment, notes: e.target.value })}
                placeholder="Ex: 8 horas de trabalho"
              />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
              <p className="font-medium">Ao confirmar, será criado:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Pagamento do colaborador</li>
                <li>Despesa no evento (categoria Colaboradores)</li>
                <li>Registro na aba Equipamentos Evento</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEventDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddEventPayment}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Salary Dialog */}
      <Dialog open={salaryDialog} onOpenChange={setSalaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salário Mensal - {selectedCollaboratorSalary?.name}</DialogTitle>
            <DialogDescription>
              Defina o salário mensal do colaborador para um mês específico
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Filtro de Mês/Ano */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
              <Label className="text-sm font-medium">Período</Label>
              <div className="flex gap-2">
                <Select value={salaryYear.toString()} onValueChange={(v) => setSalaryYear(parseInt(v))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={salaryMonth.toString()} onValueChange={(v) => setSalaryMonth(parseInt(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    {monthNames.map((month, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="salary_amount">Salário *</Label>
              <CurrencyInput
                id="salary_amount"
                value={salaryAmount}
                onChange={(value) => setSalaryAmount(value)}
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="text-muted-foreground">
                O salário será incluído no PDF e na visualização do relatório do colaborador para o mês selecionado.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSalaryDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSalary}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notinhas Dialog */}
      <Dialog open={notinhasDialog} onOpenChange={setNotinhasDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notinhas (Reembolsos) - {selectedCollaboratorNotinhas?.name}</DialogTitle>
            <DialogDescription>
              Gerencie as despesas de reembolso do colaborador
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {canEdit && (
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                <h3 className="font-semibold">Adicionar Nova Notinha</h3>
                
                <div className="space-y-2">
                  <Label>Tipo de Lançamento *</Label>
                  <Select
                    value={notinhaFormData.expense_type}
                    onValueChange={(value: 'evento' | 'galpao') => {
                      setNotinhaFormData({ 
                        ...notinhaFormData, 
                        expense_type: value,
                        event_id: value === 'galpao' ? '' : notinhaFormData.event_id
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="evento">Eventos</SelectItem>
                      <SelectItem value="galpao">Galpão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {notinhaFormData.expense_type === 'evento' && (
                  <>
                    <div className="space-y-2">
                      <Label>Filtrar Eventos por Mês</Label>
                      <Select
                        value={notinhasEventFilterMonth.toString()}
                        onValueChange={(value) => setNotinhasEventFilterMonth(value === 'all' ? 'all' : parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os meses</SelectItem>
                          {monthNames.map((month, index) => (
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
                    if (!selectedCollaboratorNotinhas || !user?.id) return;
                    
                    // Validação: se for evento, exigir event_id
                    if (notinhaFormData.expense_type === 'evento' && !notinhaFormData.event_id) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Selecione um evento",
                        variant: "destructive"
                      });
                      return;
                    }

                    if (notinhaFormData.amount <= 0 || !notinhaFormData.description.trim()) {
                      toast({
                        title: "Campos obrigatórios",
                        description: "Preencha todos os campos obrigatórios",
                        variant: "destructive"
                      });
                      return;
                    }

                    try {
                      setUploadingReceipt(true);
                      let receiptUrl: string | null = null;

                      // Usar comprovante do WhatsApp se não houver novo arquivo
                      if (!notinhaFormData.receipt_file && pendingWhatsAppReceiptUrl) {
                        receiptUrl = pendingWhatsAppReceiptUrl;
                      } else if (notinhaFormData.receipt_file) {
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
                      }

                      const { error } = await supabase
                        .from('event_expenses')
                        .insert({
                          event_id: notinhaFormData.expense_type === 'galpao' ? null : notinhaFormData.event_id,
                          category: notinhaFormData.category || 'Outros',
                          description: `${selectedCollaboratorNotinhas.name} - ${notinhaFormData.description}`,
                          quantity: 1,
                          unit_price: notinhaFormData.amount,
                          total_price: notinhaFormData.amount,
                          expense_date: notinhaFormData.expense_date,
                          receipt_url: receiptUrl,
                          reference_id: selectedCollaboratorNotinhas.id,
                          reference_type: 'collaborator',
                          created_by: user.id
                        });

                      if (error) throw error;

                      toast({
                        title: "Sucesso",
                        description: "Notinha adicionada com sucesso"
                      });

                      setNotinhaFormData({
                        expense_type: 'evento',
                        event_id: '',
                        category: 'Outros',
                        amount: 0,
                        description: '',
                        expense_date: format(new Date(), 'yyyy-MM-dd'),
                        receipt_file: null
                      });
                      setPendingWhatsAppReceiptUrl(null);
                      fetchCollaboratorExpenses(selectedCollaboratorNotinhas.id, notinhasDisplayMonth);
                      
                      // Atualizar janela de visualização se estiver aberta para este colaborador
                      if (viewCollaborator && viewCollaborator.id === selectedCollaboratorNotinhas.id) {
                        openViewDialog(selectedCollaboratorNotinhas);
                      }
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
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold">Notinhas Registradas</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Label className="text-sm">Categoria:</Label>
                  <Select
                    value={notinhasCategoryFilter}
                    onValueChange={setNotinhasCategoryFilter}
                  >
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
                  <Label className="text-sm">Mês:</Label>
                  <Select 
                    value={notinhasDisplayMonth.toString()} 
                    onValueChange={(v) => {
                      const month = parseInt(v);
                      setNotinhasDisplayMonth(month);
                      if (selectedCollaboratorNotinhas) {
                        fetchCollaboratorExpenses(selectedCollaboratorNotinhas.id, month);
                      }
                    }}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      {monthNames.map((month, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(() => {
                const extractCategory = (exp: any) => {
                  if (exp?.category && exp.category !== 'Despesas de Colaboradores') return exp.category;
                  const m = exp?.description?.match(/\[([^\]]+)\]/);
                  return m ? m[1] : (exp?.category || 'Sem categoria');
                };
                const stripCategory = (desc: string) => (desc || '').replace(/\s*\[[^\]]+\]\s*/, ' ').trim();
                const filtered = collaboratorExpenses.filter((exp) => {
                  if (notinhasCategoryFilter === 'all') return true;
                  return extractCategory(exp) === notinhasCategoryFilter;
                });
                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma notinha registrada</p>
                    </div>
                  );
                }
                return (
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
                          {canEdit && <TableHead className="text-right">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((expense) => {
                          const cat = extractCategory(expense);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell>
                                {format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                  {cat}
                                </span>
                              </TableCell>
                              <TableCell>{expense.events?.name || 'Galpão'}</TableCell>
                              <TableCell>{stripCategory(expense.description)}</TableCell>
                              <TableCell className="font-semibold">
                                {canViewValues ? formatValue(expense.amount) : '---'}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}

              {canViewValues && collaboratorExpenses.length > 0 && (
                <div className="flex justify-end items-center gap-4 p-4 bg-muted rounded-lg">
                  <span className="font-semibold">Total em Notinhas:</span>
                  <span className="text-lg font-bold">
                    {formatValue(collaboratorExpenses.reduce((sum, exp) => sum + exp.amount, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expense Advances Dialog */}
      <Dialog open={expenseAdvancesDialog} onOpenChange={setExpenseAdvancesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adiantamentos para Notinhas - {selectedCollaboratorExpenseAdvances?.name}</DialogTitle>
            <DialogDescription>
              Registre o dinheiro enviado para o colaborador fazer despesas de notinhas
            </DialogDescription>
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
                    <DialogDescription>
                      Registre o valor enviado para o colaborador fazer despesas
                    </DialogDescription>
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

                    <Button onClick={handleAddExpenseAdvance} className="w-full">
                      Adicionar Adiantamento
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {collaboratorExpenseAdvances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum adiantamento registrado</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Conta Bancária</TableHead>
                      <TableHead>Observações</TableHead>
                      {canEdit && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collaboratorExpenseAdvances.map((advance) => (
                      <TableRow key={advance.id}>
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
            )}

            {canViewValues && collaboratorExpenseAdvances.length > 0 && (
              <div className="flex justify-end items-center gap-4 p-4 bg-muted rounded-lg">
                <span className="font-semibold">Total em Adiantamentos:</span>
                <span className="text-lg font-bold">
                  {formatValue(collaboratorExpenseAdvances.reduce((sum, advance) => sum + advance.amount, 0))}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Food Allowances Calendar Dialog */}
      {selectedCollaboratorFoodAllowances && (
        <FoodAllowanceCalendar
          collaborator={selectedCollaboratorFoodAllowances}
          open={foodAllowancesDialog}
          onOpenChange={setFoodAllowancesDialog}
          selectedMonth={selectedMonthFilter}
          selectedYear={selectedYear}
          canEdit={canEdit}
        />
      )}

      {/* View Payments Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório - {viewCollaborator?.name}</DialogTitle>
            <DialogDescription>
              Visualize os pagamentos de eventos e vales do colaborador agrupados por mês
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => viewCollaborator && generatePDF(viewCollaborator)}>
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
            </div>

            {/* Pagamentos de Eventos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Dias Trabalhados - {monthNames[selectedMonthFilter]} {selectedYear}
              </h3>
              {getFilteredPayments().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma diária encontrada para este mês
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {getFilteredPayments().length} {getFilteredPayments().length === 1 ? 'dia' : 'dias'}
                      </CardTitle>
                      {canViewValues && (
                        <span className="font-semibold text-lg">
                          {formatValue(getFilteredPayments().reduce((sum, p) => sum + p.amount, 0))}
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
                            <TableHead>Evento</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Observações</TableHead>
                            {canEdit && <TableHead>Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredPayments().map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell>
                                {payment.events?.event_date ? format(new Date(payment.events.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                              </TableCell>
                              <TableCell>{payment.events?.name || '-'}</TableCell>
                              <TableCell className="font-semibold">
                                {canViewValues ? formatValue(payment.amount) : '••••'}
                              </TableCell>
                              <TableCell>
                                {payment.is_paid ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    PAGO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    PENDENTE
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">{payment.notes || '-'}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePayment(payment.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              )}
            </div>

            {/* Vales (Adiantamentos) */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-lg font-semibold">
                Vales (Adiantamentos) - {monthNames[selectedMonthFilter]} {selectedYear}
              </h3>
              {getFilteredAdvances().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum vale registrado para este mês
                </div>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {getFilteredAdvances().length} {getFilteredAdvances().length === 1 ? 'vale' : 'vales'}
                      </CardTitle>
                      {canViewValues && (
                        <span className="font-semibold text-lg text-destructive">
                          {formatValue(getFilteredAdvances().reduce((sum, a) => sum + a.amount, 0))}
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
                            {canEdit && <TableHead>Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredAdvances().map((advance) => (
                            <TableRow key={advance.id}>
                              <TableCell>
                                {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="font-semibold text-destructive">
                                {canViewValues ? formatValue(advance.amount) : '••••'}
                              </TableCell>
                              <TableCell>{advance.bank_accounts?.name || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{advance.notes || '-'}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteAdvance(advance.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
              )}
            </div>

            {/* Notinhas (Reembolsos) */}
            {getFilteredExpenses().length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">
                  Notinhas (Reembolsos) - {monthNames[selectedMonthFilter]} {selectedYear}
                </h3>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {getFilteredExpenses().length} {getFilteredExpenses().length === 1 ? 'notinha' : 'notinhas'}
                      </CardTitle>
                      {canViewValues && (
                        <span className="font-semibold text-lg text-green-600 dark:text-green-400">
                          {formatValue(getFilteredExpenses().reduce((sum, e) => sum + e.amount, 0))}
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
                            <TableHead>Evento</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Nota</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredExpenses().map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell>
                                {format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell>{expense.events?.name || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{expense.description}</TableCell>
                              <TableCell className="font-semibold text-green-600 dark:text-green-400">
                                {canViewValues ? formatValue(expense.amount) : '••••'}
                              </TableCell>
                              <TableCell>
                                {expense.is_paid ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                    PAGO
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                    PENDENTE
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {expense.receipt_url ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void openReceipt(expense.receipt_url)}
                                  >
                                    <Receipt className="w-4 h-4" />
                                  </Button>

                                ) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Adiantamentos de Notinhas */}
            {getFilteredExpenseAdvances().length > 0 && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">
                  Adiantamentos de Notinhas - {monthNames[selectedMonthFilter]} {selectedYear}
                </h3>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {getFilteredExpenseAdvances().length} {getFilteredExpenseAdvances().length === 1 ? 'adiantamento' : 'adiantamentos'}
                      </CardTitle>
                      {canViewValues && (
                        <span className="font-semibold text-lg text-orange-600 dark:text-orange-400">
                          {formatValue(getFilteredExpenseAdvances().reduce((sum, a) => sum + a.amount, 0))}
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
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredExpenseAdvances().map((advance) => (
                            <TableRow key={advance.id}>
                              <TableCell>
                                {format(new Date(advance.advance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="font-semibold text-orange-600 dark:text-orange-400">
                                {canViewValues ? formatValue(advance.amount) : '••••'}
                              </TableCell>
                              <TableCell>{advance.bank_accounts?.name || '-'}</TableCell>
                              <TableCell className="text-muted-foreground">{advance.notes || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Total Geral */}
            {canViewValues && getFilteredPayments().length > 0 && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                  <span className="font-semibold">Total em Diárias:</span>
                  <span className="text-lg font-bold">
                    {formatValue(getFilteredPayments().reduce((sum, p) => sum + p.amount, 0))}
                  </span>
                </div>
                
                {getFilteredAdvances().length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="font-semibold">Total em Vales:</span>
                    <span className="text-lg font-bold text-destructive">
                      {formatValue(getFilteredAdvances().reduce((sum, a) => sum + a.amount, 0))}
                    </span>
                  </div>
                )}

                {getFilteredExpenses().length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="font-semibold">Total em Notinhas (Reembolsos):</span>
                    <span className="text-lg font-bold text-green-600 dark:text-green-400">
                      {formatValue(getFilteredExpenses().reduce((sum, e) => sum + e.amount, 0))}
                    </span>
                  </div>
                )}

                {getFilteredExpenseAdvances().length > 0 && (
                  <div className="flex justify-end items-center gap-4 p-3 bg-muted rounded-lg">
                    <span className="font-semibold">Total em Adiant. Notinhas:</span>
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {formatValue(getFilteredExpenseAdvances().reduce((sum, a) => sum + a.amount, 0))}
                    </span>
                  </div>
                )}
                
                 {viewSalaryTotal > 0 ? (
                   <div className={`flex justify-between items-center gap-4 p-3 rounded-lg border ${viewSalaryPaid ? 'bg-muted/50 border-muted-foreground/20' : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'}`}>
                     <div className="flex items-center gap-2">
                       <span className={`font-semibold ${viewSalaryPaid ? 'text-muted-foreground line-through' : 'text-green-700 dark:text-green-300'}`}>Salário Mensal:</span>
                       <span className={`text-lg font-bold ${viewSalaryPaid ? 'text-muted-foreground line-through' : 'text-green-700 dark:text-green-300'}`}>
                         {formatValue(viewSalaryTotal)}
                       </span>
                       {viewSalaryPaid && (
                         <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-medium">
                           PAGO
                         </span>
                       )}
                     </div>
                     {canEdit && (
                       <Button
                         variant="ghost"
                         size="sm"
                         className="text-destructive hover:text-destructive"
                         onClick={async () => {
                           if (!viewCollaborator) return;
                           try {
                             const { error } = await supabase
                               .from('collaborator_monthly_salaries')
                               .delete()
                               .eq('collaborator_id', viewCollaborator.id)
                               .eq('salary_month', selectedMonthFilter)
                               .eq('salary_year', selectedYear);
                             if (error) throw error;
                             await supabase
                               .from('collaborator_monthly_salaries')
                               .delete()
                               .eq('collaborator_id', viewCollaborator.id)
                               .eq('salary_month', 0)
                               .eq('salary_year', selectedYear);
                             const { data: salaryIds } = await supabase
                               .from('collaborator_monthly_salaries')
                               .select('id')
                               .eq('collaborator_id', viewCollaborator.id);
                             await supabase
                               .from('bank_transactions')
                               .delete()
                               .eq('reference_type', 'collaborator_salary')
                               .in('reference_id', (salaryIds || []).map(s => s.id));
                             toast({ title: "Sucesso", description: "Salário removido com sucesso" });
                             setViewSalaryTotal(0);
                             setViewSalaryPaid(false);
                             await fetchMonthlySalaries();
                           } catch (error) {
                             console.error('Error deleting salary:', error);
                             toast({ title: "Erro", description: "Erro ao remover salário", variant: "destructive" });
                           }
                         }}
                       >
                         <Trash2 className="w-4 h-4" />
                       </Button>
                     )}
                   </div>
                 ) : null}
                
                <div className="flex justify-end items-center gap-4 p-4 bg-primary/10 rounded-lg border-2 border-primary">
                  <span className="text-lg font-semibold">Total Líquido a Receber:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatValue(
                      getFilteredPayments().filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount, 0) -
                      getFilteredAdvances().reduce((sum, a) => sum + a.amount, 0) +
                      getFilteredExpenses().filter(e => !e.is_paid).reduce((sum, e) => sum + e.amount, 0) -
                      getFilteredExpenseAdvances().reduce((sum, a) => sum + a.amount, 0) +
                       (viewSalaryPaid ? 0 : viewSalaryTotal)
                    )}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setPaymentFormData({
                          bank_account_id: '',
                          notes: '',
                          payment_date: format(new Date(), 'yyyy-MM-dd')
                        });
                        setPayItems({ payments: true, expenses: true, salary: true });
                        setPaymentDialog(true);
                      }}
                      className="gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Pagar Total Líquido
                    </Button>
                  </div>
                )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Total Líquido - {viewCollaborator?.name}</DialogTitle>
            <DialogDescription>
              Registrar o pagamento do total líquido a receber do colaborador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const paymentsTotal = getFilteredPayments().filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount, 0) -
                getFilteredAdvances().reduce((sum, a) => sum + a.amount, 0);
              const expensesTotal = getFilteredExpenses().filter(e => !e.is_paid).reduce((sum, e) => sum + e.amount, 0) -
                getFilteredExpenseAdvances().reduce((sum, a) => sum + a.amount, 0);
              const salaryTotal = viewSalaryPaid ? 0 : (monthlySalaries.find(s =>
                s.collaborator_id === viewCollaborator?.id &&
                s.salary_month === selectedMonthFilter &&
                s.salary_year === selectedYear
              )?.salary_amount || 0);
              const total = (payItems.payments ? paymentsTotal : 0) +
                (payItems.expenses ? expensesTotal : 0) +
                (payItems.salary ? salaryTotal : 0);
              return (
                <>
                  <div className="space-y-2 p-4 border rounded-lg">
                    <Label className="text-sm font-semibold">O que será pago?</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pay_payments"
                        checked={payItems.payments}
                        onCheckedChange={(v) => setPayItems({ ...payItems, payments: !!v })}
                      />
                      <label htmlFor="pay_payments" className="text-sm flex-1 cursor-pointer flex justify-between">
                        <span>Diárias (menos adiantamentos)</span>
                        <span className="font-medium">{canViewValues && formatValue(paymentsTotal)}</span>
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pay_expenses"
                        checked={payItems.expenses}
                        onCheckedChange={(v) => setPayItems({ ...payItems, expenses: !!v })}
                      />
                      <label htmlFor="pay_expenses" className="text-sm flex-1 cursor-pointer flex justify-between">
                        <span>Notinhas (menos adiantamentos)</span>
                        <span className="font-medium">{canViewValues && formatValue(expensesTotal)}</span>
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="pay_salary"
                        checked={payItems.salary}
                        onCheckedChange={(v) => setPayItems({ ...payItems, salary: !!v })}
                        disabled={salaryTotal <= 0}
                      />
                      <label htmlFor="pay_salary" className="text-sm flex-1 cursor-pointer flex justify-between">
                        <span>Salário mensal</span>
                        <span className="font-medium">{canViewValues && formatValue(salaryTotal)}</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-4 bg-primary/10 rounded-lg border border-primary">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Valor a Pagar:</span>
                      <span className="text-xl font-bold text-primary">
                        {canViewValues && viewCollaborator && formatValue(total)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="space-y-2">
              <Label htmlFor="payment_bank_account">Conta Bancária *</Label>
              <Select
                value={paymentFormData.bank_account_id}
                onValueChange={(value) => setPaymentFormData({ ...paymentFormData, bank_account_id: value })}
              >
                <SelectTrigger id="payment_bank_account">
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
              <Label>Data do Pagamento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !paymentFormData.payment_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentFormData.payment_date
                      ? format(new Date(paymentFormData.payment_date + 'T12:00:00'), 'dd/MM/yyyy')
                      : 'Selecione a data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={paymentFormData.payment_date ? new Date(paymentFormData.payment_date + 'T12:00:00') : undefined}
                    onSelect={(date) => {
                      if (date) {
                        setPaymentFormData({ ...paymentFormData, payment_date: format(date, 'yyyy-MM-dd') });
                      }
                    }}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_notes">Observações</Label>
              <Textarea
                id="payment_notes"
                value={paymentFormData.notes}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                placeholder="Adicione observações sobre o pagamento..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!viewCollaborator) return;

                  try {
                    // Reverter pagamentos de diárias
                    const paymentIds = getFilteredPayments().filter(p => p.is_paid).map(p => p.id);
                    if (paymentIds.length > 0) {
                      const { error: paymentsError } = await supabase
                        .from('collaborator_payments')
                        .update({ 
                          is_paid: false,
                          payment_date: null,
                          bank_account_id: null
                        })
                        .in('id', paymentIds);

                      if (paymentsError) throw paymentsError;
                    }

                    // Reverter notinhas (event_expenses)
                    const expenseIds = getFilteredExpenses().filter(e => e.is_paid).map(e => e.id);
                    if (expenseIds.length > 0) {
                      const { error: expensesError } = await supabase
                        .from('event_expenses')
                        .update({ 
                          is_paid: false,
                          payment_date: null,
                          payment_bank_account: null
                        })
                        .in('id', expenseIds);

                      if (expensesError) throw expensesError;
                    }

                    toast({
                      title: "Sucesso",
                      description: "Pagamentos revertidos com sucesso"
                    });

                    setPaymentDialog(false);
                    openViewDialog(viewCollaborator);
                  } catch (error) {
                    console.error('Erro ao reverter pagamento:', error);
                    toast({
                      title: "Erro",
                      description: "Erro ao reverter pagamento",
                      variant: "destructive"
                    });
                  }
                }}
              >
                Reverter Pagamentos
              </Button>
              <Button
                onClick={async () => {
                  if (!viewCollaborator || !user?.id) return;

                  if (!paymentFormData.bank_account_id) {
                    toast({
                      title: "Erro",
                      description: "Selecione uma conta bancária",
                      variant: "destructive"
                    });
                    return;
                  }

                  const paymentsTotal = getFilteredPayments().filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount, 0) -
                    getFilteredAdvances().reduce((sum, a) => sum + a.amount, 0);
                  const expensesTotal = getFilteredExpenses().filter(e => !e.is_paid).reduce((sum, e) => sum + e.amount, 0) -
                    getFilteredExpenseAdvances().reduce((sum, a) => sum + a.amount, 0);
                  const salaryTotal = viewSalaryPaid ? 0 : (monthlySalaries.find(s =>
                    s.collaborator_id === viewCollaborator?.id &&
                    s.salary_month === selectedMonthFilter &&
                    s.salary_year === selectedYear
                  )?.salary_amount || 0);

                  const totalAmount =
                    (payItems.payments ? paymentsTotal : 0) +
                    (payItems.expenses ? expensesTotal : 0) +
                    (payItems.salary ? salaryTotal : 0);

                  if (!payItems.payments && !payItems.expenses && !payItems.salary) {
                    toast({
                      title: "Erro",
                      description: "Selecione ao menos um item para pagar",
                      variant: "destructive"
                    });
                    return;
                  }

                  if (totalAmount <= 0) {
                    toast({
                      title: "Erro",
                      description: "Não há valor a pagar",
                      variant: "destructive"
                    });
                    return;
                  }

                  try {
                    // 1. Criar transação bancária
                    const { error: transactionError } = await supabase
                      .from('bank_transactions')
                      .insert({
                        bank_account_id: paymentFormData.bank_account_id,
                        description: `Pagamento - ${viewCollaborator.name} - ${monthNames[selectedMonthFilter]} ${selectedYear}`,
                        amount: totalAmount,
                        transaction_type: 'expense',
                        category: 'Pagamento de Colaboradores',
                        transaction_date: paymentFormData.payment_date
                      });

                    if (transactionError) throw transactionError;

                    // 2. Marcar pagamentos de diárias como pagos
                    if (payItems.payments) {
                      const paymentIds = getFilteredPayments().map(p => p.id);
                      if (paymentIds.length > 0) {
                        const { error: paymentsError } = await supabase
                          .from('collaborator_payments')
                          .update({
                            is_paid: true,
                            payment_date: paymentFormData.payment_date,
                            bank_account_id: paymentFormData.bank_account_id
                          })
                          .in('id', paymentIds);

                        if (paymentsError) throw paymentsError;
                      }
                    }

                    // 3. Marcar notinhas (event_expenses) como pagas
                    if (payItems.expenses) {
                      const expenseIds = getFilteredExpenses().map(e => e.id);
                      if (expenseIds.length > 0) {
                        const { error: expensesError } = await supabase
                          .from('event_expenses')
                          .update({
                            is_paid: true,
                            payment_date: paymentFormData.payment_date,
                            payment_bank_account: bankAccounts.find(b => b.id === paymentFormData.bank_account_id)?.name || ''
                          })
                          .in('id', expenseIds);

                        if (expensesError) throw expensesError;
                      }
                    }

                    // 4. Marcar salário como pago
                    if (payItems.salary && salaryTotal > 0) {
                      const { error: salaryError } = await supabase
                        .from('collaborator_monthly_salaries')
                        .update({
                          is_paid: true,
                          payment_date: paymentFormData.payment_date,
                          bank_account_id: paymentFormData.bank_account_id
                        })
                        .eq('collaborator_id', viewCollaborator.id)
                        .eq('salary_month', selectedMonthFilter)
                        .eq('salary_year', selectedYear);

                      if (salaryError) throw salaryError;

                      // Also update legacy month=0 records
                      await supabase
                        .from('collaborator_monthly_salaries')
                        .update({
                          is_paid: true,
                          payment_date: paymentFormData.payment_date,
                          bank_account_id: paymentFormData.bank_account_id
                        })
                        .eq('collaborator_id', viewCollaborator.id)
                        .eq('salary_month', 0)
                        .eq('salary_year', selectedYear);
                    }

                    toast({
                      title: "Sucesso",
                      description: `Pagamento de ${formatValue(totalAmount)} registrado com sucesso. Todos os lançamentos foram marcados como pagos.`
                    });

                    setPaymentDialog(false);
                    setPaymentFormData({
                      bank_account_id: '',
                      notes: '',
                      payment_date: format(new Date(), 'yyyy-MM-dd')
                    });

                    // Recarregar dados do colaborador
                    openViewDialog(viewCollaborator);
                  } catch (error: any) {
                    console.error('Error processing payment:', error);
                    toast({
                      title: "Erro",
                      description: "Erro ao processar pagamento",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PersonProfileDialog
        open={profileDialogOpen}
        onOpenChange={(open) => {
          setProfileDialogOpen(open);
          if (!open) setProfilePerson(null);
        }}
        personType="collaborator"
        personId={profilePerson?.id ?? null}
        personName={profilePerson?.name ?? null}
        onSaved={() => { void calculateCollaborators(); }}
      />
    </div>
  );
};
