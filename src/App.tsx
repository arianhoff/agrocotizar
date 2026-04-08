import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy, useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { LandingPage } from '@/pages/landing/LandingPage'
import { LoginPage } from '@/pages/auth/LoginPage'
import { supabase } from '@/lib/supabase/client'

const QuoterPage     = lazy(() => import('@/pages/quoter/QuoterPage').then(m => ({ default: m.QuoterPage })))
const QuotesListPage = lazy(() => import('@/pages/quotes/QuotesListPage').then(m => ({ default: m.QuotesListPage })))
const CRMPage        = lazy(() => import('@/pages/crm/CRMPage').then(m => ({ default: m.CRMPage })))
const CatalogPage    = lazy(() => import('@/pages/catalog/CatalogPage').then(m => ({ default: m.CatalogPage })))
const ClientsPage    = lazy(() => import('@/pages/clients/ClientsPage').then(m => ({ default: m.ClientsPage })))
const SettingsPage   = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))

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

function App() {
  const [authed, setAuthed]     = useState(false)
  const [checking, setChecking] = useState(true)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
      setChecking(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (checking) return null

  // Not authenticated: show landing or login
  if (!authed) {
    if (showLogin) {
      return <LoginPage onLogin={() => setAuthed(true)} />
    }
    return <LandingPage onLogin={() => setShowLogin(true)} />
  }

  return (
    <QueryClientProvider client={qc}>
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
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
