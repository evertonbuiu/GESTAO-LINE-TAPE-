import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { usePermissions } from '@/hooks/usePermissions';
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
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Calendar as CalendarIcon, Clock, MapPin, User, Users, UserPlus, Car, DollarSign, FileText, Plus, Edit, Trash2, Calculator, Shield, Settings, Eye, Upload, ExternalLink, FileImage, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useLogo } from '@/hooks/useLogo';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getStatusVariant } from "@/lib/utils";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isSameMonth, addMonths } from 'date-fns';

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  filterRentals,
  sortRentals,
  detectScheduleConflicts,
  validateRentalDates,
  canTransitionRentalStatus,
  isCriticalRentalTransition,
  nextRentalStatuses,
  rentalStatusLabel,
  computePaymentSummary,
  type RentalSortKey,
} from '@/lib/rentals';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkActionsBar } from '@/components/ui/BulkActionsBar';

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
  total_budget: number;
  total_expenses: number;
  profit_margin: number;
  status: string;
  is_paid: boolean;
  payment_date: string;
  payment_bank_account?: string;
  payment_amount: number;
  payment_type: string;
  remaining_payment_amount: number;
  remaining_payment_date: string;
  remaining_payment_bank_account?: string;
  is_remaining_paid: boolean;
  created_at: string;
}

interface EventExpense {
  id: string;
  event_id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier: string;
  notes: string;
  receipt_url: string;
  expense_bank_account?: string;
  expense_date: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: 'active' | 'inactive';
  createdAt: string;
  birth_date?: string;
  whatsapp?: string;
  address_city?: string;
  address_state?: string;
}

interface Worker {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  birth_date?: string;
  primary_role?: string;
  address_city?: string;
  address_state?: string;
  status?: string;
}

interface EventTeamMember {
  id: string;
  event_id: string;
  collaborator_name: string;
  collaborator_email: string;
  role: string;
  collaborator_id?: string | null;
  worker_id?: string | null;
  person_type?: 'collaborator' | 'worker' | null;
  profile?: Collaborator | Worker;
  cpf?: string | null;
  rg?: string | null;
}

interface EventTransportVehicle {
  id: string;
  event_id: string;
  vehicle_model: string;
  vehicle_plate?: string | null;
  driver_name?: string | null;
  seats?: number | null;
  notes?: string | null;
}

export const Rentals = () => {
  const { userRole, user } = useCustomAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { settings: companySettings } = useCompanySettings();
  const { logoUrl } = useLogo();

  // Helper function to get payment status text
  const getPaymentStatusText = (event: Event) => {
    if (!event.is_paid) return 'Pendente';
    
    if (event.payment_type === 'entrada') {
      if (event.is_remaining_paid) {
        return 'Pago Total';
      }
      return 'Pago Entrada';
    }
    
    return 'Pago Total';
  };

  // Helper function to get payment status variant
  const getPaymentStatusVariant = (event: Event) => {
    if (!event.is_paid) return 'destructive';
    if (event.payment_type === 'entrada' && !event.is_remaining_paid) return 'default';
    return 'default';
  };
  const [events, setEvents] = useState<Event[]>([]);
  const [expenses, setExpenses] = useState<EventExpense[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [eventTeam, setEventTeam] = useState<EventTeamMember[]>([]);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [teamPersonType, setTeamPersonType] = useState<'collaborator' | 'worker'>('collaborator');
  const [selectedTeamPersonId, setSelectedTeamPersonId] = useState('');
  const [teamRole, setTeamRole] = useState('');
  const [eventVehicles, setEventVehicles] = useState<EventTransportVehicle[]>([]);
  const [vehicleForm, setVehicleForm] = useState({ vehicle_model: '', vehicle_plate: '', driver_name: '', seats: '', notes: '' });
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedEventForView, setSelectedEventForView] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [editExpenseDialog, setEditExpenseDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [editEventDialog, setEditEventDialog] = useState(false);
  const [statusDialog, setStatusDialog] = useState(false);
  const [selectedEventForStatus, setSelectedEventForStatus] = useState<Event | null>(null);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);
  const [selectedExpenseForEdit, setSelectedExpenseForEdit] = useState<EventExpense | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [canViewRentals, setCanViewRentals] = useState(true);
  const [canEditRentals, setCanEditRentals] = useState(true);
  const [canViewFinancials, setCanViewFinancials] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pendente' | 'parcial' | 'pago'>('all');
  const [sortKey, setSortKey] = useState<RentalSortKey>('event_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pendingStatusChange, setPendingStatusChange] = useState<{ event: Event; status: string } | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    name: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    setup_start_date: '',
    event_date: '',
    event_time: '',
    location: '',
    description: '',
    total_budget: 0,
    status: 'pending'
  });
  const [newExpense, setNewExpense] = useState<Partial<EventExpense>>({
    category: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    supplier: '',
    notes: '',
    expense_date: format(new Date(), 'yyyy-MM-dd')
  });
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('');
  
  // Estados para modal de orçamentos
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [selectedEventForBudget, setSelectedEventForBudget] = useState<Event | null>(null);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [eventBudgets, setEventBudgets] = useState<{[eventId: string]: any[]}>({});
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  const [newBudget, setNewBudget] = useState({
    item: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    image_file: null as File | null
  });
  const [importingBudget, setImportingBudget] = useState(false);
  const [editBudgetDialog, setEditBudgetDialog] = useState(false);
  const [selectedBudgetForEdit, setSelectedBudgetForEdit] = useState<any | null>(null);
  const [pdfViewerDialog, setPdfViewerDialog] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string>('');
  const [isDeletingExpenses, setIsDeletingExpenses] = useState(false);

  // Bulk selection for event expenses
  const expensesBulkSelection = useBulkSelection({
    items: expenses,
    getItemId: (expense) => expense.id
  });

  // Check permissions on mount - Admin and Financeiro have full access
  useEffect(() => {
    const checkPermissions = async () => {
      // Admin and financeiro users have full access to rentals
      const isAuthorized = userRole === 'admin' || userRole === 'financeiro' || userRole === 'deposito';
      const canViewFinancialsResult = userRole === 'admin' || userRole === 'financeiro';
      
      setCanViewRentals(isAuthorized);
      setCanEditRentals(isAuthorized);
      setCanViewFinancials(canViewFinancialsResult);
    };
    checkPermissions();
  }, [userRole]);

  // Realtime subscription para atualizar automaticamente quando orçamentos forem editados
  useEffect(() => {
    // Escutar mudanças em external_quotes
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

    // Escutar mudanças em events
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
          console.log('Evento atualizado, recarregando lista...');
          fetchEvents();
        }
      )
      .subscribe();

    // Escutar mudanças em event_budgets
    const budgetsChannel = supabase
      .channel('event-budgets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_budgets'
        },
        () => {
          console.log('Orçamento de evento atualizado, recarregando...');
          fetchEvents();
        }
      )
      .subscribe();

    // Escutar mudanças em event_expenses (inclui despesas importadas/vinculadas ao evento)
    const expensesChannel = supabase
      .channel('event-expenses-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_expenses' },
        () => {
          console.log('Despesa de evento atualizada, recarregando eventos...');
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(budgetsChannel);
      supabase.removeChannel(expensesChannel);
    };
  }, []);

  // Update selectedMonth when year changes
  useEffect(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    
    // If selected year is current year, use current month, otherwise use January
    if (selectedYear === currentYear) {
      setSelectedMonth(new Date(selectedYear, currentMonth, 1));
    } else {
      setSelectedMonth(new Date(selectedYear, 0, 1));
    }
  }, [selectedYear]);

  // Fetch events and recalculate all profit margins
  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      
      // Recalculate profit margins for all events
      if (data && data.length > 0) {
        const updatedEvents = data.map(event => ({
          ...event,
          profit_margin: (event.total_budget || 0) - (event.total_expenses || 0)
        }));
        
        setEvents(updatedEvents);
        
        // Observação: profit_margin é mantido no banco pelo trigger update_event_totals.
        // Aqui apenas recalculamos para exibição, evitando writes concorrentes a cada leitura.

        // Fetch budgets for all events
        const eventIds = data.map(event => event.id);
        await fetchAllEventBudgets(eventIds);
      } else {
        setEvents([]);
      }
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

  // Filtra por mês selecionado + busca/status/pagamento e aplica ordenação
  const monthEvents = events.filter(event => {
    const eventDate = new Date(event.event_date + 'T12:00:00');
    return isSameMonth(eventDate, selectedMonth);
  });

  const filteredEvents = sortRentals(
    filterRentals(monthEvents, {
      search: searchTerm,
      status: statusFilter,
      paymentStatus: paymentFilter,
    }),
    sortKey,
    sortDirection,
  );

  const hasActiveFilters =
    searchTerm.trim().length > 0 || statusFilter !== 'all' || paymentFilter !== 'all';

  const fetchExpenses = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: "Erro ao carregar despesas",
        description: "Não foi possível carregar as despesas.",
        variant: "destructive"
      });
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Erro ao carregar clientes",
        description: "Não foi possível carregar os clientes.",
        variant: "destructive"
      });
    }
  };

  const fetchCollaborators = async () => {
    try {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*')
        .in('status', ['active', 'ativo'])
        .order('name');

      if (error) throw error;
      
      const formattedCollaborators = (data || []).map(collaborator => ({
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
        phone: collaborator.phone,
        role: collaborator.role,
        status: collaborator.status as 'active' | 'inactive',
        createdAt: collaborator.created_at,
        birth_date: collaborator.birth_date,
        whatsapp: collaborator.whatsapp,
        address_city: collaborator.address_city,
        address_state: collaborator.address_state
      }));
      
      setCollaborators(formattedCollaborators);
    } catch (error) {
      console.error('Error fetching collaborators:', error);
      toast({
        title: "Erro ao carregar colaboradores",
        description: "Não foi possível carregar os colaboradores.",
        variant: "destructive"
      });
    }
  };

  const fetchWorkers = async () => {
    try {
      const { data, error } = await (supabase.from('workers') as any)
        .select('*')
        .in('status', ['active', 'ativo'])
        .order('name');

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast({
        title: "Erro ao carregar diaristas",
        description: "Não foi possível carregar os diaristas.",
        variant: "destructive"
      });
    }
  };

  const fetchEventTeam = async (eventId: string) => {
    setLoadingTeam(true);
    try {
      const { data, error } = await (supabase.from('event_collaborators') as any)
        .select('*')
        .eq('event_id', eventId)
        .order('collaborator_name');
      if (error) throw error;

      let sensitiveRows: any[] = [];
      if (userRole === 'admin' || userRole === 'financeiro') {
        const { data: sensitiveData, error: sensitiveError } = await (supabase.from('person_sensitive_data' as any) as any)
          .select('person_type, person_id, cpf, rg');
        if (sensitiveError) console.warn('Dados sensíveis indisponíveis para o PDF:', sensitiveError);
        sensitiveRows = sensitiveData || [];
      }

      const merged = (data || []).map((member: any) => {
        const roleIndicatesWorker = String(member.role || '').trim().toLocaleLowerCase('pt-BR') === 'diarista';
        const personType = member.person_type === 'worker'
          || member.worker_id
          || member.reference_type === 'daily_rate'
          || roleIndicatesWorker
          ? 'worker'
          : 'collaborator';
        const personId = personType === 'worker' ? member.worker_id : member.collaborator_id;
        const normalizedName = String(member.collaborator_name || '').trim().toLocaleLowerCase('pt-BR');
        const normalizedEmail = String(member.collaborator_email || '').trim().toLocaleLowerCase('pt-BR');
        const candidates = personType === 'worker' ? workers : collaborators;
        // Vínculos antigos não possuem person_id. Nesses casos, recupera a ficha por e-mail/nome.
        const profile = candidates.find(person => person.id === personId)
          || candidates.find(person => normalizedEmail && String(person.email || '').trim().toLocaleLowerCase('pt-BR') === normalizedEmail)
          || candidates.find(person => String(person.name || '').trim().toLocaleLowerCase('pt-BR') === normalizedName);
        const resolvedPersonId = personId || profile?.id;
        const sensitive = sensitiveRows.find(row => row.person_type === personType && row.person_id === resolvedPersonId);
        return {
          ...member,
          collaborator_name: profile?.name || member.collaborator_name,
          collaborator_email: profile?.email || member.collaborator_email,
          person_type: personType,
          profile,
          cpf: sensitive?.cpf,
          rg: sensitive?.rg
        };
      });
      // Uma pessoa pode ter várias diárias no mesmo evento. A equipe e o PDF
      // devem exibi-la uma única vez, independentemente da quantidade de dias.
      const uniqueTeam = Array.from(
        new Map(merged.map((member: EventTeamMember) => {
          const profile = member.profile as any;
          const identity = member.worker_id
            || member.collaborator_id
            || profile?.id
            || String(member.collaborator_email || '').trim().toLocaleLowerCase('pt-BR')
            || String(member.collaborator_name || '').trim().toLocaleLowerCase('pt-BR');
          return [`${member.person_type}:${identity}`, member] as const;
        })).values()
      );
      setEventTeam(uniqueTeam);
    } catch (error) {
      console.error('Error fetching event team:', error);
      toast({ title: 'Erro ao carregar equipe', description: 'Não foi possível carregar a equipe do evento.', variant: 'destructive' });
    } finally {
      setLoadingTeam(false);
    }
  };

  const addEventTeamMember = async () => {
    if (!selectedEventForView || !selectedTeamPersonId || !user) {
      toast({ title: 'Selecione uma pessoa', description: 'Escolha um colaborador ou diarista para adicionar.', variant: 'destructive' });
      return;
    }
    const person = teamPersonType === 'worker'
      ? workers.find(item => item.id === selectedTeamPersonId)
      : collaborators.find(item => item.id === selectedTeamPersonId);
    if (!person) return;

    const duplicate = eventTeam.some(member =>
      (teamPersonType === 'worker' ? member.worker_id : member.collaborator_id) === selectedTeamPersonId
    );
    if (duplicate) {
      toast({ title: 'Pessoa já adicionada', description: 'Esta pessoa já faz parte da equipe do evento.', variant: 'destructive' });
      return;
    }

    try {
      const defaultRole = teamPersonType === 'worker'
        ? (person as Worker).primary_role
        : (person as Collaborator).role;
      const { error } = await (supabase.from('event_collaborators') as any).insert({
        event_id: selectedEventForView.id,
        collaborator_name: person.name,
        collaborator_email: person.email || '',
        role: teamRole.trim() || defaultRole || 'Equipe',
        assigned_by: user.id,
        collaborator_id: teamPersonType === 'collaborator' ? person.id : null,
        worker_id: teamPersonType === 'worker' ? person.id : null,
        person_type: teamPersonType,
        reference_type: teamPersonType,
        reference_id: person.id
      });
      if (error) throw error;
      setSelectedTeamPersonId('');
      setTeamRole('');
      await fetchEventTeam(selectedEventForView.id);
      toast({ title: 'Pessoa adicionada', description: `${person.name} foi incluído(a) na equipe.` });
    } catch (error) {
      console.error('Error adding event team member:', error);
      toast({ title: 'Erro ao adicionar', description: 'Não foi possível adicionar a pessoa à equipe.', variant: 'destructive' });
    }
  };

  const removeEventTeamMember = async (memberId: string) => {
    if (!selectedEventForView) return;
    try {
      const { error } = await supabase.from('event_collaborators').delete().eq('id', memberId);
      if (error) throw error;
      await fetchEventTeam(selectedEventForView.id);
      toast({ title: 'Pessoa removida', description: 'A equipe do evento foi atualizada.' });
    } catch (error) {
      console.error('Error removing event team member:', error);
      toast({ title: 'Erro ao remover', description: 'Não foi possível remover a pessoa.', variant: 'destructive' });
    }
  };

  const fetchEventVehicles = async (eventId: string) => {
    try {
      const { data, error } = await (supabase.from('event_transport_vehicles' as any) as any)
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');
      if (error) throw error;
      setEventVehicles(data || []);
    } catch (error) {
      console.error('Error fetching event vehicles:', error);
      toast({ title: 'Erro ao carregar transporte', description: 'Não foi possível carregar os carros do evento.', variant: 'destructive' });
    }
  };

  const addEventVehicle = async () => {
    if (!selectedEventForView || !vehicleForm.vehicle_model.trim() || !user) {
      toast({ title: 'Informe o carro', description: 'Preencha o modelo ou a identificação do carro.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await (supabase.from('event_transport_vehicles' as any) as any).insert({
        event_id: selectedEventForView.id,
        vehicle_model: vehicleForm.vehicle_model.trim(),
        vehicle_plate: vehicleForm.vehicle_plate.trim().toUpperCase() || null,
        driver_name: vehicleForm.driver_name.trim() || null,
        seats: vehicleForm.seats ? Number(vehicleForm.seats) : null,
        notes: vehicleForm.notes.trim() || null,
        created_by: user.id
      });
      if (error) throw error;
      setVehicleForm({ vehicle_model: '', vehicle_plate: '', driver_name: '', seats: '', notes: '' });
      await fetchEventVehicles(selectedEventForView.id);
      toast({ title: 'Carro adicionado', description: 'O transporte foi incluído no evento e no PDF.' });
    } catch (error) {
      console.error('Error adding event vehicle:', error);
      toast({ title: 'Erro ao adicionar carro', description: 'Não foi possível salvar o transporte.', variant: 'destructive' });
    }
  };

  const removeEventVehicle = async (vehicleId: string) => {
    if (!selectedEventForView) return;
    try {
      const { error } = await (supabase.from('event_transport_vehicles' as any) as any).delete().eq('id', vehicleId);
      if (error) throw error;
      await fetchEventVehicles(selectedEventForView.id);
      toast({ title: 'Carro removido', description: 'O transporte foi removido do evento.' });
    } catch (error) {
      console.error('Error removing event vehicle:', error);
      toast({ title: 'Erro ao remover carro', description: 'Não foi possível remover o transporte.', variant: 'destructive' });
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*');

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (error: any) {
      // Ignorar erros de "Failed to fetch" que são causados por cancelamento de requisições
      if (error?.message?.includes('Failed to fetch')) {
        console.log('Bank accounts fetch was cancelled or interrupted');
        return;
      }
      
      console.error('Error fetching bank accounts:', error);
      toast({
        title: "Erro ao carregar contas bancárias",
        description: "Não foi possível carregar as contas bancárias.",
        variant: "destructive"
      });
    }
  };

  // Fetch budgets for a specific event
  const fetchBudgets = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('event_budgets' as any)
        .select('*')
        .eq('event_id', eventId);

      if (error) throw error;
      setBudgets(data || []);
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({
        title: "Erro ao carregar orçamentos",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive"
      });
    }
  };

  const fetchAllEventBudgets = async (eventIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('event_budgets')
        .select('*')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group budgets by event_id
      const budgetsByEvent: {[eventId: string]: any[]} = {};
      data?.forEach(budget => {
        if (!budgetsByEvent[budget.event_id]) {
          budgetsByEvent[budget.event_id] = [];
        }
        budgetsByEvent[budget.event_id].push(budget);
      });

      setEventBudgets(budgetsByEvent);
    } catch (error) {
      console.error('Error fetching all event budgets:', error);
    }
  };

  const createBudget = async (budget: typeof newBudget) => {
    if (!selectedEventForBudget || !user) return;

    try {
      const budgetData = {
        event_id: selectedEventForBudget.id,
        item: budget.item,
        description: budget.description,
        quantity: budget.quantity,
        unit_price: budget.unit_price,
        total_price: budget.total_price,
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('event_budgets' as any)
        .insert(budgetData)
        .select();

      if (error) throw error;

      setBudgets([...budgets, ...data]);
      
      // Update eventBudgets state and recalculate total_budget
      await fetchAllEventBudgets([selectedEventForBudget.id]);
      const updatedBudgets = [...budgets, ...data];
      const newTotalBudget = updatedBudgets.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
      await updateEventFinancials(selectedEventForBudget.id, undefined, newTotalBudget);
      
      toast({
        title: "Item de orçamento criado com sucesso!",
        description: "O item foi adicionado ao orçamento do evento.",
      });

    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Erro ao criar item de orçamento",
        description: "Não foi possível criar o item de orçamento.",
        variant: "destructive"
      });
    } finally {
      setNewBudget({
        item: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        image_file: null
      });
    }
  };

  const deleteBudget = async (id: string) => {
    try {
      const { error } = await supabase
        .from('event_budgets' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBudgets(budgets.filter(budget => budget.id !== id));
      
      // Update the eventBudgets state and recalculate total_budget
      if (selectedEventForBudget) {
        await fetchAllEventBudgets([selectedEventForBudget.id]);
        const updatedBudgets = budgets.filter(budget => budget.id !== id);
        const newTotalBudget = updatedBudgets.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
        await updateEventFinancials(selectedEventForBudget.id, undefined, newTotalBudget);
      }
      
      toast({
        title: "Item de orçamento excluído com sucesso!",
        description: "O item foi removido do orçamento.",
      });
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        title: "Erro ao excluir item de orçamento",
        description: "Não foi possível excluir o item de orçamento.",
        variant: "destructive"
      });
    }
  };

  const updateBudget = async (id: string, updatedBudget: any) => {
    try {
      let image_url = updatedBudget.image_url;
      
      // Se há um arquivo de imagem novo, fazer upload
      if (updatedBudget.image_file) {
        const fileExt = updatedBudget.image_file.name.split('.').pop();
        const fileName = `${id}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('equipment-images')
          .upload(fileName, updatedBudget.image_file, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('equipment-images')
          .getPublicUrl(fileName);
        
        image_url = urlData.publicUrl;
      }

      const budgetData = {
        item: updatedBudget.item,
        description: updatedBudget.description,
        quantity: updatedBudget.quantity,
        unit_price: updatedBudget.unit_price,
        total_price: updatedBudget.total_price,
        image_url
      };

      const { error } = await supabase
        .from('event_budgets' as any)
        .update(budgetData)
        .eq('id', id);

      if (error) throw error;

      // Refresh budgets list and recalculate financials
      if (selectedEventForBudget) {
        await fetchBudgets(selectedEventForBudget.id);
        await fetchAllEventBudgets([selectedEventForBudget.id]);
        
        // Recalculate total_budget based on all budgets
        const currentBudgets = budgets.map(b => b.id === id ? { ...b, ...budgetData } : b);
        const newTotalBudget = currentBudgets.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
        await updateEventFinancials(selectedEventForBudget.id, undefined, newTotalBudget);
      }

      setEditBudgetDialog(false);
      setSelectedBudgetForEdit(null);
      
      toast({
        title: "Item de orçamento atualizado com sucesso!",
        description: "O item foi atualizado no orçamento.",
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        title: "Erro ao atualizar item de orçamento",
        description: "Não foi possível atualizar o item de orçamento.",
        variant: "destructive"
      });
    }
  };

  const importBudgetFromFile = async (file: File) => {
    if (!selectedEventForBudget || !user) return;

    setImportingBudget(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', selectedEventForBudget.id);
      formData.append('userId', user.id);

      const { data, error } = await supabase.functions.invoke('import-budget', {
        body: formData
      });

      if (error) throw error;

      if (data.success) {
        // Refresh the budgets list and recalculate financials
        await fetchBudgets(selectedEventForBudget.id);
        await fetchAllEventBudgets([selectedEventForBudget.id]);
        
        // Recalculate total_budget based on imported budget
        const { data: budgetData, error: budgetError } = await supabase
          .from('event_budgets')
          .select('*')
          .eq('event_id', selectedEventForBudget.id);
          
        if (budgetData && !budgetError) {
          const newTotalBudget = budgetData.reduce((acc, curr) => acc + (curr.total_price || 0), 0);
          await updateEventFinancials(selectedEventForBudget.id, undefined, newTotalBudget);
        }
        
        toast({
          title: "Orçamento importado com sucesso!",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Failed to import budget');
      }

    } catch (error) {
      console.error('Error importing budget:', error);
      toast({
        title: "Erro ao importar orçamento",
        description: error instanceof Error ? error.message : "Não foi possível importar o orçamento.",
        variant: "destructive"
      });
    } finally {
      setImportingBudget(false);
    }
  };

  const viewPdf = async (pdfPath: string) => {
    if (pdfPath) {
      console.log('Original PDF path:', pdfPath);
      
      // Extract just the filename from various possible URL formats
      let fileName = pdfPath;
      
      // Handle full Supabase URLs
      if (pdfPath.includes('supabase.co/storage/v1/object/public/budget-pdfs/')) {
        fileName = pdfPath.split('supabase.co/storage/v1/object/public/budget-pdfs/')[1];
      } else if (pdfPath.includes('/budget-pdfs/')) {
        fileName = pdfPath.split('/budget-pdfs/')[1];
      } else if (pdfPath.includes('public/budget-pdfs/')) {
        fileName = pdfPath.split('public/budget-pdfs/')[1];
      }
      
      // Remove any query parameters
      if (fileName.includes('?')) {
        fileName = fileName.split('?')[0];
      }
      
      console.log('Extracted filename:', fileName);
      
      const { data, error } = await supabase.functions.invoke('serve-pdf', {
        body: { path: fileName },
      });
      if (error || !data) {
        toast({
          title: 'Erro ao abrir PDF',
          description: 'NÃ£o foi possÃ­vel carregar o arquivo.',
          variant: 'destructive',
        });
        return;
      }

      const pdfBlob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      setSelectedPdfUrl(URL.createObjectURL(pdfBlob));
      setPdfViewerDialog(true);
    }
  };

  const createEvent = async (event: Partial<Event>) => {
    if (!event.name || !event.client_name || !event.event_date || !user) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome do evento, cliente e data.",
        variant: "destructive"
      });
      return;
    }

    const dateCheck = validateRentalDates({
      setup_start_date: event.setup_start_date,
      event_date: event.event_date,
    });
    if (!dateCheck.valid) {
      toast({
        title: "Datas inválidas",
        description: dateCheck.errors.join(' '),
        variant: "destructive"
      });
      return;
    }

    const conflicts = detectScheduleConflicts(
      { id: 'novo', location: event.location, setup_start_date: event.setup_start_date, event_date: event.event_date },
      events,
    );
    const hardConflicts = conflicts.filter(c => c.severity === 'conflict');
    if (hardConflicts.length > 0) {
      toast({
        title: "Conflito de agenda",
        description: `Já existe locação ativa no mesmo local e período: ${hardConflicts.map(c => c.rental.name).join(', ')}.`,
      });
    }

    try {
      const eventData = {
        name: event.name,
        client_name: event.client_name,
        client_email: event.client_email || '',
        client_phone: event.client_phone || '',
        setup_start_date: event.setup_start_date || null,
        event_date: event.event_date,
        event_time: event.event_time || null,
        location: event.location || '',
        description: event.description || '',
        total_budget: event.total_budget || 0,
        status: event.status || 'pending',
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('events')
        .insert(eventData)
        .select();

      if (error) throw error;
      
      await fetchEvents();
      toast({
        title: "Evento criado com sucesso!",
        description: "O evento foi criado e adicionado à lista.",
      });
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Erro ao criar evento",
        description: "Não foi possível criar o evento.",
        variant: "destructive"
      });
    } finally {
      setEventDialog(false);
      setNewEvent({
        name: '',
        client_name: '',
        client_email: '',
        client_phone: '',
        setup_start_date: '',
        event_date: '',
        event_time: '',
        location: '',
        description: '',
        total_budget: 0,
        status: 'pending'
      });
    }
  };

  const updateEvent = async (id: string, updates: Partial<Event>, options: { skipStatusConfirm?: boolean } = {}) => {
    const current = events.find(e => e.id === id);

    if (updates.event_date || updates.setup_start_date) {
      const dateCheck = validateRentalDates({
        setup_start_date: updates.setup_start_date ?? current?.setup_start_date,
        event_date: updates.event_date ?? current?.event_date,
      });
      if (!dateCheck.valid) {
        toast({
          title: "Datas inválidas",
          description: dateCheck.errors.join(' '),
          variant: "destructive"
        });
        return;
      }
    }

    if (current && updates.status && updates.status !== current.status) {
      if (!canTransitionRentalStatus(current.status, updates.status)) {
        toast({
          title: "Transição de status não permitida",
          description: `De "${rentalStatusLabel(current.status)}" só é possível ir para: ${
            nextRentalStatuses(current.status).map(rentalStatusLabel).join(', ') || 'nenhum status (registro finalizado)'
          }.`,
          variant: "destructive"
        });
        return;
      }
      if (isCriticalRentalTransition(updates.status) && !options.skipStatusConfirm) {
        setPendingStatusChange({ event: { ...current, ...updates } as Event, status: updates.status });
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;

      // Update the events state immediately
      const updatedEvent = { ...events.find(e => e.id === id), ...data[0] };
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === id ? updatedEvent : event
      ));
      
      // If total_budget was updated, recalculate profit_margin
      if (updates.total_budget !== undefined) {
        await updateEventFinancials(id, undefined, updates.total_budget);
      }
      
      // Close dialogs and clear state immediately after successful update
      setEditEventDialog(false);
      setSelectedEventForEdit(null);
      
      toast({
        title: "Evento atualizado com sucesso!",
        description: "O evento foi atualizado.",
      });
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: "Erro ao atualizar evento",
        description: "Não foi possível atualizar o evento.",
        variant: "destructive"
      });
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      // 1) Buscar todas as despesas do evento para limpar bank_transactions relacionadas
      const { data: eventExpenses } = await supabase
        .from('event_expenses')
        .select('id, total_price, expense_date, expense_bank_account')
        .eq('event_id', id);

      // 2) Buscar diárias vinculadas ao evento
      const { data: eventDailyRates } = await supabase
        .from('daily_rates')
        .select('id, amount, date, bank_account_id, worker_name')
        .eq('event_id', id);

      // 3) Buscar auxílios alimentação vinculados ao evento
      const { data: eventFoodAllowances } = await supabase
        .from('collaborator_food_allowances')
        .select('id, amount, allowance_date, bank_account_id')
        .eq('event_id', id);

      // 4) Limpar transações bancárias relacionadas às despesas do evento
      if (eventExpenses && eventExpenses.length > 0) {
        for (const expense of eventExpenses) {
          // Por referência direta
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'expense')
            .eq('reference_id', expense.id);

          // Compatibilidade: reference_type = event_expense
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'event_expense')
            .eq('reference_id', expense.id);
        }
      }

      // 5) Limpar transações bancárias de receita do evento (pagamentos)
      await supabase
        .from('bank_transactions')
        .delete()
        .eq('reference_type', 'event')
        .eq('reference_id', id);

      await supabase
        .from('bank_transactions')
        .delete()
        .eq('reference_type', 'event_remaining')
        .eq('reference_id', id);

      // 6) Limpar transações bancárias das diárias vinculadas
      if (eventDailyRates && eventDailyRates.length > 0) {
        for (const rate of eventDailyRates) {
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'daily_rate')
            .eq('reference_id', rate.id);

          // Deletar a diária em si
          await supabase
            .from('daily_rates')
            .delete()
            .eq('id', rate.id);
        }
      }

      // 7) Limpar transações bancárias dos auxílios alimentação vinculados
      if (eventFoodAllowances && eventFoodAllowances.length > 0) {
        for (const allowance of eventFoodAllowances) {
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'worker_food_allowance')
            .eq('reference_id', allowance.id);

          // Deletar o auxílio alimentação em si
          await supabase
            .from('collaborator_food_allowances')
            .delete()
            .eq('id', allowance.id);
        }
      }

      // 8) Limpar adiantamentos de diaristas (worker_advances) vinculados via notas com o nome do evento
      const eventData = events.find(e => e.id === id);
      if (eventData) {
        const { data: workerAdvances } = await supabase
          .from('worker_advances')
          .select('id')
          .ilike('notes', `%[Evento: ${eventData.name}]%`);

        if (workerAdvances && workerAdvances.length > 0) {
          for (const advance of workerAdvances) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('reference_type', 'worker_advance')
              .eq('reference_id', advance.id);

            await supabase
              .from('worker_advances')
              .delete()
              .eq('id', advance.id);
          }
        }

        // 9) Limpar notinhas de diaristas vinculadas ao evento
        const { data: workerExpenseAdvances } = await supabase
          .from('worker_expense_advances')
          .select('id')
          .ilike('notes', `%[Evento: ${eventData.name}]%`);

        if (workerExpenseAdvances && workerExpenseAdvances.length > 0) {
          for (const expense of workerExpenseAdvances) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('reference_type', 'worker_expense_advance')
              .eq('reference_id', expense.id);

            await supabase
              .from('worker_expense_advances')
              .delete()
              .eq('id', expense.id);
          }
        }

        // 10) Limpar transações bancárias importadas manualmente que contêm o nome do evento na descrição
        // Isso captura transações do tipo "Sinal/Entrada: dvd simone mendes" que foram vinculadas ao evento
        const eventNameLower = eventData.name.toLowerCase();
        const clientNameLower = (eventData.client_name || '').toLowerCase();
        
        // Buscar transações que podem estar vinculadas ao evento pela descrição
        const { data: manualTransactions } = await supabase
          .from('bank_transactions')
          .select('id, description, reference_id')
          .or(`reference_id.eq.${id},description.ilike.%${eventData.name}%`);

        if (manualTransactions && manualTransactions.length > 0) {
          for (const tx of manualTransactions) {
            // Se tem reference_id apontando para o evento OU descrição contém o nome do evento
            const descLower = (tx.description || '').toLowerCase();
            const isLinkedToEvent = tx.reference_id === id || 
                                    descLower.includes(eventNameLower) ||
                                    (clientNameLower && descLower.includes(clientNameLower));
            
            if (isLinkedToEvent) {
              await supabase
                .from('bank_transactions')
                .delete()
                .eq('id', tx.id);
            }
          }
        }
      }

      // 11) Finalmente, deletar o evento (CASCADE remove event_expenses, event_equipment, event_collaborators automaticamente)
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEvents(events.filter(event => event.id !== id));
      toast({
        title: "Evento excluído com sucesso!",
        description: "O evento e todas as movimentações vinculadas foram removidos.",
      });
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Erro ao excluir evento",
        description: "Não foi possível excluir o evento.",
        variant: "destructive"
      });
    }
  };

  const createExpense = async (expense: Partial<EventExpense>) => {
    if (!selectedEvent || !user) return;

    try {
      const expenseData = {
        event_id: selectedEvent.id,
        category: expense.category || '',
        description: expense.description || '',
        quantity: expense.quantity || 1,
        unit_price: expense.unit_price || 0,
        total_price: expense.total_price || 0,
        supplier: expense.supplier || '',
        notes: expense.notes || '',
        expense_date: expense.expense_date || format(new Date(), 'yyyy-MM-dd'),
        expense_bank_account: expense.expense_bank_account || '',
        created_by: user.id
      };

      const { data, error } = await supabase
        .from('event_expenses')
        .insert(expenseData)
        .select();

      if (error) throw error;

      setExpenses([...expenses, ...data]);
      toast({
        title: "Despesa criada com sucesso!",
        description: "A despesa foi adicionada ao evento.",
      });

      // Recalculate total_expenses and profit_margin
      const updatedExpenses = [...expenses, ...data];
      const newTotalExpenses = updatedExpenses
        .filter(exp => exp.event_id === selectedEvent.id)
        .reduce((acc, curr) => acc + (curr.total_price || 0), 0);
      
      await updateEventFinancials(selectedEvent.id, newTotalExpenses);

    } catch (error) {
      console.error('Error creating expense:', error);
      toast({
        title: "Erro ao criar despesa",
        description: "Não foi possível criar a despesa.",
        variant: "destructive"
      });
    } finally {
      setExpenseDialog(false);
      setNewExpense({
        category: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        supplier: '',
        notes: '',
        expense_date: format(new Date(), 'yyyy-MM-dd')
      });
    }
  };

  const updateExpense = async (id: string, updates: Partial<EventExpense>) => {
    try {
      const { data, error } = await supabase
        .from('event_expenses')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;

      setExpenses(expenses.map(expense => (expense.id === id ? { ...expense, ...data[0] } : expense)));
      toast({
        title: "Despesa atualizada com sucesso!",
        description: "A despesa foi atualizada.",
      });

      // Recalculate total_expenses and profit_margin
      if (selectedEvent) {
        const updatedExpenses = expenses.map(expense => (expense.id === id ? { ...expense, ...data[0] } : expense));
        const newTotalExpenses = updatedExpenses
          .filter(exp => exp.event_id === selectedEvent.id)
          .reduce((acc, curr) => acc + (curr.total_price || 0), 0);

        await updateEventFinancials(selectedEvent.id, newTotalExpenses);
      }

    } catch (error) {
      console.error('Error updating expense:', error);
      toast({
        title: "Erro ao atualizar despesa",
        description: "Não foi possível atualizar a despesa.",
        variant: "destructive"
      });
    } finally {
      setEditExpenseDialog(false);
      setSelectedExpenseForEdit(null);
    }
  };

  // Function to update event financials including profit margin
  const updateEventFinancials = async (eventId: string, newTotalExpenses?: number, newTotalBudget?: number) => {
    try {
      if (!eventId) return;
      
      // Get current event data - use callback to get latest state
      setEvents(prevEvents => {
        const currentEvent = prevEvents.find(e => e.id === eventId);
        if (!currentEvent) return prevEvents;
        
        const totalExpenses = newTotalExpenses !== undefined ? newTotalExpenses : currentEvent.total_expenses;
        const totalBudget = newTotalBudget !== undefined ? newTotalBudget : currentEvent.total_budget;
        const profitMargin = totalBudget - totalExpenses;
        
        const updateData: any = { profit_margin: profitMargin };
        if (newTotalExpenses !== undefined) updateData.total_expenses = newTotalExpenses;
        if (newTotalBudget !== undefined) updateData.total_budget = newTotalBudget;
        
        // Update database
        supabase
          .from('events')
          .update(updateData)
          .eq('id', eventId)
          .then(({ error }) => {
            if (error) console.error('Error updating event financials:', error);
          });
        
        // Update local state immediately
        const updatedEvent = { 
          ...currentEvent, 
          total_expenses: totalExpenses,
          total_budget: totalBudget,
          profit_margin: profitMargin 
        };
        
        // Update related states if needed
        if (selectedEvent && selectedEvent.id === eventId) {
          setSelectedEvent(updatedEvent);
        }
        
        if (selectedEventForView && selectedEventForView.id === eventId) {
          setSelectedEventForView(updatedEvent);
        }
        
        return prevEvents.map(event =>
          event.id === eventId ? updatedEvent : event
        );
      });
      
    } catch (error) {
      console.error('Error updating event financials:', error);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      // Buscar dados da despesa antes de deletar para sincronizar com bank_transactions
      const { data: expenseData } = await supabase
        .from('event_expenses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const { error } = await supabase
        .from('event_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Deletar do bank_transactions (fluxo de caixa e extrato)
      if (expenseData) {
        // 1) Deletar por referência direta (padrão atual)
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'expense')
          .eq('reference_id', id);

        // 2) Compatibilidade: imports antigos gravaram como event_expense
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'event_expense')
          .eq('reference_id', id);

        // 3) Compatibilidade: bug antigo gravou reference_id = event_id (não expense.id)
        const txDate = expenseData.expense_date || expenseData.payment_date || (expenseData.created_at ? String(expenseData.created_at).slice(0, 10) : null);
        if (expenseData.event_id && txDate) {
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'event_expense')
            .eq('reference_id', expenseData.event_id)
            .eq('transaction_date', txDate)
            .eq('amount', expenseData.total_price);
        }

        // 4) Deletar por correspondência de dados (para transações importadas/manuais)
        if (expenseData.expense_bank_account && txDate) {
          const bankAccountName = String(expenseData.expense_bank_account || '').trim();
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .ilike('name', bankAccountName)
            .maybeSingle();

          if (bankAccount) {
            // 4.1) tentativa com descrição (mais segura)
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expenseData.total_price)
              .eq('transaction_type', 'expense')
              .ilike('description', `%${expenseData.description}%`);

            // 4.2) fallback sem descrição (para descrições diferentes do extrato)
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expenseData.total_price)
              .eq('transaction_type', 'expense')
              .or('reference_type.is.null,reference_type.eq.expense,reference_type.eq.event_expense');
          }
        }
      }

      setExpenses(expenses.filter(expense => expense.id !== id));
      toast({
        title: "Despesa excluída com sucesso!",
        description: "A despesa foi removida do evento.",
      });

      // Recalculate total_expenses and profit_margin
      if (selectedEvent) {
        const updatedExpenses = expenses.filter(expense => expense.id !== id);
        const newTotalExpenses = updatedExpenses
          .filter(exp => exp.event_id === selectedEvent.id)
          .reduce((acc, curr) => acc + (curr.total_price || 0), 0);

        await updateEventFinancials(selectedEvent.id, newTotalExpenses);
      }

    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: "Erro ao excluir despesa",
        description: "Não foi possível excluir a despesa.",
        variant: "destructive"
      });
    }
  };

  // Bulk delete event expenses
  const handleBulkDeleteExpenses = async () => {
    const selectedIds = Array.from(expensesBulkSelection.selectedIds);
    if (selectedIds.length === 0) return;

    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.length} despesa(s)?`)) {
      return;
    }

    setIsDeletingExpenses(true);
    try {
      // Get all selected expenses data for cleanup
      const selectedExpenses = expenses.filter(e => selectedIds.includes(e.id));

      // Delete from bank_transactions (all cleanup strategies)
      for (const expense of selectedExpenses) {
        // 1) Delete by direct reference (current standard)
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'expense')
          .eq('reference_id', expense.id);

        // 2) Compatibility: old imports saved as event_expense
        await supabase
          .from('bank_transactions')
          .delete()
          .eq('reference_type', 'event_expense')
          .eq('reference_id', expense.id);

        // 3) Compatibility: fallback with event_id + date + amount
        const txDate = expense.expense_date || (expense as any).payment_date || null;
        if (expense.event_id && txDate) {
          await supabase
            .from('bank_transactions')
            .delete()
            .eq('reference_type', 'event_expense')
            .eq('reference_id', expense.event_id)
            .eq('transaction_date', txDate)
            .eq('amount', expense.total_price);
        }

        // 4) Delete by data match (for imported/manual transactions)
        if (expense.expense_bank_account && txDate) {
          const bankAccountName = String(expense.expense_bank_account || '').trim();
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('id')
            .ilike('name', bankAccountName)
            .maybeSingle();

          if (bankAccount) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('bank_account_id', bankAccount.id)
              .eq('transaction_date', txDate)
              .eq('amount', expense.total_price)
              .eq('transaction_type', 'expense');
          }
        }
      }

      // Delete all selected expenses from event_expenses
      const { error } = await supabase
        .from('event_expenses')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      // Update local state
      const remainingExpenses = expenses.filter(e => !selectedIds.includes(e.id));
      setExpenses(remainingExpenses);
      expensesBulkSelection.clearSelection();

      // Recalculate total_expenses and profit_margin
      if (selectedEvent) {
        const newTotalExpenses = remainingExpenses
          .filter(exp => exp.event_id === selectedEvent.id)
          .reduce((acc, curr) => acc + (curr.total_price || 0), 0);

        await updateEventFinancials(selectedEvent.id, newTotalExpenses);
      }

      toast({
        title: "Despesas excluídas com sucesso!",
        description: `${selectedIds.length} despesa(s) foram removidas.`,
      });
    } catch (error) {
      console.error('Error bulk deleting expenses:', error);
      toast({
        title: "Erro ao excluir despesas",
        description: "Não foi possível excluir as despesas selecionadas.",
        variant: "destructive"
      });
    } finally {
      setIsDeletingExpenses(false);
    }
  };

  // Função para gerar PDF das despesas do evento com separação por categoria
  const generateExpensesPDF = async (eventToUse?: any) => {
    const targetEvent = eventToUse || selectedEvent;
    
    if (!targetEvent) {
      toast({
        title: "Nenhum evento selecionado",
        description: "Selecione um evento para gerar o PDF.",
        variant: "destructive"
      });
      return;
    }

    // Buscar despesas diretamente do banco de dados
    const { data: eventExpenses, error } = await supabase
      .from('event_expenses')
      .select('*')
      .eq('event_id', targetEvent.id)
      .order('expense_date', { ascending: false });

    if (error) {
      console.error('Error fetching expenses for PDF:', error);
      toast({
        title: "Erro ao buscar despesas",
        description: "Não foi possível carregar as despesas.",
        variant: "destructive"
      });
      return;
    }

    if (!eventExpenses || eventExpenses.length === 0) {
      toast({
        title: "Nenhuma despesa",
        description: "Não há despesas para gerar o PDF.",
        variant: "destructive"
      });
      return;
    }

    // Usar as despesas buscadas diretamente
    const expensesToUse = eventExpenses;

    const doc = new jsPDF({ compress: true });
    let yPosition = 10;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Cores do tema
    const primaryColor: [number, number, number] = [41, 128, 185]; // Azul
    const successColor: [number, number, number] = [39, 174, 96]; // Verde
    const dangerColor: [number, number, number] = [231, 76, 60]; // Vermelho
    const warningColor: [number, number, number] = [243, 156, 18]; // Laranja
    const purpleColor: [number, number, number] = [142, 68, 173]; // Roxo
    const categoryColors: [number, number, number][] = [
      [52, 152, 219], // Azul claro
      [46, 204, 113], // Verde
      [155, 89, 182], // Roxo
      [241, 196, 15], // Amarelo
      [230, 126, 34], // Laranja
      [231, 76, 60],  // Vermelho
      [26, 188, 156], // Turquesa
      [52, 73, 94],   // Cinza escuro
    ];

    // Função para carregar logo como base64
    const loadLogoAsBase64 = async (url: string): Promise<string | null> => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
        return null;
      }
    };

    // Header com fundo cinza claro
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Logo da empresa
    if (logoUrl) {
      const logoBase64 = await loadLogoAsBase64(logoUrl);
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, 'PNG', 14, 7, 30, 30);
        } catch (e) {
          console.error('Erro ao adicionar logo ao PDF:', e);
        }
      }
    }

    // Informações da empresa (texto escuro)
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.company_name || 'Empresa', 50, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (companySettings?.cnpj) {
      doc.text(`CNPJ: ${companySettings.cnpj}`, 50, 25);
    }
    if (companySettings?.phone || companySettings?.email) {
      const contact = [companySettings?.phone, companySettings?.email].filter(Boolean).join(' | ');
      doc.text(contact, 50, 32);
    }

    yPosition = 55;

    // Título do relatório
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('RELATÓRIO DE DESPESAS DO EVENTO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Informações do evento em cards coloridos
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, yPosition, pageWidth - 28, 28, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Evento:', 20, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(targetEvent.name, 42, yPosition + 8);

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 20, yPosition + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(targetEvent.client_name || 'Não informado', 42, yPosition + 16);

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Data:', 110, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(targetEvent.event_date ? format(new Date(targetEvent.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informada', 125, yPosition + 8);

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Local:', 110, yPosition + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(targetEvent.location || 'Não informado', 125, yPosition + 16);

    yPosition += 38;

    // Agrupar despesas por categoria
    const expensesByCategory: { [key: string]: EventExpense[] } = {};
    expensesToUse.forEach(expense => {
      const category = expense.category || 'Sem Categoria';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = [];
      }
      expensesByCategory[category].push(expense);
    });

    // Ordenar categorias
    const sortedCategories = Object.keys(expensesByCategory).sort();

    // Para cada categoria, criar uma tabela colorida
    sortedCategories.forEach((category, index) => {
      const categoryExpenses = expensesByCategory[category];
      const categoryTotal = categoryExpenses.reduce((acc, exp) => acc + (exp.total_price || 0), 0);
      const categoryColor = categoryColors[index % categoryColors.length];

      // Verificar se precisa de nova página
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Cabeçalho da categoria colorido
      doc.setFillColor(...categoryColor);
      doc.roundedRect(14, yPosition - 2, pageWidth - 28, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${category}`, 18, yPosition + 5);
      doc.text(`Total: R$ ${categoryTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth - 18, yPosition + 5, { align: 'right' });
      yPosition += 12;

      // Tabela da categoria
      const tableData = categoryExpenses.map(expense => [
        expense.expense_date ? format(new Date(expense.expense_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '-',
        expense.description || '-',
        expense.quantity?.toString() || '1',
        `R$ ${(expense.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${(expense.total_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        expense.supplier || '-',
        expense.expense_bank_account || '-'
      ]);

      autoTable(doc, {
        startY: yPosition,
        head: [['Data', 'Descrição', 'Qtd', 'Valor Unit.', 'Total', 'Fornecedor', 'Conta']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: [50, 50, 50],
          fontSize: 8,
          fontStyle: 'bold'
        },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [250, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 42 },
          2: { cellWidth: 12, halign: 'center' },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 22, halign: 'right' },
          5: { cellWidth: 30 },
          6: { cellWidth: 28 }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          yPosition = data.cursor?.y || yPosition;
        }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    });

    // Calcular valores financeiros
    const totalDespesas = expensesToUse.reduce((acc, exp) => acc + (exp.total_price || 0), 0);
    const orcamentoEvento = targetEvent.total_budget || 0;
    const lucroEvento = orcamentoEvento - totalDespesas;
    
    // Verificar se precisa de nova página para o resumo financeiro
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = 20;
    }

    // Linha separadora decorativa
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1);
    doc.line(14, yPosition, pageWidth - 14, yPosition);
    yPosition += 15;

    // Título do resumo financeiro
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('RESUMO FINANCEIRO DO EVENTO', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Cards de resumo financeiro
    const cardWidth = (pageWidth - 42) / 3;
    const cardHeight = 35;

    // Card 1 - Orçamento do Evento (Azul)
    doc.setFillColor(...primaryColor);
    doc.roundedRect(14, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ORÇAMENTO DO EVENTO', 14 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`R$ ${orcamentoEvento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14 + cardWidth / 2, yPosition + 25, { align: 'center' });

    // Card 2 - Total de Despesas (Vermelho)
    doc.setFillColor(...dangerColor);
    doc.roundedRect(14 + cardWidth + 7, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DE DESPESAS', 14 + cardWidth + 7 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14 + cardWidth + 7 + cardWidth / 2, yPosition + 25, { align: 'center' });

    // Card 3 - Lucro do Evento (Verde ou Vermelho dependendo do valor)
    const lucroColor = lucroEvento >= 0 ? successColor : dangerColor;
    doc.setFillColor(...lucroColor);
    doc.roundedRect(14 + (cardWidth + 7) * 2, yPosition, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(lucroEvento >= 0 ? 'LUCRO DO EVENTO' : 'PREJUÍZO DO EVENTO', 14 + (cardWidth + 7) * 2 + cardWidth / 2, yPosition + 10, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`R$ ${Math.abs(lucroEvento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14 + (cardWidth + 7) * 2 + cardWidth / 2, yPosition + 25, { align: 'center' });

    yPosition += cardHeight + 15;

    // Resumo por categoria com cores
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...purpleColor);
    doc.text('Resumo por Categoria:', 14, yPosition);
    yPosition += 8;

    sortedCategories.forEach((category, index) => {
      const categoryTotal = expensesByCategory[category].reduce((acc, exp) => acc + (exp.total_price || 0), 0);
      const percentage = totalDespesas > 0 ? ((categoryTotal / totalDespesas) * 100).toFixed(1) : '0';
      const categoryColor = categoryColors[index % categoryColors.length];
      
      // Bolinha colorida
      doc.setFillColor(...categoryColor);
      doc.circle(18, yPosition - 1.5, 2, 'F');
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(9);
      doc.text(`${category}: R$ ${categoryTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentage}%)`, 24, yPosition);
      yPosition += 6;
    });

    // Verificar se precisa de nova página para status de pagamento
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    yPosition += 10;

    // Linha separadora
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, yPosition, pageWidth - 14, yPosition);
    yPosition += 15;

    // Título do status de pagamento
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('STATUS DE PAGAMENTO DO EVENTO', 14, yPosition);
    yPosition += 12;

    // Informações de pagamento - Pagamento Principal
    const isPaid = targetEvent.is_paid;
    const paymentAmount = targetEvent.payment_amount || 0;
    const paymentDate = targetEvent.payment_date;
    const paymentBankAccount = targetEvent.payment_bank_account;

    // Card de status do pagamento principal
    const paymentCardWidth = (pageWidth - 35) / 2;
    const paymentCardHeight = 45;

    // Card Pagamento Principal
    const paymentStatusColor = isPaid ? successColor : warningColor;
    doc.setFillColor(...paymentStatusColor);
    doc.roundedRect(14, yPosition, paymentCardWidth, paymentCardHeight, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO PRINCIPAL', 14 + paymentCardWidth / 2, yPosition + 8, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Status: ${isPaid ? 'PAGO' : 'PENDENTE'}`, 14 + paymentCardWidth / 2, yPosition + 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Valor: R$ ${paymentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14 + paymentCardWidth / 2, yPosition + 27, { align: 'center' });
    
    if (paymentDate) {
      doc.text(`Data: ${format(new Date(paymentDate), 'dd/MM/yyyy', { locale: ptBR })}`, 14 + paymentCardWidth / 2, yPosition + 35, { align: 'center' });
    }
    if (paymentBankAccount) {
      doc.text(`Conta: ${paymentBankAccount}`, 14 + paymentCardWidth / 2, yPosition + 43, { align: 'center' });
    }

    // Card Pagamento Restante
    const isRemainingPaid = targetEvent.is_remaining_paid;
    const totalBudget = targetEvent.total_budget || 0;
    const storedRemaining = targetEvent.remaining_payment_amount || 0;
    // Se não houver valor restante armazenado, calcular a partir do orçamento total menos o pagamento principal
    const remainingAmount = storedRemaining > 0
      ? storedRemaining
      : Math.max(totalBudget - paymentAmount, 0);
    const remainingDate = targetEvent.remaining_payment_date;
    const remainingBankAccount = targetEvent.remaining_payment_bank_account;

    const remainingStatusColor = isRemainingPaid ? successColor : (remainingAmount > 0 ? warningColor : [150, 150, 150] as [number, number, number]);
    doc.setFillColor(...remainingStatusColor);
    doc.roundedRect(14 + paymentCardWidth + 7, yPosition, paymentCardWidth, paymentCardHeight, 3, 3, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGAMENTO RESTANTE', 14 + paymentCardWidth + 7 + paymentCardWidth / 2, yPosition + 8, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Status: ${remainingAmount > 0 ? (isRemainingPaid ? 'PAGO' : 'PENDENTE') : 'N/A'}`, 14 + paymentCardWidth + 7 + paymentCardWidth / 2, yPosition + 18, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Valor: R$ ${remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14 + paymentCardWidth + 7 + paymentCardWidth / 2, yPosition + 27, { align: 'center' });
    
    if (remainingDate) {
      doc.text(`Data: ${format(new Date(remainingDate), 'dd/MM/yyyy', { locale: ptBR })}`, 14 + paymentCardWidth + 7 + paymentCardWidth / 2, yPosition + 35, { align: 'center' });
    }
    if (remainingBankAccount) {
      doc.text(`Conta: ${remainingBankAccount}`, 14 + paymentCardWidth + 7 + paymentCardWidth / 2, yPosition + 43, { align: 'center' });
    }

    yPosition += paymentCardHeight + 15;

    // Resumo total de recebimentos
    const totalRecebido = (isPaid ? paymentAmount : 0) + (isRemainingPaid ? remainingAmount : 0);
    const totalPendente = (!isPaid ? paymentAmount : 0) + (!isRemainingPaid && remainingAmount > 0 ? remainingAmount : 0);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...successColor);
    doc.text(`Total Recebido: R$ ${totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, yPosition);
    
    doc.setTextColor(...warningColor);
    doc.text(`Total Pendente: R$ ${totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pageWidth / 2, yPosition);

    // Rodapé colorido
    doc.setFillColor(...primaryColor);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Relatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, pageHeight - 6, { align: 'center' });

    // Salvar PDF
    const eventName = targetEvent.name.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`despesas_evento_${eventName}.pdf`);

    toast({
      title: "PDF gerado com sucesso!",
      description: "O relatório de despesas foi baixado."
    });
  };

  const generateLodgingTeamPDF = async () => {
    if (!selectedEventForView || eventTeam.length === 0) {
      toast({ title: 'Equipe vazia', description: 'Adicione colaboradores ou diaristas antes de gerar o PDF.', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', compress: true });
    const pageWidth = doc.internal.pageSize.getWidth();
    const canViewDocuments = userRole === 'admin' || userRole === 'financeiro';

    let logoBase64: string | null = null;
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Logo indisponível para o PDF:', error);
      }
    }

    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, pageWidth, 34, 'F');
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, 4, 27, 27);
      } catch (error) {
        console.warn('Não foi possível adicionar a logo ao cabeçalho:', error);
      }
    }
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('LINE TAPE', pageWidth / 2, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const companyContact = [companySettings?.phone, companySettings?.email].filter(Boolean).join(' | ');
    if (companyContact) doc.text(companyContact, pageWidth / 2, 22, { align: 'center' });

    doc.setTextColor(41, 98, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('RELAÇÃO DA EQUIPE', pageWidth / 2, 46, { align: 'center' });

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text(`Evento: ${selectedEventForView.name}`, 14, 57);
    doc.setFont('helvetica', 'normal');
    const eventDate = selectedEventForView.event_date
      ? format(new Date(`${selectedEventForView.event_date}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })
      : 'Não informada';
    doc.text(`Data: ${eventDate}${selectedEventForView.event_time ? ` às ${selectedEventForView.event_time}` : ''}`, 14, 64);
    doc.text(`Local: ${selectedEventForView.location || 'Não informado'}`, 110, 64);

    const rows = eventTeam.map((member, index) => {
      const profile = member.profile as any;
      const phone = profile?.whatsapp || profile?.phone || 'Não informado';
      const birthDate = profile?.birth_date
        ? format(new Date(`${profile.birth_date}T12:00:00`), 'dd/MM/yyyy', { locale: ptBR })
        : 'Não informada';
      const city = [profile?.address_city, profile?.address_state].filter(Boolean).join('/') || 'Não informado';
      const registeredRole = member.person_type === 'worker'
        ? profile?.primary_role
        : profile?.role;
      const base = [
        String(index + 1),
        member.collaborator_name,
        member.person_type === 'worker' ? 'Diarista' : 'Colaborador',
        registeredRole || member.role || 'Não informada',
        birthDate,
        phone,
        city
      ];
      if (canViewDocuments) base.splice(4, 0, member.cpf || 'Não informado', member.rg || 'Não informado');
      return base;
    });

    const head = ['Nº', 'Nome completo', 'Tipo', 'Função'];
    if (canViewDocuments) head.push('CPF', 'RG');
    head.push('Nascimento', 'Telefone/WhatsApp', 'Cidade/UF');

    autoTable(doc, {
      startY: 71,
      head: [head],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      margin: { left: 14, right: 14 },
      willDrawPage: () => {
        if (!logoBase64) return;
        const anyDoc = doc as any;
        const pageHeight = doc.internal.pageSize.getHeight();
        try {
          if (anyDoc.GState) anyDoc.setGState(new anyDoc.GState({ opacity: 0.11 }));
          doc.addImage(logoBase64, 'PNG', 8, 8, pageWidth - 16, pageHeight - 16);
          if (anyDoc.GState) anyDoc.setGState(new anyDoc.GState({ opacity: 1 }));
        } catch (error) {
          console.warn('Não foi possível aplicar a marca d’água:', error);
        }
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, pageHeight - 7);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
      }
    });

    if (eventVehicles.length > 0) {
      const transportStartY = ((doc as any).lastAutoTable?.finalY || 71) + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(41, 98, 255);
      doc.text('TRANSPORTE', 14, transportStartY);
      autoTable(doc, {
        startY: transportStartY + 4,
        head: [['Carro', 'Placa', 'Motorista', 'Lugares', 'Observações']],
        body: eventVehicles.map(vehicle => [
          vehicle.vehicle_model,
          vehicle.vehicle_plate || 'Não informada',
          vehicle.driver_name || 'Não informado',
          vehicle.seats ? String(vehicle.seats) : 'Não informado',
          vehicle.notes || ''
        ]),
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
        headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        margin: { left: 14, right: 14 }
      });
    }

    const safeName = selectedEventForView.name.replace(/[^a-zA-Z0-9À-ÿ]+/g, '_');
    doc.save(`equipe_evento_${safeName}.pdf`);
    toast({ title: 'PDF gerado', description: 'A relação da equipe foi baixada.' });
  };

  const updateEventStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: status })
        .eq('id', id);

      if (error) throw error;

      setEvents(events.map(event =>
        event.id === id ? { ...event, status: status } : event
      ));
      toast({
        title: "Status do evento atualizado!",
        description: "O status do evento foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Error updating event status:', error);
      toast({
        title: "Erro ao atualizar status do evento",
        description: "Não foi possível atualizar o status do evento.",
        variant: "destructive"
      });
    } finally {
      setStatusDialog(false);
      setSelectedEventForStatus(null);
      setNewStatus('');
    }
  };


  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'confirmed':
        return 'Confirmado';
      case 'in_progress':
        return 'Em Andamento';
      case 'completed':
        return 'Concluído';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchBankAccounts();
    fetchClients();
    fetchCollaborators();
    fetchWorkers();

    // Setup realtime subscriptions for automatic updates
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
          fetchEvents();
        }
      )
      .subscribe();

    const expensesChannel = supabase
      .channel('expenses-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_expenses'
        },
        () => {
          if (selectedEvent) {
            fetchExpenses(selectedEvent.id);
          }
          fetchEvents(); // Refresh events to update total_expenses
        }
      )
      .subscribe();

    const bankAccountsChannel = supabase
      .channel('bank-accounts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bank_accounts'
        },
        () => {
          fetchBankAccounts();
        }
      )
      .subscribe();

    const collaboratorsChannel = supabase
      .channel('collaborators-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collaborators'
        },
        () => {
          fetchCollaborators();
        }
      )
      .subscribe();

    const workersChannel = supabase
      .channel('rental-workers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, fetchWorkers)
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(bankAccountsChannel);
      supabase.removeChannel(collaboratorsChannel);
      supabase.removeChannel(workersChannel);
    };
  }, []);

  // Fetch expenses when selectedEvent changes
  useEffect(() => {
    if (selectedEvent) {
      fetchExpenses(selectedEvent.id);
    }
  }, [selectedEvent]);

  useEffect(() => {
    setTeamPanelOpen(false);
    setEventTeam([]);
    setEventVehicles([]);
    setSelectedTeamPersonId('');
    setTeamRole('');
    setVehicleForm({ vehicle_model: '', vehicle_plate: '', driver_name: '', seats: '', notes: '' });
  }, [selectedEventForView?.id]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Carregando eventos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewRentals) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">Acesso Negado</h3>
            <p className="text-muted-foreground">Você não tem permissão para visualizar locações.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Locações</h2>
          <p className="text-muted-foreground">Gerencie eventos e locações</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEventDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Year Selection */}
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium">Ano:</Label>
          <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {generateYearsAndMonths().map(({ year }) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Tabs */}
        <Tabs value={selectedMonth.toISOString()} onValueChange={(value) => setSelectedMonth(new Date(value))}>
          <TabsList className="grid w-full grid-cols-12 gap-1">
            {generateYearsAndMonths()
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
          
          {generateYearsAndMonths()
            .find(({ year }) => year === selectedYear)
            ?.months.map((month) => (
              <TabsContent key={month.toISOString()} value={month.toISOString()}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">
                      {format(month, 'MMMM yyyy', { locale: ptBR })}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {filteredEvents.length} de {monthEvents.length} locação(ões)
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="rentals-search" className="sr-only">Buscar locações</Label>
                      <Input
                        id="rentals-search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por evento, cliente ou local..."
                        aria-label="Buscar locações por evento, cliente ou local"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filtrar por status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as typeof paymentFilter)}>
                      <SelectTrigger className="w-full sm:w-[170px]" aria-label="Filtrar por pagamento">
                        <SelectValue placeholder="Pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos pagamentos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="parcial">Parcial</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={`${sortKey}:${sortDirection}`}
                      onValueChange={(value) => {
                        const [key, dir] = value.split(':');
                        setSortKey(key as RentalSortKey);
                        setSortDirection(dir as 'asc' | 'desc');
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[190px]" aria-label="Ordenar locações">
                        <SelectValue placeholder="Ordenar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event_date:asc">Data (mais antiga)</SelectItem>
                        <SelectItem value="event_date:desc">Data (mais recente)</SelectItem>
                        <SelectItem value="name:asc">Evento (A-Z)</SelectItem>
                        <SelectItem value="client_name:asc">Cliente (A-Z)</SelectItem>
                        <SelectItem value="total_budget:desc">Maior valor</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                          setPaymentFilter('all');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-6">
                    {loading ? (
                      <div className="text-center py-8 text-muted-foreground" role="status" aria-live="polite">
                        Carregando locações...
                      </div>
                    ) : filteredEvents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        {hasActiveFilters
                          ? 'Nenhuma locação corresponde aos filtros aplicados.'
                          : 'Nenhum evento encontrado para este mês'}
                      </div>
                    ) : (
                      filteredEvents.map((event) => (
                        <Card key={event.id} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="flex items-center gap-2">
                                  <CalendarIcon className="h-5 w-5 text-primary" />
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
                                     <CalendarIcon className="h-4 w-4" />
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
                                <Badge className={
                                  !event.is_paid ? "bg-red-100 text-red-800" :
                                  event.payment_type === 'entrada' && !event.is_remaining_paid ? "bg-yellow-100 text-yellow-800" :
                                  "bg-green-100 text-green-800"
                                }>
                                  {getPaymentStatusText(event)}
                                </Badge>
                                 {canEditRentals && (
                                   <>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => {
                                         setSelectedEventForView(event);
                                       }}
                                     >
                                       <Eye className="h-4 w-4" />
                                     </Button>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => {
                                         setSelectedEventForEdit(event);
                                         setEditEventDialog(true);
                                       }}
                                     >
                                       <Edit className="h-4 w-4" />
                                     </Button>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => deleteEvent(event.id)}
                                       className="text-red-600 hover:text-red-800"
                                     >
                                       <Trash2 className="h-4 w-4" />
                                     </Button>
                                     <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedEvent(event)}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Despesas
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedEventForBudget(event);
                                        setBudgetDialog(true);
                                        fetchBudgets(event.id);
                                      }}
                                    >
                                      <Calculator className="h-4 w-4 mr-1" />
                                      Orçamento
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          
                          {canViewFinancials && (
                            <CardContent>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-green-600" />
                                  <div>
                                    <p className="text-sm font-medium">Orçamento</p>
                                    <p className="text-lg font-bold text-green-600">
                                      R$ {event.total_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-red-600" />
                                  <div>
                                    <p className="text-sm font-medium">Despesas</p>
                                    <p className="text-lg font-bold text-red-600">
                                      R$ {event.total_expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calculator className="h-4 w-4 text-blue-600" />
                                  <div>
                                    <p className="text-sm font-medium">Lucro</p>
                                    <p className={`text-lg font-bold ${event.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      R$ {event.profit_margin.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                </div>
                               </div>
                            </CardContent>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>
            ))}
        </Tabs>
      </div>

      {/* Dialog para Criar Novo Evento */}
      <Dialog open={eventDialog} onOpenChange={setEventDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Evento</DialogTitle>
            <DialogDescription>
              Preencha os dados do evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Evento *</Label>
                <Input
                  id="name"
                  value={newEvent.name || ''}
                  onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                  placeholder="Nome do evento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_name">Cliente *</Label>
                <div className="space-y-2">
                  <Input
                    id="client_name"
                    list="clients-list"
                    value={newEvent.client_name || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const selectedClient = clients.find(client => client.name === value);
                      if (selectedClient) {
                        setNewEvent({
                          ...newEvent,
                          client_name: selectedClient.name,
                          client_email: selectedClient.email || '',
                          client_phone: selectedClient.phone || ''
                        });
                      } else {
                        setNewEvent({
                          ...newEvent,
                          client_name: value,
                          client_email: '',
                          client_phone: ''
                        });
                      }
                    }}
                    placeholder="Digite ou selecione um cliente"
                  />
                  <datalist id="clients-list">
                    {clients.map((client) => (
                      <option key={client.id} value={client.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_email">Email do Cliente</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={newEvent.client_email || ''}
                  onChange={(e) => setNewEvent({...newEvent, client_email: e.target.value})}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client_phone">Telefone do Cliente</Label>
                <Input
                  id="client_phone"
                  value={newEvent.client_phone || ''}
                  onChange={(e) => setNewEvent({...newEvent, client_phone: e.target.value})}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Data do Evento *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={newEvent.event_date || ''}
                  onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_time">Horário do Evento</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={newEvent.event_time || ''}
                  onChange={(e) => setNewEvent({...newEvent, event_time: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="setup_start_date">Data de Montagem</Label>
              <Input
                id="setup_start_date"
                type="date"
                value={newEvent.setup_start_date || ''}
                onChange={(e) => setNewEvent({...newEvent, setup_start_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Local do Evento</Label>
              <Input
                id="location"
                value={newEvent.location || ''}
                onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                placeholder="Endereço do evento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_budget">Orçamento Total</Label>
              <CurrencyInput
                id="total_budget"
                value={newEvent.total_budget || 0}
                onChange={(value) => setNewEvent({...newEvent, total_budget: value})}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={newEvent.description || ''}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                placeholder="Detalhes do evento..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEventDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createEvent(newEvent)}>
              Criar Evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Evento */}
      <Dialog open={editEventDialog} onOpenChange={setEditEventDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>
              Modifique os dados do evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_name">Nome do Evento *</Label>
                <Input
                  id="edit_name"
                  value={selectedEventForEdit?.name || ''}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Nome do evento"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_client_name">Cliente *</Label>
                <div className="space-y-2">
                  <Input
                    id="edit_client_name"
                    list="edit-clients-list"
                    value={selectedEventForEdit?.client_name || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      const selectedClient = clients.find(client => client.name === value);
                      if (selectedClient && selectedEventForEdit) {
                        setSelectedEventForEdit({
                          ...selectedEventForEdit,
                          client_name: selectedClient.name,
                          client_email: selectedClient.email || '',
                          client_phone: selectedClient.phone || ''
                        });
                      } else if (selectedEventForEdit) {
                        setSelectedEventForEdit({
                          ...selectedEventForEdit,
                          client_name: value
                        });
                      }
                    }}
                    placeholder="Digite ou selecione um cliente"
                  />
                  <datalist id="edit-clients-list">
                    {clients.map((client) => (
                      <option key={client.id} value={client.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_client_email">Email do Cliente</Label>
                <Input
                  id="edit_client_email"
                  type="email"
                  value={selectedEventForEdit?.client_email || ''}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, client_email: e.target.value} : null)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_client_phone">Telefone do Cliente</Label>
                <Input
                  id="edit_client_phone"
                  value={selectedEventForEdit?.client_phone || ''}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, client_phone: e.target.value} : null)}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_event_date">Data do Evento *</Label>
                <Input
                  id="edit_event_date"
                  type="date"
                  value={selectedEventForEdit?.event_date || ''}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, event_date: e.target.value} : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_event_time">Horário do Evento</Label>
                <Input
                  id="edit_event_time"
                  type="time"
                  value={selectedEventForEdit?.event_time || ''}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, event_time: e.target.value} : null)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_setup_start_date">Data de Montagem</Label>
              <Input
                id="edit_setup_start_date"
                type="date"
                value={selectedEventForEdit?.setup_start_date || ''}
                onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, setup_start_date: e.target.value} : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_location">Local do Evento</Label>
              <Input
                id="edit_location"
                value={selectedEventForEdit?.location || ''}
                onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, location: e.target.value} : null)}
                placeholder="Endereço do evento"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_total_budget">Orçamento Total</Label>
              <CurrencyInput
                id="edit_total_budget"
                value={selectedEventForEdit?.total_budget || 0}
                onChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, total_budget: value} : null)}
                placeholder="R$ 0,00"
              />
            </div>

            {/* Seção de Pagamento */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_paid"
                  checked={selectedEventForEdit?.is_paid || false}
                  onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, is_paid: e.target.checked} : null)}
                  className="rounded"
                />
                <Label htmlFor="edit_is_paid" className="font-medium">Marcar como Pago</Label>
              </div>

              {selectedEventForEdit?.is_paid && (
                <div className="grid gap-4 pl-6 border-l-2 border-green-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_payment_type">Tipo de Pagamento</Label>
                      <Select
                        value={selectedEventForEdit?.payment_type || 'total'}
                        onValueChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, payment_type: value} : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total">Valor Total</SelectItem>
                          <SelectItem value="entrada">Entrada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_payment_amount">{selectedEventForEdit?.payment_type === 'entrada' ? 'Valor da Entrada' : 'Valor Pago'}</Label>
                      <CurrencyInput
                        id="edit_payment_amount"
                        value={selectedEventForEdit?.payment_amount || 0}
                        onChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, payment_amount: value} : null)}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit_payment_bank_account">Conta de Recebimento</Label>
                      <Select
                        value={selectedEventForEdit?.payment_bank_account || ''}
                        onValueChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, payment_bank_account: value} : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.name}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit_payment_date">Data do Pagamento</Label>
                      <Input
                        id="edit_payment_date"
                        type="date"
                        value={selectedEventForEdit?.payment_date || ''}
                        onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, payment_date: e.target.value} : null)}
                      />
                    </div>
                  </div>

                  {/* Campos de pagamento do restante quando tipo for "entrada" */}
                  {selectedEventForEdit?.payment_type === 'entrada' && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit_is_remaining_paid"
                          checked={selectedEventForEdit?.is_remaining_paid || false}
                          onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, is_remaining_paid: e.target.checked} : null)}
                          className="rounded"
                        />
                        <Label htmlFor="edit_is_remaining_paid" className="font-medium">Marcar Restante como Pago</Label>
                      </div>

                      {selectedEventForEdit?.is_remaining_paid && (
                        <div className="grid gap-4 pl-6 border-l-2 border-blue-200">
                          <div className="space-y-2">
                            <Label htmlFor="edit_remaining_payment_amount">Valor Restante</Label>
                            <CurrencyInput
                              id="edit_remaining_payment_amount"
                              value={selectedEventForEdit?.remaining_payment_amount || 0}
                              onChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, remaining_payment_amount: value} : null)}
                              placeholder="R$ 0,00"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit_remaining_payment_bank_account">Conta de Recebimento do Restante</Label>
                              <Select
                                value={selectedEventForEdit?.remaining_payment_bank_account || ''}
                                onValueChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, remaining_payment_bank_account: value} : null)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a conta" />
                                </SelectTrigger>
                                <SelectContent>
                                  {bankAccounts.map((account) => (
                                    <SelectItem key={account.id} value={account.name}>
                                      {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit_remaining_payment_date">Data do Pagamento do Restante</Label>
                              <Input
                                id="edit_remaining_payment_date"
                                type="date"
                                value={selectedEventForEdit?.remaining_payment_date || ''}
                                onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, remaining_payment_date: e.target.value} : null)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Descrição</Label>
              <Textarea
                id="edit_description"
                value={selectedEventForEdit?.description || ''}
                onChange={(e) => setSelectedEventForEdit(prev => prev ? {...prev, description: e.target.value} : null)}
                placeholder="Detalhes do evento..."
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_status">Status do Evento</Label>
              <Select
                value={selectedEventForEdit?.status || 'pending'}
                onValueChange={(value) => setSelectedEventForEdit(prev => prev ? {...prev, status: value} : null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditEventDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => selectedEventForEdit && updateEvent(selectedEventForEdit.id, selectedEventForEdit)}>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação para ações críticas de status (concluir/cancelar) */}
      <AlertDialog open={!!pendingStatusChange} onOpenChange={(open) => { if (!open) setPendingStatusChange(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatusChange?.status === 'cancelled' ? 'Cancelar locação?' : 'Concluir locação?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusChange && (
                <>
                  {pendingStatusChange.event.name} — {pendingStatusChange.event.client_name}.
                  {' '}Esta ação é definitiva: após {rentalStatusLabel(pendingStatusChange.status).toLowerCase()},
                  {' '}o status não poderá mais ser alterado.
                  {pendingStatusChange.status === 'completed' &&
                    ' Os equipamentos alocados serão marcados como devolvidos.'}
                  {computePaymentSummary(pendingStatusChange.event).remaining > 0 &&
                    ` Atenção: ainda há ${formatCurrency(computePaymentSummary(pendingStatusChange.event).remaining)} em aberto.`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const pending = pendingStatusChange;
                setPendingStatusChange(null);
                if (pending) {
                  updateEvent(pending.event.id, { ...pending.event, status: pending.status }, { skipStatusConfirm: true });
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para Visualizar Detalhes do Evento */}
      {selectedEventForView && (
        <Dialog open={!!selectedEventForView} onOpenChange={() => setSelectedEventForView(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="flex flex-row items-start justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  Detalhes do Evento: {selectedEventForView.name}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Visualização completa dos detalhes do evento
                </DialogDescription>
              </div>
              <div className="ml-4 flex flex-wrap justify-end gap-2 pr-8">
                <Button
                  variant="outline"
                  onClick={() => {
                    const nextOpen = !teamPanelOpen;
                    setTeamPanelOpen(nextOpen);
                    if (nextOpen) {
                      fetchEventTeam(selectedEventForView.id);
                      fetchEventVehicles(selectedEventForView.id);
                    }
                  }}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Equipe / Hospedagem
                </Button>
                <Button
                  variant="outline"
                  onClick={() => generateExpensesPDF(selectedEventForView)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF Despesas
                </Button>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* INFORMAÇÕES DO EVENTO */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">INFORMAÇÕES DO EVENTO</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Nome:</p>
                      <p className="text-sm text-muted-foreground">{selectedEventForView.name}</p>
                    </div>
                  </div>
                  <div>
                    <Badge 
                      variant={selectedEventForView.status === 'completed' ? 'default' : 
                              selectedEventForView.status === 'cancelled' ? 'destructive' : 'secondary'}
                      className={selectedEventForView.status === 'completed' ? 'bg-red-100 text-red-800 hover:bg-red-100' : ''}
                    >
                      {getStatusText(selectedEventForView.status)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* CLIENTE */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">CLIENTE</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Nome:</p>
                      <p className="text-sm text-muted-foreground">{selectedEventForView.client_name}</p>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">Email:</p>
                    <p className="text-sm text-muted-foreground">{selectedEventForView.client_email || 'Não informado'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Telefone:</p>
                    <p className="text-sm text-muted-foreground">{selectedEventForView.client_phone || 'Não informado'}</p>
                  </div>
                </div>
              </div>

              {/* DATAS E LOCAL */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">DATAS E LOCAL</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Montagem:</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEventForView.setup_start_date ? format(new Date(selectedEventForView.setup_start_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : 'Não informado'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Evento:</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(selectedEventForView.event_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                        {selectedEventForView.event_time && ` às ${selectedEventForView.event_time}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <div>
                      <p className="font-medium">Local:</p>
                      <p className="text-sm text-muted-foreground">{selectedEventForView.location || 'Não informado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {teamPanelOpen && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Users className="h-5 w-5" />
                        Equipe do evento
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Monte a relação de colaboradores e diaristas para enviar à hospedagem.
                      </p>
                    </div>
                    <Button onClick={generateLodgingTeamPDF} disabled={loadingTeam || eventTeam.length === 0}>
                      <Download className="mr-2 h-4 w-4" />
                      PDF para hospedagem
                    </Button>
                  </div>

                  {canEditRentals && (
                    <div className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-[160px_1fr_1fr_auto] md:items-end">
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select
                          value={teamPersonType}
                          onValueChange={(value: 'collaborator' | 'worker') => {
                            setTeamPersonType(value);
                            setSelectedTeamPersonId('');
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="collaborator">Colaborador</SelectItem>
                            <SelectItem value="worker">Diarista</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pessoa</Label>
                        <Select value={selectedTeamPersonId} onValueChange={setSelectedTeamPersonId}>
                          <SelectTrigger><SelectValue placeholder="Selecione uma pessoa" /></SelectTrigger>
                          <SelectContent>
                            {(teamPersonType === 'worker' ? workers : collaborators).map(person => (
                              <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Função no evento</Label>
                        <Input value={teamRole} onChange={event => setTeamRole(event.target.value)} placeholder="Ex.: iluminador, motorista" />
                      </div>
                      <Button onClick={addEventTeamMember} disabled={!selectedTeamPersonId}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  )}

                  {loadingTeam ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">Carregando equipe...</p>
                  ) : eventTeam.length === 0 ? (
                    <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Nenhuma pessoa adicionada à equipe deste evento.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Função</TableHead>
                            <TableHead>Telefone</TableHead>
                            {canEditRentals && <TableHead className="w-16 text-right">Ações</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {eventTeam.map(member => {
                            const profile = member.profile as any;
                            return (
                              <TableRow key={member.id}>
                                <TableCell className="font-medium">{member.collaborator_name}</TableCell>
                                <TableCell>{member.person_type === 'worker' ? 'Diarista' : 'Colaborador'}</TableCell>
                                <TableCell>{member.role || 'Equipe'}</TableCell>
                                <TableCell>{profile?.whatsapp || profile?.phone || 'Não informado'}</TableCell>
                                {canEditRentals && (
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => removeEventTeamMember(member.id)} aria-label={`Remover ${member.collaborator_name}`}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold">
                        <Car className="h-5 w-5" />
                        Transporte
                      </h3>
                      <p className="text-sm text-muted-foreground">Adicione os carros usados pela equipe neste evento.</p>
                    </div>

                    {canEditRentals && (
                      <div className="grid gap-3 rounded-md bg-muted/30 p-3 md:grid-cols-2 lg:grid-cols-5 lg:items-end">
                        <div className="space-y-1.5">
                          <Label>Carro / Modelo *</Label>
                          <Input value={vehicleForm.vehicle_model} onChange={event => setVehicleForm(current => ({ ...current, vehicle_model: event.target.value }))} placeholder="Ex.: Van Sprinter" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Placa</Label>
                          <Input value={vehicleForm.vehicle_plate} onChange={event => setVehicleForm(current => ({ ...current, vehicle_plate: event.target.value }))} placeholder="ABC1D23" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Motorista</Label>
                          <Input value={vehicleForm.driver_name} onChange={event => setVehicleForm(current => ({ ...current, driver_name: event.target.value }))} placeholder="Nome do motorista" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Lugares</Label>
                          <Input type="number" min="1" value={vehicleForm.seats} onChange={event => setVehicleForm(current => ({ ...current, seats: event.target.value }))} placeholder="5" />
                        </div>
                        <Button onClick={addEventVehicle} disabled={!vehicleForm.vehicle_model.trim()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar carro
                        </Button>
                        <div className="space-y-1.5 md:col-span-2 lg:col-span-5">
                          <Label>Observações</Label>
                          <Input value={vehicleForm.notes} onChange={event => setVehicleForm(current => ({ ...current, notes: event.target.value }))} placeholder="Ex.: levar equipe ao hotel após o evento" />
                        </div>
                      </div>
                    )}

                    {eventVehicles.length === 0 ? (
                      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Nenhum carro adicionado.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Carro</TableHead>
                              <TableHead>Placa</TableHead>
                              <TableHead>Motorista</TableHead>
                              <TableHead>Lugares</TableHead>
                              <TableHead>Observações</TableHead>
                              {canEditRentals && <TableHead className="w-16 text-right">Ações</TableHead>}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventVehicles.map(vehicle => (
                              <TableRow key={vehicle.id}>
                                <TableCell className="font-medium">{vehicle.vehicle_model}</TableCell>
                                <TableCell>{vehicle.vehicle_plate || 'Não informada'}</TableCell>
                                <TableCell>{vehicle.driver_name || 'Não informado'}</TableCell>
                                <TableCell>{vehicle.seats || 'Não informado'}</TableCell>
                                <TableCell>{vehicle.notes || '-'}</TableCell>
                                {canEditRentals && (
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => removeEventVehicle(vehicle.id)} aria-label={`Remover ${vehicle.vehicle_model}`}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* INFORMAÇÕES FINANCEIRAS */}
              {canViewFinancials && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">INFORMAÇÕES FINANCEIRAS</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {/* Orçamento */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        <p className="font-medium text-green-800">Orçamento</p>
                      </div>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {selectedEventForView.total_budget.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Despesas */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-5 w-5 text-red-600" />
                        <p className="font-medium text-red-800">Despesas</p>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        R$ {selectedEventForView.total_expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>

                    {/* Lucro */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calculator className="h-5 w-5 text-green-600" />
                        <p className="font-medium text-green-800">Lucro</p>
                      </div>
                      <p className={`text-2xl font-bold ${selectedEventForView.profit_margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {selectedEventForView.profit_margin.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* ORÇAMENTOS */}
                  {(() => {
                    const eventBudgetItems = eventBudgets[selectedEventForView.id];
                    return eventBudgetItems && eventBudgetItems.length > 0;
                  })() && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ORÇAMENTOS</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {eventBudgets[selectedEventForView.id].map((budget) => (
                          <div key={budget.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                            {budget.image_url && !budget.image_url.startsWith('data:') ? (
                              <img
                                src={budget.image_url}
                                alt={budget.item}
                                className="w-12 h-12 object-cover rounded-md flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center flex-shrink-0">
                                <Calculator className="h-4 w-4 text-gray-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{budget.item}</p>
                              {budget.description && (
                                <p className="text-xs text-muted-foreground">{budget.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {budget.quantity}x • R$ {budget.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                R$ {budget.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEventForBudget(selectedEventForView);
                            setBudgetDialog(true);
                            fetchBudgets(selectedEventForView.id);
                            setSelectedEventForView(null);
                          }}
                        >
                          Gerenciar Orçamentos
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAGAMENTO */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">PAGAMENTO</h3>
                <div>
                  <p className="font-medium mb-2">Status:</p>
                  <Badge 
                    className={
                      !selectedEventForView.is_paid ? "bg-red-100 text-red-800 hover:bg-red-100" :
                      selectedEventForView.payment_type === 'entrada' && !selectedEventForView.is_remaining_paid ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" :
                      "bg-green-100 text-green-800 hover:bg-green-100"
                    }
                  >
                    {getPaymentStatusText(selectedEventForView)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setSelectedEventForView(null)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para Gerenciar Despesas */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Despesas do Evento: {selectedEvent.name}</DialogTitle>
              <DialogDescription>
                Gerencie as despesas deste evento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Lista de Despesas</h3>
                <div className="flex gap-2">
                  <Button onClick={() => setExpenseDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Despesa
                  </Button>
                </div>
              </div>

              {expenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma despesa cadastrada para este evento
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={expensesBulkSelection.isAllSelected}
                            onCheckedChange={expensesBulkSelection.toggleSelectAll}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Conta</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                          <TableCell>
                            <Checkbox
                              checked={expensesBulkSelection.isSelected(expense.id)}
                              onCheckedChange={() => expensesBulkSelection.toggleSelection(expense.id)}
                              aria-label={`Selecionar ${expense.description}`}
                            />
                          </TableCell>
                          <TableCell>{expense.description}</TableCell>
                          <TableCell>{expense.category}</TableCell>
                          <TableCell>{expense.quantity}</TableCell>
                          <TableCell>R$ {expense.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>R$ {expense.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{expense.supplier}</TableCell>
                          <TableCell>{expense.expense_bank_account || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedExpenseForEdit(expense);
                                  setEditExpenseDialog(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteExpense(expense.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <BulkActionsBar
                    selectedCount={expensesBulkSelection.selectedCount}
                    onDelete={handleBulkDeleteExpenses}
                    onCancel={expensesBulkSelection.clearSelection}
                    isDeleting={isDeletingExpenses}
                  />
                </>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-lg font-semibold">
                  Total das Despesas: R$ {expenses.reduce((acc, exp) => acc + exp.total_price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <Button variant="outline" onClick={() => {
                  setSelectedEvent(null);
                  expensesBulkSelection.clearSelection();
                }}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para Criar Nova Despesa */}
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
            <DialogDescription>
              Adicione uma nova despesa ao evento
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_description">Descrição *</Label>
                <Input
                  id="expense_description"
                  value={newExpense.description || ''}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  placeholder="Descrição da despesa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_category">Categoria *</Label>
                <Select
                  value={newExpense.category || ''}
                  onValueChange={(value) => setNewExpense({...newExpense, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Iluminação">Iluminação</SelectItem>
                    <SelectItem value="Som">Som</SelectItem>
                    <SelectItem value="Cenografia">Cenografia</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Alimentação">Alimentação</SelectItem>
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Colaborador">Colaborador</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campo para selecionar colaborador quando categoria é "Colaborador" */}
            {newExpense.category === 'Colaborador' && (
              <div className="space-y-2">
                <Label htmlFor="expense_collaborator">Colaborador</Label>
                <Select
                  value={newExpense.supplier || ''}
                  onValueChange={(value) => {
                    const selectedCollaborator = collaborators.find(c => c.name === value);
                    if (selectedCollaborator) {
                      setNewExpense({
                        ...newExpense, 
                        supplier: selectedCollaborator.name,
                        description: `Pagamento - ${selectedCollaborator.name}`
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators.map((collaborator) => (
                      <SelectItem key={collaborator.id} value={collaborator.name}>
                        {collaborator.name} - {collaborator.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_quantity">Quantidade</Label>
                <Input
                  id="expense_quantity"
                  type="number"
                  min="1"
                  value={newExpense.quantity || 1}
                  onChange={(e) => {
                    const quantity = parseInt(e.target.value) || 1;
                    const unit_price = newExpense.unit_price || 0;
                    setNewExpense({
                      ...newExpense, 
                      quantity,
                      total_price: quantity * unit_price
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_unit_price">Valor Unitário</Label>
                <CurrencyInput
                  id="expense_unit_price"
                  value={newExpense.unit_price || 0}
                  onChange={(value) => {
                    const unit_price = value;
                    const quantity = newExpense.quantity || 1;
                    setNewExpense({
                      ...newExpense, 
                      unit_price,
                      total_price: quantity * unit_price
                    });
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_total_price">Valor Total</Label>
                <CurrencyInput
                  id="expense_total_price"
                  value={newExpense.total_price || 0}
                  onChange={(value) => setNewExpense({...newExpense, total_price: value})}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expense_supplier">Fornecedor</Label>
                <Input
                  id="expense_supplier"
                  value={newExpense.supplier || ''}
                  onChange={(e) => setNewExpense({...newExpense, supplier: e.target.value})}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expense_bank_account">Conta de Débito</Label>
                <Select
                  value={newExpense.expense_bank_account || ''}
                  onValueChange={(value) => setNewExpense({...newExpense, expense_bank_account: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.name}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_date">Data da Despesa</Label>
              <Input
                id="expense_date"
                type="date"
                value={newExpense.expense_date || ''}
                onChange={(e) => setNewExpense({...newExpense, expense_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_notes">Observações</Label>
              <Textarea
                id="expense_notes"
                value={newExpense.notes || ''}
                onChange={(e) => setNewExpense({...newExpense, notes: e.target.value})}
                placeholder="Observações adicionais..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense_receipt">Comprovante de Pagamento</Label>
              <Input
                id="expense_receipt"
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Aqui você pode implementar o upload do arquivo
                    // Por ora, apenas armazenamos o nome do arquivo
                    setNewExpense({...newExpense, receipt_url: file.name});
                  }
                }}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, PDF (máx. 10MB)
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createExpense(newExpense)}>
              Criar Despesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Despesa */}
      <Dialog open={editExpenseDialog} onOpenChange={setEditExpenseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Despesa</DialogTitle>
            <DialogDescription>
              Modifique os dados da despesa
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_expense_description">Descrição *</Label>
                <Input
                  id="edit_expense_description"
                  value={selectedExpenseForEdit?.description || ''}
                  onChange={(e) => setSelectedExpenseForEdit(prev => prev ? {...prev, description: e.target.value} : null)}
                  placeholder="Descrição da despesa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expense_category">Categoria *</Label>
                <Select
                  value={selectedExpenseForEdit?.category || ''}
                  onValueChange={(value) => setSelectedExpenseForEdit(prev => prev ? {...prev, category: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Iluminação">Iluminação</SelectItem>
                    <SelectItem value="Som">Som</SelectItem>
                    <SelectItem value="Cenografia">Cenografia</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Alimentação">Alimentação</SelectItem>
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Colaborador">Colaborador</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Campo para selecionar colaborador quando categoria é "Colaborador" */}
            {selectedExpenseForEdit?.category === 'Colaborador' && (
              <div className="space-y-2">
                <Label htmlFor="edit_expense_collaborator">Colaborador</Label>
                <Select
                  value={selectedExpenseForEdit?.supplier || ''}
                  onValueChange={(value) => {
                    const selectedCollaborator = collaborators.find(c => c.name === value);
                    if (selectedCollaborator && selectedExpenseForEdit) {
                      setSelectedExpenseForEdit({
                        ...selectedExpenseForEdit, 
                        supplier: selectedCollaborator.name,
                        description: `Pagamento - ${selectedCollaborator.name}`
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {collaborators.map((collaborator) => (
                      <SelectItem key={collaborator.id} value={collaborator.name}>
                        {collaborator.name} - {collaborator.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_expense_quantity">Quantidade</Label>
                <Input
                  id="edit_expense_quantity"
                  type="number"
                  min="1"
                  value={selectedExpenseForEdit?.quantity || 1}
                  onChange={(e) => {
                    const quantity = parseInt(e.target.value) || 1;
                    const unit_price = selectedExpenseForEdit?.unit_price || 0;
                    setSelectedExpenseForEdit(prev => prev ? {
                      ...prev, 
                      quantity,
                      total_price: quantity * unit_price
                    } : null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expense_unit_price">Valor Unitário</Label>
                <CurrencyInput
                  id="edit_expense_unit_price"
                  value={selectedExpenseForEdit?.unit_price || 0}
                  onChange={(value) => {
                    const unit_price = value;
                    const quantity = selectedExpenseForEdit?.quantity || 1;
                    setSelectedExpenseForEdit(prev => prev ? {
                      ...prev, 
                      unit_price,
                      total_price: quantity * unit_price
                    } : null);
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expense_total_price">Valor Total</Label>
                <CurrencyInput
                  id="edit_expense_total_price"
                  value={selectedExpenseForEdit?.total_price || 0}
                  onChange={(value) => setSelectedExpenseForEdit(prev => prev ? {...prev, total_price: value} : null)}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_expense_supplier">Fornecedor</Label>
                <Input
                  id="edit_expense_supplier"
                  value={selectedExpenseForEdit?.supplier || ''}
                  onChange={(e) => setSelectedExpenseForEdit(prev => prev ? {...prev, supplier: e.target.value} : null)}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expense_bank_account">Conta de Débito</Label>
                <Select
                  value={selectedExpenseForEdit?.expense_bank_account || ''}
                  onValueChange={(value) => setSelectedExpenseForEdit(prev => prev ? {...prev, expense_bank_account: value} : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.name}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_expense_date">Data da Despesa</Label>
              <Input
                id="edit_expense_date"
                type="date"
                value={selectedExpenseForEdit?.expense_date || ''}
                onChange={(e) => setSelectedExpenseForEdit(prev => prev ? {...prev, expense_date: e.target.value} : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_expense_notes">Observações</Label>
              <Textarea
                id="edit_expense_notes"
                value={selectedExpenseForEdit?.notes || ''}
                onChange={(e) => setSelectedExpenseForEdit(prev => prev ? {...prev, notes: e.target.value} : null)}
                placeholder="Observações adicionais..."
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_expense_receipt">Comprovante de Pagamento</Label>
              <div className="flex gap-2">
                <Input
                  id="edit_expense_receipt"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedExpenseForEdit(prev => prev ? {...prev, receipt_url: file.name} : null);
                    }
                  }}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {selectedExpenseForEdit?.receipt_url && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Aqui você pode implementar a visualização do comprovante
                      alert(`Visualizar comprovante: ${selectedExpenseForEdit.receipt_url}`);
                    }}
                  >
                    Ver Comprovante
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, PDF (máx. 10MB)
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditExpenseDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => selectedExpenseForEdit && updateExpense(selectedExpenseForEdit.id, selectedExpenseForEdit)}>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Gerenciar Orçamentos */}
      {selectedEventForBudget && (
        <Dialog open={budgetDialog} onOpenChange={() => {
          setBudgetDialog(false);
          setSelectedEventForBudget(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Orçamento do Evento: {selectedEventForBudget.name}</DialogTitle>
              <DialogDescription>
                Gerencie os itens do orçamento deste evento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Lista de Itens</h3>
                <div className="space-y-4 border p-4 rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="budget_item">Item</Label>
                      <Input
                        id="budget_item"
                        value={newBudget.item}
                        onChange={(e) => setNewBudget({...newBudget, item: e.target.value})}
                        placeholder="Nome do item"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget_description">Descrição</Label>
                      <Input
                        id="budget_description"
                        value={newBudget.description}
                        onChange={(e) => setNewBudget({...newBudget, description: e.target.value})}
                        placeholder="Descrição do item"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="budget_quantity">Quantidade</Label>
                      <Input
                        id="budget_quantity"
                        type="number"
                        min="1"
                        value={newBudget.quantity}
                        onChange={(e) => {
                          const quantity = parseInt(e.target.value) || 1;
                          const unit_price = newBudget.unit_price;
                          setNewBudget({
                            ...newBudget, 
                            quantity,
                            total_price: quantity * unit_price
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget_unit_price">Valor Unit.</Label>
                      <CurrencyInput
                        id="budget_unit_price"
                        value={newBudget.unit_price}
                        onChange={(value) => {
                          const unit_price = value;
                          const quantity = newBudget.quantity;
                          setNewBudget({
                            ...newBudget, 
                            unit_price,
                            total_price: quantity * unit_price
                          });
                        }}
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget_total_price">Valor Total</Label>
                      <CurrencyInput
                        id="budget_total_price"
                        value={newBudget.total_price}
                        onChange={(value) => setNewBudget({...newBudget, total_price: value})}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>
                  
                  {/* Upload de Imagem */}
                  <div className="space-y-2">
                    <Label htmlFor="budget_image">Imagem do Item (Opcional)</Label>
                    <Input
                      id="budget_image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setNewBudget({...newBudget, image_file: file});
                      }}
                    />
                    {newBudget.image_file && (
                      <div className="text-sm text-muted-foreground">
                        Arquivo selecionado: {newBudget.image_file.name}
                      </div>
                    )}
                  </div>
                  
                  <Button onClick={() => createBudget(newBudget)} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Item
                  </Button>
                  
                  <div className="space-y-2">
                    <Label htmlFor="budget_import">Importar Orçamento</Label>
                    <Input
                      id="budget_import"
                      type="file"
                      accept=".json,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          importBudgetFromFile(file);
                          // Clear the input
                          e.target.value = '';
                        }
                      }}
                      disabled={importingBudget}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    <p className="text-xs text-muted-foreground">
                      Formatos aceitos: JSON, PDF {importingBudget && '(Importando...)'}
                    </p>
                  </div>
                </div>
              </div>

              {budgets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum item de orçamento cadastrado para este evento
                </div>
              ) : (
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Imagem</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Valor Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgets.map((budget) => (
                        <TableRow key={budget.id}>
                          <TableCell>
                            {budget.image_url ? (
                              <img
                                src={budget.image_url}
                                alt={budget.item}
                                className="w-12 h-12 object-cover rounded-md"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-md flex items-center justify-center">
                                <span className="text-xs text-gray-500">Sem imagem</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{budget.item}</TableCell>
                          <TableCell>{budget.description}</TableCell>
                          <TableCell>{budget.quantity}</TableCell>
                          <TableCell>R$ {budget.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>R$ {budget.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
                         <TableCell>
                           <div className="flex gap-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 setSelectedBudgetForEdit({
                                   ...budget,
                                   image_file: null
                                 });
                                 setEditBudgetDialog(true);
                               }}
                               className="text-blue-600 hover:text-blue-800"
                               title="Editar item"
                             >
                               <Edit className="h-4 w-4" />
                             </Button>
                             {budget.pdf_url && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => viewPdf(budget.pdf_url)}
                                 className="text-green-600 hover:text-green-800"
                                 title="Visualizar PDF"
                               >
                                 <FileImage className="h-4 w-4" />
                               </Button>
                             )}
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => deleteBudget(budget.id)}
                               className="text-red-600 hover:text-red-800"
                               title="Excluir item"
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </div>
                         </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-lg font-semibold">
                  Total do Orçamento: R$ {budgets.reduce((acc, budget) => acc + budget.total_price, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <Button variant="outline" onClick={() => {
                  setBudgetDialog(false);
                  setSelectedEventForBudget(null);
                }}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal para Visualizar PDF */}
      <Dialog open={pdfViewerDialog} onOpenChange={(open) => {
        setPdfViewerDialog(open);
        if (!open && selectedPdfUrl.startsWith('blob:')) {
          URL.revokeObjectURL(selectedPdfUrl);
          setSelectedPdfUrl('');
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[95vh] w-[95vw] h-[90vh]">
          <DialogHeader>
            <DialogTitle>Visualizar PDF do Orçamento</DialogTitle>
            <DialogDescription>
              Visualize o arquivo PDF do orçamento importado
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-full">
            {selectedPdfUrl && (
              <iframe
                src={selectedPdfUrl}
                className="w-full h-[75vh] border rounded-lg"
                title="PDF Viewer"
                style={{ minHeight: '600px' }}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button 
              variant="outline"
              onClick={() => window.open(selectedPdfUrl, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em Nova Aba
            </Button>
            <Button variant="outline" onClick={() => setPdfViewerDialog(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para Editar Item do Orçamento */}
      {selectedBudgetForEdit && (
        <Dialog open={editBudgetDialog} onOpenChange={() => {
          setEditBudgetDialog(false);
          setSelectedBudgetForEdit(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Item do Orçamento</DialogTitle>
              <DialogDescription>
                Edite as informações do item do orçamento
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_budget_item">Item</Label>
                  <Input
                    id="edit_budget_item"
                    value={selectedBudgetForEdit.item}
                    onChange={(e) => setSelectedBudgetForEdit({
                      ...selectedBudgetForEdit,
                      item: e.target.value
                    })}
                    placeholder="Nome do item"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_budget_description">Descrição</Label>
                  <Input
                    id="edit_budget_description"
                    value={selectedBudgetForEdit.description || ''}
                    onChange={(e) => setSelectedBudgetForEdit({
                      ...selectedBudgetForEdit,
                      description: e.target.value
                    })}
                    placeholder="Descrição do item"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_budget_quantity">Quantidade</Label>
                  <Input
                    id="edit_budget_quantity"
                    type="number"
                    min="1"
                    value={selectedBudgetForEdit.quantity}
                    onChange={(e) => {
                      const quantity = parseInt(e.target.value) || 1;
                      const unit_price = selectedBudgetForEdit.unit_price;
                      setSelectedBudgetForEdit({
                        ...selectedBudgetForEdit,
                        quantity,
                        total_price: quantity * unit_price
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_budget_unit_price">Valor Unit.</Label>
                  <CurrencyInput
                    id="edit_budget_unit_price"
                    value={selectedBudgetForEdit.unit_price}
                    onChange={(value) => {
                      const unit_price = value;
                      const quantity = selectedBudgetForEdit.quantity;
                      setSelectedBudgetForEdit({
                        ...selectedBudgetForEdit,
                        unit_price,
                        total_price: quantity * unit_price
                      });
                    }}
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_budget_total_price">Valor Total</Label>
                  <CurrencyInput
                    id="edit_budget_total_price"
                    value={selectedBudgetForEdit.total_price}
                    onChange={(value) => setSelectedBudgetForEdit({
                      ...selectedBudgetForEdit,
                      total_price: value
                    })}
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>

              {/* Upload de Nova Imagem */}
              <div className="space-y-2">
                <Label htmlFor="edit_budget_image">Nova Imagem (Opcional)</Label>
                <Input
                  id="edit_budget_image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedBudgetForEdit({
                      ...selectedBudgetForEdit,
                      image_file: file
                    });
                  }}
                />
                {selectedBudgetForEdit.image_file && (
                  <div className="text-sm text-muted-foreground">
                    Nova imagem selecionada: {selectedBudgetForEdit.image_file.name}
                  </div>
                )}
                {selectedBudgetForEdit.image_url && !selectedBudgetForEdit.image_file && (
                  <div className="text-sm text-muted-foreground">
                    Imagem atual mantida
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setEditBudgetDialog(false);
                setSelectedBudgetForEdit(null);
              }}>
                Cancelar
              </Button>
              <Button onClick={() => selectedBudgetForEdit && updateBudget(selectedBudgetForEdit.id, selectedBudgetForEdit)}>
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
