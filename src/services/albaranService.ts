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
    documentDate?: string;
    taxId?: string;
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
    const allText = text.toLowerCase();

    // PATRONES MEJORADOS PARA DOCUMENTOS A4

    // 1. Número de documento (patrones más amplios)
    const docPatterns = [
      /(?:albar[aá]n|factura|n[uú]mero|doc|ref|invoice|bill)[\s:]*([a-z0-9\-/]+)/i,
      /n[°ºo][\s]*([a-z0-9\-/]+)/i,
      /(?:^|\s)([0-9]{4,}[a-z0-9\-/]*)/i, // Números largos al inicio de línea
      /([a-z]+[0-9]{3,})/i // Combinación letra+números
    ];
    
    for (const pattern of docPatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length >= 3) {
          processedData.documentNumber = match[1];
          break;
        }
      }
      if (processedData.documentNumber) break;
    }

    // 2. Proveedor/Empresa (mejorado para A4)
    const excludePatterns = [
      /\d{2}\/\d{2}\/\d{4}/, // fechas
      /^\d+[.,]\d+/, // precios
      /(?:total|subtotal|iva|tax)/i, // términos contables
      /(?:calle|street|avenue|plaza)/i, // direcciones
      /^\d{5}/, // códigos postales
      /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i // emails
    ];

    for (let i = 0; i < Math.min(8, lines.length); i++) {
      const line = lines[i];
      if (line.length > 8 && line.length < 60) {
        const isExcluded = excludePatterns.some(pattern => pattern.test(line));
        if (!isExcluded && line.match(/[a-zA-Z]{3,}/)) {
          processedData.supplier = line;
          break;
        }
      }
    }

    // 3. Importes (patrones más específicos)
    const amountPatterns = [
      /(?:total|importe|suma|amount|due)[\s:]*([0-9]+[.,][0-9]{2})/i,
      /(?:€|EUR|euro)[\s]*([0-9]+[.,][0-9]{2})/i,
      /([0-9]+[.,][0-9]{2})[\s]*(?:€|EUR|euro)/i,
      /(?:^|\s)([0-9]{1,4}[.,][0-9]{2})(?:\s|$)/g // Importes aislados
    ];

    for (const pattern of amountPatterns) {
      for (const line of lines) {
        const matches = Array.from(line.matchAll(new RegExp(pattern.source, pattern.flags)));
        for (const match of matches) {
          if (match[1]) {
            const amount = parseFloat(match[1].replace(',', '.'));
            if (amount > 0 && amount < 999999) { // Filtrar importes razonables
              processedData.amount = match[1].replace(',', '.');
              break;
            }
          }
        }
        if (processedData.amount) break;
      }
      if (processedData.amount) break;
    }

    // 4. Fecha del documento
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /(?:fecha|date)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i
    ];

    for (const pattern of datePatterns) {
      for (const line of lines) {
        const match = line.match(pattern);
        if (match) {
          processedData.documentDate = match[1];
          break;
        }
      }
      if (processedData.documentDate) break;
    }

    // 5. CIF/NIF/VAT
    const taxIdPatterns = [
      /(?:cif|nif|vat|tax)[\s:]*([a-z0-9\-]{8,12})/i,
      /([a-z]\d{8})/i, // Formato español CIF/NIF
      /(\d{8}[a-z])/i
    ];

    for (const pattern of taxIdPatterns) {
      const match = allText.match(pattern);
      if (match) {
        processedData.taxId = match[1].toUpperCase();
        break;
      }
    }

    // 6. Productos/Items (mejorado para A4)
    const itemLines = lines.filter(line => {
      return line.length > 15 && 
             line.length < 100 &&
             line.match(/\d+/) && 
             line.match(/[a-zA-Z]{3,}/) &&
             !line.match(/^(fecha|total|subtotal|iva|cif|nif)/i) &&
             !line.match(/^(calle|street|tel|email|www)/i);
    }).slice(0, 8); // Máximo 8 items para A4

    if (itemLines.length > 0) {
      processedData.items = itemLines;
    }

    return processedData;
  }
}

export const albaranService = new AlbaranService();