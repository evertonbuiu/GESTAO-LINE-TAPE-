-- Desabilitar RLS temporariamente para interstate_transports
-- já que estamos usando autenticação customizada
ALTER TABLE public.interstate_transports DISABLE ROW LEVEL SECURITY;

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Temporary insert policy for interstate transports" ON public.interstate_transports;
DROP POLICY IF EXISTS "Users can update interstate transports with permission" ON public.interstate_transports;
DROP POLICY IF EXISTS "Users can delete interstate transports with permission" ON public.interstate_transports;
DROP POLICY IF EXISTS "Users can view interstate transports with permission" ON public.interstate_transports;