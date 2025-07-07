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
    // Try OCR.space first (simpler and works immediately)
    let result = await processWithOCRSpace(base64Image)
    
    // If OCR.space fails, try Google Cloud Document AI
    if (!result.success) {
      console.log('OCR.space failed, trying Document AI...')
      result = await processWithDocumentAI(base64Image)
    }

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
    const serviceAccountKey = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY')
    
    if (!serviceAccountKey) {
      throw new Error('Service Account Key not configured. Please set GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY secret.')
    }

    // Parse the service account key
    const serviceAccount = JSON.parse(serviceAccountKey)
    
    // Get OAuth2 access token
    const accessToken = await getAccessToken(serviceAccount)
    
    const endpoint = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`

    const requestBody = {
      rawDocument: {
        content: base64Image,
        mimeType: 'image/jpeg'
      }
    }

    console.log('Calling Document AI with endpoint:', endpoint)
    console.log('Project ID:', projectId)
    console.log('Location:', location)
    console.log('Processor ID:', processorId)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Document AI response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Document AI error response:', errorText)
      throw new Error(`Document AI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Document AI response received')
    
    const document = data.document

    // Extract text
    const rawText = document?.text || ''
    console.log('Extracted text length:', rawText.length)

    // Extract structured data from entities
    const extractedData = extractDataFromDocumentAI(document)
    console.log('Extracted data:', extractedData)

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

// Function to get OAuth2 access token from service account
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id
  }
  
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  // Create JWT token (simplified implementation)
  // In a real implementation, you'd use a proper JWT library
  const headerB64 = btoa(JSON.stringify(header)).replace(/[+/]/g, c => c === '+' ? '-' : '_').replace(/=/g, '')
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/[+/]/g, c => c === '+' ? '-' : '_').replace(/=/g, '')
  
  // For now, we'll use a simpler approach - return a mock token
  // This is a placeholder - you'd need to implement proper JWT signing with the private key
  throw new Error('Service Account authentication not fully implemented. Please use a simpler approach or OCR.space API.')
}

// OCR.space API processing (simpler alternative)
async function processWithOCRSpace(base64Image: string): Promise<IDPResponse> {
  try {
    console.log('Starting OCR.space processing...')
    
    // OCR.space has a free tier with API key
    const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY') || 'helloworld' // Free tier key
    
    const formData = new FormData()
    formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`)
    formData.append('language', 'spa') // Spanish
    formData.append('isOverlayRequired', 'false')
    formData.append('detectOrientation', 'true')
    formData.append('scale', 'true')
    formData.append('OCREngine', '2') // Best engine

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': ocrApiKey
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`OCR.space API error: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('OCR.space response:', data)

    if (data.IsErroredOnProcessing) {
      throw new Error(`OCR.space processing error: ${data.ErrorMessage}`)
    }

    const extractedText = data.ParsedResults?.[0]?.ParsedText || ''
    console.log('Extracted text length:', extractedText.length)

    if (!extractedText || extractedText.trim().length < 10) {
      throw new Error('No sufficient text extracted from image')
    }

    // Process the extracted text to find structured data
    const processedData = processExtractedText(extractedText)

    return {
      success: true,
      data: processedData,
      rawText: extractedText
    }

  } catch (error) {
    console.error('OCR.space processing error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Process extracted text to find structured data
function processExtractedText(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line)
  const processedData: any = {}
  const allText = text.toLowerCase()

  // 1. Document number patterns
  const docPatterns = [
    /(?:albar[aá]n|factura|n[uú]mero|doc|ref|invoice|bill)[\s:]*([a-z0-9\-/]+)/i,
    /n[°ºo][\s]*([a-z0-9\-/]+)/i,
    /(?:^|\s)([0-9]{4,}[a-z0-9\-/]*)/i,
    /([a-z]+[0-9]{3,})/i
  ]
  
  for (const pattern of docPatterns) {
    for (const line of lines) {
      const match = line.match(pattern)
      if (match && match[1] && match[1].length >= 3) {
        processedData.documentNumber = match[1]
        break
      }
    }
    if (processedData.documentNumber) break
  }

  // 2. Supplier/Company
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i]
    if (line.length > 8 && line.length < 60 && line.match(/[a-zA-Z]{3,}/)) {
      const excludePatterns = [
        /\d{2}\/\d{2}\/\d{4}/, /^\d+[.,]\d+/, /(?:total|subtotal|iva|tax)/i,
        /(?:calle|street|avenue|plaza)/i, /^\d{5}/, /@/
      ]
      const isExcluded = excludePatterns.some(pattern => pattern.test(line))
      if (!isExcluded) {
        processedData.supplier = line
        break
      }
    }
  }

  // 3. Amounts
  const amountPatterns = [
    /(?:total|importe|suma|amount|due)[\s:]*([0-9]+[.,][0-9]{2})/i,
    /(?:€|EUR|euro)[\s]*([0-9]+[.,][0-9]{2})/i,
    /([0-9]+[.,][0-9]{2})[\s]*(?:€|EUR|euro)/i,
    /(?:^|\s)([0-9]{1,4}[.,][0-9]{2})(?:\s|$)/g
  ]

  for (const pattern of amountPatterns) {
    for (const line of lines) {
      const matches = Array.from(line.matchAll(new RegExp(pattern.source, pattern.flags)))
      for (const match of matches) {
        if (match[1]) {
          const amount = parseFloat(match[1].replace(',', '.'))
          if (amount > 0 && amount < 999999) {
            processedData.totalAmount = amount
            break
          }
        }
      }
      if (processedData.totalAmount) break
    }
    if (processedData.totalAmount) break
  }

  // 4. Document date
  const datePatterns = [
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{1,2}-\d{1,2}-\d{4})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(?:fecha|date)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i
  ]

  for (const pattern of datePatterns) {
    for (const line of lines) {
      const match = line.match(pattern)
      if (match) {
        processedData.documentDate = match[1]
        break
      }
    }
    if (processedData.documentDate) break
  }

  // 5. Tax ID
  const taxIdPatterns = [
    /(?:cif|nif|vat|tax)[\s:]*([a-z0-9-]{8,12})/i,
    /([a-z]\d{8})/i,
    /(\d{8}[a-z])/i
  ]

  for (const pattern of taxIdPatterns) {
    const match = allText.match(pattern)
    if (match) {
      processedData.taxId = match[1].toUpperCase()
      break
    }
  }

  // 6. Items
  const itemLines = lines.filter(line => {
    return line.length > 15 && line.length < 100 &&
           line.match(/\d+/) && line.match(/[a-zA-Z]{3,}/) &&
           !line.match(/^(fecha|total|subtotal|iva|cif|nif)/i) &&
           !line.match(/^(calle|street|tel|email|www)/i)
  }).slice(0, 8)

  if (itemLines.length > 0) {
    processedData.items = itemLines.map(line => ({
      description: line,
      quantity: undefined,
      unitPrice: undefined,
      totalPrice: undefined
    }))
  }

  processedData.currency = processedData.currency || 'EUR'

  return processedData
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