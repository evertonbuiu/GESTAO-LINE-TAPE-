-- Verificar se existe trigger de updated_at para company_settings
-- Se não existir, criar
DO $$ 
BEGIN
    -- Verificar se o trigger existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_company_settings_updated_at'
    ) THEN
        -- Criar o trigger se não existir
        CREATE TRIGGER update_company_settings_updated_at
        BEFORE UPDATE ON public.company_settings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Forçar atualização do updated_at para refletir mudanças
UPDATE public.company_settings 
SET updated_at = now() 
WHERE id = 'ac370067-98af-4204-ac10-b571079234af';