GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_theme_preferences TO authenticated;
GRANT ALL ON public.user_theme_preferences TO service_role;