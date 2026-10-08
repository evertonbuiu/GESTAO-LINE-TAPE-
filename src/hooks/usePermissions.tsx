import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from './useCustomAuth';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermission {
  id: string;
  role: 'admin' | 'funcionario' | 'financeiro' | 'deposito';
  permission_id: string;
  can_view: boolean;
  can_edit: boolean;
  permission: Permission;
}

export const usePermissions = () => {
  const { user, userRole } = useCustomAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userPermissions, setUserPermissions] = useState<Record<string, { view: boolean; edit: boolean }>>({});
  const [loading, setLoading] = useState(true);

  // Fetch all permissions
  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  // Fetch role permissions
  const fetchRolePermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          *,
          permission:permissions(*)
        `)
        .order('role', { ascending: true });

      if (error) throw error;
      setRolePermissions(data || []);
    } catch (error) {
      console.error('Error fetching role permissions:', error);
    }
  };

  // Update role permission
  const updateRolePermission = async (
    rolePermissionId: string,
    can_view: boolean,
    can_edit: boolean
  ) => {
    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ can_view, can_edit })
        .eq('id', rolePermissionId);

      if (error) throw error;
      
      // Refresh data
      await fetchRolePermissions();
      return { success: true };
    } catch (error) {
      console.error('Error updating role permission:', error);
      return { success: false, error };
    }
  };

  // Fetch user permissions
  const fetchUserPermissions = async () => {
    if (!user || !userRole) return;
    
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select(`
          can_view,
          can_edit,
          permission:permissions(name)
        `)
        .eq('role', userRole);

      if (error) throw error;
      
      const permissionsMap: Record<string, { view: boolean; edit: boolean }> = {};
      data?.forEach((rp: any) => {
        const permission = Array.isArray(rp.permission) ? rp.permission[0] : rp.permission;
        if (permission?.name) {
          permissionsMap[permission.name] = {
            view: rp.can_view,
            edit: rp.can_edit
          };
        }
      });
      
      setUserPermissions(permissionsMap);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  // Check if user has specific permission - função síncrona
  const hasPermission = (permissionName: string, accessType: 'view' | 'edit' = 'view') => {
    if (!userPermissions[permissionName]) return false;
    return accessType === 'edit' 
      ? userPermissions[permissionName].edit 
      : userPermissions[permissionName].view;
  };

  // Check if user has specific permission - usando useCustomAuth diretamente (versão assíncrona)
  const hasPermissionAsync = async (permissionName: string, accessType: 'view' | 'edit' = 'view') => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('has_permission', {
          _user_id: user.id,
          _permission_name: permissionName,
          _access_type: accessType
        });

      if (error) throw error;
      return data || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (userRole === 'admin') {
        await Promise.all([fetchPermissions(), fetchRolePermissions(), fetchUserPermissions()]);
      } else {
        await fetchUserPermissions();
      }
      setLoading(false);
    };

    if (user && userRole) {
      loadData();
    }
  }, [user, userRole]);

  return {
    permissions,
    rolePermissions,
    userPermissions,
    loading,
    updateRolePermission,
    hasPermission,
    hasPermissionAsync,
    fetchPermissions,
    fetchRolePermissions,
    fetchUserPermissions
  };
};