-- Criar tabela para manutenções
CREATE TABLE public.maintenance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL,
  equipment_name TEXT NOT NULL,
  maintenance_type TEXT NOT NULL CHECK (maintenance_type IN ('preventiva', 'corretiva', 'emergencial')),
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'em_andamento', 'concluida', 'cancelada')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa', 'normal', 'alta', 'critica')),
  scheduled_date DATE NOT NULL,
  completed_date DATE,
  description TEXT NOT NULL,
  problem_description TEXT,
  solution_description TEXT,
  cost DECIMAL(10,2) DEFAULT 0.00,
  technician_name TEXT,
  technician_contact TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;

-- Criar políticas
CREATE POLICY "Users can view maintenance records" 
ON public.maintenance_records 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert maintenance records" 
ON public.maintenance_records 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update maintenance records" 
ON public.maintenance_records 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete maintenance records" 
ON public.maintenance_records 
FOR DELETE 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_maintenance_records_updated_at
BEFORE UPDATE ON public.maintenance_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_maintenance_records_equipment_id ON public.maintenance_records(equipment_id);
CREATE INDEX idx_maintenance_records_status ON public.maintenance_records(status);
CREATE INDEX idx_maintenance_records_scheduled_date ON public.maintenance_records(scheduled_date);
CREATE INDEX idx_maintenance_records_maintenance_type ON public.maintenance_records(maintenance_type);