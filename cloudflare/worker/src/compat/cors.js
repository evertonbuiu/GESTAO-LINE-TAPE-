// Equivalente a "npm:@supabase/supabase-js@2/cors": cabeçalhos CORS padrão.
// O Worker ainda ajusta a origem permitida (ALLOWED_ORIGINS) na resposta final.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
