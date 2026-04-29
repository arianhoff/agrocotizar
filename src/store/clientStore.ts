import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase/client'

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

export interface ClientImportRow {
  name: string
  cuit?: string
  phone?: string
  email?: string
  province?: string
  city?: string
  notes?: string
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
  /** Bulk import: adds new clients and updates existing ones matched by CUIT */
  importBulk: (rows: ClientImportRow[]) => { added: number; updated: number }
  hydrate: (clients: Client[]) => void
  clear: () => void
}

// Fire-and-forget Supabase write — never throws
function syncClient(client: Client) {
  const { id, name, cuit, province, city, phone, email, notes, quote_count, last_quote_number, last_quote_date } = client
  supabase.from('clients')
    .upsert({ id, name, cuit, province, city, phone, email, notes, quote_count, last_quote_number, last_quote_date })
    .then()
}

function deleteClientRemote(id: string) {
  supabase.from('clients').delete().eq('id', id).then()
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
        let result: Client
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
          result = updated[idx]
          set({ clients: updated })
        } else {
          result = {
            id: uid(),
            name, cuit, province, city, phone, email,
            quote_count: 1,
            last_quote_number: quote_number,
            last_quote_date: quote_date,
            created_at: now,
            updated_at: now,
          }
          set(s => ({ clients: [result, ...s.clients] }))
        }
        syncClient(result)
      },

      updateClient: (id, patch) => {
        set(s => ({
          clients: s.clients.map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c),
        }))
        const updated = get().clients.find(c => c.id === id)
        if (updated) syncClient(updated)
      },

      deleteClient: (id) => {
        set(s => ({ clients: s.clients.filter(c => c.id !== id) }))
        deleteClientRemote(id)
      },

      getClient: (id) => get().clients.find(c => c.id === id),

      importBulk: (rows) => {
        const all = get().clients
        const now = new Date().toISOString()
        let added = 0
        let updated = 0
        const result = [...all]

        for (const row of rows) {
          if (!row.name?.trim()) continue
          const cleanCuit = row.cuit?.replace(/\D/g, '') ?? ''
          const existingIdx = cleanCuit
            ? result.findIndex(c => c.cuit?.replace(/\D/g, '') === cleanCuit)
            : -1

          if (existingIdx >= 0) {
            // Merge: only fill in fields that are currently empty
            const c = result[existingIdx]
            result[existingIdx] = {
              ...c,
              phone:    c.phone    || row.phone    || c.phone,
              email:    c.email    || row.email    || c.email,
              province: c.province || row.province || c.province,
              city:     c.city     || row.city     || c.city,
              notes:    c.notes    || row.notes    || c.notes,
              updated_at: now,
            }
            syncClient(result[existingIdx])
            updated++
          } else {
            const client: Client = {
              id: uid(),
              name: row.name.trim(),
              cuit: row.cuit?.trim() || undefined,
              phone: row.phone?.trim() || undefined,
              email: row.email?.trim() || undefined,
              province: row.province?.trim() || undefined,
              city: row.city?.trim() || undefined,
              notes: row.notes?.trim() || undefined,
              quote_count: 0,
              created_at: now,
              updated_at: now,
            }
            result.unshift(client)
            syncClient(client)
            added++
          }
        }

        set({ clients: result })
        return { added, updated }
      },

      hydrate: (clients) => set({ clients }),

      clear: () => set({ clients: [] }),
    }),
    { name: 'agrocotizar-clients' }
  )
)
