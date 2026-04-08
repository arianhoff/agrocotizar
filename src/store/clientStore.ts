import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const uid = () => Math.random().toString(36).slice(2, 9)

export interface Client {
  id: string
  name: string
  cuit?: string
  province?: string
  city?: string
  phone?: string
  email?: string
  notes?: string
  // derived / updated on upsert
  quote_count: number
  last_quote_number?: string
  last_quote_date?: string
  created_at: string
  updated_at: string
}

interface ClientStore {
  clients: Client[]
  /** Upsert by CUIT (if present) or name */
  upsertFromQuote: (data: {
    name: string; cuit?: string; province?: string; city?: string
    phone?: string; email?: string; quote_number: string; quote_date: string
  }) => void
  updateClient: (id: string, patch: Partial<Client>) => void
  deleteClient: (id: string) => void
  getClient: (id: string) => Client | undefined
}

export const useClientStore = create<ClientStore>()(
  persist(
    (set, get) => ({
      clients: [],

      upsertFromQuote: ({ name, cuit, province, city, phone, email, quote_number, quote_date }) => {
        if (!name?.trim()) return
        const all = get().clients
        // Match by CUIT first, then by exact name
        const idx = cuit?.trim()
          ? all.findIndex(c => c.cuit?.replace(/-/g, '') === cuit.replace(/-/g, ''))
          : all.findIndex(c => c.name.toLowerCase() === name.toLowerCase())

        const now = new Date().toISOString()
        if (idx >= 0) {
          const updated = [...all]
          updated[idx] = {
            ...updated[idx],
            name: name || updated[idx].name,
            cuit: cuit || updated[idx].cuit,
            province: province || updated[idx].province,
            city: city || updated[idx].city,
            phone: phone || updated[idx].phone,
            email: email || updated[idx].email,
            quote_count: updated[idx].quote_count + 1,
            last_quote_number: quote_number,
            last_quote_date: quote_date,
            updated_at: now,
          }
          set({ clients: updated })
        } else {
          const newClient: Client = {
            id: uid(),
            name, cuit, province, city, phone, email,
            quote_count: 1,
            last_quote_number: quote_number,
            last_quote_date: quote_date,
            created_at: now,
            updated_at: now,
          }
          set(s => ({ clients: [newClient, ...s.clients] }))
        }
      },

      updateClient: (id, patch) => set(s => ({
        clients: s.clients.map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c),
      })),

      deleteClient: (id) => set(s => ({ clients: s.clients.filter(c => c.id !== id) })),

      getClient: (id) => get().clients.find(c => c.id === id),
    }),
    { name: 'agrocotizar-clients' }
  )
)
