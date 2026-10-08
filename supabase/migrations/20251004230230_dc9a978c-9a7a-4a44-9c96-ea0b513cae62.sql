-- Criar tabela para controle de diárias
CREATE TABLE public.daily_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  date DATE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.daily_rates ENABLE ROW LEVEL SECURITY;

-- Política de acesso - usuários autenticados podem ver e gerenciar
CREATE POLICY "Allow all access to daily rates" 
ON public.daily_rates 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_daily_rates_updated_at
  BEFORE UPDATE ON public.daily_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para melhor performance
CREATE INDEX idx_daily_rates_date ON public.daily_rates(date);
CREATE INDEX idx_daily_rates_event_id ON public.daily_rates(event_id);
CREATE INDEX idx_daily_rates_worker_name ON public.daily_rates(worker_name);