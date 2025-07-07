export interface Database {
  public: {
    Tables: {
      albaranes: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          image_url: string
          image_path: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          supplier: string | null
          document_number: string | null
          document_date: string | null
          tax_id: string | null
          total_amount: number | null
          currency: string | null
          raw_text: string | null
          processing_metadata: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          image_url: string
          image_path: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          supplier?: string | null
          document_number?: string | null
          document_date?: string | null
          tax_id?: string | null
          total_amount?: number | null
          currency?: string | null
          raw_text?: string | null
          processing_metadata?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          image_url?: string
          image_path?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          supplier?: string | null
          document_number?: string | null
          document_date?: string | null
          tax_id?: string | null
          total_amount?: number | null
          currency?: string | null
          raw_text?: string | null
          processing_metadata?: Json | null
        }
      }
      albaran_items: {
        Row: {
          id: string
          albaran_id: string
          created_at: string
          description: string
          quantity: number | null
          unit_price: number | null
          total_price: number | null
          line_number: number
        }
        Insert: {
          id?: string
          albaran_id: string
          created_at?: string
          description: string
          quantity?: number | null
          unit_price?: number | null
          total_price?: number | null
          line_number: number
        }
        Update: {
          id?: string
          albaran_id?: string
          created_at?: string
          description?: string
          quantity?: number | null
          unit_price?: number | null
          total_price?: number | null
          line_number?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_albaran_with_idp: {
        Args: {
          albaran_id: string
          image_path: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]