import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Calendar, Edit, Trash2, FileSpreadsheet, User, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCustomAuth } from "@/hooks/useCustomAuth";

interface PersonalExpense {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

interface ExpenseCategory {
  name: string;
  budget: number;
  spent: number;
}

export const PersonalExpenseSpreadsheet = () => {
  const [expenses, setExpenses] = useState<PersonalExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<PersonalExpense | null>(null);
  const { toast } = useToast();
  const { user } = useCustomAuth();

  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    category: "",
    amount: 0,
    paymentMethod: "",
    notes: ""
  });

  const personalExpenseCategories = [
    "Moradia",
    "Alimentação",
    "Transporte", 
    "Saúde",
    "Educação",
    "Lazer",
    "Roupas",
    "Poupança",
    "Outros"
  ];

  const paymentMethods = [
    "Dinheiro",
    "Cartão de Débito",
    "Cartão de Crédito",
    "PIX",
    "Transferência Bancária",
    "Outros"
  ];

  useEffect(() => {
    loadPersonalExpenses();
    
    // Escutar mudanças no localStorage (para atualizações em outras abas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('personal_expenses_')) {
        console.log('Personal expense storage change detected');
        loadPersonalExpenses();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [selectedMonth, selectedYear, selectedDay]);

  const loadPersonalExpenses = async () => {
    try {
      setLoading(true);
      
      // Para gastos pessoais, vamos usar localStorage por enquanto
      // já que não temos uma tabela específica no Supabase para isso
      let mappedExpenses: PersonalExpense[] = [];
      
      if (selectedDay) {
        // Filtrar por dia específico - buscar em todos os meses salvos
        const allKeys = Object.keys(localStorage).filter(key => key.startsWith('personal_expenses_'));
        for (const key of allKeys) {
          const expenses = JSON.parse(localStorage.getItem(key) || '[]');
          const dayExpenses = expenses.filter((exp: PersonalExpense) => exp.date === selectedDay);
          mappedExpenses.push(...dayExpenses);
        }
      } else {
        // Filtrar por mês/ano
        const storageKey = `personal_expenses_${selectedMonth}_${selectedYear}`;
        const storedExpenses = localStorage.getItem(storageKey);
        if (storedExpenses) {
          mappedExpenses = JSON.parse(storedExpenses);
        }
      }

      setExpenses(mappedExpenses);

      // Calcular categorias com gastos
      const categorySpending = mappedExpenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);

      const calculatedCategories: ExpenseCategory[] = personalExpenseCategories.map(category => ({
        name: category,
        budget: getCategoryBudget(category),
        spent: categorySpending[category] || 0
      }));

      setCategories(calculatedCategories);

    } catch (error) {
      console.error("Error loading personal expenses:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as despesas pessoais.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBudget = (category: string): number => {
    // Carregar orçamento pessoal salvo no localStorage da gestão financeira
    const personalBudgetKey = `personal_budget_${selectedMonth}_${selectedYear}`;
    const savedPersonalBudget = localStorage.getItem(personalBudgetKey);
    
    if (savedPersonalBudget) {
      try {
        const budgetData = JSON.parse(savedPersonalBudget);
        const budgetItem = budgetData.find((item: any) => item.category === category);
        if (budgetItem) {
          return budgetItem.budgeted;
        }
      } catch (error) {
        console.error("Error parsing saved personal budget:", error);
      }
    }
    
    // Valores padrão zerados para que o usuário defina seus próprios valores
    const defaultBudgets: Record<string, number> = {
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
    return defaultBudgets[category] || 0;
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.category || newExpense.amount <= 0) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    try {
      const expense: PersonalExpense = {
        id: Date.now().toString(),
        date: newExpense.date,
        description: newExpense.description,
        category: newExpense.category,
        amount: newExpense.amount,
        paymentMethod: newExpense.paymentMethod,
        notes: newExpense.notes,
        created_by: user?.id || 'anonymous',
        created_at: new Date().toISOString()
      };

      // Determinar o mês/ano correto com base na data da despesa
      const expenseDate = new Date(newExpense.date);
      const expenseMonth = expenseDate.getMonth() + 1;
      const expenseYear = expenseDate.getFullYear();

      // Salvar no localStorage da data correta
      const storageKey = `personal_expenses_${expenseMonth}_${expenseYear}`;
      const existingExpenses = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updatedExpenses = [...existingExpenses, expense];
      localStorage.setItem(storageKey, JSON.stringify(updatedExpenses));

      toast({
        title: "Sucesso",
        description: "Despesa pessoal adicionada com sucesso.",
      });

      // Atualizar filtros para mostrar o mês/ano da despesa adicionada
      setSelectedMonth(expenseMonth);
      setSelectedYear(expenseYear);

      setNewExpense({
        date: new Date().toISOString().split('T')[0],
        description: "",
        category: "",
        amount: 0,
        paymentMethod: "",
        notes: ""
      });
      setIsAddingExpense(false);
      
      // Forçar atualização imediata
      loadPersonalExpenses();

    } catch (error) {
      console.error("Error adding personal expense:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a despesa pessoal.",
        variant: "destructive",
      });
    }
  };

  const handleEditExpense = async () => {
    if (!editingExpense) return;

    try {
      // Determinar o mês/ano correto com base na data da despesa
      const expenseDate = new Date(editingExpense.date);
      const expenseMonth = expenseDate.getMonth() + 1;
      const expenseYear = expenseDate.getFullYear();
      
      const storageKey = `personal_expenses_${expenseMonth}_${expenseYear}`;
      
      // Se a data mudou, remover da chave original e adicionar na nova
      const originalStorageKey = `personal_expenses_${selectedMonth}_${selectedYear}`;
      
      if (storageKey !== originalStorageKey) {
        // Remover da chave original
        const originalExpenses = JSON.parse(localStorage.getItem(originalStorageKey) || '[]');
        const filteredOriginalExpenses = originalExpenses.filter((exp: PersonalExpense) => exp.id !== editingExpense.id);
        localStorage.setItem(originalStorageKey, JSON.stringify(filteredOriginalExpenses));
        
        // Adicionar na nova chave
        const newExpenses = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedNewExpenses = [...newExpenses, editingExpense];
        localStorage.setItem(storageKey, JSON.stringify(updatedNewExpenses));
      } else {
        // Mesma chave, apenas atualizar
        const existingExpenses = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updatedExpenses = existingExpenses.map((exp: PersonalExpense) => 
          exp.id === editingExpense.id ? editingExpense : exp
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedExpenses));
      }

      toast({
        title: "Sucesso",
        description: "Despesa pessoal atualizada com sucesso.",
      });

      setEditingExpense(null);
      loadPersonalExpenses();

    } catch (error) {
      console.error("Error updating personal expense:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a despesa pessoal.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      const storageKey = `personal_expenses_${selectedMonth}_${selectedYear}`;
      const existingExpenses = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updatedExpenses = existingExpenses.filter((exp: PersonalExpense) => exp.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updatedExpenses));

      toast({
        title: "Sucesso",
        description: "Despesa pessoal removida com sucesso.",
      });

      loadPersonalExpenses();

    } catch (error) {
      console.error("Error deleting personal expense:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a despesa pessoal.",
        variant: "destructive",
      });
    }
  };

  const exportToExcel = () => {
    // Calcular totais por categoria
    const totalsByCategory = categories.reduce((acc, cat) => {
      acc[cat.name] = {
        budget: cat.budget,
        spent: cat.spent,
        remaining: cat.budget - cat.spent
      };
      return acc;
    }, {} as Record<string, { budget: number; spent: number; remaining: number }>);

    // Totais por forma de pagamento
    const paymentMethodTotals = expenses.reduce((acc, expense) => {
      const method = expense.paymentMethod || 'Não informado';
      acc[method] = (acc[method] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
    const totalRemaining = totalBudget - totalSpent;

    // Criar workbook
    const workbook = XLSX.utils.book_new();

    // Dashboard sheet
    const dashboardData = [
      ['RELATÓRIO FINANCEIRO - DESPESAS PESSOAIS', '', '', ''],
      [`Período: ${selectedMonth}/${selectedYear}`, '', '', ''],
      ['', '', '', ''],
      ['RESUMO GERAL', '', '', ''],
      ['Total Orçado:', totalBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '', ''],
      ['Total Gasto:', totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '', ''],
      ['Saldo Restante:', totalRemaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '', ''],
      ['', '', '', ''],
      ['RESUMO POR CATEGORIA', '', '', ''],
      ['Categoria', 'Orçado', 'Gasto', 'Restante'],
      ...Object.entries(totalsByCategory).map(([cat, data]) => [
        cat,
        data.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        data.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        data.remaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]),
      ['', '', '', ''],
      ['RESUMO POR FORMA DE PAGAMENTO', '', '', ''],
      ['Forma de Pagamento', 'Total Gasto', '', ''],
      ...Object.entries(paymentMethodTotals).map(([method, total]) => [
        method,
        total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        '', ''
      ])
    ];

    const dashboardSheet = XLSX.utils.aoa_to_sheet(dashboardData);
    
    // Formatar dashboard
    dashboardSheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Título
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }  // Período
    ];
    
    dashboardSheet['!cols'] = [
      { width: 25 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];

    // Despesas detalhadas sheet
    const expensesData = [
      ['Data', 'Descrição', 'Categoria', 'Valor', 'Forma de Pagamento', 'Observações'],
      ...expenses.map(expense => [
        expense.date,
        expense.description,
        expense.category,
        expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        expense.paymentMethod || '',
        expense.notes || ''
      ]),
      ['', '', '', '', '', ''],
      ['TOTAL:', '', '', expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), '', '']
    ];

    const expensesSheet = XLSX.utils.aoa_to_sheet(expensesData);
    
    // Formatar planilha de despesas
    expensesSheet['!cols'] = [
      { width: 12 }, { width: 30 }, { width: 20 }, { width: 15 }, { width: 20 }, { width: 30 }
    ];

    // Tabela dinâmica sheet
    const pivotData = [
      ['TABELA DINÂMICA - ANÁLISE DE DESPESAS PESSOAIS', '', '', '', ''],
      ['', '', '', '', ''],
      ['DESPESAS POR CATEGORIA E FORMA DE PAGAMENTO', '', '', '', ''],
      ['Categoria', 'Forma de Pagamento', 'Quantidade', 'Total (R$)', 'Média (R$)'],
    ];

    // Agrupar dados para tabela dinâmica
    const pivotGroups = expenses.reduce((acc, expense) => {
      const key = `${expense.category}_${expense.paymentMethod || 'Não informado'}`;
      if (!acc[key]) {
        acc[key] = {
          category: expense.category,
          payment_method: expense.paymentMethod || 'Não informado',
          count: 0,
          total: 0
        };
      }
      acc[key].count++;
      acc[key].total += expense.amount;
      return acc;
    }, {} as Record<string, { category: string; payment_method: string; count: number; total: number }>);

    // Adicionar dados agrupados à tabela dinâmica
    Object.values(pivotGroups).forEach(group => {
      pivotData.push([
        group.category,
        group.payment_method,
        group.count.toString(),
        group.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        (group.total / group.count).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
    });

    // Adicionar totais gerais
    pivotData.push(['', '', '', '', '']);
    pivotData.push([
      'TOTAIS GERAIS',
      '',
      expenses.length.toString(),
      expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      (expenses.reduce((sum, exp) => sum + exp.amount, 0) / expenses.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);

    const pivotSheet = XLSX.utils.aoa_to_sheet(pivotData);
    
    // Formatar tabela dinâmica
    pivotSheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Título
      { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }  // Subtítulo
    ];
    
    pivotSheet['!cols'] = [
      { width: 20 }, { width: 20 }, { width: 12 }, { width: 15 }, { width: 15 }
    ];

    // Adicionar sheets ao workbook
    XLSX.utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Despesas Detalhadas");
    XLSX.utils.book_append_sheet(workbook, pivotSheet, "Tabela Dinâmica");

    // Exportar arquivo
    const fileName = `relatorio_despesas_pessoais_${selectedMonth}_${selectedYear}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Sucesso",
      description: "Relatório financeiro pessoal exportado com sucesso.",
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    
    // Configurar fonte e título
    doc.setFontSize(18);
    doc.text('RELATÓRIO DE DESPESAS PESSOAIS', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Período: ${selectedMonth}/${selectedYear}`, 105, 30, { align: 'center' });
    
    // Resumo geral
    const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    
    let yPosition = 45;
    
    doc.setFontSize(14);
    doc.text('RESUMO GERAL', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(11);
    doc.text(`Total Orçado: ${totalBudget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Gasto: ${totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Saldo Restante: ${totalRemaining.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 15;
    
    // Tabela de categorias
    doc.setFontSize(14);
    doc.text('RESUMO POR CATEGORIA', 20, yPosition);
    yPosition += 10;
    
    const categoryTableData = categories.map(cat => [
      cat.name,
      cat.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      cat.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      (cat.budget - cat.spent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    ]);
    
    autoTable(doc, {
      head: [['Categoria', 'Orçado', 'Gasto', 'Restante']],
      body: categoryTableData,
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] },
      styles: { fontSize: 10 }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
    
    // Totais por forma de pagamento
    const paymentMethodTotals = expenses.reduce((acc, expense) => {
      const method = expense.paymentMethod || 'Não informado';
      acc[method] = (acc[method] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(paymentMethodTotals).length > 0) {
      doc.setFontSize(14);
      doc.text('RESUMO POR FORMA DE PAGAMENTO', 20, yPosition);
      yPosition += 10;
      
      const paymentTableData = Object.entries(paymentMethodTotals).map(([method, total]) => [
        method,
        total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
      
      autoTable(doc, {
        head: [['Forma de Pagamento', 'Total Gasto']],
        body: paymentTableData,
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [63, 81, 181] },
        styles: { fontSize: 10 }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // Nova página se necessário
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Tabela de despesas detalhadas
    doc.setFontSize(14);
    doc.text('DESPESAS DETALHADAS', 20, yPosition);
    yPosition += 10;
    
    const expenseTableData = expenses.map(expense => [
      expense.date,
      expense.description,
      expense.category,
      expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      expense.paymentMethod || ''
    ]);
    
    autoTable(doc, {
      head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Pagamento']],
      body: expenseTableData,
      startY: yPosition,
      theme: 'grid',
      headStyles: { fillColor: [63, 81, 181] },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { cellWidth: 50 },
        3: { cellWidth: 25 }
      }
    });
    
    // Salvar o PDF
    const fileName = `relatorio_despesas_pessoais_${selectedMonth}_${selectedYear}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "Sucesso",
      description: "Relatório PDF pessoal gerado com sucesso.",
    });
  };

  const generateMonthlyPDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    let yPosition = 20;
    
    doc.setFontSize(16);
    doc.text('VISÃO MENSAL - DESPESAS PESSOAIS', 105, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.text(`Período: ${format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })}`, 105, yPosition, { align: 'center' });
    yPosition += 20;
    
    const totalBudgetMonthly = categories.reduce((sum, cat) => sum + cat.budget, 0);
    const totalExpensesMonthly = categories.reduce((sum, cat) => sum + cat.spent, 0);
    
    doc.setFontSize(14);
    doc.text('RESUMO GERAL', 20, yPosition);
    yPosition += 10;
    
    doc.setFontSize(11);
    doc.text(`Total Orçado: ${totalBudgetMonthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Total Gasto: ${totalExpensesMonthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Saldo: ${(totalBudgetMonthly - totalExpensesMonthly).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    yPosition += 15;
    
    const dailyExpenses = expenses.reduce((acc, expense) => {
      const day = new Date(expense.date).getDate();
      acc[day] = (acc[day] || 0) + expense.amount;
      return acc;
    }, {} as Record<number, number>);
    
    const dailyData = Object.entries(dailyExpenses)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([day, amount]) => [
        `Dia ${day}`,
        amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      ]);
    
    if (dailyData.length > 0) {
      doc.setFontSize(14);
      doc.text('DESPESAS POR DIA DO MÊS', 20, yPosition);
      yPosition += 10;
      
      autoTable(doc, {
        head: [['Dia', 'Total Gasto']],
        body: dailyData,
        startY: yPosition,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [63, 81, 181] }
      });
    }
    
    doc.save(`visao-mensal-pessoal-${selectedMonth}-${selectedYear}.pdf`);
    toast({
      title: "Sucesso",
      description: "PDF da visão mensal gerado com sucesso.",
    });
  };

  const generateDailyPDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    let yPosition = 20;
    
    doc.setFontSize(16);
    doc.text('PLANILHA DIÁRIA - DESPESAS PESSOAIS', 105, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    const periodText = selectedDay 
      ? `Data: ${format(new Date(selectedDay), 'dd/MM/yyyy', { locale: ptBR })}`
      : `Período: ${format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })}`;
    doc.text(periodText, 105, yPosition, { align: 'center' });
    yPosition += 20;
    
    doc.setFontSize(14);
    doc.text('DESPESAS DETALHADAS', 20, yPosition);
    yPosition += 10;
    
    const expenseTableData = expenses.map(expense => [
      expense.date,
      expense.description,
      expense.category,
      expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      expense.paymentMethod || '',
      expense.notes || ''
    ]);
    
    autoTable(doc, {
      head: [['Data', 'Descrição', 'Categoria', 'Valor', 'Pagamento', 'Observações']],
      body: expenseTableData,
      startY: yPosition,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [63, 81, 181] }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.text(`Total: ${expenses.reduce((sum, exp) => sum + exp.amount, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
    
    const fileName = selectedDay 
      ? `planilha-diaria-pessoal-${format(new Date(selectedDay), 'dd-MM-yyyy', { locale: ptBR })}.pdf`
      : `planilha-diaria-pessoal-${selectedMonth}-${selectedYear}.pdf`;
    
    doc.save(fileName);
    toast({
      title: "Sucesso",
      description: "PDF da planilha diária gerado com sucesso.",
    });
  };

  const generateCategoryPDF = () => {
    const doc = new jsPDF({
      compress: true
    });
    let yPosition = 20;
    
    doc.setFontSize(16);
    doc.text('RELATÓRIO POR CATEGORIA - DESPESAS PESSOAIS', 105, yPosition, { align: 'center' });
    yPosition += 10;
    
    doc.setFontSize(12);
    doc.text(`Período: ${format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })}`, 105, yPosition, { align: 'center' });
    yPosition += 20;
    
    doc.setFontSize(14);
    doc.text('RESUMO POR CATEGORIA', 20, yPosition);
    yPosition += 10;
    
    const categoryTableData = categories.map(cat => {
      const percentage = cat.budget > 0 ? (cat.spent / cat.budget) * 100 : 0;
      return [
        cat.name,
        cat.budget.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        cat.spent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        (cat.budget - cat.spent).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        `${percentage.toFixed(1)}%`
      ];
    });
    
    autoTable(doc, {
      head: [['Categoria', 'Orçado', 'Gasto', 'Restante', '% Usado']],
      body: categoryTableData,
      startY: yPosition,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [63, 81, 181] }
    });
    
    yPosition = (doc as any).lastAutoTable.finalY + 15;
    
    categories.forEach((category) => {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      const categoryExpenses = expenses.filter(exp => exp.category === category.name);
      
      if (categoryExpenses.length > 0) {
        doc.setFontSize(12);
        doc.text(`DETALHAMENTO - ${category.name.toUpperCase()}`, 20, yPosition);
        yPosition += 8;
        
        const categoryData = categoryExpenses.map(expense => [
          expense.date,
          expense.description,
          expense.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          expense.paymentMethod || ''
        ]);
        
        autoTable(doc, {
          head: [['Data', 'Descrição', 'Valor', 'Pagamento']],
          body: categoryData,
          startY: yPosition,
          theme: 'striped',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [100, 100, 100] }
        });
        
        yPosition = (doc as any).lastAutoTable.finalY + 10;
        
        const categoryTotal = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        doc.setFontSize(10);
        doc.text(`Subtotal ${category.name}: ${categoryTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 20, yPosition);
        yPosition += 15;
      }
    });
    
    doc.save(`por-categoria-pessoal-${selectedMonth}-${selectedYear}.pdf`);
    toast({
      title: "Sucesso",
      description: "PDF por categoria gerado com sucesso.",
    });
  };

  const getDailySpreadsheetData = () => {
    const monthStart = startOfMonth(new Date(selectedYear, selectedMonth - 1));
    const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth - 1));
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return daysInMonth.map(day => {
      const dayExpenses = expenses.filter(expense => 
        isSameDay(new Date(expense.date), day)
      );
      const totalDay = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      return {
        day: format(day, 'dd/MM/yyyy', { locale: ptBR }),
        dayOfWeek: format(day, 'EEEE', { locale: ptBR }),
        expenses: dayExpenses,
        total: totalDay
      };
    });
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Carregando planilha de gastos pessoais...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Planilha de Gastos Pessoais</h1>
          </div>
          <p className="text-muted-foreground">Controle de despesas pessoais diárias e mensais</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Despesa Pessoal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Despesa Pessoal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={newExpense.category} onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {personalExpenseCategories.map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    placeholder="Descrição da despesa"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <CurrencyInput
                      id="amount"
                      value={newExpense.amount}
                      onChange={(value) => setNewExpense({ ...newExpense, amount: value })}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                    <Select value={newExpense.paymentMethod} onValueChange={(value) => setNewExpense({ ...newExpense, paymentMethod: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(method => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={newExpense.notes}
                    onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                    placeholder="Observações adicionais"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddingExpense(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddExpense}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
            <Button onClick={generatePDF} className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Gerar PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros de período */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <Label>Filtro por Dia Específico</Label>
              <Input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                placeholder="Filtrar por dia"
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Mês</Label>
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
                disabled={!!selectedDay}
              >
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
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(value) => setSelectedYear(parseInt(value))}
                disabled={!!selectedDay}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
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
            {selectedDay && (
              <Button 
                variant="outline" 
                onClick={() => setSelectedDay('')}
                className="h-10"
              >
                Limpar Filtro
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumo financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orçado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalBudget)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBudget - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalBudget - totalExpenses)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Visão Mensal</TabsTrigger>
          <TabsTrigger value="daily">Planilha Diária</TabsTrigger>
          <TabsTrigger value="categories">Por Categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Despesas Pessoais do Mês</CardTitle>
                  <CardDescription>
                    {format(new Date(selectedYear, selectedMonth - 1), 'MMMM yyyy', { locale: ptBR })}
                  </CardDescription>
                </div>
                <Button onClick={generateMonthlyPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>{expense.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{expense.category}</Badge>
                      </TableCell>
                      <TableCell>{expense.paymentMethod || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingExpense(expense)} title="Editar" aria-label="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteExpense(expense.id)} title="Excluir" aria-label="Excluir">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma despesa pessoal encontrada para este período
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Planilha Diária</CardTitle>
                  <CardDescription>Despesas pessoais organizadas por dia do mês</CardDescription>
                </div>
                <Button onClick={generateDailyPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Dia da Semana</TableHead>
                    <TableHead>Qtd. Despesas</TableHead>
                    <TableHead className="text-right">Total do Dia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getDailySpreadsheetData().map((day, index) => (
                    <TableRow key={index}>
                      <TableCell>{day.day}</TableCell>
                      <TableCell className="capitalize">{day.dayOfWeek}</TableCell>
                      <TableCell>{day.expenses.length}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(day.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Gastos por Categoria</CardTitle>
                  <CardDescription>Comparação entre orçado e gasto por categoria pessoal</CardDescription>
                </div>
                <Button onClick={generateCategoryPDF} variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Orçado</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">% Usado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => {
                    const percentage = category.budget > 0 ? (category.spent / category.budget) * 100 : 0;
                    const remaining = category.budget - category.spent;
                    
                    return (
                      <TableRow key={category.name}>
                        <TableCell>{category.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(category.budget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(category.spent)}</TableCell>
                        <TableCell className={`text-right ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(remaining)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={percentage > 100 ? "destructive" : percentage > 80 ? "secondary" : "default"}>
                            {percentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de edição */}
      <Dialog open={!!editingExpense} onOpenChange={() => setEditingExpense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Despesa Pessoal</DialogTitle>
          </DialogHeader>
          {editingExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-date">Data</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Categoria</Label>
                  <Select value={editingExpense.category} onValueChange={(value) => setEditingExpense({ ...editingExpense, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {personalExpenseCategories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Input
                  id="edit-description"
                  value={editingExpense.description}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Valor</Label>
                  <CurrencyInput
                    id="edit-amount"
                    value={editingExpense.amount}
                    onChange={(value) => setEditingExpense({ ...editingExpense, amount: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-paymentMethod">Forma de Pagamento</Label>
                  <Select value={editingExpense.paymentMethod || ''} onValueChange={(value) => setEditingExpense({ ...editingExpense, paymentMethod: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map(method => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Observações</Label>
                <Input
                  id="edit-notes"
                  value={editingExpense.notes || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingExpense(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditExpense}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};