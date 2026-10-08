-- Create events/rentals table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  location TEXT,
  description TEXT,
  total_budget DECIMAL(10,2) DEFAULT 0,
  total_expenses DECIMAL(10,2) DEFAULT 0,
  profit_margin DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create expenses table for each event
CREATE TABLE public.event_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  supplier TEXT,
  notes TEXT,
  receipt_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Users can view events based on permissions"
ON public.events
FOR SELECT
USING (
  public.has_permission(auth.uid(), 'rentals_view', 'view')
);

CREATE POLICY "Users can manage events based on permissions"
ON public.events
FOR ALL
USING (
  public.has_permission(auth.uid(), 'rentals_edit', 'edit')
);

-- RLS Policies for event_expenses (only admins can see expenses)
CREATE POLICY "Admins can view all expenses"
ON public.event_expenses
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all expenses"
ON public.event_expenses
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Function to update event totals when expenses change
CREATE OR REPLACE FUNCTION public.update_event_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update total_expenses for the event
  UPDATE public.events
  SET 
    total_expenses = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.event_expenses
      WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    ),
    profit_margin = total_budget - (
      SELECT COALESCE(SUM(total_price), 0)
      FROM public.event_expenses
      WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update event totals
CREATE TRIGGER update_event_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_totals();

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_expenses_updated_at
  BEFORE UPDATE ON public.event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.events (name, client_name, client_email, client_phone, event_date, event_time, location, description, total_budget, status, created_by)
VALUES 
  ('Casamento Silva', 'João Silva', 'joao@email.com', '(11) 99999-9999', '2024-08-15', '18:00', 'Salão Nobre', 'Casamento com 200 convidados', 15000.00, 'confirmed', (SELECT id FROM auth.users LIMIT 1)),
  ('Festa Corporativa ABC', 'Maria Santos', 'maria@abc.com', '(11) 88888-8888', '2024-08-20', '19:00', 'Hotel Grand Plaza', 'Confraternização da empresa', 8000.00, 'in_progress', (SELECT id FROM auth.users LIMIT 1)),
  ('Aniversário Maria', 'Pedro Costa', 'pedro@email.com', '(11) 77777-7777', '2024-08-25', '20:00', 'Chácara Recanto', 'Aniversário de 50 anos', 5000.00, 'pending', (SELECT id FROM auth.users LIMIT 1));

-- Insert sample expenses
INSERT INTO public.event_expenses (event_id, category, description, quantity, unit_price, total_price, supplier, created_by)
VALUES 
  ((SELECT id FROM public.events WHERE name = 'Casamento Silva'), 'Iluminação', 'Refletores LED 200W', 10, 80.00, 800.00, 'Luz Equipamentos', (SELECT id FROM auth.users LIMIT 1)),
  ((SELECT id FROM public.events WHERE name = 'Casamento Silva'), 'Som', 'Mesa de Som 24 Canais', 1, 300.00, 300.00, 'Audio Pro', (SELECT id FROM auth.users LIMIT 1)),
  ((SELECT id FROM public.events WHERE name = 'Casamento Silva'), 'Estrutura', 'Truss Quadrada 3m', 8, 45.00, 360.00, 'Estruturas Tech', (SELECT id FROM auth.users LIMIT 1)),
  ((SELECT id FROM public.events WHERE name = 'Festa Corporativa ABC'), 'Iluminação', 'Canhão LED RGB', 6, 120.00, 720.00, 'Luz Equipamentos', (SELECT id FROM auth.users LIMIT 1)),
  ((SELECT id FROM public.events WHERE name = 'Festa Corporativa ABC'), 'Som', 'Caixas de Som Ativas', 4, 150.00, 600.00, 'Audio Pro', (SELECT id FROM auth.users LIMIT 1));