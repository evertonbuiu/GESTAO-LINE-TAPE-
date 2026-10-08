-- Temporariamente desabilitar RLS nas principais tabelas para diagnóstico
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_equipment DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_collaborators DISABLE ROW LEVEL SECURITY;