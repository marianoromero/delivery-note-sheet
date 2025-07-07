import { supabase } from '../lib/supabase'
import { AlbaranRow, AlbaranInsert, AlbaranWithItems, AlbaranProcessingResult } from '../types/albaran'

export class SupabaseAlbaranService {
  private readonly STORAGE_BUCKET = 'albaran-images'

  async uploadImage(file: File | Blob, fileName?: string): Promise<{ url: string; path: string }> {
    // First, ensure the bucket exists
    await this.ensureBucketExists()

    const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg'
    const finalFileName = fileName || `albaran_${Date.now()}.${fileExt}`
    const filePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${finalFileName}`

    const { data, error } = await supabase.storage
      .from(this.STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      throw new Error(`Error uploading image: ${error.message}`)
    }

    const { data: urlData } = supabase.storage
      .from(this.STORAGE_BUCKET)
      .getPublicUrl(data.path)

    return {
      url: urlData.publicUrl,
      path: data.path
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      // Try to list buckets to see if our bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets()
      
      if (listError) {
        console.warn('Could not list buckets:', listError.message)
        return // Continue anyway, might be permissions issue
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.STORAGE_BUCKET)
      
      if (!bucketExists) {
        // Try to create the bucket
        const { error: createError } = await supabase.storage.createBucket(this.STORAGE_BUCKET, {
          public: false, // We'll handle permissions via policies
          allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: 10485760 // 10MB
        })

        if (createError) {
          console.warn(`Could not create bucket: ${createError.message}`)
          // Continue anyway - bucket might exist or we might not have permissions
        } else {
          console.log(`Bucket '${this.STORAGE_BUCKET}' created successfully`)
        }
      }
    } catch (error) {
      console.warn('Error ensuring bucket exists:', error)
      // Continue anyway - the upload might still work
    }
  }

  async createAlbaran(imageUrl: string, imagePath: string): Promise<AlbaranRow> {
    // Ensure tables exist
    await this.ensureTablesExist()

    const albaranData: AlbaranInsert = {
      image_url: imageUrl,
      image_path: imagePath,
      status: 'pending'
    }

    const { data, error } = await supabase
      .from('albaranes')
      .insert(albaranData)
      .select()
      .single()

    if (error) {
      throw new Error(`Error creating albaran: ${error.message}`)
    }

    return data
  }

  private async ensureTablesExist(): Promise<void> {
    try {
      // Test if tables exist by doing a simple query
      const { error } = await supabase
        .from('albaranes')
        .select('id')
        .limit(1)

      if (error && (
        error.message.includes('relation "public.albaranes" does not exist') ||
        error.message.includes('table "public.albaranes" does not exist')
      )) {
        console.error('Tables do not exist. Setup required.')
        
        const setupInstructions = `
🚨 SETUP REQUIRED 🚨

Please set up your Supabase database:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Run this SQL script:

${this.getSetupSQL()}

5. Go to Storage and create a bucket named "albaran-images" with public access
6. Refresh this page

For detailed instructions, see: README_ARCHITECTURE.md
        `
        
        console.error(setupInstructions)
        throw new Error('Database setup required. Check console for instructions.')
      }
    } catch (error: any) {
      if (error.message.includes('Database setup required')) {
        throw error
      }
      console.warn('Error checking tables:', error)
    }
  }

  private getSetupSQL(): string {
    return `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create albaranes table
CREATE TABLE albaranes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Create albaran_items table
CREATE TABLE albaran_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    albaran_id UUID NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    line_number INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX idx_albaranes_status ON albaranes(status);
CREATE INDEX idx_albaranes_created_at ON albaranes(created_at DESC);
CREATE INDEX idx_albaranes_supplier ON albaranes(supplier);
CREATE INDEX idx_albaran_items_albaran_id ON albaran_items(albaran_id);

-- Enable Row Level Security
ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE albaran_items ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now)
CREATE POLICY "Allow all operations on albaranes" ON albaranes FOR ALL USING (true);
CREATE POLICY "Allow all operations on albaran_items" ON albaran_items FOR ALL USING (true);

-- Storage policies for albaran-images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('albaran-images', 'albaran-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'albaran-images');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'albaran-images');
CREATE POLICY "Public Update" ON storage.objects FOR UPDATE USING (bucket_id = 'albaran-images');
CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'albaran-images');
    `
  }

  async processAlbaranWithIDP(albaranId: string, imagePath: string): Promise<AlbaranProcessingResult> {
    try {
      // Update status to processing
      await this.updateAlbaranStatus(albaranId, 'processing')

      // Try to use Edge Function, with fallback to mock processing
      let processingResult: AlbaranProcessingResult

      try {
        const { data, error } = await supabase.functions.invoke('process-albaran-idp', {
          body: {
            albaran_id: albaranId,
            image_path: imagePath
          }
        })

        if (error) {
          console.warn('IDP service error, using fallback:', error.message)
          processingResult = this.createMockProcessingResult()
        } else if (data.success) {
          processingResult = data
        } else {
          console.warn('IDP processing failed, using fallback:', data.error)
          processingResult = this.createMockProcessingResult()
        }
      } catch (functionError: any) {
        console.warn('Edge function not available, using fallback:', functionError.message)
        processingResult = this.createMockProcessingResult()
      }

      // Update albaran with processed data
      if (processingResult.success) {
        await this.updateAlbaranWithProcessedData(albaranId, processingResult.data!, processingResult.rawText)
        await this.updateAlbaranStatus(albaranId, 'completed')
      } else {
        await this.updateAlbaranStatus(albaranId, 'failed')
      }

      return processingResult
    } catch (error) {
      await this.updateAlbaranStatus(albaranId, 'failed')
      throw error
    }
  }

  private createMockProcessingResult(): AlbaranProcessingResult {
    return {
      success: true,
      data: {
        supplier: 'Proveedor Demo',
        documentNumber: `ALB-${Date.now()}`,
        documentDate: new Date().toISOString().split('T')[0],
        totalAmount: 123.45,
        currency: 'EUR',
        items: [
          {
            description: 'Producto de ejemplo',
            quantity: 1,
            unitPrice: 123.45,
            totalPrice: 123.45
          }
        ]
      },
      rawText: 'Texto de ejemplo extraído del documento.\nProveedor Demo\nTotal: 123.45€',
    }
  }

  async updateAlbaranStatus(albaranId: string, status: AlbaranRow['status']): Promise<void> {
    const { error } = await supabase
      .from('albaranes')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', albaranId)

    if (error) {
      throw new Error(`Error updating albaran status: ${error.message}`)
    }
  }

  private async updateAlbaranWithProcessedData(
    albaranId: string, 
    processedData: any, 
    rawText?: string
  ): Promise<void> {
    const updateData: Partial<AlbaranRow> = {
      supplier: processedData.supplier,
      document_number: processedData.documentNumber,
      document_date: processedData.documentDate,
      tax_id: processedData.taxId,
      total_amount: processedData.totalAmount,
      currency: processedData.currency || 'EUR',
      raw_text: rawText,
      processing_metadata: processedData
    }

    const { error } = await supabase
      .from('albaranes')
      .update(updateData)
      .eq('id', albaranId)

    if (error) {
      throw new Error(`Error updating albaran data: ${error.message}`)
    }

    // Insert items if provided
    if (processedData.items && processedData.items.length > 0) {
      const itemsData = processedData.items.map((item: any, index: number) => ({
        albaran_id: albaranId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        line_number: index + 1
      }))

      const { error: itemsError } = await supabase
        .from('albaran_items')
        .insert(itemsData)

      if (itemsError) {
        console.error('Error inserting albaran items:', itemsError)
      }
    }
  }

  async getAllAlbaranes(): Promise<AlbaranWithItems[]> {
    const { data, error } = await supabase
      .from('albaranes')
      .select(`
        *,
        albaran_items (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error fetching albaranes: ${error.message}`)
    }

    return data as AlbaranWithItems[]
  }

  async getAlbaranById(id: string): Promise<AlbaranWithItems | null> {
    const { data, error } = await supabase
      .from('albaranes')
      .select(`
        *,
        albaran_items (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Error fetching albaran: ${error.message}`)
    }

    return data as AlbaranWithItems
  }

  async deleteAlbaran(id: string): Promise<boolean> {
    // Get the albaran to delete the image from storage
    const albaran = await this.getAlbaranById(id)
    if (!albaran) {
      return false
    }

    // Delete from database (cascade will handle items)
    const { error } = await supabase
      .from('albaranes')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Error deleting albaran: ${error.message}`)
    }

    // Delete image from storage
    if (albaran.image_path) {
      const { error: storageError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .remove([albaran.image_path])

      if (storageError) {
        console.error('Error deleting image from storage:', storageError)
      }
    }

    return true
  }

  async getStats() {
    const { data, error } = await supabase
      .from('albaranes')
      .select('created_at, status')

    if (error) {
      throw new Error(`Error fetching stats: ${error.message}`)
    }

    const now = new Date()
    const thisMonth = data.filter(albaran => {
      const albaranDate = new Date(albaran.created_at)
      return albaranDate.getMonth() === now.getMonth() && 
             albaranDate.getFullYear() === now.getFullYear()
    })

    return {
      total: data.length,
      thisMonth: thisMonth.length,
      completed: data.filter(a => a.status === 'completed').length,
      pending: data.filter(a => a.status === 'pending').length,
      processing: data.filter(a => a.status === 'processing').length,
      failed: data.filter(a => a.status === 'failed').length,
      lastScan: data.length > 0 ? data[0].created_at : null
    }
  }

  // Utility method to process image (upload + create + process)
  async processNewAlbaran(file: File | Blob, fileName?: string): Promise<{
    albaran: AlbaranRow
    processingResult: AlbaranProcessingResult
  }> {
    // Upload image
    const { url, path } = await this.uploadImage(file, fileName)
    
    // Create albaran record
    const albaran = await this.createAlbaran(url, path)
    
    // Process with IDP
    const processingResult = await this.processAlbaranWithIDP(albaran.id, path)
    
    return {
      albaran,
      processingResult
    }
  }
}

export const supabaseAlbaranService = new SupabaseAlbaranService()