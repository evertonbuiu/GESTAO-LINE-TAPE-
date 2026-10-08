import React, { useState, useEffect, useCallback } from "react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PROVIDER_FISCAL_DEFAULTS,
  SERVICE_CODE_OPTIONS,
  serviceDescriptionWarning,
} from "@/lib/nfseFiscal";
import { cn, formatCurrency, formatCNPJ, formatCPF } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { evaluateNFSeReadiness, canEmitStatus, isResend, describeEmitError, describePreflight } from "@/lib/nfse";
import { NationalHomologationSection } from "@/components/NFSeNationalHomologation";


/** Lê o corpo detalhado retornado pela Edge Function (FunctionsHttpError). */
export async function readFunctionErrorPayload(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx) return null;
  try {
    if (typeof ctx.clone === 'function') {
      const cloned = ctx.clone();
      try {
        return await cloned.json();
      } catch {
        return await ctx.text();
      }
    }
    if (typeof (ctx as { json?: () => Promise<unknown> }).json === 'function') {
      return await (ctx as { json: () => Promise<unknown> }).json();
    }
  } catch {
    return null;
  }
  return null;
}

import { 
  FileText, 
  Plus, 
  Search, 
  Download, 
  Send, 
  Eye, 
  Settings, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle,
  RefreshCw,
  CalendarIcon,
  Building2,
  Upload,
  Shield,
  FileCheck,
  Printer,
  ExternalLink,
  AlertTriangle
} from "lucide-react";

import { PageActions } from "@/components/layout/PageHeader";
interface NFSeInvoice {
  id: string;
  invoice_number: string | null;
  rps_number: string;
  rps_series: string;
  status: string;
  issue_date: string;
  competence_date: string;
  provider_cnpj: string;
  provider_name: string;
  taker_document: string;
  taker_name: string;
  taker_email: string | null;
  service_code: string;
  service_description: string;
  service_value: number;
  iss_rate: number;
  iss_value: number;
  net_value: number;
  verification_code: string | null;
  nfse_link: string | null;
  error_message: string | null;
  event_id: string | null;
  created_at: string;
}

interface NFSeConfig {
  id: string;
  municipality_code: string;
  municipality_name: string;
  state: string;
  environment: string;
  default_service_code: string | null;
  default_cnae: string | null;
  default_iss_rate: number;
  last_rps_number: number;
  rps_series: string;
  is_configured: boolean;
  active_certificate_id: string | null;
  provider_im?: string | null;
  provider_cnpj?: string | null;
  simple_national?: boolean | null;
  iss_retention_default?: boolean | null;
}

interface NFSeCertificate {
  id: string;
  certificate_name: string;
  certificate_type: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

interface Event {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  event_date: string;
  location: string | null;
  description: string | null;
  total_budget: number | null;
  payment_amount: number | null;
  remaining_payment_amount: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  rps_generated: { label: 'RPS Gerado', color: 'bg-blue-500', icon: <FileText className="h-3 w-3" /> },
  pending_transmission: { label: 'Aguardando Envio', color: 'bg-yellow-500', icon: <Clock className="h-3 w-3" /> },
  transmitted: { label: 'Transmitida', color: 'bg-purple-500', icon: <Send className="h-3 w-3" /> },
  authorized: { label: 'Autorizada', color: 'bg-green-500', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelada', color: 'bg-gray-500', icon: <XCircle className="h-3 w-3" /> },
  rejected: { label: 'Rejeitada', color: 'bg-red-500', icon: <AlertCircle className="h-3 w-3" /> },
};

export const NFSeInvoices = () => {
  const { toast } = useToast();
  const { logoUrl } = useLogo();
  const { settings } = useCompanySettings();
  const { userRole } = useCustomAuth();
  const canEmitDirect = userRole === 'admin' || userRole === 'financeiro';
  
  const [invoices, setInvoices] = useState<NFSeInvoice[]>([]);
  const [config, setConfig] = useState<NFSeConfig | null>(null);
  const [certificates, setCertificates] = useState<NFSeCertificate[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [preflight, setPreflight] = useState<{ ready: boolean; message: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isManualEmitDialogOpen, setIsManualEmitDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<NFSeInvoice | null>(null);
  const [manualEmitData, setManualEmitData] = useState<NFSeInvoice | null>(null);
  const [emitConfirmInvoice, setEmitConfirmInvoice] = useState<NFSeInvoice | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    taker_type: '2',
    taker_document: '',
    taker_name: '',
    taker_email: '',
    taker_phone: '',
    taker_address: '',
    taker_city_code: '',
    taker_state: '',
    taker_cep: '',
    service_code: PROVIDER_FISCAL_DEFAULTS.service_code,
    cnae_code: PROVIDER_FISCAL_DEFAULTS.cnae_code,
    service_description: '',
    service_value: 0,
    deduction_value: 0,
    iss_rate: PROVIDER_FISCAL_DEFAULTS.iss_rate,
    iss_retention: PROVIDER_FISCAL_DEFAULTS.iss_retention,
    nature_operation: 1,
    special_regime: 6,
    simple_national: PROVIDER_FISCAL_DEFAULTS.simple_national,
    event_id: '',
    competence_date: new Date(),
  });

  // Config form state
  const [configFormData, setConfigFormData] = useState({
    default_service_code: PROVIDER_FISCAL_DEFAULTS.service_code,
    default_cnae: PROVIDER_FISCAL_DEFAULTS.cnae_code,
    default_iss_rate: PROVIDER_FISCAL_DEFAULTS.iss_rate,
    rps_series: PROVIDER_FISCAL_DEFAULTS.rps_series,
    environment: 'producao',
    provider_im: PROVIDER_FISCAL_DEFAULTS.provider_im,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invoicesRes, configRes, certificatesRes, eventsRes] = await Promise.all([
        supabase.from('nfse_invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('nfse_config').select('*').limit(1).maybeSingle(),
        supabase.from('nfse_certificates').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('id, name, client_name, client_email, client_phone, event_date, location, description, total_budget, payment_amount, remaining_payment_amount').order('event_date', { ascending: false }).limit(100),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (configRes.error) throw configRes.error;
      if (certificatesRes.error) throw certificatesRes.error;
      if (eventsRes.error) throw eventsRes.error;

      setInvoices(invoicesRes.data || []);
      setConfig(configRes.data);
      setCertificates(certificatesRes.data || []);
      setEvents(eventsRes.data || []);

      // Auto-link certificate if config exists but has no active certificate
      if (configRes.data && !configRes.data.active_certificate_id && certificatesRes.data && certificatesRes.data.length > 0) {
        const activeCert = certificatesRes.data.find(c => c.is_active) || certificatesRes.data[0];
        if (activeCert) {
          await supabase
            .from('nfse_config')
            .update({ active_certificate_id: activeCert.id })
            .eq('id', configRes.data.id);
          // Update local state
          setConfig({ ...configRes.data, active_certificate_id: activeCert.id });
        }
      }

      if (configRes.data) {
        setConfigFormData({
          default_service_code: configRes.data.default_service_code || PROVIDER_FISCAL_DEFAULTS.service_code,
          default_cnae: configRes.data.default_cnae || PROVIDER_FISCAL_DEFAULTS.cnae_code,
          default_iss_rate: configRes.data.default_iss_rate ?? PROVIDER_FISCAL_DEFAULTS.iss_rate,
          rps_series: configRes.data.rps_series || PROVIDER_FISCAL_DEFAULTS.rps_series,
          environment: configRes.data.environment || 'producao',
          provider_im: configRes.data.provider_im || PROVIDER_FISCAL_DEFAULTS.provider_im,
        });
        setFormData(prev => ({
          ...prev,
          service_code: configRes.data.default_service_code || PROVIDER_FISCAL_DEFAULTS.service_code,
          cnae_code: configRes.data.default_cnae || PROVIDER_FISCAL_DEFAULTS.cnae_code,
          iss_rate: configRes.data.default_iss_rate ?? PROVIDER_FISCAL_DEFAULTS.iss_rate,
          simple_national: configRes.data.simple_national ?? PROVIDER_FISCAL_DEFAULTS.simple_national,
          iss_retention: configRes.data.iss_retention_default ?? PROVIDER_FISCAL_DEFAULTS.iss_retention,
        }));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de NFS-e",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateValues = useCallback(() => {
    const baseCalculation = formData.service_value - formData.deduction_value;
    const issValue = baseCalculation * (formData.iss_rate / 100);
    const netValue = formData.service_value - issValue;
    return { baseCalculation, issValue, netValue };
  }, [formData.service_value, formData.deduction_value, formData.iss_rate]);

  const handleCreateRPS = async () => {
    if (!formData.taker_document || !formData.taker_name || !formData.service_description || formData.service_value <= 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (!settings?.cnpj) {
      toast({
        title: "CNPJ não configurado",
        description: "Configure o CNPJ da empresa nas Configurações antes de emitir notas fiscais",
        variant: "destructive",
      });
      return;
    }

    try {
      const { baseCalculation, issValue, netValue } = calculateValues();
      
      // Get next RPS number
      const nextRpsNumber = (config?.last_rps_number || 0) + 1;
      
      const newInvoice = {
        rps_number: String(nextRpsNumber).padStart(10, '0'),
        rps_series: config?.rps_series || PROVIDER_FISCAL_DEFAULTS.rps_series,
        status: 'rps_generated',
        issue_date: new Date().toISOString(),
        competence_date: formData.competence_date.toISOString().split('T')[0],
        provider_cnpj: settings.cnpj.replace(/\D/g, ''),
        provider_im: config?.provider_im || PROVIDER_FISCAL_DEFAULTS.provider_im,
        provider_city_code: config?.municipality_code || PROVIDER_FISCAL_DEFAULTS.municipality_code,
        provider_state: config?.state || PROVIDER_FISCAL_DEFAULTS.state,
        provider_name: settings.company_name || 'Empresa',
        provider_address: settings.address || '',
        taker_type: formData.taker_type,
        taker_document: formData.taker_document.replace(/\D/g, ''),
        taker_name: formData.taker_name,
        taker_email: formData.taker_email || null,
        taker_phone: formData.taker_phone || null,
        taker_address: formData.taker_address || null,
        taker_city_code: formData.taker_city_code || null,
        taker_state: formData.taker_state || null,
        taker_cep: formData.taker_cep || null,
        service_code: formData.service_code,
        cnae_code: formData.cnae_code || null,
        service_description: formData.service_description,
        service_value: formData.service_value,
        deduction_value: formData.deduction_value,
        base_calculation: baseCalculation,
        iss_rate: formData.iss_rate,
        iss_value: issValue,
        iss_retention: formData.iss_retention,
        nature_operation: formData.nature_operation,
        special_regime: formData.special_regime,
        simple_national: formData.simple_national,
        net_value: netValue,
        event_id: formData.event_id || null,
      };

      const { error: insertError } = await supabase
        .from('nfse_invoices')
        .insert(newInvoice);

      if (insertError) throw insertError;

      // Update last RPS number
      if (config) {
        await supabase
          .from('nfse_config')
          .update({ last_rps_number: nextRpsNumber })
          .eq('id', config.id);
      }

      toast({
        title: "RPS gerado com sucesso!",
        description: `RPS nº ${newInvoice.rps_number} criado. Você pode converter em NF no portal da prefeitura.`,
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating RPS:', error);
      toast({
        title: "Erro ao gerar RPS",
        description: "Não foi possível gerar o RPS",
        variant: "destructive",
      });
    }
  };

  const handleSaveConfig = async () => {
    try {
      if (config) {
        const { error } = await supabase
          .from('nfse_config')
          .update({
            default_service_code: configFormData.default_service_code,
            default_cnae: configFormData.default_cnae,
            default_iss_rate: configFormData.default_iss_rate,
            rps_series: configFormData.rps_series,
            environment: configFormData.environment,
            provider_im: configFormData.provider_im,
            is_configured: true,
          })
          .eq('id', config.id);

        if (error) throw error;
      }

      toast({
        title: "Configurações salvas",
        description: "As configurações de NFS-e foram atualizadas",
      });

      setIsConfigDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      taker_type: '2',
      taker_document: '',
      taker_name: '',
      taker_email: '',
      taker_phone: '',
      taker_address: '',
      taker_city_code: '',
      taker_state: '',
      taker_cep: '',
      service_code: config?.default_service_code || PROVIDER_FISCAL_DEFAULTS.service_code,
      cnae_code: config?.default_cnae || PROVIDER_FISCAL_DEFAULTS.cnae_code,
      service_description: '',
      service_value: 0,
      deduction_value: 0,
      iss_rate: config?.default_iss_rate ?? PROVIDER_FISCAL_DEFAULTS.iss_rate,
      iss_retention: config?.iss_retention_default ?? PROVIDER_FISCAL_DEFAULTS.iss_retention,
      nature_operation: 1,
      special_regime: 6,
      simple_national: config?.simple_national ?? PROVIDER_FISCAL_DEFAULTS.simple_national,
      event_id: '',
      competence_date: new Date(),
    });
  };

  const generateRPSPdf = async (invoice: NFSeInvoice) => {
    const doc = new jsPDF({ compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    let currentY = margin;

    // ============ CABEÇALHO OFICIAL ============
    // Borda externa do cabeçalho
    doc.setDrawColor(0, 102, 51); // Verde escuro
    doc.setLineWidth(1.5);
    doc.rect(margin, currentY, contentWidth, 28);

    // Logo/Brasão da prefeitura (área à esquerda)
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, 45, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PREFEITURA', margin + 22.5, currentY + 10, { align: 'center' });
    doc.text('MUNICIPAL DE', margin + 22.5, currentY + 15, { align: 'center' });
    doc.text('GOIÂNIA', margin + 22.5, currentY + 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);

    // Título central
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('RECIBO PROVISÓRIO DE SERVIÇOS', margin + 55 + (contentWidth - 45) / 2 - 10, currentY + 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text('RPS', margin + 55 + (contentWidth - 45) / 2 - 10, currentY + 17, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('(Documento auxiliar para conversão em NFS-e)', margin + 55 + (contentWidth - 45) / 2 - 10, currentY + 23, { align: 'center' });
    
    currentY += 32;

    // ============ DADOS DO RPS ============
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    
    // Linha com número do RPS, série e data
    const boxHeight = 15;
    const col1 = margin;
    const col2 = margin + contentWidth * 0.35;
    const col3 = margin + contentWidth * 0.55;
    const col4 = margin + contentWidth * 0.75;

    doc.rect(col1, currentY, contentWidth * 0.35, boxHeight);
    doc.rect(col2, currentY, contentWidth * 0.2, boxHeight);
    doc.rect(col3, currentY, contentWidth * 0.2, boxHeight);
    doc.rect(col4, currentY, contentWidth * 0.25, boxHeight);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Número do RPS', col1 + 2, currentY + 4);
    doc.text('Série', col2 + 2, currentY + 4);
    doc.text('Data de Emissão', col3 + 2, currentY + 4);
    doc.text('Competência', col4 + 2, currentY + 4);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.rps_number, col1 + 2, currentY + 11);
    doc.text(invoice.rps_series || 'RPS', col2 + 2, currentY + 11);
    doc.text(format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR }), col3 + 2, currentY + 11);
    doc.text(format(new Date(invoice.competence_date), 'MM/yyyy', { locale: ptBR }), col4 + 2, currentY + 11);
    
    currentY += boxHeight + 3;

    // ============ PRESTADOR DE SERVIÇOS ============
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESTADOR DE SERVIÇOS', margin + 3, currentY + 5);
    doc.setTextColor(0, 0, 0);
    currentY += 7;

    // Dados do prestador
    const prestadorHeight = 22;
    doc.rect(margin, currentY, contentWidth * 0.7, prestadorHeight);
    doc.rect(margin + contentWidth * 0.7, currentY, contentWidth * 0.3, prestadorHeight);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Razão Social / Nome', margin + 2, currentY + 4);
    doc.text('CNPJ / CPF', margin + contentWidth * 0.7 + 2, currentY + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.provider_name, margin + 2, currentY + 10);
    doc.text(formatCNPJ(invoice.provider_cnpj), margin + contentWidth * 0.7 + 2, currentY + 10);

    // Endereço do prestador
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Endereço', margin + 2, currentY + 15);
    doc.setFontSize(8);
    doc.text(settings?.address || 'Goiânia - GO', margin + 2, currentY + 20);

    currentY += prestadorHeight + 3;

    // ============ TOMADOR DE SERVIÇOS ============
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TOMADOR DE SERVIÇOS', margin + 3, currentY + 5);
    doc.setTextColor(0, 0, 0);
    currentY += 7;

    // Dados do tomador
    const tomadorHeight = 22;
    doc.rect(margin, currentY, contentWidth * 0.7, tomadorHeight);
    doc.rect(margin + contentWidth * 0.7, currentY, contentWidth * 0.3, tomadorHeight);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Razão Social / Nome', margin + 2, currentY + 4);
    const docLabel = invoice.taker_document.length > 11 ? 'CNPJ' : 'CPF';
    doc.text(docLabel, margin + contentWidth * 0.7 + 2, currentY + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.taker_name, margin + 2, currentY + 10);
    const formattedDoc = invoice.taker_document.length > 11 
      ? formatCNPJ(invoice.taker_document) 
      : formatCPF(invoice.taker_document);
    doc.text(formattedDoc, margin + contentWidth * 0.7 + 2, currentY + 10);

    // E-mail do tomador
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('E-mail', margin + 2, currentY + 15);
    doc.setFontSize(8);
    doc.text(invoice.taker_email || '-', margin + 2, currentY + 20);

    currentY += tomadorHeight + 3;

    // ============ DISCRIMINAÇÃO DOS SERVIÇOS ============
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DISCRIMINAÇÃO DOS SERVIÇOS', margin + 3, currentY + 5);
    doc.setTextColor(0, 0, 0);
    currentY += 7;

    // Código do serviço
    doc.rect(margin, currentY, contentWidth, 12);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Código do Serviço (Lei Complementar 116/2003)', margin + 2, currentY + 4);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.service_code, margin + 2, currentY + 10);
    currentY += 12;

    // Descrição do serviço
    const descLines = doc.splitTextToSize(invoice.service_description, contentWidth - 4);
    const descBoxHeight = Math.max(25, descLines.length * 4 + 8);
    doc.rect(margin, currentY, contentWidth, descBoxHeight);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Descrição dos Serviços', margin + 2, currentY + 4);
    doc.setFontSize(8);
    doc.text(descLines, margin + 2, currentY + 10);
    currentY += descBoxHeight + 3;

    // ============ VALORES ============
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('VALORES DO SERVIÇO', margin + 3, currentY + 5);
    doc.setTextColor(0, 0, 0);
    currentY += 7;

    // Tabela de valores
    autoTable(doc, {
      startY: currentY,
      head: [['Descrição', 'Base de Cálculo', 'Alíquota', 'Valor']],
      body: [
        ['Valor dos Serviços', formatCurrency(invoice.service_value), '-', formatCurrency(invoice.service_value)],
        ['ISS', formatCurrency(invoice.service_value), `${invoice.iss_rate}%`, formatCurrency(invoice.iss_value)],
        ['Deduções', '-', '-', 'R$ 0,00'],
        ['Descontos Incondicionados', '-', '-', 'R$ 0,00'],
      ],
      foot: [['VALOR LÍQUIDO DA NOTA', '', '', formatCurrency(invoice.net_value)]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [0, 102, 51], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 40 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'right', cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // ============ INFORMAÇÕES ADICIONAIS ============
    doc.setFillColor(0, 102, 51);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('OUTRAS INFORMAÇÕES', margin + 3, currentY + 5);
    doc.setTextColor(0, 0, 0);
    currentY += 7;

    const infoHeight = 20;
    doc.rect(margin, currentY, contentWidth, infoHeight);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    const col1Info = margin + 2;
    const col2Info = margin + contentWidth * 0.33;
    const col3Info = margin + contentWidth * 0.66;

    doc.text('Natureza da Operação', col1Info, currentY + 4);
    doc.text('Regime Especial', col2Info, currentY + 4);
    doc.text('Optante Simples Nacional', col3Info, currentY + 4);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Tributação no Município', col1Info, currentY + 10);
    doc.text('Microempresa Municipal', col2Info, currentY + 10);
    doc.text('Sim', col3Info, currentY + 10);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('ISS Retido', col1Info, currentY + 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Não', col1Info + 15, currentY + 15);

    currentY += infoHeight + 5;

    // ============ AVISO IMPORTANTE ============
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(204, 153, 0);
    doc.setLineWidth(0.5);
    doc.rect(margin, currentY, contentWidth, 22, 'FD');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(133, 100, 4);
    doc.text('ATENÇÃO - RECIBO PROVISÓRIO DE SERVIÇOS', margin + 3, currentY + 6);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Este documento é um RPS e deve ser convertido em NFS-e no prazo de 10 dias.', margin + 3, currentY + 12);
    doc.text('Para conversão, acesse o portal ISS Digital de Goiânia:', margin + 3, currentY + 17);
    doc.setTextColor(0, 0, 153);
    doc.setFont('helvetica', 'bold');
    doc.text('https://www.issnetonline.com.br/goiania/online/login/login.aspx', margin + 3, currentY + 21);
    
    doc.setTextColor(0, 0, 0);
    currentY += 25;

    // ============ RODAPÉ ============
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    const footerY = pageHeight - 10;
    doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, footerY);
    doc.text('Secretaria Municipal de Finanças - Goiânia/GO', pageWidth - margin, footerY, { align: 'right' });

    doc.save(`RPS_${invoice.rps_number}.pdf`);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.rps_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.taker_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleEventSelect = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      // Calcula o valor total do evento (orçamento ou pagamentos)
      const totalValue = event.total_budget || 
        ((event.payment_amount || 0) + (event.remaining_payment_amount || 0)) || 0;
      
      // Monta a descrição completa do serviço
      let serviceDescription = `Serviços de locação de equipamentos para o evento: ${event.name}`;
      if (event.location) {
        serviceDescription += `\nLocal: ${event.location}`;
      }
      if (event.event_date) {
        serviceDescription += `\nData do evento: ${format(new Date(event.event_date), 'dd/MM/yyyy', { locale: ptBR })}`;
      }
      if (event.description) {
        serviceDescription += `\n${event.description}`;
      }

      setFormData(prev => ({
        ...prev,
        event_id: eventId,
        taker_name: event.client_name || prev.taker_name,
        taker_email: event.client_email || prev.taker_email,
        taker_phone: event.client_phone || prev.taker_phone,
        service_value: totalValue,
        service_description: serviceDescription,
      }));

      toast({
        title: "Evento selecionado",
        description: `Dados do evento "${event.name}" carregados automaticamente`,
      });
    }
  };

  // Formato os dados para colar no portal manual
  const formatInvoiceDataForPortal = (invoice: NFSeInvoice) => {
    const formattedDoc = invoice.taker_document.length > 11 
      ? formatCNPJ(invoice.taker_document) 
      : formatCPF(invoice.taker_document);
    
    return `=== DADOS PARA EMISSÃO DE NFS-e ===

📋 TOMADOR DE SERVIÇOS:
Nome/Razão Social: ${invoice.taker_name}
CPF/CNPJ: ${formattedDoc}
E-mail: ${invoice.taker_email || '-'}

📝 SERVIÇO:
Código do Serviço: ${invoice.service_code}
Descrição: ${invoice.service_description}

💰 VALORES:
Valor do Serviço: ${formatCurrency(invoice.service_value)}
Alíquota ISS: ${invoice.iss_rate}%
Valor ISS: ${formatCurrency(invoice.iss_value)}
Valor Líquido: ${formatCurrency(invoice.net_value)}

📅 DATAS:
Data de Emissão: ${format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
Competência: ${format(new Date(invoice.competence_date), 'MM/yyyy', { locale: ptBR })}

🔢 RPS:
Número: ${invoice.rps_number}
Série: ${invoice.rps_series || 'RPS'}
`;
  };

  const handleOpenPortalManual = (invoice: NFSeInvoice) => {
    setManualEmitData(invoice);
    setIsManualEmitDialogOpen(true);
  };

  const handleCopyDataAndOpenPortal = async () => {
    if (!manualEmitData) return;

    const formattedData = formatInvoiceDataForPortal(manualEmitData);
    
    try {
      await navigator.clipboard.writeText(formattedData);
      toast({
        title: "Dados copiados!",
        description: "Cole os dados no portal da prefeitura",
      });
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }

    // Abre o portal em nova aba
    window.open('https://www.notaeletronica.com.br/goiania/Default/Master2.aspx', '_blank');
    setIsManualEmitDialogOpen(false);
  };

  const hasCertificate = certificates.some(c => c.is_active);

  const readiness = evaluateNFSeReadiness(config, certificates);

  // Valida certificado (senha) e conectividade com o WebService — não transmite nada.
  const handleValidateFiscalSetup = async () => {
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('emit-nfse', {
        body: { action: 'preflight' },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        const message = describeEmitError(payload, error.message);
        setPreflight({ ready: false, message });
        toast({ title: "Validação falhou", description: message, variant: "destructive" });
        return;
      }

      const message = describePreflight(data);
      setPreflight({ ready: Boolean(data?.ready), message });
      toast({
        title: data?.ready ? "Certificado e conexão OK" : "Pendências encontradas",
        description: message,
        variant: data?.ready ? undefined : "destructive",
      });
      await fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setPreflight({ ready: false, message });
      toast({ title: "Erro na validação", description: message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };


  // Abre a confirmação antes de transmitir (nada é enviado sem confirmar)
  const handleEmitNFSe = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    if (!canEmitDirect) {
      toast({
        title: "Permissão negada",
        description: "Apenas administradores e financeiro podem emitir NFS-e.",
        variant: "destructive",
      });
      return;
    }

    if (!canEmitStatus(invoice.status)) {
      toast({
        title: "Emissão não permitida",
        description: `Esta nota está com status "${invoice.status}" e não pode ser transmitida novamente.`,
        variant: "destructive",
      });
      return;
    }

    if (!readiness.ready) {
      toast({
        title: "Configuração fiscal incompleta",
        description: readiness.blockers.join(' '),
        variant: "destructive",
      });
      return;
    }

    setEmitConfirmInvoice(invoice);
  };

  // Transmissão efetiva via Edge Function (sessão autenticada)
  const confirmEmitNFSe = async () => {
    const invoice = emitConfirmInvoice;
    setEmitConfirmInvoice(null);
    if (!invoice) return;

    setEmittingId(invoice.id);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para emitir a NFS-e.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('emit-nfse', {
        body: { invoice_id: invoice.id, action: 'emit' },
      });

      if (error) {
        const payload = await readFunctionErrorPayload(error);
        toast({
          title: "Falha na emissão",
          description: describeEmitError(payload, error.message),
          variant: "destructive",
        });
        return;
      }


      if (data && data.success === false) {
        toast({
          title: "NFS-e rejeitada",
          description: describeEmitError(data),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "NFS-e emitida com sucesso",
        description: data?.invoiceNumber ? `Nota nº ${data.invoiceNumber}` : undefined,
      });

      if (typeof data?.nfseLink === 'string' && /^https?:\/\//i.test(data.nfseLink)) {
        window.open(data.nfseLink, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast({
        title: "Erro ao emitir NFS-e",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      setEmittingId(null);
      await fetchData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageActions>
        <div className="flex flex-wrap gap-2">
          {canEmitDirect && (
            <Button variant="outline" onClick={handleValidateFiscalSetup} disabled={validating}>
              <Shield className="h-4 w-4 mr-2" />
              {validating ? 'Validando...' : 'Validar certificado e conexão'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsConfigDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </Button>

          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo RPS
          </Button>
        </div>
      </PageActions>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">RPS Gerados</p>
                <p className="text-2xl font-bold">{invoices.filter(i => i.status === 'rps_generated').length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Autorizadas</p>
                <p className="text-2xl font-bold text-green-600">{invoices.filter(i => i.status === 'authorized').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{invoices.filter(i => i.status === 'pending_transmission').length}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Certificado</p>
                <p className="text-sm font-medium">{hasCertificate ? 'Configurado' : 'Não configurado'}</p>
              </div>
              <Shield className={cn("h-8 w-8", hasCertificate ? "text-green-500" : "text-red-500")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status da emissão direta + ambiente */}
      <Alert variant={readiness.ready ? "default" : "destructive"}>
        <Shield className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          Emissão direta {readiness.ready ? 'habilitada' : 'indisponível'}
          <Badge variant="outline" className={cn(readiness.isProduction ? "border-red-500 text-red-600" : "border-blue-500 text-blue-600")}>
            Ambiente: {readiness.environment === 'producao' ? 'PRODUÇÃO' : readiness.environment === 'homologacao' ? 'HOMOLOGAÇÃO' : 'NÃO DEFINIDO'}
          </Badge>
        </AlertTitle>
        <AlertDescription>
          {readiness.ready ? (
            <span>
              Configuração fiscal e certificado A1 validados.{' '}
              {canEmitDirect
                ? 'Use o botão verde para transmitir; o portal manual segue disponível como fallback.'
                : 'Seu perfil não permite transmitir notas (apenas admin/financeiro).'}
            </span>
          ) : (
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              {readiness.blockers.map((b) => (<li key={b}>{b}</li>))}
              <li>Se a senha do certificado (secret NFSE_CERT_PASSWORD) não estiver configurada, a função retornará instruções ao tentar emitir.</li>
            </ul>
          )}
        </AlertDescription>
      </Alert>

      {/* Resultado da validação de certificado e conectividade */}
      {preflight && (
        <Alert variant={preflight.ready ? "default" : "destructive"}>
          <Shield className="h-4 w-4" />
          <AlertTitle>
            {preflight.ready ? 'Certificado e conexão validados' : 'Validação com pendências'}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{preflight.message}</p>
            {!preflight.ready && (
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                <li>Senha incorreta: atualize o secret <strong>NFSE_CERT_PASSWORD</strong> nas configurações do projeto (o valor nunca é exibido nem registrado).</li>
                <li>Certificado inválido/expirado: reenvie o arquivo .pfx em Configurações NFS-e.</li>
                <li>WebService inacessível: aguarde e valide novamente — nenhuma nota é transmitida nessa verificação.</li>
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}


      {/* Alert for missing certificate */}
      {!hasCertificate && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Certificado Digital não configurado</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Para emissão automática de NFS-e, é necessário um Certificado Digital A1 (.pfx). 
                  Enquanto isso, você pode gerar RPS e converter manualmente no portal da prefeitura.
                </p>
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <a href="https://www.issnetonline.com.br/goiania/online/login/login.aspx" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Acessar Portal ISS Digital
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="rps_generated">RPS Gerado</SelectItem>
                <SelectItem value="pending_transmission">Pendente</SelectItem>
                <SelectItem value="authorized">Autorizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RPS/NF</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma nota fiscal encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => {
                    const status = statusConfig[invoice.status] || statusConfig.rps_generated;
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">RPS: {invoice.rps_number}</p>
                            {invoice.invoice_number && (
                              <p className="text-sm text-muted-foreground">NF: {invoice.invoice_number}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                            <p className="text-sm text-muted-foreground">
                              Comp: {format(new Date(invoice.competence_date), 'MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invoice.taker_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.taker_document.length > 11 
                                ? formatCNPJ(invoice.taker_document) 
                                : formatCPF(invoice.taker_document)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="truncate max-w-[200px]">{invoice.service_description}</p>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.service_value)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("gap-1", status.color)}>
                            {status.icon}
                            {status.label}
                          </Badge>
                          {invoice.error_message && (
                            <p className="text-xs text-red-500 mt-1">{invoice.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {/* Emissão DIRETA (ação principal) - apenas RPS gerado ou com erro */}
                            {canEmitDirect && canEmitStatus(invoice.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEmitNFSe(invoice.id)}
                                disabled={emittingId === invoice.id || !readiness.ready}
                                title={
                                  readiness.ready
                                    ? (isResend(invoice.status) ? 'Reenviar NFS-e' : 'Emitir NFS-e (direto)')
                                    : `Emissão direta indisponível: ${readiness.blockers.join(' ')}`
                                }
                                className="text-green-600 hover:text-green-700 hover:bg-green-100"
                              >
                                {emittingId === invoice.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {/* Fallback explícito: portal manual da prefeitura */}
                            {canEmitStatus(invoice.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenPortalManual(invoice)}
                                title="Fallback: emitir manualmente no portal da prefeitura"
                                className="text-muted-foreground"
                              >
                                <Building2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setIsViewDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => generateRPSPdf(invoice)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {invoice.nfse_link && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={invoice.nfse_link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create RPS Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo RPS - Recibo Provisório de Serviços</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="tomador" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tomador">Tomador</TabsTrigger>
              <TabsTrigger value="servico">Serviço</TabsTrigger>
              <TabsTrigger value="valores">Valores</TabsTrigger>
            </TabsList>

            <TabsContent value="tomador" className="space-y-4">
              {/* Event Selection - Destacado */}
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <Label className="text-base font-semibold">Importar dados de um Evento</Label>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Selecione um evento para preencher automaticamente os dados do cliente e valores
                  </p>
                  <Select value={formData.event_id} onValueChange={handleEventSelect}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="🔍 Buscar e selecionar evento..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {events.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          Nenhum evento encontrado
                        </div>
                      ) : (
                        events.map((event) => (
                          <SelectItem key={event.id} value={event.id} className="py-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{event.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {event.client_name || 'Cliente não informado'} • {format(new Date(event.event_date), 'dd/MM/yyyy')} • {formatCurrency(event.total_budget || 0)}
                              </span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {formData.event_id && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-muted-foreground"
                      onClick={() => setFormData(prev => ({ ...prev, event_id: '' }))}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Limpar seleção
                    </Button>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Documento</Label>
                  <Select 
                    value={formData.taker_type} 
                    onValueChange={(v) => setFormData({ ...formData, taker_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">CNPJ</SelectItem>
                      <SelectItem value="2">CPF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{formData.taker_type === '1' ? 'CNPJ' : 'CPF'} *</Label>
                  <Input
                    value={formData.taker_document}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      taker_document: formData.taker_type === '1' 
                        ? formatCNPJ(e.target.value) 
                        : formatCPF(e.target.value) 
                    })}
                    placeholder={formData.taker_type === '1' ? '00.000.000/0000-00' : '000.000.000-00'}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nome/Razão Social *</Label>
                <Input
                  value={formData.taker_name}
                  onChange={(e) => setFormData({ ...formData, taker_name: e.target.value })}
                  placeholder="Nome completo ou razão social"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.taker_email}
                    onChange={(e) => setFormData({ ...formData, taker_email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.taker_phone}
                    onChange={(e) => setFormData({ ...formData, taker_phone: e.target.value })}
                    placeholder="(62) 99999-9999"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={formData.taker_address}
                  onChange={(e) => setFormData({ ...formData, taker_address: e.target.value })}
                  placeholder="Rua, número, bairro..."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade (Cód. IBGE)</Label>
                  <Input
                    value={formData.taker_city_code}
                    onChange={(e) => setFormData({ ...formData, taker_city_code: e.target.value })}
                    placeholder="5208707"
                  />
                </div>
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Input
                    value={formData.taker_state}
                    onChange={(e) => setFormData({ ...formData, taker_state: e.target.value.toUpperCase() })}
                    placeholder="GO"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={formData.taker_cep}
                    onChange={(e) => setFormData({ ...formData, taker_cep: e.target.value })}
                    placeholder="74000-000"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="servico" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código do Serviço *</Label>
                  <Select
                    value={formData.service_code}
                    onValueChange={(value) => setFormData({ ...formData, service_code: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o código" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {SERVICE_CODE_OPTIONS.map(option => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Item da lista LC 116/2003 (padrão {PROVIDER_FISCAL_DEFAULTS.service_code})</p>
                </div>
                <div className="space-y-2">
                  <Label>CNAE</Label>
                  <Input
                    value={formData.cnae_code}
                    onChange={(e) => setFormData({ ...formData, cnae_code: e.target.value })}
                    placeholder="9001906"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição dos Serviços *</Label>
                <Textarea
                  value={formData.service_description}
                  onChange={(e) => setFormData({ ...formData, service_description: e.target.value })}
                  placeholder="Descreva detalhadamente os serviços prestados..."
                  rows={4}
                />
                {serviceDescriptionWarning(formData.service_code, formData.service_description) && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {serviceDescriptionWarning(formData.service_code, formData.service_description)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="space-y-2">
                <Label>Data de Competência</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.competence_date, 'MMMM yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.competence_date}
                      onSelect={(date) => date && setFormData({ ...formData, competence_date: date })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Natureza da Operação</Label>
                  <Select 
                    value={String(formData.nature_operation)} 
                    onValueChange={(v) => setFormData({ ...formData, nature_operation: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Tributação no município</SelectItem>
                      <SelectItem value="2">2 - Tributação fora do município</SelectItem>
                      <SelectItem value="3">3 - Isenção</SelectItem>
                      <SelectItem value="4">4 - Imune</SelectItem>
                      <SelectItem value="5">5 - Exigibilidade suspensa</SelectItem>
                      <SelectItem value="6">6 - Exportação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Regime Especial</Label>
                  <Select 
                    value={String(formData.special_regime)} 
                    onValueChange={(v) => setFormData({ ...formData, special_regime: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 - Microempresa Municipal</SelectItem>
                      <SelectItem value="2">2 - Estimativa</SelectItem>
                      <SelectItem value="3">3 - Sociedade de Profissionais</SelectItem>
                      <SelectItem value="4">4 - Cooperativa</SelectItem>
                      <SelectItem value="5">5 - MEI</SelectItem>
                      <SelectItem value="6">6 - ME/EPP Simples Nacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="simple_national"
                  checked={formData.simple_national}
                  onCheckedChange={(checked) => setFormData({ ...formData, simple_national: !!checked })}
                />
                <Label htmlFor="simple_national">Optante pelo Simples Nacional</Label>
              </div>
            </TabsContent>

            <TabsContent value="valores" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor dos Serviços *</Label>
                  <CurrencyInput
                    value={formData.service_value}
                    onChange={(value) => setFormData({ ...formData, service_value: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deduções</Label>
                  <CurrencyInput
                    value={formData.deduction_value}
                    onChange={(value) => setFormData({ ...formData, deduction_value: value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alíquota ISS (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={formData.iss_rate}
                    onChange={(e) => setFormData({ ...formData, iss_rate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-end space-x-2 pb-2">
                  <Checkbox
                    id="iss_retention"
                    checked={formData.iss_retention}
                    onCheckedChange={(checked) => setFormData({ ...formData, iss_retention: !!checked })}
                  />
                  <Label htmlFor="iss_retention">ISS Retido</Label>
                </div>
              </div>

              {/* Summary */}
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Valor dos Serviços:</span>
                      <span className="font-medium">{formatCurrency(formData.service_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>(-) Deduções:</span>
                      <span>{formatCurrency(formData.deduction_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Base de Cálculo:</span>
                      <span>{formatCurrency(calculateValues().baseCalculation)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>(-) ISS ({formData.iss_rate}%):</span>
                      <span>{formatCurrency(calculateValues().issValue)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Valor Líquido:</span>
                      <span className="text-green-600">{formatCurrency(calculateValues().netValue)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateRPS}>
              <FileCheck className="h-4 w-4 mr-2" />
              Gerar RPS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurações NFS-e</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5" />
                <span className="font-medium">Município: Goiânia - GO</span>
              </div>
              <p className="text-sm text-muted-foreground">Padrão ABRASF 2.04</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Inscrição Municipal do Prestador</Label>
                <Input
                  value={configFormData.provider_im}
                  onChange={(e) => setConfigFormData({ ...configFormData, provider_im: e.target.value })}
                  placeholder={PROVIDER_FISCAL_DEFAULTS.provider_im}
                />
              </div>
              <div className="space-y-2">
                <Label>Código do Serviço Padrão</Label>
                <Select
                  value={configFormData.default_service_code}
                  onValueChange={(v) => setConfigFormData({ ...configFormData, default_service_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o código" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {SERVICE_CODE_OPTIONS.map(option => (
                      <SelectItem key={option.code} value={option.code}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNAE Padrão</Label>
                <Input
                  value={configFormData.default_cnae}
                  onChange={(e) => setConfigFormData({ ...configFormData, default_cnae: e.target.value })}
                  placeholder={PROVIDER_FISCAL_DEFAULTS.cnae_code}
                />
              </div>
              <div className="space-y-2">
                <Label>Alíquota ISS Padrão (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="5"
                  value={configFormData.default_iss_rate}
                  onChange={(e) => setConfigFormData({ ...configFormData, default_iss_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Série RPS</Label>
                <Input
                  value={configFormData.rps_series}
                  onChange={(e) => setConfigFormData({ ...configFormData, rps_series: e.target.value })}
                  placeholder={PROVIDER_FISCAL_DEFAULTS.rps_series}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select 
                value={configFormData.environment} 
                onValueChange={(v) => setConfigFormData({ ...configFormData, environment: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className={cn("h-5 w-5", hasCertificate ? "text-green-500" : "text-yellow-500")} />
                  <span className="font-medium">Certificado Digital A1</span>
                </div>
                <Badge variant={hasCertificate ? "default" : "secondary"}>
                  {hasCertificate ? "Configurado" : "Pendente"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {hasCertificate 
                  ? "Certificado ativo para assinatura digital" 
                  : "Necessário para emissão automática de NFS-e"}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  className="max-w-[200px]"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    try {
                      const fileName = `certificate_${Date.now()}.pfx`;
                      const { error: uploadError } = await supabase.storage
                        .from('nfse-certificates')
                        .upload(fileName, file);
                      
                      if (uploadError) throw uploadError;
                      
                      // Save certificate metadata
                      const { data: certData, error: insertError } = await supabase
                        .from('nfse_certificates')
                        .insert({
                          certificate_name: file.name,
                          certificate_type: 'A1',
                          storage_path: fileName,
                          is_active: true,
                        })
                        .select()
                        .single();
                      
                      if (insertError) throw insertError;
                      
                      // Update nfse_config to use this certificate as active
                      if (certData?.id && config?.id) {
                        await supabase
                          .from('nfse_config')
                          .update({ active_certificate_id: certData.id })
                          .eq('id', config.id);
                      } else if (certData?.id) {
                        // If no config exists yet, create one with the certificate
                        await supabase
                          .from('nfse_config')
                          .upsert({
                            municipality_code: '5208707',
                            active_certificate_id: certData.id,
                          });
                      }
                      
                      toast({
                        title: "Certificado enviado!",
                        description: "O certificado foi salvo com sucesso",
                      });
                      
                      fetchData();
                    } catch (error) {
                      console.error('Error uploading certificate:', error);
                      toast({
                        title: "Erro ao enviar certificado",
                        description: "Não foi possível fazer upload do certificado",
                        variant: "destructive",
                      });
                    }
                    
                    e.target.value = '';
                  }}
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="cert-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload (.pfx)
                  </label>
                </Button>
              </div>
              {hasCertificate && certificates[0] && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {certificates[0].certificate_name} - Ativo
                </p>
              )}
            </div>

            <NationalHomologationSection config={config as never} />
          </div>


          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConfig}>
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do RPS/NFS-e</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Número RPS</p>
                  <p className="font-medium">{selectedInvoice.rps_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedInvoice.status]?.color}>
                    {statusConfig[selectedInvoice.status]?.label}
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Tomador</h4>
                <p>{selectedInvoice.taker_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoice.taker_document.length > 11 
                    ? formatCNPJ(selectedInvoice.taker_document) 
                    : formatCPF(selectedInvoice.taker_document)}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Serviço</h4>
                <p className="text-sm">{selectedInvoice.service_description}</p>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Valores</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Valor do Serviço:</span>
                    <span>{formatCurrency(selectedInvoice.service_value)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>ISS ({selectedInvoice.iss_rate}%):</span>
                    <span>{formatCurrency(selectedInvoice.iss_value)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Valor Líquido:</span>
                    <span className="text-green-600">{formatCurrency(selectedInvoice.net_value)}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => generateRPSPdf(selectedInvoice)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir RPS
                </Button>
                <Button asChild>
                  <a href="https://www.notaeletronica.com.br/goiania/Default/Master2.aspx" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir Portal NFS-e
                  </a>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Manual Emit Dialog */}
      <Dialog open={isManualEmitDialogOpen} onOpenChange={setIsManualEmitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Emitir NFS-e no Portal
            </DialogTitle>
          </DialogHeader>
          
          {manualEmitData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  O sistema irá abrir o portal da prefeitura em uma nova aba e copiar os dados para você colar facilmente.
                </p>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Resumo dos Dados</h4>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Tomador:</span>
                  <span className="font-medium">{manualEmitData.taker_name}</span>
                  
                  <span className="text-muted-foreground">Documento:</span>
                  <span className="font-medium">
                    {manualEmitData.taker_document.length > 11 
                      ? formatCNPJ(manualEmitData.taker_document) 
                      : formatCPF(manualEmitData.taker_document)}
                  </span>
                  
                  <span className="text-muted-foreground">Valor:</span>
                  <span className="font-medium text-green-600">{formatCurrency(manualEmitData.service_value)}</span>
                  
                  <span className="text-muted-foreground">RPS Nº:</span>
                  <span className="font-medium">{manualEmitData.rps_number}</span>
                </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Instruções:</strong> Ao clicar no botão abaixo, os dados serão copiados e o portal será aberto. 
                  Cole os dados no campo desejado usando <kbd className="px-1 bg-yellow-200 dark:bg-yellow-800 rounded">Ctrl+V</kbd>.
                </p>
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setIsManualEmitDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCopyDataAndOpenPortal} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Copiar Dados e Abrir Portal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação antes de transmitir */}
      <AlertDialog open={!!emitConfirmInvoice} onOpenChange={(open) => !open && setEmitConfirmInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {emitConfirmInvoice && isResend(emitConfirmInvoice.status)
                ? 'Reenviar NFS-e à prefeitura?'
                : 'Transmitir NFS-e à prefeitura?'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Ambiente:{' '}
                  <strong>{readiness.environment === 'producao' ? 'PRODUÇÃO (nota fiscal real)' : 'HOMOLOGAÇÃO'}</strong>
                </p>
                {emitConfirmInvoice && (
                  <div className="grid grid-cols-2 gap-1">
                    <span className="text-muted-foreground">RPS:</span>
                    <span>{emitConfirmInvoice.rps_number}</span>
                    <span className="text-muted-foreground">Tomador:</span>
                    <span>{emitConfirmInvoice.taker_name}</span>
                    <span className="text-muted-foreground">Valor:</span>
                    <span>{formatCurrency(emitConfirmInvoice.service_value)}</span>
                  </div>
                )}
                <p>Esta ação é irreversível e não pode ser executada duas vezes para a mesma nota.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEmitNFSe}>Confirmar e transmitir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
