-- Dados do evento na NFS-e (serviços do item 12 da lista: diversão,
-- lazer e entretenimento). Mesmos campos do NotaGoiânia.
ALTER TABLE "nfse_invoices" ADD COLUMN "event_start_date" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_end_date" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_code" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_description" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_cep" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_street" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_number" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_district" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_complement" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_state" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_city" TEXT;
ALTER TABLE "nfse_invoices" ADD COLUMN "event_city_code" TEXT;
