-- Tabela para armazenar mensagens do WhatsApp recebidas
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_phone TEXT NOT NULL,
  sender_name TEXT,
  message_content TEXT,
  message_type TEXT DEFAULT 'text', -- text, image, document
  attachment_url TEXT,
  attachment_type TEXT, -- image/jpeg, application/pdf, etc.
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  event_expense_id UUID REFERENCES public.event_expenses(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- pending, processed, linked, ignored
  matched_event_name TEXT,
  extracted_amount NUMERIC,
  extracted_description TEXT,
  processing_notes TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for all access
CREATE POLICY "Allow all access on whatsapp_messages" 
ON public.whatsapp_messages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_whatsapp_messages_updated_at
BEFORE UPDATE ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para busca
CREATE INDEX idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_event_id ON public.whatsapp_messages(event_id);
CREATE INDEX idx_whatsapp_messages_received_at ON public.whatsapp_messages(received_at DESC);