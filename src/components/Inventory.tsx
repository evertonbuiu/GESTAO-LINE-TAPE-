import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Package, TrendingDown, TrendingUp, Shield, Filter, Plus, Minus, RefreshCw } from "lucide-react";
import { getStatusVariant } from "@/lib/utils";
import { useEquipment } from "@/hooks/useEquipment";
import { usePermissions } from "@/hooks/usePermissions";
import { useCustomAuth } from "@/hooks/useCustomAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { PageActions } from "@/components/layout/PageHeader";
export const Inventory = () => {
  const { equipment, loading, totals, fetchEquipment } = useEquipment();
  const { hasPermission } = usePermissions();
  const { userRole } = useCustomAuth();
  const { toast } = useToast();
  const [canViewInventory, setCanViewInventory] = useState(true);
  const [canViewPrices, setCanViewPrices] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showMovementDialog, setShowMovementDialog] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [movementForm, setMovementForm] = useState({
    equipment_id: "",
    type: "entrada", // entrada or saida
    quantity: "",
    description: ""
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

  // Check permissions on mount and when component becomes active
  useEffect(() => {
    // Permitir acesso de visualização para todos os usuários autenticados
    setCanViewInventory(true);
    // Manter restrição de preços apenas para determinados roles
    const canViewPricesResult = userRole !== 'deposito' && userRole !== 'funcionario';
    setCanViewPrices(canViewPricesResult);
    fetchMaintenanceRecords();
  }, [userRole]);

  // Refresh equipment data when component mounts or becomes active
  useEffect(() => {
    if (canViewInventory) {
      fetchEquipment();
    }
  }, [canViewInventory, fetchEquipment]);

  // Add realtime updates for equipment
  useEffect(() => {
    const equipmentChannel = supabase
      .channel('inventory-equipment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment'
        },
        () => {
          console.log('Equipment data updated, refreshing inventory...');
          fetchEquipment();
        }
      )
      .subscribe();

    const maintenanceChannel = supabase
      .channel('inventory-maintenance-changes')
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


  const getStatusText = (status: string) => {
    switch (status) {
      case "available":
        return "Normal";
      case "low_stock":
        return "Baixo";
      case "out_of_stock":
        return "Crítico";
      default:
        return "Desconhecido";
    }
  };

  const getMovementIcon = (available: number, rented: number) => {
    return rented > available ? TrendingDown : TrendingUp;
  };

  const getMovementColor = (available: number, rented: number) => {
    return rented > available ? "text-red-600" : "text-green-600";
  };

  // Check if equipment is in maintenance
  const isInMaintenance = (equipmentName: string) => {
    return maintenanceRecords.some(record => record.equipment_name === equipmentName);
  };

  // Get maintenance info for equipment
  const getMaintenanceInfo = (equipmentName: string) => {
    return maintenanceRecords.find(record => record.equipment_name === equipmentName);
  };

  // Register movement function
  const registerMovement = async () => {
    if (!movementForm.equipment_id || !movementForm.quantity) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um equipamento e informe a quantidade.",
        variant: "destructive"
      });
      return;
    }

    try {
      const selectedEquipment = equipment.find(item => item.id === movementForm.equipment_id);
      if (!selectedEquipment) {
        toast({
          title: "Erro",
          description: "Equipamento não encontrado.",
          variant: "destructive"
        });
        return;
      }

      const quantity = parseInt(movementForm.quantity);
      let newTotalStock = selectedEquipment.total_stock;
      
      if (movementForm.type === "entrada") {
        newTotalStock += quantity;
      } else {
        newTotalStock -= quantity;
        if (newTotalStock < 0) {
          toast({
            title: "Erro",
            description: "Quantidade insuficiente em estoque.",
            variant: "destructive"
          });
          return;
        }
      }

      const { error } = await supabase
        .from('equipment')
        .update({ 
          total_stock: newTotalStock,
          available: newTotalStock - selectedEquipment.rented,
          updated_at: new Date().toISOString()
        })
        .eq('id', movementForm.equipment_id);

      if (error) throw error;

      // Reset form and close dialog
      setMovementForm({
        equipment_id: "",
        type: "entrada",
        quantity: "",
        description: ""
      });
      setShowMovementDialog(false);
      
      // Refresh equipment data
      fetchEquipment();

      toast({
        title: "Movimento registrado",
        description: `${movementForm.type === "entrada" ? "Entrada" : "Saída"} de ${quantity} ${selectedEquipment.name} registrada com sucesso.`,
      });
    } catch (error) {
      console.error('Error registering movement:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o movimento.",
        variant: "destructive"
      });
    }
  };

  // Filter equipment by category
  const filteredEquipment = equipment.filter(item => {
    if (selectedCategory === "all") return true;
    return item.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  // Calculate filtered totals
  const filteredTotals = filteredEquipment.reduce((acc, item) => {
    acc.totalItems += item.total_stock;
    acc.criticalItems += item.status === 'out_of_stock' || item.status === 'low_stock' ? 1 : 0;
    acc.totalValue += item.total_stock * item.price_per_day; // Total value by quantity
    return acc;
  }, { totalItems: 0, criticalItems: 0, totalValue: 0 });

  const categories = [
    { value: "all", label: "Todos os Itens" },
    { value: "equipamento", label: "Equipamentos" },
    { value: "cabeamento", label: "Cabeamento" },
    { value: "insumos", label: "Insumos" },
    { value: "iluminacao", label: "Iluminação" },
    { value: "som", label: "Som" },
    { value: "efeitos", label: "Efeitos" },
    { value: "estruturas", label: "Estruturas" },
    { value: "decoracao", label: "Decoração" },
    { value: "mobiliario", label: "Mobiliário" }
  ];

  if (loading) {
    return <div className="p-6">Carregando estoque...</div>;
  }

  // Show permission warning if user has no view access
  if (!canViewInventory) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Você não tem permissão para visualizar informações do estoque.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEquipment(true)}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <Label htmlFor="category-filter">Filtrar por:</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Selecione uma categoria" />
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
          <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Package className="w-4 h-4" />
                Registrar Movimento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registrar Movimento de Estoque</DialogTitle>
                <DialogDescription>
                  Registre entrada ou saída de equipamentos do estoque
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="equipment">Equipamento</Label>
                  <Select 
                    value={movementForm.equipment_id} 
                    onValueChange={(value) => setMovementForm({...movementForm, equipment_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o equipamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-md z-50">
                      {equipment.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - Estoque: {item.total_stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo de Movimento</Label>
                  <Select 
                    value={movementForm.type} 
                    onValueChange={(value) => setMovementForm({...movementForm, type: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-md z-50">
                      <SelectItem value="entrada">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-green-600" />
                          Entrada
                        </div>
                      </SelectItem>
                      <SelectItem value="saida">
                        <div className="flex items-center gap-2">
                          <Minus className="w-4 h-4 text-red-600" />
                          Saída
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantidade</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={movementForm.quantity}
                    onChange={(e) => setMovementForm({...movementForm, quantity: e.target.value})}
                    placeholder="Digite a quantidade"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Observações (opcional)</Label>
                  <Textarea
                    id="description"
                    value={movementForm.description}
                    onChange={(e) => setMovementForm({...movementForm, description: e.target.value})}
                    placeholder="Adicione observações sobre o movimento..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowMovementDialog(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={registerMovement}>
                  Registrar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageActions>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Estoque Total</CardTitle>
            <CardDescription>
              {selectedCategory === "all" ? "Quantidade atual" : `Categoria: ${categories.find(c => c.value === selectedCategory)?.label}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{filteredTotals.totalItems}</div>
            <p className="text-sm text-muted-foreground mt-1">Itens em estoque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Estoque Baixo</CardTitle>
            <CardDescription>Abaixo do mínimo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{filteredTotals.criticalItems}</div>
            <p className="text-sm text-muted-foreground mt-1">Itens críticos</p>
          </CardContent>
        </Card>

{canViewPrices && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Valor do Estoque</CardTitle>
              <CardDescription>Valor total estimado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                R$ {filteredTotals.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Valor total estimado</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens do Estoque</CardTitle>
          <CardDescription>
            {selectedCategory === "all" 
              ? "Situação atual dos equipamentos" 
              : `Categoria: ${categories.find(c => c.value === selectedCategory)?.label} - ${filteredEquipment.length} item(s)`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Equipamento</th>
                  <th className="text-left py-3 px-4">Categoria</th>
                  <th className="text-center py-3 px-4">Total</th>
                  <th className="text-center py-3 px-4">Disponível</th>
                  <th className="text-center py-3 px-4">Locado</th>
                  <th className="text-center py-3 px-4">Status</th>
                  <th className="text-center py-3 px-4">Manutenção</th>
                  <th className="text-center py-3 px-4">Última Atualização</th>
                  <th className="text-center py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map((item) => {
                  const MovementIcon = getMovementIcon(item.available, item.rented);
                  const movementColor = getMovementColor(item.available, item.rented);
                  const inMaintenance = isInMaintenance(item.name);
                  const maintenanceInfo = getMaintenanceInfo(item.name);
                  
                  return (
                    <tr key={item.id} className={`border-b hover:bg-muted/50 ${inMaintenance ? 'bg-orange-50' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Package className="w-5 h-5 text-primary" />
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{item.category}</td>
                      <td className="py-3 px-4 text-center font-medium">{item.total_stock}</td>
                      <td className="py-3 px-4 text-center font-medium text-green-600">{item.available}</td>
                      <td className="py-3 px-4 text-center font-medium text-orange-600">{item.rented}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={getStatusVariant(item.status) as any}>
                          {item.status === "out_of_stock" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {getStatusText(item.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {inMaintenance ? (
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={getStatusVariant(maintenanceInfo?.status || 'maintenance') as any}>
                              🔧 {maintenanceInfo?.status}
                            </Badge>
                            <div className="text-xs text-orange-600 max-w-32 truncate" title={maintenanceInfo?.description}>
                              {maintenanceInfo?.description}
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600">✓ OK</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MovementIcon className={`w-4 h-4 ${movementColor}`} />
                          <span className="text-sm">{new Date(item.updated_at).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button variant="outline" size="sm">
                          Ajustar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filteredEquipment.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {selectedCategory === "all" 
                        ? "Nenhum equipamento encontrado" 
                        : `Nenhum item encontrado na categoria "${categories.find(c => c.value === selectedCategory)?.label}"`
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};