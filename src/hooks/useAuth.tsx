import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'admin' | 'funcionario' | 'financeiro' | 'deposito' | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasPermission: (permissionName: string, accessType?: 'view' | 'edit') => Promise<boolean>;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'funcionario' | 'financeiro' | 'deposito' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [presenceChannel, setPresenceChannel] = useState<any>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          // Cleanup presence channel on logout
          if (presenceChannel) {
            presenceChannel.unsubscribe();
            setPresenceChannel(null);
          }
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return;
      }
      
      setUserRole(data?.role || 'funcionario');
      
      // Setup presence tracking after getting role
      setTimeout(() => {
        setupPresence(userId, data?.role || 'funcionario');
      }, 0);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('funcionario');
    }
  };

  const setupPresence = async (userId: string, role: string) => {
    try {
      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', userId)
        .single();

      const channel = supabase.channel('online-users');
      
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            name: profile?.name || 'Usuário',
            role: role,
            online_at: new Date().toISOString()
          });
        }
      });
      
      setPresenceChannel(channel);
    } catch (error) {
      console.error('Error setting up presence:', error);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name,
          }
        }
      });
      
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Cleanup presence channel before signing out
      if (presenceChannel) {
        presenceChannel.unsubscribe();
        setPresenceChannel(null);
      }
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setUserRole(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Refresh user role
  const refreshUserRole = async () => {
    if (!user) return;
    await fetchUserRole(user.id);
  };

  // Check if user has specific permission
  const hasPermission = async (permissionName: string, accessType: 'view' | 'edit' = 'view') => {
    if (!user) return false;
    
    // Admins have all permissions
    if (userRole === 'admin') return true;
    
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userRole,
      isLoading,
      signIn,
      signUp,
      signOut,
      hasPermission,
      refreshUserRole
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};