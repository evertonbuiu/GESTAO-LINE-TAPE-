import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Eye, DollarSign, Calendar, Receipt, Upload, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { validateReceiptUpload, SIGNED_URL_TTL_SECONDS, EXPENSE_RECEIPT_BUCKET } from "@/lib/storageUrls";
import * as pdfjsLib from 'pdfjs-dist';

import { PageActions } from "@/components/layout/PageHeader";
interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  description?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  selected_months?: number[];
  selected_year?: number;
  due_day?: number;
  receipt_path?: string;
  created_at: string;
}

interface MonthlyPayment {
  id: string;
  recurring_expense_id: string;
  payment_month: number;
  payment_year: number;
  payment_date: string;
  payment_amount: number;
  bank_account_id: string;
  category: string;
  recurring_expense_name?: string;
  receipt_path?: string;
  created_at: string;
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
}

export const FixedExpenses = () => {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<MonthlyPayment[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [isPayingExpense, setIsPayingExpense] = useState(false);
  const [isConfirmingDiscount, setIsConfirmingDiscount] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<FixedExpense | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<MonthlyPayment | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [isViewingDetails, setIsViewingDetails] = useState(false);
  const [allExpensePayments, setAllExpensePayments] = useState<MonthlyPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useCustomAuth();
  const { toast } = useToast();

  const [newExpense, setNewExpense] = useState({
    name: "",
    category: "",
    amount: 0,
    description: "",
    duration_type: "indefinido" as "indefinido" | "periodo",
    period_selection_type: "meses" as "meses" | "datas",
    selected_months: [] as number[],
    selected_year: new Date().getFullYear(),
    start_date: "",
    end_date: "",
    due_day: 1
  });

  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: 0,
    bank_account_id: ""
  });

  const categories = [
    "Aluguel",
    "Água",
    "Luz",
    "Internet",
    "Telefone",
    "Seguros",
    "Impostos",
    "Salários",
    "Contador",
    "Outros"
  ];

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const monthsShort = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  useEffect(() => {
    // Configure PDF.js worker - use the npm package version
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    
    loadFixedExpenses();
    loadBankAccounts();
    loadMonthlyPayments();
  }, [selectedMonth, selectedYear]);

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, name, balance')
        .order('name', { ascending: true });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const loadFixedExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      
      // Filtrar despesas baseado nos meses e ano selecionados
      const filteredExpenses = (data || []).filter(expense => {
        // Se tem período por datas (start_date e end_date)
        if (expense.start_date && expense.end_date) {
          // Adicionar 'T00:00:00' para evitar problemas de timezone
          const startDate = new Date(expense.start_date + 'T00:00:00');
          const endDate = new Date(expense.end_date + 'T00:00:00');
          
          // Criar data de referência para o mês/ano selecionado (último dia do mês)
          const currentMonthEnd = new Date(selectedYear, selectedMonth, 0);
          // Criar data de referência para início do mês selecionado
          const currentMonthStart = new Date(selectedYear, selectedMonth - 1, 1);
          
          // Verificar se há sobreposição: o período selecionado intersecta com o período da despesa
          return currentMonthStart <= endDate && currentMonthEnd >= startDate;
        }
        
        // Se tem meses selecionados (período por meses específicos)
        if (expense.selected_months && expense.selected_months.length > 0) {
          // Verificar se o mês atual está na lista E se o ano corresponde
          return expense.selected_months.includes(selectedMonth) && expense.selected_year === selectedYear;
        }
        
        // Se não tem meses selecionados nem período de datas, é despesa indefinida - mostrar sempre
        return true;
      });
      
      setFixedExpenses(filteredExpenses);
    } catch (error) {
      console.error('Error loading fixed expenses:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as despesas fixas",
        variant: "destructive"
      });
    }
  };


  const convertPdfToImage = async (pdfFile: File): Promise<File> => {
    const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1); // Get first page

        const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
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

        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolveBlob, rejectBlob) => {
          canvas.toBlob((blob) => {
            if (blob) resolveBlob(blob);
            else rejectBlob(new Error('Could not convert PDF page to an image'));
          }, 'image/jpeg', 0.95);
        });

        // Create a new File object from the blob
        return new File([blob], pdfFile.name.replace('.pdf', '.jpg'), { type: 'image/jpeg' });
  };

  const handleReceiptUpload = async (file: File) => {
    if (!user) return null;

    const validation = validateReceiptUpload(file);
    if (!validation.ok) {
      toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' });
      return null;
    }

    try {
      setUploadingReceipt(true);
      
      let uploadFile = file;
      let fileExt = file.name.split('.').pop()?.toLowerCase();

      // Check if it's a PDF and convert to image
      if (fileExt === 'pdf') {
        toast({
          title: "Processando PDF",
          description: "Convertendo PDF para imagem..."
        });
        
        uploadFile = await convertPdfToImage(file);
        fileExt = 'jpg';
      }

      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      toast({
        title: "Sucesso",
        description: fileExt === 'jpg' && file.name.endsWith('.pdf') 
          ? "PDF convertido e enviado como imagem" 
          : "Comprovante enviado com sucesso"
      });

      return fileName;
    } catch (error) {
      console.error('Error uploading receipt:', error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload do comprovante",
        variant: "destructive"
      });
      return null;
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(EXPENSE_RECEIPT_BUCKET)
        .createSignedUrl(receiptPath, SIGNED_URL_TTL_SECONDS);

      if (error) throw error;

      if (data?.signedUrl) {
        setReceiptUrl(data.signedUrl);
        setViewingReceipt(true);
      }
    } catch (error) {
      console.error('Error viewing receipt:', error);
      toast({
        title: "Erro",
        description: "Erro ao visualizar comprovante",
        variant: "destructive"
      });
    }
  };

  const loadMonthlyPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_expense_monthly_payments')
        .select('*')
        .eq('payment_month', selectedMonth)
        .eq('payment_year', selectedYear)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      
      // Buscar informações das despesas para cada pagamento
      const paymentsWithDetails = await Promise.all(
        (data || []).map(async (payment) => {
          const { data: expenseData } = await supabase
            .from('recurring_expenses')
            .select('name, category')
            .eq('id', payment.recurring_expense_id)
            .single();
          
          return {
            ...payment,
            category: expenseData?.category || 'N/A',
            recurring_expense_name: expenseData?.name || 'N/A'
          };
        })
      );
      
      setMonthlyPayments(paymentsWithDetails);
    } catch (error) {
      console.error('Error loading monthly payments:', error);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.name || !newExpense.category || newExpense.amount <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (newExpense.duration_type === "periodo") {
      if (newExpense.period_selection_type === "meses" && newExpense.selected_months.length === 0) {
        toast({
          title: "Erro",
          description: "Selecione pelo menos um mês",
          variant: "destructive"
        });
        return;
      }

      if (newExpense.period_selection_type === "datas" && (!newExpense.start_date || !newExpense.end_date)) {
        toast({
          title: "Erro",
          description: "Selecione a data de início e fim",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from('recurring_expenses')
        .insert({
          name: newExpense.name,
          category: newExpense.category,
          amount: newExpense.amount,
          description: newExpense.description,
          selected_months: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "meses" ? newExpense.selected_months : null,
          selected_year: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "meses" ? newExpense.selected_year : null,
          start_date: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "datas" ? newExpense.start_date : null,
          end_date: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "datas" ? newExpense.end_date : null,
          due_day: newExpense.due_day,
          is_active: true,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa fixa criada com sucesso"
      });

      setIsAddingExpense(false);
      setNewExpense({ 
        name: "", 
        category: "", 
        amount: 0, 
        description: "",
        duration_type: "indefinido",
        period_selection_type: "meses",
        selected_months: [],
        selected_year: new Date().getFullYear(),
        start_date: "",
        end_date: "",
        due_day: 1
      });
      loadFixedExpenses();
    } catch (error) {
      console.error('Error adding fixed expense:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a despesa fixa",
        variant: "destructive"
      });
    }
  };

  const handleEditExpense = async () => {
    if (!selectedExpense) return;

    if (newExpense.duration_type === "periodo") {
      if (newExpense.period_selection_type === "meses" && newExpense.selected_months.length === 0) {
        toast({
          title: "Erro",
          description: "Selecione pelo menos um mês",
          variant: "destructive"
        });
        return;
      }

      if (newExpense.period_selection_type === "datas" && (!newExpense.start_date || !newExpense.end_date)) {
        toast({
          title: "Erro",
          description: "Selecione a data de início e fim",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({
          name: newExpense.name,
          category: newExpense.category,
          amount: newExpense.amount,
          description: newExpense.description,
          selected_months: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "meses" ? newExpense.selected_months : null,
          selected_year: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "meses" ? newExpense.selected_year : null,
          start_date: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "datas" ? newExpense.start_date : null,
          end_date: newExpense.duration_type === "periodo" && newExpense.period_selection_type === "datas" ? newExpense.end_date : null,
          due_day: newExpense.due_day
        })
        .eq('id', selectedExpense.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa fixa atualizada com sucesso"
      });

      setIsEditingExpense(false);
      setSelectedExpense(null);
      loadFixedExpenses();
    } catch (error) {
      console.error('Error updating fixed expense:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a despesa fixa",
        variant: "destructive"
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta despesa fixa?")) return;

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa fixa excluída com sucesso"
      });

      loadFixedExpenses();
    } catch (error) {
      console.error('Error deleting fixed expense:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a despesa fixa",
        variant: "destructive"
      });
    }
  };

  const handlePayExpense = async () => {
    if (!selectedExpense || !paymentData.bank_account_id || paymentData.payment_amount <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do pagamento",
        variant: "destructive"
      });
      return;
    }

    // Etapa de confirmação com resumo quando o valor pago difere do valor da despesa
    const difference = Number((selectedExpense.amount - paymentData.payment_amount).toFixed(2));
    if (difference !== 0) {
      setIsConfirmingDiscount(true);
      return;
    }

    await executePayment();
  };

  const executePayment = async () => {
    if (!selectedExpense) return;
    const difference = Number((selectedExpense.amount - paymentData.payment_amount).toFixed(2));
    const isDiscount = difference > 0;



    try {
      // Upload receipt first if file was selected
      let receiptPath = null;
      if (receiptFile) {
        receiptPath = await handleReceiptUpload(receiptFile);
        if (!receiptPath) {
          toast({
            title: "Erro",
            description: "Erro ao fazer upload do comprovante",
            variant: "destructive"
          });
          return;
        }
      }

      const { error } = await supabase
        .from('recurring_expense_monthly_payments')
        .insert({
          recurring_expense_id: selectedExpense.id,
          payment_month: selectedMonth,
          payment_year: selectedYear,
          payment_date: paymentData.payment_date,
          payment_amount: paymentData.payment_amount,
          bank_account_id: paymentData.bank_account_id,
          receipt_path: receiptPath,
          created_by: user.id
        });

      if (error) throw error;

      // Diferença tratada como desconto: alinhar o valor da despesa ao valor pago
      if (difference !== 0) {
        const { error: updateError } = await supabase
          .from('recurring_expenses')
          .update({ amount: paymentData.payment_amount })
          .eq('id', selectedExpense.id);
        if (updateError) console.error('Erro ao aplicar desconto na despesa:', updateError);
      }


      // Trigger automático cria a transação bancária

      toast({
        title: "Sucesso",
        description: isDiscount
          ? `Pagamento registrado. Desconto de ${formatCurrency(difference)} aplicado — mês quitado sem pendência.`
          : "Pagamento registrado com sucesso"
      });

      setIsConfirmingDiscount(false);
      setIsPayingExpense(false);
      setReceiptFile(null);
      setPaymentData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: 0,
        bank_account_id: ""
      });
      loadFixedExpenses();
      loadMonthlyPayments();
      loadBankAccounts();

    } catch (error) {
      console.error('Error registering payment:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o pagamento",
        variant: "destructive"
      });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja deletar este pagamento?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('recurring_expense_monthly_payments')
        .delete()
        .eq('id', paymentId);

      if (error) throw error;

      // Trigger automático deleta a transação bancária

      toast({
        title: "Sucesso",
        description: "Pagamento deletado com sucesso"
      });

      loadMonthlyPayments();
      loadBankAccounts();
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast({
        title: "Erro",
        description: "Erro ao deletar pagamento",
        variant: "destructive"
      });
    }
  };

  const handleEditPayment = async () => {
    if (!selectedPayment || !paymentData.bank_account_id || paymentData.payment_amount <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos do pagamento",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('recurring_expense_monthly_payments')
        .update({
          payment_date: paymentData.payment_date,
          payment_amount: paymentData.payment_amount,
          bank_account_id: paymentData.bank_account_id
        })
        .eq('id', selectedPayment.id);

      if (error) throw error;

      // Trigger automático atualiza a transação bancária

      toast({
        title: "Sucesso",
        description: "Pagamento atualizado com sucesso"
      });

      setIsEditingPayment(false);
      setSelectedPayment(null);
      setPaymentData({
        payment_date: new Date().toISOString().split('T')[0],
        payment_amount: 0,
        bank_account_id: ""
      });
      loadMonthlyPayments();
      loadBankAccounts();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar pagamento",
        variant: "destructive"
      });
    }
  };

  const getTotalExpenses = () => {
    return fixedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  };

  const getTotalPaid = () => {
    return monthlyPayments.reduce((sum, pay) => sum + pay.payment_amount, 0);
  };

  const isExpensePaid = (expenseId: string) => {
    return monthlyPayments.some(p => p.recurring_expense_id === expenseId);
  };

  const getExpensePaymentDetails = (expense: FixedExpense) => {
    // Usar allExpensePayments ao invés de monthlyPayments
    const allPayments = allExpensePayments;
    
    // Determinar o total de meses esperados baseado no tipo de período
    let expectedTotalMonths = 0;
    let yearsInvolved: number[] = [];
    
    if (expense.start_date && expense.end_date) {
      // Calcular meses entre start_date e end_date usando apenas ano e mês
      // Adicionar 'T00:00:00' para evitar problemas de timezone
      const startDate = new Date(expense.start_date + 'T00:00:00');
      const endDate = new Date(expense.end_date + 'T00:00:00');
      
      const startYear = startDate.getFullYear();
      const startMonth = startDate.getMonth(); // 0-indexed
      const endYear = endDate.getFullYear();
      const endMonth = endDate.getMonth(); // 0-indexed
      
      // Calcular diferença em meses incluindo o mês inicial e final
      const monthDiff = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
      expectedTotalMonths = monthDiff;
      
      // Criar array de anos envolvidos
      for (let year = startYear; year <= endYear; year++) {
        yearsInvolved.push(year);
      }
    } else if (expense.selected_months && expense.selected_months.length > 0 && expense.selected_year) {
      // Período por meses específicos
      expectedTotalMonths = expense.selected_months.length;
      yearsInvolved = [expense.selected_year];
    } else {
      // Despesa indefinida - calcular com base nos anos que têm pagamentos
      const uniqueYears = [...new Set(allPayments.map(p => p.payment_year))];
      yearsInvolved = uniqueYears;
      expectedTotalMonths = uniqueYears.length * 12;
    }
    
    // Agrupar pagamentos por ano
    const paymentsByYear = allPayments.reduce((acc, payment) => {
      const year = payment.payment_year;
      if (!acc[year]) {
        acc[year] = [];
      }
      acc[year].push(payment);
      return acc;
    }, {} as Record<number, typeof allPayments>);

    // Garantir que todos os anos envolvidos estejam no objeto
    yearsInvolved.forEach(year => {
      if (!paymentsByYear[year]) {
        paymentsByYear[year] = [];
      }
    });

    // Calcular detalhes por ano
    const yearDetails = Object.keys(paymentsByYear)
      .map(year => parseInt(year))
      .sort((a, b) => b - a) // Ordenar do mais recente para o mais antigo
      .map(year => {
        const yearPayments = paymentsByYear[year] || [];
        const paymentsMade = yearPayments.length;
        
        // Calcular meses esperados para este ano específico
        let expectedMonthsThisYear = 12;
        if (expense.start_date && expense.end_date) {
          // Adicionar 'T00:00:00' para evitar problemas de timezone
          const startDate = new Date(expense.start_date + 'T00:00:00');
          const endDate = new Date(expense.end_date + 'T00:00:00');
          const startYear = startDate.getFullYear();
          const startMonth = startDate.getMonth(); // 0-indexed
          const endYear = endDate.getFullYear();
          const endMonth = endDate.getMonth(); // 0-indexed
          
          if (year === startYear && year === endYear) {
            // Ano de início e fim são os mesmos
            expectedMonthsThisYear = (endMonth - startMonth) + 1;
          } else if (year === startYear) {
            // Primeiro ano - do mês inicial até dezembro (mês 11, 0-indexed)
            // De startMonth até mês 11 (dezembro)
            expectedMonthsThisYear = (11 - startMonth) + 1;
          } else if (year === endYear) {
            // Último ano - de janeiro (mês 0) até o mês final
            expectedMonthsThisYear = endMonth + 1;
          } else {
            // Anos intermediários - todos os 12 meses
            expectedMonthsThisYear = 12;
          }
        } else if (expense.selected_months && expense.selected_months.length > 0) {
          expectedMonthsThisYear = expense.selected_months.length;
        }
        
        const paymentsPending = Math.max(0, expectedMonthsThisYear - paymentsMade);
        // Valor pago real (considera descontos em pagamentos parciais)
        const yearValuePaid = yearPayments.reduce((sum, p) => sum + Number(p.payment_amount || 0), 0);
        
        return {
          year,
          totalMonths: expectedMonthsThisYear,
          paymentsMade,
          paymentsPending,
          totalValue: yearValuePaid + expense.amount * paymentsPending,
          valuePaid: yearValuePaid,
          valuePending: expense.amount * paymentsPending,
          payments: yearPayments
        };
      });

    // Calcular totais gerais
    const totalPaymentsMade = allPayments.length;
    const totalPending = Math.max(0, expectedTotalMonths - totalPaymentsMade);
    const totalValuePaid = allPayments.reduce((sum, p) => sum + Number(p.payment_amount || 0), 0);
    
    return {
      totalMonths: expectedTotalMonths,
      paymentsMade: totalPaymentsMade,
      paymentsPending: totalPending,
      totalValue: totalValuePaid + expense.amount * totalPending,
      valuePaid: totalValuePaid,
      valuePending: expense.amount * totalPending,

      yearDetails,
      totalYears: yearsInvolved.length
    };
  };

  const loadAllPaymentsForExpense = async (expenseId: string) => {
    try {
      // Buscar dados do pagamento e incluir o nome/categoria da despesa
      const { data: payments, error: paymentsError } = await supabase
        .from('recurring_expense_monthly_payments')
        .select('*')
        .eq('recurring_expense_id', expenseId)
        .order('payment_date', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Buscar dados da despesa para pegar nome e categoria
      const { data: expense, error: expenseError } = await supabase
        .from('recurring_expenses')
        .select('name, category')
        .eq('id', expenseId)
        .single();

      if (expenseError) throw expenseError;

      // Combinar os dados
      const paymentsWithCategory = (payments || []).map(payment => ({
        ...payment,
        category: expense?.category || '',
        recurring_expense_name: expense?.name || ''
      }));

      setAllExpensePayments(paymentsWithCategory as MonthlyPayment[]);
    } catch (error) {
      console.error('Error loading all payments:', error);
      setAllExpensePayments([]);
    }
  };

  const handleViewDetails = async (expense: FixedExpense) => {
    setSelectedExpense(expense);
    await loadAllPaymentsForExpense(expense.id);
    setIsViewingDetails(true);
  };

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        <Button onClick={() => setIsAddingExpense(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Despesa Fixa
        </Button>
      </PageActions>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Despesas Fixas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(getTotalExpenses())}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {fixedExpenses.length} despesa(s) cadastrada(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pago em {months[selectedMonth - 1]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(getTotalPaid())}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthlyPayments.length} pagamento(s) realizado(s)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(
                fixedExpenses
                  .filter((exp) => !isExpensePaid(exp.id))
                  .reduce((sum, exp) => sum + exp.amount, 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Faltam pagar este mês
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtro de Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium whitespace-nowrap">Ano:</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-full bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 rounded-lg p-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {monthsShort.map((month, index) => (
                  <Button
                    key={index}
                    variant={selectedMonth === index + 1 ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedMonth(index + 1)}
                    className={cn(
                      "min-w-[60px] font-semibold transition-all",
                      selectedMonth === index + 1
                        ? "bg-white text-orange-600 hover:bg-white hover:text-orange-700 shadow-md"
                        : "bg-transparent text-white hover:bg-white/20 hover:text-white"
                    )}
                  >
                    {month}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Despesas Fixas</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos do Mês</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Despesas Fixas</CardTitle>
                <Input
                  placeholder="Buscar despesa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedExpenses
                    .filter(expense => 
                      expense.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      expense.category.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>{expense.category}</TableCell>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>Dia {expense.due_day || 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isExpensePaid(expense.id) ? (
                          <Badge className="bg-green-500">Pago</Badge>
                        ) : (
                          <Badge variant="outline">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(expense)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedExpense(expense);
                              setPaymentData({
                                ...paymentData,
                                payment_amount: expense.amount
                              });
                              setIsPayingExpense(true);
                            }}
                            disabled={isExpensePaid(expense.id)}
                          >
                            <Receipt className="w-4 h-4" />
                          </Button>
                           <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedExpense(expense);
                              setNewExpense({
                                name: expense.name,
                                category: expense.category,
                                amount: expense.amount,
                                description: expense.description || "",
                                duration_type: expense.selected_months && expense.selected_months.length > 0 ? "periodo" : "indefinido",
                                period_selection_type: expense.start_date ? "datas" : "meses",
                                selected_months: expense.selected_months || [],
                                selected_year: expense.selected_year || new Date().getFullYear(),
                                start_date: expense.start_date || "",
                                end_date: expense.end_date || "",
                                due_day: expense.due_day || 1
                              });
                              setIsEditingExpense(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteExpense(expense.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Pagamentos de {months[selectedMonth - 1]} {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Despesa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Valor Pago</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Comprovante</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.payment_date).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{payment.recurring_expense_name}</TableCell>
                      <TableCell>{payment.category}</TableCell>
                      <TableCell>{formatCurrency(payment.payment_amount)}</TableCell>
                      <TableCell>
                        {bankAccounts.find(a => a.id === payment.bank_account_id)?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {payment.receipt_path ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewReceipt(payment.receipt_path!)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem comprovante</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setPaymentData({
                                payment_date: payment.payment_date,
                                payment_amount: payment.payment_amount,
                                bank_account_id: payment.bank_account_id
                              });
                              setIsEditingPayment(true);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePayment(payment.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Adicionar Despesa Fixa */}
      <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Despesa Fixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Despesa</Label>
              <Input
                value={newExpense.name}
                onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
                placeholder="Ex: Aluguel do Escritório"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newExpense.category} onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Mensal</Label>
              <CurrencyInput
                value={newExpense.amount}
                onChange={(value) => setNewExpense({ ...newExpense, amount: value || 0 })}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="Informações adicionais"
              />
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Select
                value={newExpense.due_day?.toString() || "1"}
                onValueChange={(value) => setNewExpense({ ...newExpense, due_day: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dia" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração da Despesa</Label>
              <Select 
                value={newExpense.duration_type} 
                onValueChange={(value: "indefinido" | "periodo") => 
                  setNewExpense({ ...newExpense, duration_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinido">Indeterminado</SelectItem>
                  <SelectItem value="periodo">Período Determinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newExpense.duration_type === "periodo" && (
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Seleção</Label>
                  <Select 
                    value={newExpense.period_selection_type} 
                    onValueChange={(value: "meses" | "datas") => 
                      setNewExpense({ ...newExpense, period_selection_type: value, selected_months: [], start_date: "", end_date: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meses">Meses Específicos</SelectItem>
                      <SelectItem value="datas">Por Período (Data Início/Fim)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newExpense.period_selection_type === "meses" ? (
                  <>
                    <div>
                      <Label>Ano</Label>
                      <Select 
                        value={newExpense.selected_year.toString()} 
                        onValueChange={(value) => setNewExpense({ ...newExpense, selected_year: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026, 2027, 2028].map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Meses em que será despesa fixa</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {months.map((mes, index) => (
                          <div key={index + 1} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`month-new-${index + 1}`}
                              checked={newExpense.selected_months.includes(index + 1)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewExpense({
                                    ...newExpense,
                                    selected_months: [...newExpense.selected_months, index + 1].sort((a, b) => a - b)
                                  });
                                } else {
                                  setNewExpense({
                                    ...newExpense,
                                    selected_months: newExpense.selected_months.filter((m) => m !== index + 1)
                                  });
                                }
                              }}
                              className="rounded border-border"
                            />
                            <label htmlFor={`month-new-${index + 1}`} className="text-sm cursor-pointer">
                              {mes}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Data de Início</Label>
                      <Input
                        type="date"
                        value={newExpense.start_date}
                        onChange={(e) => setNewExpense({ ...newExpense, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Data de Fim</Label>
                      <Input
                        type="date"
                        value={newExpense.end_date}
                        onChange={(e) => setNewExpense({ ...newExpense, end_date: e.target.value })}
                        min={newExpense.start_date}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <Button onClick={handleAddExpense} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Criar Despesa Fixa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Despesa Fixa */}
      <Dialog open={isEditingExpense} onOpenChange={setIsEditingExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Despesa Fixa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Despesa</Label>
              <Input
                value={newExpense.name}
                onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={newExpense.category} onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Mensal</Label>
              <CurrencyInput
                value={newExpense.amount}
                onChange={(value) => setNewExpense({ ...newExpense, amount: value || 0 })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Dia de Vencimento</Label>
              <Select
                value={newExpense.due_day?.toString() || "1"}
                onValueChange={(value) => setNewExpense({ ...newExpense, due_day: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o dia" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <SelectItem key={day} value={day.toString()}>
                      Dia {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duração da Despesa</Label>
              <Select 
                value={newExpense.duration_type} 
                onValueChange={(value: "indefinido" | "periodo") => 
                  setNewExpense({ ...newExpense, duration_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinido">Indeterminado</SelectItem>
                  <SelectItem value="periodo">Período Determinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newExpense.duration_type === "periodo" && (
              <div className="space-y-4">
                <div>
                  <Label>Tipo de Seleção</Label>
                  <Select 
                    value={newExpense.period_selection_type} 
                    onValueChange={(value: "meses" | "datas") => 
                      setNewExpense({ ...newExpense, period_selection_type: value, selected_months: [], start_date: "", end_date: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meses">Meses Específicos</SelectItem>
                      <SelectItem value="datas">Por Período (Data Início/Fim)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newExpense.period_selection_type === "meses" ? (
                  <>
                    <div>
                      <Label>Ano</Label>
                      <Select 
                        value={newExpense.selected_year.toString()} 
                        onValueChange={(value) => setNewExpense({ ...newExpense, selected_year: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[2024, 2025, 2026, 2027, 2028].map((year) => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Meses em que será despesa fixa</Label>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {months.map((mes, index) => (
                          <div key={index + 1} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`month-edit-${index + 1}`}
                              checked={newExpense.selected_months.includes(index + 1)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewExpense({
                                    ...newExpense,
                                    selected_months: [...newExpense.selected_months, index + 1].sort((a, b) => a - b)
                                  });
                                } else {
                                  setNewExpense({
                                    ...newExpense,
                                    selected_months: newExpense.selected_months.filter((m) => m !== index + 1)
                                  });
                                }
                              }}
                              className="rounded border-border"
                            />
                            <label htmlFor={`month-edit-${index + 1}`} className="text-sm cursor-pointer">
                              {mes}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Data de Início</Label>
                      <Input
                        type="date"
                        value={newExpense.start_date}
                        onChange={(e) => setNewExpense({ ...newExpense, start_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Data de Fim</Label>
                      <Input
                        type="date"
                        value={newExpense.end_date}
                        onChange={(e) => setNewExpense({ ...newExpense, end_date: e.target.value })}
                        min={newExpense.start_date}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <Button onClick={handleEditExpense} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={isPayingExpense} onOpenChange={(open) => {
        setIsPayingExpense(open);
        if (!open) {
          setReceiptFile(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento - {selectedExpense?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Valor Pago</Label>
              <CurrencyInput
                value={paymentData.payment_amount}
                onChange={(value) => setPaymentData({ ...paymentData, payment_amount: value || 0 })}
              />
            </div>
            {selectedExpense && paymentData.payment_amount > 0 && paymentData.payment_amount !== selectedExpense.amount && (
              <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">Diferença de valor detectada</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  O valor pago ({formatCurrency(paymentData.payment_amount)}) é diferente do valor da despesa ({formatCurrency(selectedExpense.amount)}). 
                  A diferença de {formatCurrency(Math.abs(selectedExpense.amount - paymentData.payment_amount))} será registrada como desconto.
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label>Conta Bancária</Label>
              <Select value={paymentData.bank_account_id} onValueChange={(value) => setPaymentData({ ...paymentData, bank_account_id: value })}>
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
            <div>
              <Label htmlFor="payment-receipt">Comprovante de Pagamento (Opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="payment-receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setReceiptFile(file);
                    }
                  }}
                  disabled={uploadingReceipt}
                />
                {uploadingReceipt && (
                  <div className="text-sm text-muted-foreground">Enviando...</div>
                )}
              </div>
              {receiptFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Arquivo selecionado: {receiptFile.name}
                </p>
              )}
            </div>
            <Button onClick={handlePayExpense} className="w-full" disabled={uploadingReceipt}>
              <Receipt className="w-4 h-4 mr-2" />
              {uploadingReceipt ? "Enviando..." : "Confirmar Pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação: resumo do desconto antes de salvar */}
      <AlertDialog open={isConfirmingDiscount} onOpenChange={setIsConfirmingDiscount}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar pagamento com diferença</AlertDialogTitle>
            <AlertDialogDescription>
              Revise o impacto antes de salvar. Esta ação ajusta o valor da despesa fixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedExpense && (() => {
            const diff = Number((selectedExpense.amount - paymentData.payment_amount).toFixed(2));
            const isDiscount = diff > 0;
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border divide-y">
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">Despesa</span>
                    <span className="font-medium">{selectedExpense.name}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">Valor atual da despesa</span>
                    <span className="font-medium">{formatCurrency(selectedExpense.amount)}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">Valor pago</span>
                    <span className="font-medium">{formatCurrency(paymentData.payment_amount)}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">{isDiscount ? "Desconto aplicado" : "Acréscimo aplicado"}</span>
                    <span className={cn("font-semibold", isDiscount ? "text-green-600" : "text-amber-600")}>
                      {isDiscount ? "-" : "+"}{formatCurrency(Math.abs(diff))}
                    </span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">Novo valor da despesa</span>
                    <span className="font-semibold">{formatCurrency(paymentData.payment_amount)}</span>
                  </div>
                  <div className="flex justify-between p-2">
                    <span className="text-muted-foreground">Situação do mês</span>
                    <span className="font-semibold text-green-600">Quitado — sem pendência</span>
                  </div>
                </div>
                <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    O valor da despesa fixa passará a ser {formatCurrency(paymentData.payment_amount)} nos próximos meses.
                  </AlertDescription>
                </Alert>
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => executePayment()}>Confirmar e salvar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Dialog: Editar Pagamento */}
      <Dialog open={isEditingPayment} onOpenChange={setIsEditingPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Pagamento - {selectedPayment?.recurring_expense_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Valor Pago</Label>
              <CurrencyInput
                value={paymentData.payment_amount}
                onChange={(value) => setPaymentData({ ...paymentData, payment_amount: value || 0 })}
              />
            </div>
            <div>
              <Label>Conta Bancária</Label>
              <Select value={paymentData.bank_account_id} onValueChange={(value) => setPaymentData({ ...paymentData, bank_account_id: value })}>
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
            <Button onClick={handleEditPayment} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Visualizar Comprovante */}
      <Dialog open={viewingReceipt} onOpenChange={setViewingReceipt}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[75vh]">
            {receiptUrl && (
              <>
                {receiptUrl.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={receiptUrl}
                    className="w-full h-[70vh] border-0"
                    title="Comprovante PDF"
                  />
                ) : (
                  <img
                    src={receiptUrl}
                    alt="Comprovante"
                    className="w-full h-auto"
                  />
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes da Despesa */}
      <Dialog open={isViewingDetails} onOpenChange={setIsViewingDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Despesa - {selectedExpense?.name}</DialogTitle>
          </DialogHeader>
          {selectedExpense && (() => {
            const details = getExpensePaymentDetails(selectedExpense);
            return (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Informações Gerais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categoria:</span>
                      <span className="font-medium">{selectedExpense.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Mensal:</span>
                      <span className="font-medium">{formatCurrency(selectedExpense.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dia do Vencimento:</span>
                      <span className="font-medium">Dia {selectedExpense.due_day || 1}</span>
                    </div>
                    {selectedExpense.description && (
                      <div className="pt-2">
                        <span className="text-muted-foreground">Descrição:</span>
                        <p className="text-sm mt-1">{selectedExpense.description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Resumo Geral (Todos os Anos)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de Anos:</span>
                      <Badge variant="outline">{details.totalYears} ano(s)</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total de Meses:</span>
                      <Badge variant="outline">{details.totalMonths} mês(es)</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Já Pagos:</span>
                      <Badge className="bg-green-500">{details.paymentsMade} mês(es)</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Faltam Pagar:</span>
                      <Badge variant="destructive">{details.paymentsPending} mês(es)</Badge>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Valor Total:</span>
                      <span className="font-bold text-lg">{formatCurrency(details.totalValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Já Pago:</span>
                      <span className="font-medium text-green-600">{formatCurrency(details.valuePaid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Falta Pagar:</span>
                      <span className="font-medium text-orange-600">{formatCurrency(details.valuePending)}</span>
                    </div>
                  </CardContent>
                </Card>

                {details.yearDetails.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Detalhes por Ano</h3>
                    {details.yearDetails.map((yearData) => (
                      <Card key={yearData.year}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Ano {yearData.year}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground">Meses Pagos</span>
                              <p className="text-lg font-semibold text-green-600">{yearData.paymentsMade}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Meses Pendentes</span>
                              <p className="text-lg font-semibold text-orange-600">{yearData.paymentsPending}</p>
                            </div>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground">Valor Pago</span>
                              <p className="text-sm font-medium text-green-600">{formatCurrency(yearData.valuePaid)}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Valor Pendente</span>
                              <p className="text-sm font-medium text-orange-600">{formatCurrency(yearData.valuePending)}</p>
                            </div>
                          </div>
                          <div className="pt-2">
                            <span className="text-xs text-muted-foreground">Meses Pagos:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {yearData.payments.map((payment) => (
                                <Badge key={payment.id} variant="secondary" className="text-xs">
                                  {months[payment.payment_month - 1]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedExpense.selected_months && selectedExpense.selected_months.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Meses Selecionados ({selectedExpense.selected_year})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedExpense.selected_months.sort((a, b) => a - b).map((month) => (
                          <Badge key={month} variant="secondary">
                            {months[month - 1]}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
