import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, Package, Shield, FileText } from "lucide-react";
import { formatCurrency, getStatusVariant } from "@/lib/utils";
import { useEquipment } from "@/hooks/useEquipment";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

import { PageActions } from "@/components/layout/PageHeader";
export const Equipment = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { equipment, loading, fetchEquipment } = useEquipment();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { user, userRole } = useCustomAuth();
  const [canView, setCanView] = useState(true);
  const [canEdit, setCanEdit] = useState(true);
  const [canViewPrices, setCanViewPrices] = useState(true);
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [newEquipment, setNewEquipment] = useState({
    name: '',
    category: '',
    description: '',
    total_stock: 0,
    price_per_day: 0,
    image_file: null as File | null
  });

  // Fetch maintenance records
  const fetchMaintenanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('maintenance_records')
        .select('*')
        .in('status', ['agendada', 'em_andamento']);

      if (error) throw error;
      setMaintenanceRecords(data || []);
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
    }
  };

  // Add realtime updates for equipment
  useEffect(() => {
    const equipmentChannel = supabase
      .channel('equipment-changes')
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

    const maintenanceChannel = supabase
      .channel('maintenance-equipment-changes')
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

    return () => {
      supabase.removeChannel(equipmentChannel);
      supabase.removeChannel(maintenanceChannel);
    };
  }, [fetchEquipment]);

  // Check permissions on mount
  useEffect(() => {
    // Permitir acesso para todos os usuários autenticados
    setCanView(true);
    setCanEdit(true);
    // Ocultar preços apenas para funcionários
    const canViewPricesResult = userRole !== 'funcionario' && userRole !== 'deposito';
    setCanViewPrices(canViewPricesResult);
    fetchMaintenanceRecords();
  }, [userRole]);

  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "Disponível";
      case "low_stock":
        return "Estoque Baixo";
      case "out_of_stock":
        return "Sem Estoque";
      default:
        return "Desconhecido";
    }
  };

  // Generate PDF of equipment list
  const generateEquipmentPDF = async () => {
    try {
      const doc = new jsPDF({
        compress: true
      });
      
      // Set up document
      doc.setFontSize(20);
      doc.text('Lista de Equipamentos', 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 20, 30);
      
      // Filter equipment for current tab
      const equipmentToShow = activeTab === "all" 
        ? filteredEquipment 
        : filteredEquipment.filter(item => item.category.toLowerCase() === activeTab.toLowerCase());
      
      // Prepare table data
      const tableData = equipmentToShow.map(item => {
        const inMaintenance = isInMaintenance(item.name);
        const statusText = getStatusText(item.status) + (inMaintenance ? ' (Manutenção)' : '');
        
        const row = [
          item.name,
          item.category,
          item.total_stock.toString(),
          item.available.toString(),
          item.rented.toString(),
          statusText
        ];
        
        // Adicionar coluna de preço apenas se o usuário pode ver
        if (canViewPrices) {
          row.push(`R$ ${item.price_per_day.toFixed(2)}`);
        }
        
        return row;
      });

      // Preparar cabeçalhos da tabela
      const tableHeaders = ['Nome', 'Categoria', 'Total', 'Disponível', 'Locado', 'Status'];
      if (canViewPrices) {
        tableHeaders.push('Valor do Material');
      }

      // Preparar estilos das colunas
      const columnStyles: any = {
        0: { cellWidth: canViewPrices ? 35 : 40 }, // Nome
        1: { cellWidth: canViewPrices ? 25 : 30 }, // Categoria  
        2: { cellWidth: 15 }, // Total
        3: { cellWidth: 20 }, // Disponível
        4: { cellWidth: 15 }, // Locado
        5: { cellWidth: canViewPrices ? 25 : 35 }  // Status
      };
      
      if (canViewPrices) {
        columnStyles[6] = { cellWidth: 25 }; // Valor
      }

      // Add table
      (doc as any).autoTable({
        head: [tableHeaders],
        body: tableData,
        startY: 40,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        columnStyles
      });

      // Add summary
      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(12);
      doc.text('Resumo:', 20, finalY);
      doc.setFontSize(10);
      doc.text(`Total de equipamentos: ${equipmentToShow.length}`, 20, finalY + 10);
      doc.text(`Equipamentos disponíveis: ${equipmentToShow.filter(e => e.status === 'available').length}`, 20, finalY + 20);
      doc.text(`Equipamentos com estoque baixo: ${equipmentToShow.filter(e => e.status === 'low_stock').length}`, 20, finalY + 30);
      doc.text(`Equipamentos sem estoque: ${equipmentToShow.filter(e => e.status === 'out_of_stock').length}`, 20, finalY + 40);

      // Save PDF
      const fileName = `equipamentos_${activeTab === 'all' ? 'todos' : activeTab}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      toast({
        title: "PDF gerado com sucesso",
        description: `Relatório salvo como ${fileName}`,
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o relatório em PDF.",
        variant: "destructive"
      });
    }
  };

  // Add new equipment
  const addEquipment = async () => {
    if (!newEquipment.name || !newEquipment.category || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e categoria do equipamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      let image_url = null;
      
      // Se há um arquivo de imagem, fazer upload
      if (newEquipment.image_file) {
        const fileExt = newEquipment.image_file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('equipment-images')
          .upload(fileName, newEquipment.image_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('equipment-images')
          .getPublicUrl(fileName);
        
        image_url = urlData.publicUrl;
      }

      const { error } = await supabase
        .from('equipment')
        .insert({
          name: newEquipment.name,
          category: newEquipment.category,
          description: newEquipment.description || '',
          total_stock: newEquipment.total_stock || 0,
          available: newEquipment.total_stock || 0,
          rented: 0,
          price_per_day: newEquipment.price_per_day || 0,
          status: 'available',
          image_url
        });

      if (error) throw error;

      // Criar item patrimonial automaticamente
      if (newEquipment.total_stock > 0 && newEquipment.price_per_day > 0) {
        const { error: patrimonyError } = await supabase
          .from('patrimony_inventory')
          .insert({
            name: newEquipment.name,
            category: newEquipment.category,
            description: newEquipment.description || '',
            quantity: newEquipment.total_stock,
            acquisition_value: newEquipment.price_per_day,
            current_value: newEquipment.price_per_day,
            acquisition_date: new Date().toISOString().split('T')[0],
            condition: 'Bom',
            location: 'Almoxarifado',
            created_by: user.id
          });

        if (patrimonyError) {
          console.error('Error creating patrimony item:', patrimonyError);
          // Não bloqueamos o cadastro do equipamento se houver erro no patrimônio
          toast({
            title: "Aviso",
            description: "Equipamento criado, mas houve um problema ao criar o item patrimonial.",
            variant: "default"
          });
        }
      }

      await fetchEquipment();
      setNewEquipment({
        name: '',
        category: '',
        description: '',
        total_stock: 0,
        price_per_day: 0,
        image_file: null
      });
      setEquipmentDialog(false);

      toast({
        title: "Equipamento criado",
        description: "Equipamento e item patrimonial criados com sucesso.",
      });
    } catch (error) {
      console.error('Error adding equipment:', error);
      toast({
        title: "Erro ao criar equipamento",
        description: "Não foi possível criar o equipamento.",
        variant: "destructive"
      });
    }
  };

  // Update equipment
  const updateEquipment = async () => {
    if (!editingEquipment || !editingEquipment.name || !editingEquipment.category) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e categoria do equipamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      let image_url = editingEquipment.image_url;
      const oldName = equipment.find(e => e.id === editingEquipment.id)?.name;
      
      // Se há um arquivo de imagem novo, fazer upload
      if (editingEquipment.image_file) {
        const fileExt = editingEquipment.image_file.name.split('.').pop();
        const fileName = `${editingEquipment.id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('equipment-images')
          .upload(fileName, editingEquipment.image_file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('equipment-images')
          .getPublicUrl(fileName);
        
        image_url = urlData.publicUrl;
      }

      // Calculate available based on total_stock, rented, and maintenance
      const currentRented = editingEquipment.rented || 0;
      const newAvailable = Math.max(0, (editingEquipment.total_stock || 0) - currentRented);
      
      const { error } = await supabase
        .from('equipment')
        .update({
          name: editingEquipment.name,
          category: editingEquipment.category,
          description: editingEquipment.description || '',
          total_stock: editingEquipment.total_stock || 0,
          available: newAvailable,
          price_per_day: editingEquipment.price_per_day || 0,
          status: newAvailable <= 0 ? 'out_of_stock' : 
                  newAvailable <= (editingEquipment.total_stock || 0) * 0.2 ? 'low_stock' : 'available',
          image_url
        })
        .eq('id', editingEquipment.id);

      if (error) throw error;

      // Atualizar item patrimonial correspondente
      if (oldName) {
        const { error: patrimonyError } = await supabase
          .from('patrimony_inventory')
          .update({
            name: editingEquipment.name,
            category: editingEquipment.category,
            description: editingEquipment.description || '',
            quantity: editingEquipment.total_stock || 0,
            acquisition_value: editingEquipment.price_per_day || 0,
            current_value: editingEquipment.price_per_day || 0
          })
          .eq('name', oldName);

        if (patrimonyError) {
          console.error('Error updating patrimony item:', patrimonyError);
          // Não bloqueamos a atualização do equipamento
        }
      }

      // Wait a bit before fetching to avoid conflicts
      setTimeout(() => {
        fetchEquipment();
      }, 500);
      
      setEditingEquipment(null);
      setEquipmentDialog(false);

      toast({
        title: "Equipamento atualizado",
        description: "Equipamento e item patrimonial atualizados com sucesso.",
      });
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast({
        title: "Erro ao atualizar equipamento",
        description: error?.message || "Não foi possível atualizar o equipamento. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Delete equipment
  const deleteEquipment = async (equipmentId: string) => {
    try {
      const { error } = await supabase
        .from('equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;

      await fetchEquipment();

      toast({
        title: "Equipamento removido",
        description: "O equipamento foi removido com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting equipment:', error);
      toast({
        title: "Erro ao remover equipamento",
        description: "Não foi possível remover o equipamento.",
        variant: "destructive"
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (equipment: any) => {
    setEditingEquipment({
      ...equipment,
      image_file: null
    });
    setEquipmentDialog(true);
  };

  // Open add dialog
  const openAddDialog = () => {
    setEditingEquipment(null);
    setNewEquipment({
      name: '',
      category: '',
      description: '',
      total_stock: 0,
      price_per_day: 0,
      image_file: null
    });
    setEquipmentDialog(true);
  };

  const categories = [
    { value: "equipamentos", label: "Equipamentos" },
    { value: "som", label: "Som" },
    { value: "iluminacao", label: "Iluminação" },
    { value: "cabeamento", label: "Cabeamento" },
    { value: "insumos", label: "Insumos" },
    { value: "efeitos", label: "Efeitos" },
    { value: "estruturas", label: "Estruturas" },
    { value: "decoracao", label: "Decoração" },
    { value: "mobiliario", label: "Mobiliário" }
  ];

  const filteredEquipment = equipment.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    return matchesSearch && item.category === activeTab;
  });

  const getEquipmentCountByCategory = (category: string) => {
    return equipment.filter(item => item.category === category).length;
  };

  // Check if equipment is in maintenance
  const isInMaintenance = (equipmentName: string) => {
    return maintenanceRecords.some(record => record.equipment_name === equipmentName);
  };

  // Get maintenance info for equipment
  const getMaintenanceInfo = (equipmentName: string) => {
    return maintenanceRecords.find(record => record.equipment_name === equipmentName);
  };

  if (loading) {
    return <div className="p-6">Carregando equipamentos...</div>;
  }

  // Show permission warning if user has no view access
  if (!canView) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Você não tem permissão para visualizar informações de equipamentos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={generateEquipmentPDF}
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            Gerar PDF
          </Button>
          {canEdit && (
            <Dialog open={equipmentDialog} onOpenChange={setEquipmentDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2" onClick={openAddDialog}>
                  <Plus className="w-4 h-4" />
                  Novo Equipamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingEquipment ? 'Edite as informações do equipamento' : 'Cadastre um novo equipamento no almoxarifado'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome do Equipamento *</Label>
                      <Input
                        id="name"
                        value={editingEquipment ? editingEquipment.name : newEquipment.name}
                        onChange={(e) => {
                          if (editingEquipment) {
                            setEditingEquipment({ ...editingEquipment, name: e.target.value });
                          } else {
                            setNewEquipment(prev => ({ ...prev, name: e.target.value }));
                          }
                        }}
                        placeholder="Ex: Mesa de Som"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Categoria *</Label>
                      <Select 
                        value={editingEquipment ? editingEquipment.category : newEquipment.category} 
                        onValueChange={(value) => {
                          if (editingEquipment) {
                            setEditingEquipment({ ...editingEquipment, category: value });
                          } else {
                            setNewEquipment(prev => ({ ...prev, category: value }));
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-md z-50">
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={editingEquipment ? editingEquipment.description : newEquipment.description}
                      onChange={(e) => {
                        if (editingEquipment) {
                          setEditingEquipment({ ...editingEquipment, description: e.target.value });
                        } else {
                          setNewEquipment(prev => ({ ...prev, description: e.target.value }));
                        }
                      }}
                      placeholder="Descrição detalhada do equipamento"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="total_stock">Quantidade em Estoque</Label>
                      <Input
                        id="total_stock"
                        type="number"
                        min="0"
                        value={editingEquipment ? editingEquipment.total_stock : newEquipment.total_stock}
                        onChange={(e) => {
                          if (editingEquipment) {
                            setEditingEquipment({ ...editingEquipment, total_stock: parseInt(e.target.value) || 0 });
                          } else {
                            setNewEquipment(prev => ({ ...prev, total_stock: parseInt(e.target.value) || 0 }));
                          }
                        }}
                        placeholder="0"
                      />
                    </div>
                    {canViewPrices && (
                      <div>
                        <Label htmlFor="price_per_day">Valor Unitário</Label>
                        <CurrencyInput
                          id="price_per_day"
                          value={editingEquipment ? editingEquipment.price_per_day : newEquipment.price_per_day}
                          onChange={(value) => {
                            if (editingEquipment) {
                              setEditingEquipment({ ...editingEquipment, price_per_day: value });
                            } else {
                              setNewEquipment(prev => ({ ...prev, price_per_day: value }));
                            }
                          }}
                          placeholder="R$ 0,00"
                        />
                      </div>
                    )}
                  </div>

                  {/* Upload de Imagem */}
                  <div className="space-y-2">
                    <Label htmlFor="equipment_image">Imagem do Equipamento (Opcional)</Label>
                    <Input
                      id="equipment_image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (editingEquipment) {
                          setEditingEquipment({ ...editingEquipment, image_file: file });
                        } else {
                          setNewEquipment(prev => ({ ...prev, image_file: file }));
                        }
                      }}
                    />
                    {(editingEquipment?.image_file || newEquipment.image_file) && (
                      <div className="text-sm text-muted-foreground">
                        Arquivo selecionado: {editingEquipment?.image_file?.name || newEquipment.image_file?.name}
                      </div>
                    )}
                    {editingEquipment?.image_url && !editingEquipment?.image_file && (
                      <div className="text-sm text-muted-foreground">
                        Imagem atual mantida
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEquipmentDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={editingEquipment ? updateEquipment : addEquipment}>
                      {editingEquipment ? 'Salvar' : 'Cadastrar Equipamento'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </PageActions>

      {/* Tabs para Categorias */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid w-auto grid-cols-6 gap-1">
            <TabsTrigger value="all">
              Todos ({equipment.length})
            </TabsTrigger>
            <TabsTrigger value="equipamentos">
              Equipamentos ({getEquipmentCountByCategory("equipamentos")})
            </TabsTrigger>
            <TabsTrigger value="som">
              Som ({getEquipmentCountByCategory("som")})
            </TabsTrigger>
            <TabsTrigger value="iluminacao">
              Iluminação ({getEquipmentCountByCategory("iluminacao")})
            </TabsTrigger>
            <TabsTrigger value="cabeamento">
              Cabeamento ({getEquipmentCountByCategory("cabeamento")})
            </TabsTrigger>
            <TabsTrigger value="insumos">
              Insumos ({getEquipmentCountByCategory("insumos")})
            </TabsTrigger>
          </TabsList>
          
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar equipamentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEquipment.map((item) => {
              const inMaintenance = isInMaintenance(item.name);
              const maintenanceInfo = getMaintenanceInfo(item.name);
              
              return (
                <Card key={item.id} className={`hover:shadow-lg transition-shadow ${inMaintenance ? 'border-orange-200 bg-orange-50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                          />
                        ) : (
                          <Package className="w-8 h-8 text-primary" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Badge variant={getStatusVariant(item.status) as any}>
                          {getStatusText(item.status)}
                        </Badge>
                        {inMaintenance && (
                          <Badge className="bg-orange-100 text-orange-800 text-xs">
                            🔧 Manutenção
                          </Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <CardDescription>{item.category}</CardDescription>
                    {inMaintenance && maintenanceInfo && (
                      <div className="text-sm text-orange-600 bg-orange-100 p-2 rounded">
                        <div className="font-medium">Em manutenção:</div>
                        <div className="text-xs">{maintenanceInfo.description}</div>
                        <div className="text-xs">Status: {maintenanceInfo.status}</div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{item.total_stock}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disponível</p>
                        <p className="font-medium text-green-600">{item.available}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Locado</p>
                        <p className="font-medium text-orange-600">{item.rented}</p>
                      </div>
                      {canViewPrices && (
                        <div>
                          <p className="text-muted-foreground">Valor do Material</p>
                          <p className="font-medium">R$ {item.price_per_day.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                    
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(item)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteEquipment(item.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};