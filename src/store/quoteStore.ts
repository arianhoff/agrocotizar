import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type {
  Quote, QuoteItem, QuoteDiscount, PaymentCondition,
  QuoteTotals, QuoteClient, QuoteTax, QuoteDelivery, PaymentConditionTemplate,
} from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9)

const newQuote = (): Quote => ({
  id: uid(),
  tenant_id: '',
  seller_id: '',
  quote_number: `COT-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  status: 'draft',
  client: { name: '', province: '', city: '' },
  currency: 'ARS' as const,  // always ARS — USD shown as secondary reference via exchange_rate
  exchange_rate: 1150,
  items: [],
  discounts: [],
  payment: { mode: 'contado', discount_pct: 20 },
  taxes: { iva_pct: 0, iibb_pct: 0, other_pct: 0 },
  delivery: { location: 'planta', freight: 0 },
  valid_days: 15,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

export function computeTotals(quote: Quote): QuoteTotals {
  // 1. Gross + per-item discounts
  let gross = 0
  let itemDiscounts = 0
  for (const item of quote.items) {
    const bruto = item.unit_price * item.quantity
    const desc = bruto * (item.discount_pct / 100)
    gross += bruto
    itemDiscounts += desc
  }

  // 2. General discounts / surcharges
  let base = gross - itemDiscounts
  let generalDiscounts = 0
  for (const d of quote.discounts) {
    const amount = base * (d.percentage / 100)
    if (d.type === 'discount') generalDiscounts += amount
    else generalDiscounts -= amount   // surcharge reduces the "discount" total
  }
  base = base - generalDiscounts

  // 3. Payment discount (contado / cheques)
  let paymentDiscount = 0
  if (quote.payment.mode === 'contado' || quote.payment.mode === 'cheques') {
    paymentDiscount = base * ((quote.payment.discount_pct ?? 0) / 100)
    base -= paymentDiscount
  }

  // 4. Freight + taxes
  const freight = quote.delivery.freight ?? 0
  const iibb = base * (quote.taxes.iibb_pct / 100)
  const other = base * (quote.taxes.other_pct / 100)
  const taxBase = base + freight + iibb + other
  const iva = taxBase * (quote.taxes.iva_pct / 100)
  const total = taxBase + iva

  // 5. Financing
  let deposit: number | undefined
  let installmentAmount: number | undefined
  let totalFinanced: number | undefined

  if (quote.payment.mode === 'financiado') {
    const dep = quote.payment.deposit_pct ?? 30
    const n = quote.payment.installments ?? 12
    const rate = (quote.payment.monthly_rate ?? 0) / 100
    deposit = total * (dep / 100)
    const saldo = total - deposit
    if (rate === 0) {
      installmentAmount = saldo / n
    } else {
      installmentAmount = saldo * rate * Math.pow(1 + rate, n) / (Math.pow(1 + rate, n) - 1)
    }
    totalFinanced = deposit + installmentAmount * n
  }

  if (quote.payment.mode === 'leasing') {
    const months = quote.payment.lease_term_months ?? 36
    const buyout = (quote.payment.buyout_pct ?? 10) / 100
    const rate = (quote.payment.lease_rate ?? 0) / 100
    const valorOpcion = total * buyout
    const capital = total - valorOpcion
    if (rate === 0) {
      installmentAmount = capital / months
    } else {
      installmentAmount = capital * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1)
    }
    totalFinanced = installmentAmount * months + valorOpcion
  }

  return {
    gross,
    item_discounts: itemDiscounts,
    general_discounts: generalDiscounts,
    payment_discount: paymentDiscount,
    net: base,
    freight,
    iibb,
    other_tax: other,
    tax_base: taxBase,
    iva,
    total,
    total_ars: quote.currency === 'ARS' ? total : total * quote.exchange_rate,
    deposit,
    installment_amount: installmentAmount,
    total_financed: totalFinanced,
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface QuoteStore {
  quote: Quote
  totals: QuoteTotals

  // Quote-level actions
  resetQuote: () => void
  setClient: (client: Partial<QuoteClient>) => void
  setCurrency: (currency: 'USD' | 'ARS') => void
  setExchangeRate: (rate: number) => void
  setValidDays: (days: number) => void
  setNotes: (notes: string) => void
  setQuoteNumber: (num: string) => void

  // Items
  addItem: (item?: Partial<QuoteItem>) => void
  updateItem: (id: string, patch: Partial<QuoteItem>) => void
  removeItem: (id: string) => void

  // Discounts
  addDiscount: () => void
  updateDiscount: (id: string, patch: Partial<QuoteDiscount>) => void
  removeDiscount: (id: string) => void

  // Payment
  setPayment: (payment: Partial<PaymentCondition>) => void

  // Taxes
  setTaxes: (taxes: Partial<QuoteTax>) => void

  // Delivery
  setDelivery: (delivery: Partial<QuoteDelivery>) => void

  // Payment comparison conditions (for PDF table)
  setPaymentComparisonConditions: (conditions: PaymentConditionTemplate[]) => void

  // Initialize quote from a price list (sets payment from list's first condition)
  initFromPriceList: (priceListId: string, paymentTemplate?: PaymentConditionTemplate) => void

  // AI bulk apply
  applyAIExtraction: (data: Partial<Quote>) => void
}

export const useQuoteStore = create<QuoteStore>()(
  devtools(
    (set, get) => {
      const recompute = (q: Quote): Quote => ({ ...q, totals: computeTotals(q), updated_at: new Date().toISOString() })
      const upd = (patch: Partial<Quote>) => set(s => ({ quote: recompute({ ...s.quote, ...patch }), totals: computeTotals({ ...s.quote, ...patch }) }))

      const initial = newQuote()
      return {
        quote: initial,
        totals: computeTotals(initial),

        resetQuote: () => {
          const q = newQuote()
          set({ quote: q, totals: computeTotals(q) })
        },

        setClient: (client) => upd({ client: { ...get().quote.client, ...client } }),
        setCurrency: (currency) => upd({ currency }),
        setExchangeRate: (exchange_rate) => upd({ exchange_rate }),
        setValidDays: (valid_days) => upd({ valid_days }),
        setNotes: (notes) => upd({ notes }),
        setQuoteNumber: (quote_number) => upd({ quote_number }),

        addItem: (item = {}) => {
          const newItem: QuoteItem = {
            id: uid(),
            description: '',
            category: 'Implemento varios',
            quantity: 1,
            unit_price: 0,
            discount_pct: 0,
            subtotal: 0,
            ...item,
          }
          const items = [...get().quote.items, newItem]
          upd({ items })
        },

        updateItem: (id, patch) => {
          const items = get().quote.items.map(i => {
            if (i.id !== id) return i
            const updated = { ...i, ...patch }
            updated.subtotal = updated.unit_price * updated.quantity * (1 - updated.discount_pct / 100)
            return updated
          })
          upd({ items })
        },

        removeItem: (id) => upd({ items: get().quote.items.filter(i => i.id !== id) }),

        addDiscount: () => {
          const d: QuoteDiscount = { id: uid(), type: 'discount', concept: '', percentage: 0 }
          upd({ discounts: [...get().quote.discounts, d] })
        },

        updateDiscount: (id, patch) => upd({
          discounts: get().quote.discounts.map(d => d.id === id ? { ...d, ...patch } : d)
        }),

        removeDiscount: (id) => upd({ discounts: get().quote.discounts.filter(d => d.id !== id) }),

        setPayment: (payment) => upd({ payment: { ...get().quote.payment, ...payment } }),
        setTaxes: (taxes) => upd({ taxes: { ...get().quote.taxes, ...taxes } }),
        setDelivery: (delivery) => upd({ delivery: { ...get().quote.delivery, ...delivery } }),

        setPaymentComparisonConditions: (conditions) => upd({ payment_comparison_conditions: conditions }),

        initFromPriceList: (priceListId, paymentTemplate) => {
          const q = newQuote()
          const withList: Quote = {
            ...q,
            notes: undefined,
            payment: paymentTemplate ? { ...paymentTemplate.condition } : q.payment,
          }
          set({ quote: recompute(withList), totals: computeTotals(withList) })
        },

        applyAIExtraction: (data) => {
          const current = get().quote
          const merged: Quote = {
            ...current,
            ...data,
            client: { ...current.client, ...(data.client ?? {}) },
            payment: { ...current.payment, ...(data.payment ?? {}) },
            taxes: { ...current.taxes, ...(data.taxes ?? {}) },
            delivery: { ...current.delivery, ...(data.delivery ?? {}) },
            items: data.items?.length ? [...current.items, ...(data.items as QuoteItem[])] : current.items,
            discounts: data.discounts?.length ? [...current.discounts, ...(data.discounts as QuoteDiscount[])] : current.discounts,
          }
          set({ quote: recompute(merged), totals: computeTotals(merged) })
        },
      }
    },
    { name: 'QuoteStore' }
  )
)
