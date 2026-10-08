-- Criar trigger para atualizar estoque de equipamentos automaticamente
-- quando equipamentos são adicionados/removidos/editados em eventos

-- Primeiro, vamos criar um trigger para a tabela event_equipment
CREATE OR REPLACE TRIGGER trigger_update_equipment_stock
    AFTER INSERT OR UPDATE OR DELETE ON public.event_equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_stock();

-- Também vamos criar um trigger para equipamentos em manutenção
CREATE OR REPLACE TRIGGER trigger_update_equipment_maintenance
    AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_records
    FOR EACH ROW
    EXECUTE FUNCTION public.update_equipment_with_maintenance();

-- Vamos também garantir que o trigger de timestamp funciona
CREATE OR REPLACE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON public.equipment
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();