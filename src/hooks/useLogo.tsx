import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useLogo = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActiveLogo = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('logos')
        .list('', { 
          limit: 1,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      if (data && data.length > 0) {
        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(data[0].name);
        
        setLogoUrl(urlData.publicUrl);
      } else {
        setLogoUrl(null);
      }
    } catch (error) {
      console.error('Error fetching logo:', error);
      setLogoUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveLogo();
  }, []);

  return { logoUrl, isLoading, refreshLogo: fetchActiveLogo };
};