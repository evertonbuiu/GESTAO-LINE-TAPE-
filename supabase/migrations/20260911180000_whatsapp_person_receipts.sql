ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS person_type text,
  ADD COLUMN IF NOT EXISTS person_id uuid,
  ADD COLUMN IF NOT EXISTS person_name text;

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_person_type_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_person_type_check
  CHECK (person_type IS NULL OR person_type IN ('collaborator', 'worker'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_person
  ON public.whatsapp_messages(person_type, person_id);

