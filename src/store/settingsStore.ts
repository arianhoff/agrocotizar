import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'

export interface SellerProfile {
  name: string
  role: string
  email: string
  phone: string
  whatsapp: string
}

export interface CompanyProfile {
  name: string
  cuit: string
  address: string
  city: string
  province: string
  phone: string
  email: string
  website: string
  logo_base64: string   // data:image/... base64
}

export interface QuoteDefaults {
  prefix: string
  currency: 'USD' | 'ARS'
  exchange_rate: number
  valid_days: number
  payment_mode: 'contado' | 'cheques' | 'financiado' | 'leasing'
  payment_discount_pct: number
  iva_pct: number
  default_notes: string
}

interface SettingsStore {
  seller: SellerProfile
  company: CompanyProfile
  quoteDefaults: QuoteDefaults

  updateSeller: (patch: Partial<SellerProfile>) => void
  updateCompany: (patch: Partial<CompanyProfile>) => void
  updateQuoteDefaults: (patch: Partial<QuoteDefaults>) => void
  hydrate: (settings: { seller?: Partial<SellerProfile>; company?: Partial<CompanyProfile>; quoteDefaults?: Partial<QuoteDefaults> }) => void
  clear: () => void
}

const DEFAULT_SELLER: SellerProfile = {
  name: '',
  role: 'Vendedor',
  email: '',
  phone: '',
  whatsapp: '',
}

const DEFAULT_COMPANY: CompanyProfile = {
  name: '',
  cuit: '',
  address: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  website: '',
  logo_base64: '',
}

const DEFAULT_QUOTE_DEFAULTS: QuoteDefaults = {
  prefix: 'COT-',
  currency: 'USD',
  exchange_rate: 1150,
  valid_days: 15,
  payment_mode: 'contado',
  payment_discount_pct: 20,
  iva_pct: 0,
  default_notes: '',
}

// Fire-and-forget save to profiles.settings
function syncSettings(seller: SellerProfile, company: CompanyProfile, quoteDefaults: QuoteDefaults) {
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return
    supabase.from('profiles')
      .update({ settings: { seller, company, quoteDefaults } })
      .eq('id', user.id)
      .then()
  })
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      seller: DEFAULT_SELLER,
      company: DEFAULT_COMPANY,
      quoteDefaults: DEFAULT_QUOTE_DEFAULTS,

      updateSeller: (patch) => {
        set(s => ({ seller: { ...s.seller, ...patch } }))
        const { seller, company, quoteDefaults } = get()
        syncSettings(seller, company, quoteDefaults)
      },

      updateCompany: (patch) => {
        set(s => ({ company: { ...s.company, ...patch } }))
        const { seller, company, quoteDefaults } = get()
        syncSettings(seller, company, quoteDefaults)
      },

      updateQuoteDefaults: (patch) => {
        set(s => ({ quoteDefaults: { ...s.quoteDefaults, ...patch } }))
        const { seller, company, quoteDefaults } = get()
        syncSettings(seller, company, quoteDefaults)
      },

      hydrate: ({ seller, company, quoteDefaults }) => {
        set(s => ({
          seller: seller ? { ...DEFAULT_SELLER, ...seller } : s.seller,
          company: company ? { ...DEFAULT_COMPANY, ...company } : s.company,
          quoteDefaults: quoteDefaults ? { ...DEFAULT_QUOTE_DEFAULTS, ...quoteDefaults } : s.quoteDefaults,
        }))
      },

      clear: () => set({
        seller: DEFAULT_SELLER,
        company: DEFAULT_COMPANY,
        quoteDefaults: DEFAULT_QUOTE_DEFAULTS,
      }),
    }),
    { name: 'agrocotizar-settings' }
  )
)
