import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) throw new Error('Invalid token')

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', caller.id).maybeSingle()
    if (callerRole?.role !== 'admin') throw new Error('Only admins can manage employees')

    const body = await req.json()
    const { action, user_id } = body
    if (!action || !user_id) throw new Error('action and user_id are required')

    if (caller.id === user_id && (action === 'delete' || (action === 'update' && body.is_active === false))) {
      throw new Error('You cannot delete or deactivate your own account')
    }

    if (action === 'delete') {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id)
      await supabaseAdmin.from('user_permissions').delete().eq('user_id', user_id)
      await supabaseAdmin.from('user_credentials').delete().eq('id', user_id)
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user_id)
      if (delErr) throw delErr
      return json({ success: true })
    }

    if (action === 'update') {
      const { name, username, password, role, is_active } = body

      const authUpdate: any = {}
      if (password) authUpdate.password = password
      if (username) authUpdate.email = `${String(username).trim().toLowerCase()}@linetape.local`
      if (typeof is_active === 'boolean') authUpdate.ban_duration = is_active ? 'none' : '876000h'
      if (name || username) {
        authUpdate.user_metadata = { ...(name ? { name } : {}), ...(username ? { username } : {}) }
      }
      if (Object.keys(authUpdate).length > 0) {
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, authUpdate)
        if (uErr) throw uErr
      }

      const credUpdate: any = {}
      if (name) credUpdate.name = name
      if (username) credUpdate.username = username
      if (password) credUpdate.password_hash = 'managed-by-supabase-auth'
      if (typeof is_active === 'boolean') credUpdate.is_active = is_active
      if (Object.keys(credUpdate).length > 0) {
        const { error: cErr } = await supabaseAdmin.from('user_credentials').update(credUpdate).eq('id', user_id)
        if (cErr) throw cErr
      }

      if (role) {
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles').select('id').eq('user_id', user_id).maybeSingle()
        if (existingRole) {
          const { error: rErr } = await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', user_id)
          if (rErr) throw rErr
        } else {
          const { error: rErr } = await supabaseAdmin.from('user_roles').insert({ user_id, role })
          if (rErr) throw rErr
        }
      }

      return json({ success: true })
    }

    throw new Error('Invalid action')
  } catch (error) {
    console.error('manage-employee error:', error)
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 400)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}
