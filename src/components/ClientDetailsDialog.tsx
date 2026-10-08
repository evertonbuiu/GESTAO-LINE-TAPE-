import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Plus, Trash2, CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeLineTapeBrand } from '@/lib/brand';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ClientEvent {
  id: string;
  name: string;
  event_date: string;
  total_budget: number;
  payment_amount: number;
  is_paid: boolean;
  is_remaining_paid: boolean;
  payment_type: string;
  status: string;
}

interface ClientAdvance {
  id: string;
  amount: number;
  advance_date: string;
  notes: string;
  created_at: string;
}

interface ClientCustomItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  fabrication_date: string;
  notes: string;
  created_at: string;
}

interface ClientDetailsDialogProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to format date string without timezone issues
const formatDateString = (dateString: string): string => {
  const [year, month, day] = dateString.split('-');
  return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), 'dd/MM/yyyy', { locale: ptBR });
};

export const ClientDetailsDialog = ({ clientId, clientName, open, onOpenChange }: ClientDetailsDialogProps) => {
  const { toast } = useToast();
  const { logoUrl } = useLogo();
  const [events, setEvents] = useState<ClientEvent[]>([]);
  const [advances, setAdvances] = useState<ClientAdvance[]>([]);
  const [customItems, setCustomItems] = useState<ClientCustomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    amount: '',
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [newCustomItem, setNewCustomItem] = useState({
    description: '',
    quantity: '1',
    unit_price: '',
    fabrication_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'todos' | 'pendentes' | 'pagos'>('todos');

  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (open && clientId) {
      fetchClientData();
      fetchCompanySettings();
    }
  }, [open, clientId]);

  const fetchCompanySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();

      if (!error && data) {
        setCompanySettings(data);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
    }
  };

  const fetchClientData = async () => {
    setLoading(true);
    try {
      // Buscar eventos do cliente
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, name, event_date, total_budget, payment_amount, is_paid, is_remaining_paid, payment_type, status')
        .eq('client_name', clientName)
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Buscar adiantamentos do cliente
      const { data: advancesData, error: advancesError } = await supabase
        .from('client_advances')
        .select('*')
        .eq('client_id', clientId)
        .order('advance_date', { ascending: false });

      if (!advancesError) {
        setAdvances(advancesData || []);
      }

      // Buscar peças personalizadas do cliente
      const { data: customItemsData, error: customItemsError } = await supabase
        .from('client_custom_items')
        .select('*')
        .eq('client_id', clientId)
        .order('fabrication_date', { ascending: false });

      if (!customItemsError) {
        setCustomItems(customItemsData || []);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do cliente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addAdvance = async () => {
    if (!newAdvance.amount || parseFloat(newAdvance.amount) <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor válido para o adiantamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('client_advances')
        .insert({
          client_id: clientId,
          amount: parseFloat(newAdvance.amount),
          advance_date: newAdvance.advance_date,
          notes: newAdvance.notes || null
        });

      if (error) throw error;

      toast({
        title: "Adiantamento registrado",
        description: "O adiantamento foi registrado com sucesso.",
      });

      setNewAdvance({
        amount: '',
        advance_date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      });
      setShowAdvanceForm(false);
      fetchClientData();
    } catch (error) {
      console.error('Error adding advance:', error);
      toast({
        title: "Erro ao registrar adiantamento",
        description: "Não foi possível registrar o adiantamento.",
        variant: "destructive"
      });
    }
  };

  const deleteAdvance = async (advanceId: string) => {
    try {
      const { error } = await supabase
        .from('client_advances')
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast({
        title: "Adiantamento removido",
        description: "O adiantamento foi removido com sucesso.",
      });

      fetchClientData();
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast({
        title: "Erro ao remover adiantamento",
        description: "Não foi possível remover o adiantamento.",
        variant: "destructive"
      });
    }
  };

  const addCustomItem = async () => {
    if (!newCustomItem.description || !newCustomItem.unit_price || parseFloat(newCustomItem.unit_price) <= 0) {
      toast({
        title: "Dados inválidos",
        description: "Preencha a descrição e o valor unitário.",
        variant: "destructive"
      });
      return;
    }

    try {
      const quantity = parseInt(newCustomItem.quantity) || 1;
      const unitPrice = parseFloat(newCustomItem.unit_price);
      const totalPrice = quantity * unitPrice;

      const { error } = await supabase
        .from('client_custom_items')
        .insert({
          client_id: clientId,
          description: newCustomItem.description,
          quantity: quantity,
          unit_price: unitPrice,
          total_price: totalPrice,
          fabrication_date: newCustomItem.fabrication_date,
          notes: newCustomItem.notes || null
        });

      if (error) throw error;

      toast({
        title: "Peça adicionada",
        description: "A peça foi adicionada com sucesso.",
      });

      setNewCustomItem({
        description: '',
        quantity: '1',
        unit_price: '',
        fabrication_date: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      });
      setShowCustomItemForm(false);
      fetchClientData();
    } catch (error) {
      console.error('Error adding custom item:', error);
      toast({
        title: "Erro ao adicionar peça",
        description: "Não foi possível adicionar a peça.",
        variant: "destructive"
      });
    }
  };

  const deleteCustomItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('client_custom_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Peça removida",
        description: "A peça foi removida com sucesso.",
      });

      fetchClientData();
    } catch (error) {
      console.error('Error deleting custom item:', error);
      toast({
        title: "Erro ao remover peça",
        description: "Não foi possível remover a peça.",
        variant: "destructive"
      });
    }
  };

  const generatePDF = async () => {
    try {
      const doc = new jsPDF({
        compress: true
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      let yPosition = 20;
      const leftMargin = 14;
      const rightMargin = pageWidth - 14;

      // Número da página no canto superior direito
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Página 1', rightMargin, yPosition, { align: 'right' } as any);

      // Logo à esquerda
      let logoEndY = yPosition;
      if (logoUrl) {
        try {
          const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = logoUrl;
          });
          
          const logoSize = 35;
          doc.addImage(logoImg, 'PNG', leftMargin, yPosition, logoSize, logoSize);
          logoEndY = yPosition + logoSize;
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }

      // Informações da empresa à direita do logo
      const companyInfoX = 60;
      const companyName = normalizeLineTapeBrand(companySettings?.company_name) || 'LINE TAPE ILUMINAÇÃO E LOCAÇÃO LTDA';
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName.toUpperCase(), companyInfoX, yPosition + 5);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let companyInfoY = yPosition + 12;
      
      if (companySettings?.cnpj) {
        doc.text(`CNPJ: ${companySettings.cnpj}`, companyInfoX, companyInfoY);
        companyInfoY += 5;
      }
      if (companySettings?.address) {
        doc.text(companySettings.address, companyInfoX, companyInfoY);
        companyInfoY += 5;
      }
      
      // Telefone e email na mesma linha
      const contactInfo = [];
      if (companySettings?.phone) contactInfo.push(companySettings.phone);
      if (companySettings?.email) contactInfo.push(companySettings.email);
      if (contactInfo.length > 0) {
        doc.text(contactInfo.join(' | '), companyInfoX, companyInfoY);
        companyInfoY += 5;
      }

      // Posição após o cabeçalho (usar o maior entre logo e info)
      yPosition = Math.max(logoEndY, companyInfoY) + 10;

      // Linha divisória
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(leftMargin, yPosition, rightMargin, yPosition);
      yPosition += 10;

      // Título do Relatório
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Relatório de Cliente - ${clientName.toUpperCase()}`, leftMargin, yPosition);
      yPosition += 7;

      // Período
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(new Date(), 'MMMM/yyyy', { locale: ptBR })}`, leftMargin, yPosition);
      yPosition += 10;

      // Eventos
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Eventos', leftMargin, yPosition);
      yPosition += 5;

      if (filteredEvents.length > 0) {
        const eventRows = filteredEvents.map(event => {
          const totalBudget = event.total_budget || 0;
          const paymentAmount = event.payment_amount || 0;
          const pendingAmount = totalBudget - paymentAmount;
          const status = event.is_paid ? 'Pago' : paymentAmount > 0 ? 'Parcial' : 'Não Pago';
          
          return [
            formatDateString(event.event_date),
            event.name,
            `R$ ${totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            `R$ ${pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            status
          ];
        });
        
        const totalEventsPDF = filteredEvents.reduce((sum, e) => sum + (e.total_budget || 0), 0);
        const totalPaidPDF = filteredEvents.reduce((sum, e) => sum + (e.payment_amount || 0), 0);
        const totalPendingPDF = totalEventsPDF - totalPaidPDF;

        autoTable(doc, {
          startY: yPosition,
          head: [['Data', 'Evento', 'Valor Total', 'Pago', 'Pendente', 'Status']],
          body: eventRows,
          foot: [['TOTAL', '', `R$ ${totalEventsPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${totalPaidPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, `R$ ${totalPendingPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']],
          theme: 'striped',
          headStyles: { 
            fillColor: [66, 103, 178], // Azul similar ao exemplo
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          footStyles: {
            fillColor: [66, 103, 178],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          styles: { 
            fontSize: 9,
            cellPadding: 3
          },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum evento encontrado.', leftMargin, yPosition + 5);
        yPosition += 15;
      }

      // Adiantamentos
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Adiantamentos', leftMargin, yPosition);
      yPosition += 5;

      if (filteredAdvances.length > 0) {
        const advanceRows = filteredAdvances.map(adv => [
          formatDateString(adv.advance_date),
          `R$ ${adv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          adv.notes || '-'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Data', 'Valor', 'Observações']],
          body: advanceRows,
          foot: [['TOTAL ADIANTAMENTOS', `R$ ${filteredAdvances.reduce((sum, a) => sum + a.amount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']],
          theme: 'striped',
          headStyles: { 
            fillColor: [217, 83, 79], // Vermelho/coral similar ao exemplo
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          footStyles: {
            fillColor: [217, 83, 79],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          styles: { 
            fontSize: 9,
            cellPadding: 3
          },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhum adiantamento registrado.', leftMargin, yPosition + 5);
        yPosition += 15;
      }

      // Peças Fabricadas
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Peças Fabricadas', leftMargin, yPosition);
      yPosition += 5;

      if (filteredCustomItems.length > 0) {
        const itemRows = filteredCustomItems.map(item => [
          formatDateString(item.fabrication_date),
          item.description,
          item.quantity.toString(),
          `R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          `R$ ${item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          item.notes || '-'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Data', 'Descrição', 'Qtd', 'Valor Unit.', 'Valor Total', 'Obs.']],
          body: itemRows,
          foot: [['TOTAL PEÇAS', '', '', '', `R$ ${filteredCustomItems.reduce((sum, i) => sum + i.total_price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']],
          theme: 'striped',
          headStyles: { 
            fillColor: [26, 188, 156], // Verde/turquesa
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          footStyles: {
            fillColor: [26, 188, 156],
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 10
          },
          styles: { 
            fontSize: 9,
            cellPadding: 3
          },
          alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text('Nenhuma peça fabricada no período selecionado.', leftMargin, yPosition + 5);
        yPosition += 15;
      }

      // Resumo Financeiro - somar apenas valores pendentes
      const totalEventsPendingPDF = filteredEvents.reduce((sum, event) => {
        const totalBudget = event.total_budget || 0;
        const paymentAmount = event.payment_amount || 0;
        return sum + (totalBudget - paymentAmount);
      }, 0);
      const totalPaidPDF = filteredEvents.reduce((sum, event) => sum + (event.payment_amount || 0), 0);
      const totalAdvancesPDF = filteredAdvances.reduce((sum, adv) => sum + adv.amount, 0);
      const totalCustomItemsPDF = filteredCustomItems.reduce((sum, item) => sum + item.total_price, 0);
      const balancePDF = totalEventsPendingPDF + totalCustomItemsPDF - totalAdvancesPDF;

      yPosition += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(leftMargin, yPosition, rightMargin, yPosition);
      yPosition += 10;

      // Resumo Financeiro com barras coloridas
      const boxHeight = 8;
      const textYOffset = 5.5;
      
      // Total em Eventos (Pendente) - Roxo
      doc.setFillColor(155, 89, 182); // Roxo
      doc.rect(leftMargin, yPosition, rightMargin - leftMargin, boxHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Total em Eventos (Pendente):', leftMargin + 2, yPosition + textYOffset);
      doc.text(`R$ ${totalEventsPendingPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightMargin - 2, yPosition + textYOffset, { align: 'right' } as any);
      yPosition += boxHeight + 2;

      // Total em Peças - Azul claro
      doc.setFillColor(66, 103, 178);
      doc.rect(leftMargin, yPosition, rightMargin - leftMargin, boxHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Total em Peças:', leftMargin + 2, yPosition + textYOffset);
      doc.text(`R$ ${totalCustomItemsPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightMargin - 2, yPosition + textYOffset, { align: 'right' } as any);
      yPosition += boxHeight + 2;

      // Total em Adiantamentos - Vermelho/coral
      doc.setFillColor(217, 83, 79);
      doc.rect(leftMargin, yPosition, rightMargin - leftMargin, boxHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('Total em Adiantamentos:', leftMargin + 2, yPosition + textYOffset);
      doc.text(`R$ ${totalAdvancesPDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightMargin - 2, yPosition + textYOffset, { align: 'right' } as any);
      yPosition += boxHeight + 2;

      // Total Líquido a Receber - Cinza claro
      doc.setFillColor(189, 195, 199);
      doc.rect(leftMargin, yPosition, rightMargin - leftMargin, boxHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Total Líquido a Receber:', leftMargin + 2, yPosition + textYOffset);
      doc.text(`R$ ${balancePDF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, rightMargin - 2, yPosition + textYOffset, { align: 'right' } as any);

      // Rodapé com data de emissão
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const emissionText = `Emitido em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
      doc.text(emissionText, pageWidth / 2, pageHeight - 10, { align: 'center' } as any);

      // Salvar PDF
      const fileName = `relatorio_${clientName.replace(/\s+/g, '_')}_${format(new Date(), 'dd-MM-yyyy')}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF gerado",
        description: "O relatório foi gerado com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Filtrar eventos e adiantamentos por data
  const filteredEvents = useMemo(() => {
    let result = events;
    
    // Filtro por data
    if (startDate || endDate) {
      result = result.filter(event => {
        const eventDate = new Date(event.event_date);
        if (startDate && eventDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (eventDate > endOfDay) return false;
        }
        return true;
      });
    }
    
    // Filtro por status de pagamento
    if (paymentStatusFilter !== 'todos') {
      result = result.filter(event => {
        const isPaid = event.is_paid;
        const isRemainingPaid = event.is_remaining_paid;
        const paymentType = event.payment_type;
        
        if (paymentStatusFilter === 'pendentes') {
          // Pendentes: não pagos OU pagos apenas entrada (restante não pago)
          if (!isPaid) return true;
          if (paymentType === 'entrada' && !isRemainingPaid) return true;
          return false;
        } else if (paymentStatusFilter === 'pagos') {
          // Pagos: totalmente pagos (pagamento total OU entrada + restante pago)
          if (!isPaid) return false;
          if (paymentType === 'entrada' && !isRemainingPaid) return false;
          return true;
        }
        return true;
      });
    }
    
    return result;
  }, [events, startDate, endDate, paymentStatusFilter]);

  const filteredAdvances = useMemo(() => {
    if (!startDate && !endDate) return advances;
    
    return advances.filter(advance => {
      const [year, month, day] = advance.advance_date.split('-').map(Number);
      const advanceDate = new Date(year, month - 1, day);
      if (startDate && advanceDate < startDate) return false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (advanceDate > endOfDay) return false;
      }
      return true;
    });
  }, [advances, startDate, endDate]);

  const filteredCustomItems = useMemo(() => {
    if (!startDate && !endDate) return customItems;
    
    return customItems.filter(item => {
      const [year, month, day] = item.fabrication_date.split('-').map(Number);
      const itemDate = new Date(year, month - 1, day);
      if (startDate && itemDate < startDate) return false;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        if (itemDate > endOfDay) return false;
      }
      return true;
    });
  }, [customItems, startDate, endDate]);

  const totalEvents = filteredEvents.reduce((sum, event) => sum + (event.total_budget || 0), 0);
  const totalAdvances = filteredAdvances.reduce((sum, adv) => sum + adv.amount, 0);
  const totalCustomItems = filteredCustomItems.reduce((sum, item) => sum + item.total_price, 0);
  
  // Calcular valores pendentes (não pagos + parcialmente pagos)
  const pendingValues = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const totalBudget = event.total_budget || 0;
      const paymentAmount = event.payment_amount || 0;
      const isPaid = event.is_paid;
      
      if (!isPaid) {
        const pending = totalBudget - paymentAmount;
        return acc + pending;
      }
      return acc;
    }, 0);
  }, [filteredEvents]);
  
  const balance = totalEvents + totalCustomItems - totalAdvances;

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setPaymentStatusFilter('todos');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Detalhes do Cliente: {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros de Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtrar por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="pointer-events-auto"
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="pointer-events-auto"
                        locale={ptBR}
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label>Status de Pagamento</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={paymentStatusFilter === 'todos' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentStatusFilter('todos')}
                      className="flex-1"
                    >
                      Todos
                    </Button>
                    <Button
                      variant={paymentStatusFilter === 'pendentes' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentStatusFilter('pendentes')}
                      className="flex-1"
                    >
                      Pendentes
                    </Button>
                    <Button
                      variant={paymentStatusFilter === 'pagos' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentStatusFilter('pagos')}
                      className="flex-1"
                    >
                      Pagos
                    </Button>
                  </div>
                </div>
                {(startDate || endDate || paymentStatusFilter !== 'todos') && (
                  <Button
                    variant="ghost"
                    onClick={clearFilters}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Resumo Financeiro */}
          <div className="grid grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total em Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  R$ {totalEvents.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total em Peças</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {totalCustomItems.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Valores Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">
                  R$ {pendingValues.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Total Adiantamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalAdvances.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Saldo</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Eventos */}
          <Card>
            <CardHeader>
              <CardTitle>Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Carregando...</p>
              ) : filteredEvents.length === 0 ? (
                <p className="text-muted-foreground">Nenhum evento encontrado no período selecionado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead>Pendente</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => {
                      const totalBudget = event.total_budget || 0;
                      const paymentAmount = event.payment_amount || 0;
                      const pendingAmount = totalBudget - paymentAmount;
                      
                      // Determinar status de pagamento
                      const isFullyPaid = event.is_paid && (event.payment_type !== 'entrada' || event.is_remaining_paid);
                      const isPartiallyPaid = (event.is_paid && event.payment_type === 'entrada' && !event.is_remaining_paid) || (!event.is_paid && paymentAmount > 0);
                      
                      return (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.name}</TableCell>
                          <TableCell>{formatDateString(event.event_date)}</TableCell>
                          <TableCell>R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-green-600">
                            R$ {paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-orange-600 font-medium">
                            R$ {pendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              isFullyPaid ? 'bg-green-100 text-green-800' :
                              isPartiallyPaid ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {isFullyPaid ? 'Pago' : isPartiallyPaid ? 'Parcial' : 'Não Pago'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Adiantamentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Adiantamentos</CardTitle>
              <Button onClick={() => setShowAdvanceForm(!showAdvanceForm)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Adiantamento
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAdvanceForm && (
                <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="advance_amount">Valor</Label>
                      <Input
                        id="advance_amount"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={newAdvance.amount}
                        onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="advance_date">Data</Label>
                      <Input
                        id="advance_date"
                        type="date"
                        value={newAdvance.advance_date}
                        onChange={(e) => setNewAdvance({ ...newAdvance, advance_date: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="advance_notes">Observações</Label>
                    <Input
                      id="advance_notes"
                      placeholder="Observações sobre o adiantamento"
                      value={newAdvance.notes}
                      onChange={(e) => setNewAdvance({ ...newAdvance, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addAdvance}>Salvar Adiantamento</Button>
                    <Button variant="outline" onClick={() => setShowAdvanceForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {filteredAdvances.length === 0 ? (
                <p className="text-muted-foreground">Nenhum adiantamento registrado no período selecionado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAdvances.map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell>{formatDateString(advance.advance_date)}</TableCell>
                        <TableCell className="font-medium">R$ {advance.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{advance.notes || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAdvance(advance.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Peças Fabricadas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Peças Fabricadas</CardTitle>
              <Button onClick={() => setShowCustomItemForm(!showCustomItemForm)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Peça
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showCustomItemForm && (
                <div className="border rounded-lg p-4 bg-muted/50 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="item_description">Descrição da Peça *</Label>
                      <Input
                        id="item_description"
                        placeholder="Nome/descrição da peça"
                        value={newCustomItem.description}
                        onChange={(e) => setNewCustomItem({ ...newCustomItem, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="item_quantity">Quantidade</Label>
                      <Input
                        id="item_quantity"
                        type="number"
                        min="1"
                        value={newCustomItem.quantity}
                        onChange={(e) => setNewCustomItem({ ...newCustomItem, quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="item_unit_price">Valor Unitário *</Label>
                      <Input
                        id="item_unit_price"
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={newCustomItem.unit_price}
                        onChange={(e) => setNewCustomItem({ ...newCustomItem, unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="item_date">Data de Fabricação</Label>
                      <Input
                        id="item_date"
                        type="date"
                        value={newCustomItem.fabrication_date}
                        onChange={(e) => setNewCustomItem({ ...newCustomItem, fabrication_date: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Valor Total</Label>
                      <Input
                        disabled
                        value={`R$ ${((parseFloat(newCustomItem.quantity) || 0) * (parseFloat(newCustomItem.unit_price) || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="item_notes">Observações</Label>
                    <Input
                      id="item_notes"
                      placeholder="Observações sobre a peça"
                      value={newCustomItem.notes}
                      onChange={(e) => setNewCustomItem({ ...newCustomItem, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addCustomItem}>Salvar Peça</Button>
                    <Button variant="outline" onClick={() => setShowCustomItemForm(false)}>Cancelar</Button>
                  </div>
                </div>
              )}

              {filteredCustomItems.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma peça fabricada no período selecionado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Valor Unit.</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDateString(item.fabrication_date)}</TableCell>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-bold">R$ {item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{item.notes || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCustomItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Botão Gerar PDF */}
          <div className="flex justify-end">
            <Button onClick={generatePDF} size="lg">
              <FileText className="w-4 h-4 mr-2" />
              Gerar Relatório PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
