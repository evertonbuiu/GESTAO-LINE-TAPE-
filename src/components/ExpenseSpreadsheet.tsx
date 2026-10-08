import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Calendar, Edit, Trash2, FileSpreadsheet, FileText, Upload, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Checkbox } from "@/components/ui/checkbox";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { BulkActionsBar } from "@/components/ui/BulkActionsBar";

import { PageActions } from "@/components/layout/PageHeader";
interface DailyExpense {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  expense_bank_account?: string;
  notes?: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

interface ExpenseCategory {
  name: string;
  budget: number;
  spent: number;
}

export const ExpenseSpreadsheet = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<DailyExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [editingCategoryBudget, setEditingCategoryBudget] = useState<ExpenseCategory | null>(null);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [newReceiptFile, setNewReceiptFile] = useState<File | null>(null);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  
  const { user } = useCustomAuth();

  // Hook para seleção múltipla
  const expenseSelection = useBulkSelection({
    items: expenses,
    getItemId: useCallback((expense: DailyExpense) => expense.id, [])
  });

  // Função para exclusão em lote
  const handleBulkDeleteExpenses = async () => {
    if (expenseSelection.selectedCount === 0) return;
    
    if (!confirm(`Tem certeza que deseja excluir ${expenseSelection.selectedCount} despesa(s)?`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      const idsToDelete = Array.from(expenseSelection.selectedIds);
      
      // Tentar deletar de company_expenses
      const { error: companyError } = await supabase
        .from('company_expenses')
        .delete()
        .in('id', idsToDelete);

      // Tentar deletar de event_expenses
      const { error: eventError } = await supabase
        .from('event_expenses')
        .delete()
        .in('id', idsToDelete);

      if (companyError && eventError) {
        throw new Error('Erro ao excluir despesas');
      }

      toast({
        title: "Sucesso",
        description: `${idsToDelete.length} despesa(s) excluída(s) com sucesso`
      });

      expenseSelection.clearSelection();
      loadExpenses();
    } catch (error) {
      console.error('Erro ao excluir despesas em lote:', error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir as despesas",
        variant: "destructive"
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  // Configurar PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }, []);

  // Função para converter PDF em imagem
  const convertPdfToImage = async (file: File): Promise<Blob> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // Primeira página

    const scale = 2; // Aumentar escala para melhor qualidade
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível criar contexto canvas');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Falha ao converter canvas para blob'));
        }
      }, 'image/png');
    });
  };

  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateSafely = (dateString: string): string => {
    if (!dateString) return '';
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return format(date, 'dd/MM/yyyy');
  };

  const [newExpense, setNewExpense] = useState({
    date: getLocalDateString(),
    description: "",
    category: "",
    amount: 0,
    expense_bank_account: "",
    notes: "",
    receipt_url: "",
    receipt_file: null as File | null
  });

  const expenseCategories = [
    "Equipamentos",
    "Despesas Operacionais", 
    "Pessoal",
    "Marketing",
    "Alimentação",
    "Transporte",
    "Diárias",
    "Insumos",
    "Outros"
  ];

  const loadExpenses = async () => {
    try {
      setLoading(true);
      
      // Calcular o último dia do mês corretamente
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthStr = selectedMonth.toString().padStart(2, '0');
      const lastDayStr = lastDayOfMonth.toString().padStart(2, '0');
      
      console.log(`Carregando despesas para período: ${selectedYear}-${monthStr}-01 até ${selectedYear}-${monthStr}-${lastDayStr}`);
      if (selectedDay) {
        console.log(`Filtro por dia específico: ${selectedDay}`);
      }
      
      // Buscar despesas da empresa (company_expenses)
      let companyQuery = supabase
        .from('company_expenses')
        .select('*');

      // Aplicar filtros de data
      if (selectedDay) {
        companyQuery = companyQuery.eq('expense_date', selectedDay);
      } else {
        companyQuery = companyQuery
          .gte('expense_date', `${selectedYear}-${monthStr}-01`)
          .lte('expense_date', `${selectedYear}-${monthStr}-${lastDayStr}`);
      }

      // Buscar despesas de eventos (event_expenses) apenas com conta bancária vinculada
      let eventQuery = supabase
        .from('event_expenses')
        .select('*')
        .not('expense_bank_account', 'is', null)
        .neq('expense_bank_account', '');

      // Aplicar filtros de data para eventos também
      if (selectedDay) {
        eventQuery = eventQuery.eq('expense_date', selectedDay);
      } else {
        eventQuery = eventQuery
          .gte('expense_date', `${selectedYear}-${monthStr}-01`)
          .lte('expense_date', `${selectedYear}-${monthStr}-${lastDayStr}`);
      }

      const [companyResult, eventResult] = await Promise.all([
        companyQuery.order('expense_date', { ascending: false }),
        eventQuery.order('expense_date', { ascending: false })
      ]);

      if (companyResult.error) throw companyResult.error;
      if (eventResult.error) throw eventResult.error;

      console.log('Despesas da empresa encontradas:', companyResult.data?.length || 0);
      console.log('Despesas de eventos encontradas:', eventResult.data?.length || 0);

      // Mapear despesas da empresa
      const companyExpenses: DailyExpense[] = companyResult.data?.map(expense => {
        console.log(`Despesa empresa - ID: ${expense.id}, Data: ${expense.expense_date}, Descrição: ${expense.description}`);
        return {
          id: expense.id,
          date: expense.expense_date || '',
          description: expense.description || '',
          category: expense.category || '',
          amount: expense.total_price || 0,
          expense_bank_account: expense.expense_bank_account || '',
          notes: expense.notes || '',
          receipt_url: expense.receipt_url || '',
          created_by: expense.created_by || '',
          created_at: expense.created_at || ''
        };
      }) || [];

      // Mapear despesas de eventos
      const eventExpenses: DailyExpense[] = eventResult.data?.map(expense => {
        console.log(`Despesa evento - ID: ${expense.id}, Data: ${expense.expense_date}, Descrição: ${expense.description}`);
        return {
          id: expense.id,
          date: expense.expense_date || '',
          description: expense.description || '',
          category: expense.category || '',
          amount: expense.total_price || 0,
          expense_bank_account: expense.expense_bank_account || '',
          notes: expense.notes || '',
          receipt_url: expense.receipt_url || '',
          created_by: expense.created_by || '',
          created_at: expense.created_at || ''
        };
      }) || [];

      const allExpenses = [...companyExpenses, ...eventExpenses]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log('Total de despesas carregadas:', allExpenses.length);
      setExpenses(allExpenses);
      
      // Calcular categorias e gastos
      const categoryMap: { [key: string]: number } = {};
      allExpenses.forEach(expense => {
        categoryMap[expense.category] = (categoryMap[expense.category] || 0) + expense.amount;
      });

      const categoryData = Object.entries(categoryMap).map(([name, spent]) => ({
        name,
        budget: categoryBudgets[name] || 0,
        spent
      }));

      setCategories(categoryData);
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as despesas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('name')
        .order('name');

      if (error) throw error;
      
      const accounts = data?.map(account => account.name) || [];
      setBankAccounts(accounts);
    } catch (error) {
      console.error('Erro ao carregar contas bancárias:', error);
    }
  };

  const loadCategoryBudgets = () => {
    try {
      const savedBudgets = localStorage.getItem('category-budgets');
      if (savedBudgets) {
        setCategoryBudgets(JSON.parse(savedBudgets));
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos das categorias:', error);
    }
  };

  const saveCategoryBudgets = (budgets: Record<string, number>) => {
    try {
      localStorage.setItem('category-budgets', JSON.stringify(budgets));
      setCategoryBudgets(budgets);
    } catch (error) {
      console.error('Erro ao salvar orçamentos das categorias:', error);
    }
  };

  const handleEditCategoryBudget = (category: ExpenseCategory) => {
    setEditingCategoryBudget({ ...category });
  };

  const handleSaveCategoryBudget = () => {
    if (!editingCategoryBudget) return;
    
    const updatedBudgets = {
      ...categoryBudgets,
      [editingCategoryBudget.name]: editingCategoryBudget.budget
    };
    
    saveCategoryBudgets(updatedBudgets);
    setEditingCategoryBudget(null);
    
    // Forçar atualização imediata das categorias
    const categoryMap: { [key: string]: number } = {};
    expenses.forEach(expense => {
      categoryMap[expense.category] = (categoryMap[expense.category] || 0) + expense.amount;
    });

    const updatedCategoryData = Object.entries(categoryMap).map(([name, spent]) => ({
      name,
      budget: updatedBudgets[name] || 0,
      spent
    }));

    setCategories(updatedCategoryData);
    
    toast({
      title: "Sucesso",
      description: "Orçamento da categoria atualizado com sucesso"
    });
  };

  useEffect(() => {
    loadExpenses();
    loadBankAccounts();
    loadCategoryBudgets();
    
    // Configurar real-time updates para company_expenses e event_expenses
    const channel = supabase
      .channel('expense-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_expenses'
        },
        async (payload) => {
          console.log('Company expense change detected, syncing:', payload);
          await supabase.rpc('sync_bank_transactions');
          loadExpenses();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_expenses'
        },
        async (payload) => {
          console.log('Event expense change detected, syncing:', payload);
          await supabase.rpc('sync_bank_transactions');
          loadExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedMonth, selectedYear, selectedDay]);

  const handleAddExpense = async () => {
    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive"
        });
        return;
      }

      if (!newExpense.description.trim() || !newExpense.category || newExpense.amount <= 0) {
        toast({
          title: "Erro",
          description: "Por favor, preencha todos os campos obrigatórios",
          variant: "destructive"
        });
        return;
      }

      console.log('Adicionando despesa com data:', newExpense.date);

      let receiptUrl = newExpense.receipt_url;

      // Upload do comprovante se houver arquivo
      if (newExpense.receipt_file) {
        setUploadingReceipt(true);
        
        let fileToUpload: File | Blob = newExpense.receipt_file;
        let fileExt = newExpense.receipt_file.name.split('.').pop()?.toLowerCase();

        // Converter PDF em imagem
        if (fileExt === 'pdf') {
          try {
            toast({
              title: "Convertendo PDF",
              description: "Convertendo PDF para imagem...",
            });
            const imageBlob = await convertPdfToImage(newExpense.receipt_file);
            fileToUpload = imageBlob;
            fileExt = 'png';
          } catch (error) {
            console.error('Erro ao converter PDF:', error);
            toast({
              title: "Erro",
              description: "Não foi possível converter o PDF",
              variant: "destructive"
            });
            setUploadingReceipt(false);
            return;
          }
        }

        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company_files')
          .upload(fileName, fileToUpload, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          toast({
            title: "Erro",
            description: "Não foi possível fazer upload do comprovante",
            variant: "destructive"
          });
          setUploadingReceipt(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('company_files')
          .getPublicUrl(fileName);

        receiptUrl = publicUrl;
        setUploadingReceipt(false);
      }

      const expenseData = {
        description: newExpense.description,
        category: newExpense.category,
        unit_price: newExpense.amount,
        quantity: 1,
        total_price: newExpense.amount,
        expense_date: newExpense.date,
        expense_bank_account: newExpense.expense_bank_account || null,
        notes: newExpense.notes || null,
        receipt_url: receiptUrl || null,
        created_by: user.id
      };

      console.log('Dados da despesa a serem inseridos:', expenseData);

      const { error } = await supabase
        .from('company_expenses')
        .insert([expenseData]);

      if (error) throw error;

      console.log('Despesa inserida com sucesso no banco');

      toast({
        title: "Sucesso",
        description: "Despesa adicionada com sucesso"
      });

      setNewExpense({
        date: getLocalDateString(),
        description: "",
        category: "",
        amount: 0,
        expense_bank_account: "",
        notes: "",
        receipt_url: "",
        receipt_file: null
      });
      
      setIsAddingExpense(false);
      loadExpenses();
    } catch (error) {
      console.error('Erro ao adicionar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a despesa",
        variant: "destructive"
      });
    }
  };

  const handleEditExpense = async () => {
    if (!editingExpense) return;

    try {
      let receiptUrl = editingExpense.receipt_url;

      // Upload do novo comprovante se houver arquivo
      if (newReceiptFile) {
        setUploadingReceipt(true);
        
        let fileToUpload: File | Blob = newReceiptFile;
        let fileExt = newReceiptFile.name.split('.').pop()?.toLowerCase();

        // Converter PDF em imagem
        if (fileExt === 'pdf') {
          try {
            toast({
              title: "Convertendo PDF",
              description: "Convertendo PDF para imagem...",
            });
            const imageBlob = await convertPdfToImage(newReceiptFile);
            fileToUpload = imageBlob;
            fileExt = 'png';
          } catch (error) {
            console.error('Erro ao converter PDF:', error);
            toast({
              title: "Erro",
              description: "Não foi possível converter o PDF",
              variant: "destructive"
            });
            setUploadingReceipt(false);
            return;
          }
        }

        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company_files')
          .upload(fileName, fileToUpload, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Erro ao fazer upload:', uploadError);
          toast({
            title: "Erro",
            description: "Não foi possível fazer upload do comprovante",
            variant: "destructive"
          });
          setUploadingReceipt(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('company_files')
          .getPublicUrl(fileName);

        receiptUrl = publicUrl;
        setUploadingReceipt(false);
      }

      const expenseData = {
        description: editingExpense.description,
        category: editingExpense.category,
        unit_price: editingExpense.amount,
        quantity: 1,
        total_price: editingExpense.amount,
        expense_date: editingExpense.date,
        expense_bank_account: editingExpense.expense_bank_account || null,
        notes: editingExpense.notes || null,
        receipt_url: receiptUrl
      };

      const { error } = await supabase
        .from('company_expenses')
        .update(expenseData)
        .eq('id', editingExpense.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Despesa atualizada com sucesso"
      });

      setEditingExpense(null);
      setNewReceiptFile(null);
      loadExpenses();
    } catch (error) {
      console.error('Erro ao editar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a despesa",
        variant: "destructive"
      });
    }
  };

  const handleRemoveReceipt = () => {
    if (editingExpense) {
      setEditingExpense({...editingExpense, receipt_url: null});
      setNewReceiptFile(null);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      // Buscar dados da despesa antes de deletar
      const { data: expenseData } = await supabase
        .from('company_expenses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      // Deletar do company_expenses
      const { error } = await supabase
        .from('company_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Deletar do bank_transactions (fluxo de caixa e extrato)
      if (expenseData) {
        // 1) Deletar por referência direta
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'company_expense')
          .eq('reference_id', id);

        // 2) Deletar por correspondência de dados (para transações importadas/manuais)
        const txDate = expenseData.expense_date || expenseData.payment_date || (expenseData.created_at ? String(expenseData.created_at).slice(0, 10) : null);

        if (expenseData.expense_bank_account && txDate) {
          const bankAccountName = String(expenseData.expense_bank_account || '').trim();
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .ilike('name', bankAccountName)
            .maybeSingle();

          if (bankAccount) {
            // 2.1) tentativa com descrição (mais segura)
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expenseData.total_price)
              .eq('transaction_type', 'expense')
              .ilike('description', `%${expenseData.description}%`);

            // 2.2) fallback sem descrição (para descrições diferentes do extrato)
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expenseData.total_price)
              .eq('transaction_type', 'expense')
              .or('reference_type.is.null,reference_type.eq.company_expense');
          }
        }
      }

      toast({
        title: "Sucesso",
        description: "Despesa removida com sucesso"
      });

      loadExpenses();
    } catch (error) {
      console.error('Erro ao deletar despesa:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a despesa",
        variant: "destructive"
      });
    }
  };

  const exportToExcel = () => {
    const data = expenses.map(expense => ({
      Data: formatDateSafely(expense.date),
      Descrição: expense.description,
      Categoria: expense.category,
      Valor: expense.amount,
      Conta: expense.expense_bank_account || '',
      Observações: expense.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Despesas");
    
    const fileName = selectedDay 
      ? `despesas_${selectedDay}.xlsx`
      : `despesas_${selectedMonth}_${selectedYear}.xlsx`;
    
    XLSX.writeFile(wb, fileName);

    toast({
      title: "Sucesso",
      description: "Planilha exportada com sucesso"
    });
  };

  const generatePDF = (type: 'full' | 'monthly' | 'daily' | 'category') => {
    const doc = new jsPDF({
      compress: true
    });
    
    doc.setFontSize(16);
    doc.text('Relatório de Despesas', 14, 15);
    
    doc.setFontSize(12);
    
    let title = '';
    let data: any[] = [];
    
    if (type === 'category') {
      title = 'Resumo por Categoria';
      data = categories.map(cat => ([
        cat.name,
        formatCurrency(cat.spent),
        formatCurrency(cat.budget),
        formatCurrency(cat.budget - cat.spent)
      ]));
      
      autoTable(doc, {
        head: [['Categoria', 'Gasto', 'Orçamento', 'Restante']],
        body: data,
        startY: 25,
      });
    } else {
      title = type === 'full' ? 'Relatório Completo'
             : type === 'monthly' ? `Relatório Mensal - ${selectedMonth}/${selectedYear}`
             : `Relatório Diário - ${selectedDay}`;
      
      data = expenses.map(expense => ([
        formatDateSafely(expense.date),
        expense.description,
        expense.category,
        formatCurrency(expense.amount),
        expense.expense_bank_account || ''
      ]));
      
      autoTable(doc, {
        head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Conta']],
        body: data,
        startY: 25,
      });
    }

    doc.text(title, 14, 20);

    const fileName = type === 'full' ? 'relatorio_completo.pdf'
                   : type === 'monthly' ? `despesas_${selectedMonth}_${selectedYear}.pdf`
                   : type === 'daily' ? `despesas_${selectedDay}.pdf`
                   : 'despesas_por_categoria.pdf';

    doc.save(fileName);

    toast({
      title: "Sucesso",
      description: "PDF gerado com sucesso"
    });
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = categories.reduce((sum, category) => sum + category.budget, 0);
  
  return (
    <div className="p-6 space-y-6">
      <PageActions>
        
        <div className="flex gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {format(new Date(2024, i), 'MMMM', { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (
                <SelectItem key={2024 + i} value={(2024 + i).toString()}>
                  {2024 + i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            type="date"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="w-40"
            placeholder="Filtrar por dia"
          />
        </div>
      </PageActions>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Visão Mensal</TabsTrigger>
          <TabsTrigger value="daily">Planilha Diária</TabsTrigger>
          <TabsTrigger value="categorias">Resumo por Categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Visão Mensal</CardTitle>
                  <CardDescription>
                    Resumo completo de despesas para {selectedMonth}/{selectedYear}
                  </CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                  <Button variant="outline" onClick={() => generatePDF('monthly')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                  
                  <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Despesa
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Adicionar Despesa</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="date">Data</Label>
                            <Input
                              id="date"
                              type="date"
                              value={newExpense.date}
                              onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="category">Categoria</Label>
                            <Select 
                              value={newExpense.category} 
                              onValueChange={(value) => setNewExpense({...newExpense, category: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                {expenseCategories.map(category => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="description">Descrição</Label>
                          <Input
                            id="description"
                            value={newExpense.description}
                            onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                            placeholder="Descrição da despesa"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="amount">Valor</Label>
                            <CurrencyInput
                              id="amount"
                              value={newExpense.amount}
                              onChange={(value) => setNewExpense({...newExpense, amount: value})}
                              placeholder="R$ 0,00"
                            />
                          </div>
                          <div>
                            <Label htmlFor="bank_account">Conta Bancária</Label>
                            <Select 
                              value={newExpense.expense_bank_account} 
                              onValueChange={(value) => setNewExpense({...newExpense, expense_bank_account: value})}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma conta" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map(account => (
                                  <SelectItem key={account} value={account}>{account}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="notes">Observações</Label>
                          <Input
                            id="notes"
                            value={newExpense.notes}
                            onChange={(e) => setNewExpense({...newExpense, notes: e.target.value})}
                            placeholder="Observações opcionais"
                          />
                        </div>

                        <div>
                          <Label htmlFor="receipt">Comprovante</Label>
                          <div className="flex flex-wrap gap-2">
                            <Input
                              id="receipt"
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setNewExpense({...newExpense, receipt_file: file});
                                }
                              }}
                            />
                            {newExpense.receipt_file && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setNewExpense({...newExpense, receipt_file: null})}
                              >
                                Remover
                              </Button>
                            )}
                          </div>
                          {newExpense.receipt_file && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {newExpense.receipt_file.name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsAddingExpense(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleAddExpense} disabled={uploadingReceipt}>
                          {uploadingReceipt ? "Enviando..." : "Adicionar"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
                const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(totalExpenses)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Orçado</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(totalBudget)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Saldo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${totalBudget - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalBudget - totalExpenses)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
              
              {loading ? (
                <div className="text-center py-4">Carregando despesas...</div>
              ) : expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma despesa encontrada para o período selecionado.</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={expenseSelection.isAllSelected}
                            onCheckedChange={() => expenseSelection.toggleSelectAll()}
                          />
                        </TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <Checkbox
                              checked={expenseSelection.isSelected(expense.id)}
                              onCheckedChange={() => expenseSelection.toggleSelection(expense.id)}
                            />
                          </TableCell>
                          <TableCell>{formatDateSafely(expense.date)}</TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                          <TableCell>{expense.expense_bank_account || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {expense.receipt_url && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setViewingReceipt(expense.receipt_url!)}
                                  title="Ver comprovante"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingExpense(expense)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <BulkActionsBar
                    selectedCount={expenseSelection.selectedCount}
                    onDelete={handleBulkDeleteExpenses}
                    onCancel={expenseSelection.clearSelection}
                    isDeleting={isDeletingBulk}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Planilha Diária</CardTitle>
                  <CardDescription>
                    Controle diário de despesas {selectedDay ? `do dia ${selectedDay}` : `de ${selectedMonth}/${selectedYear}`}
                  </CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportToExcel}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                  <Button variant="outline" onClick={() => generatePDF('daily')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total do Dia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(
                        expenses
                          .filter(expense => selectedDay ? expense.date === selectedDay : true)
                          .reduce((sum, expense) => sum + expense.amount, 0)
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Tabela de despesas igual à do monthly */}
              {expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma despesa encontrada para o período selecionado.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{formatDateSafely(expense.date)}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell>{expense.expense_bank_account || '-'}</TableCell>
                        <TableCell>
                          {expense.receipt_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewingReceipt(expense.receipt_url!)}
                              title="Ver comprovante"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Resumo por Categoria</CardTitle>
                  <CardDescription>
                    Análise de gastos por categoria para {selectedMonth}/{selectedYear}
                  </CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => generatePDF('category')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalExpenses = categories.reduce((sum, cat) => sum + cat.spent, 0);
                const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Despesas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCurrency(totalExpenses)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Orçamento Total</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(totalBudget)}
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Diferença</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${totalBudget - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalBudget - totalExpenses)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })()}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Gasto</TableHead>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Restante</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.name}>
                      <TableCell>
                        <Badge variant="outline">{category.name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-red-600">
                        {formatCurrency(category.spent)}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(category.budget)}
                      </TableCell>
                      <TableCell className={category.budget - category.spent >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(category.budget - category.spent)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCategoryBudget(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para editar despesa */}
      {editingExpense && (
        <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Despesa</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-date">Data</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({...editingExpense, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Select 
                    value={editingExpense.category} 
                    onValueChange={(value) => setEditingExpense({...editingExpense, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-description">Descrição</Label>
                <Input
                  id="edit-description"
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-amount">Valor</Label>
                  <CurrencyInput
                    id="edit-amount"
                    value={editingExpense.amount}
                    onChange={(value) => setEditingExpense({...editingExpense, amount: value})}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-bank_account">Conta Bancária</Label>
                  <Select 
                    value={editingExpense.expense_bank_account || ''} 
                    onValueChange={(value) => setEditingExpense({...editingExpense, expense_bank_account: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(account => (
                        <SelectItem key={account} value={account}>{account}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-notes">Observações</Label>
                <Input
                  id="edit-notes"
                  value={editingExpense.notes || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, notes: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="edit-receipt">Comprovante</Label>
                {editingExpense.receipt_url && !newReceiptFile && (
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingReceipt(editingExpense.receipt_url!)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver comprovante atual
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveReceipt}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    id="edit-receipt"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setNewReceiptFile(file);
                      }
                    }}
                  />
                  {newReceiptFile && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setNewReceiptFile(null)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                {newReceiptFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Novo arquivo: {newReceiptFile.name}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditingExpense(null);
                setNewReceiptFile(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={handleEditExpense} disabled={uploadingReceipt}>
                {uploadingReceipt ? "Enviando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para editar orçamento da categoria */}
      {editingCategoryBudget && (
        <Dialog open={!!editingCategoryBudget} onOpenChange={() => setEditingCategoryBudget(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Editar Orçamento - {editingCategoryBudget.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div>
                  <Label htmlFor="edit-budget">Orçamento</Label>
                  <CurrencyInput
                    id="edit-budget"
                    value={editingCategoryBudget.budget}
                    onChange={(value) => setEditingCategoryBudget({
                      ...editingCategoryBudget, 
                      budget: value
                    })}
                  />
                </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingCategoryBudget(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveCategoryBudget}>
                Salvar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para visualizar comprovante */}
      <Dialog open={!!viewingReceipt} onOpenChange={() => setViewingReceipt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Comprovante</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {viewingReceipt && (
              viewingReceipt.endsWith('.pdf') ? (
                <iframe
                  src={viewingReceipt}
                  className="w-full h-[70vh] border rounded"
                  title="Comprovante PDF"
                />
              ) : (
                <img
                  src={viewingReceipt}
                  alt="Comprovante"
                  className="max-w-full h-auto rounded"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};