import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/hooks/useCustomAuth';

interface CreateEmployeeProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const CreateEmployee = ({ onSuccess, onCancel }: CreateEmployeeProps) => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'funcionario' as 'admin' | 'funcionario' | 'financeiro' | 'deposito'
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useCustomAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Call the edge function to create employee
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          username: formData.username,
          password: formData.password,
          name: formData.name,
          role: formData.role
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Funcionário criado com sucesso",
        description: `${formData.name} foi adicionado como ${getRoleLabel(formData.role)}.`,
      });

      // Reset form
      setFormData({
        username: '',
        password: '',
        name: '',
        role: 'funcionario'
      });

      onSuccess?.();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast({
        title: "Erro ao criar funcionário",
        description: error.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'financeiro':
        return 'Financeiro';
      case 'funcionario':
        return 'Funcionário';
      case 'deposito':
        return 'Depósito';
      default:
        return role;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Acesso completo a todas as funcionalidades do sistema';
      case 'financeiro':
        return 'Acesso completo às áreas financeiras e visualização de eventos/equipamentos';
      case 'funcionario':
        return 'Acesso básico conforme permissões configuradas';
      case 'deposito':
        return 'Acesso operacional sem visualização de valores monetários';
      default:
        return '';
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Criar Novo Funcionário</CardTitle>
        <CardDescription>
          Adicione um novo usuário ao sistema com o nível de acesso apropriado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="João Silva"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Nome de Usuário</Label>
            <Input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="joao.silva"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Nível de Acesso</Label>
            <Select
              value={formData.role}
              onValueChange={(value: 'admin' | 'funcionario' | 'financeiro' | 'deposito') => 
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="funcionario">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Funcionário</span>
                    <span className="text-xs text-muted-foreground">
                      Acesso básico conforme permissões
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="deposito">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Depósito</span>
                    <span className="text-xs text-muted-foreground">
                      Acesso operacional sem valores
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="financeiro">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Financeiro</span>
                    <span className="text-xs text-muted-foreground">
                      Acesso completo às áreas financeiras
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span className="font-medium">Administrador</span>
                    <span className="text-xs text-muted-foreground">
                      Acesso completo ao sistema
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {getRoleDescription(formData.role)}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Criando...' : 'Criar Funcionário'}
            </Button>
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};