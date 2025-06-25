export interface Albaran {
  id: string;
  text: string;
  imageData: string;
  timestamp: number;
  date: string;
  processedData?: {
    supplier?: string;
    amount?: string;
    documentNumber?: string;
    items?: string[];
  };
}

class AlbaranService {
  private readonly STORAGE_KEY = 'delivery-note-albaranes';

  // Guardar un nuevo albarán
  saveAlbaran(text: string, imageData: string): Albaran {
    const now = new Date();
    const albaran: Albaran = {
      id: this.generateId(),
      text,
      imageData,
      timestamp: now.getTime(),
      date: now.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      processedData: this.processText(text)
    };

    const albaranes = this.getAllAlbaranes();
    albaranes.unshift(albaran); // Agregar al inicio (más reciente primero)
    
    this.saveToStorage(albaranes);
    return albaran;
  }

  // Obtener todos los albaranes
  getAllAlbaranes(): Albaran[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading albaranes:', error);
      return [];
    }
  }

  // Obtener albarán por ID
  getAlbaranById(id: string): Albaran | null {
    const albaranes = this.getAllAlbaranes();
    return albaranes.find(albaran => albaran.id === id) || null;
  }

  // Eliminar albarán
  deleteAlbaran(id: string): boolean {
    try {
      const albaranes = this.getAllAlbaranes();
      const filteredAlbaranes = albaranes.filter(albaran => albaran.id !== id);
      
      if (filteredAlbaranes.length !== albaranes.length) {
        this.saveToStorage(filteredAlbaranes);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting albaran:', error);
      return false;
    }
  }

  // Limpiar todos los albaranes
  clearAllAlbaranes(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // Exportar albaranes como JSON
  exportAlbaranes(): string {
    const albaranes = this.getAllAlbaranes();
    return JSON.stringify(albaranes, null, 2);
  }

  // Obtener estadísticas
  getStats() {
    const albaranes = this.getAllAlbaranes();
    const now = new Date();
    const thisMonth = albaranes.filter(albaran => {
      const albaranDate = new Date(albaran.timestamp);
      return albaranDate.getMonth() === now.getMonth() && 
             albaranDate.getFullYear() === now.getFullYear();
    });

    return {
      total: albaranes.length,
      thisMonth: thisMonth.length,
      lastScan: albaranes.length > 0 ? albaranes[0].date : null
    };
  }

  private generateId(): string {
    return `albaran_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private saveToStorage(albaranes: Albaran[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(albaranes));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      throw new Error('No se pudo guardar el albarán. Almacenamiento lleno.');
    }
  }

  // Procesar texto OCR para extraer información relevante
  private processText(text: string): Albaran['processedData'] {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const processedData: Albaran['processedData'] = {};

    // Buscar número de documento
    for (const line of lines) {
      // Patrones comunes para números de albarán/factura
      const docNumberMatch = line.match(/(?:albar[aá]n|factura|n[uú]mero|doc|ref)[\s:]*([a-z0-9\-/]+)/i);
      if (docNumberMatch) {
        processedData.documentNumber = docNumberMatch[1];
        break;
      }
    }

    // Buscar proveedor (suele estar en las primeras líneas)
    if (lines.length > 0) {
      // El proveedor suele estar en las primeras 3 líneas
      const potentialSupplier = lines.slice(0, 3).find(line => 
        line.length > 5 && 
        !line.match(/\d{2}\/\d{2}\/\d{4}/) && // No es una fecha
        !line.match(/^\d+[.,]\d+/) // No es un precio
      );
      if (potentialSupplier) {
        processedData.supplier = potentialSupplier;
      }
    }

    // Buscar cantidad/importe total
    for (const line of lines) {
      const amountMatch = line.match(/(?:total|importe|suma)[\s:]*([0-9]+[.,][0-9]{2})/i);
      if (amountMatch) {
        processedData.amount = amountMatch[1].replace(',', '.');
        break;
      }
    }

    // Extraer elementos/productos (líneas que parecen productos)
    const items = lines.filter(line => {
      // Líneas que contienen números y texto, posiblemente productos
      return line.match(/\d+/) && 
             line.length > 10 && 
             !line.match(/^(fecha|date|total|subtotal)/i);
    }).slice(0, 5); // Máximo 5 items

    if (items.length > 0) {
      processedData.items = items;
    }

    return processedData;
  }
}

export const albaranService = new AlbaranService();