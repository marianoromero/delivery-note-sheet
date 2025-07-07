# Nueva Arquitectura con IDP y Supabase

## Descripción General

La aplicación ha sido migrada a una arquitectura moderna que utiliza:
- **Frontend**: React PWA (sin cambios en la UI)
- **Backend**: Supabase (Base de datos PostgreSQL + Storage + Edge Functions)
- **IDP**: Servicios de procesamiento de documentos (Google Cloud Document AI, AWS Textract, o Azure Form Recognizer)

## Flujo de Procesamiento

### 1. Captura de Imagen (Frontend)
```
Usuario captura imagen → Canvas → Blob
```

### 2. Subida a Supabase Storage
```
Blob → Supabase Storage → URL pública + path interno
```

### 3. Creación de Registro
```
Registro en tabla 'albaranes' con status 'pending'
```

### 4. Procesamiento IDP (Edge Function)
```
Edge Function → IDP Service → Datos estructurados → Base de datos
```

## Estructura de Base de Datos

### Tabla: `albaranes`
```sql
- id (UUID, PK)
- created_at (timestamp)
- updated_at (timestamp)
- image_url (text) - URL pública de la imagen
- image_path (text) - Path interno en Storage
- status (enum) - pending, processing, completed, failed
- supplier (text)
- document_number (text)
- document_date (date)
- tax_id (text)
- total_amount (decimal)
- currency (text)
- raw_text (text)
- processing_metadata (jsonb)
```

### Tabla: `albaran_items`
```sql
- id (UUID, PK)
- albaran_id (UUID, FK)
- description (text)
- quantity (decimal)
- unit_price (decimal)
- total_price (decimal)
- line_number (integer)
```

## Configuración Requerida

### 1. Supabase
1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar migración: `supabase/migrations/001_create_albaranes_tables.sql`
3. Crear bucket de Storage: `albaran-images`
4. Configurar variables de entorno en `.env`:
   ```
   REACT_APP_SUPABASE_URL=tu_url_de_supabase
   REACT_APP_SUPABASE_ANON_KEY=tu_clave_anonima
   ```

### 2. Edge Function
1. Desplegar la función: `supabase functions deploy process-albaran-idp`
2. Configurar secrets para el servicio IDP elegido

### 3. Servicio IDP (elegir uno)

#### Opción A: Google Cloud Document AI
```bash
# Variables en Supabase Edge Function
GOOGLE_CLOUD_PROJECT_ID=tu_proyecto
GOOGLE_CLOUD_LOCATION=us
GOOGLE_CLOUD_PROCESSOR_ID=tu_processor_id
GOOGLE_CLOUD_API_KEY=tu_api_key
```

#### Opción B: AWS Textract
```bash
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1
```

#### Opción C: Azure Form Recognizer
```bash
AZURE_FORM_RECOGNIZER_ENDPOINT=tu_endpoint
AZURE_FORM_RECOGNIZER_KEY=tu_key
```

## Ventajas de la Nueva Arquitectura

### Escalabilidad
- Almacenamiento en la nube (no localStorage)
- Procesamiento serverless
- Base de datos PostgreSQL completa

### Precisión
- Servicios IDP profesionales (95%+ precisión)
- Procesamiento de imágenes optimizado
- Extracción de datos estructurados

### Funcionalidad
- Búsqueda avanzada en base de datos
- Análisis y reportes
- Integración con sistemas externos
- Backup automático

### Mantenimiento
- Código más modular
- Separación clara de responsabilidades
- Fácil actualización de servicios

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm start

# Supabase local (opcional)
supabase start
supabase db reset
supabase functions serve

# Despliegue
npm run build
supabase functions deploy process-albaran-idp
```

## Migración desde Arquitectura Anterior

Los usuarios existentes pueden:
1. Exportar datos del localStorage (botón en la app)
2. Importar manualmente si es necesario
3. Empezar a usar la nueva arquitectura inmediatamente

La aplicación mantiene toda la funcionalidad anterior pero con mayor robustez y precisión.