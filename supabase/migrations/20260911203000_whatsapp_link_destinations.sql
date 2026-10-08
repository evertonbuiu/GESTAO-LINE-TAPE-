ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS linked_record_type text,
  ADD COLUMN IF NOT EXISTS linked_record_id uuid;

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_link_destination_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_link_destination_check
  CHECK (
    link_destination IS NULL OR link_destination IN (
      'evento', 'galpao', 'collaborator', 'worker', 'fixed_expense', 'personal_expense'
    )
  );

