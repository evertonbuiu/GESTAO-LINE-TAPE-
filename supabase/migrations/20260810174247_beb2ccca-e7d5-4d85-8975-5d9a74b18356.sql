ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check CHECK (
    status = ANY (ARRAY[
      -- status legados preservados
      'draft'::text, 'active'::text, 'completed'::text, 'cancelled'::text,
      -- novo ciclo de vida
      'rascunho'::text, 'revisao'::text, 'enviado'::text, 'assinado'::text, 'cancelado'::text
    ])
  );