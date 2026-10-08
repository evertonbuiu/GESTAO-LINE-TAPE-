import { useState, useEffect, useRef } from 'react';
import { useCustomAuth } from '@/hooks/useCustomAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Settings2, Shield, Eye, Edit3, Save, UserPlus, Mail, Lock, User, Users, Circle, Upload, Image, Trash2, Palette, EyeOff, Sun, Moon, Check, Paintbrush, PaintBucket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { hslToHex, hexToHsl } from '@/utils/colorConversion';

import { PageActions } from "@/components/layout/PageHeader";
export const SettingsPage = () => {
  const { userRole, user } = useCustomAuth();
  const { rolePermissions, loading, updateRolePermission } = usePermissions();
  const { onlineUsers, loading: loadingOnlineUsers } = useOnlineUsers();
  const { theme, colorScheme, setTheme, setColorScheme, availableColorSchemes, createCustomColorScheme, customColors, saveThemePreferences } = useTheme();
  const { toast } = useToast();
  const { settings: companySettings, updateSettings: updateCompanySettings, updateCompanyData, isLoading: isLoadingCompanySettings } = useCompanySettings();
  
  // States para dados completos da empresa
  const [companyData, setCompanyData] = useState({
    company_name: "",
    tagline: "",
    address: "",
    phone: "",
    email: "",
    cnpj: "",
    website: ""
  });
  const [savingCompanyData, setSavingCompanyData] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);
  // State for managing active color property being edited
  const [activeColorProperty, setActiveColorProperty] = useState<string | null>(null);
  

  // Other state
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, { can_view: boolean; can_edit: boolean }>>({});
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logos, setLogos] = useState<any[]>([]);
  const [loadingLogos, setLoadingLogos] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    password: '',
    role: 'funcionario' as 'admin' | 'funcionario' | 'financeiro' | 'deposito'
  });
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'funcionario' as 'admin' | 'funcionario' | 'financeiro' | 'deposito',
    is_active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<any | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  const openEditEmployee = (emp: any) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name || '',
      username: emp.username || '',
      password: '',
      role: emp.role || 'funcionario',
      is_active: !!emp.is_active,
    });
    setShowEditPassword(false);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;
    setSavingEdit(true);
    try {
      const payload: any = {
        action: 'update',
        user_id: editingEmployee.id,
        name: editForm.name,
        username: editForm.username,
        role: editForm.role,
        is_active: editForm.is_active,
      };
      if (editForm.password) payload.password = editForm.password;

      const { data, error } = await supabase.functions.invoke('manage-employee', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      await fetchEmployees();
      setEditingEmployee(null);
      toast({ title: 'Funcionário atualizado' });
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    setDeletingEmployee(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-employee', {
        body: { action: 'delete', user_id: employeeToDelete.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      await fetchEmployees();
      setEmployeeToDelete(null);
      toast({ title: 'Funcionário excluído' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' });
    } finally {
      setDeletingEmployee(false);
    }
  };
  const groupedPermissions = rolePermissions.reduce((acc, rp) => {
    if (!rp.permission) return acc;
    
    const category = rp.permission.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(rp);
    return acc;
  }, {} as Record<string, typeof rolePermissions>);

  // Handle permission change
  const handlePermissionChange = (permissionId: string, field: 'can_view' | 'can_edit', value: boolean) => {
    setChanges(prev => ({
      ...prev,
      [permissionId]: {
        ...prev[permissionId],
        [field]: value
      }
    }));
  };

  // Get current permission value (considering pending changes)
  const getCurrentValue = (rp: any, field: 'can_view' | 'can_edit') => {
    return changes[rp.id]?.[field] ?? rp[field];
  };

  // Save all changes
  const saveChanges = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(changes).map(([permissionId, values]) => {
        const rp = rolePermissions.find(p => p.id === permissionId);
        if (!rp) return Promise.resolve();
        
        return updateRolePermission(
          permissionId,
          values.can_view ?? rp.can_view,
          values.can_edit ?? rp.can_edit
        );
      });

      await Promise.all(promises);
      setChanges({});
      
      toast({
        title: "Permissões atualizadas",
        description: "As alterações foram salvas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as permissões.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Save company data

  const saveCompanyData = async () => {
    setSavingCompanyData(true);
    try {
      const success = await updateCompanyData(companyData);
      if (success) {
        toast({
          title: "Dados salvos",
          description: "Os dados da empresa foram atualizados com sucesso.",
        });
        // Reset flag para permitir recarregamento dos dados atualizados
        setFormInitialized(false);
      } else {
        throw new Error("Falha ao salvar");
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar os dados da empresa.",
        variant: "destructive"
      });
    } finally {
      setSavingCompanyData(false);
    }
  };

  // Check if there are pending changes
  const hasChanges = Object.keys(changes).length > 0;
  const hasCompanyDataChanges = companySettings && (
    companyData.company_name !== companySettings.company_name || 
    companyData.tagline !== companySettings.tagline ||
    companyData.address !== companySettings.address ||
    companyData.phone !== companySettings.phone ||
    companyData.email !== companySettings.email ||
    companyData.cnpj !== companySettings.cnpj ||
    companyData.website !== companySettings.website
  );
  const hasAnyChanges = hasChanges || hasCompanyDataChanges;

  // Create new employee
  const createEmployee = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos para criar o funcionário.",
        variant: "destructive"
      });
      return;
    }

    setCreatingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          name: newUser.name,
          username: newUser.username,
          password: newUser.password,
          role: newUser.role
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const roleLabel = newUser.role === 'admin' ? 'Administrador' : 
                       newUser.role === 'financeiro' ? 'Financeiro' : 
                       newUser.role === 'deposito' ? 'Depósito' : 'Funcionário';

      setNewUser({ name: '', username: '', password: '', role: 'funcionario' });
      setCreateUserDialog(false);
      
      // Recarregar a lista de funcionários
      await fetchEmployees();
      
      toast({
        title: "Funcionário criado",
        description: `${newUser.name} foi criado como ${roleLabel} e pode fazer login.`,
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: "Erro ao criar funcionário",
        description: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        variant: "destructive"
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // Fetch logos from storage
  const fetchLogos = async () => {
    setLoadingLogos(true);
    try {
      const { data, error } = await supabase.storage
        .from('logos')
        .list('', { 
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;
      setLogos(data || []);
    } catch (error) {
      console.error('Error fetching logos:', error);
    } finally {
      setLoadingLogos(false);
    }
  };

  // Fetch all employees
  const fetchEmployees = async () => {
    console.log('Fetching employees...');
    setLoadingEmployees(true);
    try {
      const { data: credentials, error: credentialsError } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('is_active', true);

      console.log('Credentials fetched:', credentials, credentialsError);

      if (credentialsError) throw credentialsError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      console.log('Roles fetched:', roles, rolesError);

      if (rolesError) throw rolesError;

      // Combine credentials with roles
      const employeesWithRoles = credentials.map(credential => {
        const userRole = roles.find(role => role.user_id === credential.id);
        return {
          ...credential,
          role: userRole?.role || 'funcionario'
        };
      });

      console.log('Employees with roles:', employeesWithRoles);
      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoadingEmployees(false);
    }
  };
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo de imagem (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    setUploadingLogo(true);
    try {
      const fileName = `logo-${Date.now()}.${file.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      await fetchLogos();
      
      toast({
        title: "Logo enviada",
        description: "A logo foi enviada com sucesso.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Erro ao enviar logo",
        description: "Não foi possível enviar a logo.",
        variant: "destructive"
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Delete logo
  const deleteLogo = async (fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from('logos')
        .remove([fileName]);

      if (error) throw error;

      await fetchLogos();
      
      toast({
        title: "Logo removida",
        description: "A logo foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting logo:', error);
      toast({
        title: "Erro ao remover logo",
        description: "Não foi possível remover a logo.",
        variant: "destructive"
      });
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchLogos();
    fetchEmployees();
  }, []);

  // Load company data when available (only once per settings change)
  useEffect(() => {
    if (companySettings && !isLoadingCompanySettings) {
      console.log('Loading company settings into form:', companySettings);
      setCompanyData({
        company_name: companySettings.company_name || "",
        tagline: companySettings.tagline || "",
        address: companySettings.address || "",
        phone: companySettings.phone || "",
        email: companySettings.email || "",
        cnpj: companySettings.cnpj || "",
        website: companySettings.website || ""
      });
      setFormInitialized(true);
    }
  }, [companySettings, isLoadingCompanySettings]);

  if (userRole !== 'admin') {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem acessar as configurações do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageActions>
        
        {hasAnyChanges && (
          <div className="flex gap-2">
            <Button onClick={saveChanges} disabled={saving || !hasChanges} variant={hasChanges ? "default" : "outline"}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Permissões
            </Button>
            {hasCompanyDataChanges && (
              <Button onClick={saveCompanyData} disabled={savingCompanyData} variant="outline">
                {savingCompanyData ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar Dados Empresa
              </Button>
            )}
          </div>
        )}
      </PageActions>

      <Tabs defaultValue="empresa" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="empresa">Dados da Empresa</TabsTrigger>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="permissoes">Permissões</TabsTrigger>
          <TabsTrigger value="logos">Logos</TabsTrigger>
        </TabsList>

        {/* Aba Dados da Empresa */}
        <TabsContent value="empresa" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Dados da Empresa para PDFs Timbrados
              </CardTitle>
              <CardDescription>
                Configure as informações da empresa que aparecerão nos documentos PDF
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name-full">Nome da Empresa</Label>
                  <Input
                    id="company-name-full"
                    value={companyData.company_name}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Nome da sua empresa"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-tagline-full">Slogan/Descrição</Label>
                  <Input
                    id="company-tagline-full"
                    value={companyData.tagline}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, tagline: e.target.value }))}
                    placeholder="Ex: Controle de Estoque"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-address">Endereço</Label>
                  <Input
                    id="company-address"
                    value={companyData.address}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Telefone</Label>
                  <Input
                    id="company-phone"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-email">E-mail</Label>
                  <Input
                    id="company-email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contato@empresa.com.br"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="company-cnpj">CNPJ</Label>
                  <Input
                    id="company-cnpj"
                    value={companyData.cnpj}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, cnpj: e.target.value }))}
                    placeholder="12.345.678/0001-90"
                  />
                </div>
                
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company-website">Website</Label>
                  <Input
                    id="company-website"
                    value={companyData.website}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="www.empresa.com.br"
                  />
                </div>
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={saveCompanyData}
                  disabled={savingCompanyData}
                  className="w-full"
                >
                  {savingCompanyData ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Dados da Empresa
                    </>
                  )}
                </Button>
              </div>
              
              <div className="bg-accent/20 p-4 rounded-lg border border-accent/30">
                <h4 className="font-medium text-accent-foreground mb-2">Informações importantes:</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Estes dados serão utilizados nos cabeçalhos dos PDFs timbrados</p>
                  <p>• O endereço e telefone aparecerão no cabeçalho dos relatórios</p>
                  <p>• O CNPJ aparecerá no rodapé dos documentos</p>
                  <p>• Deixe os campos em branco se não quiser que apareçam nos documentos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Funcionários */}
        <TabsContent value="funcionarios" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Gerenciar Funcionários</CardTitle>
                  <CardDescription>
                    Cadastre novos funcionários no sistema
                  </CardDescription>
                </div>
                <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Novo Funcionário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cadastrar Funcionário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Nome Completo</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="name"
                            type="text"
                            placeholder="Digite o nome do funcionário"
                            value={newUser.name}
                            onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="username">Nome de Usuário</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="username"
                            type="text"
                            placeholder="Digite o nome de usuário"
                            value={newUser.username}
                            onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                            className="pl-10"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="password">Senha</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite a senha"
                            value={newUser.password}
                            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                            className="pl-10 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="role">Nível de Acesso</Label>
                        <Select
                          value={newUser.role}
                          onValueChange={(value: 'admin' | 'funcionario' | 'financeiro' | 'deposito') => 
                            setNewUser(prev => ({ ...prev, role: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="funcionario">
                              <div className="flex flex-col items-start">
                                <span>Funcionário</span>
                                <span className="text-xs text-muted-foreground">
                                  Acesso básico conforme permissões
                                </span>
                              </div>
                            </SelectItem>
                            <SelectItem value="deposito">
                              <div className="flex flex-col items-start">
                                <span>Depósito</span>
                                <span className="text-xs text-muted-foreground">
                                  Acesso operacional sem valores
                                </span>
                              </div>
                            </SelectItem>
                            <SelectItem value="financeiro">
                              <div className="flex flex-col items-start">
                                <span>Financeiro</span>
                                <span className="text-xs text-muted-foreground">
                                  Acesso completo às áreas financeiras
                                </span>
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex flex-col items-start">
                                <span>Administrador</span>
                                <span className="text-xs text-muted-foreground">
                                  Acesso completo ao sistema
                                </span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setCreateUserDialog(false)}
                          disabled={creatingUser}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          onClick={createEmployee}
                          disabled={creatingUser}
                        >
                          {creatingUser ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <UserPlus className="h-4 w-4 mr-2" />
                          )}
                          Criar Funcionário
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Os funcionários criados terão acesso ao sistema com nome de usuário e senha</p>
                <p>• Eles poderão fazer login com o usuário e senha fornecidos</p>
                <p>• Por padrão, funcionários têm papel de "funcionario" no sistema</p>
                <p>• As permissões podem ser ajustadas na aba "Permissões"</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Funcionários Cadastrados
              </CardTitle>
              <CardDescription>
                Lista de todos os funcionários cadastrados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEmployees ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {employees.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">
                      Nenhum funcionário cadastrado
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {employees.map((employee) => (
                        <div key={employee.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{employee.name}</p>
                              <p className="text-sm text-muted-foreground">
                                @{employee.username} • {
                                  employee.role === 'admin' ? 'Administrador' : 
                                  employee.role === 'financeiro' ? 'Financeiro' : 
                                  employee.role === 'deposito' ? 'Depósito' : 'Funcionário'
                                }
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={employee.is_active ? "default" : "secondary"}>
                              {employee.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                            <span className="text-sm text-muted-foreground hidden md:inline">
                              Criado em {new Date(employee.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            <Button variant="outline" size="sm" onClick={() => openEditEmployee(employee)}>
                              <Edit3 className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={user?.id === employee.id}
                              onClick={() => setEmployeeToDelete(employee)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Excluir
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Funcionários Online
              </CardTitle>
              <CardDescription>
                Veja quais funcionários estão conectados ao sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOnlineUsers ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {onlineUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground p-8">
                      Nenhum funcionário online no momento
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {onlineUsers.map((user) => (
                        <div key={user.user_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                            </div>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                            <span className="text-sm text-muted-foreground">
                              Online desde {new Date(user.online_at).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Permissões */}
        <TabsContent value="permissoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permissões dos Funcionários</CardTitle>
              <CardDescription>
                Configure o que os funcionários podem visualizar e editar no sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedPermissions).map(([category, permissions]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{category}</h3>
                    <Badge variant="outline">{permissions.length} permissões</Badge>
                  </div>
                  
                  <div className="grid gap-4">
                    {permissions
                      .filter(rp => rp.role === 'funcionario')
                      .map((rp) => (
                        <Card key={rp.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium">{rp.permission.description}</h4>
                              <p className="text-sm text-muted-foreground">
                                {rp.permission.name}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-6">
                              <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Visualizar</span>
                                <Switch
                                  checked={getCurrentValue(rp, 'can_view')}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(rp.id, 'can_view', checked)
                                  }
                                />
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Edit3 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">Editar</span>
                                <Switch
                                  checked={getCurrentValue(rp, 'can_edit')}
                                  onCheckedChange={(checked) => 
                                    handlePermissionChange(rp.id, 'can_edit', checked)
                                  }
                                  disabled={!getCurrentValue(rp, 'can_view')}
                                />
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                  
                  {category !== Object.keys(groupedPermissions)[Object.keys(groupedPermissions).length - 1] && (
                    <Separator />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Administradores sempre têm acesso total a todas as funcionalidades</p>
                <p>• Para editar, o funcionário precisa ter permissão de visualização</p>
                <p>• As alterações entram em vigor imediatamente após salvar</p>
                <p>• Funcionários precisam fazer logout/login para ver as novas permissões</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Logos */}
        <TabsContent value="logos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Gerenciar Logos
              </CardTitle>
              <CardDescription>
                Gerencie as logos da empresa utilizadas no sistema e impressões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="logo-upload" className="text-sm font-medium mb-2 block">
                  Enviar Nova Logo
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    disabled={uploadingLogo}
                    variant="outline"
                  >
                    {uploadingLogo ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Selecionar Arquivo
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Formatos aceitos: PNG, JPG, JPEG, GIF. Tamanho máximo: 5MB
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-medium mb-4">Logos Disponíveis</h3>
                {loadingLogos ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : logos.length === 0 ? (
                  <p className="text-center text-muted-foreground p-8">
                    Nenhuma logo encontrada. Envie uma logo acima.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {logos.map((logo) => (
                      <div key={logo.name} className="border rounded-lg p-4 space-y-3">
                        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                          <img
                            src={supabase.storage.from('logos').getPublicUrl(logo.name).data.publicUrl}
                            alt={logo.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium truncate">{logo.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(logo.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const url = supabase.storage.from('logos').getPublicUrl(logo.name).data.publicUrl;
                                navigator.clipboard.writeText(url);
                                toast({
                                  title: "URL copiada",
                                  description: "URL da logo copiada para a área de transferência.",
                                });
                              }}
                              className="flex-1"
                            >
                              Copiar URL
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteLogo(logo.name)}
                              className="text-red-600 hover:text-red-700" title="Excluir" aria-label="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• As logos enviadas ficam disponíveis publicamente</p>
                <p>• Para usar uma logo, copie a URL e atualize o código de impressão</p>
                <p>• Recomendamos logos em formato PNG com fundo transparente</p>
                <p>• As logos são exibidas automaticamente nos documentos impressos</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editar funcionário */}
      <Dialog open={!!editingEmployee} onOpenChange={(o) => !o && setEditingEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <Label>Usuário</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
            </div>
            <div>
              <Label>Nova senha (opcional)</Label>
              <div className="relative">
                <Input
                  type={showEditPassword ? 'text' : 'password'}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="pr-10"
                  placeholder="Deixe vazio para manter"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Função</Label>
              <Select value={editForm.role} onValueChange={(v: any) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="deposito">Depósito</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(c) => setEditForm({ ...editForm, is_active: c })}
                disabled={user?.id === editingEmployee?.id}
              />
              <Label>Usuário ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
              <Button onClick={handleUpdateEmployee} disabled={savingEdit}>
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir funcionário */}
      <AlertDialog open={!!employeeToDelete} onOpenChange={(o) => !o && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá permanentemente <strong>{employeeToDelete?.name}</strong> (@{employeeToDelete?.username}) do sistema. Ação irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingEmployee}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteEmployee(); }}
              disabled={deletingEmployee}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingEmployee ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
