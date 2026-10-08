-- Habilitar RLS na tabela interstate_transports
ALTER TABLE public.interstate_transports ENABLE ROW LEVEL SECURITY;

-- Criar políticas de RLS para interstate_transports
CREATE POLICY "Admin full access to interstate transports" 
ON public.interstate_transports 
FOR ALL 
USING ((auth.uid() IS NOT NULL) AND current_user_has_role('admin'::app_role));

CREATE POLICY "Users manage interstate transports with permission" 
ON public.interstate_transports 
FOR ALL 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit'::text, 'edit'::text)));

CREATE POLICY "Users view interstate transports with permission" 
ON public.interstate_transports 
FOR SELECT 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_view'::text, 'view'::text)));