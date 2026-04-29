import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy, useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LandingPage } from '@/pages/landing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { supabase } from '@/lib/supabase/client'
import { useSavedQuotesStore, type SavedQuote } from '@/store/savedQuotesStore'
import { useClientStore, type Client } from '@/store/clientStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCRMStore } from '@/store/crmStore'
import { useCatalogStore } from '@/store/catalogStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useTeamStore } from '@/store/teamStore'
import type { FollowUp, PriceList, Product, ProductOption } from '@/types'

const QuoterPage     = lazy(() => import('@/pages/quoter/QuoterPage').then(m => ({ default: m.QuoterPage })))
const QuotesListPage = lazy(() => import('@/pages/quotes/QuotesListPage').then(m => ({ default: m.QuotesListPage })))
const CRMPage        = lazy(() => import('@/pages/crm/CRMPage').then(m => ({ default: m.CRMPage })))
const CatalogPage    = lazy(() => import('@/pages/catalog/CatalogPage').then(m => ({ default: m.CatalogPage })))
const ClientsPage    = lazy(() => import('@/pages/clients/ClientsPage').then(m => ({ default: m.ClientsPage })))
const SettingsPage   = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const CUITPage        = lazy(() => import('@/pages/cuit/CUITPage').then(m => ({ default: m.CUITPage })))
const VoiceQuoterPage = lazy(() => import('@/pages/voice/VoiceQuoterPage').then(m => ({ default: m.VoiceQuoterPage })))
const TeamPage        = lazy(() => import('@/pages/team/TeamPage').then(m => ({ default: m.TeamPage })))

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 2 } },
})

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.getElementById('main-scroll')?.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

// ─── DataSync ─────────────────────────────────────────────────
// Loads all user data from Supabase when a user signs in and hydrates
// the Zustand stores. Renders nothing — side-effects only.

// Expose a global trigger so any component can request a refresh
export const dataSyncBus = { trigger: () => {} }

function DataSync({ userId }: { userId: string }) {
  const savedQuotes      = useSavedQuotesStore()
  const clientStore      = useClientStore()
  const settingsStore    = useSettingsStore()
  const crmStore         = useCRMStore()
  const catalogStore     = useCatalogStore()
  const subscriptionStore = useSubscriptionStore()
  const teamStore        = useTeamStore()

  useEffect(() => {
    let cancelled = false
    let lastSync = 0

    async function load() {
      const now = Date.now()
      if (now - lastSync < 10_000) return  // throttle: max once per 10s
      lastSync = now
      await Promise.allSettled([
        // Quotes
        supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (cancelled || !data?.length) return
            const quotes: SavedQuote[] = data.map((row: any) => ({
              id: row.id,
              quote_number: row.quote_number,
              status: row.status,
              currency: row.currency,
              exchange_rate: row.exchange_rate ?? 1,
              total: row.total ?? 0,
              valid_days: row.valid_days ?? 15,
              notes: row.notes,
              data: row.data ?? {},
              created_at: row.created_at,
              updated_at: row.updated_at,
              user_id: row.user_id,
            }))
            savedQuotes.hydrate(quotes)
          }),

        // Clients
        supabase
          .from('clients')
          .select('*')
          .order('updated_at', { ascending: false })
          .then(({ data }) => {
            if (cancelled || !data?.length) return
            const clients: Client[] = data.map((row: any) => ({
              id: row.id,
              name: row.name,
              cuit: row.cuit,
              province: row.province,
              city: row.city,
              phone: row.phone,
              email: row.email,
              notes: row.notes,
              quote_count: row.quote_count ?? 0,
              last_quote_number: row.last_quote_number,
              last_quote_date: row.last_quote_date,
              created_at: row.created_at,
              updated_at: row.updated_at,
            }))
            clientStore.hydrate(clients)
          }),

        // Profile / Settings + Subscription
        supabase
          .from('profiles')
          .select('settings, plan, plan_expires_at, trial_ends_at, owner_id')
          .eq('id', userId)
          .single()
          .then(async ({ data }) => {
            if (cancelled || !data) return
            if (data.settings) settingsStore.hydrate(data.settings)
            subscriptionStore.hydrate({
              plan:            data.plan,
              plan_expires_at: data.plan_expires_at,
              trial_ends_at:   data.trial_ends_at,
              owner_id:        data.owner_id,
            })
            // If admin: load team members into teamStore
            if (data.plan === 'concesionarios' && !data.owner_id) {
              const session = await supabase.auth.getSession()
              const token = session.data.session?.access_token
              if (token) {
                fetch('/api/team', { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => r.ok ? r.json() : null)
                  .then(json => { if (json?.members) teamStore.setMembers(json.members) })
                  .catch(() => {})
              }
            }
          }),

        // CRM follow-ups
        supabase
          .from('follow_ups')
          .select('*')
          .order('scheduled_date', { ascending: true })
          .then(({ data }) => {
            if (cancelled || !data?.length) return
            const followUps: FollowUp[] = data.map((row: any) => ({
              id: row.id,
              quote_id: row.quote_id ?? '',
              quote_number: row.quote_number ?? '',
              client_name: row.client_name ?? '',
              client_phone: row.client_phone,
              client_email: row.client_email,
              seller_email: row.seller_email,
              scheduled_date: row.scheduled_date,
              reminder_days: row.reminder_days ?? 3,
              notes: row.notes ?? '',
              status: row.status,
              sent_at: row.sent_at,
              created_at: row.created_at,
            }))
            crmStore.hydrate(followUps)
          }),

        // Catalog: price_lists (user's own only) + products + options
        supabase
          .from('price_lists')
          .select('*')
          .eq('user_id', userId)
          .then(async ({ data: plData }) => {
            if (cancelled || !plData?.length) return

            // Clean up legacy GEA list that may have been synced to Supabase under user's account
            const legacyIds = plData.filter((r: any) => r.id === 'gea-enero-2026').map((r: any) => r.id)
            if (legacyIds.length) {
              supabase.from('price_lists').delete().in('id', legacyIds).then()
            }
            const cleanPlData = plData.filter((r: any) => r.id !== 'gea-enero-2026')
            if (!cleanPlData.length) return

            const priceLists: PriceList[] = cleanPlData.map((row: any) => ({
              id: row.id,
              tenant_id: row.user_id ?? '',
              brand: row.brand,
              name: row.name,
              currency: row.currency,
              valid_from: row.valid_from,
              valid_until: row.valid_until,
              is_active: row.is_active,
              iva_included: row.iva_included,
              iva_rate: row.iva_rate,
              payment_conditions: row.payment_conditions ?? [],
              created_at: row.created_at,
            }))

            const plIds = priceLists.map(pl => pl.id)
            const { data: prodData } = await supabase
              .from('products')
              .select('*')
              .in('price_list_id', plIds)

            if (cancelled) return
            const products: Product[] = (prodData ?? []).map((row: any) => ({
              id: row.id,
              price_list_id: row.price_list_id,
              code: row.code ?? '',
              name: row.name,
              description: row.description,
              category: row.category,
              base_price: row.base_price,
              currency: row.currency,
            }))

            const prodIds = products.map(p => p.id)
            const { data: optData } = prodIds.length
              ? await supabase.from('product_options').select('*').in('product_id', prodIds)
              : { data: [] }

            if (cancelled) return
            const options: Record<string, ProductOption[]> = {}
            ;(optData ?? []).forEach((row: any) => {
              const opt: ProductOption = {
                id: row.id,
                product_id: row.product_id,
                name: row.name,
                price: row.price,
                currency: row.currency ?? 'USD',
                requires_commission: row.requires_commission,
              }
              if (!options[row.product_id]) options[row.product_id] = []
              options[row.product_id].push(opt)
            })

            catalogStore.hydrate({ priceLists, products, options })
          }),
      ])
    }

    load()

    // Re-sync when user switches back to the tab/app
    // visibilitychange covers desktop; pageshow + focus cover iOS Safari
    const onVisible = () => { if (!document.hidden) load() }
    const onFocus   = () => load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onFocus)
    window.addEventListener('focus', onFocus)

    // Poll every 60s as fallback for iOS where events don't fire on app resume
    const pollInterval = setInterval(() => { if (!document.hidden) load() }, 60_000)

    // Expose manual trigger (e.g. from CatalogPage refresh button)
    dataSyncBus.trigger = load

    return () => {
      cancelled = true
      clearInterval(pollInterval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [userId])  // Re-run only when userId changes (i.e., different account)

  return null
}

// ─── Clears all stores on logout ──────────────────────────────
function clearAllStores() {
  useSavedQuotesStore.getState().clear()
  useClientStore.getState().clear()
  useSettingsStore.getState().clear()
  useCRMStore.getState().clear()
  useCatalogStore.getState().clear()
  useSubscriptionStore.getState().clear()
  useTeamStore.getState().clear()
  // Clear persisted localStorage keys
  localStorage.removeItem('agrocotizar-quotes')
  localStorage.removeItem('agrocotizar-clients')
  localStorage.removeItem('agrocotizar-settings')
  localStorage.removeItem('agrocotizar-crm')
  localStorage.removeItem('agrocotizar-catalog')
}

// ─── App ──────────────────────────────────────────────────────

function App() {
  const [userId, setUserId]       = useState<string | null>(null)
  const [checking, setChecking]   = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      setChecking(false)
      const splash = document.getElementById('splash')
      if (splash) {
        splash.style.opacity = '0'
        setTimeout(() => splash.remove(), 380)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Don't wipe localStorage — preserve data so same user can re-login without losing work.
        // A different-user login is handled below.
        setUserId(null)
      } else if (session?.user) {
        // If a DIFFERENT user is logging in, clear stale data from the previous account.
        setUserId(prev => {
          if (prev && prev !== session.user.id) clearAllStores()
          return session.user.id
        })
        // On fresh sign-in, honour plan intent stored by the landing page
        if (event === 'SIGNED_IN') {
          const pending = sessionStorage.getItem('pendingPlan')
          if (pending) {
            sessionStorage.removeItem('pendingPlan')
            window.location.replace(`/settings?autostart=${pending}`)
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (checking) return null

  // Not authenticated: show landing or login
  if (!userId) {
    if (showLogin) {
      return (
        <QueryClientProvider client={qc}>
          <LoginPage onLogin={() => {}} />
        </QueryClientProvider>
      )
    }
    return <LandingPage onLogin={(plan) => {
      if (plan) sessionStorage.setItem('pendingPlan', plan)
      setShowLogin(true)
    }} />
  }

  return (
    <QueryClientProvider client={qc}>
      <DataSync userId={userId} />
      <BrowserRouter>
        <AppLayout>
          <Suspense fallback={<div className="p-8 font-mono text-[#8B9BAA]">Cargando...</div>}>
            <ScrollToTop />
            <Routes>
              <Route path="/"         element={<DashboardPage />} />
              <Route path="/quoter"   element={<QuoterPage />} />
              <Route path="/quotes"   element={<QuotesListPage />} />
              <Route path="/crm"      element={<CRMPage />} />
              <Route path="/catalog"  element={<CatalogPage />} />
              <Route path="/clients"  element={<ClientsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/cuit"     element={<CUITPage />} />
              <Route path="/voice"    element={<VoiceQuoterPage />} />
              <Route path="/team"     element={<TeamPage />} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
