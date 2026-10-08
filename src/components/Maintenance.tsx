import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Plus, Edit, Trash2, Wrench, Search, Filter, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, getStatusVariant } from '@/lib/utils';
import { format, parseISO, addDays, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { PageActions } from "@/components/layout/PageHeader";
interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  equipment_name: string;
  maintenance_type: 'preventiva' | 'corretiva' | 'emergencial';
  status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
  priority: 'baixa' | 'normal' | 'alta' | 'critica';
  scheduled_date: string;
  completed_date?: string;
  description: string;
  problem_description?: string;
  solution_description?: string;
  cost: number;
  quantity: number;
  technician_name?: string;
  technician_contact?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  status: string;
  total_stock: number;
  available: number;
  rented: number;
  updated_at: string;
}

export const Maintenance = () => {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [maintenanceDialog, setMaintenanceDialog] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceRecord | null>(null);
  const [newMaintenance, setNewMaintenance] = useState<{
    equipment_id: string;
    equipment_name: string;
    maintenance_type: 'preventiva' | 'corretiva' | 'emergencial';
    status: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
    priority: 'baixa' | 'normal' | 'alta' | 'critica';
    scheduled_date: string;
    description: string;
    problem_description: string;
    solution_description: string;
    cost: number;
    quantity: number;
    technician_name: string;
    technician_contact: string;
  }>({
    equipment_id: '',
    equipment_name: '',
    maintenance_type: 'preventiva',
    status: 'agendada',
    priority: 'normal',
    scheduled_date: '',
    description: '',
    problem_description: '',
    solution_description: '',
    cost: 0,
    quantity: 1,
    technician_name: '',
    technician_contact: ''
  });

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      setMaintenanceRecords((data || []) as MaintenanceRecord[]);
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
      toast({
        title: "Erro ao carregar manutenções",
        description: "Não foi possível carregar os registros de manutenção.",
        variant: "destructive"
      });
    }
  };

  // Fetch equipment
  const fetchEquipment = async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast({
        title: "Erro ao carregar equipamentos",
        description: "Não foi possível carregar os equipamentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchMaintenanceRecords(), fetchEquipment()]);
    };
    loadData();
  }, []);

  // Real-time updates
  useEffect(() => {
    const maintenanceChannel = supabase
      .channel('maintenance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_records'
        },
        () => {
          console.log('Maintenance data updated, refreshing...');
          fetchMaintenanceRecords();
        }
      )
      .subscribe();

    const equipmentChannel = supabase
      .channel('equipment-maintenance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment'
        },
        () => {
          console.log('Equipment data updated, refreshing...');
          fetchEquipment();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(maintenanceChannel);
      supabase.removeChannel(equipmentChannel);
    };
  }, []);

  // Add new maintenance
  const addMaintenance = async () => {
    if (!newMaintenance.equipment_name || !newMaintenance.description || !newMaintenance.scheduled_date || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha equipamento, descrição e data agendada.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('maintenance_records')
        .insert({
          equipment_id: newMaintenance.equipment_id || null,
          equipment_name: newMaintenance.equipment_name,
          maintenance_type: newMaintenance.maintenance_type,
          status: newMaintenance.status,
          priority: newMaintenance.priority,
          scheduled_date: newMaintenance.scheduled_date,
          description: newMaintenance.description,
          problem_description: newMaintenance.problem_description || null,
          solution_description: newMaintenance.solution_description || null,
          cost: newMaintenance.cost,
          quantity: newMaintenance.quantity,
          technician_name: newMaintenance.technician_name || null,
          technician_contact: newMaintenance.technician_contact || null,
          created_by: user.id
        });

      if (error) throw error;

      await fetchMaintenanceRecords();
      resetForm();
      setMaintenanceDialog(false);

      toast({
        title: "Manutenção agendada",
        description: "A manutenção foi agendada com sucesso.",
      });
    } catch (error) {
      console.error('Error adding maintenance:', error);
      toast({
        title: "Erro ao agendar manutenção",
        description: "Não foi possível agendar a manutenção.",
        variant: "destructive"
      });
    }
  };

  // Update maintenance
  const updateMaintenance = async () => {
    if (!editingMaintenance || !newMaintenance.equipment_name || !newMaintenance.description || !newMaintenance.scheduled_date) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha equipamento, descrição e data agendada.",
        variant: "destructive"
      });
      return;
    }

    try {
      const updateData: any = {
        equipment_id: newMaintenance.equipment_id || null,
        equipment_name: newMaintenance.equipment_name,
        maintenance_type: newMaintenance.maintenance_type,
        status: newMaintenance.status,
        priority: newMaintenance.priority,
        scheduled_date: newMaintenance.scheduled_date,
        description: newMaintenance.description,
        problem_description: newMaintenance.problem_description || null,
        solution_description: newMaintenance.solution_description || null,
        cost: newMaintenance.cost,
        quantity: newMaintenance.quantity,
        technician_name: newMaintenance.technician_name || null,
        technician_contact: newMaintenance.technician_contact || null
      };

      // Set completed_date if status is 'concluida'
      if (newMaintenance.status === 'concluida' && editingMaintenance && editingMaintenance.status !== 'concluida') {
        updateData.completed_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('maintenance_records')
        .update(updateData)
        .eq('id', editingMaintenance.id);

      if (error) throw error;

      await fetchMaintenanceRecords();
      resetForm();
      setMaintenanceDialog(false);
      setEditingMaintenance(null);

      toast({
        title: "Manutenção atualizada",
        description: "A manutenção foi atualizada com sucesso.",
      });
    } catch (error) {
      console.error('Error updating maintenance:', error);
      toast({
        title: "Erro ao atualizar manutenção",
        description: "Não foi possível atualizar a manutenção.",
        variant: "destructive"
      });
    }
  };

  // Delete maintenance
  const deleteMaintenance = async (maintenanceId: string) => {
    try {
      const { error } = await supabase
        .from('maintenance_records')
        .delete()
        .eq('id', maintenanceId);

      if (error) throw error;

      await fetchMaintenanceRecords();

      toast({
        title: "Manutenção removida",
        description: "A manutenção foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting maintenance:', error);
      toast({
        title: "Erro ao remover manutenção",
        description: "Não foi possível remover a manutenção.",
        variant: "destructive"
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setNewMaintenance({
      equipment_id: '',
      equipment_name: '',
      maintenance_type: 'preventiva',
      status: 'agendada',
      priority: 'normal',
      scheduled_date: '',
      description: '',
      problem_description: '',
      solution_description: '',
      cost: 0,
      quantity: 1,
      technician_name: '',
      technician_contact: ''
    });
  };

  // Open edit dialog
  const openEditDialog = (maintenance: MaintenanceRecord) => {
    setEditingMaintenance(maintenance);
    setNewMaintenance({
      equipment_id: maintenance.equipment_id,
      equipment_name: maintenance.equipment_name,
      maintenance_type: maintenance.maintenance_type,
      status: maintenance.status,
      priority: maintenance.priority,
      scheduled_date: maintenance.scheduled_date,
      description: maintenance.description,
      problem_description: maintenance.problem_description || '',
      solution_description: maintenance.solution_description || '',
      cost: maintenance.cost,
      quantity: maintenance.quantity,
      technician_name: maintenance.technician_name || '',
      technician_contact: maintenance.technician_contact || ''
    });
    setMaintenanceDialog(true);
  };

  // Open add dialog
  const openAddDialog = () => {
    setEditingMaintenance(null);
    resetForm();
    setMaintenanceDialog(true);
  };


  // Filter maintenance records
  const filteredMaintenanceRecords = maintenanceRecords.filter(record => {
    const matchesSearch = record.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (record.technician_name && record.technician_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = selectedStatus === 'all' || record.status === selectedStatus;
    const matchesType = selectedType === 'all' || record.maintenance_type === selectedType;
    const matchesPriority = selectedPriority === 'all' || record.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesType && matchesPriority;
  });

  // Calculate statistics
  const stats = {
    total: maintenanceRecords.length,
    agendada: maintenanceRecords.filter(r => r.status === 'agendada').length,
    em_andamento: maintenanceRecords.filter(r => r.status === 'em_andamento').length,
    concluida: maintenanceRecords.filter(r => r.status === 'concluida').length,
    vencidas: maintenanceRecords.filter(r => 
      r.status === 'agendada' && isBefore(parseISO(r.scheduled_date), new Date())
    ).length,
    criticas: maintenanceRecords.filter(r => r.priority === 'critica' && r.status !== 'concluida').length,
    equipamentos_em_manutencao: new Set(
      maintenanceRecords
        .filter(r => r.status === 'agendada' || r.status === 'em_andamento')
        .map(r => r.equipment_name)
    ).size
  };

  // Get equipment that need maintenance (based on usage)
  const equipmentNeedingMaintenance = equipment.filter(eq => {
    const lastMaintenance = maintenanceRecords
      .filter(m => m.equipment_name === eq.name && m.status === 'concluida')
      .sort((a, b) => new Date(b.completed_date || b.updated_at).getTime() - new Date(a.completed_date || a.updated_at).getTime())[0];
    
    if (!lastMaintenance) return true; // Never maintained
    
    const daysSinceMaintenance = Math.floor(
      (Date.now() - new Date(lastMaintenance.completed_date || lastMaintenance.updated_at).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    return daysSinceMaintenance > 90; // Needs maintenance every 90 days
  });

  if (loading) {
    return <div className="p-6">Carregando manutenções...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchMaintenanceRecords();
              fetchEquipment();
            }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <Dialog open={maintenanceDialog} onOpenChange={setMaintenanceDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={openAddDialog}>
                <Plus className="w-4 h-4" />
                Nova Manutenção
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingMaintenance ? 'Editar Manutenção' : 'Nova Manutenção'}
                </DialogTitle>
                <DialogDescription>
                  {editingMaintenance ? 'Edite as informações da manutenção' : 'Agende uma nova manutenção'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="equipment">Equipamento *</Label>
                    <Select 
                      value={newMaintenance.equipment_name} 
                      onValueChange={(value) => {
                        const selectedEquipment = equipment.find(eq => eq.name === value);
                        setNewMaintenance(prev => ({
                          ...prev,
                          equipment_name: value,
                          equipment_id: selectedEquipment?.id || ''
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o equipamento" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        {equipment.map((eq) => (
                          <SelectItem key={eq.id} value={eq.name}>
                            {eq.name} - {eq.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="maintenance_type">Tipo de Manutenção *</Label>
                    <Select 
                      value={newMaintenance.maintenance_type} 
                      onValueChange={(value: any) => setNewMaintenance(prev => ({ ...prev, maintenance_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        <SelectItem value="preventiva">Preventiva</SelectItem>
                        <SelectItem value="corretiva">Corretiva</SelectItem>
                        <SelectItem value="emergencial">Emergencial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select 
                      value={newMaintenance.status} 
                      onValueChange={(value: any) => setNewMaintenance(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        <SelectItem value="agendada">Agendada</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="priority">Prioridade</Label>
                    <Select 
                      value={newMaintenance.priority} 
                      onValueChange={(value: any) => setNewMaintenance(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md z-50">
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="scheduled_date">Data Agendada *</Label>
                    <Input
                      id="scheduled_date"
                      type="date"
                      value={newMaintenance.scheduled_date}
                      onChange={(e) => setNewMaintenance(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description"
                    value={newMaintenance.description}
                    onChange={(e) => setNewMaintenance(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descreva o serviço a ser realizado..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="problem_description">Descrição do Problema</Label>
                  <Textarea
                    id="problem_description"
                    value={newMaintenance.problem_description}
                    onChange={(e) => setNewMaintenance(prev => ({ ...prev, problem_description: e.target.value }))}
                    placeholder="Descreva o problema encontrado..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="solution_description">Solução Aplicada</Label>
                  <Textarea
                    id="solution_description"
                    value={newMaintenance.solution_description}
                    onChange={(e) => setNewMaintenance(prev => ({ ...prev, solution_description: e.target.value }))}
                    placeholder="Descreva a solução aplicada..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantidade *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newMaintenance.quantity}
                      onChange={(e) => setNewMaintenance(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost">Custo</Label>
                    <CurrencyInput
                      id="cost"
                      value={newMaintenance.cost}
                      onChange={(value) => setNewMaintenance(prev => ({ ...prev, cost: value }))}
                      placeholder="R$ 0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="technician_name">Técnico</Label>
                    <Input
                      id="technician_name"
                      value={newMaintenance.technician_name}
                      onChange={(e) => setNewMaintenance(prev => ({ ...prev, technician_name: e.target.value }))}
                      placeholder="Nome do técnico"
                    />
                  </div>
                  <div>
                    <Label htmlFor="technician_contact">Contato</Label>
                    <Input
                      id="technician_contact"
                      value={newMaintenance.technician_contact}
                      onChange={(e) => setNewMaintenance(prev => ({ ...prev, technician_contact: e.target.value }))}
                      placeholder="Telefone ou email"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setMaintenanceDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={editingMaintenance ? updateMaintenance : addMaintenance}>
                    {editingMaintenance ? 'Salvar' : 'Agendar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageActions>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenções</TabsTrigger>
          <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Agendadas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.agendada}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Em Andamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats.em_andamento}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Concluídas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.concluida}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Vencidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.vencidas}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Críticas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.criticas}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Equipamentos</CardTitle>
                <CardDescription className="text-xs">Em Manutenção</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{stats.equipamentos_em_manutencao}</div>
              </CardContent>
            </Card>
          </div>

          {equipmentNeedingMaintenance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Equipamentos que Precisam de Manutenção
                </CardTitle>
                <CardDescription>
                  Equipamentos que não recebem manutenção há mais de 90 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {equipmentNeedingMaintenance.map((eq) => (
                    <div key={eq.id} className="p-4 border rounded-lg bg-orange-50">
                      <div className="font-medium">{eq.name}</div>
                      <div className="text-sm text-muted-foreground">{eq.category}</div>
                      <div className="text-sm text-orange-600 mt-1">
                        Status: {eq.status}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar manutenções..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="agendada">Agendada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="preventiva">Preventiva</SelectItem>
                <SelectItem value="corretiva">Corretiva</SelectItem>
                <SelectItem value="emergencial">Emergencial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-md z-50">
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="critica">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Registros de Manutenção</CardTitle>
              <CardDescription>
                {filteredMaintenanceRecords.length} registro(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Data Agendada</TableHead>
                      <TableHead>Técnico</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMaintenanceRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{record.equipment_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {record.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(record.maintenance_type) as any}>
                            {record.maintenance_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(record.status) as any}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(record.priority) as any}>
                            {record.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{record.quantity}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {format(parseISO(record.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.technician_name || '-'}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(record.cost)}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => openEditDialog(record)} title="Editar" aria-label="Editar">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="text-red-600 hover:text-red-700"
                              onClick={() => deleteMaintenance(record.id)} title="Excluir" aria-label="Excluir">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMaintenanceRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Nenhuma manutenção encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipamentos Cadastrados</CardTitle>
              <CardDescription>
                Status atual dos equipamentos no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipment.map((eq) => {
                  const lastMaintenance = maintenanceRecords
                    .filter(m => m.equipment_name === eq.name && m.status === 'concluida')
                    .sort((a, b) => new Date(b.completed_date || b.updated_at).getTime() - new Date(a.completed_date || a.updated_at).getTime())[0];
                  
                  const daysSinceMaintenance = lastMaintenance ? 
                    Math.floor((Date.now() - new Date(lastMaintenance.completed_date || lastMaintenance.updated_at).getTime()) / (1000 * 60 * 60 * 24)) 
                    : null;

                  const needsMaintenance = !lastMaintenance || (daysSinceMaintenance && daysSinceMaintenance > 90);

                  return (
                    <Card key={eq.id} className={needsMaintenance ? 'border-orange-200 bg-orange-50' : ''}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Wrench className="w-8 h-8 text-primary" />
                          {needsMaintenance && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                        </div>
                        <CardTitle className="text-lg">{eq.name}</CardTitle>
                        <CardDescription>{eq.category}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <Badge variant={getStatusVariant(eq.status) as any}>
                              {eq.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm">
                          <div className="flex justify-between">
                            <span>Última manutenção:</span>
                            <span className="text-muted-foreground">
                              {lastMaintenance ? 
                                `${daysSinceMaintenance} dia(s) atrás` : 
                                'Nunca'
                              }
                            </span>
                          </div>
                        </div>
                        {needsMaintenance && (
                          <div className="text-sm text-orange-600 font-medium">
                            ⚠️ Necessita manutenção
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};