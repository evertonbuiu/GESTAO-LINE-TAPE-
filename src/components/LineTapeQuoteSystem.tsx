import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Eye, Edit, Trash2, DollarSign, Calculator, 
  FileText, Download, Upload, Save, Image, Calendar,
  RefreshCw, Copy, Send, CheckCircle, MapPin, Phone, Mail, Building
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { useValueVisibility } from "@/hooks/useValueVisibility";
import { useLogo } from "@/hooks/useLogo";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPhone, handlePhoneInput, formatDocument } from '@/lib/utils';
import { ContractHeader } from "./ContractHeader";
import { ContractSignature } from "./ContractSignature";
import { ContractSummary } from "./ContractSummary";
import { ContractTerms } from "./ContractTerms";
import { ContractTerms as ContractTermsType, BankAccountData as BankAccountDataType } from "@/types/contract";
import { BankAccountData } from "./BankAccountData";
import { PaymentReceipt } from "./PaymentReceipt";
import { numberToWords } from "@/utils/numberToWords";
import {
  QuoteItem, QuoteSort, calculateQuoteTotals, filterQuotes, sortQuotes, makeItemId,
  roundMoney, validateQuoteStep, hasMinimumForDocuments, buildWhatsAppMessage,
  buildWhatsAppUrl, buildDuplicatePayload, getQuoteStatusLabel, resolveStoredQuoteTax
} from "@/lib/quotes";
import { reserveQuoteNumber } from "@/hooks/useQuoteNumber";
import { useQuoteDraft } from "@/hooks/useQuoteDraft";
import { ClientAutocomplete } from "./quotes/ClientAutocomplete";
import { QuoteWizardProgress } from "./quotes/QuoteWizardProgress";
import { EquipmentPicker } from "./quotes/EquipmentPicker";
import { QuoteTotalsPanel } from "./quotes/QuoteTotalsPanel";
import { QuotesToolbar } from "./quotes/QuotesToolbar";
import { QuoteCard } from "./quotes/QuoteCard";
import { QuotePreviewDialog } from "./quotes/QuotePreviewDialog";
import { PageActions } from "@/components/layout/PageHeader";
import { fileExtension, resolveProductImageDisplayUrl, validateProductImageUpload } from "@/lib/storageUrls";


interface QuoteProduct {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  image_url?: string;
}

interface LineTapeQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  
  // Dados do cliente
  client_name: string;
  client_email: string;
  client_phone: string;
  client_document: string;
  client_address: string;
  event_date: string;
  event_location: string;
  event_name: string;
  decorator_name: string;
  initial_setup_date: string;
  technical_responsible: string;
  
  // ID do evento vinculado (se existir)
  event_id?: string;
  
  // Produtos e valores
  products: QuoteProduct[];
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  travel_expense: number;
  accommodation_expense: number;
  total_amount: number;
  
  // Opções fiscais
  tax_option: 'sem_nota' | 'isento' | 'com_nota';
  tax_percentage?: number;
  tax_amount?: number;
  
  // Status
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  
  // Notes (para salvar dados do contrato)
  notes?: string;
  
  created_at: string;
  updated_at: string;
}

// Dados da empresa LINE TAPE
const COMPANY_DATA = {
  name: "LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA",
  address: "RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS",
  phone: "(62) 98343-6154",
  email: "linetapegyn@gmail.com",
  logo_url: "/line-tape-brand-512.png"
};

export const LineTapeQuoteSystem = () => {
  const { userRole, user } = useCustomAuth();
  const { formatValue, canViewValues } = useValueVisibility();
  const { logoUrl } = useLogo();
  
  const [quotes, setQuotes] = useState<LineTapeQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<LineTapeQuote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("quote");
  
  // Estados para o formulário
  const [formData, setFormData] = useState({
    quote_number: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_document: '',
    client_address: '',
    event_date: '',
    event_location: '',
    event_name: '',
    decorator_name: '',
    initial_setup_date: '',
    technical_responsible: '',
    discount_percentage: 0,
    travel_expense: 0,
    accommodation_expense: 0,
    tax_option: 'sem_nota' as 'sem_nota' | 'isento' | 'com_nota',
    tax_percentage: 15, // Porcentagem padrão para nota fiscal
  });

  // Estados para contrato de serviço
  const [contractData, setContractData] = useState({
    contractNumber: '',
    budgetNumber: '',
    companyName: 'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA',
    companyAddress: 'RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS',
    companyPhone: '(62) 98343-6154',
    companyEmail: 'linetapegyn@gmail.com',
    companyDocument: '',
    clientDocument: '',
    clientAddress: '',
    clientPhone: '',
    initialSetupDate: '',
    technicalResponsible: '',
    serviceDescription: '',
    companySignature: '',
    clientSignature: '',
  });

  const [contractTerms, setContractTerms] = useState<ContractTermsType>({
    paymentTerms: '',
    deliveryTerms: '',
    cancellationPolicy: '',
    warrantyTerms: '',
    additionalTerms: ''
  });

  const [bankAccountData, setBankAccountData] = useState<BankAccountDataType>({
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    accountAgency: '',
    accountDocument: '',
    pixKey: ''
  });

  const [products, setProducts] = useState<QuoteItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState({
    name: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    category: '',
    image_url: '',
  });
  
  const [uploading, setUploading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingQuote, setEditingQuote] = useState<LineTapeQuote | null>(null);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOption, setSortOption] = useState<QuoteSort>('event_date_asc');
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<1 | 2 | 3>(1);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; quote_number?: string } | null>(null);
  const [previewQuote, setPreviewQuote] = useState<LineTapeQuote | null>(null);
  const [statusChangeRequest, setStatusChangeRequest] = useState<{
    quote: { id: string; quote_number?: string };
    status: string;
  } | null>(null);
  const [includePaymentDataInQuote, setIncludePaymentDataInQuote] = useState(false);
  const [savedBankAccounts, setSavedBankAccounts] = useState<any[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [saveBankAccountName, setSaveBankAccountName] = useState('');

  // Estados para equipamentos disponíveis
  const [availableEquipment, setAvailableEquipment] = useState<any[]>([]);
  const [equipmentImageMap, setEquipmentImageMap] = useState<Record<string, string>>({});


  const canManage = userRole === 'admin' || userRole === 'financeiro';

  // Rascunho automático (localStorage)
  const draftKey = editingQuote ? `quote-draft-${editingQuote.id}` : 'quote-draft-new';
  const { status: draftStatus, clearDraft } = useQuoteDraft(
    draftKey,
    { formData, products },
    isDialogOpen && canManage,
  );

  const documentsUnlocked = hasMinimumForDocuments(formData, products);

  const goToNextStep = () => {
    const validation = validateQuoteStep(currentStep, formData, products);
    if (!validation.valid) {
      setStepErrors(validation.errors);
      return;
    }
    setStepErrors([]);
    const next = Math.min(currentStep + 1, 3) as 1 | 2 | 3;
    setCurrentStep(next);
    setMaxReachedStep((prev) => (next > prev ? next : prev));
  };

  const goToPreviousStep = () => {
    setStepErrors([]);
    setCurrentStep((prev) => (Math.max(prev - 1, 1) as 1 | 2 | 3));
  };


  // Função para formatar data corretamente sem problemas de timezone
  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    // Extrair apenas a parte YYYY-MM-DD
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };

  // Função para formatar data no PDF sem problemas de timezone
  const formatDateForPDF = (dateString: string) => {
    if (!dateString) return '';
    // Extrair apenas a parte YYYY-MM-DD
    const dateOnly = dateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    loadQuotes();
    loadAvailableEquipment();
    loadSavedBankAccounts();
  }, []);

  const loadSavedBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_bank_accounts')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao carregar contas bancárias:', error);
        return;
      }

      setSavedBankAccounts(data || []);
      
      // Auto-select default account if exists
      const defaultAccount = data?.find((acc: any) => acc.is_default);
      if (defaultAccount) {
        setSelectedBankAccountId(defaultAccount.id);
        setBankAccountData({
          bankName: defaultAccount.bank_name || '',
          accountHolder: defaultAccount.account_holder || '',
          accountNumber: defaultAccount.account_number || '',
          accountAgency: defaultAccount.account_agency || '',
          accountDocument: defaultAccount.account_document || '',
          pixKey: defaultAccount.pix_key || ''
        });
      }
    } catch (error) {
      console.error('Erro ao carregar contas bancárias:', error);
    }
  };

  const saveBankAccount = async () => {
    if (!saveBankAccountName.trim()) {
      toast.error('Digite um nome para salvar os dados bancários');
      return;
    }

    if (!bankAccountData.bankName && !bankAccountData.pixKey) {
      toast.error('Preencha pelo menos o nome do banco ou chave PIX');
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_bank_accounts')
        .insert({
          name: saveBankAccountName.trim(),
          bank_name: bankAccountData.bankName,
          account_holder: bankAccountData.accountHolder,
          account_number: bankAccountData.accountNumber,
          account_agency: bankAccountData.accountAgency,
          account_document: bankAccountData.accountDocument,
          pix_key: bankAccountData.pixKey,
          created_by: user?.id
        });

      if (error) {
        console.error('Erro ao salvar conta bancária:', error);
        toast.error('Erro ao salvar dados bancários');
        return;
      }

      toast.success('Dados bancários salvos com sucesso!');
      setSaveBankAccountName('');
      loadSavedBankAccounts();
    } catch (error) {
      console.error('Erro ao salvar conta bancária:', error);
      toast.error('Erro ao salvar dados bancários');
    }
  };

  const deleteBankAccount = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_bank_accounts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir conta bancária:', error);
        toast.error('Erro ao excluir dados bancários');
        return;
      }

      toast.success('Dados bancários excluídos!');
      if (selectedBankAccountId === id) {
        setSelectedBankAccountId('');
      }
      loadSavedBankAccounts();
    } catch (error) {
      console.error('Erro ao excluir conta bancária:', error);
    }
  };

  const selectBankAccount = (accountId: string) => {
    setSelectedBankAccountId(accountId);
    
    if (accountId === 'manual') {
      setBankAccountData({
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        accountAgency: '',
        accountDocument: '',
        pixKey: ''
      });
      return;
    }

    const account = savedBankAccounts.find(acc => acc.id === accountId);
    if (account) {
      setBankAccountData({
        bankName: account.bank_name || '',
        accountHolder: account.account_holder || '',
        accountNumber: account.account_number || '',
        accountAgency: account.account_agency || '',
        accountDocument: account.account_document || '',
        pixKey: account.pix_key || ''
      });
    }
  };

  const loadQuotes = async () => {
    setLoadingQuotes(true);
    try {

      // Carregar apenas orçamentos externos
      const { data: externalData, error: externalError } = await supabase
        .from('external_quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (externalError) {
        console.error('Erro ao carregar orçamentos externos:', externalError);
      }

      // Converter orçamentos externos para formato Letra 3D line tape
      const externalQuotes = (externalData || []).map(external => ({
        id: external.id,
        quote_number: external.quote_number,
        quote_date: external.quote_date,
        client_name: external.client_name,
        client_email: external.client_email || '',
        client_phone: external.client_phone || '',
        client_document: external.client_document || '',
        client_address: external.client_address || '',
        event_date: external.event_date,
        event_location: external.event_location || '',
        event_name: external.event_name || '',
        decorator_name: external.decorator_name || '',
        initial_setup_date: external.initial_setup_date || '',
        technical_responsible: external.technical_responsible || '',
        event_id: external.event_id || undefined,
        products: ((external.products as unknown) as QuoteProduct[]) || [],
        subtotal: external.subtotal || 0,
        discount_percentage: external.discount_percentage || 0,
        discount_amount: external.discount_amount || 0,
        travel_expense: external.travel_expense || 0,
        accommodation_expense: external.accommodation_expense || 0,
        total_amount: external.total_amount || 0,
        tax_option: external.tax_option || 'sem_nota' as const,
        tax_percentage: external.tax_percentage ?? 15,
        tax_amount: external.tax_amount ?? undefined,
        status: external.status || 'draft' as const,
        notes: external.notes || '',
        created_at: external.created_at,
        updated_at: external.updated_at,
      })) as LineTapeQuote[];

      setQuotes(externalQuotes);
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoadingQuotes(false);
    }
  };


  const loadAvailableEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('status', 'available');

      if (error) {
        console.error('Erro ao carregar equipamentos:', error);
      } else {
        setAvailableEquipment(data || []);
      }

      // Mapa de imagens de TODOS os equipamentos (independente do status),
      // usado para resolver a foto de itens antigos sem image_url no snapshot.
      const { data: allEquipment, error: mapError } = await supabase
        .from('equipment')
        .select('id, name, image_url');

      if (mapError) {
        console.error('Erro ao carregar imagens de equipamentos:', mapError);
        return;
      }

      const map: Record<string, string> = {};
      (allEquipment || []).forEach((row: any) => {
        if (!row?.image_url) return;
        if (row.id) map[String(row.id)] = row.image_url;
        if (row.name) map[String(row.name).trim().toLowerCase()] = row.image_url;
      });
      setEquipmentImageMap(map);
    } catch (error) {
      console.error('Erro ao carregar equipamentos:', error);
    }
  };

  // Resolve a foto do item: usa a URL do snapshot; se ausente, busca pelo ID
  // estável do equipamento ou pelo nome.
  const resolveProductImage = (product: QuoteProduct): string | undefined => {
    if (product.image_url) return resolveProductImageDisplayUrl(product.image_url);
    const byId = product.id ? equipmentImageMap[String(product.id)] : undefined;
    if (byId) return resolveProductImageDisplayUrl(byId);
    const byName = product.name ? equipmentImageMap[product.name.trim().toLowerCase()] : undefined;
    return resolveProductImageDisplayUrl(byName);
  };

  const withResolvedImages = (quote: LineTapeQuote): LineTapeQuote => ({
    ...quote,
    products: (quote.products || []).map((p) => ({ ...p, image_url: resolveProductImage(p) })),
  });

  // No aplicativo instalado o cache pode entregar a lista de orçamentos antes
  // do mapa de equipamentos. Quando as imagens chegam, atualiza a janela já
  // aberta em vez de manter permanentemente o estado "Sem imagem".
  useEffect(() => {
    setPreviewQuote((current) => {
      if (!current) return current;
      let changed = false;
      const nextProducts = (current.products || []).map((product) => {
        const resolved = resolveProductImage(product);
        if (resolved && resolved !== product.image_url) {
          changed = true;
          return { ...product, image_url: resolved };
        }
        return product;
      });
      return changed ? { ...current, products: nextProducts } : current;
    });
  }, [equipmentImageMap]);


  // Gerar número do orçamento
  const generateQuoteNumber = () => {
    const count = quotes.length + 1;
    return `#${count.toString().padStart(3, '0')}`;
  };

  // Calcular totais (lógica central em src/lib/quotes.ts)
  const calculateTotals = () =>
    calculateQuoteTotals({
      items: products,
      discount_percentage: formData.discount_percentage,
      travel_expense: formData.travel_expense,
      accommodation_expense: formData.accommodation_expense,
      tax_option: formData.tax_option,
      tax_percentage: formData.tax_percentage,
    });


  // Adicionar produto ao orçamento
  const addProductToQuote = () => {
    if (!currentProduct.name || currentProduct.unit_price < 0) {
      toast.error('Preencha todos os campos do produto');
      return;
    }

    const newProduct: QuoteItem = {
      ...currentProduct,
      id: editingIndex !== null ? products[editingIndex]?.id || makeItemId() : makeItemId(),
      total_price: roundMoney(currentProduct.quantity * currentProduct.unit_price),
    };


    if (editingIndex !== null) {
      // Editar produto existente
      const updatedProducts = [...products];
      updatedProducts[editingIndex] = newProduct;
      setProducts(updatedProducts);
      toast.success('Produto atualizado com sucesso!');
    } else {
      // Adicionar novo produto
      setProducts([...products, newProduct]);
      toast.success('Produto adicionado com sucesso!');
    }

    // Resetar formulário
    setCurrentProduct({
      name: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      category: '',
      image_url: '',
    });
    setEditingIndex(null);
    setIsProductDialogOpen(false);
  };

  // Editar produto
  const editProduct = (index: number) => {
    const product = products[index];
    setCurrentProduct({
      name: product.name,
      description: product.description,
      quantity: product.quantity,
      unit_price: product.unit_price,
      category: product.category || '',
      image_url: product.image_url || '',
    });
    setEditingIndex(index);
    setIsProductDialogOpen(true);
  };

  // Editar orçamento
  const editQuote = (quote: LineTapeQuote) => {
    console.log('Editando orçamento:', quote); // Debug
    setEditingQuote(quote);
    
    // Preencher formulário com dados do orçamento
    setFormData({
      quote_number: quote.quote_number,
      client_name: quote.client_name,
      client_email: quote.client_email,
      client_phone: quote.client_phone || '',
      client_document: quote.client_document || '',
      client_address: quote.client_address || '',
      event_date: quote.event_date,
      event_location: quote.event_location,
      event_name: quote.event_name || '',
      decorator_name: quote.decorator_name,
      initial_setup_date: quote.initial_setup_date || '',
      technical_responsible: quote.technical_responsible || '',
      discount_percentage: quote.discount_percentage || 0,
      travel_expense: quote.travel_expense || 0,
      accommodation_expense: quote.accommodation_expense || 0,
      tax_option: (quote.tax_option as 'sem_nota' | 'isento' | 'com_nota') || 'sem_nota',
      tax_percentage: quote.tax_percentage ?? 15,
    });
    
    // Preencher produtos
    setProducts(quote.products.map(p => ({
      id: p.id || makeItemId(),
      name: p.name,
      description: p.description,
      quantity: p.quantity,
      unit_price: p.unit_price,
      category: p.category,
      image_url: p.image_url,
      total_price: p.total_price,
    })));
    setClientSearch(quote.client_name || '');
    setCurrentStep(1);
    setMaxReachedStep(3);

    
    // Carregar dados do contrato se existirem
    try {
      const savedContractData = JSON.parse(quote.notes || '{}');
      if (savedContractData.contractData) {
        setContractData(savedContractData.contractData);
      }
      if (savedContractData.contractTerms) {
        setContractTerms(savedContractData.contractTerms);
      }
    } catch (error) {
      // Se não for JSON válido, ignorar (pode ser uma nota antiga em texto)
      console.log('Não há dados de contrato salvos ou formato inválido');
    }
    
    setIsDialogOpen(true);
  };

  // Criar evento a partir do orçamento
  const createEventFromQuote = async (quote: LineTapeQuote) => {
    if (!canManage) {
      toast.error('Você não tem permissão para criar eventos');
      return;
    }

    try {
      // Verificar se já existe um evento com os mesmos dados
      const { data: existingEvents } = await supabase
        .from('events')
        .select('id')
        .eq('client_name', quote.client_name)
        .eq('event_date', quote.event_date);

      if (existingEvents && existingEvents.length > 0) {
        toast.error('Já existe um evento para este cliente nesta data');
        return;
      }

      // Verificar se o usuário está autenticado via sistema personalizado
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Função para extrair apenas a data sem timezone
      const extractDate = (dateString: string) => {
        if (!dateString) return null;
        // Remove timezone e horário se presente, mantém apenas YYYY-MM-DD
        return dateString.split('T')[0];
      };

      // Mapear dados do orçamento para evento
      const eventData = {
        name: quote.event_name || `Evento - ${quote.client_name}`,
        client_name: quote.client_name,
        client_email: quote.client_email || null,
        client_phone: quote.client_phone || null,
        event_date: extractDate(quote.event_date),
        event_time: null,
        location: quote.event_location || null,
        description: [
          `Evento criado automaticamente a partir do orçamento ${quote.quote_number}`,
          quote.decorator_name ? `Decoradora: ${quote.decorator_name}` : null,
          quote.technical_responsible ? `Responsável Técnico: ${quote.technical_responsible}` : null,
          quote.client_document ? `Documento: ${quote.client_document}` : null,
          quote.client_address ? `Endereço: ${quote.client_address}` : null,
        ].filter(Boolean).join('\n'),
        total_budget: quote.total_amount || 0,
        total_expenses: 0,
        profit_margin: quote.total_amount || 0,
        setup_start_date: extractDate(quote.initial_setup_date) || null,
        status: 'pending',
        created_by: user?.id,
        payment_type: 'total',
        is_paid: false,
        payment_amount: 0
      };

      console.log('Dados do evento a ser criado:', eventData);

      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar evento:', error);
        toast.error(`Erro ao criar evento: ${error.message}`);
        return;
      }

      console.log('Evento criado com sucesso:', data);

      // Criar itens do orçamento na lista de orçamentos do evento
      if (quote.products && quote.products.length > 0) {
        const eventBudgetItems = quote.products.map(product => ({
          event_id: data.id,
          item: product.name,
          description: product.description || '',
          quantity: product.quantity || 1,
          unit_price: product.unit_price || 0,
          total_price: product.total_price || (product.quantity * product.unit_price),
          image_url: product.image_url || null,
          created_by: user?.id
        }));

        const { error: budgetError } = await supabase
          .from('event_budgets')
          .insert(eventBudgetItems);

        if (budgetError) {
          console.error('Erro ao criar itens do orçamento:', budgetError);
          toast.error('Evento criado, mas erro ao criar lista de itens do orçamento');
        } else {
          console.log('Itens do orçamento criados com sucesso');
        }
      }

      toast.success(`Evento "${eventData.name}" criado com sucesso na aba Locações!`);
      
    } catch (error) {
      console.error('Erro inesperado ao criar evento:', error);
      toast.error(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };
  const deleteQuote = async (quote: { id: string; quote_number?: string }) => {
    if (!canManage) {
      toast.error('Você não tem permissão para excluir orçamentos');
      return;
    }



    try {
      // Excluir apenas orçamentos externos
      const { error } = await supabase
        .from('external_quotes')
        .delete()
        .eq('id', quote.id);

      if (error) {
        console.error('Erro ao excluir orçamento:', error);
        toast.error('Erro ao excluir orçamento');
        return;
      }

      toast.success('Orçamento excluído com sucesso!');
      loadQuotes();
    } catch (error) {
      console.error('Erro ao excluir orçamento:', error);
      toast.error('Erro ao excluir orçamento');
    }
  };

  // Filtrar e organizar orçamentos
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    quotes.forEach((quote) => {
      const year = parseInt((quote.event_date || '').split('T')[0].split('-')[0], 10);
      if (!Number.isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [quotes]);

  const filteredQuotes = useMemo(
    () =>
      sortQuotes(
        filterQuotes(quotes, {
          search: searchTerm,
          status: statusFilter,
          month: monthFilter,
          year: yearFilter === 'all' ? null : parseInt(yearFilter, 10),
        }),
        sortOption,
      ),
    [quotes, searchTerm, statusFilter, monthFilter, yearFilter, sortOption],
  );

  // Adicionar equipamento do estoque
  const addEquipmentToQuote = (equipment: any) => {
    const newProduct: QuoteItem = {
      id: makeItemId(),
      name: equipment.name,
      description: equipment.description || equipment.category,
      quantity: 1,
      unit_price: equipment.price_per_day || 0,
      category: equipment.category,
      total_price: equipment.price_per_day || 0,
    };

    setProducts([...products, newProduct]);
    toast.success('Equipamento adicionado ao orçamento!');
  };

  // Remover produto
  const removeProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
    toast.success('Produto removido do orçamento!');
  };

  // Duplicar orçamento
  const duplicateQuote = async (quote: { id: string }) => {
    if (!canManage) {
      toast.error('Você não tem permissão para duplicar orçamentos');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_quotes')
        .select('*')
        .eq('id', quote.id)
        .maybeSingle();

      if (error || !data) throw error || new Error('Orçamento não encontrado');

      const newNumber = await reserveQuoteNumber();
      const payload = buildDuplicatePayload(data as Record<string, unknown>, newNumber);

      const { error: insertError } = await supabase.from('external_quotes').insert(payload as any);
      if (insertError) throw insertError;

      toast.success(`Orçamento duplicado como ${newNumber}`);
      loadQuotes();
    } catch (error) {
      console.error('Erro ao duplicar orçamento:', error);
      toast.error('Erro ao duplicar orçamento');
    }
  };

  // Enviar orçamento por WhatsApp
  const sendQuoteByWhatsApp = (quote: {
    quote_number?: string;
    client_name?: string;
    client_phone?: string;
    event_name?: string;
    event_date?: string;
    total_amount?: number;
  }) => {
    if (!quote.client_phone) {
      toast.error('Este orçamento não possui telefone do cliente');
      return;
    }

    const message = buildWhatsAppMessage({ ...quote, showValues: canViewValues });
    window.open(buildWhatsAppUrl(quote.client_phone, message), '_blank', 'noopener,noreferrer');
  };

  // Alterar status do orçamento
  const changeQuoteStatus = async (quote: { id: string }, status: string) => {
    if (!canManage) {
      toast.error('Você não tem permissão para alterar orçamentos');
      return;
    }

    try {
      const { error } = await supabase
        .from('external_quotes')
        .update({ status })
        .eq('id', quote.id);

      if (error) throw error;

      toast.success(`Status alterado para ${getQuoteStatusLabel(status)}`);
      loadQuotes();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
      toast.error('Erro ao alterar status do orçamento');
    }
  };


  // Salvar orçamento externo
  const handleSubmitExternal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canManage) {
      toast.error('Você não tem permissão para criar orçamentos');
      return;
    }

    if (isSaving) return;

    const allErrors = [
      ...validateQuoteStep(1, formData, products).errors,
      ...validateQuoteStep(2, formData, products).errors,
      ...validateQuoteStep(3, formData, products).errors,
    ];

    if (allErrors.length > 0) {
      setStepErrors(allErrors);
      toast.error(allErrors[0]);
      return;
    }

    setStepErrors([]);
    setIsSaving(true);

    const totals = calculateTotals();

    // Função para ajustar data para timezone local
    const adjustDateForTimezone = (dateString: string) => {
      if (!dateString) return null;
      // Adiciona horário meio-dia para evitar problemas de timezone
      return `${dateString}T12:00:00`;
    };

    try {
      // Salvar dados do contrato junto com o orçamento
      const contractDataToSave = JSON.stringify({
        contractData,
        contractTerms
      });

      const normalizedProducts: QuoteItem[] = products.map((p) => ({
        ...p,
        id: p.id || makeItemId(),
        total_price: roundMoney((p.quantity || 0) * (p.unit_price || 0)),
      }));

      const quoteNumber = editingQuote
        ? editingQuote.quote_number
        : formData.quote_number || (await reserveQuoteNumber());

      const externalQuoteData = {
        quote_number: quoteNumber,
        client_name: formData.client_name,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        client_document: formData.client_document,
        client_address: formData.client_address,
        event_date: adjustDateForTimezone(formData.event_date),
        event_location: formData.event_location,
        event_name: formData.event_name,
        decorator_name: formData.decorator_name,
        initial_setup_date: adjustDateForTimezone(formData.initial_setup_date),
        technical_responsible: formData.technical_responsible,
        products: normalizedProducts,
        subtotal: totals.subtotal,
        discount_percentage: formData.discount_percentage,
        discount_amount: totals.discount_amount,
        travel_expense: formData.travel_expense,
        accommodation_expense: formData.accommodation_expense,
        total_amount: totals.total_amount,
        tax_option: formData.tax_option,
        tax_percentage: formData.tax_percentage,
        tax_amount: totals.tax_amount,
        status: editingQuote?.status || 'draft',
        notes: contractDataToSave,
      };

      if (editingQuote) {
        // Atualizar orçamento existente
        const { error } = await supabase
          .from('external_quotes')
          .update(externalQuoteData)
          .eq('id', editingQuote.id);

        if (error) {
          console.error('Erro detalhado ao atualizar orçamento externo:', error);
          toast.error(`Erro ao atualizar orçamento externo: ${error.message}`);
          return;
        }

        // Verificar se existe um evento vinculado a este orçamento (via event_id)
        let eventId: string | null = editingQuote.event_id || null;

        if (!eventId) {
          // Fallback: buscar por client_name e event_date
          const { data: existingEvents } = await supabase
            .from('events')
            .select('id')
            .eq('client_name', formData.client_name)
            .eq('event_date', formData.event_date.split('T')[0]);

          if (existingEvents && existingEvents.length > 0) {
            eventId = existingEvents[0].id;
          }
        }

        if (eventId) {
          // Atualizar dados do evento com as novas informações do orçamento
          const eventUpdateData = {
            name: formData.event_name || `Evento - ${formData.client_name}`,
            client_name: formData.client_name || null,
            client_email: formData.client_email || null,
            client_phone: formData.client_phone || null,
            location: formData.event_location || null,
            event_date: formData.event_date ? formData.event_date.split('T')[0] : null,
            description: [
              `Evento atualizado automaticamente a partir do orçamento ${quoteNumber}`,
              formData.decorator_name ? `Decoradora: ${formData.decorator_name}` : null,
              formData.technical_responsible ? `Responsável Técnico: ${formData.technical_responsible}` : null,
              formData.client_document ? `Documento: ${formData.client_document}` : null,
              formData.client_address ? `Endereço: ${formData.client_address}` : null,
            ].filter(Boolean).join('\n'),
            total_budget: totals.total_amount || 0,
            profit_margin: totals.total_amount || 0,
            setup_start_date: formData.initial_setup_date ? formData.initial_setup_date.split('T')[0] : null,
            updated_at: new Date().toISOString(),
          };

          const { error: updateError } = await supabase
            .from('events')
            .update(eventUpdateData)
            .eq('id', eventId);

          if (updateError) {
            console.error('Erro ao atualizar evento:', updateError);
          } else {
            // Sincronizar itens do orçamento do evento usando IDs estáveis
            const { data: existingBudgets } = await supabase
              .from('event_budgets')
              .select('id, item, source_item_id')
              .eq('event_id', eventId);

            const currentIds = new Set(normalizedProducts.map((p) => p.id));

            for (const budget of existingBudgets || []) {
              const stillExists = budget.source_item_id
                ? currentIds.has(budget.source_item_id)
                : normalizedProducts.some((p) => p.name === budget.item);

              if (!stillExists) {
                await supabase.from('event_budgets').delete().eq('id', budget.id);
              }
            }

            for (const product of normalizedProducts) {
              const existing = (existingBudgets || []).find(
                (b) => b.source_item_id === product.id || (!b.source_item_id && b.item === product.name),
              );

              const payload = {
                item: product.name,
                description: product.description || '',
                quantity: product.quantity || 1,
                unit_price: product.unit_price || 0,
                total_price: product.total_price,
                image_url: product.image_url || null,
                source_item_id: product.id,
              };

              if (existing) {
                await supabase.from('event_budgets').update(payload).eq('id', existing.id);
              } else {
                await supabase
                  .from('event_budgets')
                  .insert({ ...payload, event_id: eventId, created_by: user?.id });
              }
            }

            toast.success('Evento vinculado também foi atualizado!');
          }
        }

        toast.success('Orçamento atualizado com sucesso!');
      } else {
        // Criar novo orçamento
        const { error: quoteError } = await supabase
          .from('external_quotes')
          .insert(externalQuoteData);

        if (quoteError) {
          console.error('Erro detalhado ao salvar orçamento externo:', quoteError);
          toast.error(`Erro ao salvar orçamento externo: ${quoteError.message}`);
          return;
        }

        toast.success(`Orçamento ${quoteNumber} salvo com sucesso!`);
      }

      setIsDialogOpen(false);
      resetForm();
      loadQuotes();
    } catch (error) {
      console.error('Erro ao processar orçamento externo:', error);
      toast.error(`Erro ao processar orçamento externo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };



  // Gerar PDF do contrato de serviço no formato do template
  const generateContractPDF = async () => {
    if (!formData.client_name || products.length === 0) {
      toast.error('Preencha os dados do cliente e adicione produtos antes de gerar o PDF do contrato');
      return;
    }

    // Função para formatação de moeda brasileira
    const formatCurrency = (value: number): string => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    };

    const pdf = new jsPDF({
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 15;
    let contractLogoDataUrl: string | null = null;
    let contractLogoFormat: 'PNG' | 'JPEG' | 'WEBP' = 'PNG';

    for (const candidate of [...new Set([logoUrl, COMPANY_DATA.logo_url].filter(Boolean))] as string[]) {
      try {
        const logoResponse = await fetch(candidate, { cache: 'no-store' });
        if (!logoResponse.ok) continue;
        const logoBlob = await logoResponse.blob();
        contractLogoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(logoBlob);
        });
        contractLogoFormat = contractLogoDataUrl.startsWith('data:image/png')
          ? 'PNG'
          : contractLogoDataUrl.startsWith('data:image/webp')
            ? 'WEBP'
            : 'JPEG';
        break;
      } catch (error) {
        console.error('Erro ao carregar candidato de logo do contrato:', error);
      }
    }

    // Atualiza as referências das imagens no momento da geração para evitar
    // PDFs sem fotos quando a tela abriu antes da lista de equipamentos.
    const { data: contractEquipment } = await supabase
      .from('equipment')
      .select('id, name, image_url');
    const contractImageMap: Record<string, string> = { ...equipmentImageMap };
    (contractEquipment || []).forEach((item: any) => {
      if (!item?.image_url) return;
      if (item.id) contractImageMap[String(item.id)] = item.image_url;
      if (item.name) contractImageMap[String(item.name).trim().toLowerCase()] = item.image_url;
    });
    const resolveContractProductImage = (product: QuoteProduct): string | undefined => {
      const snapshot = resolveProductImageDisplayUrl(product.image_url);
      if (snapshot) return snapshot;
      const stored = contractImageMap[String(product.id)]
        || contractImageMap[String(product.name || '').trim().toLowerCase()];
      return resolveProductImageDisplayUrl(stored);
    };

    // === CABEÇALHO COM LOGO E DADOS DA EMPRESA ===
    // Logo à esquerda
    if (contractLogoDataUrl) {
      pdf.addImage(contractLogoDataUrl, contractLogoFormat, 15, 10, 40, 25, undefined, 'FAST');
    }

    // Nome da empresa (LINE TAPE) - centralizado e em azul
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor(65, 105, 225); // Azul royal
    pdf.text('LINE TAPE', pageWidth / 2, 25, { align: 'center' });

    // Dados da empresa
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    const companyInfo = `${contractData.companyAddress || 'RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS'}`;
    const contactInfo = `Tel: ${contractData.companyPhone || '(62) 98343-66154'} | Email: ${contractData.companyEmail || 'linetapegyn@gmail.com'}`;
    pdf.text(companyInfo, pageWidth / 2, 32, { align: 'center' });
    pdf.text(contactInfo, pageWidth / 2, 37, { align: 'center' });

    // Linha separadora azul
    pdf.setDrawColor(65, 105, 225);
    pdf.setLineWidth(1);
    pdf.line(15, 42, pageWidth - 15, 42);

    currentY = 55;

    // === TÍTULO DO CONTRATO ===
    pdf.setFillColor(65, 105, 225);
    pdf.rect(15, currentY, pageWidth - 30, 12, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ILUMINAÇÃO PARA EVENTOS', pageWidth / 2, currentY + 8, { align: 'center' });

    currentY += 20;

    // === DADOS DO CONTRATO ===
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    const contractNumber = contractData.contractNumber || '001';
    const budgetNumber = '002';
    const emissionDate = new Date().toLocaleDateString('pt-BR');
    const validity = '30 dias';

    pdf.text(`Contrato Nº: ${contractNumber}`, 20, currentY);
    pdf.text(`Orçamento Base Nº: ${budgetNumber}`, 70, currentY);
    pdf.text(`Data de Emissão: ${emissionDate}`, 120, currentY);
    pdf.text(`Validade: ${validity}`, pageWidth - 40, currentY);

    currentY += 18;

    // === 1. IDENTIFICAÇÃO DAS PARTES CONTRATANTES ===
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text('1. IDENTIFICAÇÃO DAS PARTES CONTRATANTES', pageWidth / 2, currentY + 5, { align: 'center' });

    currentY += 15;

    // CONTRATADA
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('CONTRATADA (Prestadora de Serviços):', 20, currentY);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    currentY += 5;
    pdf.text(`Razão Social: ${contractData.companyName || 'LINE TAPE'}`, 20, currentY);
    currentY += 4;
    pdf.text(`Endereço Completo: ${contractData.companyAddress || 'RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS'}`, 20, currentY);
    currentY += 4;
    pdf.text(`Telefone: ${contractData.companyPhone || '(62) 98343-66154'}`, 20, currentY);
    currentY += 4;
    pdf.text(`E-mail: ${contractData.companyEmail || 'linetapegyn@gmail.com'}`, 20, currentY);
    currentY += 4;
    pdf.text('Responsável Técnico: A designar', 20, currentY);

    currentY += 15;

    // CONTRATANTE
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('CONTRATANTE (Cliente):', 20, currentY);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    currentY += 5;
    pdf.text(`Nome/Razão Social: ${formData.client_name}`, 20, currentY);
    currentY += 4;
    if (contractData.clientDocument) {
      pdf.text(`CPF/CNPJ: ${contractData.clientDocument}`, 20, currentY);
      currentY += 4;
    }
    if (formData.client_email) {
      pdf.text(`E-mail: ${formData.client_email}`, 20, currentY);
      currentY += 4;
    }
    if (contractData.clientPhone) {
      pdf.text(`Telefone: ${contractData.clientPhone}`, 20, currentY);
      currentY += 4;
    }
    if (contractData.clientAddress) {
      pdf.text(`Endereço: ${contractData.clientAddress}`, 20, currentY);
      currentY += 4;
    }

    currentY += 15;

    // === 2. OBJETO DO CONTRATO ===
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('2. OBJETO DO CONTRATO', pageWidth / 2, currentY + 5, { align: 'center' });

    currentY += 15;

    // Descrição dos serviços
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Descrição dos Serviços:', 20, currentY);
    
    pdf.setFont('helvetica', 'normal');
    currentY += 5;
    const serviceDescription = contractData.serviceDescription || products.map(p => 
      `• ${p.name} ${p.description ? `- ${p.description}` : ''} (Quantidade: ${p.quantity})`
    ).join(' ');
    
    const splitServiceText = pdf.splitTextToSize(serviceDescription, pageWidth - 40);
    pdf.text(splitServiceText, 20, currentY);
    currentY += splitServiceText.length * 4 + 8;

    // Detalhes do evento em caixa amarela
    pdf.setFillColor(255, 255, 200);
    pdf.rect(15, currentY, pageWidth - 30, 25, 'F');
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(15, currentY, pageWidth - 30, 25);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('DETALHES DO EVENTO:', 20, currentY + 5);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Data do Evento: ${formData.event_date ? formatDateForPDF(formData.event_date) : 'A definir'}`, 20, currentY + 10);
    pdf.text(`Local do Evento: ${formData.event_location || 'A definir'}`, 20, currentY + 14);
    pdf.text(`Data Inicial de Montagem: ${formData.initial_setup_date || contractData.initialSetupDate ? formatDateForPDF(formData.initial_setup_date || contractData.initialSetupDate) : 'A combinar (mínimo 4 horas antes do evento)'}`, 20, currentY + 18);
    pdf.text(`Decorador Responsável: ${formData.decorator_name || 'A definir'}`, 20, currentY + 22);

    currentY += 35;

    // Nova página para cláusulas se necessário
    if (currentY > pageHeight - 80) {
      pdf.addPage();
      currentY = 20;
    }

    // === 3. CLÁUSULAS E CONDIÇÕES CONTRATUAIS ===
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('3. CLÁUSULAS E CONDIÇÕES CONTRATUAIS', pageWidth / 2, currentY + 5, { align: 'center' });

    currentY += 15;

    // Calcular valores financeiros para usar nas condições de pagamento
    const subtotalProducts = products.reduce((sum, p) => sum + p.total_price, 0);
    const discountAmount = subtotalProducts * (formData.discount_percentage / 100);
    const taxRate = formData.tax_percentage;
    const shouldShowTax = formData.tax_option === 'com_nota';
    const taxValue = shouldShowTax ? (subtotalProducts - discountAmount) * (taxRate / 100) : 0;
    const totalValue = subtotalProducts - discountAmount + formData.travel_expense + formData.accommodation_expense + taxValue;

    // Preparar condições de pagamento com valores por extenso
    const halfValue = totalValue / 2;
    const dayBeforeEvent = formData.event_date ? (() => {
      const date = new Date(formData.event_date + 'T00:00:00');
      date.setDate(date.getDate() - 1);
      return date.toLocaleDateString('pt-BR');
    })() : '';

    const defaultPaymentContent = `Valor Total do Contrato: ${formatCurrency(totalValue)} (${numberToWords(totalValue)})

Forma de Pagamento:
- Entrada (50%): ${formatCurrency(halfValue)} (${numberToWords(halfValue)}) - A ser pago na assinatura do contrato
- Restante (50%): ${formatCurrency(halfValue)} (${numberToWords(halfValue)}) - A ser pago até ${dayBeforeEvent || 'um dia antes do evento'}

Formas de pagamento aceitas: PIX, Transferência Bancária ou Dinheiro.`;
    
    // Usar texto editado pelo usuário se disponível, senão usar o gerado automaticamente
    let paymentContent = contractTerms.paymentTerms || defaultPaymentContent;
    
    // Adicionar dados bancários se disponíveis (sempre adicionar no final)
    if (bankAccountData.bankName || bankAccountData.pixKey) {
      paymentContent += '\n\nDADOS PARA PAGAMENTO:';
      if (bankAccountData.bankName) {
        paymentContent += `\nBanco: ${bankAccountData.bankName}`;
      }
      if (bankAccountData.accountHolder) {
        paymentContent += `\nTitular: ${bankAccountData.accountHolder}`;
      }
      if (bankAccountData.accountDocument) {
        paymentContent += `\nCPF/CNPJ: ${bankAccountData.accountDocument}`;
      }
      if (bankAccountData.accountAgency) {
        paymentContent += `\nAgência: ${bankAccountData.accountAgency}`;
      }
      if (bankAccountData.accountNumber) {
        paymentContent += `\nConta: ${bankAccountData.accountNumber}`;
      }
      if (bankAccountData.pixKey) {
        paymentContent += `\nChave PIX: ${bankAccountData.pixKey}`;
      }
    }

    // Cláusulas - usar texto editado pelo usuário se disponível
    const clauses = [
      {
        title: 'CLÁUSULA 1ª - CONDIÇÕES DE PAGAMENTO',
        content: paymentContent
      },
      {
        title: 'CLÁUSULA 2ª - CONDIÇÕES DE ENTREGA, MONTAGEM E DESMONTAGEM',
        content: contractTerms.deliveryTerms || `A montagem começará na data ${formData.initial_setup_date ? formatDateForPDF(formData.initial_setup_date) : '[DATA INICIAL DE MONTAGEM]'} no local ${formData.event_location || '[LOCAL DO EVENTO]'}. A entrega dos equipamentos montados terá o prazo de até 1 hora antes do evento. Cada item do orçamento tem um prazo de 5 horas de montagem após a forração entregar o espaço para montar. Desmontagem será realizada no dia seguinte ao evento. É necessário acesso livre ao local para montagem e desmontagem.`
      },
      {
        title: 'CLÁUSULA 3ª - POLÍTICA DE CANCELAMENTO E ALTERAÇÕES',
        content: contractTerms.cancellationPolicy || 'O cancelamento do evento por parte do CONTRATANTE deverá ser comunicado por escrito. Cancelamentos com até 30 dias de antecedência: retenção de 30% do valor total. Cancelamentos entre 15 a 29 dias: retenção de 50% do valor total. Cancelamentos com menos de 15 dias: retenção de 80% do valor total. Cancelamentos com menos de 48 horas: não haverá devolução.'
      },
      {
        title: 'CLÁUSULA 4ª - GARANTIA E RESPONSABILIDADES',
        content: contractTerms.warrantyTerms || 'A CONTRATADA garante a qualidade dos produtos pelo período do evento. Eventuais defeitos ou danos aos produtos durante o evento deverão ser comunicados imediatamente. A garantia não cobre danos causados pelo mau uso, caso fortuito ou força maior. A CONTRATADA não se responsabiliza por objetos danificados por terceiros será cobrada à parte.'
      }
    ];

    clauses.forEach(clause => {
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(clause.title, 20, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      currentY += 5;
      
      const splitContent = pdf.splitTextToSize(clause.content, pageWidth - 40);
      pdf.text(splitContent, 20, currentY);
      currentY += splitContent.length * 3 + 8;
    });

    // Disposições gerais
    if (contractTerms.additionalTerms) {
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('CLÁUSULA 5ª - DISPOSIÇÕES GERAIS', 20, currentY);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      currentY += 5;
      
      const splitAdditional = pdf.splitTextToSize(contractTerms.additionalTerms, pageWidth - 40);
      pdf.text(splitAdditional, 20, currentY);
      currentY += splitAdditional.length * 3 + 8;
    }

    // Nova página para produtos se necessário
    if (currentY > pageHeight - 100) {
      pdf.addPage();
      currentY = 20;
    }

    // === 4. ESPECIFICAÇÃO DETALHADA DOS PRODUTOS E SERVIÇOS ===
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('4. ESPECIFICAÇÃO DETALHADA DOS PRODUTOS E SERVIÇOS', pageWidth / 2, currentY + 5, { align: 'center' });

    currentY += 15;

    if (products.length > 0) {
      // Cabeçalho da tabela
      const tableHeaders = ['Imagem', 'Item', 'Descrição Detalhada', 'Qtd', 'Valor Unit.', 'Subtotal', 'Observações'];
      const colWidths = [20, 15, 50, 15, 25, 25, 30];
      let startX = 15;

      pdf.setFillColor(200, 200, 200);
      pdf.rect(startX, currentY, pageWidth - 30, 8, 'F');
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      
      tableHeaders.forEach((header, i) => {
        pdf.text(header, startX + 2, currentY + 5);
        startX += colWidths[i];
      });

      currentY += 10;

      // Produtos
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const rowHeight = 20;

        // Verificar se precisa de nova página
        if (currentY + rowHeight > pageHeight - 20) {
          pdf.addPage();
          currentY = 20;
        }

        // Fundo alternado
        if (i % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(15, currentY, pageWidth - 30, rowHeight, 'F');
        }

        // Bordas
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(15, currentY, pageWidth - 30, rowHeight);

        startX = 15;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);

        // Imagem do produto
        const productImageUrl = resolveContractProductImage(product);
        if (productImageUrl) {
          try {
            // Carregar e adicionar a imagem real do produto
            const imageResponse = await fetch(productImageUrl, { cache: 'no-store' });
            if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
            const imageBlob = await imageResponse.blob();
            const imageDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(imageBlob);
            });
            const imageFormat = imageDataUrl.startsWith('data:image/png')
              ? 'PNG'
              : imageDataUrl.startsWith('data:image/webp')
                ? 'WEBP'
                : 'JPEG';
            pdf.addImage(imageDataUrl, imageFormat, startX + 2, currentY + 2, 16, 16, undefined, 'FAST');
          } catch (error) {
            console.error("Erro ao carregar imagem do produto:", error);
            // Fallback para placeholder em caso de erro
            pdf.rect(startX + 2, currentY + 2, 16, 16);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(6);
            pdf.text('SEM', startX + 6, currentY + 9);
            pdf.text('IMG', startX + 6, currentY + 13);
          }
        } else {
          // Placeholder quando não há imagem
          pdf.rect(startX + 2, currentY + 2, 16, 16);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6);
          pdf.text('SEM', startX + 6, currentY + 9);
          pdf.text('IMG', startX + 6, currentY + 13);
        }
        startX += colWidths[0];

        // Item (número)
        pdf.text((i + 1).toString(), startX + 7, currentY + 11);
        startX += colWidths[1];

        // Nome e descrição
        pdf.setFont('helvetica', 'bold');
        pdf.text(product.name, startX + 2, currentY + 7);
        pdf.setFont('helvetica', 'normal');
        if (product.description) {
          const splitDesc = pdf.splitTextToSize(product.description, 45);
          pdf.text(splitDesc[0] || '', startX + 2, currentY + 11);
          if (splitDesc[1]) {
            pdf.text(splitDesc[1], startX + 2, currentY + 15);
          }
        }
        startX += colWidths[2];

        // Quantidade
        pdf.text(product.quantity.toString(), startX + 7, currentY + 11);
        startX += colWidths[3];

        // Valor unitário
        pdf.text(formatCurrency(product.unit_price), startX + 2, currentY + 11);
        startX += colWidths[4];

        // Subtotal
        pdf.text(formatCurrency(product.total_price), startX + 2, currentY + 11);
        startX += colWidths[5];

        // Observações
        pdf.text('Incluso montagem', startX + 2, currentY + 11);

        currentY += rowHeight;
      }
    }

    currentY += 10;

    // === 5. RESUMO FINANCEIRO ===
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('5. RESUMO FINANCEIRO', pageWidth / 2, currentY + 5, { align: 'center' });

    currentY += 15;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text('Subtotal dos Produtos e Serviços', 20, currentY);
    pdf.text(formatCurrency(subtotalProducts), pageWidth - 20, currentY, { align: 'right' });

    currentY += 8;

    // Mostrar desconto se houver
    if (formData.discount_percentage > 0) {
      pdf.setTextColor(220, 53, 69); // Vermelho para desconto
      pdf.text(`Desconto (${formData.discount_percentage}%)`, 20, currentY);
      pdf.text(`- ${formatCurrency(discountAmount)}`, pageWidth - 20, currentY, { align: 'right' });
      pdf.setTextColor(0, 0, 0); // Voltar ao preto
      currentY += 8;
    }

    // Mostrar despesa de viagem se houver
    if (formData.travel_expense > 0) {
      pdf.text('Despesa de Viagem', 20, currentY);
      pdf.text(`+ ${formatCurrency(formData.travel_expense)}`, pageWidth - 20, currentY, { align: 'right' });
      currentY += 8;
    }

    // Mostrar hospedagem se houver
    if (formData.accommodation_expense > 0) {
      pdf.text('Hospedagem', 20, currentY);
      pdf.text(`+ ${formatCurrency(formData.accommodation_expense)}`, pageWidth - 20, currentY, { align: 'right' });
      currentY += 8;
    }

    pdf.setDrawColor(65, 105, 225);
    pdf.line(20, currentY, pageWidth - 20, currentY);
    currentY += 5;

    // Só mostrar imposto se tax_option for 'com_nota'
    if (shouldShowTax) {
      pdf.text(`Impostos e Taxas (${taxRate}%)`, 20, currentY);
      pdf.text(formatCurrency(taxValue), pageWidth - 20, currentY, { align: 'right' });
      currentY += 8;
    }
    
    // Linha separadora antes do total
    pdf.setDrawColor(65, 105, 225);
    pdf.setLineWidth(2);
    pdf.line(20, currentY, pageWidth - 20, currentY);
    currentY += 10;

    // Verificar se há espaço para o total
    if (currentY > pageHeight - 30) {
      pdf.addPage();
      currentY = 20;
    }

    // Total do Contrato
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('VALOR TOTAL DO CONTRATO:', 20, currentY);
    pdf.text(formatCurrency(totalValue), pageWidth - 20, currentY, { align: 'right' });

    currentY += 10;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    
    // Converter valor para extenso (simplificado)
    const formatValueInWords = (value: number): string => {
      // Função básica para converter números em palavras (pode ser expandida)
      const integerPart = Math.floor(value);
      const decimalPart = Math.round((value - integerPart) * 100);
      
      if (integerPart < 1000) {
        return `${integerPart} reais e ${decimalPart.toString().padStart(2, '0')} centavos`;
      } else if (integerPart < 1000000) {
        const thousands = Math.floor(integerPart / 1000);
        const remainder = integerPart % 1000;
        if (remainder === 0) {
          return `${thousands} mil reais e ${decimalPart.toString().padStart(2, '0')} centavos`;
        } else {
          return `${thousands} mil e ${remainder} reais e ${decimalPart.toString().padStart(2, '0')} centavos`;
        }
      }
      return `${formatCurrency(value)} por extenso`;
    };
    
    pdf.text(`* Valor total por extenso: ${formatValueInWords(totalValue)}`, pageWidth / 2, currentY, { align: 'center' });

    currentY += 20;

    // Observações importantes
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('Observações Importantes:', 20, currentY);
    currentY += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    const observations = [
      '• Este contrato foi gerado automaticamente com base no orçamento n° 002',
      '• Todas as especificações técnicas seguem os padrões da empresa LINE TAPE',
      '• Em caso de dúvidas, entrar em contato: (62) 98343-66154 ou linetapegyn@gmail.com',
      `• Data e hora de geração: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`
    ];

    observations.forEach(obs => {
      pdf.text(obs, 20, currentY);
      currentY += 4;
    });

    // Nova página para assinaturas se necessário
    if (currentY > pageHeight - 80) {
      pdf.addPage();
      currentY = 40;
    } else {
      currentY += 20;
    }

    // === ASSINATURA DAS PARTES ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('ASSINATURA DAS PARTES', pageWidth / 2, currentY, { align: 'center' });

    currentY += 20;

    // Assinatura da CONTRATADA (LINE TAPE) - com assinatura digital
    if (contractData.companySignature) {
      try {
        // Adicionar a assinatura digital
        const signatureFormat = contractData.companySignature.startsWith('data:image/png')
          ? 'PNG'
          : contractData.companySignature.startsWith('data:image/webp')
            ? 'WEBP'
            : 'JPEG';
        pdf.addImage(contractData.companySignature, signatureFormat, 30, currentY, 60, 20, undefined, 'FAST');
      } catch (error) {
        console.error('Erro ao adicionar assinatura digital:', error);
        // Fallback para linha em caso de erro
        pdf.line(30, currentY + 20, 90, currentY + 20);
      }
    } else {
      // Linha para assinatura se não houver assinatura digital
      pdf.line(30, currentY + 20, 90, currentY + 20);
    }
    
    // Linha para assinatura do cliente
    pdf.line(110, currentY + 20, 170, currentY + 20);
    
    currentY += 25;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text('LINE TAPE', 60, currentY, { align: 'center' });
    pdf.text(`${formData.client_name}`, 140, currentY, { align: 'center' });
    
    currentY += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('CONTRATADA', 60, currentY, { align: 'center' });
    pdf.text('CONTRATANTE', 140, currentY, { align: 'center' });

    currentY += 10;
    pdf.text('Nome: Everton de paula da silva', 30, currentY);
    pdf.text('CPF/CNPJ: _____________', 110, currentY);
    
    currentY += 5;
    pdf.text('CPF: 351.010.728-74', 30, currentY);
    pdf.text('Data: ___/___/______', 110, currentY);
    
    currentY += 5;
    // Usar a data de geração do contrato na parte da empresa
    const contractGenerationDate = new Date().toLocaleDateString('pt-BR');
    pdf.text(`Data: ${contractGenerationDate}`, 30, currentY);

    currentY += 20;

    // Rodapé
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7);
    pdf.text('Contrato de Prestação de Serviços gerado pelo sistema LINE TAPE', pageWidth / 2, currentY, { align: 'center' });
    pdf.text('Documento válido e vinculativo legal conforme Código Civil Brasileiro', pageWidth / 2, currentY + 3, { align: 'center' });

    // Logo central como marca d'água em todas as páginas
    if (contractLogoDataUrl) {
      const currentPage = pdf.getCurrentPageInfo().pageNumber;
      for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.saveGraphicsState();
        pdf.setGState(pdf.GState({ opacity: 0.08 }));
        pdf.addImage(
          contractLogoDataUrl,
          contractLogoFormat,
          pageWidth / 2 - 45,
          pageHeight / 2 - 35,
          90,
          70,
          undefined,
          'MEDIUM',
        );
        pdf.restoreGraphicsState();
      }
      pdf.setPage(currentPage);
    }

    // Salvar PDF
    const fileName = `contrato-${contractData.contractNumber || '001'}-${formData.client_name.replace(/\s+/g, '-')}.pdf`;
    pdf.save(fileName);
    toast.success('PDF do contrato gerado com sucesso!');
  };


  // Gerar PDF do orçamento - versão limpa e organizada
  const generatePDF = async (quote: LineTapeQuote) => {
    const pdf = new jsPDF({
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 20;
    let pageNumber = 1;
    let logoDataUrl: string | null = null;
    let logoFormat: 'PNG' | 'JPEG' = 'PNG';

    for (const candidate of [...new Set([logoUrl, COMPANY_DATA.logo_url].filter(Boolean))] as string[]) {
      try {
        const logoResponse = await fetch(candidate, { cache: 'no-store' });
        if (!logoResponse.ok) continue;
        const logoBlob = await logoResponse.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(logoBlob);
        });
        logoFormat = logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        break;
      } catch (error) {
        console.error('Erro ao carregar candidato de logo do orçamento:', error);
      }
    }

    // Função para adicionar nova página
    const addNewPage = () => {
      pdf.addPage();
      pageNumber++;
      currentY = 20;
      
      // Adicionar número da página
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Página ${pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
      
      currentY = 30;
    };

    // Função para verificar se precisa de nova página
    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - 30) {
        addNewPage();
        return true;
      }
      return false;
    };

    // === CABEÇALHO ===
    // Logo (se disponível)
    if (logoDataUrl) {
      pdf.addImage(logoDataUrl, logoFormat, 15, 15, 30, 24, undefined, 'MEDIUM');
    }
    
    // Informações da empresa - lado esquerdo
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12); // Diminuído de 14 para 12
    pdf.setTextColor(30, 64, 175); // azul escuro
    pdf.text('LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA', logoDataUrl ? 55 : 20, 22);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100); // cinza
    pdf.text(COMPANY_DATA.address, logoDataUrl ? 55 : 20, 29);
    pdf.text(`Tel: ${COMPANY_DATA.phone}`, logoDataUrl ? 55 : 20, 34);
    pdf.text(`Email: ${COMPANY_DATA.email}`, logoDataUrl ? 55 : 20, 39);

    // Caixa do orçamento (lado direito) - alinhado com o nome da empresa
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 64, 175); // azul escuro
    pdf.text('ORÇAMENTO', pageWidth - 40, 22); // Mesmo Y do nome da empresa
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(40, 40, 40);
    pdf.text(`Nº: ${quote.quote_number}`, pageWidth - 40, 28);
    pdf.text(`Data: ${formatDateForPDF(quote.quote_date)}`, pageWidth - 40, 33);
    pdf.text(`Válido: 5 dias`, pageWidth - 40, 38);

    currentY = 55;

    // === DADOS DO CLIENTE ===
    // Build client info lines dynamically
    const clientLines: { left: string; right?: string }[] = [];
    clientLines.push({
      left: `Cliente: ${quote.client_name}`,
      right: quote.client_email ? `Email: ${quote.client_email}` : undefined
    });
    if (quote.client_phone || quote.client_document) {
      clientLines.push({
        left: quote.client_phone ? `Telefone: ${quote.client_phone}` : '',
        right: quote.client_document ? `CPF/CNPJ: ${quote.client_document}` : undefined
      });
    }
    if (quote.client_address) {
      clientLines.push({ left: `Endereço: ${quote.client_address}` });
    }
    clientLines.push({
      left: `Data do Evento: ${formatDateForPDF(quote.event_date)}`,
      right: quote.event_location ? `Local: ${quote.event_location}` : undefined
    });
    if (quote.decorator_name || quote.technical_responsible) {
      clientLines.push({
        left: quote.decorator_name ? `Decoradora: ${quote.decorator_name}` : '',
        right: quote.technical_responsible ? `Resp. Técnico: ${quote.technical_responsible}` : undefined
      });
    }

    const clientBoxHeight = 10 + (clientLines.length * 5);
    pdf.setFillColor(220, 220, 220);
    pdf.rect(15, currentY, pageWidth - 30, clientBoxHeight, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(30, 64, 175);
    pdf.text('DADOS DO CLIENTE', 20, currentY + 7);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(40, 40, 40);
    
    let lineY = currentY + 14;
    for (const line of clientLines) {
      if (line.left) {
        pdf.text(line.left, 20, lineY);
      }
      if (line.right) {
        pdf.text(line.right, pageWidth / 2, lineY);
      }
      lineY += 5;
    }

    currentY += clientBoxHeight + 5;

    // === PRODUTOS ===
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 64, 175); // azul escuro
    pdf.text('PRODUTOS E SERVIÇOS', 20, currentY);
    currentY += 8;

    if (quote.products.length > 0) {
      // Verificar se há espaço para o cabeçalho da tabela
      checkPageBreak(50);
      
      // Preparar dados da tabela com layout customizado
      const tableData: any[][] = [];
      
      // Carregar imagens dos produtos
      const productImagesPromises = quote.products.map(async (product) => {
        if (product.image_url) {
          try {
            const response = await fetch(product.image_url);
            const blob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Erro ao carregar imagem:', error);
            return null;
          }
        }
        return null;
      });

      const productImages = await Promise.all(productImagesPromises);
      
      for (let i = 0; i < quote.products.length; i++) {
        const product = quote.products[i];
        const imageData = productImages[i];
        
        tableData.push([
          {
            image: imageData,
            name: product.name,
            description: product.description || ''
          },
          product.quantity.toString(),
          `R$ ${product.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${product.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);
      }

      // Tabela com layout customizado e quebras de página
      autoTable(pdf, {
        startY: currentY,
        head: [['Produto', 'Qtd', 'Valor Unit.', 'Subtotal']],
        body: tableData.map(row => [
          '', // Primeira coluna será desenhada manualmente
          row[1], // Quantidade
          row[2], // Valor unitário
          row[3]  // Subtotal
        ]),
        styles: {
          fontSize: 9,
          cellPadding: 1.5,
          textColor: [40, 40, 40],
        },
        didParseCell: (data) => {
          // Calcular altura necessária para a primeira coluna baseado na descrição
          if (data.column.index === 0 && data.cell.section === 'body') {
            if (!tableData || !tableData[data.row.index] || !tableData[data.row.index][0]) {
              return;
            }
            
            const productData = tableData[data.row.index][0];
            if (productData && productData.description) {
              // Calcular quantas linhas a descrição vai ocupar
              const tempLines = pdf.splitTextToSize(productData.description, 65);
              const lineHeight = 3.5;
              const descriptionHeight = tempLines.length * lineHeight;
              // Altura total: nome (4) + espaço (4) + descrição + padding
              const totalHeight = Math.max(25, descriptionHeight + 12);
              data.row.height = Math.max(data.row.height || 0, totalHeight);
            }
          }
        },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        columnStyles: {
          0: { cellWidth: 90 }, // Coluna produto mais larga
          1: { cellWidth: 25, halign: 'center' }, // Quantidade
          2: { cellWidth: 30, halign: 'right' }, // Valor unitário
          3: { cellWidth: 35, halign: 'right' }, // Subtotal
        },
        showHead: 'everyPage',
        didDrawPage: (data) => {
          // Adicionar número da página em cada página
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.setTextColor(100, 100, 100);
          pdf.text(`Página ${pdf.getCurrentPageInfo().pageNumber}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
        },
        didDrawCell: (data) => {
          // Desenhar conteúdo customizado na primeira coluna
          if (data.column.index === 0 && data.cell.section === 'body') {
            // Verificar se os dados existem antes de acessar
            if (!tableData || !tableData[data.row.index] || !tableData[data.row.index][0]) {
              return;
            }
            
            const rowData = tableData[data.row.index];
            const productData = rowData[0];
            
            let textStartX = data.cell.x + 3;
            const textStartY = data.cell.y + 6;
            
            // Desenhar imagem se existir (mais compacta)
            if (productData && productData.image) {
              try {
                pdf.addImage(
                  productData.image,
                  'JPEG',
                  data.cell.x + 2,
                  data.cell.y + 2,
                  18, // largura da imagem reduzida
                  18,  // altura da imagem reduzida
                  undefined,
                  'FAST'
                );
                textStartX = data.cell.x + 23; // Posição do texto após a imagem
              } catch (error) {
                console.error('Erro ao adicionar imagem ao PDF:', error);
              }
            }
            
            // Desenhar nome do produto (mais compacto)
            if (productData && productData.name) {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(12);
              const splitName = pdf.splitTextToSize(productData.name, 65);
              pdf.text(splitName[0] || '', textStartX, textStartY);
            }
            
            // Desenhar descrição completa
            if (productData && productData.description) {
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(9);
              const splitDesc = pdf.splitTextToSize(productData.description, 65);
              
              // Renderizar todas as linhas da descrição
              const lineHeight = 3.5;
              splitDesc.forEach((line: string, index: number) => {
                pdf.text(line, textStartX, textStartY + 4 + (index * lineHeight));
              });
            }
          }
        },
        margin: { left: 15, right: 15 }
      });

      currentY = (pdf as any).lastAutoTable.finalY + 15;
    }

    // Verificar se há espaço para o resumo financeiro
    checkPageBreak(80);

    // === RESUMO FINANCEIRO ===
    const summaryX = pageWidth - 80;
    const summaryWidth = 65;
    
    // Apenas a borda, sem fundo
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(summaryX, currentY, summaryWidth, 50);

    let summaryY = currentY + 10;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(40, 40, 40); // texto escuro

    // Subtotal
    pdf.text('Subtotal:', summaryX + 5, summaryY);
    pdf.text(`R$ ${quote.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
             summaryX + summaryWidth - 5, summaryY, { align: 'right' });
    summaryY += 6;

    // Desconto
    if (quote.discount_amount > 0) {
      pdf.setTextColor(220, 53, 69); // vermelho
      pdf.text(`Desconto (${quote.discount_percentage}%):`, summaryX + 5, summaryY);
      pdf.text(`-R$ ${quote.discount_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
               summaryX + summaryWidth - 5, summaryY, { align: 'right' });
      pdf.setTextColor(40, 40, 40);
      summaryY += 6;
    }

    // Despesas extras
    if (quote.travel_expense > 0) {
      pdf.setTextColor(255, 102, 0); // laranja
      pdf.text('Viagem:', summaryX + 5, summaryY);
      pdf.text(`+R$ ${quote.travel_expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
               summaryX + summaryWidth - 5, summaryY, { align: 'right' });
      pdf.setTextColor(40, 40, 40);
      summaryY += 6;
    }

    if (quote.accommodation_expense > 0) {
      pdf.setTextColor(255, 102, 0); // laranja
      pdf.text('Hospedagem:', summaryX + 5, summaryY);
      pdf.text(`+R$ ${quote.accommodation_expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
               summaryX + summaryWidth - 5, summaryY, { align: 'right' });
      pdf.setTextColor(40, 40, 40);
      summaryY += 6;
    }

    // Valor do imposto (porcentagem da nota) - logo abaixo da hospedagem
    if (quote.tax_option === 'com_nota') {
      const { tax_amount: taxAmount, tax_percentage: taxPercentage } = resolveStoredQuoteTax(quote);
      
      pdf.setTextColor(139, 69, 19); // marrom
      pdf.text(`Impostos (${taxPercentage.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%):`, summaryX + 5, summaryY);
      pdf.text(`+R$ ${taxAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
               summaryX + summaryWidth - 5, summaryY, { align: 'right' });
      pdf.setTextColor(40, 40, 40);
      summaryY += 6;
    }

    // Linha divisória
    pdf.setDrawColor(30, 64, 175);
    pdf.line(summaryX + 5, summaryY + 2, summaryX + summaryWidth - 5, summaryY + 2);
    summaryY += 8;

    // Total
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 64, 175); // azul escuro
    pdf.text('TOTAL:', summaryX + 5, summaryY);
    pdf.text(`R$ ${quote.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 
             summaryX + summaryWidth - 5, summaryY, { align: 'right' });

    // Status fiscal e valor da nota
    summaryY += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    
    if (quote.tax_option === 'com_nota') {
      pdf.setTextColor(30, 64, 175);
      pdf.text('Com Nota Fiscal', summaryX + 5, summaryY);
    } else {
      const taxLabel = quote.tax_option === 'sem_nota' ? 'Sem impostos' : 'Isento';
      pdf.text(taxLabel, summaryX + 5, summaryY);
    }

    // === DADOS PARA PAGAMENTO (se ativado) ===
    if (includePaymentDataInQuote && (bankAccountData.bankName || bankAccountData.pixKey)) {
      currentY = Math.max(currentY, summaryY + 20);
      
      // Verificar se há espaço para a seção de pagamento
      checkPageBreak(60);
      
      pdf.setFillColor(240, 249, 255); // azul bem claro
      pdf.rect(15, currentY, pageWidth - 30, 55, 'F');
      pdf.setDrawColor(30, 64, 175);
      pdf.rect(15, currentY, pageWidth - 30, 55);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(30, 64, 175);
      pdf.text('DADOS PARA PAGAMENTO', 20, currentY + 8);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(40, 40, 40);
      
      let paymentY = currentY + 16;
      const leftCol = 20;
      const rightCol = pageWidth / 2 + 10;
      
      if (bankAccountData.bankName) {
        pdf.text(`Banco: ${bankAccountData.bankName}`, leftCol, paymentY);
      }
      if (bankAccountData.accountHolder) {
        pdf.text(`Titular: ${bankAccountData.accountHolder}`, rightCol, paymentY);
      }
      paymentY += 7;
      
      if (bankAccountData.accountAgency) {
        pdf.text(`Agência: ${bankAccountData.accountAgency}`, leftCol, paymentY);
      }
      if (bankAccountData.accountNumber) {
        pdf.text(`Conta: ${bankAccountData.accountNumber}`, rightCol, paymentY);
      }
      paymentY += 7;
      
      if (bankAccountData.accountDocument) {
        pdf.text(`CPF/CNPJ: ${bankAccountData.accountDocument}`, leftCol, paymentY);
      }
      paymentY += 7;
      
      if (bankAccountData.pixKey) {
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 64, 175);
        pdf.text(`Chave PIX: ${bankAccountData.pixKey}`, leftCol, paymentY);
      }
      
      currentY += 60;
    }

    // === RODAPÉ ===
    // Verificar se há espaço para o rodapé ou se precisa de nova página
    if (currentY > pageHeight - 60) {
      addNewPage();
    }
    
    const footerY = pdf.internal.pageSize.getHeight() - 25;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100); // cinza
    pdf.text('Orçamento válido por 5 dias. Para dúvidas, entre em contato pelos dados acima.', 
             20, footerY);
    
    // Marca d'água central em todas as páginas
    if (logoDataUrl) {
      const currentPage = pdf.getCurrentPageInfo().pageNumber;
      for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
        pdf.setPage(page);
        pdf.saveGraphicsState();
        pdf.setGState(pdf.GState({ opacity: 0.08 }));
        pdf.addImage(logoDataUrl, logoFormat, pageWidth / 2 - 45, pageHeight / 2 - 35, 90, 70, undefined, 'MEDIUM');
        pdf.restoreGraphicsState();
      }
      pdf.setPage(currentPage);
    }

    // Adicionar numeração na primeira página também
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Página 1 de ${pdf.getNumberOfPages()}`, pageWidth - 20, pageHeight - 10, { align: 'right' });

    // Salvar PDF
    pdf.save(`orcamento-${quote.quote_number}-${quote.client_name.replace(/\s+/g, '-')}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  // Preencher contrato com dados do orçamento
  const fillContractFromQuote = () => {
    if (!formData.client_name || products.length === 0) {
      toast.error('Preencha os dados do cliente e adicione produtos antes de gerar o contrato');
      return;
    }

    const serviceDescription = products.map(p => 
      `${p.name} (${p.quantity}x) - ${p.description || 'Sem descrição'}`
    ).join('; ');

    // Atualizar dados do contrato com informações do orçamento
    setContractData(prev => ({
      ...prev,
      budgetNumber: formData.quote_number || generateQuoteNumber(),
      clientDocument: formData.client_document,
      clientAddress: formData.client_address,
      clientPhone: formData.client_phone,
      technicalResponsible: formData.technical_responsible,
      serviceDescription: serviceDescription,
      initialSetupDate: formData.initial_setup_date || (formData.event_date ? 
        new Date(new Date(formData.event_date).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] : ''),
    }));

    // Preservar termos já editados e definir padrões para os não editados
    setContractTerms(prev => ({
      // Preservar paymentTerms se já foi editado
      paymentTerms: prev.paymentTerms || '',
      
      deliveryTerms: prev.deliveryTerms || `A montagem começará na data ${formData.initial_setup_date ? formatDateForPDF(formData.initial_setup_date) : '[DATA INICIAL DE MONTAGEM]'} no local ${formData.event_location || '[LOCAL DO EVENTO]'}. A entrega dos equipamentos montados terá o prazo de até 1 hora antes do evento. Cada item do orçamento tem um prazo de 5 horas de montagem após a forração entregar o espaço para montar. Desmontagem será realizada no dia seguinte ao evento. É necessário acesso livre ao local para montagem e desmontagem.`,
      
      cancellationPolicy: prev.cancellationPolicy || `Política de cancelamento: até 30 dias antes do evento, reembolso de 70% do valor pago; até 15 dias, reembolso de 40%; até 7 dias, reembolso de 20%; menos de 7 dias, não há reembolso. Equipamentos já entregues ou montados não são reembolsáveis.`,
      
      warrantyTerms: prev.warrantyTerms || `Garantimos o funcionamento de todos os equipamentos durante o evento. Técnico de plantão disponível durante o evento. Equipamentos possuem seguro contra danos. A empresa não se responsabiliza por falta de energia elétrica no local, condições climáticas adversas ou impedimentos de terceiros.`,
      
      additionalTerms: prev.additionalTerms || `Alterações técnicas dependem de viabilidade e podem gerar custos adicionais. Equipamentos sujeitos à disponibilidade no estoque. Foro da comarca de Goiânia/GO para resolução de conflitos. Em caso de força maior, as partes poderão renegociar os termos. ${formData.decorator_name ? `Decoradora responsável: ${formData.decorator_name}.` : ''}`
    }));

    // Mudar para a aba do contrato
    setActiveTab("contract");
    toast.success('Dados do orçamento transferidos para o contrato!');
  };

  const resetForm = () => {
    setFormData({
      quote_number: '',
      client_name: '',
      client_email: '',
      client_phone: '',
      client_document: '',
      client_address: '',
      event_date: '',
      event_location: '',
      event_name: '',
      decorator_name: '',
      initial_setup_date: '',
      technical_responsible: '',
      discount_percentage: 0,
      travel_expense: 0,
      accommodation_expense: 0,
      tax_option: 'sem_nota',
      tax_percentage: 15,
    });
    setContractData({
      contractNumber: '',
      budgetNumber: '',
      companyName: 'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA',
      companyAddress: 'RUA LUIZ HONORIO QD-36 LT-08 CIDADE JARDIM GOIANIA GOIAS',
      companyPhone: '(62) 98343-6154',
      companyEmail: 'linetapegyn@gmail.com',
      companyDocument: '',
      clientDocument: '',
      clientAddress: '',
      clientPhone: '',
      initialSetupDate: '',
      technicalResponsible: '',
      serviceDescription: '',
      companySignature: '',
      clientSignature: '',
    });
    setContractTerms({
      paymentTerms: '',
      deliveryTerms: '',
      cancellationPolicy: '',
      warrantyTerms: '',
      additionalTerms: ''
    });
    setProducts([]);
    setEditingQuote(null);
    setClientSearch('');
    setCurrentStep(1);
    setMaxReachedStep(1);
    setStepErrors([]);
    setActiveTab('quote');
    clearDraft();
  };


  // Upload de imagem para produto
  const uploadProductImage = async (file: File) => {
    try {
      setUploading(true);

      const validation = validateProductImageUpload(file);
      if (!validation.ok) {
        toast.error(validation.error ?? 'Arquivo inválido');
        return null;
      }

      const fileExt = fileExtension(file.name);
      const fileName = `product-${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { contentType: file.type });
        
      if (uploadError) {
        throw uploadError;
      }
      
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);
        
      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem');
      return;
    }
    
    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    
    const imageUrl = await uploadProductImage(file);
    if (imageUrl) {
      setCurrentProduct({ ...currentProduct, image_url: imageUrl });
      toast.success('Imagem carregada com sucesso!');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'sent': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'sent': return 'Enviado';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      default: return status;
    }
  };

  // Função para exportar orçamento completo como JSON (orçamento + contrato)
  const exportCompleteJSON = () => {
    const totals = calculateTotals();
    
    const exportData = {
      orcamento: {
        formData: {
          quote_number: formData.quote_number || generateQuoteNumber(),
          client_name: formData.client_name,
          client_email: formData.client_email,
          client_phone: formData.client_phone,
          client_document: formData.client_document,
          client_address: formData.client_address,
          event_date: formData.event_date,
          event_location: formData.event_location,
          event_name: formData.event_name,
          decorator_name: formData.decorator_name,
          initial_setup_date: formData.initial_setup_date,
          technical_responsible: formData.technical_responsible,
          discount_percentage: formData.discount_percentage,
          travel_expense: formData.travel_expense,
          accommodation_expense: formData.accommodation_expense,
          tax_option: formData.tax_option,
        },
        products: products,
        totals: {
          subtotal: totals.subtotal,
          discount_amount: totals.discount_amount,
          total_amount: totals.total_amount,
        }
      },
      contrato: {
        contractData: contractData,
        contractTerms: contractTerms,
        companyData: COMPANY_DATA,
        calculatedTotals: {
          subtotalProducts: products.reduce((sum, p) => sum + p.total_price, 0),
          taxRate: 15,
          taxValue: products.reduce((sum, p) => sum + p.total_price, 0) * 0.15,
          totalValue: products.reduce((sum, p) => sum + p.total_price, 0) * 1.15
        }
      },
      metadata: {
        exportDate: new Date().toISOString(),
        version: '2.0',
        type: 'complete_quote_contract',
        description: 'Exportação completa do orçamento e contrato LINE TAPE'
      }
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `orcamento-completo-${formData.quote_number || generateQuoteNumber()}-${formData.client_name?.replace(/\s+/g, '-') || 'cliente'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Orçamento e contrato exportados como JSON!');
  };

  // Função para exportar orçamento como JSON
  const exportToJSON = (quote: LineTapeQuote) => {
    const exportData = {
      formData: {
        quote_number: quote.quote_number,
        client_name: quote.client_name,
        client_email: quote.client_email,
        client_phone: quote.client_phone,
        client_document: quote.client_document,
        client_address: quote.client_address,
        event_date: quote.event_date,
        event_location: quote.event_location,
        event_name: quote.event_name,
        decorator_name: quote.decorator_name,
        initial_setup_date: quote.initial_setup_date,
        technical_responsible: quote.technical_responsible,
        discount_percentage: quote.discount_percentage,
        travel_expense: quote.travel_expense,
        accommodation_expense: quote.accommodation_expense,
        tax_option: quote.tax_option,
      },
      products: quote.products,
      totals: {
        subtotal: quote.subtotal,
        discount_amount: quote.discount_amount,
        total_amount: quote.total_amount,
      },
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0'
      }
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `orcamento-${quote.quote_number}-${quote.client_name.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Orçamento exportado como JSON!');
  };

  // Função para importar orçamento JSON
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        console.log('JSON importado:', jsonData);
        
        // Detectar se é formato completo (com orcamento/contrato) ou simples
        const isCompleteFormat = jsonData.orcamento && jsonData.metadata?.type === 'complete_quote_contract';
        const formDataSource = isCompleteFormat ? jsonData.orcamento?.formData : jsonData.formData;
        const productsSource = isCompleteFormat ? jsonData.orcamento?.products : jsonData.products;
        const contractSource = isCompleteFormat ? jsonData.contrato : null;
        
        console.log('Formato detectado:', isCompleteFormat ? 'completo' : 'simples');
        console.log('FormData source:', formDataSource);
        console.log('Products source:', productsSource);
        
        // Popular dados do formulário
        if (formDataSource) {
          setFormData(prev => ({
            ...prev,
            quote_number: formDataSource.quote_number || prev.quote_number,
            client_name: formDataSource.client_name || prev.client_name,
            client_email: formDataSource.client_email || prev.client_email,
            client_phone: formDataSource.client_phone || prev.client_phone,
            client_document: formDataSource.client_document || prev.client_document,
            client_address: formDataSource.client_address || prev.client_address,
            event_date: formDataSource.event_date || prev.event_date,
            event_location: formDataSource.event_location || prev.event_location,
            event_name: formDataSource.event_name || prev.event_name,
            decorator_name: formDataSource.decorator_name || prev.decorator_name,
            initial_setup_date: formDataSource.initial_setup_date || prev.initial_setup_date,
            technical_responsible: formDataSource.technical_responsible || prev.technical_responsible,
            discount_percentage: formDataSource.discount_percentage ?? prev.discount_percentage,
            travel_expense: formDataSource.travel_expense ?? prev.travel_expense,
            accommodation_expense: formDataSource.accommodation_expense ?? prev.accommodation_expense,
            tax_option: formDataSource.tax_option || prev.tax_option,
          }));
        }
        
        // Popular dados do contrato se disponível
        if (contractSource?.contractData) {
          setContractData(prev => ({
            ...prev,
            ...contractSource.contractData,
          }));
        }
        
        if (contractSource?.contractTerms) {
          setContractTerms(prev => ({
            ...prev,
            ...contractSource.contractTerms,
          }));
        }
        
        // Popular produtos
        if (productsSource && Array.isArray(productsSource)) {
          setProducts(productsSource.map((product: any) => ({
            id: crypto.randomUUID(),
            name: product.name || '',
            description: product.description || '',
            quantity: Number(product.quantity) || 1,
            unit_price: Number(product.unit_price) || 0,
            total_price: Number(product.total_price) || (Number(product.quantity) || 1) * (Number(product.unit_price) || 0),
            category: product.category || '',
            image_url: product.image_url || null
          })));
          console.log('Produtos importados:', productsSource.length);
        }
        
        toast.success(`Orçamento importado com sucesso! ${productsSource?.length || 0} produtos carregados.`);
        setIsDialogOpen(true); // Abrir dialog para visualizar/editar
      } catch (error) {
        console.error('Erro ao importar JSON:', error);
        toast.error('Erro ao processar arquivo JSON. Verifique se o formato está correto.');
      }
    };
    
    reader.readAsText(file);
    // Limpar o input para permitir reimportar o mesmo arquivo
    event.target.value = '';
  };

  const totals = calculateTotals();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageActions>
            {canManage && (
              <div className="flex gap-2">
                {/* Input file hidden para importar JSON */}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                  id="import-json-input"
                />
                
                {/* Botão para importar orçamento JSON */}
                <Button 
                  onClick={() => document.getElementById('import-json-input')?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Abrir JSON
                </Button>
                
                {/* Botão para criar novo orçamento */}
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Orçamento
                </Button>
              </div>
            )}
      </PageActions>

      {/* Lista de orçamentos */}
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Orçamentos</CardTitle>
          <QuotesToolbar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            month={monthFilter}
            onMonthChange={setMonthFilter}
            year={yearFilter}
            onYearChange={setYearFilter}
            sort={sortOption}
            onSortChange={setSortOption}
            years={availableYears}
          />
        </CardHeader>
        <CardContent>
          {loadingQuotes ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-44 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-12 w-12" aria-hidden="true" />
              <h3 className="mb-1 text-lg font-medium">Nenhum orçamento encontrado</h3>
              <p className="text-sm">Ajuste os filtros ou crie um novo orçamento.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredQuotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  canViewValues={canViewValues}
                  onView={() => setPreviewQuote(withResolvedImages(quote))}
                  onEdit={() => editQuote(quote)}
                  onPdf={() => generatePDF(quote)}
                  onDuplicate={() => duplicateQuote(quote)}
                  onWhatsApp={() => sendQuoteByWhatsApp(quote)}
                  onCreateEvent={() => createEventFromQuote(quote)}
                  onDelete={() => setQuoteToDelete(quote)}
                  onStatusChange={(_, status) => setStatusChangeRequest({ quote, status })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pré-visualização do orçamento */}
      <QuotePreviewDialog
        quote={previewQuote as any}
        open={Boolean(previewQuote)}
        onOpenChange={(open) => !open && setPreviewQuote(null)}
        canViewValues={canViewValues}
        onDownloadPdf={async () => {
          if (previewQuote) await generatePDF(previewQuote);
        }}
        company={COMPANY_DATA}
        logoUrl={logoUrl || COMPANY_DATA.logo_url}
      />

      {/* Confirmação de exclusão */}
      <AlertDialog open={Boolean(quoteToDelete)} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o orçamento {quoteToDelete?.quote_number}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (quoteToDelete) deleteQuote(quoteToDelete);
                setQuoteToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de mudança de status */}
      <AlertDialog
        open={Boolean(statusChangeRequest)}
        onOpenChange={(open) => !open && setStatusChangeRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar status</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar a alteração do orçamento {statusChangeRequest?.quote.quote_number} para{' '}
              {getQuoteStatusLabel(statusChangeRequest?.status)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusChangeRequest) {
                  changeQuoteStatus(statusChangeRequest.quote, statusChangeRequest.status);
                }
                setStatusChangeRequest(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Dialog para novo orçamento */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuote ? `Editando Orçamento ${editingQuote.quote_number}` : 'Sistema de Orçamentos LINE TAPE'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="quote">Orçamento</TabsTrigger>
                  <TabsTrigger value="contract" disabled={!documentsUnlocked}>
                    Contrato de Serviço
                  </TabsTrigger>
                  <TabsTrigger value="receipt" disabled={!documentsUnlocked}>
                    Recibo de Pagamento
                  </TabsTrigger>
                </TabsList>
                
                {/* Botão para preencher contrato com dados do orçamento */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillContractFromQuote}
                  className="whitespace-nowrap sm:ml-4"
                  disabled={!documentsUnlocked}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Preencher Contrato
                </Button>
              </div>

              {!documentsUnlocked && (
                <p className="mb-4 text-xs text-muted-foreground">
                  Informe o cliente e adicione ao menos um item para liberar o contrato e o recibo.
                </p>
              )}


              <TabsContent value="quote" className="space-y-6">
                <QuoteWizardProgress
                  currentStep={currentStep}
                  maxReachedStep={maxReachedStep}
                  onStepChange={setCurrentStep}
                />

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-6">
                    {currentStep === 1 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Cliente e Evento</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <ClientAutocomplete
                            value={clientSearch}
                            onSearchChange={setClientSearch}
                            onSelect={(client) => {
                              setFormData((prev) => ({
                                ...prev,
                                client_name: client.name || prev.client_name,
                                client_phone: client.phone ? formatPhone(client.phone) : prev.client_phone,
                                client_email: client.email || prev.client_email,
                                client_document: client.document ? formatDocument(client.document) : prev.client_document,
                                client_address: client.address || prev.client_address,
                              }));
                              setClientSearch(client.name || '');
                              toast.success('Dados do cliente preenchidos');
                            }}
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="client_name">Nome/Empresa *</Label>
                              <Input
                                id="client_name"
                                value={formData.client_name}
                                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                                placeholder="Nome do cliente ou empresa"
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="client_document">CPF/CNPJ</Label>
                              <Input
                                id="client_document"
                                value={formData.client_document}
                                onChange={(e) => setFormData({ ...formData, client_document: formatDocument(e.target.value) })}
                                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="client_email">E-mail</Label>
                              <Input
                                id="client_email"
                                type="email"
                                value={formData.client_email}
                                onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                                placeholder="email@cliente.com"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="client_phone">Telefone</Label>
                              <Input
                                id="client_phone"
                                value={formData.client_phone}
                                onChange={(e) => setFormData({ ...formData, client_phone: handlePhoneInput(e.target.value) })}
                                placeholder="(00) 00000-0000"
                              />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="client_address">Endereço Completo</Label>
                              <Input
                                id="client_address"
                                value={formData.client_address}
                                onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                                placeholder="Rua, nº, bairro, cidade - UF, CEP"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="event_name">Nome do Evento</Label>
                              <Input
                                id="event_name"
                                value={formData.event_name}
                                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                                placeholder="Ex: Casamento Maria & João"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="event_date">Data do Evento *</Label>
                              <Input
                                id="event_date"
                                type="date"
                                value={formData.event_date}
                                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="initial_setup_date">Data Inicial de Montagem</Label>
                              <Input
                                id="initial_setup_date"
                                type="date"
                                value={formData.initial_setup_date}
                                onChange={(e) => setFormData({ ...formData, initial_setup_date: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="event_location">Local do Evento</Label>
                              <Input
                                id="event_location"
                                value={formData.event_location}
                                onChange={(e) => setFormData({ ...formData, event_location: e.target.value })}
                                placeholder="Endereço do evento"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="decorator_name">Decoradora</Label>
                              <Input
                                id="decorator_name"
                                value={formData.decorator_name}
                                onChange={(e) => setFormData({ ...formData, decorator_name: e.target.value })}
                                placeholder="Nome da decoradora"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="technical_responsible">Responsável Técnico</Label>
                              <Input
                                id="technical_responsible"
                                value={formData.technical_responsible}
                                onChange={(e) => setFormData({ ...formData, technical_responsible: e.target.value })}
                                placeholder="Nome do responsável técnico"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {currentStep === 2 && (
                      <Card>
                        <CardHeader>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-lg">Equipamentos e Serviços</CardTitle>
                            <Dialog open={isProductDialogOpen} onOpenChange={(open) => {
                              setIsProductDialogOpen(open);
                              if (!open) {
                                setCurrentProduct({
                                  name: '',
                                  description: '',
                                  quantity: 1,
                                  unit_price: 0,
                                  category: '',
                                  image_url: '',
                                });
                                setEditingIndex(null);
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Plus className="h-4 w-4 mr-2" />
                                  Item com imagem
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>
                                    {editingIndex !== null ? 'Editar Item' : 'Adicionar Item com Imagem'}
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="product-name">Nome do Produto</Label>
                                    <Input
                                      id="product-name"
                                      value={currentProduct.name}
                                      onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                      placeholder="Ex: Refletor LED 100W"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="product-description">Descrição</Label>
                                    <Textarea
                                      id="product-description"
                                      value={currentProduct.description}
                                      onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                                      placeholder="Descrição do produto"
                                      rows={2}
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="product-quantity">Quantidade</Label>
                                      <Input
                                        id="product-quantity"
                                        type="number"
                                        value={currentProduct.quantity}
                                        onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: parseInt(e.target.value) || 1 })}
                                        min="1"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="product-price">Preço Unitário</Label>
                                      <CurrencyInput
                                        id="product-price"
                                        value={currentProduct.unit_price}
                                        onChange={(value) => setCurrentProduct({ ...currentProduct, unit_price: value })}
                                        placeholder="R$ 0,00"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor="product-image">Imagem do Produto</Label>
                                    <div className="flex items-center space-x-4">
                                      <Input
                                        id="product-image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                        className="flex-1"
                                      />
                                      {uploading && (
                                        <div className="text-sm text-muted-foreground">Carregando...</div>
                                      )}
                                    </div>
                                    {currentProduct.image_url && (
                                      <div className="mt-2">
                                        <img 
                                          src={currentProduct.image_url} 
                                          alt="Pré-visualização do produto"
                                          className="w-20 h-20 object-cover rounded border"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <Button onClick={addProductToQuote} className="w-full" disabled={uploading}>
                                    {editingIndex !== null ? (
                                      <>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Atualizar Item
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Adicionar Item
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <EquipmentPicker
                            items={products}
                            onChange={setProducts}
                            onEditItem={(_, index) => editProduct(index)}
                            canViewValues={canManage}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {currentStep === 3 && canManage && (
                      <>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Valores</CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="discount">Desconto (%)</Label>
                              <Input
                                id="discount"
                                type="number"
                                value={formData.discount_percentage}
                                onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                                min="0"
                                max="100"
                                step="0.1"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="travel_expense">Despesa de Viagem</Label>
                              <CurrencyInput
                                id="travel_expense"
                                value={formData.travel_expense}
                                onChange={(value) => setFormData({ ...formData, travel_expense: value })}
                                placeholder="R$ 0,00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="accommodation">Hospedagem</Label>
                              <CurrencyInput
                                id="accommodation"
                                value={formData.accommodation_expense}
                                onChange={(value) => setFormData({ ...formData, accommodation_expense: value })}
                                placeholder="R$ 0,00"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="tax_option">Opção Fiscal</Label>
                              <Select 
                                value={formData.tax_option} 
                                onValueChange={(value: any) => setFormData({ ...formData, tax_option: value })}
                              >
                                <SelectTrigger id="tax_option">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sem_nota">Sem Nota Fiscal</SelectItem>
                                  <SelectItem value="isento">Isento</SelectItem>
                                  <SelectItem value="com_nota">Com Nota Fiscal</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {formData.tax_option === 'com_nota' && (
                              <div className="space-y-2">
                                <Label htmlFor="tax_percentage">Porcentagem da Nota (%)</Label>
                                <Input
                                  id="tax_percentage"
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={formData.tax_percentage}
                                  onChange={(e) => setFormData({ ...formData, tax_percentage: parseFloat(e.target.value) || 0 })}
                                  placeholder="15"
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Seção de Dados de Pagamento no Orçamento */}
                        <Card>
                          <CardHeader>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <CardTitle className="flex flex-wrap items-center gap-2">
                                <Building className="w-5 h-5" />
                                Dados para Pagamento
                              </CardTitle>
                              <div className="flex flex-wrap items-center gap-2">
                                <Label htmlFor="include-payment-quote" className="text-sm text-muted-foreground">
                                  Incluir no PDF
                                </Label>
                                <Switch
                                  id="include-payment-quote"
                                  checked={includePaymentDataInQuote}
                                  onCheckedChange={setIncludePaymentDataInQuote}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
                              <div className="flex-1 space-y-2">
                                <Label htmlFor="saved-bank-account">Dados Bancários Salvos</Label>
                                <Select 
                                  value={selectedBankAccountId || 'manual'} 
                                  onValueChange={selectBankAccount}
                                >
                                  <SelectTrigger id="saved-bank-account">
                                    <SelectValue placeholder="Selecione ou preencha manualmente" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="manual">Preencher manualmente</SelectItem>
                                    {savedBankAccounts.map((account) => (
                                      <SelectItem key={account.id} value={account.id}>
                                        {account.name} {account.is_default && '(Padrão)'}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {selectedBankAccountId && selectedBankAccountId !== 'manual' && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="self-end"
                                  onClick={() => deleteBankAccount(selectedBankAccountId)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Excluir
                                </Button>
                              )}
                            </div>

                            <BankAccountData
                              data={bankAccountData}
                              onDataUpdate={(field, value) => {
                                setBankAccountData(prev => ({ ...prev, [field]: value }));
                                setSelectedBankAccountId('manual');
                              }}
                              savedBankAccounts={savedBankAccounts}
                              selectedBankAccountId={selectedBankAccountId}
                              onSelectBankAccount={setSelectedBankAccountId}
                            />

                            <div className="flex flex-col sm:flex-row gap-2 p-4 border border-dashed rounded-lg">
                              <div className="flex-1 space-y-2">
                                <Label htmlFor="save-bank-name">Salvar como novo</Label>
                                <Input
                                  id="save-bank-name"
                                  value={saveBankAccountName}
                                  onChange={(e) => setSaveBankAccountName(e.target.value)}
                                  placeholder="Nome para identificar (ex: Conta Empresa)"
                                />
                              </div>
                              <Button
                                variant="outline"
                                className="self-end"
                                onClick={saveBankAccount}
                                disabled={!saveBankAccountName.trim()}
                              >
                                <Save className="h-4 w-4 mr-1" />
                                Salvar Dados
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Revisão do orçamento</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <p><span className="text-muted-foreground">Número:</span> {formData.quote_number || 'a definir ao salvar'}</p>
                            <p><span className="text-muted-foreground">Cliente:</span> {formData.client_name || '-'}</p>
                            <p><span className="text-muted-foreground">Evento:</span> {formData.event_name || '-'} — {formatDateDisplay(formData.event_date) || 'sem data'}</p>
                            <p><span className="text-muted-foreground">Itens:</span> {products.length}</p>
                          </CardContent>
                        </Card>
                      </>
                    )}

                    {stepErrors.length > 0 && (
                      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                        <ul className="list-disc pl-5 text-sm text-destructive">
                          {stepErrors.map((error) => (
                            <li key={error}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goToPreviousStep}
                        disabled={currentStep === 1}
                      >
                        Voltar
                      </Button>
                      <Button type="button" onClick={goToNextStep} disabled={currentStep === 3}>
                        Avançar
                      </Button>
                    </div>
                  </div>

                  {canManage && (
                    <div className="hidden lg:block">
                      <QuoteTotalsPanel
                        className="sticky top-4"
                        totals={totals}
                        discountPercentage={formData.discount_percentage}
                        travelExpense={formData.travel_expense}
                        accommodationExpense={formData.accommodation_expense}
                        taxOption={formData.tax_option}
                        taxPercentage={formData.tax_percentage}
                        canViewValues={canViewValues}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>


              <TabsContent value="contract" className="space-y-4">
                <ContractHeader
                  contractNumber={contractData.contractNumber || generateQuoteNumber()}
                  budgetNumber={formData.quote_number || generateQuoteNumber()}
                  companyName={contractData.companyName}
                  companyAddress={contractData.companyAddress}
                  companyPhone={contractData.companyPhone}
                  companyEmail={contractData.companyEmail}
                  companyDocument={contractData.companyDocument}
                  clientName={formData.client_name}
                  clientEmail={formData.client_email}
                  clientDocument={contractData.clientDocument}
                  clientAddress={contractData.clientAddress}
                  clientPhone={contractData.clientPhone}
                  eventDate={formData.event_date}
                  eventLocation={formData.event_location}
                  initialSetupDate={contractData.initialSetupDate}
                  decorator={formData.decorator_name}
                  technicalResponsible={contractData.technicalResponsible}
                  serviceDescription={contractData.serviceDescription}
                  products={products.map((product, index) => ({
                    id: index.toString(),
                    name: product.name,
                    description: product.description,
                    quantity: product.quantity,
                    unitPrice: product.unit_price,
                    subtotal: product.total_price,
                    image: product.image_url,
                  }))}
                  onCompanyUpdate={(field, value) => {
                    setContractData(prev => ({ ...prev, [field]: value }));
                  }}
                  onClientUpdate={(field, value) => {
                    if (field === 'clientName') {
                      setFormData(prev => ({ ...prev, client_name: value }));
                    } else if (field === 'clientEmail') {
                      setFormData(prev => ({ ...prev, client_email: value }));
                    } else if (field === 'eventDate') {
                      setFormData(prev => ({ ...prev, event_date: value }));
                    } else if (field === 'eventLocation') {
                      setFormData(prev => ({ ...prev, event_location: value }));
                    } else if (field === 'decorator') {
                      setFormData(prev => ({ ...prev, decorator_name: value }));
                    } else {
                      setContractData(prev => ({ ...prev, [field]: value }));
                    }
                  }}
                />
                
                <ContractSignature
                  companySignature={contractData.companySignature}
                  onCompanySignatureChange={(signature) => {
                    setContractData(prev => ({ ...prev, companySignature: signature || '' }));
                  }}
                />

                <ContractSummary
                  products={products.map(p => ({
                    id: crypto.randomUUID(),
                    name: p.name,
                    description: p.description,
                    quantity: p.quantity,
                    unitPrice: p.unit_price,
                    subtotal: p.quantity * p.unit_price,
                    image: p.image_url
                  }))}
                  subtotal={calculateTotals().subtotal}
                  discount={calculateTotals().discount_amount}
                  discountRate={formData.discount_percentage}
                  withDiscount={formData.discount_percentage > 0}
                  tax={calculateTotals().tax_amount || 0}
                  total={calculateTotals().total_amount}
                  taxRate={formData.tax_percentage}
                  withTax={formData.tax_option === 'com_nota'}
                />

                <ContractTerms
                  terms={contractTerms}
                  onTermsUpdate={(field, value) => {
                    setContractTerms(prev => ({ ...prev, [field]: value }));
                  }}
                  totalValue={calculateTotals().total_amount}
                  eventDate={formData.event_date}
                  initialSetupDate={formData.initial_setup_date}
                  eventLocation={formData.event_location}
                />

                <BankAccountData
                  data={bankAccountData}
                  onDataUpdate={(field, value) => {
                    setBankAccountData(prev => ({ ...prev, [field]: value }));
                    setSelectedBankAccountId('manual');
                  }}
                  savedBankAccounts={savedBankAccounts}
                  selectedBankAccountId={selectedBankAccountId}
                  onSelectBankAccount={setSelectedBankAccountId}
                />

                {/* Botão para gerar PDF do contrato */}
                <div className="pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateContractPDF}
                    className="w-full"
                    disabled={!formData.client_name || products.length === 0}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar PDF do Contrato
                  </Button>
                </div>

              </TabsContent>

              <TabsContent value="receipt" className="space-y-6">
                <PaymentReceipt
                  quoteData={{
                    quote_number: formData.quote_number || generateQuoteNumber(),
                    client_name: formData.client_name,
                    client_document: formData.client_document,
                    client_address: formData.client_address,
                    client_email: formData.client_email,
                    client_phone: formData.client_phone,
                    total_amount: calculateTotals().total_amount,
                    quote_date: new Date().toISOString().split('T')[0],
                    service_description: products.map(p => `${p.name} (${p.quantity}x)`).join(', '),
                  }}
                  companyData={{
                    name: COMPANY_DATA.name,
                    address: COMPANY_DATA.address,
                    phone: COMPANY_DATA.phone,
                    email: COMPANY_DATA.email,
                  }}
                />
              </TabsContent>
            </Tabs>

            {/* Barra de resumo fixa no mobile */}
            {canManage && (
              <div className="sticky bottom-0 z-20 -mx-6 lg:hidden">
                <QuoteTotalsPanel
                  variant="bar"
                  totals={totals}
                  discountPercentage={formData.discount_percentage}
                  travelExpense={formData.travel_expense}
                  accommodationExpense={formData.accommodation_expense}
                  taxOption={formData.tax_option}
                  taxPercentage={formData.tax_percentage}
                  canViewValues={canViewValues}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-4">
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {draftStatus === 'saving' && 'Salvando rascunho...'}
                {draftStatus === 'saved' && 'Rascunho salvo localmente'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearDraft();
                  toast.success('Rascunho local descartado');
                }}
              >
                Descartar rascunho
              </Button>
              <div className="w-full" />
              <Button 
                type="button" 
                className="flex-1 min-w-[200px]"
                onClick={handleSubmitExternal}
                disabled={isSaving}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
              </Button>

              
              <Button
                type="button"
                variant="outline"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
                onClick={exportCompleteJSON}
                disabled={!formData.client_name || products.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
              {canManage && formData.client_name && formData.event_date && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 min-w-[200px] text-green-600 border-green-600 hover:bg-green-50"
                  onClick={async () => {
                    try {
                      // Validar dados básicos
                      if (!formData.client_name || !formData.event_date) {
                        toast.error('Nome do cliente e data do evento são obrigatórios');
                        return;
                      }

                      // Preparar dados do orçamento
                      const totals = calculateTotals();

                      const externalQuoteData = {
                        quote_number: formData.quote_number || generateQuoteNumber(),
                        client_name: formData.client_name,
                        client_email: formData.client_email,
                        client_phone: formData.client_phone,
                        client_document: formData.client_document,
                        client_address: formData.client_address,
                        event_date: formData.event_date,
                        event_location: formData.event_location,
                        event_name: formData.event_name,
                        decorator_name: formData.decorator_name,
                        initial_setup_date: formData.initial_setup_date,
                        technical_responsible: formData.technical_responsible,
                        products: products.map(p => ({
                          ...p,
                          id: crypto.randomUUID(),
                          total_price: p.quantity * p.unit_price,
                        })),
                        subtotal: totals.subtotal,
                        discount_percentage: formData.discount_percentage,
                        discount_amount: totals.discount_amount,
                        travel_expense: formData.travel_expense,
                        accommodation_expense: formData.accommodation_expense,
                        total_amount: totals.total_amount,
                        tax_option: formData.tax_option,
                        tax_percentage: formData.tax_percentage,
                        tax_amount: totals.tax_amount,
                        status: 'draft',
                        notes: `Orçamento LINE TAPE - Regime: ${formData.tax_option}`,
                      };

                      // Salvar orçamento primeiro
                      let savedQuote;
                      if (editingQuote) {
                        const { error } = await supabase
                          .from('external_quotes')
                          .update(externalQuoteData)
                          .eq('id', editingQuote.id);

                        if (error) {
                          throw new Error(`Erro ao atualizar orçamento: ${error.message}`);
                        }
                        savedQuote = { ...editingQuote, ...externalQuoteData };
                      } else {
                        const { data, error } = await supabase
                          .from('external_quotes')
                          .insert(externalQuoteData)
                          .select()
                          .single();

                        if (error) {
                          throw new Error(`Erro ao salvar orçamento: ${error.message}`);
                        }
                        savedQuote = data;
                      }

                      // Criar evento a partir do orçamento salvo
                      const tempQuote: LineTapeQuote = {
                        id: savedQuote.id,
                        quote_number: savedQuote.quote_number,
                        quote_date: new Date().toISOString().split('T')[0],
                        client_name: savedQuote.client_name,
                        client_email: savedQuote.client_email || '',
                        client_phone: savedQuote.client_phone || '',
                        client_document: savedQuote.client_document || '',
                        client_address: savedQuote.client_address || '',
                        event_date: savedQuote.event_date,
                        event_location: savedQuote.event_location || '',
                        event_name: savedQuote.event_name || '',
                        decorator_name: savedQuote.decorator_name || '',
                        initial_setup_date: savedQuote.initial_setup_date || '',
                        technical_responsible: savedQuote.technical_responsible || '',
                        products: savedQuote.products || [],
                        subtotal: savedQuote.subtotal || 0,
                        discount_percentage: savedQuote.discount_percentage || 0,
                        discount_amount: savedQuote.discount_amount || 0,
                        travel_expense: savedQuote.travel_expense || 0,
                        accommodation_expense: savedQuote.accommodation_expense || 0,
                        total_amount: savedQuote.total_amount || 0,
                        tax_option: savedQuote.tax_option || 'sem_nota',
                        status: 'draft',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      };
                      
                      await createEventFromQuote(tempQuote);

                      // Fechar dialog e limpar formulário
                      setIsDialogOpen(false);
                      resetForm();
                      loadQuotes();
                      
                    } catch (error) {
                      console.error('Erro ao salvar orçamento e criar evento:', error);
                      toast.error(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Salvar e Criar Evento
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
