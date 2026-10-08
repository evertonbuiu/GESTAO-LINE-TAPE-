-- Remove the obsolete "letra 3D" wording from the equipment catalog without
-- deleting equipment or changing historical commercial quotes.
DO $$
DECLARE
  label_pattern constant text := '(letras?[[:space:]]*3d|3d[[:space:]]*letras?)';
BEGIN
  UPDATE public.equipment
  SET
    name = COALESCE(
      NULLIF(BTRIM(REGEXP_REPLACE(name, label_pattern, '', 'gi')), ''),
      'Item'
    ),
    category = COALESCE(
      NULLIF(BTRIM(REGEXP_REPLACE(category, label_pattern, '', 'gi')), ''),
      'Outros'
    ),
    description = NULLIF(
      BTRIM(REGEXP_REPLACE(COALESCE(description, ''), label_pattern, '', 'gi')),
      ''
    ),
    updated_at = now()
  WHERE CONCAT_WS(' ', name, category, description) ~* label_pattern;
END;
$$;
