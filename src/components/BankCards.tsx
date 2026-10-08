import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  FileText, 
  Download,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useValueVisibility } from "@/hooks/useValueVisibility";

import { useCustomAuth } from "@/hooks/useCustomAuth";

interface BankCard {
  id: string;
  name: string;
  card_number: string; // Last 4 digits only
  card_type: 'credit' | 'debit';
  bank: string;
  limit_amount?: number;
  current_balance: number;
  available_limit?: number;
  due_date?: number; // Day of month
  closing_date?: number; // Day of month
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface CardTransaction {
  id: string;
  cardId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'purchase' | 'payment' | 'fee' | 'interest';
  installments?: number;
  currentInstallment?: number;
}

export const BankCards = () => {
  const [cards, setCards] = useState<BankCard[]>([]);
  const [transactions, setTransactions] = useState<CardTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [isViewingCard, setIsViewingCard] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isViewingStatement, setIsViewingStatement] = useState(false);
  const [isPayingCard, setIsPayingCard] = useState(false);
  const [isEditingTransaction, setIsEditingTransaction] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BankCard | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<CardTransaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [filterType, setFilterType] = useState<'month' | 'period'>('month');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState("cards");
  const { toast } = useToast();
  const { canViewValues, formatValue } = useValueVisibility();
  const { user } = useCustomAuth();

  const [newCard, setNewCard] = useState({
    name: "",
    card_number: "", // Will store only last 4 digits
    card_type: "credit" as 'credit' | 'debit',
    bank: "",
    limit_amount: 0,
    current_balance: 0,
    due_date: 10,
    closing_date: 5,
    is_active: true
  });

  const [newExpense, setNewExpense] = useState({
    card_id: "",
    description: "",
    amount: 0,
    category: "",
    payment_type: "vista" as 'vista' | 'parcelado',
    installments: 1,
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const [cardPayment, setCardPayment] = useState({
    amount: 0,
    description: "",
    payment_date: new Date().toISOString().split('T')[0]
  });

  const [transactionEdit, setTransactionEdit] = useState({
    id: "",
    description: "",
    amount: 0,
    category: "",
    transaction_date: new Date().toISOString().split('T')[0]
  });

  const loadCards = async () => {
    try {
      setLoading(true);
      
      console.log('Carregando cartões...');
      
      // Load cards from database
      const { data: cardsData, error: cardsError } = await supabase
        .from('bank_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (cardsError) throw cardsError;

      console.log('Cartões carregados:', cardsData);

      // Type cast the data to match BankCard interface
      const typedCards: BankCard[] = (cardsData || []).map(card => ({
        ...card,
        card_type: card.card_type as 'credit' | 'debit'
      }));

      setCards(typedCards);
      
      // Load transactions from bank_card_transactions table
      const { data: cardTransactionsData, error } = await supabase
        .from('bank_card_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      console.log('Transações de cartão carregadas:', cardTransactionsData);

      // Convert bank card transactions to card transactions format
      const cardTransactions: CardTransaction[] = cardTransactionsData?.map(tx => ({
        id: tx.id,
        cardId: tx.card_id,
        date: tx.transaction_date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category || 'Outros',
        type: tx.transaction_type === 'debit' ? 'purchase' : 'payment'
      })) || [];

      setTransactions(cardTransactions);
      console.log('Transações processadas:', cardTransactions);
      
    } catch (error) {
      console.error('Error loading cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar cartões",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCard = async () => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive"
      });
      return;
    }

    try {
      const cardData = {
        ...newCard,
        card_number: `****${newCard.card_number.slice(-4)}`,
        available_limit: newCard.card_type === 'credit' ? newCard.limit_amount - newCard.current_balance : undefined,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('bank_cards')
        .insert(cardData)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Cartão adicionado com sucesso"
      });

      setNewCard({
        name: "",
        card_number: "",
        card_type: "credit",
        bank: "",
        limit_amount: 0,
        current_balance: 0,
        due_date: 10,
        closing_date: 5,
        is_active: true
      });
      setIsAddingCard(false);
      loadCards(); // Reload cards
      
    } catch (error) {
      console.error('Error adding card:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar cartão",
        variant: "destructive"
      });
    }
  };

  const handleEditCard = async () => {
    if (!selectedCard) return;

    try {
      const { error } = await supabase
        .from('bank_cards')
        .update({
          ...selectedCard,
          available_limit: selectedCard.card_type === 'credit' ? 
            (selectedCard.limit_amount || 0) - selectedCard.current_balance : undefined
        })
        .eq('id', selectedCard.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Cartão atualizado com sucesso"
      });

      setIsEditingCard(false);
      setSelectedCard(null);
      loadCards(); // Reload cards
      
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar cartão",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('bank_cards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Cartão removido com sucesso"
      });

      loadCards(); // Reload cards
      
    } catch (error) {
      console.error('Error deleting card:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover cartão",
        variant: "destructive"
      });
    }
  };

  const handleEditTransaction = async () => {
    if (!transactionEdit.id) return;

    try {
      const { error } = await supabase
        .from('bank_card_transactions')
        .update({
          description: transactionEdit.description,
          amount: transactionEdit.amount,
          category: transactionEdit.category,
          transaction_date: transactionEdit.transaction_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionEdit.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Transação atualizada com sucesso"
      });

      setIsEditingTransaction(false);
      setSelectedTransaction(null);
      loadCards();
      
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar transação",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('bank_card_transactions')
        .delete()
        .eq('id', transactionId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Transação removida com sucesso"
      });

      loadCards();
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover transação",
        variant: "destructive"
      });
    }
  };

  const handlePayCard = async () => {
    if (!selectedCard || cardPayment.amount <= 0) {
      toast({
        title: "Erro",
        description: "Digite um valor válido para o pagamento",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Iniciando pagamento do cartão:', {
        cardId: selectedCard.id,
        amount: cardPayment.amount,
        currentBalance: selectedCard.current_balance,
        cardType: selectedCard.card_type,
        limitAmount: selectedCard.limit_amount
      });

      // Register payment transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('bank_card_transactions')
        .insert({
          card_id: selectedCard.id,
          description: cardPayment.description || `Pagamento Cartão - ${selectedCard.name}`,
          amount: cardPayment.amount,
          category: 'Pagamento',
          transaction_type: 'credit',
          transaction_date: cardPayment.payment_date
        })
        .select();

      if (transactionError) {
        console.error('Erro ao inserir transação:', transactionError);
        throw transactionError;
      }

      console.log('Transação inserida:', transactionData);

      // Update card balance (subtract payment amount for credit cards)
      const newBalance = selectedCard.card_type === 'credit' 
        ? Math.max(0, selectedCard.current_balance - cardPayment.amount)
        : selectedCard.current_balance + cardPayment.amount; // For debit cards, payment increases balance

      const newAvailableLimit = selectedCard.card_type === 'credit' && selectedCard.limit_amount
        ? (selectedCard.limit_amount - newBalance)
        : undefined;

      console.log('Atualizando saldo do cartão:', {
        oldBalance: selectedCard.current_balance,
        newBalance: newBalance,
        oldAvailableLimit: selectedCard.available_limit,
        newAvailableLimit: newAvailableLimit
      });

      const { data: updateData, error: updateError } = await supabase
        .from('bank_cards')
        .update({ 
          current_balance: newBalance,
          available_limit: newAvailableLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedCard.id)
        .select();

      if (updateError) {
        console.error('Erro ao atualizar cartão:', updateError);
        throw updateError;
      }

      console.log('Cartão atualizado:', updateData);

      // Now debit the amount from the associated bank account
      console.log('Procurando conta bancária para debitar:', selectedCard.bank);

      // Find the bank account by name (bank field in card matches account name)
      const { data: bankAccountData, error: bankAccountError } = await supabase
        .from('bank_accounts')
        .select('id, name, balance')
        .eq('name', selectedCard.bank)
        .single();

      if (bankAccountError || !bankAccountData) {
        console.warn('Conta bancária não encontrada:', selectedCard.bank);
        toast({
          title: "Aviso",
          description: `Pagamento registrado no cartão, mas conta bancária "${selectedCard.bank}" não encontrada`,
          variant: "destructive"
        });
      } else {
        console.log('Conta bancária encontrada:', bankAccountData);

        // Create bank transaction to record the payment
        const { data: bankTransactionData, error: bankTransactionError } = await supabase
          .from('bank_transactions')
          .insert({
            bank_account_id: bankAccountData.id,
            amount: cardPayment.amount,
            transaction_type: 'expense',
            description: `Pagamento do cartão ${selectedCard.name}`,
            category: 'Pagamento de Cartão',
            transaction_date: cardPayment.payment_date
          })
          .select();

        if (bankTransactionError) {
          console.error('Erro ao criar transação bancária:', bankTransactionError);
          toast({
            title: "Aviso",
            description: "Pagamento registrado no cartão, mas erro ao debitar da conta bancária",
            variant: "destructive"
          });
        } else {
          console.log('Transação bancária criada:', bankTransactionData);

          // Update bank account balance
          const currentAccountBalance = bankAccountData.balance || 0;
          const newAccountBalance = currentAccountBalance - cardPayment.amount;

          console.log('Atualizando saldo da conta bancária:', {
            accountName: bankAccountData.name,
            oldBalance: currentAccountBalance,
            paymentAmount: cardPayment.amount,
            newBalance: newAccountBalance
          });

          const { error: updateAccountError } = await supabase
            .from('bank_accounts')
            .update({ 
              balance: newAccountBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', bankAccountData.id);

          if (updateAccountError) {
            console.error('Erro ao atualizar saldo da conta bancária:', updateAccountError);
            toast({
              title: "Aviso",
              description: "Pagamento registrado, mas erro ao atualizar saldo da conta",
              variant: "destructive"
            });
          } else {
            console.log('Saldo da conta bancária atualizado com sucesso');
          }
        }
      }

      toast({
        title: "Sucesso",
        description: `Pagamento de ${formatValue(cardPayment.amount)} registrado com sucesso`
      });

      // Reset form and close dialog
      setCardPayment({
        amount: 0,
        description: "",
        payment_date: new Date().toISOString().split('T')[0]
      });
      setIsPayingCard(false);
      setSelectedCard(null);
      
      // Reload cards to show updated balance
      await loadCards();
      
    } catch (error) {
      console.error('Error processing card payment:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar pagamento do cartão",
        variant: "destructive"
      });
    }
  };

  const handleAddExpense = async () => {
    try {
      const selectedCard = cards.find(card => card.id === newExpense.card_id);
      if (!selectedCard) {
        toast({
          title: "Erro",
          description: "Selecione um cartão válido",
          variant: "destructive"
        });
        return;
      }

      // Create transaction for each installment
      if (newExpense.payment_type === 'parcelado') {
        const installmentAmount = newExpense.amount / newExpense.installments;
        
        for (let i = 1; i <= newExpense.installments; i++) {
          // Calculate installment date (monthly intervals)
          const installmentDate = new Date(newExpense.transaction_date);
          installmentDate.setMonth(installmentDate.getMonth() + (i - 1));
          
          const { error } = await supabase
            .from('bank_card_transactions')
            .insert({
              card_id: newExpense.card_id,
              description: `${newExpense.description} (${i}/${newExpense.installments})`,
              amount: installmentAmount,
              category: newExpense.category,
              transaction_type: 'debit',
              transaction_date: installmentDate.toISOString().split('T')[0]
            });

          if (error) throw error;
        }
      } else {
        // Single payment
        const { error } = await supabase
          .from('bank_card_transactions')
          .insert({
            card_id: newExpense.card_id,
            description: `${newExpense.description} (À vista)`,
            amount: newExpense.amount,
            category: newExpense.category,
            transaction_type: 'debit',
            transaction_date: newExpense.transaction_date
          });

        if (error) throw error;
      }

      // Update card balance
      const updatedBalance = selectedCard.current_balance + newExpense.amount;
      const { error: updateError } = await supabase
        .from('bank_cards')
        .update({ 
          current_balance: updatedBalance,
          available_limit: selectedCard.card_type === 'credit' ? 
            (selectedCard.limit_amount || 0) - updatedBalance : undefined
        })
        .eq('id', newExpense.card_id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: `Despesa ${newExpense.payment_type === 'parcelado' ? 'parcelada' : 'à vista'} adicionada com sucesso`
      });

      // Reset form
      setNewExpense({
        card_id: "",
        description: "",
        amount: 0,
        category: "",
        payment_type: "vista",
        installments: 1,
        transaction_date: new Date().toISOString().split('T')[0]
      });
      setIsAddingExpense(false);
      loadCards(); // Reload to update balance
      
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: "Erro",
        description: "Erro ao adicionar despesa",
        variant: "destructive"
      });
    }
  };

  const syncCardTransactions = async (cardId: string) => {
    try {
      // Simulate sync process
      toast({
        title: "Sincronização Iniciada",
        description: "Sincronizando transações do cartão..."
      });

      // In real implementation, this would call an API or process imported data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await loadCards(); // Reload data
      
      toast({
        title: "Sucesso",
        description: "Transações sincronizadas com sucesso"
      });
      
    } catch (error) {
      console.error('Error syncing card transactions:', error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar transações",
        variant: "destructive"
      });
    }
  };

  const getCardTransactions = (cardId: string) => {
    const cardTransactions = transactions.filter(transaction => transaction.cardId === cardId);
    
    console.log('Filtering transactions for card:', cardId);
    console.log('All transactions for card:', cardTransactions);
    console.log('Selected filter type:', filterType);
    console.log('Selected period:', { startDate, endDate });
    
    // Filter by selected date range
    const filtered = cardTransactions.filter(transaction => {
      if (filterType === 'month') {
        // Filter by selected month and year
        const transactionDate = new Date(transaction.date);
        const transactionMonth = transactionDate.getMonth() + 1; // getMonth() returns 0-11
        const transactionYear = transactionDate.getFullYear();
        return transactionMonth === selectedMonth && transactionYear === selectedYear;
      } else {
        // Filter by date period - normalize dates to avoid timezone issues
        const transactionDateStr = transaction.date; // Should be in YYYY-MM-DD format
        const startDateStr = startDate; // YYYY-MM-DD format
        const endDateStr = endDate; // YYYY-MM-DD format
        
        console.log('Comparing:', {
          transactionDate: transactionDateStr,
          startDate: startDateStr,
          endDate: endDateStr,
          included: transactionDateStr >= startDateStr && transactionDateStr <= endDateStr
        });
        
        // Simple string comparison works for YYYY-MM-DD format
        return transactionDateStr >= startDateStr && transactionDateStr <= endDateStr;
      }
    });
    
    console.log('Filtered transactions:', filtered);
    return filtered;
  };

  const getFilteredTransactionsSummary = (cardId: string) => {
    const filteredTransactions = getCardTransactions(cardId);
    const totalExpenses = filteredTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = filteredTransactions
      .filter(t => t.type === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      count: filteredTransactions.length,
      totalExpenses,
      totalPayments,
      balance: totalExpenses - totalPayments
    };
  };

  const getMonthOptions = () => {
    const months = [
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
    return months;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
      years.push({ value: year, label: year.toString() });
    }
    return years;
  };

  const getCardStatusBadge = (card: BankCard) => {
    if (!card.is_active) {
      return <Badge variant="secondary">Inativo</Badge>;
    }
    
    if (card.card_type === 'credit' && card.available_limit !== undefined) {
      const usagePercentage = ((card.limit_amount || 0) - card.available_limit) / (card.limit_amount || 1) * 100;
      if (usagePercentage > 80) {
        return <Badge variant="destructive">Limite Alto</Badge>;
      } else if (usagePercentage > 60) {
        return <Badge variant="outline">Atenção</Badge>;
      }
    }
    
    return <Badge variant="default">Ativo</Badge>;
  };

  const getNextDueDate = (dueDate: number) => {
    const today = new Date();
    const nextDue = new Date(today.getFullYear(), today.getMonth(), dueDate);
    if (nextDue < today) {
      nextDue.setMonth(nextDue.getMonth() + 1);
    }
    return nextDue.toLocaleDateString('pt-BR');
  };

  useEffect(() => {
    loadCards();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse">Carregando cartões...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cartões Bancários</h1>
          <p className="text-muted-foreground">
            Gerencie seus cartões de crédito e débito
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nova Despesa
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Cartão
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Cartão</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cardName">Nome do Cartão</Label>
                  <Input
                    id="cardName"
                    value={newCard.name}
                    onChange={(e) => setNewCard({...newCard, name: e.target.value})}
                    placeholder="Ex: Cartão Empresarial Principal"
                  />
                </div>
                <div>
                  <Label htmlFor="cardNumber">Últimos 4 Dígitos</Label>
                  <Input
                    id="cardNumber"
                    value={newCard.card_number}
                    onChange={(e) => setNewCard({...newCard, card_number: e.target.value})}
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
                <div>
                  <Label htmlFor="cardType">Tipo do Cartão</Label>
                  <Select 
                    value={newCard.card_type} 
                    onValueChange={(value: 'credit' | 'debit') => setNewCard({...newCard, card_type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Crédito</SelectItem>
                      <SelectItem value="debit">Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="bank">Banco</Label>
                  <Input
                    id="bank"
                    value={newCard.bank}
                    onChange={(e) => setNewCard({...newCard, bank: e.target.value})}
                    placeholder="Nome do banco"
                  />
                </div>
                {newCard.card_type === 'credit' && (
                  <>
                    <div>
                      <Label htmlFor="limit">Limite</Label>
                      <CurrencyInput
                        id="limit"
                        value={newCard.limit_amount}
                        onChange={(value) => setNewCard({...newCard, limit_amount: value})}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dueDate">Dia Vencimento</Label>
                        <Input
                          id="dueDate"
                          type="number"
                          min="1"
                          max="31"
                          value={newCard.due_date}
                          onChange={(e) => setNewCard({...newCard, due_date: parseInt(e.target.value) || 10})}
                        />
                      </div>
                      <div>
                        <Label htmlFor="closingDate">Dia Fechamento</Label>
                        <Input
                          id="closingDate"
                          type="number"
                          min="1"
                          max="31"
                          value={newCard.closing_date}
                          onChange={(e) => setNewCard({...newCard, closing_date: parseInt(e.target.value) || 5})}
                        />
                      </div>
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="currentBalance">Saldo Atual</Label>
                  <CurrencyInput
                    id="currentBalance"
                    value={newCard.current_balance}
                    onChange={(value) => setNewCard({...newCard, current_balance: value})}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddingCard(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddCard}>
                    Salvar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cards">Cartões</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <Card key={card.id} className="relative">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      {card.name}
                    </div>
                  </CardTitle>
                  {getCardStatusBadge(card)}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cartão:</span>
                      <span>{card.card_number}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Banco:</span>
                      <span>{card.bank}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tipo:</span>
                      <span>{card.card_type === 'credit' ? 'Crédito' : 'Débito'}</span>
                    </div>
                    
                    {card.card_type === 'credit' && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Limite:</span>
                          <span>{canViewValues ? formatValue(card.limit_amount || 0) : '---'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Disponível:</span>
                          <span className="text-green-600">{canViewValues ? formatValue(card.available_limit || 0) : '---'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Próximo Vencimento:</span>
                          <span>{getNextDueDate(card.due_date || 10)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-muted-foreground">Saldo:</span>
                      <span className={card.card_type === 'credit' ? 'text-red-600' : 'text-green-600'}>
                        {canViewValues ? formatValue(card.current_balance) : '---'}
                      </span>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedCard(card);
                        setIsViewingCard(true);
                      }} title="Ver detalhes" aria-label="Ver detalhes">
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedCard(card);
                        setSelectedMonth(new Date().getMonth() + 1);
                        setSelectedYear(new Date().getFullYear());
                        setIsViewingStatement(true);
                      }} title="Ver documento" aria-label="Ver documento">
                        <FileText className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedCard(card);
                        setIsEditingCard(true);
                      }} title="Editar" aria-label="Editar">
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedCard(card);
                        setIsPayingCard(true);
                      }} title="Pagar Cartão">
                        <DollarSign className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => syncCardTransactions(card.id)} title="Atualizar" aria-label="Atualizar">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteCard(card.id)} title="Excluir" aria-label="Excluir">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transações dos Cartões</CardTitle>
              <CardDescription>
                Histórico de transações de todos os cartões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cartão</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const card = cards.find(c => c.id === transaction.cardId);
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{card?.name || 'N/A'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {transaction.description}
                          </TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'payment' ? 'default' : 'secondary'}>
                              {transaction.type === 'payment' ? 'Pagamento' : 
                               transaction.type === 'purchase' ? 'Compra' : 
                               transaction.type === 'fee' ? 'Taxa' : 'Juros'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'}>
                              {canViewValues ? formatValue(transaction.amount) : '---'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total em Cartões</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {canViewValues ? formatValue(cards.reduce((sum, card) => sum + card.current_balance, 0)) : '---'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Somatório de todos os cartões
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Limite Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {canViewValues ? formatValue(cards.filter(c => c.card_type === 'credit').reduce((sum, card) => sum + (card.limit_amount || 0), 0)) : '---'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Limite total dos cartões de crédito
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Limite Disponível</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {canViewValues ? formatValue(cards.filter(c => c.card_type === 'credit').reduce((sum, card) => sum + (card.available_limit || 0), 0)) : '---'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Limite disponível para uso
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cartões Ativos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {cards.filter(c => c.is_active).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {cards.length} cartões cadastrados
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Card Dialog */}
      <Dialog open={isEditingCard} onOpenChange={setIsEditingCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cartão</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editCardName">Nome do Cartão</Label>
                <Input
                  id="editCardName"
                  value={selectedCard.name}
                  onChange={(e) => setSelectedCard({...selectedCard, name: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="editBank">Banco</Label>
                <Input
                  id="editBank"
                  value={selectedCard.bank}
                  onChange={(e) => setSelectedCard({...selectedCard, bank: e.target.value})}
                />
              </div>
              {selectedCard.card_type === 'credit' && (
                <div>
                  <Label htmlFor="editLimit">Limite</Label>
                  <CurrencyInput
                    id="editLimit"
                    value={selectedCard.limit_amount || 0}
                    onChange={(value) => setSelectedCard({...selectedCard, limit_amount: value})}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="editBalance">Saldo Atual</Label>
                <CurrencyInput
                  id="editBalance"
                  value={selectedCard.current_balance}
                  onChange={(value) => setSelectedCard({...selectedCard, current_balance: value})}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditingCard(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleEditCard}>
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Card Dialog */}
      <Dialog open={isViewingCard} onOpenChange={setIsViewingCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Cartão</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Nome:</span>
                  <div className="font-semibold">{selectedCard.name}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Cartão:</span>
                  <div className="font-semibold">{selectedCard.card_number}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Banco:</span>
                  <div className="font-semibold">{selectedCard.bank}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <div className="font-semibold">{selectedCard.card_type === 'credit' ? 'Crédito' : 'Débito'}</div>
                </div>
                {selectedCard.card_type === 'credit' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Limite:</span>
                      <div className="font-semibold">{canViewValues ? formatValue(selectedCard.limit_amount || 0) : '---'}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Disponível:</span>
                      <div className="font-semibold text-green-600">{canViewValues ? formatValue(selectedCard.available_limit || 0) : '---'}</div>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-muted-foreground">Saldo:</span>
                  <div className={`font-semibold ${selectedCard.card_type === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                    {canViewValues ? formatValue(selectedCard.current_balance) : '---'}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div>{selectedCard.is_active ? 'Ativo' : 'Inativo'}</div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setIsViewingCard(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditingTransaction} onOpenChange={setIsEditingTransaction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_description">Descrição</Label>
              <Input
                id="edit_description"
                value={transactionEdit.description}
                onChange={(e) => setTransactionEdit({...transactionEdit, description: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_category">Categoria</Label>
              <Input
                id="edit_category"
                value={transactionEdit.category}
                onChange={(e) => setTransactionEdit({...transactionEdit, category: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_amount">Valor</Label>
              <CurrencyInput
                id="edit_amount"
                value={transactionEdit.amount}
                onChange={(value) => setTransactionEdit({...transactionEdit, amount: value})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_date">Data</Label>
              <Input
                id="edit_date"
                type="date"
                value={transactionEdit.transaction_date}
                onChange={(e) => setTransactionEdit({...transactionEdit, transaction_date: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditingTransaction(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditTransaction}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Statement Dialog */}
      <Dialog open={isViewingStatement} onOpenChange={setIsViewingStatement}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Extrato do Cartão - {selectedCard?.name}</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-muted-foreground text-sm">Cartão:</span>
                  <div className="font-semibold">{selectedCard.card_number}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Banco:</span>
                  <div className="font-semibold">{selectedCard.bank}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Saldo Atual:</span>
                  <div className={`font-semibold ${selectedCard.card_type === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                    {canViewValues ? formatValue(selectedCard.current_balance) : '---'}
                  </div>
                </div>
              </div>

              {/* Filtro de Período */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <Label>Tipo de Filtro:</Label>
                  <Select
                    value={filterType}
                    onValueChange={(value: 'month' | 'period') => setFilterType(value)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Por Mês</SelectItem>
                      <SelectItem value="period">Por Período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filterType === 'month' ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="monthSelect">Mês:</Label>
                      <Select
                        value={selectedMonth.toString()}
                        onValueChange={(value) => setSelectedMonth(parseInt(value))}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getMonthOptions().map((month) => (
                            <SelectItem key={month.value} value={month.value.toString()}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor="yearSelect">Ano:</Label>
                      <Select
                        value={selectedYear.toString()}
                        onValueChange={(value) => setSelectedYear(parseInt(value))}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getYearOptions().map((year) => (
                            <SelectItem key={year.value} value={year.value.toString()}>
                              {year.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="startDate">Data Inicial:</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="endDate">Data Final:</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-[150px]"
                      />
                    </div>
                  </div>
                )}

                {(() => {
                  const summary = getFilteredTransactionsSummary(selectedCard.id);
                  return (
                    <div className="flex items-center gap-4 ml-auto text-sm pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Transações: </span>
                        <span className="font-semibold">{summary.count}</span>
                      </div>
                      {canViewValues && (
                        <>
                          <div>
                            <span className="text-muted-foreground">Gastos: </span>
                            <span className="font-semibold text-red-600">{formatValue(summary.totalExpenses)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Pagamentos: </span>
                            <span className="font-semibold text-green-600">{formatValue(summary.totalPayments)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div>
                <h4 className="font-semibold mb-3">Transações do Cartão</h4>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getCardTransactions(selectedCard.id).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhuma transação encontrada para este cartão
                          </TableCell>
                        </TableRow>
                      ) : (
                        getCardTransactions(selectedCard.id).map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {new Date(transaction.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {transaction.description}
                            </TableCell>
                            <TableCell>{transaction.category}</TableCell>
                            <TableCell>
                              <Badge variant={transaction.type === 'payment' ? 'default' : 'secondary'}>
                                {transaction.type === 'payment' ? 'Pagamento' : 
                                 transaction.type === 'purchase' ? 'Compra' : 
                                 transaction.type === 'fee' ? 'Taxa' : 'Juros'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={transaction.type === 'payment' ? 'text-green-600' : 'text-red-600'}>
                                {canViewValues ? formatValue(transaction.amount) : '---'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedTransaction(transaction);
                                    setTransactionEdit({
                                      id: transaction.id,
                                      description: transaction.description,
                                      amount: transaction.amount,
                                      category: transaction.category,
                                      transaction_date: transaction.date
                                    });
                                    setIsEditingTransaction(true);
                                  }} title="Editar" aria-label="Editar">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm('Tem certeza que deseja remover esta transação?')) {
                                      handleDeleteTransaction(transaction.id);
                                    }
                                  }} title="Excluir" aria-label="Excluir">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              <div className="flex justify-between">
                <div className="text-sm text-muted-foreground">
                  {filterType === 'month' ? (
                    <>Mostrando {getMonthOptions().find(m => m.value === selectedMonth)?.label} de {selectedYear}</>
                  ) : (
                    <>Mostrando período de {new Date(startDate).toLocaleDateString('pt-BR')} até {new Date(endDate).toLocaleDateString('pt-BR')}</>
                  )} | Total de transações: {getCardTransactions(selectedCard.id).length}
                </div>
                <Button variant="outline" onClick={() => setIsViewingStatement(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay Card Dialog */}
      <Dialog open={isPayingCard} onOpenChange={setIsPayingCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagar Cartão - {selectedCard?.name}</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cartão:</span>
                    <div className="font-semibold">{selectedCard.card_number}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Saldo Atual:</span>
                    <div className={`font-semibold ${selectedCard.card_type === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                      {canViewValues ? formatValue(selectedCard.current_balance) : '---'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="paymentAmount">Valor do Pagamento *</Label>
                <CurrencyInput
                  id="paymentAmount"
                  value={cardPayment.amount}
                  onChange={(value) => setCardPayment({...cardPayment, amount: value})}
                  placeholder="R$ 0,00"
                />
              </div>

              <div>
                <Label htmlFor="paymentDescription">Descrição</Label>
                <Input
                  id="paymentDescription"
                  value={cardPayment.description}
                  onChange={(e) => setCardPayment({...cardPayment, description: e.target.value})}
                  placeholder={`Pagamento Cartão - ${selectedCard.name}`}
                />
              </div>

              <div>
                <Label htmlFor="paymentDate">Data do Pagamento</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={cardPayment.payment_date}
                  onChange={(e) => setCardPayment({...cardPayment, payment_date: e.target.value})}
                />
              </div>

              {cardPayment.amount > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    <strong>Novo saldo após pagamento:</strong> {canViewValues ? formatValue(Math.max(0, selectedCard.current_balance - cardPayment.amount)) : '---'}
                  </p>
                  {selectedCard.card_type === 'credit' && selectedCard.limit_amount && (
                    <p className="text-sm text-green-700 mt-1">
                      <strong>Limite disponível:</strong> {canViewValues ? formatValue((selectedCard.limit_amount || 0) - Math.max(0, selectedCard.current_balance - cardPayment.amount)) : '---'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setIsPayingCard(false);
                  setSelectedCard(null);
                  setCardPayment({
                    amount: 0,
                    description: "",
                    payment_date: new Date().toISOString().split('T')[0]
                  });
                }}>
                  Cancelar
                </Button>
                <Button onClick={handlePayCard} disabled={cardPayment.amount <= 0}>
                  Confirmar Pagamento
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={isAddingExpense} onOpenChange={setIsAddingExpense}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Despesa no Cartão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="expenseCard">Cartão</Label>
              <Select
                value={newExpense.card_id}
                onValueChange={(value) => setNewExpense({...newExpense, card_id: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cartão" />
                </SelectTrigger>
                <SelectContent>
                  {cards.filter(card => card.is_active).map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name} - {card.bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="expenseDescription">Descrição</Label>
              <Input
                id="expenseDescription"
                value={newExpense.description}
                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                placeholder="Ex: Compra no supermercado"
              />
            </div>
            <div>
              <Label htmlFor="expenseAmount">Valor</Label>
              <CurrencyInput
                id="expenseAmount"
                value={newExpense.amount}
                onChange={(value) => setNewExpense({...newExpense, amount: value})}
                placeholder="R$ 0,00"
              />
            </div>
            <div>
              <Label htmlFor="expenseCategory">Categoria</Label>
              <Select
                value={newExpense.category}
                onValueChange={(value) => setNewExpense({...newExpense, category: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alimentação">Alimentação</SelectItem>
                  <SelectItem value="Combustível">Combustível</SelectItem>
                  <SelectItem value="Equipamentos">Equipamentos</SelectItem>
                  <SelectItem value="Material">Material</SelectItem>
                  <SelectItem value="Manutenção">Manutenção</SelectItem>
                  <SelectItem value="Escritório">Escritório</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="paymentType">Tipo de Pagamento</Label>
              <Select
                value={newExpense.payment_type}
                onValueChange={(value: 'vista' | 'parcelado') => setNewExpense({...newExpense, payment_type: value, installments: value === 'vista' ? 1 : newExpense.installments})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vista">À Vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newExpense.payment_type === 'parcelado' && (
              <div>
                <Label htmlFor="installments">Número de Parcelas</Label>
                <Input
                  id="installments"
                  type="number"
                  min="2"
                  max="24"
                  value={newExpense.installments}
                  onChange={(e) => setNewExpense({...newExpense, installments: parseInt(e.target.value) || 2})}
                  placeholder="2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Valor por parcela: R$ {newExpense.amount > 0 ? (newExpense.amount / newExpense.installments).toFixed(2) : '0,00'}
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="transactionDate">Data da Compra</Label>
              <Input
                id="transactionDate"
                type="date"
                value={newExpense.transaction_date}
                onChange={(e) => setNewExpense({...newExpense, transaction_date: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingExpense(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddExpense}>
                Adicionar Despesa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};