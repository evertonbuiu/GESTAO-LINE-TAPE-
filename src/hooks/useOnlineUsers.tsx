import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OnlineUser {
  user_id: string;
  name: string;
  role: string;
  online_at: string;
}

export const useOnlineUsers = () => {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const channel = supabase.channel('online-users');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            users.push(presence);
          });
        });
        
        setOnlineUsers(users);
        setLoading(false);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { onlineUsers, loading };
};