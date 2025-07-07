import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  albaran_id: string
  image_path: string
}

interface IDPResponse {
  success: boolean
  data?: {
    supplier?: string
    documentNumber?: string
    documentDate?: string
    taxId?: string
    totalAmount?: number
    currency?: string
    items?: Array<{
      description: string
      quantity?: number
      unitPrice?: number
      totalPrice?: number
    }>
  }
  error?: string
  rawText?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { albaran_id, image_path }: RequestBody = await req.json()

    if (!albaran_id || !image_path) {
      throw new Error('Missing required parameters: albaran_id and image_path')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the image from Supabase Storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('albaran-images')
      .download(image_path)

    if (downloadError) {
      throw new Error(`Failed to download image: ${downloadError.message}`)
    }

    // Convert blob to base64 for IDP service
    const arrayBuffer = await imageData.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    // Here you would integrate with your chosen IDP service
    // For now, I'll show examples for different services:
    
    // Example 1: Google Cloud Document AI
    const result = await processWithDocumentAI(base64Image)
    
    // Example 2: AWS Textract (commented out)
    // const result = await processWithTextract(base64Image)
    
    // Example 3: Azure Form Recognizer (commented out)
    // const result = await processWithAzureFormRecognizer(base64Image)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing albaran:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

// Google Cloud Document AI processing
async function processWithDocumentAI(base64Image: string): Promise<IDPResponse> {
  try {
    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID')!
    const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us'
    const processorId = Deno.env.get('GOOGLE_CLOUD_PROCESSOR_ID')!
    const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY')!

    const endpoint = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`

    const requestBody = {
      rawDocument: {
        content: base64Image,
        mimeType: 'image/jpeg'
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`Document AI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const document = data.document

    // Extract text
    const rawText = document.text || ''

    // Extract structured data from entities
    const extractedData = extractDataFromDocumentAI(document)

    return {
      success: true,
      data: extractedData,
      rawText: rawText
    }

  } catch (error) {
    console.error('Document AI processing error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

function extractDataFromDocumentAI(document: any) {
  const entities = document.entities || []
  const data: any = {}

  // Map Document AI entity types to our data structure
  const entityTypeMap = {
    'supplier_name': 'supplier',
    'invoice_number': 'documentNumber',
    'invoice_date': 'documentDate',
    'tax_id': 'taxId',
    'total_amount': 'totalAmount',
    'currency': 'currency'
  }

  entities.forEach((entity: any) => {
    const entityType = entity.type
    const mappedField = entityTypeMap[entityType as keyof typeof entityTypeMap]
    
    if (mappedField && entity.mentionText) {
      if (mappedField === 'totalAmount') {
        data[mappedField] = parseFloat(entity.mentionText.replace(/[^\d.,]/g, '').replace(',', '.'))
      } else {
        data[mappedField] = entity.mentionText
      }
    }
  })

  // Extract line items if available
  const lineItems = entities.filter((entity: any) => entity.type === 'line_item')
  if (lineItems.length > 0) {
    data.items = lineItems.map((item: any) => ({
      description: item.properties?.description?.mentionText || '',
      quantity: item.properties?.quantity ? parseFloat(item.properties.quantity.mentionText) : undefined,
      unitPrice: item.properties?.unit_price ? parseFloat(item.properties.unit_price.mentionText.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined,
      totalPrice: item.properties?.total_price ? parseFloat(item.properties.total_price.mentionText.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined
    }))
  }

  return data
}

// AWS Textract processing (example - would need AWS SDK)
/*
async function processWithTextract(base64Image: string): Promise<IDPResponse> {
  // Implementation would use AWS SDK for Textract
  // This is a placeholder for the actual implementation
  return {
    success: false,
    error: 'Textract integration not implemented yet'
  }
}
*/

// Azure Form Recognizer processing (example)
/*
async function processWithAzureFormRecognizer(base64Image: string): Promise<IDPResponse> {
  // Implementation would use Azure Form Recognizer REST API
  // This is a placeholder for the actual implementation
  return {
    success: false,
    error: 'Azure Form Recognizer integration not implemented yet'
  }
}
*/