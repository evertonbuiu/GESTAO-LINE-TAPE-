-- Criar trigger para atualizar automaticamente o campo updated_at na tabela company_settings

-- Primeiro, criar a função se não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Remover trigger se já existir
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;

-- Criar o trigger
CREATE TRIGGER update_company_settings_updated_at
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();