import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeLineTapeBrand } from "@/lib/brand";

interface CompanySettings {
  id: string;
  company_name: string;
  tagline: string;
  address?: string;
  phone?: string;
  email?: string;
  cnpj?: string;
  website?: string;
}

export const useCompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching company settings...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        console.log('Company settings loaded:', data);
        setSettings({
          ...data,
          company_name: normalizeLineTapeBrand(data.company_name) || 'LINE TAPE',
        });
      } else {
        console.log('No company settings found');
        setSettings(null);
      }
    } catch (error) {
      console.error('Error fetching company settings:', error);
      // Se houver erro, manter null e deixar o componente lidar com isso
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (companyName: string, tagline: string) => {
    try {
      // Verificar se já existe uma configuração
      const { data: existing, error: fetchError } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        // Atualizar existente
        const { error } = await supabase
          .from('company_settings')
          .update({
            company_name: normalizeLineTapeBrand(companyName) || 'LINE TAPE',
            tagline: tagline
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Criar novo
        const { error } = await supabase
          .from('company_settings')
          .insert({
            company_name: normalizeLineTapeBrand(companyName) || 'LINE TAPE',
            tagline: tagline
          });

        if (error) throw error;
      }

      await fetchSettings();
      return true;
    } catch (error) {
      console.error('Error updating company settings:', error);
      return false;
    }
  };

  const updateCompanyData = async (data: Partial<CompanySettings>) => {
    try {
      const normalizedData = data.company_name
        ? { ...data, company_name: normalizeLineTapeBrand(data.company_name) || 'LINE TAPE' }
        : data;
      console.log('Updating company data with:', data);
      
      // Verificar se já existe uma configuração
      const { data: existing, error: fetchError } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        console.log('Updating existing company settings:', existing.id);
        console.log('Data to update:', data);
        
        // Atualizar existente
        const { error } = await supabase
          .from('company_settings')
          .update(normalizedData)
          .eq('id', existing.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        console.log('Company settings updated successfully');
        
        // Aguardar um momento antes de buscar dados atualizados
        setTimeout(() => {
          fetchSettings();
        }, 500);
      } else {
        console.log('Creating new company settings');
        // Criar novo e retornar os dados criados
        const { data: newData, error } = await supabase
          .from('company_settings')
          .insert({
            company_name: normalizedData.company_name || 'GESTAO LINE TAPE',
            tagline: normalizedData.tagline || 'Controle de Estoque',
            ...normalizedData
          })
          .select()
          .single();

        if (error) throw error;
        
        console.log('Company settings created successfully:', newData);
        setSettings(newData);
      }

      return true;
    } catch (error) {
      console.error('Error updating company data:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, isLoading, updateSettings, updateCompanyData, refreshSettings: fetchSettings };
};
