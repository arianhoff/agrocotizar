import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PriceList, Product, ProductOption, ProductCategory, PaymentConditionTemplate, PaymentCondition } from '@/types'
import { supabase } from '@/lib/supabase/client'

const uid = () => crypto.randomUUID()

interface CatalogStore {
  priceLists: PriceList[]
  products: Product[]
  options: Record<string, ProductOption[]>  // productId → options

  // Active list (selected in catalog page)
  activePriceListId: string | null
  setActivePriceListId: (id: string | null) => void

  // Price list CRUD
  addPriceList: (pl: Omit<PriceList, 'id' | 'created_at'>) => PriceList
  updatePriceList: (id: string, patch: Partial<PriceList>) => void
  deletePriceList: (id: string) => void

  // Product CRUD
  addProduct: (product: Omit<Product, 'id'>) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void

  // Option CRUD
  addOption: (productId: string, option: Omit<ProductOption, 'id' | 'product_id'>) => void
  updateOptionPrice: (productId: string, optionName: string, newPrice: number) => void
  deleteOption: (productId: string, optionId: string) => void

  // Bulk price update
  applyPriceAdjustment: (priceListId: string, pct: number) => void

  // CSV import (replaces or merges products in a list)
  importCSV: (priceListId: string, rows: CsvRow[]) => void

  // Payment conditions per list
  addPaymentCondition: (priceListId: string, template: Omit<PaymentConditionTemplate, 'id'>) => void
  updatePaymentCondition: (priceListId: string, templateId: string, patch: { label?: string; condition?: Partial<PaymentCondition> }) => void
  removePaymentCondition: (priceListId: string, templateId: string) => void

  // Helpers
  getProductsByList: (priceListId: string) => Product[]
  getOptionsByProduct: (productId: string) => ProductOption[]
  getAllProducts: () => Product[]

  // Supabase sync
  hydrate: (data: { priceLists: PriceList[]; products: Product[]; options: Record<string, ProductOption[]> }) => void
  syncAll: () => Promise<void>
  clear: () => void
}

export interface CsvRow {
  code: string
  name: string
  category: ProductCategory
  price: number
  currency: 'USD' | 'ARS'
  description?: string
}

const initialState = {
  priceLists: [] as PriceList[],
  products: [] as Product[],
  options: {} as Record<string, ProductOption[]>,
  activePriceListId: null as string | null,
}

// ─── Supabase helpers (fire and forget) ───────────────────────

async function syncPriceList(pl: PriceList) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.warn('[catalog] syncPriceList: no user session'); return }
  const { error } = await supabase.from('price_lists').upsert({
    id: pl.id,
    user_id: user.id,
    brand: pl.brand,
    name: pl.name,
    currency: pl.currency,
    valid_from: pl.valid_from,
    valid_until: pl.valid_until ?? null,
    is_active: pl.is_active,
    iva_included: pl.iva_included,
    iva_rate: pl.iva_rate,
    payment_conditions: pl.payment_conditions ?? [],
  })
  if (error) console.error('[catalog] syncPriceList ERROR:', error.message, error.details, error.hint)
  else console.log('[catalog] syncPriceList OK:', pl.id, pl.brand, pl.name)
}

// Returns true on success, false on failure (allows callers to gate dependent syncs)
async function syncProduct(p: Product): Promise<boolean> {
  const { data, error } = await supabase.from('products').upsert({
    id: p.id,
    price_list_id: p.price_list_id,
    code: p.code,
    name: p.name,
    description: p.description ?? null,
    category: p.category,
    base_price: p.base_price,
    currency: p.currency,
  }).select('id')
  if (error) { console.error('[catalog] syncProduct error:', error.message, p.id); return false }
  // If RLS silently blocked the insert, data will be empty — treat as failure
  if (!data || data.length === 0) { console.error('[catalog] syncProduct: no row returned (RLS block?)', p.id); return false }
  return true
}

async function syncOption(opt: ProductOption) {
  // Ensure the parent product exists in the local store before attempting sync.
  // If it's not found (orphaned option from importCSV or deleteProduct), skip entirely.
  const product = useCatalogStore.getState().products.find(p => p.id === opt.product_id)
  if (!product) return  // orphaned option — no parent in store, skip to avoid FK violation
  const ok = await syncProduct(product)
  if (!ok) return  // parent failed — skip option
  const { error } = await supabase.from('product_options').upsert({
    id: opt.id,
    product_id: opt.product_id,
    name: opt.name,
    price: opt.price,
    currency: opt.currency ?? 'USD',
    requires_commission: opt.requires_commission,
  })
  if (error) console.error('[catalog] syncOption error:', error.message, opt.id)
}

export const useCatalogStore = create<CatalogStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setActivePriceListId: (id) => set({ activePriceListId: id }),

      addPriceList: (pl) => {
        const newPl: PriceList = {
          ...pl,
          id: uid(),
          created_at: new Date().toISOString(),
        }
        set(s => ({ priceLists: [...s.priceLists, newPl] }))
        syncPriceList(newPl)
        return newPl
      },

      updatePriceList: (id, patch) => {
        set(s => ({
          priceLists: s.priceLists.map(pl => pl.id === id ? { ...pl, ...patch } : pl),
        }))
        const updated = get().priceLists.find(pl => pl.id === id)
        if (updated) syncPriceList(updated)
      },

      deletePriceList: (id) => {
        set(s => ({
          priceLists: s.priceLists.filter(pl => pl.id !== id),
          products: s.products.filter(p => p.price_list_id !== id),
          activePriceListId: s.activePriceListId === id ? null : s.activePriceListId,
        }))
        supabase.from('price_lists').delete().eq('id', id).then()
      },

      addProduct: (product) => {
        const newP: Product = { ...product, id: uid() }
        set(s => ({ products: [...s.products, newP] }))
        syncProduct(newP)
        return newP
      },

      updateProduct: (id, patch) => {
        set(s => ({
          products: s.products.map(p => p.id === id ? { ...p, ...patch } : p),
        }))
        const updated = get().products.find(p => p.id === id)
        if (updated) syncProduct(updated)
      },

      deleteProduct: (id) => {
        set(s => {
          const { [id]: _removed, ...remainingOptions } = s.options
          return {
            products: s.products.filter(p => p.id !== id),
            options: remainingOptions,
          }
        })
        supabase.from('products').delete().eq('id', id).then()
      },

      addOption: (productId, option) => {
        const newOpt: ProductOption = {
          ...option,
          id: uid(),
          product_id: productId,
        }
        set(s => {
          const existing = s.options[productId] ?? []
          return { options: { ...s.options, [productId]: [...existing, newOpt] } }
        })
        // Sync AFTER set() so getState() reflects the new option's product
        syncOption(newOpt)
      },

      updateOptionPrice: (productId, optionName, newPrice) => {
        set(s => {
          const opts = s.options[productId] ?? []
          const normalize = (str: string) => str.toLowerCase().trim()
          const updated = opts.map(o =>
            normalize(o.name) === normalize(optionName) ? { ...o, price: newPrice } : o
          )
          updated.forEach(o => {
            if (normalize(o.name) === normalize(optionName)) syncOption(o)
          })
          return {
            options: {
              ...s.options,
              [productId]: updated,
            },
          }
        })
      },

      deleteOption: (productId, optionId) => {
        set(s => ({
          options: {
            ...s.options,
            [productId]: (s.options[productId] ?? []).filter(o => o.id !== optionId),
          },
        }))
        supabase.from('product_options').delete().eq('id', optionId).then()
      },

      applyPriceAdjustment: (priceListId, pct) => {
        set(s => ({
          products: s.products.map(p =>
            p.price_list_id === priceListId
              ? { ...p, base_price: Math.round(p.base_price * (1 + pct / 100)) }
              : p
          ),
        }))
        // Sync all affected products
        const affected = get().products.filter(p => p.price_list_id === priceListId)
        affected.forEach(syncProduct)
      },

      importCSV: (priceListId, rows) => {
        const newProducts: Product[] = rows.map(r => ({
          id: uid(),
          price_list_id: priceListId,
          code: r.code,
          name: r.name,
          category: r.category,
          base_price: r.price,
          currency: r.currency,
          description: r.description,
        }))
        // Capture old IDs before mutating state so we can target the DELETE precisely.
        // Using DELETE by specific old IDs (not by price_list_id) prevents accidentally
        // deleting products that a concurrent syncProduct call may have just inserted.
        const oldProductIds = get().products
          .filter(p => p.price_list_id === priceListId)
          .map(p => p.id)
        const oldProductIdSet = new Set(oldProductIds)
        set(s => {
          const cleanOptions = Object.fromEntries(
            Object.entries(s.options).filter(([pid]) => !oldProductIdSet.has(pid))
          )
          return {
            products: [
              ...s.products.filter(p => p.price_list_id !== priceListId),
              ...newProducts,
            ],
            options: cleanOptions,
          }
        })
        // Delete only the specific old products, then upsert new ones.
        // Using upsert (not insert) in case syncProduct already inserted some of these.
        const upsertPayload = newProducts.map(p => ({
          id: p.id,
          price_list_id: p.price_list_id,
          code: p.code,
          name: p.name,
          description: p.description ?? null,
          category: p.category,
          base_price: p.base_price,
          currency: p.currency,
        }))
        if (oldProductIds.length) {
          supabase.from('products').delete().in('id', oldProductIds).then(() => {
            if (newProducts.length) supabase.from('products').upsert(upsertPayload).then()
          })
        } else if (newProducts.length) {
          supabase.from('products').upsert(upsertPayload).then()
        }
      },

      addPaymentCondition: (priceListId, template) => {
        set(s => ({
          priceLists: s.priceLists.map(pl => pl.id === priceListId ? {
            ...pl,
            payment_conditions: [
              ...(pl.payment_conditions ?? []),
              { ...template, id: uid() },
            ],
          } : pl),
        }))
        const updated = get().priceLists.find(pl => pl.id === priceListId)
        if (updated) syncPriceList(updated)
      },

      updatePaymentCondition: (priceListId, templateId, patch) => {
        set(s => ({
          priceLists: s.priceLists.map(pl => pl.id === priceListId ? {
            ...pl,
            payment_conditions: (pl.payment_conditions ?? []).map(t =>
              t.id === templateId
                ? { ...t, ...(patch.label !== undefined ? { label: patch.label } : {}), condition: { ...t.condition, ...(patch.condition ?? {}) } }
                : t
            ),
          } : pl),
        }))
        const updated = get().priceLists.find(pl => pl.id === priceListId)
        if (updated) syncPriceList(updated)
      },

      removePaymentCondition: (priceListId, templateId) => {
        set(s => ({
          priceLists: s.priceLists.map(pl => pl.id === priceListId ? {
            ...pl,
            payment_conditions: (pl.payment_conditions ?? []).filter(t => t.id !== templateId),
          } : pl),
        }))
        const updated = get().priceLists.find(pl => pl.id === priceListId)
        if (updated) syncPriceList(updated)
      },

      getProductsByList: (priceListId) =>
        get().products.filter(p => p.price_list_id === priceListId),

      getOptionsByProduct: (productId) =>
        get().options[productId] ?? [],

      getAllProducts: () => get().products,

      hydrate: ({ priceLists, products, options }) => {
        set(s => ({
          // Merge Supabase data with local (Supabase wins for matching IDs)
          priceLists: mergeById(s.priceLists, priceLists),
          products: mergeById(s.products, products),
          options: { ...s.options, ...options },
        }))
      },

      syncAll: async () => {
        // Verify we have a valid session before pushing anything
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { console.warn('[catalog] syncAll: no valid session, skipping'); return }

        const { priceLists, products, options } = get()

        // Only sync price lists that belong to this user (skip legacy/global lists)
        const ownLists = priceLists.filter(pl =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pl.id)
        )
        await Promise.allSettled(ownLists.map(syncPriceList))

        // Only sync products from those lists
        const ownListIds = new Set(ownLists.map(pl => pl.id))
        const ownProducts = products.filter(p => ownListIds.has(p.price_list_id))
        await Promise.allSettled(ownProducts.map(syncProduct))

        // Verify which products actually landed in Supabase before syncing options
        // (prevents FK violations when RLS silently blocks a product insert)
        const ownProductIds = new Set(ownProducts.map(p => p.id))
        const { data: confirmedRows } = await supabase
          .from('products').select('id').in('id', [...ownProductIds])
        const confirmedProductIds = new Set((confirmedRows ?? []).map((r: { id: string }) => r.id))

        // Only sync options whose parent product is confirmed in Supabase
        const ownOpts = Object.entries(options)
          .filter(([pid]) => confirmedProductIds.has(pid))
          .flatMap(([, opts]) => opts.filter(o => confirmedProductIds.has(o.product_id)))
        await Promise.allSettled(ownOpts.map(syncOption))
      },

      clear: () => set({ ...initialState }),
    }),
    {
      name: 'agrocotizar-catalog',
      version: 4,
      migrate: (state: any, version: number) => {
        // v2/v4: remove legacy gea-enero-2026 data (always, for users upgrading from any version)
        let priceLists = (state.priceLists ?? []).filter((pl: any) => pl.id !== 'gea-enero-2026')
        let products   = (state.products   ?? []).filter((p: any)  => p.price_list_id !== 'gea-enero-2026')
        let options: Record<string, any[]> = Object.fromEntries(
          Object.entries(state.options ?? {}).filter(([k]) =>
            !(state.products ?? []).find((p: any) => p.id === k && p.price_list_id === 'gea-enero-2026')
          )
        ) as Record<string, any[]>

        if (version < 3) {
          // v3: regenerate any product/option IDs that are not valid UUIDs
          const isUUID = (id: string) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
          const idRemap: Record<string, string> = {}

          products = products.map((p: any) => {
            if (!isUUID(p.id)) {
              const newId = crypto.randomUUID()
              idRemap[p.id] = newId
              return { ...p, id: newId }
            }
            return p
          })

          const newOptions: Record<string, any[]> = {}
          for (const [key, opts] of Object.entries(options)) {
            const newKey = idRemap[key] ?? key
            newOptions[newKey] = (opts as any[]).map((o: any) => ({
              ...o,
              id: isUUID(o.id) ? o.id : crypto.randomUUID(),
              product_id: idRemap[o.product_id] ?? o.product_id,
            }))
          }
          options = newOptions
        }

        return { priceLists, products, options }
      },
      partialize: (s) => ({
        priceLists: s.priceLists,
        products: s.products,
        options: s.options,
      }),
    }
  )
)

// Merge two arrays by id — remote wins for matching ids, local-only items are kept
function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const remoteMap = new Map(remote.map(r => [r.id, r]))
  const merged = local.map(l => remoteMap.get(l.id) ?? l)
  remote.forEach(r => {
    if (!local.find(l => l.id === r.id)) merged.push(r)
  })
  return merged
}
