import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Edit, Trash2, FileText, Calendar, Package, Clock, CheckCircle, Printer, X, Search, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { useLogo } from "@/hooks/useLogo";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  buildTransportReceiptPath,
  calculateTransportTotals,
  canManageTransports,
  canTransitionTransportStatus,
  emptyTransportForm,
  filterTransports,
  findTransportConflicts,
  formatCents,
  formatLocalDate,
  fromCents,
  getTransportStatusLabel,
  getTransportStatusVariant,
  isCriticalTransportTransition,
  nextTransportStatuses,
  normalizeTransportStatus,
  paginateTransports,
  recordToTransportForm,
  sortTransports,
  summarizeTransports,
  toCents,
  transportFormCosts,
  transportFormToRecord,
  validateTransportDates,
  validateTransportForm,
  type SortDirection,
  type TransportFormValues,
  type TransportSortKey,
  type TransportStatus,
} from "@/lib/transport";
import {
  FINANCE_RECEIPT_BUCKET,
  getSignedStorageUrl,
  validateReceiptUpload,
} from "@/lib/storageUrls";
import { useValueVisibility } from "@/hooks/useValueVisibility";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FiscalDocumentsPanel from "@/components/transport/FiscalDocumentsPanel";
import jsPDF from 'jspdf';
import 'jspdf-autotable';


interface TransportRecord {
  id: string;
  destination: string;
  destination_state?: string | null;
  origin_city?: string | null;
  origin_state?: string | null;
  transport_date: string;
  departure_time?: string | null;
  arrival_date?: string | null;
  arrival_time?: string | null;
  expected_return_date?: string | null;
  distance_km?: number | null;
  legs?: any;
  driver_name: string;
  driver_cpf?: string;
  driver_phone?: string | null;
  helpers?: any;
  event_id?: string | null;
  vehicle_plate: string;
  vehicle_model?: string | null;
  vehicle_capacity_kg?: number | null;
  cargo_type?: string;
  cargo_weight?: number;
  cargo_value?: number;
  invoice_number?: string;
  equipment_list: any;
  material_list?: any[];
  total_weight: number;
  estimated_cost: number;
  fuel_consumption_kmpl?: number | null;
  fuel_price_cents?: number | null;
  fuel_cost_cents?: number | null;
  toll_cents?: number | null;
  lodging_cents?: number | null;
  meals_cents?: number | null;
  daily_rate_cents?: number | null;
  maintenance_cents?: number | null;
  freight_cents?: number | null;
  advance_cents?: number | null;
  extra_cents?: number | null;
  revenue_cents?: number | null;
  receipt_path?: string | null;
  status: string;
  return_status?: string;
  return_date?: string;
  return_notes?: string;
  notes?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}


interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  weight: number;
  unit_weight: number;
  description?: string;
  serial_number?: string;
  condition: 'new' | 'used' | 'damaged';
  value: number;
  category: string;
  brand?: string;
  model?: string;
  origin_location?: string;
  destination_location?: string;
  insurance_value?: number;
  notes?: string;
}

const brazilianStates = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

export const InterstateTransport = () => {
  const [transports, setTransports] = useState<TransportRecord[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [editingTransport, setEditingTransport] = useState<TransportRecord | null>(null);
  const [selectedTransport, setSelectedTransport] = useState<TransportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<TransportRecord | null>(null);
  const [statusChange, setStatusChange] = useState<{ transport: TransportRecord; next: TransportStatus } | null>(null);
  const [sortKey, setSortKey] = useState<TransportSortKey>('transport_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string }[]>([]);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user, userRole } = useCustomAuth();
  const canManage = canManageTransports(userRole);
  const { canViewValues } = useValueVisibility();
  const { logoUrl } = useLogo();
  const { settings: companySettings } = useCompanySettings();


  const [formData, setFormData] = useState<TransportFormValues>({ ...emptyTransportForm });


  const [materialList, setMaterialList] = useState<MaterialItem[]>([]);
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    quantity: 1,
    weight: 0,
    unit_weight: 0,
    description: '',
    serial_number: '',
    condition: 'new' as 'new' | 'used' | 'damaged',
    value: 0,
    category: '',
    brand: '',
    model: '',
    origin_location: '',
    destination_location: '',
    insurance_value: 0,
    notes: ''
  });

  const [returnData, setReturnData] = useState({
    return_status: 'pending',
    return_date: '',
    return_notes: ''
  });

  useEffect(() => {
    fetchTransports();
    fetchEvents();
  }, []);

  const fetchTransports = async () => {
    try {
      setLoadError(null);
      const { data, error } = await supabase
        .from('interstate_transports')
        .select('*')
        .order('transport_date', { ascending: false });

      if (error) throw error;
      setTransports((data || []).map(transport => ({
        ...transport,
        material_list: typeof transport.material_list === 'string' 
          ? JSON.parse(transport.material_list) 
          : Array.isArray(transport.material_list) 
            ? transport.material_list 
            : [],
        equipment_list: typeof transport.equipment_list === 'string' 
          ? JSON.parse(transport.equipment_list) 
          : Array.isArray(transport.equipment_list) 
            ? transport.equipment_list 
            : []
      })) as TransportRecord[]);
      setLoading(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Erro ao carregar transportes interestaduais');
      console.error('Erro ao buscar transportes:', error);

      toast({
        title: "Erro",
        description: "Erro ao carregar transportes interestaduais",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('id, name, event_date')
      .order('event_date', { ascending: false })
      .limit(200);
    setEvents((data || []) as { id: string; name: string; event_date: string }[]);
  };

  const addLeg = () => setFormData((prev) => ({ ...prev, legs: [...prev.legs, { from: '', to: '', km: 0 }] }));

  const removeLeg = (index: number) =>
    setFormData((prev) => ({ ...prev, legs: prev.legs.filter((_, i) => i !== index) }));

  const updateLeg = (index: number, patch: Partial<{ from: string; to: string; km: number }>) =>
    setFormData((prev) => ({
      ...prev,
      legs: prev.legs.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)),
    }));

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;

    const validation = validateReceiptUpload(file);
    if (!validation.ok) {
      toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' });
      return;
    }

    setUploadingReceipt(true);
    try {
      const path = buildTransportReceiptPath(user.id, file.name);
      const { error } = await supabase.storage
        .from(FINANCE_RECEIPT_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setFormData((prev) => ({ ...prev, receipt_path: path }));
      toast({ title: 'Comprovante anexado', description: 'O arquivo foi enviado com segurança.' });
    } catch (error: any) {
      toast({ title: 'Erro no upload', description: error.message || 'Não foi possível enviar o comprovante.', variant: 'destructive' });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const openReceipt = async (path?: string | null) => {
    if (!path) return;
    const url = await getSignedStorageUrl(path, FINANCE_RECEIPT_BUCKET);
    if (!url) {
      toast({ title: 'Comprovante indisponível', description: 'Não foi possível gerar o link do arquivo.', variant: 'destructive' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      toast({ title: "Erro", description: "Usuário não autenticado", variant: "destructive" });
      return;
    }

    if (!canManage) {
      toast({
        title: "Sem permissão",
        description: "Seu perfil não pode cadastrar ou editar declarações de transporte.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.transport_date) {
      toast({ title: "Erro", description: "Informe a data de saída.", variant: "destructive" });
      return;
    }

    const errors = validateTransportForm(formData);
    if (errors.length > 0) {
      toast({ title: "Dados inválidos", description: errors.join(' '), variant: "destructive" });
      return;
    }

    const conflicts = findTransportConflicts(
      {
        id: editingTransport?.id,
        vehicle_plate: formData.vehicle_plate,
        driver_name: formData.driver_name,
        transport_date: formData.transport_date,
        arrival_date: formData.arrival_date || null,
        expected_return_date: formData.expected_return_date || null,
      },
      transports,
    );
    if (conflicts.length > 0) {
      toast({
        title: "Conflito de agenda",
        description: conflicts.map((c) => c.message).join(' '),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...transportFormToRecord(formData, {
          userId: editingTransport?.created_by || user.id,
          status: editingTransport ? editingTransport.status : 'planned',
        }),
        equipment_list: JSON.stringify([]),
        material_list: JSON.stringify(materialList),
      };

      if (editingTransport) {
        const { status, created_by, ...updatePayload } = payload as Record<string, unknown>;
        const { error } = await supabase
          .from('interstate_transports')
          .update(updatePayload)
          .eq('id', editingTransport.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('interstate_transports')
          .insert([payload as any]);
        if (error) throw error;
      }

      toast({
        title: "Sucesso",
        description: editingTransport ? "Declaração atualizada com sucesso!" : "Declaração cadastrada com sucesso!",
      });

      setShowDialog(false);
      resetForm();
      setMaterialList([]);
      await fetchTransports();
    } catch (error: any) {
      console.error('Erro ao salvar transporte:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar declaração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyTransportForm });
    setEditingTransport(null);
  };

  const handleEdit = (transport: TransportRecord) => {
    setEditingTransport(transport);
    setFormData(recordToTransportForm(transport as any));
    setMaterialList(Array.isArray(transport.material_list) ? (transport.material_list as MaterialItem[]) : []);
    setShowDialog(true);
  };


  const getStatusVariant = (status: string) => getTransportStatusVariant(normalizeTransportStatus(status)) as any;

  const getStatusLabel = (status: string) => getTransportStatusLabel(normalizeTransportStatus(status));

  const applyStatusChange = async (transport: TransportRecord, next: TransportStatus) => {
    if (!canManage) {
      toast({ title: 'Sem permissão', description: 'Seu perfil não pode alterar o status da viagem.', variant: 'destructive' });
      return;
    }
    if (!canTransitionTransportStatus(transport.status, next)) {
      toast({ title: 'Transição inválida', description: 'Este status não pode ser aplicado à viagem atual.', variant: 'destructive' });
      return;
    }
    try {
      const payload: Record<string, unknown> = { status: next };
      if (next === 'completed') payload.completed_at = new Date().toISOString();
      if (next === 'cancelled') payload.cancelled_at = new Date().toISOString();

      const { error } = await supabase.from('interstate_transports').update(payload).eq('id', transport.id);
      if (error) throw error;

      setTransports((prev) => prev.map((t) => (t.id === transport.id ? { ...t, status: next } : t)));
      toast({ title: 'Status atualizado', description: `Viagem marcada como ${getTransportStatusLabel(next)}.` });
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({ title: 'Erro', description: error.message || 'Não foi possível atualizar o status.', variant: 'destructive' });
    }
  };

  const requestStatusChange = (transport: TransportRecord, next: TransportStatus) => {
    if (isCriticalTransportTransition(next)) {
      setStatusChange({ transport, next });
      return;
    }
    void applyStatusChange(transport, next);
  };


  const getReturnStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'returned': return 'Retornado';
      case 'partial': return 'Parcial';
      default: return 'Pendente';
    }
  };

  const getReturnStatusVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'returned': return 'confirmed';
      case 'partial': return 'default';
      default: return 'outline';
    }
  };

  // Funções para gerenciar materiais
  const addMaterial = () => {
    if (!newMaterial.name.trim() || !newMaterial.category.trim()) return;
    
    const totalWeight = newMaterial.unit_weight * newMaterial.quantity;
    
    const material: MaterialItem = {
      id: Date.now().toString(),
      name: newMaterial.name,
      quantity: newMaterial.quantity,
      weight: totalWeight,
      unit_weight: newMaterial.unit_weight,
      description: newMaterial.description,
      serial_number: newMaterial.serial_number,
      condition: newMaterial.condition,
      value: newMaterial.value,
      category: newMaterial.category,
      brand: newMaterial.brand,
      model: newMaterial.model,
      origin_location: newMaterial.origin_location,
      destination_location: newMaterial.destination_location,
      insurance_value: newMaterial.insurance_value,
      notes: newMaterial.notes
    };
    
    setMaterialList([...materialList, material]);
    setNewMaterial({
      name: '',
      quantity: 1,
      weight: 0,
      unit_weight: 0,
      description: '',
      serial_number: '',
      condition: 'new',
      value: 0,
      category: '',
      brand: '',
      model: '',
      origin_location: '',
      destination_location: '',
      insurance_value: 0,
      notes: ''
    });
  };

  const removeMaterial = (id: string) => {
    setMaterialList(materialList.filter(m => m.id !== id));
  };

  const handleMaterialSubmit = async () => {
    if (!selectedTransport) {
      console.error('Nenhum transporte selecionado para salvar materiais');
      return;
    }
    
    console.log('Iniciando salvamento de materiais:', materialList);
    console.log('Transporte selecionado:', selectedTransport.id);
    
    try {
      const { data, error } = await supabase
        .from('interstate_transports')
        .update({ material_list: JSON.stringify(materialList) })
        .eq('id', selectedTransport.id)
        .select();

      if (error) {
        console.error('Erro no Supabase:', error);
        throw error;
      }
      
      console.log('Material salvo com sucesso:', data);
      
      toast({
        title: "Sucesso",
        description: "Lista de materiais atualizada com sucesso!",
      });
      
      setShowMaterialDialog(false);
      setMaterialList([]);
      setSelectedTransport(null);
      await fetchTransports(); // Aguardar a atualização da lista
    } catch (error) {
      console.error('Erro ao salvar materiais:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar lista de materiais",
        variant: "destructive",
      });
    }
  };

  // Função para atualizar status de retorno
  const handleReturnSubmit = async () => {
    if (!selectedTransport) return;
    
    try {
      const { error } = await supabase
        .from('interstate_transports')
        .update({
          return_status: returnData.return_status,
          return_date: returnData.return_date || null,
          return_notes: returnData.return_notes || null
        })
        .eq('id', selectedTransport.id);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Status de retorno atualizado com sucesso!",
      });
      
      setShowReturnDialog(false);
      setReturnData({ return_status: 'pending', return_date: '', return_notes: '' });
      setSelectedTransport(null);
      fetchTransports();
    } catch (error) {
      console.error('Erro ao atualizar retorno:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status de retorno",
        variant: "destructive",
      });
    }
  };

  // Remover declaração
  const handleDelete = async (id: string) => {
    try {
      if (!canManage) {
        toast({ title: 'Sem permissão', description: 'Seu perfil não pode remover declarações.', variant: 'destructive' });
        return;
      }


      const { error } = await supabase
        .from('interstate_transports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransports((prev) => prev.filter((t) => t.id !== id));
      toast({
        title: 'Removido',
        description: 'Declaração removida com sucesso.',
      });
    } catch (error: any) {
      console.error('Erro ao remover declaração:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível remover a declaração.',
        variant: 'destructive',
      });
    }
  };

  // Função para gerar nota fiscal de transporte
  const printInvoice = async (transport: TransportRecord) => {
    console.log('Iniciando geração da nota fiscal:', transport.id);
    
    try {
      const doc = new jsPDF({
        compress: true
      });
      console.log('jsPDF criado com sucesso');
      
      let currentY = 20;
      
      // Cabeçalho da empresa
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(companySettings?.company_name || 'Empresa', 105, currentY, { align: 'center' });
      currentY += 10;
      
      if (companySettings?.cnpj) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`CNPJ: ${companySettings.cnpj}`, 105, currentY, { align: 'center' });
        currentY += 8;
      }
      
      if (companySettings?.address) {
        doc.setFontSize(10);
        doc.text(companySettings.address, 105, currentY, { align: 'center' });
        currentY += 6;
      }
      
      if (companySettings?.phone || companySettings?.email) {
        doc.setFontSize(10);
        const contact = [companySettings?.phone, companySettings?.email].filter(Boolean).join(' - ');
        doc.text(contact, 105, currentY, { align: 'center' });
        currentY += 15;
      }
      
      // Título do documento
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('NOTA FISCAL DE TRANSPORTE', 105, currentY, { align: 'center' });
      currentY += 10;
      
      doc.setFontSize(12);
      doc.text(`NF Nº: ${transport.invoice_number || 'SEM NÚMERO'}`, 105, currentY, { align: 'center' });
      currentY += 20;
      
      // Dados do transportador
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('DADOS DO TRANSPORTADOR:', 20, currentY);
      currentY += 8;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Empresa: ${companySettings?.company_name || 'N/A'}`, 20, currentY);
      currentY += 6;
      doc.text(`CNPJ: ${companySettings?.cnpj || 'N/A'}`, 20, currentY);
      currentY += 6;
      doc.text(`Endereço: ${companySettings?.address || 'N/A'}`, 20, currentY);
      currentY += 15;
      
      // Dados do frete
      doc.setFont(undefined, 'bold');
      doc.text('DADOS DO FRETE:', 20, currentY);
      currentY += 8;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Origem: ${transport.origin_state || 'N/A'}`, 20, currentY);
      currentY += 6;
      doc.text(`Destino: ${transport.destination}`, 20, currentY);
      currentY += 6;
      doc.text(`Data do Transporte: ${new Date(transport.transport_date).toLocaleDateString('pt-BR')}`, 20, currentY);
      currentY += 6;
      doc.text(`Placa do Veículo: ${transport.vehicle_plate}`, 20, currentY);
      currentY += 6;
      doc.text(`Motorista: ${transport.driver_name}`, 20, currentY);
      if (transport.driver_cpf) {
        currentY += 6;
        doc.text(`CPF: ${transport.driver_cpf}`, 20, currentY);
      }
      currentY += 15;
      
      // Discriminação dos serviços
      doc.setFont(undefined, 'bold');
      doc.text('DISCRIMINAÇÃO DOS SERVIÇOS:', 20, currentY);
      currentY += 8;
      
      doc.setFont(undefined, 'normal');
      doc.text(`Descrição: Transporte de ${transport.cargo_type || 'mercadorias'}`, 20, currentY);
      currentY += 6;
      doc.text(`Peso Total: ${transport.cargo_weight || 0} kg`, 20, currentY);
      currentY += 6;
      doc.text(`Valor da Mercadoria: R$ ${(transport.cargo_value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
      currentY += 15;
      
      // Valores
      doc.setFont(undefined, 'bold');
      doc.text('VALORES:', 20, currentY);
      currentY += 8;
      
      doc.setFont(undefined, 'normal');
      const freightValue = transport.estimated_cost || (transport.cargo_value || 0) * 0.05; // 5% do valor da mercadoria
      doc.text(`Valor do Frete: R$ ${freightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
      currentY += 6;
      doc.text(`Base de Cálculo ICMS: R$ ${freightValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
      currentY += 6;
      const icms = freightValue * 0.12; // 12% de ICMS
      doc.text(`ICMS (12%): R$ ${icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
      currentY += 6;
      const totalValue = freightValue - icms;
      doc.setFont(undefined, 'bold');
      doc.text(`VALOR TOTAL: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
      currentY += 20;
      
      // Observações
      if (transport.notes) {
        doc.setFont(undefined, 'bold');
        doc.text('OBSERVAÇÕES:', 20, currentY);
        currentY += 8;
        
        doc.setFont(undefined, 'normal');
        const notes = doc.splitTextToSize(transport.notes, 170);
        doc.text(notes, 20, currentY);
        currentY += notes.length * 6 + 15;
      }
      
      // Assinatura
      currentY += 20;
      doc.text('_____________________________', 20, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.text('Assinatura do Responsável', 20, currentY);
      
      doc.text('_____________________________', 120, currentY - 6);
      doc.text('Data: ___/___/______', 120, currentY);
      
      // Data de emissão
      currentY += 20;
      doc.setFontSize(10);
      doc.text(`Nota Fiscal emitida em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, currentY, { align: 'center' });
      
      console.log('Conteúdo da nota fiscal adicionado ao PDF');
      
      // Salvar o PDF
      const fileName = `nota-fiscal-transporte-${transport.vehicle_plate}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      console.log('Nota fiscal salva com sucesso:', fileName);
      
      toast({
        title: "Sucesso",
        description: "Nota fiscal gerada com sucesso!",
      });
      
    } catch (error) {
      console.error('Erro ao gerar nota fiscal:', error);
      toast({
        title: "Erro",
        description: `Erro ao gerar a nota fiscal: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  // Função para imprimir declaração com papel timbrado
  const printDeclaration = async (transport: TransportRecord) => {
    console.log('Iniciando impressão da declaração:', transport.id);
    
    try {
      const doc = new jsPDF({
        compress: true
      });
      console.log('jsPDF criado com sucesso');
      
      let currentY = 20;
      
      // Cabeçalho da empresa
      doc.setFontSize(18);
      doc.setFont(undefined, 'bold');
      doc.text(companySettings?.company_name || 'Empresa', 105, currentY, { align: 'center' });
      currentY += 10;
      
      if (companySettings?.tagline) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(companySettings.tagline, 105, currentY, { align: 'center' });
        currentY += 8;
      }
      
      if (companySettings?.address) {
        doc.setFontSize(10);
        doc.text(companySettings.address, 105, currentY, { align: 'center' });
        currentY += 6;
      }
      
      if (companySettings?.phone || companySettings?.email) {
        doc.setFontSize(10);
        const contact = [companySettings?.phone, companySettings?.email].filter(Boolean).join(' - ');
        doc.text(contact, 105, currentY, { align: 'center' });
        currentY += 15;
      }
      
      // Título do documento
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('DECLARAÇÃO DE TRANSPORTE', 105, currentY, { align: 'center' });
      currentY += 20;
      
      // Informações do transporte
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('DADOS DO TRANSPORTE:', 20, currentY);
      currentY += 8;
      
      doc.setFont(undefined, 'normal');
      const origin = [transport.origin_city, transport.origin_state].filter(Boolean).join('/') || 'N/A';
      const dest = [transport.destination, transport.destination_state].filter(Boolean).join('/');
      doc.text(`Origem: ${origin}`, 20, currentY);
      currentY += 6;
      doc.text(`Destino: ${dest}`, 20, currentY);
      currentY += 6;
      doc.text(
        `Saída: ${formatLocalDate(transport.transport_date)}${transport.departure_time ? ` às ${String(transport.departure_time).slice(0, 5)}` : ''}`,
        20,
        currentY,
      );
      currentY += 6;
      if (transport.arrival_date) {
        doc.text(
          `Chegada: ${formatLocalDate(transport.arrival_date)}${transport.arrival_time ? ` às ${String(transport.arrival_time).slice(0, 5)}` : ''}`,
          20,
          currentY,
        );
        currentY += 6;
      }
      if (transport.expected_return_date) {
        doc.text(`Retorno previsto: ${formatLocalDate(transport.expected_return_date)}`, 20, currentY);
        currentY += 6;
      }
      if (Number(transport.distance_km) > 0) {
        doc.text(`Distância: ${Number(transport.distance_km).toLocaleString('pt-BR')} km`, 20, currentY);
        currentY += 6;
      }
      if (Array.isArray(transport.legs) && transport.legs.length > 0) {
        const legsText = transport.legs
          .map((leg: any) => `${leg.from || '?'} → ${leg.to || '?'}${leg.km ? ` (${leg.km} km)` : ''}`)
          .join('; ');
        const legLines = doc.splitTextToSize(`Trechos: ${legsText}`, 170);
        doc.text(legLines, 20, currentY);
        currentY += legLines.length * 6;
      }
      doc.text(`Motorista: ${transport.driver_name}`, 20, currentY);
      currentY += 6;
      if (transport.driver_cpf) {
        doc.text(`CPF do Motorista: ${transport.driver_cpf}`, 20, currentY);
        currentY += 6;
      }
      if (transport.driver_phone) {
        doc.text(`Telefone do Motorista: ${transport.driver_phone}`, 20, currentY);
        currentY += 6;
      }
      if (Array.isArray(transport.helpers) && transport.helpers.length > 0) {
        doc.text(`Ajudantes: ${transport.helpers.join(', ')}`, 20, currentY);
        currentY += 6;
      }
      doc.text(
        `Veículo: ${transport.vehicle_plate}${transport.vehicle_model ? ` - ${transport.vehicle_model}` : ''}`,
        20,
        currentY,
      );
      currentY += 6;
      if (transport.vehicle_capacity_kg) {
        doc.text(`Capacidade do Veículo: ${transport.vehicle_capacity_kg} kg`, 20, currentY);
        currentY += 6;
      }

      if (transport.cargo_type) {
        doc.text(`Tipo de Carga: ${transport.cargo_type}`, 20, currentY);
        currentY += 6;
      }
      
      if (transport.cargo_weight) {
        doc.text(`Peso da Carga: ${transport.cargo_weight} kg`, 20, currentY);
        currentY += 6;
      }
      
      if (transport.cargo_value) {
        doc.text(`Valor da Carga: R$ ${transport.cargo_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20, currentY);
        currentY += 6;
      }
      
      if (transport.invoice_number) {
        doc.text(`Número da Nota Fiscal: ${transport.invoice_number}`, 20, currentY);
        currentY += 6;
      }

      // Resumo financeiro apenas para perfis autorizados
      if (canViewValues) {
        const totals = calculateTransportTotals(transport as any);
        if (totals.totalCostCents > 0 || totals.revenueCents > 0) {
          currentY += 4;
          doc.setFont(undefined, 'bold');
          doc.text('RESUMO FINANCEIRO:', 20, currentY);
          currentY += 8;
          doc.setFont(undefined, 'normal');
          doc.text(`Combustível: ${formatCents(totals.fuelCents)}`, 20, currentY);
          currentY += 6;
          doc.text(`Custo total: ${formatCents(totals.totalCostCents)}`, 20, currentY);
          currentY += 6;
          doc.text(`Adiantamento: ${formatCents(Number(transport.advance_cents || 0))}`, 20, currentY);
          currentY += 6;
          doc.text(`Saldo a pagar: ${formatCents(totals.balanceCents)}`, 20, currentY);
          currentY += 6;
          doc.text(`Receita: ${formatCents(totals.revenueCents)}`, 20, currentY);
          currentY += 6;
          doc.text(`Margem: ${formatCents(totals.marginCents)} (${totals.marginPercent}%)`, 20, currentY);
          currentY += 6;
        }
      }

      
      currentY += 10;
      
      // Lista de equipamentos
      if (transport.equipment_list && transport.equipment_list.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('EQUIPAMENTOS:', 20, currentY);
        currentY += 8;
        
        doc.setFont(undefined, 'normal');
        transport.equipment_list.forEach((equipment: any, index: number) => {
          doc.text(`${index + 1}. ${equipment.name} - Quantidade: ${equipment.quantity}`, 20, currentY);
          currentY += 6;
        });
        currentY += 5;
      }
      
      // Lista de materiais
      if (transport.material_list && transport.material_list.length > 0) {
        doc.setFont(undefined, 'bold');
        doc.text('MATERIAIS:', 20, currentY);
        currentY += 8;
        
        doc.setFont(undefined, 'normal');
        transport.material_list.forEach((material: any, index: number) => {
          doc.text(`${index + 1}. ${material.name} - Quantidade: ${material.quantity}`, 20, currentY);
          currentY += 6;
        });
        currentY += 5;
      }
      
      if (transport.notes) {
        doc.setFont(undefined, 'bold');
        doc.text('OBSERVAÇÕES:', 20, currentY);
        currentY += 8;
        
        doc.setFont(undefined, 'normal');
        const notes = doc.splitTextToSize(transport.notes, 170);
        doc.text(notes, 20, currentY);
        currentY += notes.length * 6 + 10;
      }
      
      // Status
      doc.setFont(undefined, 'bold');
      doc.text(`STATUS: ${getTransportStatusLabel(normalizeTransportStatus(transport.status)).toUpperCase()}`, 20, currentY);
      currentY += 15;
      
      // Assinatura
      currentY += 20;
      doc.text('_____________________________', 20, currentY);
      currentY += 6;
      doc.setFont(undefined, 'normal');
      doc.text('Responsável pelo Transporte', 20, currentY);
      
      // Data de geração
      currentY += 20;
      doc.setFontSize(10);
      doc.text(`Documento gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, currentY, { align: 'center' });
      
      console.log('Conteúdo adicionado ao PDF');
      
      // Salvar o PDF
      const fileName = `declaracao-transporte-${transport.vehicle_plate}-${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(fileName);
      console.log('PDF salvo com sucesso:', fileName);
      
      toast({
        title: "Sucesso",
        description: "Declaração gerada com sucesso!",
      });
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "Erro",
        description: `Erro ao gerar a declaração: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    }
  };

  const openMaterialDialog = (transport: TransportRecord) => {
    setSelectedTransport(transport);
    setMaterialList(transport.material_list || []);
    setShowMaterialDialog(true);
  };

  const openReturnDialog = (transport: TransportRecord) => {
    setSelectedTransport(transport);
    setReturnData({
      return_status: transport.return_status || 'pending',
      return_date: transport.return_date || '',
      return_notes: transport.return_notes || ''
    });
    setShowReturnDialog(true);
  };

  // Calcular estatísticas e aplicar busca/filtros/ordenação/paginação
  const filteredTransports = filterTransports(transports, { search: searchTerm, status: statusFilter });
  const sortedTransports = sortTransports(filteredTransports as any[], sortKey, sortDirection) as TransportRecord[];
  const pageResult = paginateTransports(sortedTransports, page);
  const totalDeclarations = transports.length;
  const summary = summarizeTransports(transports as any[]);
  const pendingDeclarations = transports.filter(t => ['planned', 'in_transit'].includes(normalizeTransportStatus(t.status))).length;
  const approvedDeclarations = transports.filter(t => normalizeTransportStatus(t.status) === 'completed').length;

  const formCosts = transportFormCosts(formData);
  const formTotals = calculateTransportTotals(formCosts);
  const liveConflicts = formData.transport_date
    ? findTransportConflicts(
        {
          id: editingTransport?.id,
          vehicle_plate: formData.vehicle_plate,
          driver_name: formData.driver_name,
          transport_date: formData.transport_date,
          arrival_date: formData.arrival_date || null,
          expected_return_date: formData.expected_return_date || null,
        },
        transports,
      )
    : [];

  const setField = <K extends keyof TransportFormValues>(key: K, value: TransportFormValues[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const money = (cents: number) => (canViewValues ? formatCents(cents) : '---');

  const toggleSort = (key: TransportSortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(1);
  };

  return (
    <div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="viagens" className="space-y-6">
          <TabsList>
            <TabsTrigger value="viagens">Viagens</TabsTrigger>
            <TabsTrigger value="fiscal">Documento Fiscal</TabsTrigger>
          </TabsList>

          <TabsContent value="fiscal">
            <FiscalDocumentsPanel transports={transports} />
          </TabsContent>

          <TabsContent value="viagens" className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Declarações</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalDeclarations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Em aberto</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{pendingDeclarations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent>
              <div className="text-2xl font-bold text-success">{approvedDeclarations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo total</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{money(summary.totalCostCents)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margem</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.marginCents < 0 ? 'text-destructive' : 'text-success'}`}>
                {money(summary.marginCents)}
              </div>
              <p className="text-xs text-muted-foreground">Receita {money(summary.revenueCents)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {editingTransport ? 'Editar Declaração de Transporte' : 'Nova Declaração de Transporte Interestadual'}
            </CardTitle>
            <CardDescription>
              Preencha rota, veículo, equipe e custos da viagem. Os valores são calculados automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Rota */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Rota</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="origin_city">Cidade de Origem</Label>
                    <Input
                      id="origin_city"
                      value={formData.origin_city}
                      onChange={(e) => setField('origin_city', e.target.value)}
                      placeholder="Ex: Goiânia"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="origin_state">UF de Origem</Label>
                    <Select value={formData.origin_state} onValueChange={(value) => setField('origin_state', value)}>
                      <SelectTrigger id="origin_state">
                        <SelectValue placeholder="Selecione a UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state.value} value={state.value}>{state.value} - {state.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">Cidade de Destino *</Label>
                    <Input
                      id="destination"
                      value={formData.destination}
                      onChange={(e) => setField('destination', e.target.value)}
                      placeholder="Ex: São Paulo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination_state">UF de Destino</Label>
                    <Select value={formData.destination_state} onValueChange={(value) => setField('destination_state', value)}>
                      <SelectTrigger id="destination_state">
                        <SelectValue placeholder="Selecione a UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {brazilianStates.map((state) => (
                          <SelectItem key={state.value} value={state.value}>{state.value} - {state.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance_km">Distância total (km)</Label>
                    <Input
                      id="distance_km"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.distance_km}
                      onChange={(e) => setField('distance_km', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                    <Label>Trechos da viagem</Label>
                    <div className="space-y-2">
                      {formData.legs.map((leg, index) => (
                        <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_100px_auto] gap-2">
                          <Input
                            aria-label={`Trecho ${index + 1} origem`}
                            value={leg.from}
                            onChange={(e) => updateLeg(index, { from: e.target.value })}
                            placeholder="De"
                          />
                          <Input
                            aria-label={`Trecho ${index + 1} destino`}
                            value={leg.to}
                            onChange={(e) => updateLeg(index, { to: e.target.value })}
                            placeholder="Até"
                          />
                          <Input
                            aria-label={`Trecho ${index + 1} km`}
                            type="number"
                            min="0"
                            value={leg.km}
                            onChange={(e) => updateLeg(index, { km: Number(e.target.value) })}
                            placeholder="km"
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => removeLeg(index)} title="Remover trecho">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addLeg}>
                        <Plus className="w-4 h-4 mr-2" /> Adicionar trecho
                      </Button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Datas e horários */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Datas e horários</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="transport_date">Data de saída *</Label>
                    <Input
                      id="transport_date"
                      type="date"
                      value={formData.transport_date}
                      onChange={(e) => setField('transport_date', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departure_time">Hora de saída</Label>
                    <Input
                      id="departure_time"
                      type="time"
                      value={formData.departure_time}
                      onChange={(e) => setField('departure_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival_date">Data de chegada</Label>
                    <Input
                      id="arrival_date"
                      type="date"
                      value={formData.arrival_date}
                      onChange={(e) => setField('arrival_date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival_time">Hora de chegada</Label>
                    <Input
                      id="arrival_time"
                      type="time"
                      value={formData.arrival_time}
                      onChange={(e) => setField('arrival_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_return_date">Retorno previsto</Label>
                    <Input
                      id="expected_return_date"
                      type="date"
                      value={formData.expected_return_date}
                      onChange={(e) => setField('expected_return_date', e.target.value)}
                    />
                  </div>
                </div>
              </section>

              {/* Veículo e equipe */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Veículo e equipe</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_plate">Placa do Veículo *</Label>
                    <Input
                      id="vehicle_plate"
                      value={formData.vehicle_plate}
                      onChange={(e) => setField('vehicle_plate', e.target.value)}
                      placeholder="ABC1D23"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_model">Modelo do Veículo</Label>
                    <Input
                      id="vehicle_model"
                      value={formData.vehicle_model}
                      onChange={(e) => setField('vehicle_model', e.target.value)}
                      placeholder="Ex: Sprinter 415"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_capacity_kg">Capacidade (kg)</Label>
                    <Input
                      id="vehicle_capacity_kg"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.vehicle_capacity_kg}
                      onChange={(e) => setField('vehicle_capacity_kg', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_name">Motorista *</Label>
                    <Input
                      id="driver_name"
                      value={formData.driver_name}
                      onChange={(e) => setField('driver_name', e.target.value)}
                      placeholder="Nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_cpf">CPF do Motorista</Label>
                    <Input
                      id="driver_cpf"
                      value={formData.driver_cpf}
                      onChange={(e) => setField('driver_cpf', e.target.value)}
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_phone">Telefone do Motorista</Label>
                    <Input
                      id="driver_phone"
                      value={formData.driver_phone}
                      onChange={(e) => setField('driver_phone', e.target.value)}
                      placeholder="(62) 90000-0000"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="helpers">Ajudantes (separados por vírgula)</Label>
                    <Input
                      id="helpers"
                      value={formData.helpers.join(', ')}
                      onChange={(e) => setField('helpers', e.target.value.split(',').map((h) => h.trim()).filter(Boolean))}
                      placeholder="Ex: João, Pedro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event_id">Evento / Locação</Label>
                    <Select
                      value={formData.event_id || 'none'}
                      onValueChange={(value) => setField('event_id', value === 'none' ? '' : value)}
                    >
                      <SelectTrigger id="event_id">
                        <SelectValue placeholder="Sem vínculo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem vínculo</SelectItem>
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} — {formatLocalDate(event.event_date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              {/* Carga */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Carga</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cargo_type">Tipo de Mercadoria</Label>
                    <Input
                      id="cargo_type"
                      value={formData.cargo_type}
                      onChange={(e) => setField('cargo_type', e.target.value)}
                      placeholder="Descrição da mercadoria"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo_weight">Peso (kg)</Label>
                    <Input
                      id="cargo_weight"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cargo_weight}
                      onChange={(e) => setField('cargo_weight', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cargo_value">Valor da Mercadoria</Label>
                    <CurrencyInput
                      id="cargo_value"
                      value={formData.cargo_value}
                      onChange={(value) => setField('cargo_value', value)}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice_number">Número da Nota Fiscal</Label>
                    <Input
                      id="invoice_number"
                      value={formData.invoice_number}
                      onChange={(e) => setField('invoice_number', e.target.value)}
                      placeholder="000000"
                    />
                  </div>
                </div>
              </section>

              {/* Custos e receita */}
              {canViewValues && (
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase">Custos e receita</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fuel_consumption_kmpl">Consumo (km/l)</Label>
                      <Input
                        id="fuel_consumption_kmpl"
                        type="number"
                        min="0"
                        step="0.1"
                        value={formData.fuel_consumption_kmpl}
                        onChange={(e) => setField('fuel_consumption_kmpl', Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel_price">Preço do litro</Label>
                      <CurrencyInput
                        id="fuel_price"
                        value={formData.fuel_price}
                        onChange={(value) => setField('fuel_price', value)}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuel_cost">Combustível (deixe 0 para calcular)</Label>
                      <CurrencyInput
                        id="fuel_cost"
                        value={formData.fuel_cost}
                        onChange={(value) => setField('fuel_cost', value)}
                        placeholder="R$ 0,00"
                      />
                      <p className="text-xs text-muted-foreground">Estimado: {formatCents(formTotals.fuelCents)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toll">Pedágios</Label>
                      <CurrencyInput id="toll" value={formData.toll} onChange={(v) => setField('toll', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lodging">Hospedagem</Label>
                      <CurrencyInput id="lodging" value={formData.lodging} onChange={(v) => setField('lodging', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meals">Alimentação</Label>
                      <CurrencyInput id="meals" value={formData.meals} onChange={(v) => setField('meals', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="daily_rate">Diária do motorista</Label>
                      <CurrencyInput id="daily_rate" value={formData.daily_rate} onChange={(v) => setField('daily_rate', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maintenance">Manutenção</Label>
                      <CurrencyInput id="maintenance" value={formData.maintenance} onChange={(v) => setField('maintenance', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="freight">Frete terceirizado</Label>
                      <CurrencyInput id="freight" value={formData.freight} onChange={(v) => setField('freight', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="extra">Outros custos</Label>
                      <CurrencyInput id="extra" value={formData.extra} onChange={(v) => setField('extra', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="advance">Adiantamento</Label>
                      <CurrencyInput id="advance" value={formData.advance} onChange={(v) => setField('advance', v)} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="revenue">Receita da viagem</Label>
                      <CurrencyInput id="revenue" value={formData.revenue} onChange={(v) => setField('revenue', v)} placeholder="R$ 0,00" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Combustível</span>
                      <div className="font-semibold">{formatCents(formTotals.fuelCents)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo total</span>
                      <div className="font-semibold text-destructive">{formatCents(formTotals.totalCostCents)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Saldo a pagar</span>
                      <div className="font-semibold">{formatCents(formTotals.balanceCents)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Margem</span>
                      <div className={`font-semibold ${formTotals.marginCents < 0 ? 'text-destructive' : 'text-success'}`}>
                        {formatCents(formTotals.marginCents)} ({formTotals.marginPercent}%)
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Custo por km</span>
                      <div className="font-semibold">{formatCents(formTotals.costPerKmCents)}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Comprovante */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Comprovante</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receipt">Anexo (JPG, PNG, WEBP ou PDF até 10 MB)</Label>
                    <Input
                      id="receipt"
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={handleReceiptUpload}
                      disabled={uploadingReceipt}
                    />
                    {formData.receipt_path && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground truncate">{formData.receipt_path.split('/').pop()}</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => openReceipt(formData.receipt_path)}>
                          Visualizar
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setField('receipt_path', null)}>
                          Remover
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setField('notes', e.target.value)}
                      placeholder="Observações adicionais (opcional)"
                      rows={3}
                    />
                  </div>
                </div>
              </section>

              {liveConflicts.length > 0 && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    {liveConflicts.map((conflict, index) => (
                      <p key={index}>{conflict.message}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" className="flex-1" disabled={!canManage || saving}>
                  {saving ? 'Salvando...' : editingTransport ? 'Atualizar Declaração' : 'Cadastrar Declaração'}
                </Button>
                {editingTransport && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar edição
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Table Card */}
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Declarações Cadastradas ({filteredTransports.length}/{totalDeclarations})
            </CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Buscar declarações"
                  className="pl-9"
                  placeholder="Buscar por placa, motorista, destino ou NF"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
                <SelectTrigger className="sm:w-56" aria-label="Filtrar por status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="planned">Planejada</SelectItem>
                  <SelectItem value="in_transit">Em trânsito</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : loadError ? (
              <div className="text-center py-8 space-y-3">
                <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
                <p className="text-destructive">{loadError}</p>
                <Button variant="outline" onClick={() => { setLoading(true); void fetchTransports(); }}>
                  Tentar novamente
                </Button>
              </div>
            ) : filteredTransports.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma declaração encontrada</p>
                <p className="text-sm text-muted-foreground">
                  {transports.length === 0 ? 'Cadastre uma nova declaração acima' : 'Ajuste a busca ou o filtro de status'}
                </p>

              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button type="button" className="font-medium hover:underline" onClick={() => toggleSort('transport_date')}>
                          Data {sortKey === 'transport_date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-medium hover:underline" onClick={() => toggleSort('vehicle_plate')}>
                          Placa {sortKey === 'vehicle_plate' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button type="button" className="font-medium hover:underline" onClick={() => toggleSort('driver_name')}>
                          Motorista {sortKey === 'driver_name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </TableHead>
                      <TableHead>Rota</TableHead>
                      <TableHead>Km</TableHead>
                      <TableHead>Materiais</TableHead>
                      <TableHead>Peso (kg)</TableHead>
                      <TableHead>
                        <button type="button" className="font-medium hover:underline" onClick={() => toggleSort('cost')}>
                          Custo {sortKey === 'cost' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>
                        <button type="button" className="font-medium hover:underline" onClick={() => toggleSort('status')}>
                          Status {sortKey === 'status' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </TableHead>
                      <TableHead>Retorno</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageResult.items.map((transport) => {
                      const totals = calculateTransportTotals(transport as any);
                      return (
                      <TableRow key={transport.id}>
                        <TableCell>
                          <div>{formatLocalDate(transport.transport_date)}</div>
                          {transport.expected_return_date && (
                            <div className="text-xs text-muted-foreground">
                              Retorno: {formatLocalDate(transport.expected_return_date)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{transport.vehicle_plate}</div>
                          {transport.vehicle_model && (
                            <div className="text-xs text-muted-foreground">{transport.vehicle_model}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>{transport.driver_name}</div>
                          {transport.driver_phone && (
                            <div className="text-xs text-muted-foreground">{transport.driver_phone}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {[transport.origin_city, transport.origin_state].filter(Boolean).join('/')} → {[transport.destination, transport.destination_state].filter(Boolean).join('/')}
                        </TableCell>
                        <TableCell>{Number(transport.distance_km || 0).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>
                          {transport.material_list && transport.material_list.length > 0 ? (
                            <div className="text-sm">
                              <div className="font-medium">
                                {transport.material_list.reduce((sum: number, m: any) => sum + (m.quantity || 0), 0)} itens
                              </div>
                              <div className="text-muted-foreground">
                                {transport.material_list.reduce((sum: number, m: any) => sum + (m.weight || 0), 0).toFixed(1)} kg
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nenhum</span>
                          )}
                        </TableCell>
                        <TableCell>{transport.cargo_weight}</TableCell>
                        <TableCell>{money(totals.totalCostCents)}</TableCell>
                        <TableCell className={canViewValues && totals.marginCents < 0 ? 'text-destructive' : ''}>
                          {money(totals.marginCents)}
                        </TableCell>
                        <TableCell>{transport.invoice_number}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(transport.status)}>
                            {getStatusLabel(transport.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getReturnStatusVariant(transport.return_status || 'pending')}>
                            {getReturnStatusLabel(transport.return_status || 'pending')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            {canManage && nextTransportStatuses(transport.status).map((next) => (
                              <Button
                                key={next}
                                variant="outline"
                                size="sm"
                                onClick={() => requestStatusChange(transport, next)}
                                title={`Marcar como ${getTransportStatusLabel(next)}`}
                              >
                                {getTransportStatusLabel(next)}
                              </Button>
                            ))}
                            {canManage && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(transport)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {transport.receipt_path && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openReceipt(transport.receipt_path)}
                                title="Ver comprovante"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openMaterialDialog(transport)}
                              title="Gerenciar Materiais"
                            >
                              <Package className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReturnDialog(transport)}
                              title="Status de Retorno"
                            >
                              <Truck className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => printDeclaration(transport)}
                              title="Imprimir Declaração"
                            >
                              <Printer className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => printInvoice(transport)}
                              title="Gerar Nota Fiscal"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            {canManage && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteTarget(transport)}
                                title="Remover declaração"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>

                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Página {pageResult.page} de {pageResult.totalPages} — {pageResult.total} declarações
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pageResult.page <= 1}
                      onClick={() => setPage(pageResult.page - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pageResult.page >= pageResult.totalPages}
                      onClick={() => setPage(pageResult.page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        {/* Dialog para Gerenciar Materiais */}
        <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Lista de Materiais</DialogTitle>
              <DialogDescription>
                Adicione ou remova materiais que estão sendo transportados
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Formulário para adicionar material */}
              <ScrollArea className="h-96">
                <div className="p-6 border rounded-lg bg-card space-y-6">
                  <h4 className="text-lg font-semibold">Adicionar Novo Material</h4>
                  
                  {/* Informações Básicas */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm text-muted-foreground">Informações Básicas</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material_name">Nome do Material *</Label>
                        <Input
                          id="material_name"
                          value={newMaterial.name}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ex: Equipamento de som"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_category">Categoria *</Label>
                        <Select
                          value={newMaterial.category}
                          onValueChange={(value) => setNewMaterial(prev => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Equipamento de Audio">Equipamento de Audio</SelectItem>
                            <SelectItem value="Equipamento de Video">Equipamento de Video</SelectItem>
                            <SelectItem value="Iluminação">Iluminação</SelectItem>
                            <SelectItem value="Mobiliário">Mobiliário</SelectItem>
                            <SelectItem value="Decoração">Decoração</SelectItem>
                            <SelectItem value="Estrutura">Estrutura</SelectItem>
                            <SelectItem value="Eletrônicos">Eletrônicos</SelectItem>
                            <SelectItem value="Ferramentas">Ferramentas</SelectItem>
                            <SelectItem value="Outros">Outros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_condition">Condição</Label>
                        <Select
                          value={newMaterial.condition}
                          onValueChange={(value) => setNewMaterial(prev => ({ ...prev, condition: value as 'new' | 'used' | 'damaged' }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Novo</SelectItem>
                            <SelectItem value="used">Usado</SelectItem>
                            <SelectItem value="damaged">Danificado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Especificações Técnicas */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm text-muted-foreground">Especificações Técnicas</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material_brand">Marca</Label>
                        <Input
                          id="material_brand"
                          value={newMaterial.brand}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, brand: e.target.value }))}
                          placeholder="Ex: Yamaha"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_model">Modelo</Label>
                        <Input
                          id="material_model"
                          value={newMaterial.model}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="Ex: MG10XU"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_serial">Nº de Série</Label>
                        <Input
                          id="material_serial"
                          value={newMaterial.serial_number}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, serial_number: e.target.value }))}
                          placeholder="Número de série"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_quantity">Quantidade</Label>
                        <Input
                          id="material_quantity"
                          type="number"
                          min="1"
                          value={newMaterial.quantity}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Peso e Valores */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm text-muted-foreground">Peso e Valores</h5>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material_unit_weight">Peso Unitário (kg)</Label>
                        <Input
                          id="material_unit_weight"
                          type="number"
                          min="0"
                          step="0.1"
                          value={newMaterial.unit_weight}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, unit_weight: Number(e.target.value) }))}
                          placeholder="0.0"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Peso Total (kg)</Label>
                        <Input
                          value={(newMaterial.unit_weight * newMaterial.quantity).toFixed(1)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_value">Valor Unitário</Label>
                        <CurrencyInput
                          id="material_value"
                          value={newMaterial.value}
                          onChange={(value) => setNewMaterial(prev => ({ ...prev, value }))}
                          placeholder="R$ 0,00"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_insurance">Valor do Seguro</Label>
                        <CurrencyInput
                          id="material_insurance"
                          value={newMaterial.insurance_value}
                          onChange={(value) => setNewMaterial(prev => ({ ...prev, insurance_value: value }))}
                          placeholder="R$ 0,00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Localização */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm text-muted-foreground">Localização</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material_origin">Local de Origem</Label>
                        <Input
                          id="material_origin"
                          value={newMaterial.origin_location}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, origin_location: e.target.value }))}
                          placeholder="Ex: Depósito Central"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_destination">Local de Destino</Label>
                        <Input
                          id="material_destination"
                          value={newMaterial.destination_location}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, destination_location: e.target.value }))}
                          placeholder="Ex: Local do Evento"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Descrição e Observações */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm text-muted-foreground">Observações</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="material_description">Descrição</Label>
                        <Textarea
                          id="material_description"
                          value={newMaterial.description}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Descrição detalhada do material"
                          rows={3}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_notes">Observações Especiais</Label>
                        <Textarea
                          id="material_notes"
                          value={newMaterial.notes}
                          onChange={(e) => setNewMaterial(prev => ({ ...prev, notes: e.target.value }))}
                          placeholder="Cuidados especiais, embalagem, etc."
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={addMaterial} className="w-full" size="lg">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Material à Lista
                  </Button>
                </div>
              </ScrollArea>

              {/* Lista de materiais */}
              {materialList.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">Materiais Adicionados ({materialList.length})</h4>
                    <div className="text-sm text-muted-foreground">
                      Peso total: {materialList.reduce((sum, m) => sum + m.weight, 0).toFixed(1)} kg | 
                      Valor total: {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(materialList.reduce((sum, m) => sum + (m.value * m.quantity), 0))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {materialList.map((material) => (
                      <Card key={material.id} className="p-4">
                        <div className="space-y-3">
                          {/* Linha principal com nome e ações */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <h5 className="font-semibold text-base">{material.name}</h5>
                              <Badge variant="outline">{material.category}</Badge>
                              <Badge 
                                variant={material.condition === 'new' ? 'default' : material.condition === 'used' ? 'secondary' : 'destructive'}
                              >
                                {material.condition === 'new' ? 'Novo' : material.condition === 'used' ? 'Usado' : 'Danificado'}
                              </Badge>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeMaterial(material.id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {/* Grade de informações */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Quantidade:</span>
                              <div className="font-medium">{material.quantity} un</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Peso Total:</span>
                              <div className="font-medium">{material.weight.toFixed(1)} kg</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Valor Unitário:</span>
                              <div className="font-medium">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(material.value)}
                              </div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Valor Total:</span>
                              <div className="font-medium">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(material.value * material.quantity)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Informações técnicas */}
                          {(material.brand || material.model || material.serial_number) && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm pt-2 border-t">
                              {material.brand && (
                                <div>
                                  <span className="text-muted-foreground">Marca:</span>
                                  <div className="font-medium">{material.brand}</div>
                                </div>
                              )}
                              {material.model && (
                                <div>
                                  <span className="text-muted-foreground">Modelo:</span>
                                  <div className="font-medium">{material.model}</div>
                                </div>
                              )}
                              {material.serial_number && (
                                <div>
                                  <span className="text-muted-foreground">Nº Série:</span>
                                  <div className="font-medium">{material.serial_number}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Localização */}
                          {(material.origin_location || material.destination_location) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-2 border-t">
                              {material.origin_location && (
                                <div>
                                  <span className="text-muted-foreground">Origem:</span>
                                  <div className="font-medium">{material.origin_location}</div>
                                </div>
                              )}
                              {material.destination_location && (
                                <div>
                                  <span className="text-muted-foreground">Destino:</span>
                                  <div className="font-medium">{material.destination_location}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Descrições */}
                          {(material.description || material.notes) && (
                            <div className="space-y-2 pt-2 border-t text-sm">
                              {material.description && (
                                <div>
                                  <span className="text-muted-foreground">Descrição:</span>
                                  <div className="text-muted-foreground">{material.description}</div>
                                </div>
                              )}
                              {material.notes && (
                                <div>
                                  <span className="text-muted-foreground">Observações:</span>
                                  <div className="text-muted-foreground">{material.notes}</div>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Seguro */}
                          {material.insurance_value > 0 && (
                            <div className="pt-2 border-t text-sm">
                              <span className="text-muted-foreground">Valor do Seguro:</span>
                              <div className="font-medium text-green-600">
                                {new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(material.insurance_value)}
                              </div>
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMaterialDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleMaterialSubmit}>
                Salvar Lista de Materiais
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog para Status de Retorno */}
        <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Status de Retorno</DialogTitle>
              <DialogDescription>
                Atualize o status de retorno do transporte
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="return_status">Status de Retorno</Label>
                <Select
                  value={returnData.return_status}
                  onValueChange={(value) => setReturnData(prev => ({ ...prev, return_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="returned">Retornado</SelectItem>
                    <SelectItem value="partial">Retorno Parcial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="return_date">Data de Retorno</Label>
                <Input
                  id="return_date"
                  type="date"
                  value={returnData.return_date}
                  onChange={(e) => setReturnData(prev => ({ ...prev, return_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="return_notes">Observações do Retorno</Label>
                <Textarea
                  id="return_notes"
                  value={returnData.return_notes}
                  onChange={(e) => setReturnData(prev => ({ ...prev, return_notes: e.target.value }))}
                  placeholder="Observações sobre o retorno dos materiais..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReturnSubmit}>
                Atualizar Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover declaração?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget
                  ? `A viagem ${deleteTarget.vehicle_plate} de ${formatLocalDate(deleteTarget.transport_date)} será removida permanentemente. Esta ação não pode ser desfeita.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  if (target) await handleDelete(target.id);
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmação de mudança crítica de status */}
        <AlertDialog open={!!statusChange} onOpenChange={(open) => !open && setStatusChange(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {statusChange ? `Marcar viagem como ${getTransportStatusLabel(statusChange.next)}?` : ''}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusChange
                  ? `Após ${statusChange.next === 'completed' ? 'concluir' : 'cancelar'}, a viagem ${statusChange.transport.vehicle_plate} não poderá mais mudar de status.`
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const change = statusChange;
                  setStatusChange(null);
                  if (change) await applyStatusChange(change.transport, change.next);
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
};