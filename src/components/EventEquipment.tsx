import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Clock, MapPin, User, Package, Plus, Edit, Trash2, Printer, Users, Eye, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getStatusVariant } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isSameMonth, addMonths } from 'date-fns';

import { PageActions } from "@/components/layout/PageHeader";
interface Event {
  id: string;
  name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  setup_start_date: string;
  event_date: string;
  event_time: string;
  location: string;
  description: string;
  status: string;
  created_at: string;
}

interface EventEquipment {
  id: string;
  event_id: string;
  equipment_name: string;
  quantity: number;
  description: string;
  status: string;
  assigned_by: string;
  created_at: string;
}

interface Equipment {
  id: string;
  name: string;
  category: string;
  total_stock: number;
  available: number;
  rented: number;
  price_per_day: number;
  status: string;
  description: string;
}

interface EventCollaborator {
  id: string;
  event_id: string;
  collaborator_name: string;
  collaborator_email: string;
  role: string;
  assigned_by: string;
  created_at: string;
}

interface EventBudget {
  id: string;
  event_id: string;
  item: string;
  description: string | null;
  quantity: number;
  image_url: string | null;
  created_at: string;
}

export const EventEquipment = () => {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [events, setEvents] = useState<Event[]>([]);
  const [equipment, setEquipment] = useState<EventEquipment[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [equipmentDialog, setEquipmentDialog] = useState(false);
  const [isCustomEquipment, setIsCustomEquipment] = useState(false);
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [equipmentCategory, setEquipmentCategory] = useState('all');
  const [editEquipmentDialog, setEditEquipmentDialog] = useState(false);
  const [returnedEquipmentDialog, setReturnedEquipmentDialog] = useState(false);
  const [collaboratorDialog, setCollaboratorDialog] = useState(false);
  const [missingEquipmentDialog, setMissingEquipmentDialog] = useState(false);
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [selectedEventForBudget, setSelectedEventForBudget] = useState<Event | null>(null);
  const [eventBudgets, setEventBudgets] = useState<EventBudget[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>('/logo-empresa.png');
  const [collaborators, setCollaborators] = useState<EventCollaborator[]>([]);
  const [availableCollaborators, setAvailableCollaborators] = useState<any[]>([]);
  const [selectedEquipmentForEdit, setSelectedEquipmentForEdit] = useState<EventEquipment | null>(null);
  const [missingEquipmentList, setMissingEquipmentList] = useState<any[]>([]);
  const [allocatedEquipmentForReturn, setAllocatedEquipmentForReturn] = useState<any[]>([]);
  const [newEquipment, setNewEquipment] = useState<Partial<EventEquipment>>({
    equipment_name: '',
    quantity: 1,
    description: '',
    status: 'pending'
  });
  const [newCollaborator, setNewCollaborator] = useState({
    collaborator_name: '',
    collaborator_email: '',
    role: 'funcionario',
    selectedCollaboratorId: ''
  });
  const [isNewCollaborator, setIsNewCollaborator] = useState(false);

  const equipmentCategories = Array.from(
    new Set(availableEquipment.map(item => item.category).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const filteredAvailableEquipment = availableEquipment.filter(item => {
    const search = equipmentSearch.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !search || [item.name, item.category, item.description]
      .some(value => value?.toLocaleLowerCase('pt-BR').includes(search));
    const matchesCategory = equipmentCategory === 'all' || item.category === equipmentCategory;
    return matchesSearch && matchesCategory;
  });

  // Add realtime updates
  useEffect(() => {
    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events'
        },
        () => {
          console.log('Events data updated, refreshing...');
          fetchEvents();
        }
      )
      .subscribe();

    const equipmentChannel = supabase
      .channel('event-equipment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_equipment'
        },
        () => {
          console.log('Event equipment data updated, refreshing...');
          if (selectedEvent) {
            fetchEquipment(selectedEvent.id);
          }
        }
      )
      .subscribe();

    // Add listener for event_budgets changes to update budget list
    const budgetChannel = supabase
      .channel('event-budgets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_budgets'
        },
        () => {
          console.log('Event budgets data updated, refreshing...');
          fetchEvents(); // Refresh events list
          if (selectedEventForBudget) {
            fetchEventBudgets(selectedEventForBudget.id);
          }
        }
      )
      .subscribe();

    // Add listener for external_quotes changes to update events list
    const quotesChannel = supabase
      .channel('external-quotes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'external_quotes'
        },
        () => {
          console.log('Orçamento atualizado, recarregando eventos...');
          fetchEvents();
        }
      )
      .subscribe();

    // Add listener for equipment table changes to update available equipment
    const availableEquipmentChannel = supabase
      .channel('available-equipment-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment'
        },
        (payload) => {
          console.log('Equipment data updated, refreshing available equipment...', payload);
          // Force refresh with a slight delay to ensure database consistency
          setTimeout(() => {
            fetchAvailableEquipment(true);
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(equipmentChannel);
      supabase.removeChannel(budgetChannel);
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(availableEquipmentChannel);
    };
  }, [selectedEvent, selectedEventForBudget]);

  // Fetch events
  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: "Erro ao carregar eventos",
        description: "Não foi possível carregar os eventos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch equipment for selected event
  const fetchEquipment = async (eventId: string) => {
    try {
      console.log('Fetching equipment for event:', eventId);
      const { data, error } = await supabase
        .from('event_equipment')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Equipment data loaded:', data);
      setEquipment(data || []);
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast({
        title: "Erro ao carregar equipamentos",
        description: "Não foi possível carregar os equipamentos.",
        variant: "destructive"
      });
    }
  };

  // Add new equipment
  const addEquipment = async () => {
    const equipmentName = newEquipment.equipment_name?.trim();
    const quantity = Number(newEquipment.quantity);

    console.log('Attempting to add equipment:', {
      selectedEvent: selectedEvent?.id,
      equipment_name: newEquipment.equipment_name,
      user: user?.id,
      quantity: newEquipment.quantity,
      status: newEquipment.status
    });

    if (!selectedEvent || !equipmentName || !user || !Number.isInteger(quantity) || quantity < 1) {
      console.log('Validation failed:', {
        hasSelectedEvent: !!selectedEvent,
        hasEquipmentName: !!newEquipment.equipment_name,
        hasUser: !!user
      });
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome e informe uma quantidade válida.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('event_equipment')
        .insert({
          event_id: selectedEvent.id,
          equipment_name: equipmentName,
          quantity,
          description: newEquipment.description || '',
          status: newEquipment.status || 'pending',
          assigned_by: user.id
        });

      if (error) {
        console.error('Supabase error details:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('Equipment added successfully');
      await fetchEquipment(selectedEvent.id);
      setNewEquipment({
        equipment_name: '',
        quantity: 1,
        description: '',
        status: 'pending'
      });
      setIsCustomEquipment(false);
      setEquipmentDialog(false);

      toast({
        title: "Equipamento adicionado",
        description: "O equipamento foi adicionado com sucesso.",
      });
    } catch (error) {
      console.error('Error adding equipment:', error);
      toast({
        title: "Erro ao adicionar equipamento",
        description: `Não foi possível adicionar o equipamento. ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    }
  };

  // Edit equipment
  const updateEquipment = async () => {
    if (!selectedEquipmentForEdit || !newEquipment.equipment_name || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome do equipamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('event_equipment')
        .update({
          equipment_name: newEquipment.equipment_name,
          quantity: newEquipment.quantity || 1,
          description: newEquipment.description || '',
          status: newEquipment.status || 'pending'
        })
        .eq('id', selectedEquipmentForEdit.id);

      if (error) throw error;

      await fetchEquipment(selectedEvent!.id);
      setNewEquipment({
        equipment_name: '',
        quantity: 1,
        description: '',
        status: 'pending'
      });
      setEditEquipmentDialog(false);
      setSelectedEquipmentForEdit(null);

      toast({
        title: "Equipamento atualizado",
        description: "O equipamento foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Error updating equipment:', error);
      toast({
        title: "Erro ao atualizar equipamento",
        description: "Não foi possível atualizar o equipamento.",
        variant: "destructive"
      });
    }
  };

  // Add returned equipment
  const addReturnedEquipment = async () => {
    if (!selectedEvent || !newEquipment.equipment_name || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o nome do equipamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Add the returned equipment to event_equipment
      // The database trigger will automatically update the equipment stock
      const { error } = await supabase
        .from('event_equipment')
        .insert({
          event_id: selectedEvent.id,
          equipment_name: newEquipment.equipment_name,
          quantity: newEquipment.quantity || 1,
          description: newEquipment.description || '',
          status: 'returned',
          assigned_by: user.id
        });

      if (error) throw error;

      await fetchEquipment(selectedEvent.id);
      setNewEquipment({
        equipment_name: '',
        quantity: 1,
        description: '',
        status: 'pending'
      });
      setReturnedEquipmentDialog(false);

      toast({
        title: "Equipamento devolvido e estoque atualizado",
        description: "O equipamento foi adicionado à lista de devolvidos e o estoque foi atualizado automaticamente.",
      });
    } catch (error) {
      console.error('Error adding returned equipment:', error);
      toast({
        title: "Erro ao adicionar equipamento devolvido",
        description: "Não foi possível adicionar o equipamento devolvido.",
        variant: "destructive"
      });
    }
  };

  // Delete equipment
  const deleteEquipment = async (equipmentId: string) => {
    try {
      const { error } = await supabase
        .from('event_equipment')
        .delete()
        .eq('id', equipmentId);

      if (error) throw error;

      await fetchEquipment(selectedEvent!.id);

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

  // Calculate missing equipment for an event
  const calculateMissingEquipment = (eventEquipment: EventEquipment[]) => {
    const equipmentMap = new Map<string, { allocated: number; returned: number }>();
    
    // Group equipment by name and calculate totals
    eventEquipment.forEach(item => {
      if (!equipmentMap.has(item.equipment_name)) {
        equipmentMap.set(item.equipment_name, { allocated: 0, returned: 0 });
      }
      
      const current = equipmentMap.get(item.equipment_name)!;
      if (item.status === 'returned') {
        current.returned += item.quantity;
      } else {
        current.allocated += item.quantity;
      }
    });
    
    // Calculate missing equipment
    const missingEquipment = [];
    for (const [name, quantities] of equipmentMap) {
      const missing = quantities.allocated - quantities.returned;
      if (missing > 0) {
        missingEquipment.push({
          equipment_name: name,
          allocated: quantities.allocated,
          returned: quantities.returned,
          missing: missing
        });
      }
    }
    
    return missingEquipment;
  };

  // Fetch budget for selected event
  const fetchEventBudgets = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_budgets')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let budgets: EventBudget[] = data || [];

      // Fallback: se não houver itens em event_budgets, buscar produtos dos orçamentos externos (Letra 3D line tape)
      if (budgets.length === 0) {
        const evt = events.find(e => e.id === eventId);
        const quotesQuery = supabase
          .from('external_quotes')
          .select('id, products, event_id, client_name, event_date')
          .order('created_at', { ascending: false });

        const { data: quotesData, error: quotesError } = await quotesQuery;
        if (quotesError) throw quotesError;

        const relatedQuotes = (quotesData || []).filter((q: any) => {
          if (q.event_id && q.event_id === eventId) return true;
          if (evt && q.client_name && q.event_date) {
            return (
              q.client_name?.toLowerCase() === (evt as any).client_name?.toLowerCase() &&
              q.event_date === (evt as any).event_date
            );
          }
          return false;
        });

        const productBudgets: EventBudget[] = [];
        relatedQuotes.forEach((q: any) => {
          const products = Array.isArray(q.products) ? q.products : [];
          products.forEach((p: any, idx: number) => {
            productBudgets.push({
              id: `${q.id}-${idx}`,
              event_id: eventId,
              item: p.name || 'Produto',
              description: p.description || null,
              quantity: p.quantity || 1,
              image_url: p.image_url || null,
              created_at: q.created_at || new Date().toISOString(),
            });
          });
        });

        budgets = productBudgets;
      }

      setEventBudgets(budgets);
    } catch (error) {
      console.error('Error fetching event budgets:', error);
      toast({
        title: "Erro ao carregar orçamento",
        description: "Não foi possível carregar o orçamento do evento.",
        variant: "destructive"
      });
    }
  };


  // Print budget list for selected event
  const printBudgetList = async () => {
    if (!selectedEventForBudget || eventBudgets.length === 0) {
      toast({
        title: "Nenhum orçamento para imprimir",
        description: "Este evento não possui itens no orçamento.",
        variant: "destructive"
      });
      return;
    }

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Não foi possível abrir a janela de impressão');
      }

      const logoBase64 = logoUrl.startsWith('data:') ? logoUrl : '';

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Orçamento - ${selectedEventForBudget.name}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: white;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .logo { 
              max-width: 150px; 
              max-height: 80px; 
              margin-bottom: 10px; 
            }
            .company-name { 
              font-size: 24px; 
              font-weight: bold; 
              margin: 10px 0; 
              color: #333; 
            }
            .event-info { 
              background: #f5f5f5; 
              padding: 15px; 
              border-radius: 5px; 
              margin-bottom: 20px; 
            }
            .event-info h2 { 
              margin: 0 0 10px 0; 
              color: #333; 
            }
            .info-row { 
              margin: 5px 0; 
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px; 
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: left; 
            }
            th { 
              background-color: #f8f9fa; 
              font-weight: bold; 
            }
            .item-name { 
              font-weight: bold; 
            }
            .footer { 
              margin-top: 30px; 
              padding-top: 20px; 
              border-top: 1px solid #ddd; 
              text-align: center; 
              font-size: 12px; 
              color: #666; 
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : ''}
            <div class="company-name">GESTAO LINE TAPE</div>
            <div>Orçamento de Materiais</div>
          </div>

          <div class="event-info">
            <h2>Informações do Evento</h2>
            <div class="info-row"><strong>Evento:</strong> ${selectedEventForBudget.name}</div>
            <div class="info-row"><strong>Cliente:</strong> ${selectedEventForBudget.client_name}</div>
            <div class="info-row"><strong>Data do Evento:</strong> ${format(new Date(selectedEventForBudget.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>
            ${selectedEventForBudget.setup_start_date ? 
              `<div class="info-row"><strong>Data de Montagem:</strong> ${format(new Date(selectedEventForBudget.setup_start_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</div>` : 
              ''
            }
            ${selectedEventForBudget.location ? `<div class="info-row"><strong>Local:</strong> ${selectedEventForBudget.location}</div>` : ''}
            ${selectedEventForBudget.event_time ? `<div class="info-row"><strong>Horário:</strong> ${selectedEventForBudget.event_time}</div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 90px;">Imagem</th>
                <th>Item</th>
                <th>Descrição</th>
                <th>Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${eventBudgets.map(budget => `
                <tr>
                  <td style="text-align: center;">${budget.image_url ? `<img src="${budget.image_url}" alt="${budget.item}" style="max-width: 80px; max-height: 80px; object-fit: contain;" crossorigin="anonymous" />` : '-'}</td>
                  <td class="item-name">${budget.item}</td>
                  <td>${budget.description || '-'}</td>
                  <td style="text-align: center;">${budget.quantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>


          <div class="footer">
            <p>Total de itens: ${eventBudgets.length}</p>
            <p>Impresso em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            <p>GESTAO LINE TAPE - Controle de Estoque</p>
          </div>

          <script>
            window.onload = function() {
              var imgs = document.images;
              var pending = imgs.length;
              function done() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }
              if (pending === 0) { done(); return; }
              for (var i = 0; i < imgs.length; i++) {
                if (imgs[i].complete) {
                  if (--pending === 0) done();
                } else {
                  imgs[i].onload = imgs[i].onerror = function() {
                    if (--pending === 0) done();
                  };
                }
              }
            };
          </script>

        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      toast({
        title: "Lista de orçamento impressa",
        description: "A lista de materiais do orçamento foi enviada para impressão.",
      });
    } catch (error) {
      console.error('Error printing budget list:', error);
      toast({
        title: "Erro ao imprimir",
        description: "Não foi possível imprimir a lista de orçamento.",
        variant: "destructive"
      });
    }
  };

  // Generate missing equipment report for all completed events
  const generateMissingEquipmentReport = async () => {
    try {
      const { data: completedEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'completed')
        .order('event_date', { ascending: false });

      if (eventsError) throw eventsError;

      const missingReport = [];
      
      for (const event of completedEvents || []) {
        const { data: eventEquipment, error: equipmentError } = await supabase
          .from('event_equipment')
          .select('*')
          .eq('event_id', event.id);

        if (equipmentError) throw equipmentError;

        const missingEquipment = calculateMissingEquipment(eventEquipment || []);
        
        if (missingEquipment.length > 0) {
          missingReport.push({
            event: event,
            missingEquipment: missingEquipment
          });
        }
      }

      setMissingEquipmentList(missingReport);
      setMissingEquipmentDialog(true);
    } catch (error) {
      console.error('Error generating missing equipment report:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Não foi possível gerar o relatório de equipamentos faltantes.",
        variant: "destructive"
      });
    }
  };

  // Update stock when event is completed
  const markEventAsCompleted = async (eventId: string) => {
    try {
      // First, get all equipment for this event
      const { data: eventEquipment, error: equipmentError } = await supabase
        .from('event_equipment')
        .select('*')
        .eq('event_id', eventId);

      if (equipmentError) throw equipmentError;

      // Update event status to completed
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'completed' })
        .eq('id', eventId);

      if (updateError) throw updateError;

      // Calculate missing equipment
      const missingEquipment = calculateMissingEquipment(eventEquipment || []);
      
      if (missingEquipment.length > 0) {
        toast({
          title: "Evento concluído com pendências",
          description: `O evento foi marcado como concluído, mas há ${missingEquipment.length} equipamento(s) faltante(s).`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Evento concluído",
          description: "O evento foi marcado como concluído com sucesso.",
        });
      }

      // Refresh events list
      await fetchEvents();
    } catch (error) {
      console.error('Error marking event as completed:', error);
      toast({
        title: "Erro ao concluir evento",
        description: "Não foi possível marcar o evento como concluído.",
        variant: "destructive"
      });
    }
  };

  // Fetch collaborators for selected event
  const fetchCollaborators = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_collaborators')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      toast({
        title: "Erro ao carregar colaboradores",
        description: "Não foi possível carregar os colaboradores.",
        variant: "destructive"
      });
    }
  };

  // Add collaborator to event
  const addCollaborator = async () => {
    if (!selectedEvent || !newCollaborator.collaborator_name || !newCollaborator.collaborator_email || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e email do colaborador.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('event_collaborators')
        .insert({
          event_id: selectedEvent.id,
          collaborator_name: newCollaborator.collaborator_name,
          collaborator_email: newCollaborator.collaborator_email,
          role: newCollaborator.role,
          assigned_by: user.id
        });

      if (error) throw error;

      await fetchCollaborators(selectedEvent.id);
      setNewCollaborator({
        collaborator_name: '',
        collaborator_email: '',
        role: 'funcionario',
        selectedCollaboratorId: ''
      });
      setCollaboratorDialog(false);
      setIsNewCollaborator(false);

      toast({
        title: "Colaborador adicionado",
        description: "O colaborador foi adicionado com sucesso.",
      });
    } catch (error) {
      console.error('Error adding collaborator:', error);
      toast({
        title: "Erro ao adicionar colaborador",
        description: "Não foi possível adicionar o colaborador.",
        variant: "destructive"
      });
    }
  };

  // Remove collaborator from event
  const removeCollaborator = async (collaboratorId: string) => {
    try {
      const { error } = await supabase
        .from('event_collaborators')
        .delete()
        .eq('id', collaboratorId);

      if (error) throw error;

      await fetchCollaborators(selectedEvent!.id);

      toast({
        title: "Colaborador removido",
        description: "O colaborador foi removido com sucesso.",
      });
    } catch (error) {
      console.error('Error removing collaborator:', error);
      toast({
        title: "Erro ao remover colaborador",
        description: "Não foi possível remover o colaborador.",
        variant: "destructive"
      });
    }
  };


  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'confirmed': return 'Confirmado';
      case 'allocated': return 'Alocado';
      case 'returned': return 'Devolvido';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  // Fetch available equipment
  const fetchAvailableEquipment = async (forceRefresh = false) => {
    try {
      console.log('Fetching available equipment...', { forceRefresh });
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      if (error) {
        console.error('Supabase error details:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      console.log('Available equipment loaded:', data?.length || 0, 'items');
      setAvailableEquipment(data || []);
    } catch (error) {
      console.error('Error fetching available equipment:', error);
      toast({
        title: "Erro ao carregar equipamentos",
        description: "Não foi possível carregar os equipamentos disponíveis.",
        variant: "destructive"
      });
    }
  };

  // Fetch allocated equipment for the selected event for return purposes
  const fetchAllocatedEquipmentForReturn = async (eventId: string) => {
    try {
      console.log('Fetching allocated equipment for return...', { eventId });
      
      // Get all equipment allocated in this event (not returned yet)
      const { data: eventEquipment, error: equipmentError } = await supabase
        .from('event_equipment')
        .select('equipment_name, quantity, status')
        .eq('event_id', eventId)
        .in('status', ['confirmed', 'in_progress', 'pending', 'allocated']);

      if (equipmentError) throw equipmentError;

      // Group by equipment name and sum quantities
      const equipmentMap = new Map<string, { allocated: number; returned: number }>();
      
      // Get allocated equipment
      eventEquipment?.forEach(item => {
        if (!equipmentMap.has(item.equipment_name)) {
          equipmentMap.set(item.equipment_name, { allocated: 0, returned: 0 });
        }
        equipmentMap.get(item.equipment_name)!.allocated += item.quantity;
      });

      // Get returned equipment to subtract from available for return
      const { data: returnedEquipment, error: returnedError } = await supabase
        .from('event_equipment')
        .select('equipment_name, quantity')
        .eq('event_id', eventId)
        .eq('status', 'returned');

      if (returnedError) throw returnedError;

      returnedEquipment?.forEach(item => {
        if (equipmentMap.has(item.equipment_name)) {
          equipmentMap.get(item.equipment_name)!.returned += item.quantity;
        }
      });

      // Create list of equipment available for return (allocated - returned > 0)
      const availableForReturn = [];
      for (const [equipmentName, quantities] of equipmentMap) {
        const availableQty = quantities.allocated - quantities.returned;
        if (availableQty > 0) {
          availableForReturn.push({
            name: equipmentName,
            availableForReturn: availableQty,
            allocated: quantities.allocated,
            returned: quantities.returned
          });
        }
      }

      console.log('Equipment available for return:', availableForReturn);
      setAllocatedEquipmentForReturn(availableForReturn);
    } catch (error) {
      console.error('Error fetching allocated equipment for return:', error);
      toast({
        title: "Erro ao carregar equipamentos",
        description: "Não foi possível carregar os equipamentos alocados.",
        variant: "destructive"
      });
    }
  };

  // Fetch available collaborators
  const fetchAvailableCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .in('status', ['active', 'ativo'])
        .order('name');

      if (error) throw error;
      setAvailableCollaborators(data || []);
    } catch (error) {
      console.error('Error fetching available collaborators:', error);
      // Fallback para mock data se não conseguir buscar
      setAvailableCollaborators([]);
    }
  };

  // Handle collaborator selection
  const handleCollaboratorSelect = (collaboratorId: string) => {
    const selectedCollaborator = availableCollaborators.find(c => c.id === collaboratorId);
    if (selectedCollaborator) {
      setNewCollaborator(prev => ({
        ...prev,
        collaborator_name: selectedCollaborator.name,
        collaborator_email: selectedCollaborator.email,
        selectedCollaboratorId: collaboratorId
      }));
    }
  };

  // Fetch logo from storage
  const fetchLogo = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('logos')
        .list('', { limit: 100 });

      if (error) {
        console.error('Error fetching logo:', error);
        return;
      }

      if (data && data.length > 0) {
        // Get the first logo file
        const logoFile = data[0];
        const { data: publicUrl } = supabase.storage
          .from('logos')
          .getPublicUrl(logoFile.name);
        
        if (publicUrl?.publicUrl) {
          setLogoUrl(publicUrl.publicUrl);
          console.log('Logo URL set:', publicUrl.publicUrl);
        }
      } else {
        console.log('No logos found in storage');
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
    }
  };

  // Generate years and months for tabs
  const generateYearsAndMonths = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
      const months = [];
      for (let month = 0; month < 12; month++) {
        months.push(new Date(year, month, 1));
      }
      years.push({ year, months });
    }
    
    return years;
  };

  // Filter events by selected month
  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.event_date + 'T12:00:00');
    return isSameMonth(eventDate, selectedMonth);
  });

  const yearsAndMonths = generateYearsAndMonths();
  
  // Generate PDF with equipment and collaborators
  const generateEquipmentPDF = async () => {
    if (!selectedEvent) {
      toast({
        title: "Nenhum evento selecionado",
        description: "Selecione um evento para gerar o PDF.",
        variant: "destructive"
      });
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPosition = 20;

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Lista de Equipamentos e Colaboradores', pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedEvent.name, pageWidth / 2, yPosition, { align: 'center' });
      
      yPosition += 15;
      doc.setFontSize(10);
      doc.text(`Cliente: ${selectedEvent.client_name}`, 14, yPosition);
      yPosition += 6;
      doc.text(`Data do Evento: ${format(new Date(selectedEvent.event_date), 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPosition);
      if (selectedEvent.location) {
        yPosition += 6;
        doc.text(`Local: ${selectedEvent.location}`, 14, yPosition);
      }
      
      yPosition += 12;

      // Equipment section
      const activeEquipment = equipment.filter(item => 
        ['pending', 'confirmed', 'allocated', 'active'].includes(item.status)
      );

      if (activeEquipment.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Equipamentos Ativos', 14, yPosition);
        yPosition += 8;

        const equipmentData = activeEquipment.map(item => [
          item.equipment_name,
          item.quantity.toString(),
          getStatusText(item.status),
          item.description || '-'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Equipamento', 'Quantidade', 'Status', 'Descrição']],
          body: equipmentData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Returned Equipment section
      const returnedEquipment = equipment.filter(item => item.status === 'returned');

      if (returnedEquipment.length > 0) {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Equipamentos Devolvidos ao Estoque', 14, yPosition);
        yPosition += 8;

        const returnedData = returnedEquipment.map(item => [
          item.equipment_name,
          item.quantity.toString(),
          item.description || '-'
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Equipamento', 'Quantidade', 'Descrição']],
          body: returnedData,
          theme: 'grid',
          headStyles: { fillColor: [34, 197, 94] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Collaborators section
      if (collaborators.length > 0) {
        // Check if we need a new page
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Colaboradores', 14, yPosition);
        yPosition += 8;

        const collaboratorsData = collaborators.map(collab => [
          collab.collaborator_name,
          collab.collaborator_email,
          collab.role === 'funcionario' ? 'Funcionário' : collab.role === 'tecnico' ? 'Técnico' : collab.role
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Nome', 'Email', 'Função']],
          body: collaboratorsData,
          theme: 'grid',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 }
        });
      }

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`,
          14,
          doc.internal.pageSize.getHeight() - 10
        );
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth - 14,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'right' }
        );
      }

      // Save PDF
      const fileName = `equipamentos_${selectedEvent.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF gerado com sucesso",
        description: "O arquivo foi baixado para seu dispositivo.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar o arquivo PDF.",
        variant: "destructive"
      });
    }
  };
  
  // Print equipment list
  const printEquipmentList = () => {
    if (!selectedEvent) return;
    
    // Filtrar equipamentos do evento selecionado
    const eventEquipment = equipment.filter(eq => eq.event_id === selectedEvent.id);
    
    if (eventEquipment.length === 0) {
      toast({
        title: "Nenhum equipamento encontrado",
        description: "Este evento não possui equipamentos cadastrados.",
        variant: "destructive"
      });
      return;
    }

    // Aguardar o carregamento da logo antes de gerar a página de impressão
    const logoImg = new Image();
    logoImg.onload = () => {
      const printContent = `
        <html>
          <head>
            <title>Lista de Materiais - ${selectedEvent.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
                position: relative;
              }
              body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('${logoUrl}');
                background-repeat: no-repeat;
                background-position: center calc(50% + 400px);
                background-size: 250%;
                opacity: 0.15;
                z-index: -1;
                pointer-events: none;
              }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
              .event-info { margin-bottom: 20px; }
              .event-info h2 { color: #333; margin-bottom: 10px; }
              .event-info p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
              .status-pending { background-color: #fff3cd; color: #856404; }
              .status-confirmed { background-color: #d1ecf1; color: #0c5460; }
              .status-allocated { background-color: #d4edda; color: #155724; }
              .status-returned { background-color: #f8d7da; color: #721c24; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${logoUrl}" alt="Logo da Empresa" style="height: 150px; margin-bottom: 15px;" />
              <h1>LISTA DE MATERIAIS</h1>
              <p>Sistema de Controle de Almoxarifado</p>
            </div>
            
            <div class="event-info">
              <h2>${selectedEvent.name}</h2>
              <p><strong>Cliente:</strong> ${selectedEvent.client_name}</p>
              ${selectedEvent.client_email ? `<p><strong>Email:</strong> ${selectedEvent.client_email}</p>` : ''}
              ${selectedEvent.client_phone ? `<p><strong>Telefone:</strong> ${selectedEvent.client_phone}</p>` : ''}
              <p><strong>Data do Evento:</strong> ${format(new Date(selectedEvent.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</p>
              ${selectedEvent.event_time ? `<p><strong>Horário:</strong> ${selectedEvent.event_time}</p>` : ''}
              ${selectedEvent.setup_start_date ? `<p><strong>Data de Montagem:</strong> ${format(new Date(selectedEvent.setup_start_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</p>` : ''}
              ${selectedEvent.location ? `<p><strong>Local:</strong> ${selectedEvent.location}</p>` : ''}
              ${selectedEvent.description ? `<p><strong>Descrição:</strong> ${selectedEvent.description}</p>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Quantidade</th>
                  <th>Status</th>
                  <th>Descrição</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${eventEquipment.map(item => `
                  <tr>
                    <td>${item.equipment_name}</td>
                    <td>${item.quantity}</td>
                    <td>
                      <span class="status status-${item.status}">
                        ${getStatusText(item.status)}
                      </span>
                    </td>
                    <td>${item.description || '-'}</td>
                    <td>_________________</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            ${collaborators.length > 0 ? `
              <h3 style="margin-top: 30px; margin-bottom: 15px; color: #333;">Colaboradores do Evento</h3>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Função</th>
                  </tr>
                </thead>
                <tbody>
                  ${collaborators.map(collab => `
                    <tr>
                      <td>${collab.collaborator_name}</td>
                      <td>${collab.collaborator_email}</td>
                      <td>${collab.role === 'funcionario' ? 'Funcionário' : collab.role === 'tecnico' ? 'Técnico' : collab.role}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="footer">
              <p>Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              <p>Total de itens: ${eventEquipment.length}${collaborators.length > 0 ? ` | Total de colaboradores: ${collaborators.length}` : ''}</p>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        
        // Aguardar um pouco para garantir que a logo seja carregada na página de impressão
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 500);
      }
    };

    logoImg.onerror = () => {
      console.error('Erro ao carregar a logo para impressão');
      // Continuar com a impressão mesmo sem a logo
      const printContent = `
        <html>
          <head>
            <title>Lista de Materiais - ${selectedEvent.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 20px; 
              }
              .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
              .event-info { margin-bottom: 20px; }
              .event-info h2 { color: #333; margin-bottom: 10px; }
              .event-info p { margin: 5px 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f5f5f5; font-weight: bold; }
              .status { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
              .status-pending { background-color: #fff3cd; color: #856404; }
              .status-confirmed { background-color: #d1ecf1; color: #0c5460; }
              .status-allocated { background-color: #d4edda; color: #155724; }
              .status-returned { background-color: #f8d7da; color: #721c24; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>LISTA DE MATERIAIS</h1>
              <p>Sistema de Controle de Almoxarifado</p>
            </div>
            
            <div class="event-info">
              <h2>${selectedEvent.name}</h2>
              <p><strong>Cliente:</strong> ${selectedEvent.client_name}</p>
              ${selectedEvent.client_email ? `<p><strong>Email:</strong> ${selectedEvent.client_email}</p>` : ''}
              ${selectedEvent.client_phone ? `<p><strong>Telefone:</strong> ${selectedEvent.client_phone}</p>` : ''}
              <p><strong>Data do Evento:</strong> ${format(new Date(selectedEvent.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</p>
              ${selectedEvent.event_time ? `<p><strong>Horário:</strong> ${selectedEvent.event_time}</p>` : ''}
              ${selectedEvent.setup_start_date ? `<p><strong>Data de Montagem:</strong> ${format(new Date(selectedEvent.setup_start_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</p>` : ''}
              ${selectedEvent.location ? `<p><strong>Local:</strong> ${selectedEvent.location}</p>` : ''}
              ${selectedEvent.description ? `<p><strong>Descrição:</strong> ${selectedEvent.description}</p>` : ''}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Quantidade</th>
                  <th>Status</th>
                  <th>Descrição</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${eventEquipment.map(item => `
                  <tr>
                    <td>${item.equipment_name}</td>
                    <td>${item.quantity}</td>
                    <td>
                      <span class="status status-${item.status}">
                        ${getStatusText(item.status)}
                      </span>
                    </td>
                    <td>${item.description || '-'}</td>
                    <td>_________________</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            ${collaborators.length > 0 ? `
              <h3 style="margin-top: 30px; margin-bottom: 15px; color: #333;">Colaboradores do Evento</h3>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Função</th>
                  </tr>
                </thead>
                <tbody>
                  ${collaborators.map(collab => `
                    <tr>
                      <td>${collab.collaborator_name}</td>
                      <td>${collab.collaborator_email}</td>
                      <td>${collab.role === 'funcionario' ? 'Funcionário' : collab.role === 'tecnico' ? 'Técnico' : collab.role}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="footer">
              <p>Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
              <p>Total de itens: ${eventEquipment.length}${collaborators.length > 0 ? ` | Total de colaboradores: ${collaborators.length}` : ''}</p>
            </div>
          </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    };

    logoImg.src = logoUrl;
  };
  
  // Update selectedMonth when year changes
  useEffect(() => {
    setSelectedMonth(new Date(selectedYear, selectedMonth.getMonth(), 1));
  }, [selectedYear]);

  useEffect(() => {
    fetchEvents();
    fetchAvailableEquipment();
    fetchAvailableCollaborators();
    fetchLogo();
  }, []);

  // Fetch equipment and collaborators when dialogs open
  useEffect(() => {
    if (equipmentDialog) {
      console.log('Equipment dialog opened, refreshing available equipment...');
      fetchAvailableEquipment(true);
    }
  }, [equipmentDialog]);

  useEffect(() => {
    if (collaboratorDialog) {
      fetchAvailableCollaborators();
    }
  }, [collaboratorDialog]);

  useEffect(() => {
    if (returnedEquipmentDialog && selectedEvent) {
      console.log('Return equipment dialog opened, fetching allocated equipment...');
      fetchAllocatedEquipmentForReturn(selectedEvent.id);
    }
  }, [returnedEquipmentDialog, selectedEvent]);

  if (loading) {
    return <div className="p-6">Carregando eventos...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={generateMissingEquipmentReport}
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            Relatório de Faltantes
          </Button>
        </div>
      </PageActions>

      <div className="space-y-4">
        {/* Year Selection */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Ano:</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearsAndMonths.map(({ year }) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Tabs */}
        <Tabs value={selectedMonth.toISOString()} onValueChange={(value) => setSelectedMonth(new Date(value))}>
          <TabsList className="months-grid grid h-auto w-full grid-cols-6 gap-1 md:grid-cols-12">
            {yearsAndMonths
              .find(({ year }) => year === selectedYear)
              ?.months.map((month) => (
                <TabsTrigger
                  key={month.toISOString()}
                  value={month.toISOString()}
                  className="text-xs p-2"
                >
                  {format(month, 'MMM', { locale: ptBR })}
                </TabsTrigger>
              ))}
          </TabsList>
          
          {yearsAndMonths
            .find(({ year }) => year === selectedYear)
            ?.months.map((month) => (
              <TabsContent key={month.toISOString()} value={month.toISOString()}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {format(month, 'MMMM yyyy', { locale: ptBR })}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {filteredEvents.length} evento(s)
                    </span>
                  </div>
                  
                  <div className="grid gap-6">
                    {filteredEvents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum evento encontrado para {format(month, 'MMMM yyyy', { locale: ptBR })}
                      </div>
                    ) : (
                      filteredEvents.map((event) => (
                        <Card key={event.id} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="flex items-center gap-2">
                                  <Calendar className="h-5 w-5 text-primary" />
                                  {event.name}
                                </CardTitle>
                                <CardDescription className="mt-2 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{event.client_name}</span>
                                    {event.client_email && (
                                      <span className="text-muted-foreground">• {event.client_email}</span>
                                    )}
                                  </div>
                                  {event.setup_start_date && (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4" />
                                       <span>
                                         Montagem: {format(new Date(event.setup_start_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                       </span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                     <span>
                                       Evento: {format(new Date(event.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                                       {event.event_time && ` às ${event.event_time}`}
                                     </span>
                                  </div>
                                  {event.location && (
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-4 w-4" />
                                      <span>{event.location}</span>
                                    </div>
                                  )}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={getStatusVariant(event.status) as any}>
                                  {getStatusText(event.status)}
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEvent(event);
                                    fetchEquipment(event.id);
                                    fetchCollaborators(event.id);
                                  }}
                                >
                                  <Package className="h-4 w-4 mr-2" />
                                  Equipamentos
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedEventForBudget(event);
                                    fetchEventBudgets(event.id);
                                    setBudgetDialog(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Orçamento
                                </Button>
                                {event.status !== 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => markEventAsCompleted(event.id)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    Concluir
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
        </Tabs>
      </div>

      {/* Equipment Management Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => {
        if (!open) {
          setSelectedEvent(null);
          setEquipment([]);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Equipamentos - {selectedEvent?.name}</DialogTitle>
            <DialogDescription>
              Gerencie os equipamentos atribuídos a este evento
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-6">
              {/* Add Equipment Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Controle de Equipamentos</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateEquipmentPDF}
                      disabled={!selectedEvent || equipment.filter(eq => eq.event_id === selectedEvent.id).length === 0}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Baixar PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={printEquipmentList}
                      disabled={!selectedEvent || equipment.filter(eq => eq.event_id === selectedEvent.id).length === 0}
                      className="gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir Lista
                    </Button>
                    <Dialog open={equipmentDialog} onOpenChange={(open) => {
                      setEquipmentDialog(open);
                      if (!open) {
                        setIsCustomEquipment(false);
                        setEquipmentSearch('');
                        setEquipmentCategory('all');
                        setNewEquipment({
                          equipment_name: '',
                          quantity: 1,
                          description: '',
                          status: 'pending'
                        });
                      }
                    }}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Equipamento
                          </Button>
                        </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Novo Equipamento</DialogTitle>
                          <DialogDescription>
                            Adicione um novo equipamento ao evento
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
                            <Button type="button" variant={!isCustomEquipment ? "default" : "ghost"} size="sm" onClick={() => { setIsCustomEquipment(false); setNewEquipment(prev => ({ ...prev, equipment_name: '' })); }}>
                              Da lista
                            </Button>
                            <Button type="button" variant={isCustomEquipment ? "default" : "ghost"} size="sm" onClick={() => { setIsCustomEquipment(true); setNewEquipment(prev => ({ ...prev, equipment_name: '' })); }}>
                              Item avulso
                            </Button>
                          </div>
                           <div>
                             <div className="flex items-center justify-between">
                               <Label htmlFor="equipment_name">{isCustomEquipment ? 'Nome do item avulso *' : 'Nome do Equipamento *'}</Label>
                               {!isCustomEquipment && (
                                 <Button type="button" variant="ghost" size="sm" onClick={() => fetchAvailableEquipment(true)} className="text-xs">
                                   🔄 Atualizar Lista
                                 </Button>
                               )}
                             </div>
                            {isCustomEquipment ? (
                              <>
                                <Input id="equipment_name" value={newEquipment.equipment_name || ''} onChange={(e) => setNewEquipment(prev => ({ ...prev, equipment_name: e.target.value }))} placeholder="Ex.: fita isolante, cordinha, abraçadeira" autoFocus />
                                <p className="mt-1 text-xs text-muted-foreground">O item será vinculado somente a este evento e não será criado no estoque geral.</p>
                              </>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <Label htmlFor="equipment_search" className="text-xs">Buscar material</Label>
                                    <Input id="equipment_search" value={equipmentSearch} onChange={(e) => setEquipmentSearch(e.target.value)} placeholder="Nome, categoria ou descrição" />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Categoria</Label>
                                    <Select value={equipmentCategory} onValueChange={setEquipmentCategory}>
                                      <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">Todas as categorias</SelectItem>
                                        {equipmentCategories.map(category => (
                                          <SelectItem key={category} value={category}>{category}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <Select value={newEquipment.equipment_name} onValueChange={(value) => setNewEquipment(prev => ({ ...prev, equipment_name: value }))}>
                                  <SelectTrigger id="equipment_name"><SelectValue placeholder={`Selecione um equipamento (${filteredAvailableEquipment.length})`} /></SelectTrigger>
                                  <SelectContent>
                                    {filteredAvailableEquipment.length === 0 ? (
                                      <SelectItem value="__no_results" disabled>Nenhum material encontrado</SelectItem>
                                    ) : filteredAvailableEquipment.map((item) => (
                                      <SelectItem key={item.id} value={item.name}>{item.name} - {item.category} ({item.available} disponíveis)</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {(equipmentSearch || equipmentCategory !== 'all') && (
                                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEquipmentSearch(''); setEquipmentCategory('all'); }}>
                                    Limpar filtros
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="quantity">Quantidade</Label>
                              <Input
                                id="quantity"
                                type="number"
                                min="1"
                                value={newEquipment.quantity || 1}
                                onChange={(e) => setNewEquipment(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="status">Status</Label>
                              <Select value={newEquipment.status} onValueChange={(value) => setNewEquipment(prev => ({ ...prev, status: value }))}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pendente</SelectItem>
                                  <SelectItem value="confirmed">Confirmado</SelectItem>
                                  <SelectItem value="allocated">Alocado</SelectItem>
                                  <SelectItem value="returned">Devolvido</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="description">Descrição</Label>
                            <Textarea
                              id="description"
                              value={newEquipment.description || ''}
                              onChange={(e) => setNewEquipment(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Detalhes sobre o equipamento..."
                            />
                          </div>

                          <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setEquipmentDialog(false)}>
                              Cancelar
                            </Button>
                            <Button onClick={addEquipment}>
                              Adicionar
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

              {/* Equipment Lists - Separate Active and Returned */}
              <div className="space-y-6">
                {/* Active Equipment Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-foreground">Equipamentos Ativos</h4>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {equipment.filter(item => ['pending', 'confirmed', 'allocated', 'active'].includes(item.status)).length} ativo(s)
                    </Badge>
                  </div>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                       <TableBody>
                          {(() => {
                            const activeEquipment = equipment.filter(item => 
                              ['pending', 'confirmed', 'allocated', 'active'].includes(item.status)
                            );
                            console.log('Active equipment:', activeEquipment);
                            console.log('All equipment:', equipment);
                           
                           if (activeEquipment.length === 0) {
                             return (
                               <TableRow>
                                 <TableCell colSpan={5} className="text-center text-muted-foreground">
                                   Nenhum equipamento ativo
                                 </TableCell>
                               </TableRow>
                             );
                           }
                           
                           return activeEquipment.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.equipment_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(item.status) as any}>
                                  {getStatusText(item.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.description || '-'}</TableCell>
                                <TableCell>
                                   <div className="flex gap-2">
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => {
                                         setSelectedEquipmentForEdit(item);
                                         setNewEquipment({
                                           equipment_name: item.equipment_name,
                                           quantity: item.quantity,
                                           description: item.description,
                                           status: item.status
                                         });
                                         setEditEquipmentDialog(true);
                                       }}
                                       className="text-blue-600 hover:text-blue-800" title="Editar" aria-label="Editar">
                                       <Edit className="h-4 w-4" />
                                     </Button>
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={() => deleteEquipment(item.id)}
                                       className="text-red-600 hover:text-red-800" title="Excluir" aria-label="Excluir">
                                       <Trash2 className="h-4 w-4" />
                                     </Button>
                                   </div>
                                </TableCell>
                             </TableRow>
                           ));
                         })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Returned Equipment Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-md font-semibold text-foreground">Equipamentos Devolvidos ao Estoque</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {equipment.filter(item => item.status === 'returned').length} devolvido(s)
                      </Badge>
                      <Dialog open={returnedEquipmentDialog} onOpenChange={setReturnedEquipmentDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar Devolvido
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar Equipamento Devolvido</DialogTitle>
                            <DialogDescription>
                              Adicione um equipamento que foi devolvido ao estoque
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                             <div>
                               <Label htmlFor="returned_equipment_name">Nome do Equipamento Alocado *</Label>
                               <Select value={newEquipment.equipment_name} onValueChange={(value) => setNewEquipment(prev => ({ ...prev, equipment_name: value }))}>
                                 <SelectTrigger>
                                   <SelectValue placeholder="Selecione um equipamento alocado" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {allocatedEquipmentForReturn.map((item) => (
                                     <SelectItem key={item.name} value={item.name}>
                                       {item.name} - {item.availableForReturn} unidade(s) para devolver
                                     </SelectItem>
                                   ))}
                                   {allocatedEquipmentForReturn.length === 0 && (
                                     <div className="p-2 text-sm text-muted-foreground">
                                       Nenhum equipamento alocado para devolver
                                     </div>
                                   )}
                                 </SelectContent>
                               </Select>
                             </div>
                            
                             <div>
                               <Label htmlFor="returned_equipment_quantity">
                                 Quantidade * 
                                 {newEquipment.equipment_name && (
                                   <span className="text-sm text-muted-foreground ml-2">
                                     (Máx: {allocatedEquipmentForReturn.find(item => item.name === newEquipment.equipment_name)?.availableForReturn || 0})
                                   </span>
                                 )}
                               </Label>
                               <Input
                                 id="returned_equipment_quantity"
                                 type="number"
                                 min="1"
                                 max={allocatedEquipmentForReturn.find(item => item.name === newEquipment.equipment_name)?.availableForReturn || 1}
                                 value={newEquipment.quantity || ''}
                                 onChange={(e) => {
                                   const maxAvailable = allocatedEquipmentForReturn.find(item => item.name === newEquipment.equipment_name)?.availableForReturn || 1;
                                   const inputValue = parseInt(e.target.value) || 1;
                                   const validQuantity = Math.min(inputValue, maxAvailable);
                                   setNewEquipment(prev => ({ ...prev, quantity: validQuantity }));
                                 }}
                                 placeholder="Digite a quantidade"
                               />
                             </div>
                            
                            <div>
                              <Label htmlFor="returned_equipment_description">Descrição</Label>
                              <Textarea
                                id="returned_equipment_description"
                                value={newEquipment.description || ''}
                                onChange={(e) => setNewEquipment(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Digite uma descrição (opcional)"
                                rows={3}
                              />
                            </div>

                            <div className="flex justify-end gap-3">
                              <Button variant="outline" onClick={() => {
                                setReturnedEquipmentDialog(false);
                                setNewEquipment({
                                  equipment_name: '',
                                  quantity: 1,
                                  description: '',
                                  status: 'pending'
                                });
                              }}>
                                Cancelar
                              </Button>
                              <Button onClick={addReturnedEquipment}>
                                Adicionar Devolvido
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Quantidade</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {equipment.filter(item => item.status === 'returned').length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              Nenhum equipamento devolvido
                            </TableCell>
                          </TableRow>
                        ) : (
                          equipment.filter(item => item.status === 'returned').map((item) => (
                            <TableRow key={item.id} className="bg-green-50/50">
                              <TableCell className="font-medium">{item.equipment_name}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>
                                <Badge variant={getStatusVariant(item.status) as any}>
                                  {getStatusText(item.status)}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.description || '-'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedEquipmentForEdit(item);
                                      setNewEquipment({
                                        equipment_name: item.equipment_name,
                                        quantity: item.quantity,
                                        description: item.description,
                                        status: item.status
                                      });
                                      setEditEquipmentDialog(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800" title="Editar" aria-label="Editar">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteEquipment(item.id)}
                                    className="text-red-600 hover:text-red-800" title="Excluir" aria-label="Excluir">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Missing Equipment Alert */}
                {(() => {
                  const missingEquipment = calculateMissingEquipment(equipment);
                  if (missingEquipment.length > 0) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-5 w-5 text-red-600" />
                          <h4 className="font-semibold text-red-800">Equipamentos Faltantes</h4>
                        </div>
                        <div className="space-y-2">
                          {missingEquipment.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                              <span className="font-medium">{item.equipment_name}</span>
                              <Badge variant="destructive" className="text-xs">
                                {item.missing} faltando
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Summary */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {equipment.filter(item => ['pending', 'confirmed', 'allocated', 'active'].includes(item.status)).length}
                      </div>
                      <div className="text-sm text-muted-foreground">Equipamentos Pendentes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {equipment.filter(item => item.status === 'returned').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Equipamentos Devolvidos</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-600">
                        {equipment.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total de Equipamentos</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collaborators Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Colaboradores do Evento</h3>
                  <Dialog open={collaboratorDialog} onOpenChange={setCollaboratorDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Colaborador
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Colaborador</DialogTitle>
                        <DialogDescription>
                          Adicione um colaborador ao evento
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Toggle para selecionar da lista ou adicionar novo */}
                        <div className="flex gap-4 p-4 border rounded-lg">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="collaborator_type"
                              checked={!isNewCollaborator}
                              onChange={() => setIsNewCollaborator(false)}
                            />
                            <span>Selecionar da lista</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="collaborator_type"
                              checked={isNewCollaborator}
                              onChange={() => setIsNewCollaborator(true)}
                            />
                            <span>Adicionar novo</span>
                          </label>
                        </div>

                        {/* Seleção da lista de colaboradores */}
                        {!isNewCollaborator && (
                          <div>
                            <Label htmlFor="select_collaborator">Selecionar Colaborador</Label>
                            <Select value={newCollaborator.selectedCollaboratorId} onValueChange={handleCollaboratorSelect}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um colaborador" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCollaborators.map((collaborator) => (
                                  <SelectItem key={collaborator.id} value={collaborator.id}>
                                    {collaborator.name} ({collaborator.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {/* Campos manuais para novo colaborador */}
                        {isNewCollaborator && (
                          <>
                            <div>
                              <Label htmlFor="collaborator_name">Nome do Colaborador *</Label>
                              <Input
                                id="collaborator_name"
                                value={newCollaborator.collaborator_name}
                                onChange={(e) => setNewCollaborator(prev => ({ ...prev, collaborator_name: e.target.value }))}
                                placeholder="Digite o nome do colaborador"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="collaborator_email">Email do Colaborador *</Label>
                              <Input
                                id="collaborator_email"
                                type="email"
                                value={newCollaborator.collaborator_email}
                                onChange={(e) => setNewCollaborator(prev => ({ ...prev, collaborator_email: e.target.value }))}
                                placeholder="email@exemplo.com"
                              />
                            </div>
                          </>
                        )}

                        {/* Função sempre disponível */}
                        <div>
                          <Label htmlFor="collaborator_role">Função</Label>
                          <Select value={newCollaborator.role} onValueChange={(value) => setNewCollaborator(prev => ({ ...prev, role: value }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="funcionario">Funcionário</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="coordenador">Coordenador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex justify-end gap-3">
                          <Button variant="outline" onClick={() => {
                            setCollaboratorDialog(false);
                            setNewCollaborator({
                              collaborator_name: '',
                              collaborator_email: '',
                              role: 'funcionario',
                              selectedCollaboratorId: ''
                            });
                            setIsNewCollaborator(false);
                          }}>
                            Cancelar
                          </Button>
                          <Button onClick={addCollaborator}>
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Collaborators List */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collaborators.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Nenhum colaborador adicionado
                          </TableCell>
                        </TableRow>
                      ) : (
                        collaborators.map((collaborator) => (
                          <TableRow key={collaborator.id}>
                            <TableCell className="font-medium">{collaborator.collaborator_name}</TableCell>
                            <TableCell>{collaborator.collaborator_email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {collaborator.role === 'funcionario' ? 'Funcionário' : 
                                 collaborator.role === 'admin' ? 'Administrador' : 
                                 collaborator.role === 'coordenador' ? 'Coordenador' : 
                                 collaborator.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCollaborator(collaborator.id)}
                                className="text-red-600 hover:text-red-800" title="Excluir" aria-label="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Budget Dialog */}
      <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Orçamento do Evento</DialogTitle>
                <DialogDescription>
                  {selectedEventForBudget && `${selectedEventForBudget.name} - ${selectedEventForBudget.client_name}`}
                </DialogDescription>
              </div>
              {eventBudgets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={printBudgetList}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-y-auto">
            {eventBudgets.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum item no orçamento deste evento</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {eventBudgets.map((budget) => (
                  <Card key={budget.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex gap-4 p-4">
                        {budget.image_url && (
                          <div className="flex-shrink-0">
                            <img
                              src={budget.image_url}
                              alt={budget.item}
                              className="w-24 h-24 object-cover rounded-lg border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-lg">{budget.item}</h4>
                            <Badge variant="outline" className="ml-2">
                              Qtd: {budget.quantity}
                            </Badge>
                          </div>
                          {budget.description && (
                            <p className="text-muted-foreground text-sm">
                              {budget.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Equipment Dialog */}
      <Dialog open={editEquipmentDialog} onOpenChange={setEditEquipmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Equipamento</DialogTitle>
            <DialogDescription>
              Edite as informações do equipamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_equipment_name">Nome do Equipamento *</Label>
              <Select value={newEquipment.equipment_name} onValueChange={(value) => setNewEquipment(prev => ({ ...prev, equipment_name: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {availableEquipment.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name} - {item.category} ({item.available} disponíveis)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_quantity">Quantidade</Label>
                <Input
                  id="edit_quantity"
                  type="number"
                  min="1"
                  value={newEquipment.quantity || 1}
                  onChange={(e) => setNewEquipment(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
                />
              </div>
              
              <div>
                <Label htmlFor="edit_status">Status</Label>
                <Select value={newEquipment.status} onValueChange={(value) => setNewEquipment(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="allocated">Alocado</SelectItem>
                    <SelectItem value="returned">Devolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_description">Descrição</Label>
              <Textarea
                id="edit_description"
                value={newEquipment.description || ''}
                onChange={(e) => setNewEquipment(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalhes sobre o equipamento..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditEquipmentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={updateEquipment}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Missing Equipment Report Dialog */}
      <Dialog open={missingEquipmentDialog} onOpenChange={setMissingEquipmentDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Equipamentos Faltantes</DialogTitle>
            <DialogDescription>
              Eventos concluídos com equipamentos não devolvidos
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {missingEquipmentList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>Nenhum equipamento faltante encontrado!</p>
                <p className="text-sm">Todos os eventos concluídos têm equipamentos devolvidos.</p>
              </div>
            ) : (
              missingEquipmentList.map((item, index) => (
                <Card key={index} className="border-red-200">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <CardTitle className="text-lg">{item.event.name}</CardTitle>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {item.missingEquipment.length} item(s) faltando
                      </Badge>
                    </div>
                    <CardDescription className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{item.event.client_name}</span>
                      </div>
                       <div className="flex flex-wrap items-center gap-2">
                         <Calendar className="h-4 w-4" />
                         <span>{format(new Date(item.event.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}</span>
                       </div>
                      {item.event.location && (
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{item.event.location}</span>
                        </div>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Equipamento</TableHead>
                            <TableHead>Alocado</TableHead>
                            <TableHead>Devolvido</TableHead>
                            <TableHead>Faltando</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.missingEquipment.map((equipment, equipIndex) => (
                            <TableRow key={equipIndex} className="bg-red-50/50">
                              <TableCell className="font-medium">{equipment.equipment_name}</TableCell>
                              <TableCell>{equipment.allocated}</TableCell>
                              <TableCell>{equipment.returned}</TableCell>
                              <TableCell>
                                <Badge variant="destructive">
                                  {equipment.missing}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setMissingEquipmentDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};