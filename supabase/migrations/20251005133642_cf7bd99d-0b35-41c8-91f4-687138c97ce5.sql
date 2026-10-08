-- Create table for collaborator event payments
CREATE TABLE IF NOT EXISTS public.collaborator_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborator_payments ENABLE ROW LEVEL SECURITY;

-- Create policy for all access
CREATE POLICY "Allow all access to collaborator payments"
  ON public.collaborator_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_collaborator_payments_collaborator_id ON public.collaborator_payments(collaborator_id);
CREATE INDEX idx_collaborator_payments_event_id ON public.collaborator_payments(event_id);
CREATE INDEX idx_collaborator_payments_payment_date ON public.collaborator_payments(payment_date);

-- Create table for collaborator advances (similar to worker_advances)
CREATE TABLE IF NOT EXISTS public.collaborator_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collaborator_id UUID NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborator_advances ENABLE ROW LEVEL SECURITY;

-- Create policy for all access
CREATE POLICY "Allow all access to collaborator advances"
  ON public.collaborator_advances
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_collaborator_advances_collaborator_id ON public.collaborator_advances(collaborator_id);
CREATE INDEX idx_collaborator_advances_advance_date ON public.collaborator_advances(advance_date);