-- ============ FASE 2: OPERAÇÃO ============

-- 1) Estoque mínimo por equipamento (para alertas)
ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0;

-- 2) Checklists operacionais por evento (separação, saída, devolução)
CREATE TABLE IF NOT EXISTS public.event_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('separacao','saida','devolucao')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  responsible_name text,
  responsible_user_id uuid,
  performed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, phase)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checklists TO authenticated;
GRANT ALL ON public.event_checklists TO service_role;
ALTER TABLE public.event_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklists_select_authenticated"
  ON public.event_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklists_write_operacional"
  ON public.event_checklists FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']));
CREATE POLICY "checklists_update_operacional"
  ON public.event_checklists FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']));
CREATE POLICY "checklists_delete_admin"
  ON public.event_checklists FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

CREATE TRIGGER update_event_checklists_updated_at
  BEFORE UPDATE ON public.event_checklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Itens do checklist (conferência item a item)
CREATE TABLE IF NOT EXISTS public.event_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.event_checklists(id) ON DELETE CASCADE,
  equipment_name text NOT NULL,
  equipment_id uuid REFERENCES public.equipment(id) ON DELETE SET NULL,
  expected_quantity integer NOT NULL DEFAULT 0,
  checked_quantity integer NOT NULL DEFAULT 0,
  is_checked boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checklist_items TO authenticated;
GRANT ALL ON public.event_checklist_items TO service_role;
ALTER TABLE public.event_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_items_select_authenticated"
  ON public.event_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_items_write_operacional"
  ON public.event_checklist_items FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']));
CREATE POLICY "checklist_items_update_operacional"
  ON public.event_checklist_items FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito','financeiro']));
CREATE POLICY "checklist_items_delete_operacional"
  ON public.event_checklist_items FOR DELETE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','funcionario','deposito']));

CREATE TRIGGER update_event_checklist_items_updated_at
  BEFORE UPDATE ON public.event_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_event_checklists_event ON public.event_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_event_checklist_items_checklist ON public.event_checklist_items(checklist_id);

-- ============ FASE 3: COMERCIAL ============

-- 4) Aprovação pública de orçamento via token expirável
CREATE TABLE IF NOT EXISTS public.quote_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.external_quotes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aceito','recusado','expirado')),
  accepted_name text,
  accepted_at timestamptz,
  accepted_ip text,
  accepted_user_agent text,
  accepted_snapshot jsonb,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sem acesso anônimo: o público usa a Edge Function com service_role,
-- que resolve exclusivamente pelo token recebido.
GRANT SELECT, INSERT, UPDATE ON public.quote_approvals TO authenticated;
GRANT ALL ON public.quote_approvals TO service_role;
ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quote_approvals_select_comercial"
  ON public.quote_approvals FOR SELECT TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY "quote_approvals_insert_comercial"
  ON public.quote_approvals FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY "quote_approvals_update_comercial"
  ON public.quote_approvals FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));

CREATE INDEX IF NOT EXISTS idx_quote_approvals_quote ON public.quote_approvals(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_approvals_token ON public.quote_approvals(token);

CREATE TRIGGER update_quote_approvals_updated_at
  BEFORE UPDATE ON public.quote_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Templates de mensagem (WhatsApp) configuráveis
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_templates_select_authenticated"
  ON public.message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "message_templates_write_comercial"
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY "message_templates_update_comercial"
  ON public.message_templates FOR UPDATE TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','financeiro']))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin','financeiro']));
CREATE POLICY "message_templates_delete_admin"
  ON public.message_templates FOR DELETE TO authenticated
  USING (public.is_current_user_admin());

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.message_templates (key, title, body) VALUES
  ('orcamento_envio', 'Envio de orçamento', 'Olá {{cliente}}! Segue o orçamento {{numero}} no valor de {{valor}}. Link para aprovação: {{link}}'),
  ('contrato_envio', 'Envio de contrato', 'Olá {{cliente}}! Seu contrato do evento {{evento}} está disponível: {{link}}'),
  ('lembrete_pagamento', 'Lembrete de pagamento', 'Olá {{cliente}}, lembrete do pagamento de {{valor}} com vencimento em {{data}}.'),
  ('lembrete_evento', 'Lembrete de evento', 'Olá {{cliente}}, seu evento {{evento}} acontece em {{data}} às {{hora}}.')
ON CONFLICT (key) DO NOTHING;