-- Create equipment table for storing equipment catalog
CREATE TABLE public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  total_stock integer NOT NULL DEFAULT 0,
  available integer NOT NULL DEFAULT 0,
  rented integer NOT NULL DEFAULT 0,
  price_per_day numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

-- Create policies for equipment
CREATE POLICY "Users can view equipment"
ON public.equipment
FOR SELECT
USING (has_permission(auth.uid(), 'inventory_view', 'view'));

CREATE POLICY "Users can manage equipment"
ON public.equipment
FOR ALL
USING (has_permission(auth.uid(), 'inventory_edit', 'edit'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_equipment_updated_at
BEFORE UPDATE ON public.equipment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample equipment data
INSERT INTO public.equipment (name, category, total_stock, available, rented, price_per_day, status, description) VALUES
('Refletor LED 200W', 'Iluminação', 25, 18, 7, 45.00, 'available', 'Refletor LED de alta potência para iluminação de eventos'),
('Mesa de Som 24 Canais', 'Áudio', 8, 5, 3, 120.00, 'available', 'Mesa de som profissional com 24 canais'),
('Microfone Sem Fio', 'Áudio', 20, 2, 18, 25.00, 'low_stock', 'Microfone sem fio profissional'),
('Caixa de Som Ativa 500W', 'Áudio', 15, 12, 3, 80.00, 'available', 'Caixa de som ativa de alta potência'),
('Truss Quadrada 3m', 'Estrutura', 30, 22, 8, 15.00, 'available', 'Estrutura metálica quadrada para montagem'),
('Refletor LED 500W', 'Iluminação', 10, 8, 2, 75.00, 'available', 'Refletor LED de alta potência'),
('Cabo XLR 10m', 'Áudio', 50, 45, 5, 5.00, 'available', 'Cabo XLR balanceado para áudio profissional'),
('Tripé para Refletor', 'Estrutura', 20, 15, 5, 10.00, 'available', 'Tripé ajustável para refletores'),
('Projetor 4K', 'Audiovisual', 5, 3, 2, 200.00, 'available', 'Projetor 4K para apresentações'),
('Tela de Projeção 3x2m', 'Audiovisual', 8, 6, 2, 50.00, 'available', 'Tela de projeção retrátil');