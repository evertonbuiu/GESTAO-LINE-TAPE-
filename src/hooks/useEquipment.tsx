import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Equipment {
  id: string;
  name: string;
  category: string;
  total_stock: number;
  available: number;
  rented: number;
  price_per_day: number;
  status: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export const useEquipment = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEquipment = async (force = false) => {
    if (force) setLoading(true);
    try {
      console.log('Fetching equipment data...');
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .order('name');

      if (error) throw error;
      setEquipment(data || []);
      console.log('Equipment data loaded:', data?.length, 'items');
    } catch (error) {
      console.error('Error fetching equipment:', error);
      toast({
        title: "Erro ao carregar equipamentos",
        description: "Não foi possível carregar os equipamentos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipment();

    // Set up real-time subscription for equipment changes
    const equipmentChannel = supabase
      .channel('equipment-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'equipment'
        },
        (payload) => {
          console.log('Equipment change detected:', payload);
          // Force a refresh when equipment data changes
          setTimeout(() => fetchEquipment(true), 100);
        }
      )
      .subscribe();

    // Also listen for event_equipment changes to update stock
    const eventEquipmentChannel = supabase
      .channel('event-equipment-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_equipment'
        },
        (payload) => {
          console.log('Event equipment change detected:', payload);
          // Force a refresh after a brief delay to allow triggers to complete
          setTimeout(() => fetchEquipment(true), 200);
        }
      )
      .subscribe();

    // Listen for event changes that might affect equipment status
    const eventsChannel = supabase
      .channel('events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events'
        },
        (payload) => {
          console.log('Event status change detected:', payload);
          // Refresh equipment when event status changes (may affect equipment availability)
          setTimeout(() => fetchEquipment(true), 300);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(equipmentChannel);
      supabase.removeChannel(eventEquipmentChannel);
      supabase.removeChannel(eventsChannel);
    };
  }, []);

  // Calculate totals for inventory dashboard
  const totals = {
    totalItems: equipment.reduce((sum, item) => sum + item.total_stock, 0),
    criticalItems: equipment.filter(item => item.status === 'out_of_stock' || item.status === 'low_stock').length,
    totalValue: equipment.reduce((sum, item) => sum + (item.total_stock * item.price_per_day), 0)
  };

  return {
    equipment,
    loading,
    totals,
    fetchEquipment
  };
};