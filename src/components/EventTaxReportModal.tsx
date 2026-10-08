import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Receipt, 
  Calculator, 
  FileText, 
  Info, 
  AlertTriangle,
  Download,
  Building2,
  Percent,
  Eye,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useValueVisibility } from '@/hooks/useValueVisibility';
import { useLogo } from '@/hooks/useLogo';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { EventTaxDetailModal } from './EventTaxDetailModal';

interface EventTaxReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Tax rates based on Brazil's Tax Reform (Reforma Tributária - EC 132/2023)
// Phase 2026: Test phase with symbolic rates
const TAX_RATES_2026 = {
  CBS: 0.009, // 0.9% - Federal
  IBS: 0.001, // 0.1% - State/Municipal
  total: 0.01, // 1% total in 2026
};

// Full rates (2027+)
const TAX_RATES_FULL = {
  CBS: 0.088, // ~8.8% Federal (estimated)
  IBS: 0.177, // ~17.7% State/Municipal (estimated)
  total: 0.265, // ~26.5% total (official estimate)
};

// ISS (current) - municipal service tax (still valid until 2032)
const ISS_RATES = {
  min: 0.02, // 2%
  max: 0.05, // 5%
  default: 0.05, // 5% default for most services
};

// IRPJ + CSLL (federal income taxes - not affected by reform)
const INCOME_TAX_RATES = {
  IRPJ: 0.15, // 15% base
  IRPJ_adicional: 0.10, // 10% additional over R$20k/month
  CSLL: 0.09, // 9% for services
};

// Simples Nacional rates for services (Anexo III)
const SIMPLES_NACIONAL_RATES = [
  { max: 180000, rate: 0.06, deduction: 0 },
  { max: 360000, rate: 0.112, deduction: 9360 },
  { max: 720000, rate: 0.135, deduction: 17640 },
  { max: 1800000, rate: 0.16, deduction: 35640 },
  { max: 3600000, rate: 0.21, deduction: 125640 },
  { max: 4800000, rate: 0.33, deduction: 648000 },
];

type TaxRegime = 'simples' | 'lucro_presumido' | 'lucro_real' | 'reforma_2026';

interface EventTax {
  eventId: string;
  eventName: string;
  eventDate: string;
  clientName: string;
  totalValue: number;
  paymentAmount: number;
  remainingAmount: number;
  isPaid: boolean;
  isRemainingPaid: boolean;
  paymentType: string | null;
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

export const EventTaxReportModal = ({ open, onOpenChange }: EventTaxReportModalProps) => {
  const { formatValue } = useValueVisibility();
  const { logoUrl } = useLogo();
  const { settings: companySettings } = useCompanySettings();
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [taxRegime, setTaxRegime] = useState<TaxRegime>('lucro_presumido');
  const [issRate, setIssRate] = useState<string>('0.05');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedEventDetail, setSelectedEventDetail] = useState<EventTax | null>(null);

  const handleViewDetail = (event: EventTax) => {
    setSelectedEventDetail(event);
    setDetailModalOpen(true);
  };

  // Fetch events with payments
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events-for-tax-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate taxes for each event
  const eventTaxes = useMemo(() => {
    const issRateNum = parseFloat(issRate);
    
    return events.map(event => {
      const totalValue = (event.payment_amount || 0) + (event.remaining_payment_amount || 0);
      const paymentAmount = event.payment_amount || 0;
      const remainingAmount = event.remaining_payment_amount || 0;
      
      const taxes = {
        ISS: 0,
        CBS: 0,
        IBS: 0,
        IRPJ: 0,
        CSLL: 0,
        PIS_COFINS: 0,
        totalTax: 0,
        effectiveRate: 0,
      };

      if (totalValue <= 0) {
        return {
          eventId: event.id,
          eventName: event.name,
          eventDate: event.event_date,
          clientName: event.client_name || 'Cliente não informado',
          totalValue,
          paymentAmount,
          remainingAmount,
          isPaid: event.is_paid || false,
          isRemainingPaid: event.is_remaining_paid || false,
          paymentType: event.payment_type || null,
          taxes
        };
      }

      switch (taxRegime) {
        case 'simples':
          // Simples Nacional - simplified tax
          // Using Anexo III for services
          const simplesRate = SIMPLES_NACIONAL_RATES.find(r => totalValue * 12 <= r.max) || SIMPLES_NACIONAL_RATES[5];
          const effectiveSimplesRate = ((totalValue * 12 * simplesRate.rate) - simplesRate.deduction) / (totalValue * 12);
          taxes.totalTax = totalValue * Math.max(effectiveSimplesRate, 0.06);
          taxes.effectiveRate = Math.max(effectiveSimplesRate, 0.06);
          break;

        case 'lucro_presumido':
          // Lucro Presumido - Presumed Profit
          // Services: 32% presumed profit margin
          const presumedProfit = totalValue * 0.32;
          taxes.ISS = totalValue * issRateNum;
          taxes.PIS_COFINS = totalValue * 0.0365; // 3.65% (PIS 0.65% + COFINS 3%)
          taxes.IRPJ = presumedProfit * INCOME_TAX_RATES.IRPJ;
          if (presumedProfit > 20000) {
            taxes.IRPJ += (presumedProfit - 20000) * INCOME_TAX_RATES.IRPJ_adicional;
          }
          taxes.CSLL = presumedProfit * INCOME_TAX_RATES.CSLL;
          taxes.totalTax = taxes.ISS + taxes.PIS_COFINS + taxes.IRPJ + taxes.CSLL;
          taxes.effectiveRate = taxes.totalTax / totalValue;
          break;

        case 'lucro_real':
          // Lucro Real - Real Profit
          // Assuming 20% profit margin for calculation
          const realProfit = totalValue * 0.20;
          taxes.ISS = totalValue * issRateNum;
          taxes.PIS_COFINS = totalValue * 0.0925; // 9.25% non-cumulative
          taxes.IRPJ = realProfit * INCOME_TAX_RATES.IRPJ;
          if (realProfit > 20000) {
            taxes.IRPJ += (realProfit - 20000) * INCOME_TAX_RATES.IRPJ_adicional;
          }
          taxes.CSLL = realProfit * INCOME_TAX_RATES.CSLL;
          taxes.totalTax = taxes.ISS + taxes.PIS_COFINS + taxes.IRPJ + taxes.CSLL;
          taxes.effectiveRate = taxes.totalTax / totalValue;
          break;

        case 'reforma_2026':
          // New Tax Reform (2026 test phase)
          taxes.CBS = totalValue * TAX_RATES_2026.CBS;
          taxes.IBS = totalValue * TAX_RATES_2026.IBS;
          // IRPJ and CSLL still apply (not affected by reform)
          const presumedProfit2026 = totalValue * 0.32;
          taxes.IRPJ = presumedProfit2026 * INCOME_TAX_RATES.IRPJ;
          if (presumedProfit2026 > 20000) {
            taxes.IRPJ += (presumedProfit2026 - 20000) * INCOME_TAX_RATES.IRPJ_adicional;
          }
          taxes.CSLL = presumedProfit2026 * INCOME_TAX_RATES.CSLL;
          taxes.totalTax = taxes.CBS + taxes.IBS + taxes.IRPJ + taxes.CSLL;
          taxes.effectiveRate = taxes.totalTax / totalValue;
          break;
      }

      return {
        eventId: event.id,
        eventName: event.name,
        eventDate: event.event_date,
        clientName: event.client_name || 'Cliente não informado',
        totalValue,
        paymentAmount,
        remainingAmount,
        isPaid: event.is_paid || false,
        isRemainingPaid: event.is_remaining_paid || false,
        paymentType: event.payment_type || null,
        taxes
      };
    });
  }, [events, taxRegime, issRate]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (selectedEvent === 'all') {
      return eventTaxes.filter(e => e.totalValue > 0);
    }
    return eventTaxes.filter(e => e.eventId === selectedEvent);
  }, [eventTaxes, selectedEvent]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredEvents.reduce((acc, event) => ({
      totalValue: acc.totalValue + event.totalValue,
      ISS: acc.ISS + event.taxes.ISS,
      CBS: acc.CBS + event.taxes.CBS,
      IBS: acc.IBS + event.taxes.IBS,
      IRPJ: acc.IRPJ + event.taxes.IRPJ,
      CSLL: acc.CSLL + event.taxes.CSLL,
      PIS_COFINS: acc.PIS_COFINS + event.taxes.PIS_COFINS,
      totalTax: acc.totalTax + event.taxes.totalTax,
    }), {
      totalValue: 0,
      ISS: 0,
      CBS: 0,
      IBS: 0,
      IRPJ: 0,
      CSLL: 0,
      PIS_COFINS: 0,
      totalTax: 0,
    });
  }, [filteredEvents]);

  const exportToCSV = () => {
    const headers = [
      'Evento',
      'Cliente',
      'Data',
      'Valor Total',
      'ISS',
      'CBS',
      'IBS',
      'PIS/COFINS',
      'IRPJ',
      'CSLL',
      'Total Impostos',
      'Alíquota Efetiva'
    ];
    
    const rows = filteredEvents.map(e => [
      e.eventName,
      e.clientName,
      e.eventDate,
      e.totalValue.toFixed(2).replace('.', ','),
      e.taxes.ISS.toFixed(2).replace('.', ','),
      e.taxes.CBS.toFixed(2).replace('.', ','),
      e.taxes.IBS.toFixed(2).replace('.', ','),
      e.taxes.PIS_COFINS.toFixed(2).replace('.', ','),
      e.taxes.IRPJ.toFixed(2).replace('.', ','),
      e.taxes.CSLL.toFixed(2).replace('.', ','),
      e.taxes.totalTax.toFixed(2).replace('.', ','),
      (e.taxes.effectiveRate * 100).toFixed(2).replace('.', ',') + '%'
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-impostos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getRegimeName = (regime: TaxRegime) => {
    switch (regime) {
      case 'simples': return 'Simples Nacional';
      case 'lucro_presumido': return 'Lucro Presumido';
      case 'lucro_real': return 'Lucro Real';
      case 'reforma_2026': return 'Reforma 2026 (Teste)';
      default: return regime;
    }
  };

  const generatePDF = async () => {
    const pdf = new jsPDF({ compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 15;

    // Header with logo
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = logoUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const logoData = canvas.toDataURL('image/png');
        pdf.addImage(logoData, 'PNG', 14, yPosition, 25, 25);
        yPosition += 8;
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
      }
    }

    // Company header
    const companyName = companySettings?.company_name || 'Empresa';
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(companyName, logoUrl ? 45 : 14, yPosition);
    yPosition += 6;

    if (companySettings?.address) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text(companySettings.address, logoUrl ? 45 : 14, yPosition);
      yPosition += 4;
    }

    if (companySettings?.phone || companySettings?.email) {
      pdf.setFontSize(8);
      const contactInfo = [companySettings.phone, companySettings.email].filter(Boolean).join(' | ');
      pdf.text(contactInfo, logoUrl ? 45 : 14, yPosition);
      yPosition += 4;
    }

    yPosition = logoUrl ? Math.max(yPosition, 45) : yPosition + 5;

    // Title
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO DE IMPOSTOS POR EVENTO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Report info
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Data de Geração: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, yPosition);
    pdf.text(`Regime Tributário: ${getRegimeName(taxRegime)}`, pageWidth - 14, yPosition, { align: 'right' });
    yPosition += 5;

    if (taxRegime !== 'simples' && taxRegime !== 'reforma_2026') {
      pdf.text(`Alíquota ISS: ${(parseFloat(issRate) * 100).toFixed(0)}%`, pageWidth - 14, yPosition, { align: 'right' });
      yPosition += 5;
    }

    // Line separator
    pdf.setDrawColor(200, 200, 200);
    pdf.line(14, yPosition, pageWidth - 14, yPosition);
    yPosition += 8;

    // Summary section
    pdf.setFillColor(240, 240, 240);
    pdf.rect(14, yPosition - 3, pageWidth - 28, 22, 'F');
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RESUMO FINANCEIRO', 20, yPosition + 3);
    yPosition += 10;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    const col1X = 20;
    const col2X = pageWidth / 4;
    const col3X = pageWidth / 2;
    const col4X = (3 * pageWidth) / 4;

    pdf.text('Faturamento:', col1X, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.text(formatCurrency(totals.totalValue), col1X, yPosition + 4);
    
    pdf.setFont('helvetica', 'normal');
    pdf.text('Total Impostos:', col2X, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(220, 53, 69);
    pdf.text(formatCurrency(totals.totalTax), col2X, yPosition + 4);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Alíquota Efetiva:', col3X, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 140, 0);
    pdf.text(totals.totalValue > 0 ? formatPercent(totals.totalTax / totals.totalValue) : '0%', col3X, yPosition + 4);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Líquido:', col4X, yPosition);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(40, 167, 69);
    pdf.text(formatCurrency(totals.totalValue - totals.totalTax), col4X, yPosition + 4);
    
    pdf.setTextColor(0, 0, 0);
    yPosition += 15;

    // Tax breakdown
    if (totals.totalValue > 0) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('COMPOSIÇÃO DOS IMPOSTOS', 14, yPosition);
      yPosition += 5;

      const taxBreakdownData: string[][] = [];
      
      if (taxRegime === 'simples') {
        taxBreakdownData.push(['DAS (Simples Nacional)', formatCurrency(totals.totalTax)]);
      } else if (taxRegime === 'reforma_2026') {
        taxBreakdownData.push(
          ['CBS (Federal)', formatCurrency(totals.CBS)],
          ['IBS (Est/Mun)', formatCurrency(totals.IBS)],
          ['IRPJ', formatCurrency(totals.IRPJ)],
          ['CSLL', formatCurrency(totals.CSLL)]
        );
      } else {
        taxBreakdownData.push(
          ['ISS', formatCurrency(totals.ISS)],
          ['PIS/COFINS', formatCurrency(totals.PIS_COFINS)],
          ['IRPJ', formatCurrency(totals.IRPJ)],
          ['CSLL', formatCurrency(totals.CSLL)]
        );
      }

      autoTable(pdf, {
        startY: yPosition,
        head: [['Imposto', 'Valor']],
        body: taxBreakdownData,
        theme: 'striped',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
        tableWidth: 80,
      });

      yPosition = (pdf as any).lastAutoTable.finalY + 10;
    }

    // Events table
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DETALHAMENTO POR EVENTO', 14, yPosition);
    yPosition += 5;

    const eventsTableData = filteredEvents.map(e => {
      let status = 'Pendente';
      if ((e.isPaid && e.paymentType === 'total') || (e.isPaid && e.isRemainingPaid)) {
        status = 'Pago Total';
      } else if (e.isPaid && !e.isRemainingPaid && e.paymentType !== 'total') {
        status = 'Pago Parcial';
      }

      return [
        e.eventName,
        e.clientName,
        format(new Date(e.eventDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
        formatCurrency(e.totalValue),
        formatCurrency(e.taxes.totalTax),
        formatPercent(e.taxes.effectiveRate),
        formatCurrency(e.totalValue - e.taxes.totalTax),
        status
      ];
    });

    autoTable(pdf, {
      startY: yPosition,
      head: [['Evento', 'Cliente', 'Data', 'Valor', 'Impostos', 'Alíquota', 'Líquido', 'Status']],
      body: eventsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 28 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
        7: { cellWidth: 20 }
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 4) {
            data.cell.styles.textColor = [220, 53, 69];
          } else if (data.column.index === 6) {
            data.cell.styles.textColor = [40, 167, 69];
          } else if (data.column.index === 7) {
            const status = data.cell.raw as string;
            if (status === 'Pago Total') {
              data.cell.styles.textColor = [40, 167, 69];
            } else if (status === 'Pago Parcial') {
              data.cell.styles.textColor = [255, 140, 0];
            } else {
              data.cell.styles.textColor = [108, 117, 125];
            }
          }
        }
      }
    });

    yPosition = (pdf as any).lastAutoTable.finalY + 10;

    // Footer disclaimer
    if (yPosition > pageHeight - 30) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFillColor(255, 243, 205);
    pdf.rect(14, yPosition - 3, pageWidth - 28, 18, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(133, 100, 4);
    pdf.text('Aviso Importante', 20, yPosition + 2);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    const disclaimerText = 'Este relatório é uma estimativa para fins de planejamento. Os valores reais podem variar conforme benefícios fiscais, créditos, deduções aplicáveis e interpretações específicas da legislação. Consulte sempre um contador para apuração oficial dos tributos.';
    const splitText = pdf.splitTextToSize(disclaimerText, pageWidth - 40);
    pdf.text(splitText, 20, yPosition + 7);

    pdf.setTextColor(0, 0, 0);

    // Page footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      pdf.text(
        format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        pageWidth - 14,
        pageHeight - 10,
        { align: 'right' }
      );
    }

    pdf.save(`relatorio-impostos-eventos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-6 w-6 text-primary" />
            Relatório de Impostos por Evento
          </DialogTitle>
          <DialogDescription>
            Cálculo de impostos baseado na nova Reforma Tributária Brasileira (EC 132/2023)
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Info Card about Tax Reform */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm space-y-2">
                    <p className="font-medium">Sobre a Reforma Tributária (EC 132/2023)</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-1">
                      <li><strong>2026:</strong> Fase de teste - CBS 0,9% + IBS 0,1% (compensável com PIS/Cofins)</li>
                      <li><strong>2027:</strong> Extinção do PIS/Cofins, CBS entra em vigor plena</li>
                      <li><strong>2029-2032:</strong> Extinção gradual do ISS e ICMS</li>
                      <li><strong>2033:</strong> Sistema novo (IVA Dual) totalmente implementado (~26,5%)</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os eventos</SelectItem>
                    {events.filter(e => (e.payment_amount || 0) + (e.remaining_payment_amount || 0) > 0).map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Regime Tributário</Label>
                <Select value={taxRegime} onValueChange={(v) => setTaxRegime(v as TaxRegime)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simples">Simples Nacional</SelectItem>
                    <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="lucro_real">Lucro Real</SelectItem>
                    <SelectItem value="reforma_2026">Reforma 2026 (Teste)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {taxRegime !== 'simples' && taxRegime !== 'reforma_2026' && (
                <div className="space-y-2">
                  <Label>Alíquota ISS</Label>
                  <Select value={issRate} onValueChange={setIssRate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.02">2%</SelectItem>
                      <SelectItem value="0.03">3%</SelectItem>
                      <SelectItem value="0.04">4%</SelectItem>
                      <SelectItem value="0.05">5%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Faturamento</p>
                  </div>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {formatValue(totals.totalValue)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Total Impostos</p>
                  </div>
                  <p className="text-lg font-bold text-destructive mt-1">
                    {formatValue(totals.totalTax)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Alíquota Efetiva</p>
                  </div>
                  <p className="text-lg font-bold text-orange-600 mt-1">
                    {totals.totalValue > 0 ? formatPercent(totals.totalTax / totals.totalValue) : '0%'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Líquido</p>
                  </div>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {formatValue(totals.totalValue - totals.totalTax)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tax Breakdown */}
            {totals.totalValue > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Composição dos Impostos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-6 gap-4 text-sm">
                    {taxRegime !== 'reforma_2026' && taxRegime !== 'simples' && (
                      <>
                        <div>
                          <p className="text-muted-foreground">ISS</p>
                          <p className="font-medium">{formatCurrency(totals.ISS)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">PIS/COFINS</p>
                          <p className="font-medium">{formatCurrency(totals.PIS_COFINS)}</p>
                        </div>
                      </>
                    )}
                    {taxRegime === 'reforma_2026' && (
                      <>
                        <div>
                          <p className="text-muted-foreground">CBS (Federal)</p>
                          <p className="font-medium">{formatCurrency(totals.CBS)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">IBS (Est/Mun)</p>
                          <p className="font-medium">{formatCurrency(totals.IBS)}</p>
                        </div>
                      </>
                    )}
                    {taxRegime !== 'simples' && (
                      <>
                        <div>
                          <p className="text-muted-foreground">IRPJ</p>
                          <p className="font-medium">{formatCurrency(totals.IRPJ)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">CSLL</p>
                          <p className="font-medium">{formatCurrency(totals.CSLL)}</p>
                        </div>
                      </>
                    )}
                    {taxRegime === 'simples' && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">DAS (Simples Nacional)</p>
                        <p className="font-medium">{formatCurrency(totals.totalTax)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Events Table */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-sm">Detalhamento por Evento</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={generatePDF} className="gap-2">
                      <FileDown className="h-4 w-4" />
                      PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportToCSV} className="gap-2">
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando eventos...
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum evento com pagamentos encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Evento</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Impostos</TableHead>
                          <TableHead className="text-right">Alíquota</TableHead>
                          <TableHead className="text-right">Líquido</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEvents.map(event => (
                          <TableRow key={event.eventId}>
                            <TableCell className="font-medium">{event.eventName}</TableCell>
                            <TableCell>{event.clientName}</TableCell>
                            <TableCell>
                              {format(new Date(event.eventDate + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(event.totalValue)}
                            </TableCell>
                            <TableCell className="text-right text-destructive">
                              {formatCurrency(event.taxes.totalTax)}
                            </TableCell>
                            <TableCell className="text-right text-orange-600">
                              {formatPercent(event.taxes.effectiveRate)}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(event.totalValue - event.taxes.totalTax)}
                            </TableCell>
                            <TableCell>
                              {/* Pago Total: se payment_type é 'total' e is_paid, OU se pagou entrada + restante */}
                              {(event.isPaid && event.paymentType === 'total') || (event.isPaid && event.isRemainingPaid) ? (
                                <Badge variant="default">Pago Total</Badge>
                              ) : event.isPaid && !event.isRemainingPaid && event.paymentType !== 'total' ? (
                                <Badge variant="secondary">Pago Parcial</Badge>
                              ) : (
                                <Badge variant="outline">Pendente</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewDetail(event)}
                                className="gap-1"
                              >
                                <Eye className="h-4 w-4" />
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Disclaimer */}
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Aviso Importante</p>
                    <p>
                      Este relatório é uma <strong>estimativa</strong> para fins de planejamento. 
                      Os valores reais podem variar conforme benefícios fiscais, créditos, 
                      deduções aplicáveis e interpretações específicas da legislação. 
                      Consulte sempre um contador para apuração oficial dos tributos.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>

      {/* Event Detail Modal */}
      {selectedEventDetail && (
        <EventTaxDetailModal
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          eventId={selectedEventDetail.eventId}
          eventName={selectedEventDetail.eventName}
          eventDate={selectedEventDetail.eventDate}
          clientName={selectedEventDetail.clientName}
          totalValue={selectedEventDetail.totalValue}
          taxes={selectedEventDetail.taxes}
          taxRegime={taxRegime}
        />
      )}
    </Dialog>
  );
};
