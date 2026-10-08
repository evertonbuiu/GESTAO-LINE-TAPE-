import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Autenticação agora usa Supabase Auth nativo (Fase 1 da migração de segurança).
// A interface pública deste hook foi preservada para não quebrar os demais
// componentes que dependem de useCustomAuth. Internamente:
//   - "username" é convertido em email sintético: <username>@linetape.local
//   - A sessão é gerenciada pelo Supabase Auth (JWT em localStorage)
//   - user.id continua sendo o mesmo UUID de antes (preservado na migração)

interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'funcionario' | 'financeiro' | 'deposito';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: 'admin' | 'funcionario' | 'financeiro' | 'deposito' | null;
  hasPermission: (permissionName: string, accessType?: 'view' | 'edit') => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@linetape.local`;

const emailToUsername = (email: string | undefined | null) =>
  (email ?? '').replace(/@linetape\.local$/i, '');

async function buildUserFromSession(sessionUserId: string, fallbackEmail?: string | null): Promise<User | null> {
  // Buscar dados adicionais em user_credentials + user_roles
  const [credRes, roleRes] = await Promise.all([
    supabase.from('user_credentials').select('username, name').eq('id', sessionUserId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', sessionUserId).maybeSingle(),
  ]);

  const username = credRes.data?.username ?? emailToUsername(fallbackEmail);
  const name = credRes.data?.name ?? username;
  const role = (roleRes.data?.role as User['role']) ?? 'funcionario';

  return {
    id: sessionUserId,
    username,
    name,
    role,
  };
}

export const CustomAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listener PRIMEIRO (evita perder eventos)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        if (mounted) setUser(null);
        return;
      }
      // Buscar metadados fora do callback para evitar deadlocks
      setTimeout(async () => {
        const u = await buildUserFromSession(session.user.id, session.user.email);
        if (mounted) setUser(u);
      }, 0);
    });

    // Depois checa sessão existente
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const u = await buildUserFromSession(session.user.id, session.user.email);
        if (mounted) setUser(u);
      }
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Erro na autenticação:', error);
        return { error: { message: 'Credenciais inválidas' } };
      }

      if (!data.user) {
        return { error: { message: 'Credenciais inválidas' } };
      }

      // user state será populado pelo onAuthStateChange
      return { error: null };
    } catch (error) {
      console.error('Erro no processo de login:', error);
      return { error: { message: 'Erro ao fazer login' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Limpar chave legada, se ainda existir de sessões antigas
    localStorage.removeItem('custom_auth_user');
  };

  const hasPermission = async (permissionName: string, accessType: 'view' | 'edit' = 'view') => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.rpc('has_permission', {
        _user_id: user.id,
        _permission_name: permissionName,
        _access_type: accessType,
      });
      if (error) {
        console.error('Error checking permission:', error);
        return false;
      }
      return data || false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  };

  const value = {
    user,
    isLoading,
    signIn,
    signOut,
    userRole: user?.role || null,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useCustomAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useCustomAuth must be used within a CustomAuthProvider');
  }
  return context;
};
