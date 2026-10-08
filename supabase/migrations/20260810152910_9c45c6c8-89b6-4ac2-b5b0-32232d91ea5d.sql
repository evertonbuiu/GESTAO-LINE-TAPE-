-- 1) Coluna de vínculo estável entre itens do orçamento e itens do evento
ALTER TABLE public.event_budgets ADD COLUMN IF NOT EXISTS source_item_id text;
CREATE INDEX IF NOT EXISTS idx_event_budgets_source_item_id ON public.event_budgets (source_item_id);

-- 2) Sequência de numeração de orçamentos, iniciando acima do maior número existente
DO $$
DECLARE
  max_num bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'quote_number_seq' AND relnamespace = 'public'::regnamespace) THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(quote_number, '\D', '', 'g'), ''))::bigint, 0)
      INTO max_num
      FROM public.external_quotes;
    EXECUTE format('CREATE SEQUENCE public.quote_number_seq START WITH %s', GREATEST(COALESCE(max_num, 0) + 1, 1));
  END IF;
END $$;

GRANT USAGE, SELECT ON SEQUENCE public.quote_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.quote_number_seq TO service_role;

-- 3) Função concorrente para gerar o próximo número único de orçamento
CREATE OR REPLACE FUNCTION public.next_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    candidate := '#' || lpad(nextval('public.quote_number_seq')::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.external_quotes WHERE quote_number = candidate);
    IF attempts > 1000 THEN
      RAISE EXCEPTION 'Não foi possível gerar um número de orçamento único';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_quote_number() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_quote_number() TO service_role;

-- 4) Índice único apenas quando seguro (não há duplicidades atualmente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.external_quotes
    WHERE quote_number IS NOT NULL
    GROUP BY quote_number HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_external_quotes_quote_number
      ON public.external_quotes (quote_number) WHERE quote_number IS NOT NULL;
  END IF;
END $$;