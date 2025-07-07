import { supabase } from '../lib/supabase'

export class SupabaseSetup {
  async setupDatabase(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Setting up Supabase database...')

      // Create albaranes table
      const createAlbaranesTable = `
        CREATE TABLE IF NOT EXISTS albaranes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          image_url TEXT NOT NULL,
          image_path TEXT NOT NULL,
          status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
          supplier TEXT,
          document_number TEXT,
          document_date DATE,
          tax_id TEXT,
          total_amount DECIMAL(10,2),
          currency TEXT DEFAULT 'EUR',
          raw_text TEXT,
          processing_metadata JSONB
        );
      `

      // Create albaran_items table
      const createAlbaranItemsTable = `
        CREATE TABLE IF NOT EXISTS albaran_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          albaran_id UUID NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          description TEXT NOT NULL,
          quantity DECIMAL(10,3),
          unit_price DECIMAL(10,2),
          total_price DECIMAL(10,2),
          line_number INTEGER NOT NULL
        );
      `

      // Create indexes
      const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_albaranes_status ON albaranes(status);
        CREATE INDEX IF NOT EXISTS idx_albaranes_created_at ON albaranes(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_albaranes_supplier ON albaranes(supplier);
        CREATE INDEX IF NOT EXISTS idx_albaran_items_albaran_id ON albaran_items(albaran_id);
      `

      // Execute SQL commands
      const { error: tableError1 } = await supabase.rpc('exec_sql', { sql: createAlbaranesTable })
      if (tableError1) {
        console.error('Error creating albaranes table:', tableError1)
        return { success: false, message: `Error creating albaranes table: ${tableError1.message}` }
      }

      const { error: tableError2 } = await supabase.rpc('exec_sql', { sql: createAlbaranItemsTable })
      if (tableError2) {
        console.error('Error creating albaran_items table:', tableError2)
        return { success: false, message: `Error creating albaran_items table: ${tableError2.message}` }
      }

      const { error: indexError } = await supabase.rpc('exec_sql', { sql: createIndexes })
      if (indexError) {
        console.warn('Warning creating indexes:', indexError)
      }

      // Create storage bucket
      const { error: bucketError } = await supabase.storage.createBucket('albaran-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 10485760 // 10MB
      })

      if (bucketError && !bucketError.message.includes('already exists')) {
        console.warn('Error creating storage bucket:', bucketError)
      }

      return { 
        success: true, 
        message: 'Supabase database setup completed successfully!' 
      }

    } catch (error: any) {
      console.error('Setup error:', error)
      return { 
        success: false, 
        message: `Setup failed: ${error.message}` 
      }
    }
  }
}

export const supabaseSetup = new SupabaseSetup()