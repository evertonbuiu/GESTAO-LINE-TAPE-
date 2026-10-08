-- Aditivo, idempotente e restritivo. Sem DELETE, sem UPDATE de dados, sem backfill.

ALTER TABLE public.interstate_transports
  ADD COLUMN IF NOT EXISTS origin_city text,
  ADD COLUMN IF NOT EXISTS destination_state text,
  ADD COLUMN IF NOT EXISTS departure_time time without time zone,
  ADD COLUMN IF NOT EXISTS arrival_date date,
  ADD COLUMN IF NOT EXISTS arrival_time time without time zone,
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS distance_km numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS vehicle_capacity_kg numeric,
  ADD COLUMN IF NOT EXISTS driver_phone text,
  ADD COLUMN IF NOT EXISTS helpers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS fuel_consumption_kmpl numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fuel_cost_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS toll_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lodging_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meals_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_rate_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_path text,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interstate_transports_event_id_fkey'
  ) THEN
    ALTER TABLE public.interstate_transports
      ADD CONSTRAINT interstate_transports_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_interstate_transports_date
  ON public.interstate_transports (transport_date DESC);
CREATE INDEX IF NOT EXISTS idx_interstate_transports_event
  ON public.interstate_transports (event_id);
CREATE INDEX IF NOT EXISTS idx_interstate_transports_plate
  ON public.interstate_transports (vehicle_plate);
CREATE INDEX IF NOT EXISTS idx_interstate_transports_status
  ON public.interstate_transports (status);

CREATE OR REPLACE FUNCTION public.validate_interstate_transport()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IS NULL OR NEW.status NOT IN ('planned','in_transit','completed','cancelled') THEN
      RAISE EXCEPTION 'Status invalido: %. Use planned, in_transit, completed ou cancelled.', NEW.status;
    END IF;
  END IF;

  IF NEW.distance_km < 0 OR NEW.fuel_consumption_kmpl < 0
     OR (NEW.vehicle_capacity_kg IS NOT NULL AND NEW.vehicle_capacity_kg < 0) THEN
    RAISE EXCEPTION 'Quilometragem, consumo e capacidade nao podem ser negativos.';
  END IF;

  IF NEW.fuel_price_cents < 0 OR NEW.fuel_cost_cents < 0 OR NEW.toll_cents < 0
     OR NEW.lodging_cents < 0 OR NEW.meals_cents < 0 OR NEW.daily_rate_cents < 0
     OR NEW.maintenance_cents < 0 OR NEW.freight_cents < 0 OR NEW.advance_cents < 0
     OR NEW.extra_cents < 0 OR NEW.revenue_cents < 0 THEN
    RAISE EXCEPTION 'Valores monetarios nao podem ser negativos.';
  END IF;

  IF jsonb_typeof(NEW.legs) <> 'array' THEN
    RAISE EXCEPTION 'legs deve ser um array JSON.';
  END IF;
  IF jsonb_typeof(NEW.helpers) <> 'array' THEN
    RAISE EXCEPTION 'helpers deve ser um array JSON.';
  END IF;

  IF NEW.arrival_date IS NOT NULL AND NEW.arrival_date < NEW.transport_date THEN
    RAISE EXCEPTION 'A data de chegada nao pode ser anterior a data de saida.';
  END IF;
  IF NEW.expected_return_date IS NOT NULL AND NEW.expected_return_date < NEW.transport_date THEN
    RAISE EXCEPTION 'A data de retorno nao pode ser anterior a data de saida.';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_interstate_transport() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_interstate_transport() FROM anon;

DROP TRIGGER IF EXISTS trg_validate_interstate_transport ON public.interstate_transports;
CREATE TRIGGER trg_validate_interstate_transport
  BEFORE INSERT OR UPDATE ON public.interstate_transports
  FOR EACH ROW EXECUTE FUNCTION public.validate_interstate_transport();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interstate_transports TO authenticated;
GRANT ALL ON public.interstate_transports TO service_role;

DROP POLICY IF EXISTS interstate_receipts_select ON storage.objects;
CREATE POLICY interstate_receipts_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND name LIKE 'interstate-transports/%'
    AND (
      public.current_user_has_any_role(ARRAY['admin','financeiro'])
      OR owner = auth.uid()
      OR name LIKE 'interstate-transports/' || auth.uid()::text || '-%'
    )
  );

DROP POLICY IF EXISTS interstate_receipts_insert ON storage.objects;
CREATE POLICY interstate_receipts_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND name LIKE 'interstate-transports/%'
    AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
    AND (
      public.current_user_has_any_role(ARRAY['admin','financeiro'])
      OR (
        public.current_user_has_any_role(ARRAY['deposito','funcionario'])
        AND name LIKE 'interstate-transports/' || auth.uid()::text || '-%'
      )
    )
  );

DROP POLICY IF EXISTS interstate_receipts_update ON storage.objects;
CREATE POLICY interstate_receipts_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND name LIKE 'interstate-transports/%'
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND name LIKE 'interstate-transports/%'
    AND public.storage_path_is_safe(name, ARRAY['pdf','jpg','jpeg','png','webp'])
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
  );

DROP POLICY IF EXISTS interstate_receipts_delete ON storage.objects;
CREATE POLICY interstate_receipts_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND name LIKE 'interstate-transports/%'
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
  );