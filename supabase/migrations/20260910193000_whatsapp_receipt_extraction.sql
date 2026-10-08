ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS extracted_date date,
  ADD COLUMN IF NOT EXISTS extracted_time time,
  ADD COLUMN IF NOT EXISTS extracted_name text,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric,
  ADD COLUMN IF NOT EXISTS company_expense_id uuid REFERENCES public.company_expenses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_destination text;

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_extraction_status_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_extraction_status_check
  CHECK (extraction_status IN ('not_applicable', 'processing', 'completed', 'failed'));

ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_link_destination_check;
ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_link_destination_check
  CHECK (link_destination IS NULL OR link_destination IN ('evento', 'galpao'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-receipts',
  'whatsapp-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS whatsapp_receipts_select_finance ON storage.objects;
CREATE POLICY whatsapp_receipts_select_finance
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp-receipts'
  AND public.current_user_has_any_role(ARRAY['admin', 'financeiro'])
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_extraction_status
  ON public.whatsapp_messages(extraction_status);
