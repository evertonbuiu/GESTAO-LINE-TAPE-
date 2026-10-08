// Copiado de supabase/functions/create-employee/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { serve } from "../../compat/deno.js"
import { createClient } from "../../compat/supabase.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Verificar se o usuário atual é admin usando o sistema de auth customizado
    // O sistema não usa JWT, então validamos pelo userId fornecido
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.slice('Bearer '.length)
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const requestBody = await req.json()
    const { username, password, name, role = 'funcionario' } = requestBody

    if (!username || !password || !name) {
      throw new Error('username, password, and name are required')
    }

    // Verificar se o usuário que está criando tem role de admin
    const { data: creatorRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single()

    if (roleError || creatorRole?.role !== 'admin') {
      throw new Error('Only admins can create employee accounts')
    }


    // Validate role
    if (!['admin', 'funcionario', 'financeiro', 'deposito'].includes(role)) {
      throw new Error('Invalid role specified')
    }

    // Check if username already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('user_credentials')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (checkError) {
      throw new Error('Error checking existing user')
    }

    if (existingUser) {
      throw new Error('Username already exists')
    }

    const syntheticEmail = `${String(username).trim().toLowerCase()}@linetape.local`

    // 1) Criar usuário no Supabase Auth nativo
    const { data: authCreated, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: { username, name },
    })

    if (authCreateError || !authCreated?.user) {
      throw new Error(authCreateError?.message || 'Failed to create auth user')
    }

    const newUserId = authCreated.user.id

    // 2) Manter user_credentials espelhado (usado por relatórios/legado), com o MESMO id do auth
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('user_credentials')
      .insert({
        id: newUserId,
        username,
        password_hash: 'managed-by-supabase-auth',
        name,
        is_active: true,
      })
      .select()
      .single()

    if (createError) {
      // rollback do auth user pra não deixar órfão
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw createError
    }

    // 3) Criar role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUserId, role })

    if (roleInsertError) {
      await supabaseAdmin.from('user_credentials').delete().eq('id', newUserId)
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw roleInsertError
    }


    return new Response(
      JSON.stringify({ 
        user: newUser,
        message: 'Employee created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error creating employee:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}
