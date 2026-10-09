import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, Phone, Mail, MapPin, Edit, Trash2, Plus, Shield, Eye } from 'lucide-react';
import { ClientDetailsDialog } from './ClientDetailsDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatPhone, handlePhoneInput } from '@/lib/utils';

import { PageActions } from "@/components/layout/PageHeader";
import { confirmDelete } from "@/components/ConfirmHost";
interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const Clients = () => {
  const { userRole } = useCustomAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientDialog, setClientDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [canViewClients, setCanViewClients] = useState(true);
  const [canEditClients, setCanEditClients] = useState(true);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [newClient, setNewClient] = useState<Partial<Client>>({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  // Check permissions on mount - Admin, Financeiro and Deposito have access  
  useEffect(() => {
    const checkPermissions = async () => {
      // Admin, financeiro and deposito users have access to clients
      const isAuthorized = userRole === 'admin' || userRole === 'financeiro' || userRole === 'deposito';
      setCanViewClients(isAuthorized);
      setCanEditClients(isAuthorized);
    };
    checkPermissions();
  }, [userRole]);

  // Fetch clients
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: "Erro ao carregar clientes",
        description: "Não foi possível carregar os clientes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Add new client
  const addClient = async () => {
    if (!newClient.name) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do cliente é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .insert({
          name: newClient.name,
          email: newClient.email || null,
          phone: newClient.phone || null,
          address: newClient.address || null,
          notes: newClient.notes || null
        });

      if (error) throw error;

      await fetchClients();
      setNewClient({
        name: '',
        email: '',
        phone: '',
        address: '',
        notes: ''
      });
      setClientDialog(false);

      toast({
        title: "Cliente cadastrado",
        description: "O cliente foi cadastrado com sucesso.",
      });
    } catch (error) {
      console.error('Error adding client:', error);
      toast({
        title: "Erro ao cadastrar cliente",
        description: "Não foi possível cadastrar o cliente.",
        variant: "destructive"
      });
    }
  };

  // Update client
  const updateClient = async () => {
    if (!editingClient || !editingClient.name) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do cliente é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .update({
          name: editingClient.name,
          email: editingClient.email || null,
          phone: editingClient.phone || null,
          address: editingClient.address || null,
          notes: editingClient.notes || null
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      await fetchClients();
      setEditingClient(null);
      setClientDialog(false);

      toast({
        title: "Cliente atualizado",
        description: "O cliente foi atualizado com sucesso.",
      });
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Erro ao atualizar cliente",
        description: "Não foi possível atualizar o cliente.",
        variant: "destructive"
      });
    }
  };

  // Delete client
  const deleteClient = async (clientId: string) => {
    if (!(await confirmDelete({ title: "Excluir este cliente?" }))) return;
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;

      await fetchClients();

      toast({
        title: "Cliente removido",
        description: "O cliente foi removido com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: "Erro ao remover cliente",
        description: "Não foi possível remover o cliente.",
        variant: "destructive"
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setClientDialog(true);
  };

  // Open add dialog
  const openAddDialog = () => {
    setEditingClient(null);
    setNewClient({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: ''
    });
    setClientDialog(true);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  if (loading) {
    return <div className="p-6">Carregando clientes...</div>;
  }

  // Show permission warning if user has no view access
  if (!canViewClients) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
            <p className="text-muted-foreground">
              Você não tem permissão para visualizar informações de clientes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        {canEditClients && (
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        )}
      </PageActions>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Cadastrado em</TableHead>
                {canEditClients && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {client.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {client.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {client.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {client.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {client.address}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(client.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  {canEditClients && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setViewingClient(client);
                            setClientDetailsOpen(true);
                          }}
                          title="Visualizar detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(client)} title="Editar" aria-label="Editar">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteClient(client.id)}
                          className="text-red-600 hover:text-red-700" title="Excluir" aria-label="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEditClients ? 6 : 5} className="text-center text-muted-foreground py-8">
                    Nenhum cliente cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Client Dialog */}
      <Dialog open={clientDialog} onOpenChange={setClientDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingClient ? 'Edite as informações do cliente' : 'Cadastre um novo cliente'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={editingClient ? editingClient.name : newClient.name || ''}
                onChange={(e) => {
                  if (editingClient) {
                    setEditingClient({ ...editingClient, name: e.target.value });
                  } else {
                    setNewClient(prev => ({ ...prev, name: e.target.value }));
                  }
                }}
                placeholder="Nome do cliente"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingClient ? editingClient.email : newClient.email || ''}
                  onChange={(e) => {
                    if (editingClient) {
                      setEditingClient({ ...editingClient, email: e.target.value });
                    } else {
                      setNewClient(prev => ({ ...prev, email: e.target.value }));
                    }
                  }}
                  placeholder="cliente@email.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={editingClient ? editingClient.phone : newClient.phone || ''}
                  onChange={(e) => {
                    const formatted = handlePhoneInput(e.target.value);
                    if (editingClient) {
                      setEditingClient({ ...editingClient, phone: formatted });
                    } else {
                      setNewClient(prev => ({ ...prev, phone: formatted }));
                    }
                  }}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={editingClient ? editingClient.address : newClient.address || ''}
                onChange={(e) => {
                  if (editingClient) {
                    setEditingClient({ ...editingClient, address: e.target.value });
                  } else {
                    setNewClient(prev => ({ ...prev, address: e.target.value }));
                  }
                }}
                placeholder="Endereço completo"
              />
            </div>

            <div>
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={editingClient ? editingClient.notes : newClient.notes || ''}
                onChange={(e) => {
                  if (editingClient) {
                    setEditingClient({ ...editingClient, notes: e.target.value });
                  } else {
                    setNewClient(prev => ({ ...prev, notes: e.target.value }));
                  }
                }}
                placeholder="Observações sobre o cliente"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setClientDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={editingClient ? updateClient : addClient}>
                {editingClient ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Details Dialog */}
      {viewingClient && (
        <ClientDetailsDialog
          clientId={viewingClient.id}
          clientName={viewingClient.name}
          open={clientDetailsOpen}
          onOpenChange={setClientDetailsOpen}
        />
      )}
    </div>
  );
};