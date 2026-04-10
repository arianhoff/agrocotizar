// ─── Auth & Multi-tenant ──────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string          // "Concesionario Los Sauces"
  slug: string          // "los-sauces" – used in URLs
  logo_url?: string
  phone?: string
  email?: string
  address?: string
  created_at: string
}

export interface User {
  id: string
  tenant_id: string
  email: string
  full_name: string
  role: 'admin' | 'seller' | 'viewer'
  avatar_url?: string
  created_at: string
}

// ─── Catalog & Products ───────────────────────────────────────────────────────

export type ProductCategory =
  | 'Mixer / Unifeed'
  | 'Tolva'
  | 'Embolsadora'
  | 'Implemento varios'
  | 'Repuesto / Accesorio'
  | 'Tractor'
  | 'Cosechadora'
  | 'Sembradora'
  | 'Pulverizadora'
  | 'Servicio / Mano de obra'

export interface PaymentConditionTemplate {
  id: string
  label: string           // "Contado transferencia", "Cheques 3 valores", etc.
  condition: PaymentCondition
}

export interface PriceList {
  id: string
  tenant_id: string
  brand: string         // "GEA", "John Deere", etc.
  name: string          // "Lista Enero 2026"
  currency: 'USD' | 'ARS'
  valid_from: string
  valid_until?: string
  is_active: boolean
  iva_included: boolean
  iva_rate: number      // 10.5
  created_at: string
  payment_conditions?: PaymentConditionTemplate[]
}

export interface Product {
  id: string
  price_list_id: string
  code: string
  name: string
  description?: string
  category: ProductCategory
  base_price: number
  currency: 'USD' | 'ARS'
}

export interface ProductOption {
  id: string
  product_id: string
  name: string
  price: number
  currency?: 'USD' | 'ARS'
  requires_commission: boolean  // false for neumáticos de tolvas
}

// ─── Payment Conditions ───────────────────────────────────────────────────────

export type PaymentMode = 'contado' | 'cheques' | 'financiado' | 'leasing'

export interface PaymentCondition {
  mode: PaymentMode
  // Contado / Cheques
  discount_pct: number
  instrument?: 'transferencia' | 'echeq' | 'cheque_cert' | 'efectivo'
  bank_account?: string
  // Cheques
  num_checks?: number
  check_dates?: string[]          // ISO date strings
  // Financiado
  deposit_pct?: number
  installments?: number
  monthly_rate?: number
  credit_type?: 'prendario' | 'personal' | 'convenio' | 'fae_bice'
  financial_entity?: string
  // Leasing
  lease_term_months?: number
  buyout_pct?: number
  lease_rate?: number
  lease_company?: string
}

// ─── Quotation ────────────────────────────────────────────────────────────────

export interface QuoteClient {
  name: string
  cuit?: string
  address?: string
  province?: string
  city?: string
  phone?: string
  email?: string
  iva_condition?: string   // Responsable Inscripto, Monotributista, etc.
}

export interface QuoteItem {
  id: string
  product_id?: string         // linked to catalog
  description: string
  category: ProductCategory
  quantity: number
  unit_price: number
  discount_pct: number
  // computed
  subtotal: number
}

export interface QuoteDiscount {
  id: string
  type: 'discount' | 'surcharge'
  concept: string
  percentage: number
}

export interface QuoteTax {
  iva_pct: number             // 0 if included in price
  iibb_pct: number
  other_pct: number
  other_label?: string
}

export interface QuoteDelivery {
  location: 'planta' | 'campo' | 'acordar'
  freight: number
  estimated_days?: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'

export interface Quote {
  id: string
  tenant_id: string
  seller_id: string
  quote_number: string        // "COT-0001"
  status: QuoteStatus
  client: QuoteClient
  currency: 'USD' | 'ARS'
  exchange_rate: number
  items: QuoteItem[]
  discounts: QuoteDiscount[]
  payment: PaymentCondition
  taxes: QuoteTax
  delivery: QuoteDelivery
  valid_days: number
  notes?: string
  created_at: string
  updated_at: string
  // computed totals (derived, not stored)
  totals?: QuoteTotals
  // user-selected conditions to show in PDF comparison table
  payment_comparison_conditions?: PaymentConditionTemplate[]
}

export interface QuoteTotals {
  gross: number
  item_discounts: number
  general_discounts: number
  payment_discount: number
  net: number
  freight: number
  iibb: number
  other_tax: number
  tax_base: number
  iva: number
  total: number
  total_ars?: number
  // Financing
  deposit?: number
  installment_amount?: number
  total_financed?: number
}

// ─── AI Chat ─────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ─── CRM / Seguimientos ──────────────────────────────────────────────────────

export interface FollowUp {
  id: string
  quote_id: string
  quote_number: string
  client_name: string
  client_phone?: string
  client_email?: string
  seller_email?: string
  scheduled_date: string  // YYYY-MM-DD
  reminder_days: number   // re-agendar cada N días si no hay respuesta
  notes: string
  status: 'pending' | 'done' | 'cancelled'
  created_at: string
  sent_at?: string        // fecha en que se envió la cotización
}

export interface AIQuoteExtraction {
  client?: Partial<QuoteClient>
  currency?: 'USD' | 'ARS'
  exchange_rate?: number
  items?: Partial<QuoteItem>[]
  discounts?: Partial<QuoteDiscount>[]
  payment?: Partial<PaymentCondition>
  taxes?: Partial<QuoteTax>
  delivery?: Partial<QuoteDelivery>
  notes?: string
}
