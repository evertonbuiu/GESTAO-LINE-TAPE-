import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Receipt, 
  Calculator, 
  CheckCircle,
  XCircle,
  ArrowDown,
  ArrowUp,
  Minus,
  FileText,
  Wallet,
  Users,
  Utensils,
  Truck,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLogo } from '@/hooks/useLogo';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { toast } from 'sonner';

interface EventTaxDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  totalValue: number;
  taxes: {
    ISS: number;
    CBS: number;
    IBS: number;
    IRPJ: number;
    CSLL: number;
    PIS_COFINS: number;
    totalTax: number;
    effectiveRate: number;
  };
  taxRegime: string;
}

interface Expense {
  id: string;
  description: string;
  category: string | null;
  total_price: number;
  expense_date: string | null;
  is_deductible: boolean;
  deduction_type: string;
}

interface Collaborator {
  id: string;
  name: string;
  role: string;
  amount: number;
  type: 'payment' | 'advance' | 'expense_advance' | 'food_allowance';
  date: string;
  is_deductible: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${(value * 100).toFixed(2)}%`;
};

// Define deductible expense categories
const DEDUCTIBLE_CATEGORIES = [
  'Material',
  'Transporte',
  'Alimentação',
  'Hospedagem',
  'Equipamento',
  'Aluguel',
  'Serviços Terceirizados',
  'Mão de Obra',
  'Combustível',
  'Manutenção'
];

const NON_DEDUCTIBLE_CATEGORIES = [
  'Multas',
  'Despesas Pessoais',
  'Brindes',
  'Doações',
  'Presentes'
];

export const EventTaxDetailModal = ({ 
  open, 
  onOpenChange, 
  eventId,
  eventName,
  eventDate,
  clientName,
  totalValue,
  taxes,
  taxRegime
}: EventTaxDetailModalProps) => {
  const { logoUrl } = useLogo();
  const { settings } = useCompanySettings();
  
  // Fetch event expenses
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['event-expenses-tax-detail', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      
      return (data || []).map(expense => {
        const category = expense.category || 'Outros';
        const isDeductible = DEDUCTIBLE_CATEGORIES.some(c => 
          category.toLowerCase().includes(c.toLowerCase())
        ) && !NON_DEDUCTIBLE_CATEGORIES.some(c => 
          category.toLowerCase().includes(c.toLowerCase())
        );
        
        return {
          id: expense.id,
          description: expense.description,
          category: expense.category,
          total_price: expense.total_price || 0,
          expense_date: expense.expense_date,
          is_deductible: isDeductible,
          deduction_type: isDeductible ? 'Despesa Operacional' : 'Não Dedutível'
        };
      });
    },
    enabled: open && !!eventId
  });

  // Fetch collaborator payments
  const { data: collaboratorPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['event-collaborator-payments-tax', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_payments')
        .select(`
          *,
          collaborators (name, role)
        `)
        .eq('event_id', eventId);
      if (error) throw error;
      
      return (data || []).map(payment => ({
        id: payment.id,
        name: (payment.collaborators as any)?.name || 'Colaborador',
        role: (payment.collaborators as any)?.role || 'Funcionário',
        amount: payment.amount || 0,
        type: 'payment' as const,
        date: payment.payment_date,
        is_deductible: true
      }));
    },
    enabled: open && !!eventId
  });

  // Fetch daily rates for event
  const { data: dailyRates = [], isLoading: dailyRatesLoading } = useQuery({
    queryKey: ['event-daily-rates-tax', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_rates')
        .select('*')
        .eq('event_id', eventId);
      if (error) throw error;
      
      return (data || []).map(rate => ({
        id: rate.id,
        name: rate.worker_name,
        role: 'Diarista',
        amount: rate.amount || 0,
        type: 'payment' as const,
        date: rate.date,
        is_deductible: true
      }));
    },
    enabled: open && !!eventId
  });

  // Fetch food allowances for event
  const { data: foodAllowances = [], isLoading: foodLoading } = useQuery({
    queryKey: ['event-food-allowances-tax', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborator_food_allowances')
        .select(`
          *,
          collaborators (name, role)
        `)
        .eq('event_id', eventId);
      if (error) throw error;
      
      return (data || []).map(allowance => ({
        id: allowance.id,
        name: (allowance.collaborators as any)?.name || 'Colaborador',
        role: (allowance.collaborators as any)?.role || 'Funcionário',
        amount: allowance.amount || 0,
        type: 'food_allowance' as const,
        date: allowance.allowance_date,
        is_deductible: true
      }));
    },
    enabled: open && !!eventId
  });

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, e) => sum + e.total_price, 0);
  const deductibleExpenses = expenses.filter(e => e.is_deductible).reduce((sum, e) => sum + e.total_price, 0);
  const nonDeductibleExpenses = expenses.filter(e => !e.is_deductible).reduce((sum, e) => sum + e.total_price, 0);
  
  const allPersonnelCosts = [...collaboratorPayments, ...dailyRates, ...foodAllowances];
  const totalPersonnelCosts = allPersonnelCosts.reduce((sum, c) => sum + c.amount, 0);
  const deductiblePersonnelCosts = allPersonnelCosts.filter(c => c.is_deductible).reduce((sum, c) => sum + c.amount, 0);
  
  const totalDeductible = deductibleExpenses + deductiblePersonnelCosts;
  const totalNonDeductible = nonDeductibleExpenses;
  
  // Tax base calculation (for Lucro Real)
  const taxBase = totalValue - totalDeductible;
  const isLoading = expensesLoading || paymentsLoading || dailyRatesLoading || foodLoading;

  // Calculate potential tax savings
  const potentialIRPJSavings = taxRegime === 'lucro_real' ? totalDeductible * 0.15 * 0.20 : 0;
  const potentialCSLLSavings = taxRegime === 'lucro_real' ? totalDeductible * 0.09 * 0.20 : 0;
  const totalPotentialSavings = potentialIRPJSavings + potentialCSLLSavings;
  const netProfit = totalValue - taxes.totalTax - totalExpenses - totalPersonnelCosts;

  // Generate PDF function
  const generatePDF = async () => {
    const pdf = new jsPDF({
      compress: true
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let currentY = 15;

    // === HEADER WITH LOGO ===
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        const logoBlob = await logoResponse.blob();
        const logoDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        pdf.addImage(logoDataUrl, 'JPEG', 15, currentY, 30, 24, undefined, 'MEDIUM');
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
      }
    }

    // Company info
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(30, 64, 175);
    pdf.text(settings?.company_name || 'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA', logoUrl ? 50 : 15, currentY + 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    if (settings?.address) {
      pdf.text(settings.address, logoUrl ? 50 : 15, currentY + 13);
    }
    if (settings?.phone) {
      pdf.text(`Tel: ${settings.phone}`, logoUrl ? 50 : 15, currentY + 18);
    }
    if (settings?.email) {
      pdf.text(`Email: ${settings.email}`, logoUrl ? 50 : 15, currentY + 23);
    }

    // Report title box (right side)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(30, 64, 175);
    pdf.text('RELATÓRIO FISCAL', pageWidth - 50, currentY + 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(40, 40, 40);
    pdf.text(`Data: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, pageWidth - 50, currentY + 13);

    currentY = 50;

    // Separator line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(15, currentY, pageWidth - 15, currentY);
    currentY += 10;

    // === EVENT INFO ===
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 64, 175);
    pdf.text('INFORMAÇÕES DO EVENTO', 15, currentY);
    currentY += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(40, 40, 40);
    
    pdf.text(`Evento: ${eventName}`, 15, currentY);
    pdf.text(`Cliente: ${clientName}`, pageWidth / 2, currentY);
    currentY += 6;
    pdf.text(`Data: ${format(new Date(eventDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`, 15, currentY);
    pdf.text(`Regime: ${taxRegime.replace('_', ' ').toUpperCase()}`, pageWidth / 2, currentY);
    currentY += 6;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Valor Total: ${formatCurrency(totalValue)}`, 15, currentY);
    currentY += 12;

    // === SUMMARY SECTION ===
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 64, 175);
    pdf.text('RESUMO FISCAL', 15, currentY);
    currentY += 8;

    // Summary table
    autoTable(pdf, {
      startY: currentY,
      head: [['Descrição', 'Valor', 'Status']],
      body: [
        ['Receita Bruta', formatCurrency(totalValue), 'Entrada'],
        ['Total Dedutível', formatCurrency(totalDeductible), 'Dedutível'],
        ['Total Não Dedutível', formatCurrency(totalNonDeductible), 'Não Dedutível'],
        ['Base Tributável', formatCurrency(taxBase), 'Base'],
        ['Total de Impostos', formatCurrency(taxes.totalTax), `${formatPercent(taxes.effectiveRate)} efetiva`],
        ['Lucro Líquido', formatCurrency(netProfit), netProfit >= 0 ? 'Positivo' : 'Negativo'],
      ],
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right' },
        2: { halign: 'center' }
      },
      margin: { left: 15, right: 15 }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 10;

    // === TAX BREAKDOWN ===
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 64, 175);
    pdf.text('COMPOSIÇÃO DOS IMPOSTOS', 15, currentY);
    currentY += 8;

    const taxRows: any[] = [];
    if (taxes.ISS > 0) taxRows.push(['ISS', formatCurrency(taxes.ISS), 'Municipal']);
    if (taxes.CBS > 0) taxRows.push(['CBS', formatCurrency(taxes.CBS), 'Federal']);
    if (taxes.IBS > 0) taxRows.push(['IBS', formatCurrency(taxes.IBS), 'Est/Mun']);
    if (taxes.PIS_COFINS > 0) taxRows.push(['PIS/COFINS', formatCurrency(taxes.PIS_COFINS), 'Federal']);
    if (taxes.IRPJ > 0) taxRows.push(['IRPJ', formatCurrency(taxes.IRPJ), 'Federal']);
    if (taxes.CSLL > 0) taxRows.push(['CSLL', formatCurrency(taxes.CSLL), 'Federal']);
    taxRows.push(['TOTAL', formatCurrency(taxes.totalTax), formatPercent(taxes.effectiveRate)]);

    autoTable(pdf, {
      startY: currentY,
      head: [['Imposto', 'Valor', 'Esfera']],
      body: taxRows,
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'center' }
      },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === taxRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    currentY = (pdf as any).lastAutoTable.finalY + 10;

    // Check for page break
    if (currentY > pageHeight - 80) {
      pdf.addPage();
      currentY = 20;
    }

    // === DEDUCTIBLE EXPENSES ===
    if (expenses.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175);
      pdf.text('DESPESAS DO EVENTO', 15, currentY);
      currentY += 8;

      autoTable(pdf, {
        startY: currentY,
        head: [['Descrição', 'Categoria', 'Valor', 'Dedutível']],
        body: expenses.map(e => [
          e.description,
          e.category || 'Outros',
          formatCurrency(e.total_price),
          e.is_deductible ? 'Sim' : 'Não'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'center' }
        },
        margin: { left: 15, right: 15 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            if (data.cell.raw === 'Sim') {
              data.cell.styles.textColor = [22, 163, 74]; // green
            } else {
              data.cell.styles.textColor = [220, 38, 38]; // red
            }
          }
        }
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;
    }

    // Check for page break
    if (currentY > pageHeight - 80) {
      pdf.addPage();
      currentY = 20;
    }

    // === PERSONNEL COSTS ===
    if (allPersonnelCosts.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175);
      pdf.text('CUSTOS COM PESSOAL', 15, currentY);
      currentY += 8;

      autoTable(pdf, {
        startY: currentY,
        head: [['Nome', 'Função', 'Tipo', 'Valor']],
        body: allPersonnelCosts.map((c: Collaborator) => [
          c.name,
          c.role,
          c.type === 'payment' ? 'Pagamento' : 
           c.type === 'food_allowance' ? 'Alimentação' :
           c.type === 'advance' ? 'Vale' : 'Notinha',
          formatCurrency(c.amount)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          3: { halign: 'right' }
        },
        margin: { left: 15, right: 15 }
      });

      currentY = (pdf as any).lastAutoTable.finalY + 10;
    }

    // === FINANCIAL FLOW ===
    if (currentY > pageHeight - 60) {
      pdf.addPage();
      currentY = 20;
    }

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 64, 175);
    pdf.text('FLUXO FINANCEIRO', 15, currentY);
    currentY += 8;

    autoTable(pdf, {
      startY: currentY,
      head: [['Descrição', 'Valor']],
      body: [
        ['Receita Bruta', formatCurrency(totalValue)],
        ['(-) Impostos', formatCurrency(taxes.totalTax)],
        ['(-) Despesas', formatCurrency(totalExpenses)],
        ['(-) Custos com Pessoal', formatCurrency(totalPersonnelCosts)],
        ['= LUCRO LÍQUIDO', formatCurrency(netProfit)],
      ],
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: 15, right: 15 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.row.index === 0) {
            data.cell.styles.textColor = [22, 163, 74]; // green
          } else if (data.row.index >= 1 && data.row.index <= 3) {
            data.cell.styles.textColor = [220, 38, 38]; // red
          } else if (data.row.index === 4) {
            data.cell.styles.fillColor = [30, 64, 175];
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      }
    });

    // === FOOTER ===
    const footerY = pageHeight - 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(15, footerY - 5, pageWidth - 15, footerY - 5);

    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(settings?.company_name || 'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA', 15, footerY);
    pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - 15, footerY, { align: 'right' });

    // Save PDF
    const fileName = `relatorio-fiscal-${eventName.replace(/[^a-zA-Z0-9]/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    pdf.save(fileName);
    toast.success('PDF gerado com sucesso!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Detalhamento Fiscal - {eventName}
          </DialogTitle>
          <DialogDescription>
            Análise completa de despesas dedutíveis e não dedutíveis para o evento
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Event Info */}
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-medium">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data do Evento</p>
                    <p className="font-medium">
                      {format(new Date(eventDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Regime Tributário</p>
                    <p className="font-medium capitalize">{taxRegime.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor Total</p>
                    <p className="font-bold text-lg">{formatCurrency(totalValue)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-xs text-muted-foreground">Dedutível</p>
                  </div>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {formatCurrency(totalDeductible)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-red-500/10 border-red-500/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="text-xs text-muted-foreground">Não Dedutível</p>
                  </div>
                  <p className="text-lg font-bold text-red-600 mt-1">
                    {formatCurrency(totalNonDeductible)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <p className="text-xs text-muted-foreground">Base Tributável</p>
                  </div>
                  <p className="text-lg font-bold text-blue-600 mt-1">
                    {formatCurrency(taxBase)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-orange-500/10 border-orange-500/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-orange-600" />
                    <p className="text-xs text-muted-foreground">Impostos</p>
                  </div>
                  <p className="text-lg font-bold text-orange-600 mt-1">
                    {formatCurrency(taxes.totalTax)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-primary/10 border-primary/30">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Lucro Líquido</p>
                  </div>
                  <p className="text-lg font-bold text-primary mt-1">
                    {formatCurrency(totalValue - taxes.totalTax - totalExpenses - totalPersonnelCosts)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tax Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Composição dos Impostos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                  {taxes.ISS > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">ISS</p>
                      <p className="font-bold">{formatCurrency(taxes.ISS)}</p>
                      <p className="text-xs text-muted-foreground">Municipal</p>
                    </div>
                  )}
                  {taxes.CBS > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">CBS</p>
                      <p className="font-bold">{formatCurrency(taxes.CBS)}</p>
                      <p className="text-xs text-muted-foreground">Federal</p>
                    </div>
                  )}
                  {taxes.IBS > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">IBS</p>
                      <p className="font-bold">{formatCurrency(taxes.IBS)}</p>
                      <p className="text-xs text-muted-foreground">Est/Mun</p>
                    </div>
                  )}
                  {taxes.PIS_COFINS > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">PIS/COFINS</p>
                      <p className="font-bold">{formatCurrency(taxes.PIS_COFINS)}</p>
                      <p className="text-xs text-muted-foreground">Federal</p>
                    </div>
                  )}
                  {taxes.IRPJ > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">IRPJ</p>
                      <p className="font-bold">{formatCurrency(taxes.IRPJ)}</p>
                      <p className="text-xs text-muted-foreground">Federal</p>
                    </div>
                  )}
                  {taxes.CSLL > 0 && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground text-xs">CSLL</p>
                      <p className="font-bold">{formatCurrency(taxes.CSLL)}</p>
                      <p className="text-xs text-muted-foreground">Federal</p>
                    </div>
                  )}
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Impostos</p>
                    <p className="text-xs text-muted-foreground">Alíquota Efetiva: {formatPercent(taxes.effectiveRate)}</p>
                  </div>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(taxes.totalTax)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Tabs for detailed breakdown */}
            <Tabs defaultValue="expenses" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expenses" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Despesas ({expenses.length})
                </TabsTrigger>
                <TabsTrigger value="personnel" className="gap-2">
                  <Users className="h-4 w-4" />
                  Pessoal ({allPersonnelCosts.length})
                </TabsTrigger>
                <TabsTrigger value="summary" className="gap-2">
                  <Calculator className="h-4 w-4" />
                  Resumo
                </TabsTrigger>
              </TabsList>

              {/* Expenses Tab */}
              <TabsContent value="expenses" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Despesas do Evento</CardTitle>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-green-500/10 text-green-600">
                          Dedutível: {formatCurrency(deductibleExpenses)}
                        </Badge>
                        <Badge variant="outline" className="bg-red-500/10 text-red-600">
                          Não Dedutível: {formatCurrency(nonDeductibleExpenses)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Carregando despesas...
                      </div>
                    ) : expenses.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma despesa registrada para este evento.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-center">Dedutível</TableHead>
                            <TableHead>Tipo Dedução</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {expenses.map(expense => (
                            <TableRow key={expense.id}>
                              <TableCell className="font-medium">{expense.description}</TableCell>
                              <TableCell>{expense.category || 'Outros'}</TableCell>
                              <TableCell>
                                {expense.expense_date 
                                  ? format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(expense.total_price)}
                              </TableCell>
                              <TableCell className="text-center">
                                {expense.is_deductible ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 mx-auto" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant={expense.is_deductible ? 'default' : 'destructive'}>
                                  {expense.deduction_type}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Personnel Tab */}
              <TabsContent value="personnel" className="mt-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Custos com Pessoal</CardTitle>
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        Total Dedutível: {formatCurrency(deductiblePersonnelCosts)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Carregando custos com pessoal...
                      </div>
                    ) : allPersonnelCosts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum custo com pessoal registrado para este evento.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Função</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-center">Dedutível</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allPersonnelCosts.map((cost: Collaborator, index: number) => (
                            <TableRow key={`${cost.type}-${cost.id}-${index}`}>
                              <TableCell className="font-medium">{cost.name}</TableCell>
                              <TableCell>{cost.role}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {cost.type === 'payment' ? 'Pagamento' : 
                                   cost.type === 'food_allowance' ? 'Alimentação' :
                                   cost.type === 'advance' ? 'Vale' : 'Notinha'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(cost.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(cost.amount)}
                              </TableCell>
                              <TableCell className="text-center">
                                {cost.is_deductible ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-600 mx-auto" />
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

              {/* Summary Tab */}
              <TabsContent value="summary" className="mt-4">
                <div className="space-y-4">
                  {/* Deduction Summary */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resumo das Deduções</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Categoria</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Despesas Operacionais (Dedutível)</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(deductibleExpenses)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-500">Dedutível</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Despesas Não Operacionais</TableCell>
                            <TableCell className="text-right text-red-600 font-medium">
                              {formatCurrency(nonDeductibleExpenses)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="destructive">Não Dedutível</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Custos com Pessoal</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(deductiblePersonnelCosts)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className="bg-green-500">Dedutível</Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-bold">Total Dedutível</TableCell>
                            <TableCell className="text-right text-green-600 font-bold text-lg">
                              {formatCurrency(totalDeductible)}
                            </TableCell>
                            <TableCell className="text-center">
                              <ArrowDown className="h-5 w-5 text-green-600 mx-auto" />
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  {/* Financial Flow */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Fluxo Financeiro do Evento</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-green-500/10 rounded-lg">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="h-5 w-5 text-green-600" />
                            <span>Receita Bruta</span>
                          </div>
                          <span className="font-bold text-green-600">{formatCurrency(totalValue)}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Minus className="h-5 w-5 text-red-600" />
                            <span>(-) Impostos</span>
                          </div>
                          <span className="font-bold text-red-600">{formatCurrency(taxes.totalTax)}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-orange-500/10 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Minus className="h-5 w-5 text-orange-600" />
                            <span>(-) Despesas</span>
                          </div>
                          <span className="font-bold text-orange-600">{formatCurrency(totalExpenses)}</span>
                        </div>

                        <div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Minus className="h-5 w-5 text-blue-600" />
                            <span>(-) Custos com Pessoal</span>
                          </div>
                          <span className="font-bold text-blue-600">{formatCurrency(totalPersonnelCosts)}</span>
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-6 w-6 text-primary" />
                            <span className="font-bold text-lg">Lucro Líquido</span>
                          </div>
                          <span className="font-bold text-2xl text-primary">
                            {formatCurrency(totalValue - taxes.totalTax - totalExpenses - totalPersonnelCosts)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tax Savings Info (for Lucro Real) */}
                  {taxRegime === 'lucro_real' && totalPotentialSavings > 0 && (
                    <Card className="bg-green-500/5 border-green-500/20">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-green-700">Economia Fiscal Estimada</p>
                            <p className="text-muted-foreground mt-1">
                              Com as deduções aplicadas, você economiza aproximadamente{' '}
                              <strong className="text-green-600">{formatCurrency(totalPotentialSavings)}</strong>{' '}
                              em impostos sobre o lucro (IRPJ + CSLL).
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={generatePDF} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
