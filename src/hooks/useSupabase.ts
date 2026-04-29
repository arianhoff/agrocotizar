import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Quote, QuoteStatus } from '@/types'
import { useSavedQuotesStore, type SavedQuote } from '@/store/savedQuotesStore'

// ─── Auth ─────────────────────────────────────────────────────

export function useSession() {
  const [session, setSession] = useState<Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => listener.subscription.unsubscribe()
  }, [])

  return { session, loading, user: session?.user ?? null }
}

export function useSignIn() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      supabase.auth.signInWithPassword({ email, password }),
  })
}

export function useSignOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => supabase.auth.signOut(),
    onSuccess: () => qc.clear(),
  })
}

// ─── Quotes ───────────────────────────────────────────────────

export function useQuotes(filters?: { status?: string; limit?: number }) {
  const store = useSavedQuotesStore()

  // Auto-expire: mark 'sent' quotes whose validity window has passed
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    store.quotes.forEach(q => {
      if (q.status !== 'sent') return
      const expires = new Date(q.created_at)
      expires.setDate(expires.getDate() + (q.valid_days ?? 15))
      expires.setHours(0, 0, 0, 0)
      if (today > expires) store.updateStatus(q.id, 'expired')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = filters?.status
    ? store.quotes.filter(q => q.status === filters.status)
    : store.quotes
  const limited = filters?.limit ? filtered.slice(0, filters.limit) : filtered
  return { data: limited as SavedQuote[], isLoading: false, error: null }
}

export function useQuote(id: string) {
  const store = useSavedQuotesStore()
  const found = store.quotes.find(q => q.id === id) ?? null
  return { data: found, isLoading: false, error: null }
}

export function useSaveQuote() {
  const store = useSavedQuotesStore()
  const [isPending, setIsPending] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isError, setIsError] = useState(false)

  const mutate = async (quote: Quote) => {
    setIsPending(true)
    setIsSuccess(false)
    setIsError(false)
    try {
      const now = new Date().toISOString()
      const saved: SavedQuote = {
        id: quote.id,
        quote_number: quote.quote_number,
        status: quote.status,
        currency: quote.currency,
        exchange_rate: quote.exchange_rate,
        total: (quote as any).totals?.total ?? 0,
        valid_days: quote.valid_days,
        notes: quote.notes,
        data: quote as any,
        created_at: quote.created_at ?? now,
        updated_at: now,
      }
      // Local store (optimistic)
      store.upsert(saved)

      // Supabase (background write)
      const { client: _c, ...quoteData } = quote as any
      supabase.from('quotes').upsert({
        id: saved.id,
        quote_number: saved.quote_number,
        status: saved.status,
        currency: saved.currency,
        exchange_rate: saved.exchange_rate,
        total: saved.total,
        valid_days: saved.valid_days,
        notes: saved.notes,
        data: quote,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
      }).then(({ error }) => {
        if (error) console.warn('[Supabase] Error saving quote:', error.message)
      })

      setIsSuccess(true)
    } catch {
      setIsError(true)
    } finally {
      setIsPending(false)
    }
  }

  return { mutate, isPending, isSuccess, isError }
}

export function useUpdateQuoteStatus() {
  const store = useSavedQuotesStore()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: QuoteStatus }) => {
      store.updateStatus(id, status)
      // Background Supabase update
      supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', id).then(({ error }) => {
        if (error) console.warn('[Supabase] Error updating quote status:', error.message)
      })
      return { id, status }
    },
  })
}

export function useDeleteQuote() {
  const store = useSavedQuotesStore()
  return useMutation({
    mutationFn: async (id: string) => {
      store.remove(id)
      supabase.from('quotes').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('[Supabase] Error deleting quote:', error.message)
      })
    },
  })
}

// ─── Clients ──────────────────────────────────────────────────

export function useClients(search?: string) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: async () => {
      let q = supabase.from('clients').select('*').order('name')
      if (search) q = q.ilike('name', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useUpsertClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (client: { id?: string; name: string; cuit?: string; province?: string; city?: string; phone?: string; email?: string }) => {
      const { data, error } = await supabase.from('clients').upsert(client).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  })
}

// ─── Profile / Settings ───────────────────────────────────────

export function useLoadProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data, error } = await supabase
        .from('profiles')
        .select('settings, email')
        .eq('id', user.id)
        .maybeSingle()
      if (error) return null
      return data
    },
    staleTime: Infinity,
  })
}
