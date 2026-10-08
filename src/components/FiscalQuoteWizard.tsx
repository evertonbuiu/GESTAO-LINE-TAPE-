import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Eye, Edit, Trash2, DollarSign, Calculator, 
  FileText, Download, Upload, PenTool, Save, 
  RefreshCw, Copy, Send, CheckCircle 
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { useValueVisibility } from "@/hooks/useValueVisibility";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatPhone, handlePhoneInput } from '@/lib/utils';
import { Canvas as FabricCanvas, PencilBrush } from "fabric";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
}

interface FiscalQuote {
  id: string;
  quote_number: string;
  client_name: string;
  client_document: string;
  client_email: string;
  client_phone: string;
  client_address: string;
  service_type: string;
  quote_date: string;
  validity_days: number;
  subtotal: number;
  tax_total: number;
  discount_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  items: QuoteItem[];
  fiscal_notes: string;
  payment_terms: string;
  delivery_terms: string;
  signature_data?: string;
  created_at: string;
  updated_at: string;
}

// Configurações fiscais do Brasil
const FISCAL_CONFIG = {
  // ISS (Imposto sobre Serviços) - varia por município
  ISS_RATES: {
    'consultoria': 0.05, // 5%
    'desenvolvimento': 0.03, // 3%
    'manutencao': 0.03, // 3%
    'treinamento': 0.05, // 5%
    'outros': 0.05 // 5%
  },
  // PIS/COFINS (aproximado)
  PIS_COFINS: 0.0365, // 3.65%
  // IR/CSLL (aproximado para lucro presumido)
  IR_CSLL: 0.048, // 4.8%
  // Simples Nacional (aproximado)
  SIMPLES_NACIONAL: 0.06 // 6%
};

export const FiscalQuoteWizard = () => {
  const { userRole } = useCustomAuth();
  const { formatValue, canViewValues } = useValueVisibility();
  const [quotes, setQuotes] = useState<FiscalQuote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<FiscalQuote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  
  // Estados para o formulário
  const [formData, setFormData] = useState({
    quote_number: '',
    client_name: '',
    client_document: '',
    client_email: '',
    client_phone: '',
    client_address: '',
    service_type: 'consultoria',
    validity_days: 30,
    fiscal_notes: '',
    payment_terms: '',
    delivery_terms: '',
  });

  const [quoteItems, setQuoteItems] = useState<Omit<QuoteItem, 'id'>[]>([
    {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      tax_rate: 0,
      tax_amount: 0,
    }
  ]);

  const [taxConfig, setTaxConfig] = useState({
    use_simples_nacional: true,
    iss_rate: 0.05,
    pis_cofins_rate: 0.0365,
    ir_csll_rate: 0.048,
    discount_percentage: 0,
  });

  // Canvas para assinatura
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  const canManage = userRole === 'admin' || userRole === 'financeiro';

  useEffect(() => {
    loadQuotes();
  }, []);

  // Inicializar canvas de assinatura
  useEffect(() => {
    if (!canvasRef.current || fabricCanvas) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 400,
      height: 200,
      backgroundColor: "#ffffff",
    });

    canvas.isDrawingMode = true;
    const brush = new PencilBrush(canvas);
    brush.color = "#000000";
    brush.width = 2;
    canvas.freeDrawingBrush = brush;

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [isSignatureOpen]);

  const loadQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar cotações:', error);
        toast.error('Erro ao carregar cotações');
        return;
      }

      // Converter dados para o formato de cotações
      const quotesData = (data || []).map(contract => {
        // Calcular valores corretos baseados no total_value
        const totalValue = contract.total_value || 0;
        const taxRate = 0.05; // 5% padrão
        const subtotal = totalValue / (1 + taxRate); // Subtotal sem impostos
        const taxAmount = totalValue - subtotal; // Valor dos impostos
        
        return {
          ...contract,
          client_address: contract.client_phone || '',
          service_type: 'consultoria',
          delivery_terms: contract.payment_terms || '',
          items: contract.service_description ? [{
            id: '1',
            description: contract.service_description,
            quantity: 1,
            unit_price: subtotal,
            total_price: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
          }] : [{
            id: '1',
            description: 'Serviço',
            quantity: 1,
            unit_price: subtotal,
            total_price: subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
          }],
          subtotal: subtotal,
          tax_total: taxAmount,
          discount_amount: 0,
          total_amount: totalValue,
          quote_number: contract.contract_number,
          quote_date: contract.start_date,
          validity_days: 30,
          fiscal_notes: contract.payment_terms || '',
        };
      }) as FiscalQuote[];

      setQuotes(quotesData);
    } catch (error) {
      console.error('Erro ao carregar cotações:', error);
      toast.error('Erro ao carregar cotações');
    }
  };

  // Gerar número da cotação
  const generateQuoteNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `COT-${year}${month}${day}-${random}`;
  };

  // Calcular impostos para um item
  const calculateItemTaxes = (item: Omit<QuoteItem, 'id'>, serviceType: string) => {
    const baseValue = item.quantity * item.unit_price;
    let taxRate = 0;

    if (taxConfig.use_simples_nacional) {
      taxRate = FISCAL_CONFIG.SIMPLES_NACIONAL;
    } else {
      const issRate = FISCAL_CONFIG.ISS_RATES[serviceType as keyof typeof FISCAL_CONFIG.ISS_RATES] || 0.05;
      taxRate = issRate + taxConfig.pis_cofins_rate + taxConfig.ir_csll_rate;
    }

    const taxAmount = baseValue * taxRate;
    return {
      ...item,
      total_price: baseValue,
      tax_rate: taxRate,
      tax_amount: taxAmount,
    };
  };

  // Recalcular totais
  const calculateTotals = () => {
    const calculatedItems = quoteItems.map(item => 
      calculateItemTaxes(item, formData.service_type)
    );
    
    const subtotal = calculatedItems.reduce((sum, item) => sum + item.total_price, 0);
    const taxTotal = calculatedItems.reduce((sum, item) => sum + item.tax_amount, 0);
    const discountAmount = subtotal * (taxConfig.discount_percentage / 100);
    const totalAmount = subtotal + taxTotal - discountAmount;

    return {
      calculatedItems,
      subtotal,
      taxTotal,
      discountAmount,
      totalAmount,
    };
  };

  // Atualizar item da cotação
  const updateQuoteItem = (index: number, field: keyof Omit<QuoteItem, 'id'>, value: any) => {
    const newItems = [...quoteItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setQuoteItems(newItems);
  };

  // Adicionar novo item
  const addQuoteItem = () => {
    setQuoteItems([...quoteItems, {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      tax_rate: 0,
      tax_amount: 0,
    }]);
  };

  // Remover item
  const removeQuoteItem = (index: number) => {
    if (quoteItems.length > 1) {
      setQuoteItems(quoteItems.filter((_, i) => i !== index));
    }
  };

  // Salvar cotação fiscal
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canManage) {
      toast.error('Você não tem permissão para criar cotações');
      return;
    }

    const totals = calculateTotals();

    try {
      const contractData = {
        contract_number: formData.quote_number || generateQuoteNumber(),
        client_name: formData.client_name,
        client_document: formData.client_document,
        client_email: formData.client_email,
        client_phone: formData.client_phone,
        service_description: quoteItems.map(item => item.description).join('; '),
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + formData.validity_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        total_value: totals.totalAmount,
        payment_terms: `Cotação Fiscal - ${formData.payment_terms}\n\nImpostos: ${formatValue(totals.taxTotal)}\nDesconto: ${formatValue(totals.discountAmount)}`,
        status: 'draft',
      };

      // Salvar como contrato principal
      const { error } = await supabase
        .from('contracts')
        .insert(contractData);

      if (error) {
        console.error('Erro ao salvar contrato:', error);
        toast.error('Erro ao salvar contrato');
        return;
      }

      toast.success('Cotação fiscal e contrato salvos com sucesso!');
      setIsDialogOpen(false);
      resetForm();
      loadQuotes();
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      toast.error('Erro ao salvar cotação');
    }
  };

  // Gerar PDF da cotação
  const generatePDF = async (quote: FiscalQuote) => {
    const pdf = new jsPDF({
      compress: true
    });
    const pageHeight = pdf.internal.pageSize.height;
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 20;
    
    // Cabeçalho
    pdf.setFontSize(20);
    pdf.text('COTAÇÃO FISCAL', margin, 20);
    
    pdf.setFontSize(12);
    pdf.text(`Número: ${quote.quote_number}`, margin, 35);
    pdf.text(`Data: ${new Date(quote.quote_date).toLocaleDateString('pt-BR')}`, margin, 45);
    pdf.text(`Validade: ${quote.validity_days} dias`, margin, 55);

    // Dados do cliente
    pdf.setFontSize(14);
    pdf.text('DADOS DO CLIENTE', margin, 75);
    pdf.setFontSize(10);
    pdf.text(`Nome: ${quote.client_name}`, margin, 85);
    pdf.text(`Documento: ${quote.client_document}`, margin, 95);
    pdf.text(`Email: ${quote.client_email}`, margin, 105);
    pdf.text(`Telefone: ${quote.client_phone}`, margin, 115);

    // Itens da cotação
    const tableData = quote.items.map(item => [
      item.description,
      item.quantity.toString(),
      formatValue(item.unit_price),
      formatValue(item.total_price),
      `${(item.tax_rate * 100).toFixed(2)}%`,
      formatValue(item.tax_amount),
    ]);

    autoTable(pdf, {
      startY: 130,
      head: [['Descrição', 'Qtd', 'Preço Unit.', 'Subtotal', 'Imposto', 'Total Imposto']],
      body: tableData,
      theme: 'striped',
      margin: { left: margin, right: margin },
      styles: { 
        cellPadding: 3,
        fontSize: 8,
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 'auto' }, // Descrição
        1: { cellWidth: 20 },    // Quantidade
        2: { cellWidth: 25 },    // Preço Unit
        3: { cellWidth: 25 },    // Subtotal
        4: { cellWidth: 20 },    // Imposto %
        5: { cellWidth: 25 }     // Total Imposto
      },
      didDrawPage: (data: any) => {
        // Adicionar numeração de página
        pdf.setFontSize(8);
        pdf.text(
          `Página ${data.pageNumber}`, 
          pageWidth - 30, 
          pageHeight - 10
        );
      }
    });

    // Verificar se precisa de nova página para os totais
    let finalY = (pdf as any).lastAutoTable.finalY + 20;
    if (finalY > pageHeight - 80) {
      pdf.addPage();
      finalY = 30;
    }

    // Totais e Detalhamento de Impostos
    pdf.setFontSize(10);
    const totalsX = pageWidth - 80;
    
    pdf.text(`Subtotal: ${formatValue(quote.subtotal)}`, totalsX, finalY);
    
    // Detalhamento dos impostos
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    let taxDetailY = finalY + 8;
    
    // Verificar se usa Simples Nacional ou regime normal
    const avgTaxRate = quote.items.length > 0 ? quote.items[0].tax_rate : 0;
    const usesSimplesNacional = avgTaxRate <= 0.07; // Aproximadamente 6-7%
    
    if (usesSimplesNacional) {
      pdf.text(`  Simples Nacional (${(avgTaxRate * 100).toFixed(2)}%)`, totalsX + 5, taxDetailY);
    } else {
      // Calcular estimativa de cada imposto
      const issEstimate = quote.tax_total * 0.4; // Aproximadamente 40% do total
      const pisCofinsEstimate = quote.tax_total * 0.3; // Aproximadamente 30% do total
      const irCsllEstimate = quote.tax_total * 0.3; // Aproximadamente 30% do total
      
      pdf.text(`  ISS: ${formatValue(issEstimate)}`, totalsX + 5, taxDetailY);
      pdf.text(`  PIS/COFINS: ${formatValue(pisCofinsEstimate)}`, totalsX + 5, taxDetailY + 5);
      pdf.text(`  IR/CSLL: ${formatValue(irCsllEstimate)}`, totalsX + 5, taxDetailY + 10);
      taxDetailY += 10;
    }
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    pdf.text(`Total de Impostos: ${formatValue(quote.tax_total)}`, totalsX, taxDetailY + 5);
    
    if (quote.discount_amount > 0) {
      pdf.text(`Desconto: ${formatValue(quote.discount_amount)}`, totalsX, taxDetailY + 15);
    }
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    const totalY = quote.discount_amount > 0 ? taxDetailY + 30 : taxDetailY + 20;
    pdf.text(`TOTAL: ${formatValue(quote.total_amount)}`, totalsX, totalY);
    pdf.setFont(undefined, 'normal');

    // Observações fiscais
    if (quote.fiscal_notes) {
      let notesY = totalY + 30;
      
      // Verificar se precisa de nova página para as observações
      if (notesY > pageHeight - 50) {
        pdf.addPage();
        notesY = 30;
      }
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text('Observações Fiscais:', margin, notesY);
      pdf.setFont(undefined, 'normal');
      
      const splitNotes = pdf.splitTextToSize(quote.fiscal_notes, pageWidth - (margin * 2));
      
      // Verificar se as observações cabem na página atual
      const notesHeight = splitNotes.length * 5;
      if (notesY + notesHeight > pageHeight - 20) {
        pdf.addPage();
        notesY = 30;
        pdf.setFontSize(10);
        pdf.setFont(undefined, 'bold');
        pdf.text('Observações Fiscais:', margin, notesY);
        pdf.setFont(undefined, 'normal');
      }
      
      pdf.text(splitNotes, margin, notesY + 10);
    }

    pdf.save(`cotacao-${quote.quote_number}.pdf`);
    toast.success('PDF gerado com sucesso!');
  };

  // Limpar assinatura
  const clearSignature = () => {
    if (fabricCanvas) {
      fabricCanvas.clear();
      fabricCanvas.backgroundColor = "#ffffff";
      fabricCanvas.renderAll();
    }
  };

  // Salvar assinatura
  const saveSignature = () => {
    if (fabricCanvas && selectedQuote) {
      const signatureData = fabricCanvas.toDataURL();
      // Aqui você salvaria a assinatura no banco de dados
      toast.success('Assinatura salva com sucesso!');
      setIsSignatureOpen(false);
    }
  };

  const resetForm = () => {
    setFormData({
      quote_number: '',
      client_name: '',
      client_document: '',
      client_email: '',
      client_phone: '',
      client_address: '',
      service_type: 'consultoria',
      validity_days: 30,
      fiscal_notes: '',
      payment_terms: '',
      delivery_terms: '',
    });
    setQuoteItems([{
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      tax_rate: 0,
      tax_amount: 0,
    }]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'sent': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'expired': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'sent': return 'Enviado';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'expired': return 'Expirado';
      default: return status;
    }
  };

  const totals = calculateTotals();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assistente de Cotações Fiscais</h1>
          <p className="text-muted-foreground">
            Sistema completo para geração de cotações com cálculos fiscais automáticos
          </p>
        </div>

        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Nova Cotação Fiscal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assistente de Cotação Fiscal</DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                    <TabsTrigger value="items">Itens & Serviços</TabsTrigger>
                    <TabsTrigger value="taxes">Configuração Fiscal</TabsTrigger>
                    <TabsTrigger value="summary">Resumo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quote_number">Número da Cotação</Label>
                        <Input
                          id="quote_number"
                          value={formData.quote_number}
                          onChange={(e) => setFormData({ ...formData, quote_number: e.target.value })}
                          placeholder="Será gerado automaticamente"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="validity_days">Validade (dias)</Label>
                        <Input
                          id="validity_days"
                          type="number"
                          value={formData.validity_days}
                          onChange={(e) => setFormData({ ...formData, validity_days: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Dados do Cliente</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client_name">Nome/Razão Social*</Label>
                          <Input
                            id="client_name"
                            value={formData.client_name}
                            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client_document">CPF/CNPJ*</Label>
                          <Input
                            id="client_document"
                            value={formData.client_document}
                            onChange={(e) => setFormData({ ...formData, client_document: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="client_email">Email</Label>
                          <Input
                            id="client_email"
                            type="email"
                            value={formData.client_email}
                            onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="client_phone">Telefone</Label>
                          <Input
                            id="client_phone"
                            value={formData.client_phone}
                            onChange={(e) => {
                              const formatted = handlePhoneInput(e.target.value);
                              setFormData({ ...formData, client_phone: formatted });
                            }}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client_address">Endereço Completo</Label>
                        <Textarea
                          id="client_address"
                          value={formData.client_address}
                          onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service_type">Tipo de Serviço</Label>
                      <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consultoria">Consultoria (ISS 5%)</SelectItem>
                          <SelectItem value="desenvolvimento">Desenvolvimento (ISS 3%)</SelectItem>
                          <SelectItem value="manutencao">Manutenção (ISS 3%)</SelectItem>
                          <SelectItem value="treinamento">Treinamento (ISS 5%)</SelectItem>
                          <SelectItem value="outros">Outros (ISS 5%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="items" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Itens e Serviços</h3>
                      <Button type="button" onClick={addQuoteItem} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Item
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {quoteItems.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="pt-4">
                            <div className="grid grid-cols-5 gap-4 items-end">
                              <div className="col-span-2 space-y-2">
                                <Label>Descrição*</Label>
                                <Textarea
                                  value={item.description}
                                  onChange={(e) => updateQuoteItem(index, 'description', e.target.value)}
                                  placeholder="Descrição do serviço/produto"
                                  rows={2}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Quantidade</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateQuoteItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                  min="0.01"
                                  step="0.01"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Preço Unitário</Label>
                                <CurrencyInput
                                  value={item.unit_price}
                                  onChange={(value) => updateQuoteItem(index, 'unit_price', value)}
                                  placeholder="R$ 0,00"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm">
                                  Total: {formatValue(item.quantity * item.unit_price)}
                                </div>
                                {quoteItems.length > 1 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeQuoteItem(index)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="taxes" className="space-y-4">
                    <div className="space-y-6">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={taxConfig.use_simples_nacional}
                          onCheckedChange={(checked) => setTaxConfig({ ...taxConfig, use_simples_nacional: checked })}
                        />
                        <Label>Usar Simples Nacional (6%)</Label>
                      </div>

                      {!taxConfig.use_simples_nacional && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Taxa ISS (%)</Label>
                            <Input
                              type="number"
                              value={taxConfig.iss_rate * 100}
                              onChange={(e) => setTaxConfig({ ...taxConfig, iss_rate: parseFloat(e.target.value) / 100 || 0 })}
                              step="0.01"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>PIS/COFINS (%)</Label>
                            <Input
                              type="number"
                              value={taxConfig.pis_cofins_rate * 100}
                              onChange={(e) => setTaxConfig({ ...taxConfig, pis_cofins_rate: parseFloat(e.target.value) / 100 || 0 })}
                              step="0.01"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>IR/CSLL (%)</Label>
                            <Input
                              type="number"
                              value={taxConfig.ir_csll_rate * 100}
                              onChange={(e) => setTaxConfig({ ...taxConfig, ir_csll_rate: parseFloat(e.target.value) / 100 || 0 })}
                              step="0.01"
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Desconto (%)</Label>
                        <Input
                          type="number"
                          value={taxConfig.discount_percentage}
                          onChange={(e) => setTaxConfig({ ...taxConfig, discount_percentage: parseFloat(e.target.value) || 0 })}
                          step="0.01"
                          max="100"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-semibold">Observações Fiscais</h4>
                        <Textarea
                          value={formData.fiscal_notes}
                          onChange={(e) => setFormData({ ...formData, fiscal_notes: e.target.value })}
                          rows={4}
                          placeholder="Observações sobre tributação, regime fiscal, etc."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Condições de Pagamento</Label>
                          <Textarea
                            value={formData.payment_terms}
                            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                            rows={3}
                            placeholder="Ex: À vista, 30 dias, parcelado..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Condições de Entrega</Label>
                          <Textarea
                            value={formData.delivery_terms}
                            onChange={(e) => setFormData({ ...formData, delivery_terms: e.target.value })}
                            rows={3}
                            placeholder="Prazos de entrega, local, condições..."
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="summary" className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Resumo da Cotação</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>{formatValue(totals.subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Total de Impostos:</span>
                            <span>{formatValue(totals.taxTotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Desconto:</span>
                            <span>-{formatValue(totals.discountAmount)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold text-lg">
                            <span>TOTAL:</span>
                            <span>{formatValue(totals.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Detalhamento Fiscal</h3>
                        <div className="space-y-2 text-sm">
                          {taxConfig.use_simples_nacional ? (
                            <div className="flex justify-between">
                              <span>Simples Nacional:</span>
                              <span>6%</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex justify-between">
                                <span>ISS:</span>
                                <span>{(taxConfig.iss_rate * 100).toFixed(2)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>PIS/COFINS:</span>
                                <span>{(taxConfig.pis_cofins_rate * 100).toFixed(2)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span>IR/CSLL:</span>
                                <span>{(taxConfig.ir_csll_rate * 100).toFixed(2)}%</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Preço Unit.</TableHead>
                            <TableHead>Subtotal</TableHead>
                            <TableHead>Impostos</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totals.calculatedItems.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="max-w-xs">
                                <div className="truncate" title={item.description}>
                                  {item.description}
                                </div>
                              </TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{formatValue(item.unit_price)}</TableCell>
                              <TableCell>{formatValue(item.total_price)}</TableCell>
                              <TableCell>{formatValue(item.tax_amount)}</TableCell>
                              <TableCell className="font-medium">
                                {formatValue(item.total_price + item.tax_amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Cotação
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Lista de Cotações */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Cotações Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Validade</TableHead>
                  {canViewValues && <TableHead>Valor Total</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      {quote.quote_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{quote.client_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {quote.client_document}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(quote.quote_date).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {quote.validity_days} dias
                    </TableCell>
                    {canViewValues && (
                      <TableCell className="font-medium">
                        {formatValue(quote.total_amount)}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge className={getStatusColor(quote.status)}>
                        {getStatusLabel(quote.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => generatePDF(quote)}
                          title="Gerar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedQuote(quote);
                            setIsSignatureOpen(true);
                          }}
                          title="Assinatura Digital"
                        >
                          <PenTool className="h-4 w-4" />
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {/* Implementar edição */}}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Assinatura Digital */}
      <Dialog open={isSignatureOpen} onOpenChange={setIsSignatureOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Assinatura Digital - {selectedQuote?.quote_number}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border border-gray-300 rounded-lg p-4 bg-white">
              <canvas
                ref={canvasRef}
                className="border border-gray-200 rounded"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={clearSignature} variant="outline" className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
              <Button onClick={saveSignature} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Salvar Assinatura
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};