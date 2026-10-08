
-- =========================================================
-- Documentos Fiscais de Transporte (NF-e 55 / CT-e 57 / MDF-e 58)
-- Aditivo, restritivo e idempotente. Sem DELETE, sem backfill.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.fiscal_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '55',
  environment TEXT NOT NULL DEFAULT 'homologacao',
  operation_nature TEXT,
  purpose TEXT,
  default_cfop TEXT,
  default_cst TEXT,
  default_csosn TEXT,
  default_ncm TEXT,
  default_unit TEXT NOT NULL DEFAULT 'UN',
  icms_rate NUMERIC(6,4),
  ipi_rate NUMERIC(6,4),
  tax_regime TEXT,
  emitter JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  accountant_confirmed BOOLEAN NOT NULL DEFAULT false,
  accountant_confirmed_by UUID,
  accountant_confirmed_at TIMESTAMPTZ,
  accountant_name TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_profiles_model_chk CHECK (model IN ('55','57','58')),
  CONSTRAINT fiscal_profiles_env_chk CHECK (environment IN ('homologacao','producao')),
  CONSTRAINT fiscal_profiles_rates_chk CHECK (
    COALESCE(icms_rate, 0) >= 0 AND COALESCE(icms_rate, 0) <= 100
    AND COALESCE(ipi_rate, 0) >= 0 AND COALESCE(ipi_rate, 0) <= 100
  ),
  CONSTRAINT fiscal_profiles_emitter_chk CHECK (jsonb_typeof(emitter) = 'object')
);

CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.fiscal_profiles(id),
  transport_id UUID REFERENCES public.interstate_transports(id) ON DELETE SET NULL,
  event_id UUID,
  model TEXT NOT NULL DEFAULT '55',
  series TEXT NOT NULL DEFAULT '1',
  number TEXT,
  purpose TEXT NOT NULL DEFAULT 'remessa',
  operation_nature TEXT,
  environment TEXT NOT NULL DEFAULT 'homologacao',
  status TEXT NOT NULL DEFAULT 'rascunho',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  emitter JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
  vehicle JSONB NOT NULL DEFAULT '{}'::jsonb,
  driver JSONB NOT NULL DEFAULT '{}'::jsonb,
  route_states TEXT[] NOT NULL DEFAULT '{}',
  referenced_keys TEXT[] NOT NULL DEFAULT '{}',
  return_of_document_id UUID REFERENCES public.fiscal_documents(id),
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_products_cents BIGINT NOT NULL DEFAULT 0,
  total_document_cents BIGINT NOT NULL DEFAULT 0,
  access_key TEXT,
  protocol_number TEXT,
  protocol_date TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ,
  authorization_source TEXT,
  receipt_number TEXT,
  xml_path TEXT,
  xml_sha256 TEXT,
  pdf_path TEXT,
  rejection_code TEXT,
  rejection_message TEXT,
  source TEXT NOT NULL DEFAULT 'internal',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_documents_model_chk CHECK (model IN ('55','57','58')),
  CONSTRAINT fiscal_documents_env_chk CHECK (environment IN ('homologacao','producao')),
  CONSTRAINT fiscal_documents_status_chk CHECK (status IN (
    'rascunho','validado','aguardando_assinatura','enviado','autorizado','rejeitado','cancelado','encerrado'
  )),
  CONSTRAINT fiscal_documents_purpose_chk CHECK (purpose IN ('remessa','retorno','prestacao_servico','manifesto','outro')),
  CONSTRAINT fiscal_documents_source_chk CHECK (source IN ('internal','external_import')),
  CONSTRAINT fiscal_documents_auth_source_chk CHECK (
    authorization_source IS NULL OR authorization_source IN ('sefaz_provider','external_import')
  ),
  CONSTRAINT fiscal_documents_totals_chk CHECK (
    total_products_cents >= 0 AND total_document_cents >= 0
    AND jsonb_typeof(totals) = 'object'
    AND jsonb_typeof(emitter) = 'object' AND jsonb_typeof(recipient) = 'object'
    AND jsonb_typeof(delivery) = 'object' AND jsonb_typeof(vehicle) = 'object'
    AND jsonb_typeof(driver) = 'object'
  ),
  CONSTRAINT fiscal_documents_access_key_chk CHECK (access_key IS NULL OR access_key ~ '^[0-9]{44}$'),
  CONSTRAINT fiscal_documents_xml_sha_chk CHECK (xml_sha256 IS NULL OR xml_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fiscal_documents_refkeys_chk CHECK (
    array_to_string(referenced_keys, ',') ~ '^([0-9]{44}(,[0-9]{44})*)?$'
  ),
  CONSTRAINT fiscal_documents_route_chk CHECK (
    array_to_string(route_states, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'
  ),
  CONSTRAINT fiscal_documents_series_chk CHECK (series ~ '^[0-9]{1,3}$'),
  CONSTRAINT fiscal_documents_number_chk CHECK (number IS NULL OR number ~ '^[0-9]{1,9}$')
);

CREATE TABLE IF NOT EXISTS public.fiscal_document_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  unit TEXT NOT NULL DEFAULT 'UN',
  quantity NUMERIC(14,4) NOT NULL DEFAULT 1,
  unit_value_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  cst TEXT,
  csosn TEXT,
  icms_rate NUMERIC(6,4),
  ipi_rate NUMERIC(6,4),
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_items_values_chk CHECK (
    sequence > 0 AND quantity > 0 AND unit_value_cents >= 0 AND total_cents >= 0
  ),
  CONSTRAINT fiscal_items_ncm_chk CHECK (ncm IS NULL OR ncm ~ '^[0-9]{8}$'),
  CONSTRAINT fiscal_items_cfop_chk CHECK (cfop IS NULL OR cfop ~ '^[0-9]{4}$'),
  CONSTRAINT fiscal_items_extra_chk CHECK (jsonb_typeof(extra) = 'object')
);

CREATE TABLE IF NOT EXISTS public.fiscal_document_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.fiscal_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_id UUID,
  actor_name TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_events_payload_chk CHECK (jsonb_typeof(payload) = 'object')
);

-- Idempotência / anti-duplicidade
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_access_key_uidx
  ON public.fiscal_documents (access_key) WHERE access_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_numbering_uidx
  ON public.fiscal_documents (model, series, number, environment) WHERE number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_document_items_seq_uidx
  ON public.fiscal_document_items (document_id, sequence);
CREATE INDEX IF NOT EXISTS fiscal_documents_transport_idx ON public.fiscal_documents (transport_id);
CREATE INDEX IF NOT EXISTS fiscal_documents_status_idx ON public.fiscal_documents (status);
CREATE INDEX IF NOT EXISTS fiscal_document_events_doc_idx ON public.fiscal_document_events (document_id);

-- Grants (nunca anon)
REVOKE ALL ON public.fiscal_profiles FROM PUBLIC, anon;
REVOKE ALL ON public.fiscal_documents FROM PUBLIC, anon;
REVOKE ALL ON public.fiscal_document_items FROM PUBLIC, anon;
REVOKE ALL ON public.fiscal_document_events FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_profiles TO authenticated;
GRANT ALL ON public.fiscal_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.fiscal_documents TO authenticated;
GRANT ALL ON public.fiscal_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_document_items TO authenticated;
GRANT ALL ON public.fiscal_document_items TO service_role;
GRANT SELECT ON public.fiscal_document_events TO authenticated;
GRANT ALL ON public.fiscal_document_events TO service_role;

ALTER TABLE public.fiscal_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_document_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_document_events ENABLE ROW LEVEL SECURITY;

-- fiscal_profiles
DROP POLICY IF EXISTS fiscal_profiles_manage ON public.fiscal_profiles;
CREATE POLICY fiscal_profiles_manage ON public.fiscal_profiles
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP POLICY IF EXISTS fiscal_profiles_read_basic ON public.fiscal_profiles;
CREATE POLICY fiscal_profiles_read_basic ON public.fiscal_profiles
  FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro','deposito','funcionario']));

-- fiscal_documents
DROP POLICY IF EXISTS fiscal_documents_manage ON public.fiscal_documents;
CREATE POLICY fiscal_documents_manage ON public.fiscal_documents
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP POLICY IF EXISTS fiscal_documents_read_own ON public.fiscal_documents;
CREATE POLICY fiscal_documents_read_own ON public.fiscal_documents
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

-- itens
DROP POLICY IF EXISTS fiscal_document_items_manage ON public.fiscal_document_items;
CREATE POLICY fiscal_document_items_manage ON public.fiscal_document_items
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP POLICY IF EXISTS fiscal_document_items_read_own ON public.fiscal_document_items;
CREATE POLICY fiscal_document_items_read_own ON public.fiscal_document_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fiscal_documents d
    WHERE d.id = fiscal_document_items.document_id AND d.created_by = auth.uid()
  ));

-- eventos: append-only pelo trigger (SECURITY DEFINER); cliente só lê
DROP POLICY IF EXISTS fiscal_document_events_insert ON public.fiscal_document_events;
DROP POLICY IF EXISTS fiscal_document_events_read ON public.fiscal_document_events;
CREATE POLICY fiscal_document_events_read ON public.fiscal_document_events
  FOR SELECT TO authenticated
  USING (
    public.current_user_has_any_role(ARRAY['admin','financeiro'])
    OR EXISTS (
      SELECT 1 FROM public.fiscal_documents d
      WHERE d.id = fiscal_document_events.document_id AND d.created_by = auth.uid()
    )
  );

-- Trilha obrigatória: sem EXCEPTION WHEN OTHERS. Nome vem de profiles.user_id (sem e-mail).
CREATE OR REPLACE FUNCTION public.record_fiscal_document_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_name text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT p.name INTO v_name FROM public.profiles p WHERE p.user_id = v_actor LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.fiscal_document_events (document_id, action, from_status, to_status, actor_id, actor_name)
    VALUES (NEW.id, 'created', NULL, NEW.status, v_actor, v_name);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.fiscal_document_events (document_id, action, from_status, to_status, actor_id, actor_name, payload)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, v_actor, v_name,
            jsonb_build_object(
              'access_key', NEW.access_key,
              'protocol_number', NEW.protocol_number,
              'authorization_source', NEW.authorization_source,
              'environment', NEW.environment,
              'redacted', true
            ));
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fiscal_document_events ON public.fiscal_documents;
CREATE TRIGGER trg_fiscal_document_events
  AFTER INSERT OR UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.record_fiscal_document_event();

-- Guarda de transições e da rotulagem "autorizado"
CREATE OR REPLACE FUNCTION public.fiscal_document_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE ok boolean := true;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('rascunho','validado') THEN
      RAISE EXCEPTION 'Novo documento só pode nascer como rascunho ou validado (recebido: %). Autorização ocorre por transição auditada.', NEW.status;
    END IF;
    IF NEW.protocol_number IS NOT NULL OR NEW.access_key IS NOT NULL OR NEW.authorized_at IS NOT NULL THEN
      RAISE EXCEPTION 'Chave, protocolo e data de autorização não podem ser informados na criação.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    ok := CASE OLD.status
      WHEN 'rascunho'              THEN NEW.status IN ('validado','cancelado')
      WHEN 'validado'              THEN NEW.status IN ('rascunho','aguardando_assinatura','enviado','cancelado')
      WHEN 'aguardando_assinatura' THEN NEW.status IN ('validado','enviado','rejeitado','cancelado')
      WHEN 'enviado'               THEN NEW.status IN ('autorizado','rejeitado','cancelado')
      WHEN 'rejeitado'             THEN NEW.status IN ('rascunho','validado','enviado','cancelado')
      WHEN 'autorizado'            THEN NEW.status IN ('cancelado','encerrado')
      ELSE false
    END;
    IF NOT ok THEN
      RAISE EXCEPTION 'Transição de situação inválida: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'autorizado' THEN
      IF NEW.access_key IS NULL OR NEW.access_key !~ '^[0-9]{44}$' THEN
        RAISE EXCEPTION 'Autorização exige chave de acesso com 44 dígitos.';
      END IF;
      IF COALESCE(NEW.protocol_number, '') = '' THEN
        RAISE EXCEPTION 'Autorização exige número de protocolo real da SEFAZ.';
      END IF;
      IF NEW.authorized_at IS NULL THEN
        RAISE EXCEPTION 'Autorização exige data/hora de autorização.';
      END IF;
      IF COALESCE(NEW.xml_path, '') = '' OR NEW.xml_sha256 IS NULL OR NEW.xml_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Autorização exige XML autorizado armazenado com hash SHA-256 válido.';
      END IF;
      IF NEW.authorization_source IS NULL
         OR NEW.authorization_source NOT IN ('sefaz_provider','external_import') THEN
        RAISE EXCEPTION 'Autorização exige origem válida (sefaz_provider ou external_import).';
      END IF;
      IF NEW.environment IS DISTINCT FROM OLD.environment THEN
        RAISE EXCEPTION 'Ambiente não pode mudar durante a autorização.';
      END IF;
      IF NEW.authorization_source = 'external_import' AND NEW.source <> 'external_import' THEN
        RAISE EXCEPTION 'Origem da autorização incoerente com a origem do documento.';
      END IF;
    END IF;

    IF NEW.status = 'encerrado' AND NEW.model <> '58' THEN
      RAISE EXCEPTION 'Encerramento aplica-se somente ao MDF-e (modelo 58).';
    END IF;
  END IF;

  IF OLD.status = 'autorizado' THEN
    IF NEW.access_key IS DISTINCT FROM OLD.access_key
       OR NEW.protocol_number IS DISTINCT FROM OLD.protocol_number
       OR NEW.authorized_at IS DISTINCT FROM OLD.authorized_at
       OR NEW.xml_sha256 IS DISTINCT FROM OLD.xml_sha256
       OR NEW.xml_path IS DISTINCT FROM OLD.xml_path
       OR NEW.environment IS DISTINCT FROM OLD.environment
       OR NEW.model IS DISTINCT FROM OLD.model
       OR NEW.total_document_cents IS DISTINCT FROM OLD.total_document_cents THEN
      RAISE EXCEPTION 'Documento autorizado é imutável. Use cancelamento ou encerramento.';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_fiscal_document_guard ON public.fiscal_documents;
CREATE TRIGGER trg_fiscal_document_guard
  BEFORE INSERT OR UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.fiscal_document_guard();

-- Funções de trigger não são chamáveis pelo cliente
REVOKE ALL ON FUNCTION public.record_fiscal_document_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fiscal_document_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fiscal_profiles_updated ON public.fiscal_profiles;
CREATE TRIGGER trg_fiscal_profiles_updated
  BEFORE UPDATE ON public.fiscal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_fiscal_document_items_updated ON public.fiscal_document_items;
CREATE TRIGGER trg_fiscal_document_items_updated
  BEFORE UPDATE ON public.fiscal_document_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage privado: fiscal-documents (somente xml/pdf, admin/financeiro)
DROP POLICY IF EXISTS "fiscal_documents_bucket_read" ON storage.objects;
CREATE POLICY "fiscal_documents_bucket_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fiscal-documents' AND public.current_user_has_any_role(ARRAY['admin','financeiro']));

DROP POLICY IF EXISTS "fiscal_documents_bucket_insert" ON storage.objects;
CREATE POLICY "fiscal_documents_bucket_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fiscal-documents'
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
    AND public.storage_path_is_safe(name, ARRAY['xml','pdf'])
  );

DROP POLICY IF EXISTS "fiscal_documents_bucket_update" ON storage.objects;
CREATE POLICY "fiscal_documents_bucket_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fiscal-documents'
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
    AND public.storage_path_is_safe(name, ARRAY['xml','pdf'])
  )
  WITH CHECK (
    bucket_id = 'fiscal-documents'
    AND public.current_user_has_any_role(ARRAY['admin','financeiro'])
    AND public.storage_path_is_safe(name, ARRAY['xml','pdf'])
  );

DROP POLICY IF EXISTS "fiscal_documents_bucket_delete" ON storage.objects;
CREATE POLICY "fiscal_documents_bucket_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fiscal-documents' AND public.current_user_has_any_role(ARRAY['admin']));
