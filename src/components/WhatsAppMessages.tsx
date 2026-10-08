import { useState, useEffect } from "react";
import { supabase, API_URL } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Paperclip, Link2, Check, X, RefreshCw, Copy, ExternalLink, Phone, Calendar, DollarSign, FileText, Image as ImageIcon, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WhatsAppMessage {
  id: string;
  sender_phone: string;
  sender_name: string | null;
  message_content: string | null;
  message_type: string;
  attachment_url: string | null;
  attachment_type: string | null;
  event_id: string | null;
  event_expense_id: string | null;
  status: string;
  matched_event_name: string | null;
  extracted_amount: number | null;
  extracted_description: string | null;
  extracted_date: string | null;
  extracted_time: string | null;
  extracted_name: string | null;
  extraction_status: string;
  extraction_confidence: number | null;
  company_expense_id: string | null;
  link_destination: LinkDestination | null;
  processing_notes: string | null;
  person_type: 'collaborator' | 'worker' | null;
  person_id: string | null;
  person_name: string | null;
  received_at: string;
  processed_at: string | null;
  created_at: string;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
}

type LinkDestination = 'evento' | 'galpao' | 'collaborator' | 'worker' | 'fixed_expense' | 'personal_expense';
type PersonExpenseType = 'ficha' | 'eventos' | 'vales' | 'salario' | 'notinhas' | 'adiantamento_notinhas' | 'alimentacao';
type EventPersonExpenseType = 'vales' | 'notinhas' | 'adiantamento_notinhas' | 'alimentacao' | 'transporte' | 'hospedagem' | 'materiais' | 'outros';
interface PersonOption { id: string; name: string }
interface PersonalCategoryOption { id: string; name: string }

const RECEIPT_CATEGORIES = ['Alimentação', 'Transporte', 'Combustível', 'Materiais', 'Ferramentas', 'Hospedagem', 'Estacionamento', 'Pedágio'];
const PERSON_EXPENSE_TYPES: Array<{ value: PersonExpenseType; label: string }> = [
  { value: 'ficha', label: 'Ficha' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'vales', label: 'Vales' },
  { value: 'salario', label: 'Salário' },
  { value: 'notinhas', label: 'Notinhas' },
  { value: 'adiantamento_notinhas', label: 'Adiant. Notinhas' },
  { value: 'alimentacao', label: 'Alimentação' },
];
const PERSON_TYPE_CATEGORIES: Record<PersonExpenseType, string[]> = {
  ficha: ['Documentação', 'Uniforme e EPI', 'Treinamento', 'Exames', 'Cadastro', 'Outros'],
  eventos: ['Mão de Obra', 'Transporte', 'Alimentação', 'Hospedagem', 'Materiais', 'Hora Extra', 'Outros'],
  vales: ['Vale/Adiantamento', 'Vale-transporte', 'Vale-alimentação', 'Vale-combustível', 'Outros'],
  salario: ['Salário mensal', 'Hora extra', 'Comissão', 'Bônus', 'Ajuste/Desconto', 'Outros'],
  notinhas: [...RECEIPT_CATEGORIES, 'Outros'],
  adiantamento_notinhas: ['Despesas de evento', 'Compras', 'Viagem', 'Alimentação', 'Transporte', 'Materiais', 'Outros'],
  alimentacao: ['Café da manhã', 'Almoço', 'Jantar', 'Lanche', 'Água/Bebidas', 'Outros'],
};
const EVENT_PERSON_EXPENSE_TYPES: Array<{ value: EventPersonExpenseType; label: string }> = [
  { value: 'vales', label: 'Vale' },
  { value: 'adiantamento_notinhas', label: 'Adiantamento de Notinha' },
  { value: 'notinhas', label: 'Notinha' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'materiais', label: 'Materiais' },
  { value: 'outros', label: 'Outros' },
];
const EVENT_PERSON_TYPE_CATEGORIES: Record<EventPersonExpenseType, string[]> = {
  vales: ['Vale/Adiantamento', 'Vale-transporte', 'Vale-alimentação', 'Vale-combustível', 'Outros'],
  notinhas: [...RECEIPT_CATEGORIES, 'Outros'],
  adiantamento_notinhas: ['Compras do evento', 'Viagem', 'Alimentação', 'Transporte', 'Materiais', 'Outros'],
  alimentacao: ['Café da manhã', 'Almoço', 'Jantar', 'Lanche', 'Água/Bebidas', 'Outros'],
  transporte: ['Combustível', 'Aplicativo/Táxi', 'Passagem', 'Pedágio', 'Estacionamento', 'Frete', 'Outros'],
  hospedagem: ['Hotel', 'Pousada', 'Hospedagem da equipe', 'Taxas', 'Outros'],
  materiais: ['Material elétrico', 'Ferramentas', 'Consumíveis', 'Reposição', 'Outros'],
  outros: ['Outras despesas do evento'],
};
const COMPANY_CATEGORIES = ['Material de Escritório', 'Manutenção', 'Combustível', 'Alimentação', 'Transporte', 'Equipamentos', 'Serviços', 'Impostos', 'Aluguel', 'Utilidades (Água, Luz, Internet)', 'Marketing', 'Outros'];
const FIXED_CATEGORIES = ['Aluguel', 'Água', 'Luz', 'Internet', 'Telefone', 'Seguros', 'Impostos', 'Salários', 'Contador', 'Outros'];
const EVENT_CATEGORIES = ['Materiais do Evento', 'Decoração', 'Iluminação', 'Som', 'Transporte', 'Alimentação Equipe', 'Hospedagem', 'Aluguel de Equipamentos', 'Mão de Obra', 'Fornecedores', 'Outros'];

export const WhatsAppMessages = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [collaborators, setCollaborators] = useState<PersonOption[]>([]);
  const [workers, setWorkers] = useState<PersonOption[]>([]);
  const [personalCategories, setPersonalCategories] = useState<PersonalCategoryOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [eventMonthFilter, setEventMonthFilter] = useState('all');
  const [linkDestination, setLinkDestination] = useState<LinkDestination>('evento');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [selectedExpenseType, setSelectedExpenseType] = useState<PersonExpenseType>('notinhas');
  const [selectedEventExpenseType, setSelectedEventExpenseType] = useState<EventPersonExpenseType>('notinhas');
  const [selectedCategory, setSelectedCategory] = useState('Outros');
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const webhookUrl = `${API_URL}/functions/v1/whatsapp-webhook`;
  const eventYears = Array.from(new Set([
    new Date().getFullYear(),
    ...events.map(event => Number(event.event_date.slice(0, 4))),
  ])).filter(Number.isFinite).sort((a, b) => b - a);
  const eventMonthOptions = eventYears.flatMap(year =>
    Array.from({ length: 12 }, (_, index) => `${year}-${String(12 - index).padStart(2, '0')}`),
  );
  const filteredEvents = eventMonthFilter === 'all'
    ? events
    : events.filter(event => event.event_date.startsWith(eventMonthFilter));

  useEffect(() => {
    fetchMessages();
    fetchEvents();
    fetchLinkOptions();
  }, []);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .order('received_at', { ascending: false });

      if (error) throw error;
      setMessages((data || []) as WhatsAppMessage[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar mensagens",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLinkOptions = async () => {
    const [collaboratorResult, workerResult, categoryResult] = await Promise.all([
      supabase.from('collaborators').select('id, name').order('name'),
      supabase.from('workers').select('id, name').order('name'),
      supabase.from('personal_categories').select('id, name').eq('kind', 'expense').eq('archived', false).order('name'),
    ]);
    setCollaborators((collaboratorResult.data || []) as PersonOption[]);
    setWorkers((workerResult.data || []) as PersonOption[]);
    setPersonalCategories((categoryResult.data || []) as PersonalCategoryOption[]);
  };

  const categoriesForDestination = (destination: LinkDestination, expenseType = selectedExpenseType) => {
    if (destination === 'fixed_expense') return FIXED_CATEGORIES;
    if (destination === 'galpao') return COMPANY_CATEGORIES;
    if (destination === 'evento') return EVENT_CATEGORIES;
    if (destination === 'personal_expense') return personalCategories.map(category => category.id);
    return expenseType === 'eventos'
      ? EVENT_PERSON_TYPE_CATEGORIES[selectedEventExpenseType]
      : PERSON_TYPE_CATEGORIES[expenseType];
  };

  const changeExpenseType = (expenseType: PersonExpenseType) => {
    setSelectedExpenseType(expenseType);
    if (expenseType === 'eventos') {
      setSelectedEventExpenseType('notinhas');
      setSelectedCategory(EVENT_PERSON_TYPE_CATEGORIES.notinhas[0]);
    } else {
      setSelectedEventId('');
      setSelectedCategory(PERSON_TYPE_CATEGORIES[expenseType][0]);
    }
  };

  const changeEventExpenseType = (expenseType: EventPersonExpenseType) => {
    setSelectedEventExpenseType(expenseType);
    setSelectedCategory(EVENT_PERSON_TYPE_CATEGORIES[expenseType][0]);
  };

  const changeDestination = (destination: LinkDestination) => {
    setLinkDestination(destination);
    setSelectedEventId('');
    setEventMonthFilter('all');
    if (destination === 'collaborator') {
      setSelectedEntityId(selectedMessage?.person_type === 'collaborator' ? selectedMessage.person_id || '' : '');
    } else if (destination === 'worker') {
      setSelectedEntityId(selectedMessage?.person_type === 'worker' ? selectedMessage.person_id || '' : '');
    } else {
      setSelectedEntityId('');
    }
    if (destination === 'collaborator' || destination === 'worker') {
      setSelectedExpenseType('notinhas');
      setSelectedEventExpenseType('notinhas');
      setSelectedCategory(PERSON_TYPE_CATEGORIES.notinhas[0]);
    } else {
      setSelectedCategory(categoriesForDestination(destination)[0] || '');
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, event_date')
        .order('event_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const handleLinkToEvent = (message: WhatsAppMessage) => {
    setSelectedMessage(message);
    setSelectedEventId(message.event_id || "");
    const initialDestination: LinkDestination = message.person_type === 'worker'
      ? 'worker'
      : message.person_type === 'collaborator'
        ? 'collaborator'
        : (message.link_destination as LinkDestination) || 'evento';
    setLinkDestination(initialDestination);
    setSelectedEntityId(message.person_id || '');
    setSelectedExpenseType('notinhas');
    setSelectedEventExpenseType('notinhas');
    setSelectedCategory(categoriesForDestination(initialDestination, 'notinhas')[0] || '');
    setExpenseDescription(message.extracted_description || message.message_content?.slice(0, 100) || "");
    setExpenseAmount(message.extracted_amount || 0);
    setIsLinkDialogOpen(true);
  };

  const handleConfirmLink = async () => {
    if (!selectedMessage || (linkDestination === 'evento' && !selectedEventId)) return;
    if ((linkDestination === 'collaborator' || linkDestination === 'worker') && !selectedEntityId) return;
    if ((linkDestination === 'collaborator' || linkDestination === 'worker') && selectedExpenseType === 'eventos' && !selectedEventId) return;
    if (!selectedCategory) return;

    setIsProcessing(true);
    try {
      const amount = expenseAmount || 0;

      const commonExpense = {
        description: expenseDescription || 'Despesa via WhatsApp',
        category: selectedCategory,
        quantity: 1,
        unit_price: amount,
        total_price: amount,
        expense_date: selectedMessage.extracted_date || new Date().toISOString().split('T')[0],
        receipt_url: selectedMessage.attachment_url || null,
        supplier: selectedMessage.extracted_name || null,
        notes: `${linkDestination === 'collaborator' || linkDestination === 'worker' ? `Tipo de despesa: ${PERSON_EXPENSE_TYPES.find(type => type.value === selectedExpenseType)?.label}${selectedExpenseType === 'eventos' ? ` / ${EVENT_PERSON_EXPENSE_TYPES.find(type => type.value === selectedEventExpenseType)?.label}` : ''}. ` : ''}Recebido via WhatsApp de ${selectedMessage.sender_name || selectedMessage.sender_phone}${selectedMessage.extracted_time ? ` às ${selectedMessage.extracted_time}` : ''}`,
      };

      const autoNotinhaId = selectedMessage.person_id ? selectedMessage.event_expense_id : null;
      let expenseResult: { data: { id: string } | null; error: any };
      let linkedRecordType: string = linkDestination;
      const isPersonDestination = linkDestination === 'collaborator' || linkDestination === 'worker';
      const isExpenseAdvance = isPersonDestination && (
        selectedExpenseType === 'adiantamento_notinhas' ||
        (selectedExpenseType === 'eventos' && selectedEventExpenseType === 'adiantamento_notinhas')
      );

      if (isExpenseAdvance) {
        const { data: authData } = await supabase.auth.getUser();
        const personList = linkDestination === 'worker' ? workers : collaborators;
        const person = personList.find(item => item.id === selectedEntityId);
        if (!person) throw new Error('Pessoa não encontrada');
        const event = events.find(item => item.id === selectedEventId);
        const advanceNotes = `${commonExpense.description}. Categoria: ${selectedCategory}.${event ? ` Evento: ${event.name}.` : ''} ${commonExpense.notes}`;

        if (linkDestination === 'worker') {
          expenseResult = await supabase.from('worker_expense_advances').insert({
            worker_name: person.name,
            amount,
            advance_date: commonExpense.expense_date,
            notes: advanceNotes,
            receipt_url: commonExpense.receipt_url,
            created_by: authData.user?.id || null,
          }).select('id').single();
          linkedRecordType = 'worker_expense_advance';
        } else {
          expenseResult = await supabase.from('collaborator_expense_advances').insert({
            collaborator_id: selectedEntityId,
            amount,
            advance_date: commonExpense.expense_date,
            notes: `${advanceNotes}${commonExpense.receipt_url ? ` Comprovante: ${commonExpense.receipt_url}` : ''}`,
            created_by: authData.user?.id || null,
          }).select('id').single();
          linkedRecordType = 'collaborator_expense_advance';
        }
      } else if (linkDestination === 'evento' || isPersonDestination) {
        const personList = linkDestination === 'worker' ? workers : collaborators;
        const person = personList.find(item => item.id === selectedEntityId);
        const expensePayload = {
          ...commonExpense,
          event_id: linkDestination === 'evento' || selectedExpenseType === 'eventos' ? selectedEventId : null,
          reference_type: linkDestination === 'evento' ? 'whatsapp' : linkDestination,
          reference_id: linkDestination === 'evento' ? selectedMessage.id : selectedEntityId,
          description: person ? `${person.name} - ${commonExpense.description}` : commonExpense.description,
        };
        expenseResult = autoNotinhaId
          ? await supabase.from('event_expenses').update(expensePayload).eq('id', autoNotinhaId).select('id').single()
          : await supabase.from('event_expenses').insert(expensePayload).select('id').single();
        linkedRecordType = 'event_expense';
      } else if (linkDestination === 'galpao') {
        expenseResult = await supabase.from('company_expenses').insert(commonExpense).select('id').single();
        linkedRecordType = 'company_expense';
      } else if (linkDestination === 'fixed_expense') {
        const { data: authData } = await supabase.auth.getUser();
        expenseResult = await supabase.from('recurring_expenses').insert({
          name: commonExpense.description,
          description: commonExpense.notes,
          category: selectedCategory,
          amount,
          due_day: Number((selectedMessage.extracted_date || '').slice(-2)) || new Date().getDate(),
          receipt_path: selectedMessage.attachment_url,
          created_by: authData.user?.id || null,
        }).select('id').single();
        linkedRecordType = 'recurring_expense';
      } else {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) throw new Error('Sessão expirada');
        expenseResult = await supabase.from('personal_expenses').insert({
          owner_id: authData.user.id,
          description: commonExpense.description,
          amount_cents: Math.round(amount * 100),
          expense_date: commonExpense.expense_date,
          category_id: selectedCategory,
          kind: 'expense',
          notes: commonExpense.notes,
        }).select('id').single();
        linkedRecordType = 'personal_expense';
      }

      const { data: expenseData, error: expenseError } = expenseResult;

      if (expenseError) throw expenseError;

      if (autoNotinhaId && linkedRecordType !== 'event_expense') {
        await supabase.from('event_expenses').delete().eq('id', autoNotinhaId);
      }

      // Atualizar mensagem
      const { error: updateError } = await supabase
        .from('whatsapp_messages')
        .update({
          event_id: linkDestination === 'evento' || ((linkDestination === 'collaborator' || linkDestination === 'worker') && selectedExpenseType === 'eventos') ? selectedEventId : null,
          event_expense_id: linkedRecordType === 'event_expense' ? expenseData.id : null,
          company_expense_id: linkedRecordType === 'company_expense' ? expenseData.id : null,
          link_destination: linkDestination,
          linked_record_type: linkedRecordType,
          linked_record_id: expenseData.id,
          status: 'processed',
          processed_at: new Date().toISOString(),
          processing_notes: `Vinculado manualmente como ${isExpenseAdvance ? 'adiantamento de notinha' : PERSON_EXPENSE_TYPES.find(type => type.value === selectedExpenseType)?.label || linkDestination}`,
        })
        .eq('id', selectedMessage.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso",
        description: "Mensagem vinculada e despesa criada!",
      });

      setIsLinkDialogOpen(false);
      fetchMessages();
    } catch (error) {
      console.error('Error linking message:', error);
      toast({
        title: "Erro",
        description: "Falha ao vincular mensagem",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openAttachment = async (path: string) => {
    if (/^https?:\/\//i.test(path)) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from('whatsapp-receipts').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: 'Erro', description: 'Não foi possível abrir o comprovante.', variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleIgnoreMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .update({
          status: 'ignored',
          processed_at: new Date().toISOString(),
          processing_notes: 'Ignorado pelo usuário',
        })
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: "Mensagem ignorada",
        description: "A mensagem foi marcada como ignorada",
      });

      fetchMessages();
    } catch (error) {
      console.error('Error ignoring message:', error);
      toast({
        title: "Erro",
        description: "Falha ao ignorar mensagem",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: "Mensagem excluída",
        description: "A mensagem foi removida do sistema",
      });

      fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Erro",
        description: "Falha ao excluir mensagem",
        variant: "destructive",
      });
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "Copiado!",
      description: "URL do webhook copiada para a área de transferência",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente</Badge>;
      case 'linked':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Vinculado</Badge>;
      case 'processed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Processado</Badge>;
      case 'ignored':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Ignorado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (activeTab === 'pending') return msg.status === 'pending' || msg.status === 'linked';
    if (activeTab === 'processed') return msg.status === 'processed';
    if (activeTab === 'ignored') return msg.status === 'ignored';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-green-600" />
            WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Receba mensagens e comprovantes via webhook
          </p>
        </div>
        <Button onClick={fetchMessages} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Webhook Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Configuração do Webhook
          </CardTitle>
          <CardDescription>
            Configure seu sistema externo para enviar mensagens para este endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all">
              {webhookUrl}
            </code>
            <Button onClick={copyWebhookUrl} size="icon" variant="outline">
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p className="font-medium">Formato do payload (POST):</p>
            <pre className="bg-muted p-3 rounded-md overflow-x-auto text-xs">
{`{
  "sender_phone": "+5511999999999",
  "sender_name": "Nome do Remetente",
  "message_content": "Evento Casamento Silva - R$ 150,00 material elétrico",
  "message_type": "text",
  "attachment_url": "https://...",
  "attachment_type": "image/jpeg"
}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Messages List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mensagens Recebidas</CardTitle>
          <CardDescription>
            {messages.length} mensagem(ns) no total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pendentes ({messages.filter(m => m.status === 'pending' || m.status === 'linked').length})
              </TabsTrigger>
              <TabsTrigger value="processed">
                Processadas ({messages.filter(m => m.status === 'processed').length})
              </TabsTrigger>
              <TabsTrigger value="ignored">
                Ignoradas ({messages.filter(m => m.status === 'ignored').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mensagem nesta categoria</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Remetente</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Evento</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recebido</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMessages.map((message) => (
                        <TableRow key={message.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{message.sender_name || 'Desconhecido'}</p>
                                <p className="text-xs text-muted-foreground">{message.sender_phone}</p>
                                {message.person_name && (
                                  <Badge variant="secondary" className="mt-1 text-[10px]">
                                    {message.person_type === 'worker' ? 'Diarista' : 'Colaborador'}: {message.person_name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate">{message.message_content || '-'}</p>
                            {message.attachment_url && (
                              <button
                                type="button"
                                onClick={() => void openAttachment(message.attachment_url!)}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <Paperclip className="w-3 h-3" />
                                Ver anexo
                              </button>
                            )}
                            {message.extraction_status === 'failed' && <p className="text-xs text-destructive mt-1">Leitura automática falhou; confira manualmente.</p>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getMessageTypeIcon(message.message_type)}
                              <span className="text-xs capitalize">{message.message_type}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {message.matched_event_name ? (
                              <Badge variant="secondary" className="text-xs">
                                {message.matched_event_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {message.extracted_amount ? (
                              <span className="flex items-center gap-1 text-green-600 font-medium">
                                <DollarSign className="w-3 h-3" />
                                {message.extracted_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                            {(message.extracted_name || message.extracted_date || message.extracted_time) && (
                              <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                                {message.extracted_name && <p>{message.extracted_name}</p>}
                                {(message.extracted_date || message.extracted_time) && <p>{message.extracted_date ? format(new Date(`${message.extracted_date}T12:00:00`), 'dd/MM/yyyy') : ''} {message.extracted_time?.slice(0, 5) || ''}</p>}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(message.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(message.received_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                              {(message.status === 'pending' || message.status === 'linked') && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLinkToEvent(message)}
                                    className="h-8"
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Vincular
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleIgnoreMessage(message.id)}
                                    className="h-8"
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteMessage(message.id)}
                                className="h-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Link to Event Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular comprovante</DialogTitle>
            <DialogDescription>
              Confira os dados lidos e escolha o destino da despesa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={linkDestination} onValueChange={(value: LinkDestination) => changeDestination(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evento">Evento</SelectItem>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="worker">Diarista</SelectItem>
                  <SelectItem value="fixed_expense">Despesa fixa</SelectItem>
                  <SelectItem value="galpao">Gasto da empresa / Galpão</SelectItem>
                  <SelectItem value="personal_expense">Gasto pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedMessage?.extracted_name && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p><strong>Nome:</strong> {selectedMessage.extracted_name}</p>
                <p><strong>Data/hora:</strong> {selectedMessage.extracted_date ? format(new Date(`${selectedMessage.extracted_date}T12:00:00`), 'dd/MM/yyyy') : 'não identificada'} {selectedMessage.extracted_time?.slice(0, 5) || ''}</p>
              </div>
            )}

            {linkDestination === 'evento' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Filtrar eventos por mês</Label>
                  <Select value={eventMonthFilter} onValueChange={(value) => { setEventMonthFilter(value); setSelectedEventId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Todos os meses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os meses</SelectItem>
                      {eventMonthOptions.map(month => (
                        <SelectItem key={month} value={month}>
                          {format(new Date(`${month}-01T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Evento</Label>
                  <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger>
                    <SelectContent>
                      {filteredEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name} - {format(new Date(`${event.event_date}T12:00:00`), "dd/MM/yyyy")}
                        </SelectItem>
                      ))}
                      {filteredEvents.length === 0 && <SelectItem value="no-events" disabled>Nenhum evento neste mês</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {(linkDestination === 'collaborator' || linkDestination === 'worker') && (
              <>
                <div className="space-y-2">
                  <Label>{linkDestination === 'worker' ? 'Diarista' : 'Colaborador'}</Label>
                  <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a pessoa" /></SelectTrigger>
                    <SelectContent>
                      {(linkDestination === 'worker' ? workers : collaborators).map(person => (
                        <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de despesa</Label>
                  <Select value={selectedExpenseType} onValueChange={(value: PersonExpenseType) => changeExpenseType(value)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {PERSON_EXPENSE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedExpenseType === 'eventos' && (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>Filtrar eventos por mês</Label>
                      <Select value={eventMonthFilter} onValueChange={(value) => { setEventMonthFilter(value); setSelectedEventId(''); }}>
                        <SelectTrigger><SelectValue placeholder="Todos os meses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os meses</SelectItem>
                          {eventMonthOptions.map(month => (
                            <SelectItem key={month} value={month}>
                              {format(new Date(`${month}-01T12:00:00`), "MMMM 'de' yyyy", { locale: ptBR })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Evento *</Label>
                      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                        <SelectTrigger><SelectValue placeholder="Escolha o evento para vincular" /></SelectTrigger>
                        <SelectContent>
                          {filteredEvents.map(event => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.name} - {format(new Date(`${event.event_date}T12:00:00`), 'dd/MM/yyyy')}
                            </SelectItem>
                          ))}
                          {filteredEvents.length === 0 && <SelectItem value="no-events" disabled>Nenhum evento neste mês</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de despesa do evento</Label>
                      <Select value={selectedEventExpenseType} onValueChange={(value: EventPersonExpenseType) => changeEventExpenseType(value)}>
                        <SelectTrigger><SelectValue placeholder="Selecione o tipo da despesa" /></SelectTrigger>
                        <SelectContent>
                          {EVENT_PERSON_EXPENSE_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categoriesForDestination(linkDestination).map(value => {
                    const label = linkDestination === 'personal_expense'
                      ? personalCategories.find(category => category.id === value)?.name || value
                      : value;
                    return <SelectItem key={value} value={value}>{label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição da Despesa</Label>
              <Input
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="Descrição..."
              />
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <CurrencyInput
                value={expenseAmount}
                onChange={setExpenseAmount}
                placeholder="R$ 0,00"
              />
            </div>

            {selectedMessage?.attachment_url && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Anexo</p>
                <button
                  type="button"
                  onClick={() => void openAttachment(selectedMessage.attachment_url!)}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver comprovante
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmLink}
              disabled={(linkDestination === 'evento' && !selectedEventId) || ((linkDestination === 'collaborator' || linkDestination === 'worker') && (!selectedEntityId || (selectedExpenseType === 'eventos' && !selectedEventId))) || !selectedCategory || isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
