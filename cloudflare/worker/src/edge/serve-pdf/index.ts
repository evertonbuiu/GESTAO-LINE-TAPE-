// Copiado de supabase/functions/serve-pdf/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { serve } from "../../compat/deno.js"
import { createClient } from "../../compat/supabase.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self' https://*.lovable.dev https://*.sandbox.lovable.dev;"
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const token = authHeader.slice('Bearer '.length)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const contentType = req.headers.get('content-type') ?? ''
    const pdfPath = req.method === 'POST' && contentType.includes('application/json')
      ? (await req.json()).path
      : new URL(req.url).searchParams.get('path')
    
    if (!pdfPath) {
      return new Response('PDF path is required', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    // Extract just the filename if a full URL was passed
    let fileName = pdfPath;
    
    // Handle various URL formats that might be passed
    if (pdfPath.includes('supabase.co/storage/v1/object/public/budget-pdfs/')) {
      fileName = pdfPath.split('supabase.co/storage/v1/object/public/budget-pdfs/')[1];
    } else if (pdfPath.includes('/budget-pdfs/')) {
      fileName = pdfPath.split('/budget-pdfs/')[1];
    } else if (pdfPath.includes('public/budget-pdfs/')) {
      fileName = pdfPath.split('public/budget-pdfs/')[1];
    }
    
    // Remove any remaining URL fragments
    if (fileName.includes('?')) {
      fileName = fileName.split('?')[0];
    }

    console.log('Serving PDF:', fileName)

    // Get the PDF file from storage
    const { data, error } = await supabaseClient.storage
      .from('budget-pdfs')
      .download(fileName)

    if (error) {
      console.error('Error downloading PDF:', error)
      return new Response('PDF not found', { 
        status: 404,
        headers: corsHeaders 
      })
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer()

    return new Response(arrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      }
    })

  } catch (error) {
    console.error('Error serving PDF:', error)
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    })
  }
})
