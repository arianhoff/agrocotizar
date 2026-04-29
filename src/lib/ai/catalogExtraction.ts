import type { ProductCategory, PaymentMode } from '@/types'
import { authFetch } from '@/lib/api'
import { PDFDocument } from 'pdf-lib'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedProduct {
  code: string
  name: string
  category: ProductCategory
  price: number
  currency: 'USD' | 'ARS'
  description?: string
}

export interface ExtractedOption {
  product_code: string   // código de la máquina a la que pertenece
  name: string
  price: number
  currency: 'USD' | 'ARS'
  requires_commission: boolean
}

export interface ExtractedPaymentCondition {
  label: string           // "Contado efectivo", "Cheques 90 días", etc.
  mode: PaymentMode
  discount_pct?: number
  num_checks?: number
  deposit_pct?: number
  installments?: number
  monthly_rate?: number
  lease_term_months?: number
  buyout_pct?: number
}

export interface ExtractedCatalogResult {
  products: ExtractedProduct[]
  options: ExtractedOption[]
  paymentConditions: ExtractedPaymentCondition[]
}

export type DiffStatus = 'new' | 'price_update' | 'unchanged'

export interface ProductDiff {
  extracted: ExtractedProduct
  status: DiffStatus
  oldPrice?: number
}

export interface OptionDiff {
  extracted: ExtractedOption
  status: DiffStatus
  oldPrice?: number
  targetProductId?: string
}

export interface CatalogDiff {
  productDiffs: ProductDiff[]
  optionDiffs: OptionDiff[]
}

export type SupportedMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'

const VALID_IMAGE_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos un asistente especializado en extraer listas de precios de maquinaria agrícola.
Analizá el documento y separalo en tres grupos:

**1. PRODUCTOS** (ítems que se venden de forma independiente con precio propio):
Asigná la categoría más precisa según el tipo de ítem:
- "Mixer / Unifeed" → mixers, unifeed, mezcladores de alimento
- "Tolva" → tolvas semilleras, graneleras, autodescargables
- "Embolsadora" → embolsadoras, moledoras-embolsadoras, extractoras
- "Tractor" → tractores de cualquier marca y potencia
- "Cosechadora" → cosechadoras, plataformas, cabezales
- "Sembradora" → sembradoras de grano fino o grueso
- "Pulverizadora" → pulverizadoras autopropulsadas o de arrastre
- "Repuesto / Accesorio" → repuestos sueltos, kits de repuesto, piezas
- "Servicio / Mano de obra" → servicios, revisiones, mano de obra
- "Implemento varios" → todo lo que no encaje en las categorías anteriores

**2. OPCIONALES / COMPLEMENTOS** (accesorios o extras de una máquina específica):
Son ítems que se agregan a una máquina puntual. Identificá a qué máquina pertenecen por su código.
Ejemplos: neumáticos, balanzas, revestimientos, kits, brazos hidráulicos, frenos, dosificadores, etc.
Si un opcional aplica a varias máquinas, duplicalo con cada código.

**3. CONDICIONES DE PAGO** (si el documento las incluye):
Extraé cada modalidad de pago mencionada. Campos:
- label: nombre descriptivo (ej: "Contado efectivo", "3 cheques a 90 días", "Financiado 12 cuotas")
- mode: uno de "contado" | "cheques" | "financiado" | "leasing"
- discount_pct: descuento porcentual si aplica (solo número, ej: 20)
- num_checks: cantidad de cheques si es modalidad cheques
- deposit_pct: % de anticipo si es financiado/leasing
- installments: cantidad de cuotas si es financiado
- monthly_rate: tasa mensual % si está indicada
- lease_term_months: plazo en meses si es leasing
Si no hay condiciones de pago en el documento, devolvé "payment_conditions": []

Reglas importantes:
- El precio debe ser número sin separadores de miles ni símbolo (ej: 27700 no "27.700" ni "U$S 27.700")
- Si la moneda no está explícita asumí ARS (pesos argentinos). Solo usá USD si el documento dice explícitamente "USD", "U$S", "dólar" o el precio no tiene signo $
- No dupliques productos con el mismo código
- En el campo "description" usá solo texto simple sin comillas internas
- requires_commission: true para la mayoría; false solo si el ítem explícitamente no lleva comisión
- Respondé ÚNICAMENTE con JSON válido sin texto adicional ni bloques de código

Formato exacto de respuesta:
{
  "products": [
    { "code": "string", "name": "string", "category": "string", "price": number, "currency": "ARS", "description": "string opcional sin comillas" }
  ],
  "options": [
    { "product_code": "string", "name": "string", "price": number, "currency": "ARS", "requires_commission": true }
  ],
  "payment_conditions": [
    { "label": "string", "mode": "contado", "discount_pct": 20 }
  ]
}`

// ─── JSON extractor ───────────────────────────────────────────────────────────

function safeParseJSON(raw: string): { products?: unknown[]; options?: unknown[]; payment_conditions?: unknown[] } {
  // Strip markdown code fences
  let clean = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim()

  // Find the outermost JSON object
  const start = clean.indexOf('{')
  const end   = clean.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('La IA no devolvió JSON válido. Intentá con un archivo diferente.')
  }
  clean = clean.slice(start, end + 1)

  // Attempt 1: direct parse
  try {
    return JSON.parse(clean) as { products?: unknown[]; options?: unknown[] }
  } catch { /* fall through */ }

  // Attempt 2: sanitize description fields (remove or escape inner quotes)
  const sanitized = clean
    // Replace literal newlines inside strings
    .replace(/("(?:[^"\\]|\\.)*")/g, (m) => m.replace(/\n/g, ' ').replace(/\r/g, ''))
    // Remove description entirely if it's causing issues
    .replace(/"description"\s*:\s*"(?:[^"\\]|\\.)*"/g, '"description": ""')

  try {
    return JSON.parse(sanitized) as { products?: unknown[]; options?: unknown[] }
  } catch { /* fall through */ }

  // Attempt 3: strip trailing commas (common mistake in LLM JSON)
  const noTrailing = sanitized.replace(/,\s*([\]}])/g, '$1')
  try {
    return JSON.parse(noTrailing) as { products?: unknown[]; options?: unknown[] }
  } catch (finalErr) {
    throw new Error(
      `No se pudo interpretar la respuesta de la IA. ` +
      `Intentá con un archivo más pequeño o en formato diferente. ` +
      `(${finalErr instanceof Error ? finalErr.message : String(finalErr)})`
    )
  }
}

// ─── Partial JSON extractor (for streaming) ───────────────────────────────────

function extractCompleteObjects(text: string, arrayKey: 'products' | 'options'): any[] {
  const keyIdx = text.indexOf(`"${arrayKey}"`)
  if (keyIdx === -1) return []
  const bracketIdx = text.indexOf('[', keyIdx)
  if (bracketIdx === -1) return []

  const objects: any[] = []
  let i = bracketIdx + 1
  let depth = 0
  let objStart = -1
  let inString = false
  let escaping = false

  while (i < text.length) {
    const ch = text[i]
    if (escaping) { escaping = false; i++; continue }
    if (ch === '\\' && inString) { escaping = true; i++; continue }
    if (ch === '"') { inString = !inString; i++; continue }
    if (inString) { i++; continue }

    if (ch === '{') {
      if (depth === 0) objStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objStart !== -1) {
        try { objects.push(JSON.parse(text.slice(objStart, i + 1))) } catch { /* incomplete */ }
        objStart = -1
      }
    } else if (ch === ']' && depth === 0) {
      break
    }
    i++
  }

  return objects
}

// ─── PDF splitting ────────────────────────────────────────────────────────────

// Vercel serverless body limit: 4.5 MB.
// pdf-lib re-serializes PDFs without preserving compression, so output can be
// larger than input. Target 2 MB actual saved bytes → ~2.7 MB base64 → safe.
const MAX_CHUNK_BYTES = 2 * 1024 * 1024

/** Converts a Uint8Array to base64 without stack overflow on large arrays. */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let k = 0; k < bytes.byteLength; k++) binary += String.fromCharCode(bytes[k])
  return btoa(binary)
}

/**
 * Splits a PDF base64 into chunks that each fit within MAX_CHUNK_BYTES.
 * Estimates pages per chunk with a 1.5× safety factor for pdf-lib expansion,
 * then falls back to 1-page chunks if any chunk is still over the limit.
 */
async function splitPDFIntoChunks(base64: string): Promise<string[]> {
  const pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const totalPages = pdfDoc.getPageCount()

  if (pdfBytes.length <= MAX_CHUNK_BYTES) return [base64]

  // Estimate pages per chunk. Apply 1.5× safety factor because pdf-lib
  // re-serialization typically inflates the output vs. the original.
  const bytesPerPage = pdfBytes.length / totalPages
  const pagesPerChunk = Math.max(1, Math.floor(MAX_CHUNK_BYTES / (bytesPerPage * 1.5)))

  const chunks: string[] = []

  for (let i = 0; i < totalPages; i += pagesPerChunk) {
    const end = Math.min(i + pagesPerChunk, totalPages)
    const chunkDoc = await PDFDocument.create()
    const indices = Array.from({ length: end - i }, (_, j) => i + j)
    const copiedPages = await chunkDoc.copyPages(pdfDoc, indices)
    copiedPages.forEach(p => chunkDoc.addPage(p))
    const chunkBytes = await chunkDoc.save()

    if (chunkBytes.byteLength > MAX_CHUNK_BYTES && end - i > 1) {
      // Still too large after estimation — fall back to 1 page at a time
      for (let j = i; j < end; j++) {
        const singleDoc = await PDFDocument.create()
        const [page] = await singleDoc.copyPages(pdfDoc, [j])
        singleDoc.addPage(page)
        const singleBytes = await singleDoc.save()
        chunks.push(uint8ToBase64(singleBytes))
      }
    } else {
      chunks.push(uint8ToBase64(chunkBytes))
    }
  }

  return chunks
}

/**
 * Merges multiple ExtractedCatalogResult objects into one, deduplicating by product code.
 * Later chunks win on price (in case the same product appears in multiple chunks).
 */
function mergeResults(results: ExtractedCatalogResult[]): ExtractedCatalogResult {
  const productMap = new Map<string, ExtractedProduct>()
  const optionSet = new Set<string>()
  const mergedOptions: ExtractedOption[] = []
  const conditionSet = new Set<string>()
  const mergedConditions: ExtractedPaymentCondition[] = []

  for (const r of results) {
    for (const p of r.products) {
      productMap.set(p.code.toLowerCase().trim(), p)
    }
    for (const o of r.options) {
      const key = `${o.product_code}::${o.name}`.toLowerCase()
      if (!optionSet.has(key)) {
        optionSet.add(key)
        mergedOptions.push(o)
      }
    }
    for (const c of r.paymentConditions) {
      if (!conditionSet.has(c.label)) {
        conditionSet.add(c.label)
        mergedConditions.push(c)
      }
    }
  }

  return {
    products: Array.from(productMap.values()),
    options: mergedOptions,
    paymentConditions: mergedConditions,
  }
}

// ─── API call ─────────────────────────────────────────────────────────────────

export interface ExtractionProgress {
  products: ExtractedProduct[]
  options: ExtractedOption[]
  chunk?: { current: number; total: number }
}

export async function extractCatalogFromFile(
  base64Data: string,
  mediaType: SupportedMediaType,
  _apiKey: string,  // kept for backwards compatibility, ignored — key lives in server env
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractedCatalogResult> {
  const isImage = VALID_IMAGE_TYPES.includes(mediaType)

  // ── Split PDF into chunks if too large for a single request ──────────────────
  if (!isImage && mediaType === 'application/pdf') {
    const rawBytes = atob(base64Data).length
    if (rawBytes > MAX_CHUNK_BYTES) {
      const chunks = await splitPDFIntoChunks(base64Data)
      const results: ExtractedCatalogResult[] = []
      let accumulated: ExtractionProgress = { products: [], options: [] }

      for (let i = 0; i < chunks.length; i++) {
        const chunkResult = await extractSingleChunk(
          chunks[i],
          'application/pdf',
          (progress) => {
            // Merge streaming progress from this chunk with all previous chunks
            accumulated = {
              products: [...results.flatMap(r => r.products), ...progress.products],
              options:  [...results.flatMap(r => r.options),  ...progress.options],
              chunk: { current: i + 1, total: chunks.length },
            }
            onProgress?.(accumulated)
          }
        )
        results.push(chunkResult)
        accumulated = {
          products: results.flatMap(r => r.products),
          options:  results.flatMap(r => r.options),
          chunk: { current: i + 1, total: chunks.length },
        }
        onProgress?.(accumulated)
      }

      return mergeResults(results)
    }
  }

  return extractSingleChunk(base64Data, mediaType, onProgress)
}

async function extractSingleChunk(
  base64Data: string,
  mediaType: SupportedMediaType,
  onProgress?: (progress: ExtractionProgress) => void
): Promise<ExtractedCatalogResult> {
  const isImage = VALID_IMAGE_TYPES.includes(mediaType)

  const contentBlock = isImage
    ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } }
    : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }

  const requestBody = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        {
          type: 'text',
          text: 'Extraé todos los productos y opcionales de esta lista de precios. Separalos correctamente por categoría. Respondé solo con el JSON, sin texto adicional.',
        },
      ],
    }],
  }

  // ── Try streaming first; fall back to non-streaming if body not available ──
  let useStreaming = !!onProgress

  if (useStreaming) {
    try {
      const response = await authFetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestBody, stream: true }),
      })

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Una parte del PDF superó el límite del servidor. Intentá con un archivo más pequeño o menos páginas por hoja.')
        }
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Error API ${response.status}`)
      }

      if (!response.body) {
        useStreaming = false
      } else {
        // ── Stream SSE response ──────────────────────────────────────────────
        const reader  = response.body.getReader()
        const decoder = new TextDecoder()
        let accumulated  = ''
        let lineBuffer   = ''
        let lastProdLen  = 0
        let lastOptLen   = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          lineBuffer += decoder.decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer  = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const evt = JSON.parse(data)
              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                accumulated += evt.delta.text

                if (onProgress) {
                  const prods = extractCompleteObjects(accumulated, 'products')
                    .filter((p: any) => p.code && p.name && typeof p.price === 'number') as ExtractedProduct[]
                  const opts  = extractCompleteObjects(accumulated, 'options')
                    .filter((o: any) => o.product_code && o.name && typeof o.price === 'number') as ExtractedOption[]

                  if (prods.length !== lastProdLen || opts.length !== lastOptLen) {
                    lastProdLen = prods.length
                    lastOptLen  = opts.length
                    onProgress({ products: prods, options: opts })
                  }
                }
              }
            } catch { /* skip malformed SSE line */ }
          }
        }

        const parsed = safeParseJSON(accumulated)
        const products = (parsed.products ?? [])
          .filter((p: any) => p.code && p.name && typeof p.price === 'number') as ExtractedProduct[]
        const options = (parsed.options ?? [])
          .filter((o: any) => o.product_code && o.name && typeof o.price === 'number') as ExtractedOption[]
        const paymentConditions = (parsed.payment_conditions ?? [])
          .filter((c: any) => c.label && c.mode) as ExtractedPaymentCondition[]

        return { products, options, paymentConditions }
      }
    } catch (err) {
      // If streaming fails (network error, CORS, etc.), fall through to non-streaming
      if (!(err instanceof Error) || err.message.includes('API')) throw err
      // Network-level error — try non-streaming fallback
      useStreaming = false
    }
  }

  // ── Non-streaming fallback ─────────────────────────────────────────────────
  let response: Response
  try {
    response = await authFetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })
  } catch {
    throw new Error(
      'No se pudo conectar con el servidor. ' +
      'Verificá tu conexión a internet. ' +
      'Si el archivo es muy grande (más de 20 MB), intentá con un PDF de menos páginas.'
    )
  }

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('El archivo es demasiado grande para el servidor. El límite es ~3 MB para PDFs. Comprimí el PDF o dividilo en partes más pequeñas.')
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Error API ${response.status}`)
  }

  const data = await response.json()
  const raw  = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
  const parsed = safeParseJSON(raw)

  const products = (parsed.products ?? [])
    .filter((p: any) => p.code && p.name && typeof p.price === 'number') as ExtractedProduct[]
  const options = (parsed.options ?? [])
    .filter((o: any) => o.product_code && o.name && typeof o.price === 'number') as ExtractedOption[]
  const paymentConditions = (parsed.payment_conditions ?? [])
    .filter((c: any) => c.label && c.mode) as ExtractedPaymentCondition[]

  return { products, options, paymentConditions }
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

export function diffCatalog(
  result: ExtractedCatalogResult,
  existingProducts: { id: string; code: string; base_price: number }[],
  existingOptions: Record<string, { id: string; name: string; price: number }[]>,
): CatalogDiff {
  const normalize = (s: string) => s.toLowerCase().trim()

  const productDiffs: ProductDiff[] = result.products.map(ext => {
    const match = existingProducts.find(e => normalize(e.code) === normalize(ext.code))
    if (!match) return { extracted: ext, status: 'new' }
    if (Math.round(match.base_price) !== Math.round(ext.price))
      return { extracted: ext, status: 'price_update', oldPrice: match.base_price }
    return { extracted: ext, status: 'unchanged' }
  })

  const optionDiffs: OptionDiff[] = result.options.map(ext => {
    const targetProduct = existingProducts.find(p => normalize(p.code) === normalize(ext.product_code))
    const targetProductId = targetProduct?.id

    const existingOpts = targetProductId ? (existingOptions[targetProductId] ?? []) : []
    const matchOpt = existingOpts.find(o => normalize(o.name) === normalize(ext.name))

    if (!matchOpt) return { extracted: ext, status: 'new', targetProductId }
    if (Math.round(matchOpt.price) !== Math.round(ext.price))
      return { extracted: ext, status: 'price_update', oldPrice: matchOpt.price, targetProductId }
    return { extracted: ext, status: 'unchanged', targetProductId }
  })

  return { productDiffs, optionDiffs }
}

// ─── Payment-conditions-only extraction ──────────────────────────────────────

const PAYMENT_ONLY_PROMPT = `Sos un asistente especializado en extraer condiciones de pago de documentos comerciales de maquinaria agrícola.
Analizá el documento y extraé ÚNICAMENTE las condiciones de pago. Ignorá precios, productos, y cualquier otra información.

Por cada modalidad de pago encontrada, extraé:
- label: nombre descriptivo (ej: "Contado efectivo", "3 cheques a 90 días", "Financiado 12 cuotas BICE")
- mode: uno de "contado" | "cheques" | "financiado" | "leasing"
- discount_pct: descuento porcentual si aplica (solo número, ej: 20)
- num_checks: cantidad de cheques si es modalidad cheques
- deposit_pct: % de anticipo si es financiado/leasing
- installments: cantidad de cuotas si es financiado
- monthly_rate: tasa mensual % si está indicada
- lease_term_months: plazo en meses si es leasing

Respondé ÚNICAMENTE con JSON válido, sin texto adicional:
{ "payment_conditions": [ { "label": "string", "mode": "contado", "discount_pct": 20 } ] }`

/**
 * Extrae SOLO condiciones de pago de un archivo (PDF o imagen).
 * Usa un prompt optimizado que ignora productos/precios.
 */
export async function extractPaymentConditionsFromFile(
  base64Data: string,
  mediaType: SupportedMediaType,
): Promise<ExtractedPaymentCondition[]> {
  const isImage = VALID_IMAGE_TYPES.includes(mediaType)
  const contentBlock = isImage
    ? { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType, data: base64Data } }
    : { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }

  const response = await authFetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: PAYMENT_ONLY_PROMPT,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: 'Extraé todas las condiciones de pago de este documento. Respondé solo con el JSON.' },
        ],
      }],
    }),
  })

  if (!response.ok) {
    if (response.status === 413) {
      throw new Error('El archivo es demasiado grande para el servidor. El límite es ~3 MB para PDFs. Comprimí el PDF o dividilo en partes más pequeñas.')
    }
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Error API ${response.status}`)
  }

  const data = await response.json()
  const raw  = (data.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
  const parsed = safeParseJSON(raw)
  return ((parsed.payment_conditions ?? []) as any[])
    .filter((c: any) => c.label && c.mode) as ExtractedPaymentCondition[]
}

// ─── File reader ──────────────────────────────────────────────────────────────

export function readFileAsBase64(file: File): Promise<{ base64: string; mediaType: SupportedMediaType }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const [header, base64] = result.split(',')
      const mediaType = header.replace('data:', '').replace(';base64', '') as SupportedMediaType
      resolve({ base64, mediaType })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
