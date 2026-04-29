import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { cn } from '@/utils'
import {
  FileText, LayoutDashboard, Settings, Package, Users, PlusCircle, CalendarCheck, LogOut, Menu, X, Search, Mic, Lock, AlertTriangle, UsersRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useSettingsStore } from '@/store/settingsStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/quoter?new', icon: PlusCircle,      label: 'Nueva Cotización' },
  { to: '/quotes',    icon: FileText,        label: 'Cotizaciones' },
  { to: '/crm',       icon: CalendarCheck,   label: 'Seguimientos' },
  { to: '/catalog',   icon: Package,         label: 'Lista de precios' },
  { to: '/clients',   icon: Users,           label: 'Clientes' },
  { to: '/cuit',      icon: Search,          label: 'Verificar CUIT' },
  { to: '/settings',  icon: Settings,        label: 'Configuración' },
]

const NAV_COMING_SOON = [
  { icon: Mic, label: 'Cotizar por voz' },
]

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const company = useSettingsStore(s => s.company)
  const { plan, isActive, inTrial, isAdmin } = useSubscriptionStore()

  // Show banner when a paid plan (or trial) expired
  const showExpiredBanner = plan !== 'free' && !isActive

  const navLinks = (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {NAV.map(({ to, icon: Icon, label }) => {
        const active = pathname === to || (to !== '/' && pathname.startsWith(to))
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
              active
                ? 'bg-[#22C55E]/15 text-[#22C55E]'
                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
            )}
          >
            <Icon size={16} className={active ? 'text-[#22C55E]' : ''} />
            {label}
          </Link>
        )
      })}

      {/* Equipo — solo para admins concesionarios */}
      {isAdmin && (
        <Link
          to="/team"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
            pathname === '/team' || pathname.startsWith('/team')
              ? 'bg-[#22C55E]/15 text-[#22C55E]'
              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
          )}
        >
          <UsersRound size={16} className={pathname.startsWith('/team') ? 'text-[#22C55E]' : ''} />
          Equipo
        </Link>
      )}

      {/* Coming soon items */}
      {NAV_COMING_SOON.map(({ icon: Icon, label }) => (
        <div
          key={label}
          title="Próximamente"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-white/25 cursor-not-allowed select-none"
        >
          <Icon size={16} />
          <span className="flex-1">{label}</span>
          <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08]">
            <Lock size={9} className="text-white/30" />
            <span className="text-[9px] text-white/30 font-semibold tracking-wide uppercase">Pronto</span>
          </div>
        </div>
      ))}
    </nav>
  )

  const sidebarContent = (onClose?: () => void) => (
    <div className="w-64 bg-[#1E2235] flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
        <div className="flex-1 min-w-0">
          {company.logo_base64 ? (
            <img
              src={company.logo_base64}
              alt={company.name || 'Logo'}
              className="h-10 max-w-[160px] object-contain"
            />
          ) : (
            <>
              <div className="text-[22px] font-bold text-white tracking-tight leading-none">
                {company.name
                  ? <span className="text-[#22C55E]">{company.name}</span>
                  : <span>Agro<span className="text-[#22C55E]">Cotizar</span></span>
                }
              </div>
              <div className="text-[10px] text-white/40 tracking-widest uppercase mt-1 font-mono">
                Maquinaria Agrícola
              </div>
            </>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors cursor-pointer p-1 ml-2">
            <X size={18} />
          </button>
        )}
      </div>

      {navLinks}

      {/* User area */}
      <div className="px-4 py-4 border-t border-white/[0.07] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#22C55E]/20 flex items-center justify-center shrink-0">
            <span className="text-[#22C55E] text-[11px] font-bold">CG</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white/80 truncate">Cotiz<span className="text-[#22C55E]">agro</span></div>
            <div className="text-[11px] text-white/40">Sistema de cotización</div>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Cerrar sesión"
            className="text-white/30 hover:text-white/70 transition-colors cursor-pointer shrink-0"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-[#F1F5F9]">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-shrink-0">
        {sidebarContent()}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Drawer */}
          <div className="relative z-10 flex-shrink-0">
            {sidebarContent(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden flex-shrink-0 bg-white border-b border-[#E2E8F0] px-4 py-3 flex items-center gap-3 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer"
          >
            <Menu size={22} />
          </button>
          <div className="text-[18px] font-bold text-[#0F172A] tracking-tight">
            {company.logo_base64
              ? <img src={company.logo_base64} alt={company.name || 'Logo'} className="h-8 max-w-[140px] object-contain" />
              : company.name
                ? <span className="text-[#22C55E]">{company.name}</span>
                : <span>Agro<span className="text-[#22C55E]">Cotizar</span></span>
            }
          </div>
        </div>

        {/* Expired plan banner */}
        {showExpiredBanner && (
          <div className="flex-shrink-0 bg-[#EF4444] text-white px-4 py-2.5 flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                <strong>Tu {inTrial ? 'prueba gratuita' : 'plan'} venció.</strong>
                {' '}Para seguir usando todas las funciones, renová tu suscripción.
              </span>
            </div>
            <button
              onClick={() => navigate('/settings?section=subscription')}
              className="shrink-0 bg-white text-[#EF4444] font-bold text-[11px] px-3 py-1 rounded-full hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              Renovar plan
            </button>
          </div>
        )}

        {/* Page scroll area */}
        <main id="main-scroll" className="flex-1 overflow-y-auto min-w-0">
          {children}
        </main>

      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[17px] sm:text-xl font-semibold text-[#0F172A] truncate">{title}</h1>
        {subtitle && <p className="text-[11px] sm:text-[12px] text-[#64748B] mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">{actions}</div>}
    </div>
  )
}
