// Copiado de supabase/functions/import-budget/index.ts por cloudflare/tools/port_functions.py
// (só os imports do Deno/Supabase foram trocados). Não edite aqui: edite o original e rode o script.
import { serve } from "../../compat/deno.js"
import { createClient } from "../../compat/supabase.js"

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://linetape-iluminacao.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BudgetItem {
  item: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pdf_url?: string;
  image_url?: string;
}

interface QuoteProduct {
  name: string;
  description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  image_url?: string;
}

interface LineTapeQuoteData {
  formData?: {
    quote_number?: string;
    client_name?: string;
    client_email?: string;
    client_phone?: string;
    client_document?: string;
    client_address?: string;
    event_date?: string;
    event_location?: string;
    event_name?: string;
    decorator_name?: string;
    initial_setup_date?: string;
    technical_responsible?: string;
    discount_percentage?: number;
    travel_expense?: number;
    accommodation_expense?: number;
    tax_option?: string;
  };
  products?: QuoteProduct[];
  totals?: {
    subtotal?: number;
    discount_amount?: number;
    total_amount?: number;
  };
  orcamento?: {
    formData?: any;
    products?: QuoteProduct[];
    totals?: any;
  };
  contrato?: {
    contractData?: any;
    contractTerms?: any;
    companyData?: any;
    calculatedTotals?: any;
  };
  metadata?: {
    version?: string;
    type?: string;
    exportDate?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string
    const userId = user.id

    if (!file || !eventId) {
      return new Response(
        JSON.stringify({ error: 'File and eventId are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File exceeds the 10 MB limit' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size)

    let budgetItems: BudgetItem[] = []
    const quoteData: LineTapeQuoteData | null = null

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      // Process JSON file
      try {
        const text = await file.text()
        console.log('Raw JSON content (first 500 chars):', text.substring(0, 500))
        
        const jsonData = JSON.parse(text) as LineTapeQuoteData
        console.log('Parsed JSON structure:', JSON.stringify(jsonData, null, 2).substring(0, 1000))
        
        // Check if it's a complete Line Tape quote (with orcamento structure)
        const isLineTapeComplete = jsonData.orcamento && jsonData.metadata?.type === 'complete_quote_contract';
        const isLineTapeSimple = jsonData.formData && jsonData.products && jsonData.metadata;
        
        if (isLineTapeComplete || isLineTapeSimple) {
          console.log('Detected Line Tape quote format');
          
          // Extract quote data from appropriate structure
          const quoteFormData = isLineTapeComplete ? jsonData.orcamento?.formData : jsonData.formData;
          const quoteProducts = isLineTapeComplete ? jsonData.orcamento?.products : jsonData.products;
          const quoteTotals = isLineTapeComplete ? jsonData.orcamento?.totals : jsonData.totals;
          
          // Save to external_quotes table
          const externalQuoteData = {
            event_id: eventId,
            quote_number: quoteFormData?.quote_number || `IMP-${Date.now()}`,
            quote_date: new Date().toISOString().split('T')[0],
            client_name: quoteFormData?.client_name || '',
            client_email: quoteFormData?.client_email || '',
            client_phone: quoteFormData?.client_phone || '',
            client_document: quoteFormData?.client_document || '',
            client_address: quoteFormData?.client_address || '',
            event_name: quoteFormData?.event_name || '',
            event_date: quoteFormData?.event_date || null,
            event_location: quoteFormData?.event_location || '',
            decorator_name: quoteFormData?.decorator_name || '',
            initial_setup_date: quoteFormData?.initial_setup_date || null,
            technical_responsible: quoteFormData?.technical_responsible || '',
            discount_percentage: quoteFormData?.discount_percentage || 0,
            discount_amount: quoteTotals?.discount_amount || 0,
            travel_expense: quoteFormData?.travel_expense || 0,
            accommodation_expense: quoteFormData?.accommodation_expense || 0,
            tax_option: quoteFormData?.tax_option || 'sem_nota',
            subtotal: quoteTotals?.subtotal || 0,
            total_amount: quoteTotals?.total_amount || 0,
            products: quoteProducts || [],
            status: 'draft',
            created_by: userId,
            notes: isLineTapeComplete ? `Contrato importado - ${jsonData.contrato?.contractData?.contractNumber || ''}` : null,
          };
          
          console.log('Saving external quote:', JSON.stringify(externalQuoteData, null, 2).substring(0, 500));
          
          const { data: savedQuote, error: quoteError } = await supabaseClient
            .from('external_quotes')
            .insert(externalQuoteData)
            .select()
            .single();
            
          if (quoteError) {
            console.error('Error saving external quote:', quoteError);
            // Continue to save budget items even if quote save fails
          } else {
            console.log('External quote saved successfully:', savedQuote?.id);
          }
          
          // Convert products to budget items
          if (quoteProducts && Array.isArray(quoteProducts)) {
            budgetItems = quoteProducts.map((product: QuoteProduct) => ({
              item: product.name || 'Item sem nome',
              description: product.description || '',
              quantity: product.quantity || 1,
              unit_price: product.unit_price || 0,
              total_price: product.total_price || (product.quantity || 1) * (product.unit_price || 0),
              image_url: product.image_url || undefined,
            }));
          }
          
          // Also update the event with client info if available
          if (quoteFormData?.client_name) {
            const eventUpdate: Record<string, any> = {};
            if (quoteFormData.client_name) eventUpdate.client_name = quoteFormData.client_name;
            if (quoteFormData.client_email) eventUpdate.client_email = quoteFormData.client_email;
            if (quoteFormData.client_phone) eventUpdate.client_phone = quoteFormData.client_phone;
            if (quoteFormData.event_location) eventUpdate.location = quoteFormData.event_location;
            if (quoteTotals?.total_amount) eventUpdate.total_budget = quoteTotals.total_amount;
            
            if (Object.keys(eventUpdate).length > 0) {
              const { error: eventError } = await supabaseClient
                .from('events')
                .update(eventUpdate)
                .eq('id', eventId);
                
              if (eventError) {
                console.error('Error updating event:', eventError);
              } else {
                console.log('Event updated with quote data');
              }
            }
          }
          
        } else {
          // Try multiple possible structures for generic JSON
          let items: any[] = []
          
          if (Array.isArray(jsonData)) {
            items = jsonData
          } else if ((jsonData as any).items && Array.isArray((jsonData as any).items)) {
            items = (jsonData as any).items
          } else if ((jsonData as any).data && Array.isArray((jsonData as any).data)) {
            items = (jsonData as any).data
          } else if ((jsonData as any).budget && Array.isArray((jsonData as any).budget)) {
            items = (jsonData as any).budget
          } else if ((jsonData as any).products && Array.isArray((jsonData as any).products)) {
            items = (jsonData as any).products
          } else {
            // Try to find any array property
            for (const key in jsonData) {
              if (Array.isArray((jsonData as any)[key])) {
                items = (jsonData as any)[key]
                console.log('Found array in property:', key)
                break
              }
            }
          }
          
          console.log('Found items array with length:', items.length)
          
          if (items.length > 0) {
            console.log('First item structure:', JSON.stringify(items[0], null, 2))
          }
          
          budgetItems = items.filter(item => item && typeof item === 'object').map((item: any) => {
            // Try multiple field names for each property
            const itemName = item.item || item.name || item.produto || item.descricao || item.description || item.title || 'Item sem nome'
            const itemDesc = item.description || item.desc || item.descricao || item.detalhes || item.details || ''
            const itemQty = parseInt(item.quantity || item.qty || item.quantidade || item.qtd || item.q) || 1
            const itemPrice = parseFloat(
              item.unit_price || item.price || item.unitPrice || item.preco || item.valor || 
              item.preco_unitario || item.valorUnitario || item.precoUnitario
            ) || 0
            const itemTotal = parseFloat(
              item.total_price || item.total || item.totalPrice || item.total_value || 
              item.valor_total || item.valorTotal || item.precoTotal
            ) || (itemQty * itemPrice)
            
            // Try to get image URL
            const imageUrl = item.image_url || item.imageUrl || item.image || item.foto || item.picture || null
            
            console.log(`Processing item: ${itemName}, qty: ${itemQty}, price: ${itemPrice}, total: ${itemTotal}, image: ${imageUrl}`)
            
            return {
              item: itemName,
              description: itemDesc,
              quantity: itemQty,
              unit_price: itemPrice,
              total_price: itemTotal,
              image_url: imageUrl
            }
          })
        }

        console.log('Processed JSON items:', budgetItems.length)
        
      } catch (error) {
        console.error('Error parsing JSON:', error)
        return new Response(
          JSON.stringify({ error: 'Invalid JSON format' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        )
      }

    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      // For PDF files, we'll store them and return a reference
      // In a real implementation, you might want to use a PDF parsing library
      
      const fileName = `${eventId}_${Date.now()}_${file.name}`
      const fileBuffer = await file.arrayBuffer()
      
      // Upload PDF to storage
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from('budget-pdfs')
        .upload(fileName, fileBuffer, {
          contentType: 'application/pdf',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError)
        return new Response(
          JSON.stringify({ error: 'Failed to upload PDF file' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      console.log('PDF uploaded successfully:', uploadData.path)
      
      // Get public URL for the PDF
      const { data: urlData } = supabaseClient.storage
        .from('budget-pdfs')
        .getPublicUrl(uploadData.path)
      
      // For now, return a placeholder item indicating PDF was uploaded
      budgetItems = [{
        item: 'PDF Importado',
        description: `Orçamento importado do arquivo: ${file.name}`,
        quantity: 1,
        unit_price: 0,
        total_price: 0,
        pdf_url: uploadData.path // Store just the path, not the full URL
      }]

    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported file type. Only JSON and PDF files are allowed.' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // Insert budget items into database
    if (budgetItems.length > 0) {
      // Process images if they exist
      for (let i = 0; i < budgetItems.length; i++) {
        const item = budgetItems[i];
        
        if (item.image_url && item.image_url.startsWith('http')) {
          try {
            console.log(`Downloading image for item: ${item.item} from ${item.image_url}`);
            
            // Download image from URL
            const imageUrl = new URL(item.image_url);
            const blockedHost = imageUrl.hostname === 'localhost'
              || imageUrl.hostname === '127.0.0.1'
              || imageUrl.hostname === '::1'
              || imageUrl.hostname.endsWith('.local')
              || /^10\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\./.test(imageUrl.hostname);
            if (imageUrl.protocol !== 'https:' || blockedHost) {
              throw new Error('Unsafe image URL');
            }
            const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(8_000) });
            if (imageResponse.ok) {
              const contentLength = Number(imageResponse.headers.get('content-length') || 0);
              const contentType = imageResponse.headers.get('content-type') || '';
              if (!contentType.startsWith('image/') || contentLength > 5 * 1024 * 1024) {
                throw new Error('Remote image is invalid or too large');
              }
              const imageBlob = await imageResponse.blob();
              const fileExtension = item.image_url.split('.').pop()?.split('?')[0] || 'jpg';
              const fileName = `${eventId}_${Date.now()}_${item.item.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
              
              // Upload to Supabase Storage
              const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('equipment-images')
                .upload(fileName, imageBlob, {
                  contentType: imageResponse.headers.get('content-type') || 'image/jpeg',
                  upsert: false
                });

              if (uploadError) {
                console.error(`Error uploading image for ${item.item}:`, uploadError);
                // Keep original URL if upload fails
              } else {
                console.log(`Image uploaded successfully for ${item.item}:`, uploadData.path);
                
                // Get public URL
                const { data: urlData } = supabaseClient.storage
                  .from('equipment-images')
                  .getPublicUrl(uploadData.path);
                
                // Update item with new URL
                item.image_url = urlData.publicUrl;
              }
            } else {
              console.warn(`Failed to download image for ${item.item}: ${imageResponse.status}`);
              // Remove invalid URL
              item.image_url = undefined;
            }
          } catch (error) {
            console.error(`Error processing image for ${item.item}:`, error);
            // Remove invalid URL on error
            item.image_url = undefined;
          }
        }
      }

      const budgetData = budgetItems.map(item => ({
        event_id: eventId,
        item: item.item,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        pdf_url: item.pdf_url,
        image_url: item.image_url,
        created_by: userId
      }))

      const { data, error } = await supabaseClient
        .from('event_budgets')
        .insert(budgetData)
        .select()

      if (error) {
        console.error('Error inserting budget items:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to save budget items to database' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      console.log('Successfully imported', data.length, 'budget items')

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Importado com sucesso: ${data.length} itens de orçamento`,
          items: data
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'No valid budget items found in file' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Error processing budget import:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
