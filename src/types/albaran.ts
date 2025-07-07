import { Database } from './database'

export type AlbaranRow = Database['public']['Tables']['albaranes']['Row']
export type AlbaranInsert = Database['public']['Tables']['albaranes']['Insert']
export type AlbaranUpdate = Database['public']['Tables']['albaranes']['Update']

export type AlbaranItemRow = Database['public']['Tables']['albaran_items']['Row']
export type AlbaranItemInsert = Database['public']['Tables']['albaran_items']['Insert']
export type AlbaranItemUpdate = Database['public']['Tables']['albaran_items']['Update']

export interface AlbaranWithItems extends AlbaranRow {
  albaran_items: AlbaranItemRow[]
}

export interface AlbaranProcessingResult {
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