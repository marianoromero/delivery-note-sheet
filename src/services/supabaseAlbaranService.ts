import { supabase } from '../lib/supabase'
import { AlbaranRow, AlbaranInsert, AlbaranWithItems, AlbaranProcessingResult } from '../types/albaran'

export class SupabaseAlbaranService {
  private readonly STORAGE_BUCKET = 'albaran-images'

  async uploadImage(file: File | Blob, fileName?: string): Promise<{ url: string; path: string }> {
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

  async createAlbaran(imageUrl: string, imagePath: string): Promise<AlbaranRow> {
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

  async processAlbaranWithIDP(albaranId: string, imagePath: string): Promise<AlbaranProcessingResult> {
    try {
      // Update status to processing
      await this.updateAlbaranStatus(albaranId, 'processing')

      const { data, error } = await supabase.functions.invoke('process-albaran-idp', {
        body: {
          albaran_id: albaranId,
          image_path: imagePath
        }
      })

      if (error) {
        await this.updateAlbaranStatus(albaranId, 'failed')
        throw new Error(`IDP processing failed: ${error.message}`)
      }

      // Update albaran with processed data
      if (data.success) {
        await this.updateAlbaranWithProcessedData(albaranId, data.data, data.rawText)
        await this.updateAlbaranStatus(albaranId, 'completed')
      } else {
        await this.updateAlbaranStatus(albaranId, 'failed')
      }

      return data
    } catch (error) {
      await this.updateAlbaranStatus(albaranId, 'failed')
      throw error
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