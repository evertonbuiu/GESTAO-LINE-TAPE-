import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from './useCustomAuth';
import { toast } from 'sonner';

export interface SavedSignature {
  id: string;
  name: string;
  signature_data: string;
  signature_type: 'company' | 'client';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useSavedSignatures(signatureType: 'company' | 'client' = 'company') {
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useCustomAuth();

  const fetchSignatures = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_signatures')
        .select('*')
        .eq('signature_type', signatureType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSignatures((data || []) as SavedSignature[]);
    } catch (error) {
      console.error('Erro ao carregar assinaturas:', error);
      toast.error('Erro ao carregar assinaturas salvas');
    } finally {
      setLoading(false);
    }
  };

  const saveSignature = async (name: string, signatureData: string) => {
    if (!user || !signatureData) {
      toast.error('Dados inválidos para salvar assinatura');
      return false;
    }

    try {
      const { error } = await supabase
        .from('saved_signatures')
        .insert({
          name,
          signature_data: signatureData,
          signature_type: signatureType,
          created_by: user.id
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('Já existe uma assinatura com este nome');
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Assinatura salva com sucesso!');
      await fetchSignatures(); // Recarregar lista
      return true;
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
      toast.error('Erro ao salvar assinatura');
      return false;
    }
  };

  const deleteSignature = async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_signatures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Assinatura removida');
      await fetchSignatures(); // Recarregar lista
      return true;
    } catch (error) {
      console.error('Erro ao remover assinatura:', error);
      toast.error('Erro ao remover assinatura');
      return false;
    }
  };

  const updateSignature = async (id: string, name: string, signatureData?: string) => {
    try {
      const updateData: any = { name, updated_at: new Date().toISOString() };
      if (signatureData) {
        updateData.signature_data = signatureData;
      }

      const { error } = await supabase
        .from('saved_signatures')
        .update(updateData)
        .eq('id', id);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          toast.error('Já existe uma assinatura com este nome');
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Assinatura atualizada');
      await fetchSignatures(); // Recarregar lista
      return true;
    } catch (error) {
      console.error('Erro ao atualizar assinatura:', error);
      toast.error('Erro ao atualizar assinatura');
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      fetchSignatures();
    }
  }, [user, signatureType]);

  return {
    signatures,
    loading,
    saveSignature,
    deleteSignature,
    updateSignature,
    refetch: fetchSignatures
  };
}