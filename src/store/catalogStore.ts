import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PriceList, Product, ProductOption, ProductCategory } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 9)

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

  // Helpers
  getProductsByList: (priceListId: string) => Product[]
  getOptionsByProduct: (productId: string) => ProductOption[]
  getAllProducts: () => Product[]
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
        return newPl
      },

      updatePriceList: (id, patch) =>
        set(s => ({
          priceLists: s.priceLists.map(pl => pl.id === id ? { ...pl, ...patch } : pl),
        })),

      deletePriceList: (id) =>
        set(s => ({
          priceLists: s.priceLists.filter(pl => pl.id !== id),
          products: s.products.filter(p => p.price_list_id !== id),
          activePriceListId: s.activePriceListId === id ? null : s.activePriceListId,
        })),

      addProduct: (product) => {
        const newP: Product = { ...product, id: product.code + '-' + uid() }
        set(s => ({ products: [...s.products, newP] }))
        return newP
      },

      updateProduct: (id, patch) =>
        set(s => ({
          products: s.products.map(p => p.id === id ? { ...p, ...patch } : p),
        })),

      deleteProduct: (id) =>
        set(s => ({
          products: s.products.filter(p => p.id !== id),
        })),

      addOption: (productId, option) =>
        set(s => {
          const existing = s.options[productId] ?? []
          const newOpt: ProductOption = {
            ...option,
            id: productId + '-' + uid(),
            product_id: productId,
          }
          return { options: { ...s.options, [productId]: [...existing, newOpt] } }
        }),

      updateOptionPrice: (productId, optionName, newPrice) =>
        set(s => {
          const opts = s.options[productId] ?? []
          const normalize = (str: string) => str.toLowerCase().trim()
          return {
            options: {
              ...s.options,
              [productId]: opts.map(o =>
                normalize(o.name) === normalize(optionName) ? { ...o, price: newPrice } : o
              ),
            },
          }
        }),

      deleteOption: (productId, optionId) =>
        set(s => ({
          options: {
            ...s.options,
            [productId]: (s.options[productId] ?? []).filter(o => o.id !== optionId),
          },
        })),

      applyPriceAdjustment: (priceListId, pct) =>
        set(s => ({
          products: s.products.map(p =>
            p.price_list_id === priceListId
              ? { ...p, base_price: Math.round(p.base_price * (1 + pct / 100)) }
              : p
          ),
        })),

      importCSV: (priceListId, rows) => {
        const newProducts: Product[] = rows.map(r => ({
          id: r.code + '-' + uid(),
          price_list_id: priceListId,
          code: r.code,
          name: r.name,
          category: r.category,
          base_price: r.price,
          currency: r.currency,
          description: r.description,
        }))
        // Remove existing products for this list, replace with imported
        set(s => ({
          products: [
            ...s.products.filter(p => p.price_list_id !== priceListId),
            ...newProducts,
          ],
        }))
      },

      getProductsByList: (priceListId) =>
        get().products.filter(p => p.price_list_id === priceListId),

      getOptionsByProduct: (productId) =>
        get().options[productId] ?? [],

      getAllProducts: () => get().products,
    }),
    {
      name: 'agrocotizar-catalog',
      version: 2,
      // v2: removed built-in GEA catalog — users load their own price lists
      migrate: (state: any) => ({
        priceLists: (state.priceLists ?? []).filter((pl: any) => pl.id !== 'gea-enero-2026'),
        products:   (state.products   ?? []).filter((p: any)  => p.price_list_id !== 'gea-enero-2026'),
        options:    Object.fromEntries(
          Object.entries(state.options ?? {}).filter(([k]) =>
            !(state.products ?? []).find((p: any) => p.id === k && p.price_list_id === 'gea-enero-2026')
          )
        ),
      }),
      // Don't persist activePriceListId across sessions
      partialize: (s) => ({
        priceLists: s.priceLists,
        products: s.products,
        options: s.options,
      }),
    }
  )
)
