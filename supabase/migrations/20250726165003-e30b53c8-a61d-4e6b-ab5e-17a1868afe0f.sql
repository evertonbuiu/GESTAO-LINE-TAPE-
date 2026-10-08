-- Remover políticas existentes conflitantes e recriá-las corretamente
DROP POLICY IF EXISTS "Admin full access to interstate transports" ON public.interstate_transports;
DROP POLICY IF EXISTS "Users manage interstate transports with permission" ON public.interstate_transports;
DROP POLICY IF EXISTS "Users view interstate transports with permission" ON public.interstate_transports;

-- Criar políticas corrigidas para INSERT, UPDATE, DELETE e SELECT separadamente
CREATE POLICY "Users can insert interstate transports with permission" 
ON public.interstate_transports 
FOR INSERT 
WITH CHECK ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit'::text, 'edit'::text)));

CREATE POLICY "Users can update interstate transports with permission" 
ON public.interstate_transports 
FOR UPDATE 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit'::text, 'edit'::text)))
WITH CHECK ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit'::text, 'edit'::text)));

CREATE POLICY "Users can delete interstate transports with permission" 
ON public.interstate_transports 
FOR DELETE 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_edit'::text, 'edit'::text)));

CREATE POLICY "Users can view interstate transports with permission" 
ON public.interstate_transports 
FOR SELECT 
USING ((auth.uid() IS NOT NULL) AND (current_user_has_role('admin'::app_role) OR has_permission(auth.uid(), 'rentals_view'::text, 'view'::text)));