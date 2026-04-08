import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quote, QuoteStatus, QuoteTotals } from '@/types'

export interface SavedQuote {
  id: string
  quote_number: string
  status: QuoteStatus
  currency: 'USD' | 'ARS'
  exchange_rate: number
  total: number
  valid_days: number
  notes?: string
  data: Quote & { totals?: QuoteTotals }
  created_at: string
  updated_at: string
}

interface SavedQuotesStore {
  quotes: SavedQuote[]
  upsert: (quote: SavedQuote) => void
  updateStatus: (id: string, status: QuoteStatus) => void
  remove: (id: string) => void
  getByStatus: (status?: QuoteStatus) => SavedQuote[]
}

export const useSavedQuotesStore = create<SavedQuotesStore>()(
  persist(
    (set, get) => ({
      quotes: [],

      upsert: (q) => set(s => {
        const exists = s.quotes.findIndex(x => x.id === q.id)
        if (exists >= 0) {
          const updated = [...s.quotes]
          updated[exists] = q
          return { quotes: updated }
        }
        return { quotes: [q, ...s.quotes] }
      }),

      updateStatus: (id, status) => set(s => ({
        quotes: s.quotes.map(q => q.id === id ? { ...q, status, updated_at: new Date().toISOString() } : q),
      })),

      remove: (id) => set(s => ({ quotes: s.quotes.filter(q => q.id !== id) })),

      getByStatus: (status) => {
        const all = get().quotes
        return status ? all.filter(q => q.status === status) : all
      },
    }),
    { name: 'agrocotizar-quotes' }
  )
)
