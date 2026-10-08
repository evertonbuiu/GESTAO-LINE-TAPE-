ALTER TABLE public.external_quotes
  ADD COLUMN IF NOT EXISTS tax_percentage numeric(5,2),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2);

UPDATE public.external_quotes
SET tax_amount = GREATEST(
  total_amount - (
    subtotal - COALESCE(discount_amount, 0) +
    COALESCE(travel_expense, 0) +
    COALESCE(accommodation_expense, 0)
  ),
  0
)
WHERE tax_option = 'com_nota'
  AND tax_amount IS NULL;

UPDATE public.external_quotes
SET tax_percentage = CASE
  WHEN subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0) > 0
    THEN ROUND(
      COALESCE(tax_amount, 0) /
      (subtotal - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)) * 100,
      2
    )
  ELSE 0
END
WHERE tax_option = 'com_nota'
  AND tax_percentage IS NULL;

UPDATE public.external_quotes
SET tax_amount = 0
WHERE tax_amount IS NULL;

ALTER TABLE public.external_quotes
  ALTER COLUMN tax_percentage SET DEFAULT 15,
  ALTER COLUMN tax_amount SET DEFAULT 0;
