import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UtensilsCrossed, Building2, Calendar as CalendarIcon, Plus, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, cn } from "@/lib/utils";
import { normalizeAccountName } from '@/utils/bankAccountMatch';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface WorkerFoodAllowance {
  id: string;
  worker_name: string;
  amount: number;
  allowance_date: string;
  bank_account_id: string | null;
  notes: string | null;
  event_id: string | null;
  allowance_type: string;
  bank_accounts?: {
    name: string;
  };
  events?: {
    name: string;
    event_date: string;
  };
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
}

interface WorkerFoodAllowanceCalendarProps {
  workerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedMonth: number;
  selectedYear: number;
  canEdit: boolean;
}

export const WorkerFoodAllowanceCalendar = ({
  workerName,
  open,
  onOpenChange,
  selectedMonth,
  selectedYear,
  canEdit
}: WorkerFoodAllowanceCalendarProps) => {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const { canViewValues, formatValue } = useValueVisibility();
  const { settings: companySettings } = useCompanySettings();
  const { logoUrl } = useLogo();
  
  const [foodAllowances, setFoodAllowances] = useState<WorkerFoodAllowance[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [addDialog, setAddDialog] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date(selectedYear, selectedMonth, 1));
  const [eventFilterMonth, setEventFilterMonth] = useState<number | 'all'>('all');
  const [eventFilterYear, setEventFilterYear] = useState<number>(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Bulk selection for current month allowances
  const currentMonthAllowancesForBulk = foodAllowances.filter(a => {
    const allowanceDate = new Date(a.allowance_date + 'T12:00:00');
    return isSameMonth(allowanceDate, calendarMonth);
  });

  const bulkSelection = useBulkSelection({
    items: currentMonthAllowancesForBulk,
    getItemId: (item) => item.id
  });
  
  const [formData, setFormData] = useState({
    amount: 0,
    allowance_type: 'galpao' as 'galpao' | 'evento',
    event_id: '',
    bank_account_id: '',
    notes: '',
    payment_date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (open && workerName) {
      fetchFoodAllowances();
      fetchBankAccounts();
      fetchEvents();
      setCalendarMonth(new Date(selectedYear, selectedMonth, 1));
      setSelectedDates([]);
    }
  }, [open, workerName, selectedMonth, selectedYear]);

  const fetchFoodAllowances = async () => {
    try {
      const { data, error } = await supabase
        .from('worker_food_allowances')
        .select(`
          *,
          bank_accounts (
            name
          ),
          events (
            name,
            event_date
          )
        `)
        .eq('worker_name', workerName)
        .order('allowance_date', { ascending: false });

      if (error) throw error;
      setFoodAllowances(data || []);
    } catch (error: any) {
      console.error('Error fetching worker food allowances:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar diárias de alimentação",
        variant: "destructive"
      });
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        supabase.from('bank_accounts').select('id, name').order('name'),
        supabase.from('bank_transactions').select('bank_account_id, amount, transaction_type')
      ]);

      if (accountsRes.error) throw accountsRes.error;

      const accounts = accountsRes.data || [];
      const transactions = transactionsRes.data || [];

      const accountsWithBalance: BankAccount[] = accounts.map((account) => {
        const txs = transactions.filter((t: any) => t.bank_account_id === account.id);
        const calculatedBalance = txs.reduce((sum: number, t: any) => {
          return t.transaction_type === 'income' ? sum + Number(t.amount) : sum - Number(t.amount);
        }, 0);

        return {
          id: account.id,
          name: account.name,
          balance: calculatedBalance,
        };
      });

      setBankAccounts(accountsWithBalance);
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
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
    } catch (error: any) {
      console.error('Error fetching events:', error);
    }
  };

  const handleDateClick = (date: Date | undefined) => {
    if (!date || !canEdit) return;
    
    const isSelected = selectedDates.some(d => isSameDay(d, date));
    
    if (isSelected) {
      setSelectedDates(prev => prev.filter(d => !isSameDay(d, date)));
    } else {
      setSelectedDates(prev => [...prev, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const handleOpenPaymentDialog = () => {
    if (selectedDates.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos uma data no calendário",
        variant: "destructive"
      });
      return;
    }
    
    setFormData({
      amount: 0,
      allowance_type: 'galpao',
      event_id: '',
      bank_account_id: '',
      notes: '',
      payment_date: format(new Date(), 'yyyy-MM-dd')
    });
    setAddDialog(true);
  };

  const handleAddAllowances = async () => {
    if (selectedDates.length === 0 || !user?.id) return;
    
    if (formData.amount <= 0) {
      toast({
        title: "Erro",
        description: "O valor da diária deve ser maior que zero",
        variant: "destructive"
      });
      return;
    }

    if (!formData.bank_account_id) {
      toast({
        title: "Erro",
        description: "Selecione uma conta bancária",
        variant: "destructive"
      });
      return;
    }

    if (formData.allowance_type === 'evento' && !formData.event_id) {
      toast({
        title: "Erro",
        description: "Selecione um evento",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedBankAccount = bankAccounts.find(b => b.id === formData.bank_account_id);
      const totalAmount = formData.amount * selectedDates.length;
      const paymentDate = formData.payment_date; // Data do pagamento escolhida pelo usuário
      const dateRange = selectedDates.length === 1 
        ? format(selectedDates[0], 'dd/MM/yyyy', { locale: ptBR })
        : `${format(selectedDates[0], 'dd/MM', { locale: ptBR })} a ${format(selectedDates[selectedDates.length - 1], 'dd/MM/yyyy', { locale: ptBR })}`;

      const allowanceIds: string[] = [];

      // Create allowances for each selected date
      for (const date of selectedDates) {
        const allowanceDate = format(date, 'yyyy-MM-dd');

        const { data: allowanceData, error: allowanceError } = await supabase
          .from('worker_food_allowances')
          .insert({
            worker_name: workerName,
            amount: formData.amount,
            allowance_date: allowanceDate,
            bank_account_id: formData.bank_account_id,
            notes: formData.notes || null,
            allowance_type: formData.allowance_type,
            event_id: formData.allowance_type === 'evento' ? formData.event_id : null,
            created_by: user.id
          })
          .select()
          .single();

        if (allowanceError) throw allowanceError;
        allowanceIds.push(allowanceData.id);
      }

      // Create consolidated description
      const consolidatedDescription = `Diárias de alimentação - ${workerName} (${selectedDates.length}x) - ${dateRange}`;
      const primaryReferenceId = allowanceIds[0];
      const batchNotes = formData.notes 
        ? `${formData.notes} | IDs: ${allowanceIds.join(',')}` 
        : `IDs: ${allowanceIds.join(',')}`;

      // If EVENTO: create event expense AND bank transaction
      if (formData.allowance_type === 'evento' && formData.event_id) {
        const { error: expenseError } = await supabase
          .from('event_expenses')
          .insert({
            event_id: formData.event_id,
            category: 'Diárias de Alimentação',
            description: consolidatedDescription,
            quantity: selectedDates.length,
            unit_price: formData.amount,
            total_price: totalAmount,
            expense_date: paymentDate,
            expense_bank_account: selectedBankAccount?.name || null,
            notes: batchNotes,
            reference_type: 'worker_food_allowance_batch',
            reference_id: primaryReferenceId,
            created_by: user.id
          });

        if (expenseError) {
          console.error('Error creating event expense:', expenseError);
        }

        const { error: transactionError } = await supabase
          .from('bank_transactions')
          .insert({
            bank_account_id: formData.bank_account_id,
            description: consolidatedDescription,
            amount: totalAmount,
            transaction_type: 'expense',
            category: 'Diárias de Alimentação',
            transaction_date: paymentDate,
            notes: batchNotes,
            reference_type: 'worker_food_allowance_batch',
            reference_id: primaryReferenceId
          });

        if (transactionError) {
          console.error('Error creating bank transaction:', transactionError);
        }
      }

      // If GALPÃO: create bank transaction only
      if (formData.allowance_type === 'galpao') {
        const { error: transactionError } = await supabase
          .from('bank_transactions')
          .insert({
            bank_account_id: formData.bank_account_id,
            description: consolidatedDescription,
            amount: totalAmount,
            transaction_type: 'expense',
            category: 'Diárias de Alimentação',
            transaction_date: paymentDate,
            notes: batchNotes,
            reference_type: 'worker_food_allowance_batch',
            reference_id: primaryReferenceId
          });

        if (transactionError) {
          console.error('Error creating bank transaction:', transactionError);
        }
      }

      toast({
        title: "Sucesso",
        description: `${selectedDates.length} diária(s) de alimentação adicionada(s) - Total: ${formatCurrency(totalAmount)}`
      });

      setAddDialog(false);
      setSelectedDates([]);
      fetchFoodAllowances();
      fetchBankAccounts();
    } catch (error: any) {
      console.error('Error adding worker food allowances:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar diárias de alimentação",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllowance = async (allowanceId: string, allowanceType: string) => {
    if (!confirm('Tem certeza que deseja excluir esta diária de alimentação?')) return;

    try {
      // First, fetch the allowance data for company_expenses cleanup
      const { data: allowanceData, error: fetchError } = await supabase
        .from('worker_food_allowances')
        .select('*')
        .eq('id', allowanceId)
        .single();

      if (fetchError) {
        console.error('Error fetching allowance data:', fetchError);
      }

      // Delete linked expenses and transactions
      // Always try to delete individual reference (from imports)
      await supabase
        .from('event_expenses')
        .delete()
        .eq('reference_type', 'worker_food_allowance')
        .eq('reference_id', allowanceId);
      
      if (allowanceType === 'evento') {
        // Also delete batch references (from batch creation)
        await supabase
          .from('event_expenses')
          .delete()
          .eq('reference_type', 'worker_food_allowance_batch')
          .eq('reference_id', allowanceId);

        const { data: batchExpenses } = await supabase
          .from('event_expenses')
          .select('id, reference_id, notes')
          .eq('reference_type', 'worker_food_allowance_batch');
        
        if (batchExpenses) {
          for (const expense of batchExpenses) {
            if (expense.notes && expense.notes.includes(allowanceId)) {
              await supabase
                .from('event_expenses')
                .delete()
                .eq('id', expense.id);
            }
          }
        }
      }

      // Delete from company_expenses if this was a "Galpão" allowance
      // This handles allowances imported via bank reconciliation
      if (allowanceData && allowanceType === 'galpao') {
        const { error: companyExpenseError } = await supabase
          .from('company_expenses')
          .delete()
          .eq('category', 'Diarista - Alimentação')
          .eq('supplier', allowanceData.worker_name)
          .eq('expense_date', allowanceData.allowance_date)
          .eq('total_price', allowanceData.amount);

        if (companyExpenseError) {
          console.error('Error deleting linked company expense:', companyExpenseError);
        }

        // Delete from bank_transactions for Galpão allowances (imported via reconciliation)
        const { error: bankTransactionError } = await supabase
          .from('bank_transactions')
          .delete()
          .eq('category', 'Alimentação Diarista')
          .eq('transaction_date', allowanceData.allowance_date)
          .eq('amount', allowanceData.amount);

        if (bankTransactionError) {
          console.error('Error deleting linked bank transaction:', bankTransactionError);
        }
      }

      // Also try to delete individual reference from imports
      await supabase
        .from('bank_transactions')
        .delete()
        .eq('reference_type', 'worker_food_allowance')
        .eq('reference_id', allowanceId);

      // Delete bank transactions
      await supabase
        .from('bank_transactions')
        .delete()
        .eq('reference_type', 'worker_food_allowance_batch')
        .eq('reference_id', allowanceId);

      const { data: batchTransactions } = await supabase
        .from('bank_transactions')
        .select('id, reference_id, notes')
        .eq('reference_type', 'worker_food_allowance_batch');
      
      if (batchTransactions) {
        for (const transaction of batchTransactions) {
          if (transaction.notes && transaction.notes.includes(allowanceId)) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('id', transaction.id);
          }
        }
      }

      // Delete the food allowance
      const { error } = await supabase
        .from('worker_food_allowances')
        .delete()
        .eq('id', allowanceId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Diária de alimentação excluída com sucesso"
      });

      fetchFoodAllowances();
      fetchBankAccounts();
    } catch (error: any) {
      console.error('Error deleting worker food allowance:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir diária de alimentação",
        variant: "destructive"
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedDates([]);
  };

  // Bulk delete food allowances
  const handleBulkDelete = async () => {
    if (bulkSelection.selectedCount === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${bulkSelection.selectedCount} diária(s) de alimentação?`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const idsToDelete = Array.from(bulkSelection.selectedIds);
      
      for (const allowanceId of idsToDelete) {
        const allowance = currentMonthAllowancesForBulk.find(a => a.id === allowanceId);
        if (!allowance) continue;
        
        // Delete linked event expenses
        if (allowance.allowance_type === 'evento') {
          await supabase
            .from('event_expenses')
            .delete()
            .eq('reference_type', 'worker_food_allowance')
            .eq('reference_id', allowanceId);
            
          await supabase
            .from('event_expenses')
            .delete()
            .eq('reference_type', 'worker_food_allowance_batch')
            .eq('reference_id', allowanceId);
        }
        
        // Delete bank transactions
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'worker_food_allowance')
          .eq('reference_id', allowanceId);
          
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'worker_food_allowance_batch')
          .eq('reference_id', allowanceId);
          
        // For galpao, also delete company expenses
        if (allowance.allowance_type === 'galpao') {
          await supabase
            .from('company_expenses')
            .delete()
            .eq('category', 'Diarista - Alimentação')
            .eq('supplier', allowance.worker_name)
            .eq('expense_date', allowance.allowance_date)
            .eq('total_price', allowance.amount);
        }
      }

      // Delete all food allowances
      const { error } = await supabase
        .from('worker_food_allowances')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `${idsToDelete.length} diária(s) excluída(s) com sucesso`
      });

      bulkSelection.clearSelection();
      fetchFoodAllowances();
      fetchBankAccounts();
    } catch (error: any) {
      console.error('Error bulk deleting worker food allowances:', error);
      toast({
        title: "Erro",
        description: "Erro ao excluir diárias de alimentação",
        variant: "destructive"
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Generate PDF
  const generatePDF = async () => {
    const doc = new jsPDF({ compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const addLetterhead = async (pageNumber: number) => {
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
      
      doc.setLineWidth(0.5);
      doc.line(14, 45, pageWidth - 14, 45);
      
      doc.setFontSize(8);
      doc.text(`Página ${pageNumber}`, pageWidth - 30, 10);
    };
    
    await addLetterhead(1);
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    const monthName = monthNames[calendarMonth.getMonth()];
    doc.text(`Diárias de Alimentação - ${workerName}`, 14, 52);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Período: ${monthName}/${calendarMonth.getFullYear()}`, 14, 58);
    
    let finalY = 65;
    
    const allowancesEvento = currentMonthAllowances.filter(a => a.allowance_type === 'evento');
    const allowancesGalpao = currentMonthAllowances.filter(a => a.allowance_type === 'galpao');
    
    if (allowancesEvento.length > 0) {
      const eventoData = allowancesEvento.map(allowance => [
        format(new Date(allowance.allowance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        allowance.events?.name || '-',
        allowance.bank_accounts?.name || '-',
        formatCurrency(allowance.amount),
        allowance.notes || '-'
      ]);
      
      const totalEvento = allowancesEvento.reduce((sum, a) => sum + Number(a.amount), 0);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Diárias de Evento', 14, finalY);
      
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Data', 'Evento', 'Conta', 'Valor', 'Observações']],
        body: eventoData,
        foot: [['', '', 'TOTAL', formatCurrency(totalEvento), '']],
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
    
    if (allowancesGalpao.length > 0) {
      const galpaoData = allowancesGalpao.map(allowance => [
        format(new Date(allowance.allowance_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        allowance.bank_accounts?.name || '-',
        formatCurrency(allowance.amount),
        allowance.notes || '-'
      ]);
      
      const totalGalpao = allowancesGalpao.reduce((sum, a) => sum + Number(a.amount), 0);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('Diárias de Galpão', 14, finalY + 10);
      
      autoTable(doc, {
        startY: finalY + 15,
        head: [['Data', 'Conta', 'Valor', 'Observações']],
        body: galpaoData,
        foot: [['', 'TOTAL', formatCurrency(totalGalpao), '']],
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
    
    const totalEvento = allowancesEvento.reduce((sum, a) => sum + Number(a.amount), 0);
    const totalGalpao = allowancesGalpao.reduce((sum, a) => sum + Number(a.amount), 0);
    const totalGeral = totalEvento + totalGalpao;
    
    if (currentMonthAllowances.length > 0) {
      let currentY = finalY + 15;
      const barHeight = 10;
      const barSpacing = 2;
      const barWidth = pageWidth - 28;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      
      if (totalEvento > 0) {
        doc.setFillColor(59, 130, 246);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total Diárias de Evento:', 18, currentY + 7);
        doc.text(formatCurrency(totalEvento), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      if (totalGalpao > 0) {
        doc.setFillColor(34, 197, 94);
        doc.rect(14, currentY, barWidth, barHeight, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text('Total Diárias de Galpão:', 18, currentY + 7);
        doc.text(formatCurrency(totalGalpao), pageWidth - 18, currentY + 7, { align: 'right' });
        currentY += barHeight + barSpacing;
      }
      
      doc.setFillColor(147, 51, 234);
      doc.rect(14, currentY, barWidth, barHeight + 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.text('TOTAL GERAL:', 18, currentY + 8);
      doc.text(formatCurrency(totalGeral), pageWidth - 18, currentY + 8, { align: 'right' });
    }
    
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setTextColor(128, 128, 128);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 10);
    
    doc.save(`diarias_alimentacao_diarista_${workerName.replace(/\s+/g, '_')}_${monthName}_${calendarMonth.getFullYear()}.pdf`);
    
    toast({
      title: "PDF gerado",
      description: "O relatório foi baixado com sucesso"
    });
  };

  // Get allowances for the displayed month
  // Get allowances for the displayed month (alias for bulk selection)
  const currentMonthAllowances = currentMonthAllowancesForBulk;

  // Get dates with allowances for calendar highlighting
  const datesWithAllowances = foodAllowances.map(a => new Date(a.allowance_date + 'T12:00:00'));

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Filter events based on month/year selection
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.event_date + 'T12:00:00');
    const matchesYear = eventDate.getFullYear() === eventFilterYear;
    const matchesMonth = eventFilterMonth === 'all' || eventDate.getMonth() === eventFilterMonth;
    return matchesYear && matchesMonth;
  });

  const totalSelectedAmount = formData.amount * selectedDates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Diárias de Alimentação - {workerName}
            </DialogTitle>
            <Button 
              onClick={generatePDF} 
              variant="outline" 
              size="sm"
              disabled={currentMonthAllowances.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
          <DialogDescription>
            Selecione múltiplas datas no calendário e faça o pagamento de uma única vez
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calendar */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Selecione as datas
                </span>
                {selectedDates.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar ({selectedDates.length})
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={handleDateClick}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                locale={ptBR}
                className="pointer-events-auto"
                modifiers={{
                  hasAllowance: datesWithAllowances,
                  selected: selectedDates
                }}
                modifiersStyles={{
                  hasAllowance: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    fontWeight: 'bold',
                    borderRadius: '50%'
                  },
                  selected: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold',
                    borderRadius: '50%'
                  }
                }}
              />
              
              {canEdit && (
                <div className="mt-4 space-y-3">
                  {selectedDates.length > 0 && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedDates.map((date, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {format(date, 'dd/MM')}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedDates.length} data(s) selecionada(s)
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleOpenPaymentDialog} 
                    className="w-full"
                    disabled={selectedDates.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Registrar Pagamento ({selectedDates.length} data{selectedDates.length !== 1 ? 's' : ''})
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* List of allowances for the month */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {canEdit && currentMonthAllowances.length > 0 && (
                    <Checkbox
                      checked={bulkSelection.isAllSelected}
                      onCheckedChange={bulkSelection.toggleSelectAll}
                      aria-label="Selecionar todas"
                    />
                  )}
                  <span>
                    Diárias de {monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                  </span>
                </div>
                <Badge variant="secondary">
                  {currentMonthAllowances.length} {currentMonthAllowances.length === 1 ? 'diária' : 'diárias'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentMonthAllowances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma diária registrada neste mês</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[350px] overflow-y-auto">
                  {currentMonthAllowances.map((allowance) => (
                    <div 
                      key={allowance.id} 
                      className={cn(
                        "flex items-center justify-between p-3 bg-muted/50 rounded-lg border",
                        bulkSelection.isSelected(allowance.id) && "border-primary bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <Checkbox
                            checked={bulkSelection.isSelected(allowance.id)}
                            onCheckedChange={() => bulkSelection.toggleSelection(allowance.id)}
                            aria-label={`Selecionar diária de ${format(new Date(allowance.allowance_date + 'T12:00:00'), 'dd/MM/yyyy')}`}
                          />
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {format(new Date(allowance.allowance_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </span>
                            <Badge variant={allowance.allowance_type === 'evento' ? 'default' : 'outline'}>
                              {allowance.allowance_type === 'evento' ? (
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  Evento
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  Galpão
                                </span>
                              )}
                            </Badge>
                          </div>
                          {allowance.allowance_type === 'evento' && allowance.events && (
                            <p className="text-sm text-muted-foreground">
                              {allowance.events.name}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            {allowance.bank_accounts?.name || 'Sem conta'}
                            {allowance.notes && ` • ${allowance.notes}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">
                          {canViewValues ? formatValue(allowance.amount) : '***'}
                        </span>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteAllowance(allowance.id, allowance.allowance_type)} title="Excluir" aria-label="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canViewValues && currentMonthAllowances.length > 0 && (
                <div className="flex justify-end items-center gap-4 p-4 bg-primary/10 rounded-lg mt-4">
                  <span className="font-semibold">Total do mês:</span>
                  <span className="text-lg font-bold text-primary">
                    {formatValue(currentMonthAllowances.reduce((sum, a) => sum + Number(a.amount), 0))}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={bulkSelection.selectedCount}
          onDelete={handleBulkDelete}
          onCancel={bulkSelection.clearSelection}
          isDeleting={isBulkDeleting}
        />

        {/* Add Allowances Dialog */}
        <Dialog open={addDialog} onOpenChange={setAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Registrar Pagamento de Diárias
              </DialogTitle>
              <DialogDescription>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedDates.map((date, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {format(date, 'dd/MM/yyyy', { locale: ptBR })}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2">
                  {selectedDates.length} data(s) selecionada(s)
                </p>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Vínculo *</Label>
                <Select
                  value={formData.allowance_type}
                  onValueChange={(value: 'galpao' | 'evento') => setFormData({ ...formData, allowance_type: value, event_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="galpao">
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Galpão
                      </span>
                    </SelectItem>
                    <SelectItem value="evento">
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" />
                        Evento
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.allowance_type === 'evento' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Mês</Label>
                      <Select
                        value={eventFilterMonth.toString()}
                        onValueChange={(value) => {
                          setEventFilterMonth(value === 'all' ? 'all' : parseInt(value));
                          setFormData({ ...formData, event_id: '' });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {monthNames.map((month, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {month}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Ano</Label>
                      <Select
                        value={eventFilterYear.toString()}
                        onValueChange={(value) => {
                          setEventFilterYear(parseInt(value));
                          setFormData({ ...formData, event_id: '' });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...Array(5)].map((_, i) => {
                            const year = new Date().getFullYear() - 2 + i;
                            return (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Evento *</Label>
                    <Select
                      value={formData.event_id}
                      onValueChange={(value) => setFormData({ ...formData, event_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredEvents.length === 0 ? (
                          <div className="p-2 text-center text-sm text-muted-foreground">
                            Nenhum evento encontrado
                          </div>
                        ) : (
                          filteredEvents.map((event) => (
                            <SelectItem key={event.id} value={event.id}>
                              <span className="flex items-center gap-2">
                                <span>{event.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy')})
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Valor por Diária *</Label>
                <CurrencyInput
                  value={formData.amount}
                  onChange={(value) => setFormData({ ...formData, amount: value || 0 })}
                  placeholder="R$ 0,00"
                />
              </div>

              <div className="space-y-2">
                <Label>Conta Bancária *</Label>
                <Select
                  value={formData.bank_account_id}
                  onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <span className="flex items-center justify-between w-full gap-2">
                          <span>{account.name}</span>
                          {canViewValues && (
                            <span className="text-xs text-muted-foreground">
                              (Saldo: {formatCurrency(account.balance)})
                            </span>
                          )}
                        </span>
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
                        !formData.payment_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.payment_date 
                        ? format(new Date(formData.payment_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.payment_date ? new Date(formData.payment_date + 'T12:00:00') : undefined}
                      onSelect={(date) => setFormData({ 
                        ...formData, 
                        payment_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                      })}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Esta data será registrada na gestão financeira
                </p>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observações opcionais..."
                  rows={2}
                />
              </div>

              {formData.amount > 0 && selectedDates.length > 0 && (
                <div className="p-4 bg-primary/10 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Valor por diária:</span>
                    <span>{formatCurrency(formData.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Quantidade de datas:</span>
                    <span>{selectedDates.length}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total a pagar:</span>
                    <span className="text-primary">{formatCurrency(totalSelectedAmount)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddAllowances} disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : `Confirmar Pagamento`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
