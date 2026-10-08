ALTER TABLE public.user_theme_preferences
  ADD COLUMN IF NOT EXISTS mode           text    NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS primary_hsl    text,
  ADD COLUMN IF NOT EXISTS density        text    NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS font_scale     numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS radius_scale   numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reduced_motion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_contrast  boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='utp_mode_check') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT utp_mode_check CHECK (mode IN ('light','dark','system'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='utp_density_check') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT utp_density_check CHECK (density IN ('compact','comfortable'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='utp_font_scale_check') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT utp_font_scale_check CHECK (font_scale >= 0.85 AND font_scale <= 1.30);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='utp_radius_scale_check') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT utp_radius_scale_check CHECK (radius_scale >= 0 AND radius_scale <= 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='utp_primary_hsl_check') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT utp_primary_hsl_check CHECK (
        primary_hsl IS NULL OR (
          primary_hsl ~ '^[0-9]{1,3}(\.[0-9]+)? [0-9]{1,3}(\.[0-9]+)?% [0-9]{1,3}(\.[0-9]+)?%$'
          AND (split_part(primary_hsl, ' ', 1))::numeric BETWEEN 0 AND 360
          AND (rtrim(split_part(primary_hsl, ' ', 2), '%'))::numeric BETWEEN 0 AND 100
          AND (rtrim(split_part(primary_hsl, ' ', 3), '%'))::numeric BETWEEN 0 AND 100
        )
      );
  END IF;
END$$;

ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_theme_preferences_user_id_key') THEN
    ALTER TABLE public.user_theme_preferences
      ADD CONSTRAINT user_theme_preferences_user_id_key UNIQUE (user_id);
  END IF;
END$$;

REVOKE ALL ON public.user_theme_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.user_theme_preferences TO authenticated;
GRANT ALL ON public.user_theme_preferences TO service_role;

DROP TRIGGER IF EXISTS trg_utp_updated_at ON public.user_theme_preferences;
CREATE TRIGGER trg_utp_updated_at
  BEFORE UPDATE ON public.user_theme_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();