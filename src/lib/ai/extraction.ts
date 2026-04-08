import type { AIQuoteExtraction, Product } from '@/types'

// ─── System prompt builder (uses user catalog) ────────────────────────────────

function buildCatalogString(products: Product[]): string {
  if (products.length === 0) return '(Sin catálogo cargado — el usuario indicará productos y precios manualmente)'
  return products.map(p =>
    `• [${p.code}] ${p.name} — ${p.currency} ${p.base_price.toLocaleString('es-AR')} (${p.category})`
  ).join('\n')
}

export function buildSystemPrompt(products: Product[]): string {
  return `Sos un asistente especializado en cotizaciones de maquinaria agrícola para Argentina.

=== CATÁLOGO DE PRODUCTOS ===
${buildCatalogString(products)}

=== REGLAS ===
1. Extraé toda la información de cotización del mensaje del usuario.
2. Si el producto está en el catálogo, usá el precio exacto del catálogo.
3. "Contado" → payment.mode:"contado", discount_pct:20.
4. "3 cheques/valores" → mode:"cheques", discount_pct:15. "7 valores"→8%. "10 valores"→3%. "12 valores"→0%.
5. Si dicen "financiado"/"cuotas" → mode:"financiado". "Leasing" → mode:"leasing".
6. Usá la moneda del producto del catálogo cuando corresponda.
7. Si el precio del catálogo ya incluye IVA, usá iva_pct:0.

Respondé ÚNICAMENTE con JSON válido sin texto adicional, backticks ni markdown.

Estructura (solo incluí campos que puedas inferir):
{
  "client": { "name": "string", "province": "string", "city": "string", "cuit": "string" },
  "currency": "USD|ARS",
  "exchange_rate": number,
  "items": [
    { "description": "string", "category": "string", "quantity": number, "unit_price": number, "discount_pct": number }
  ],
  "discounts": [
    { "type": "discount|surcharge", "concept": "string", "percentage": number }
  ],
  "payment": {
    "mode": "contado|cheques|financiado|leasing",
    "discount_pct": number,
    "deposit_pct": number,
    "installments": number,
    "monthly_rate": number,
    "num_checks": number,
    "lease_term_months": number,
    "buyout_pct": number,
    "lease_rate": number
  },
  "taxes": { "iva_pct": number, "iibb_pct": number },
  "delivery": { "freight": number, "estimated_days": "string" },
  "notes": "string"
}`
}

// ─── API call ─────────────────────────────────────────────────────────────────

export async function extractQuoteFromText(text: string, products: Product[]): Promise<AIQuoteExtraction> {
  const response = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: buildSystemPrompt(products),
      messages: [{ role: 'user', content: text }],
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Error del servidor ${response.status}`)
  }

  const data = await response.json()
  const raw = data.content?.map((b: { text?: string }) => b.text ?? '').join('') ?? ''
  const clean = raw.replace(/```json|```/g, '').trim()

  return JSON.parse(clean) as AIQuoteExtraction
}

// ─── Category icons ───────────────────────────────────────────────────────────

export const CATEGORY_ICONS: Record<string, string> = {
  'Mixer / Unifeed':        '🥣',
  'Tolva':                  '🌾',
  'Embolsadora':            '📦',
  'Tractor':                '🚜',
  'Cosechadora':            '🌿',
  'Sembradora':             '🌱',
  'Pulverizadora':          '💧',
  'Repuesto / Accesorio':   '🔩',
  'Servicio / Mano de obra':'🔧',
  'Implemento varios':      '⚙️',
}
