import { PageHeader } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui'
import {
  FileText, TrendingUp, Users, Bell, ArrowUpRight,
  CheckCircle, RotateCcw, AlertTriangle, Clock,
  Phone, Mail, MessageCircle, Package, PlusCircle,
  Send, XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCRMStore } from '@/store/crmStore'
import { useCatalogStore } from '@/store/catalogStore'
import { useSavedQuotesStore } from '@/store/savedQuotesStore'
import { useClientStore } from '@/store/clientStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { FollowUp } from '@/types'
import { fmt, fmtDate } from '@/utils'
import { cn } from '@/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyDate(dateStr: string): 'overdue' | 'today' | 'soon' | 'later' {
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 3) return 'soon'
  return 'later'
}

function whatsappLink(phone: string, msg: string) {
  const clean = phone.replace(/\D/g, '')
  const arg = clean.startsWith('54') ? clean : `54${clean}`
  return `https://wa.me/${arg}?text=${encodeURIComponent(msg)}`
}

function buildMessage(fu: FollowUp): string {
  return `Hola ${fu.client_name}, ¿cómo estás? Te contacto para consultar si tuviste oportunidad de revisar la cotización ${fu.quote_number}. Cualquier consulta estoy a disposición. ¡Saludos!`
}

const STATUS_ICON: Record<string, React.ElementType> = {
  draft: Clock, sent: Send, accepted: CheckCircle, rejected: XCircle, expired: Clock,
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'text-[#94A3B8]', sent: 'text-[#F59E0B]',
  accepted: 'text-[#22C55E]', rejected: 'text-[#EF4444]', expired: 'text-[#CBD5E1]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', expired: 'Vencida',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, bg, to }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; bg: string; to?: string
}) {
  const inner = (
    <Card className={cn('flex items-center gap-4 p-4 sm:p-5 transition-all', to && 'hover:shadow-md cursor-pointer')}>
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        <div className="text-[24px] sm:text-[28px] font-bold text-[#0F172A] leading-none">{value}</div>
        <div className="text-[12px] text-[#64748B] mt-1 leading-tight">{label}</div>
        {sub && <div className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</div>}
      </div>
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

// ─── Reminder card ────────────────────────────────────────────────────────────

function ReminderCard({ fu }: { fu: FollowUp }) {
  const { updateFollowUp, completeAndReschedule } = useCRMStore()
  const cls = classifyDate(fu.scheduled_date)
  const msg = buildMessage(fu)

  return (
    <div className={cn('rounded-xl border p-3 sm:p-4 transition-all',
      cls === 'overdue' ? 'border-[#EF4444]/25 bg-[#FEF2F2]'
      : cls === 'today'  ? 'border-[#F59E0B]/25 bg-[#FFFBEB]'
      : 'border-[#E2E8F0] bg-white'
    )}>
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[13px] font-semibold text-[#0F172A] truncate">{fu.client_name}</span>
            {fu.quote_number && (
              <span className="font-mono text-[10px] text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded shrink-0">{fu.quote_number}</span>
            )}
            {cls === 'overdue' && <span className="text-[10px] font-bold text-[#EF4444] shrink-0">Vencido</span>}
            {cls === 'today'   && <span className="text-[10px] font-bold text-[#D97706] shrink-0">Hoy</span>}
          </div>
          {fu.notes && <p className="text-[11px] text-[#64748B] truncate">{fu.notes}</p>}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {fu.client_phone && (
            <a href={whatsappLink(fu.client_phone, msg)} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all" title="WhatsApp">
              <MessageCircle size={14} />
            </a>
          )}
          {fu.client_phone && (
            <a href={`tel:${fu.client_phone}`}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all" title="Llamar">
              <Phone size={14} />
            </a>
          )}
          {fu.client_email && (
            <a href={`mailto:${fu.client_email}`}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#8B5CF6] hover:bg-[#8B5CF6]/10 transition-all" title="Email">
              <Mail size={14} />
            </a>
          )}
          <button onClick={() => completeAndReschedule(fu.id)} title="Contactado — reagendar"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all cursor-pointer">
            <RotateCcw size={14} />
          </button>
          <button onClick={() => updateFollowUp(fu.id, { status: 'done' })} title="Marcar finalizado"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-all cursor-pointer">
            <CheckCircle size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick access buttons ─────────────────────────────────────────────────────

const QUICK = [
  { to: '/quoter',  label: 'Nueva cotización', icon: PlusCircle,  color: 'bg-[#22C55E]' },
  { to: '/quotes',  label: 'Cotizaciones',     icon: FileText,    color: 'bg-[#3B82F6]' },
  { to: '/crm',     label: 'Seguimientos',     icon: Bell,        color: 'bg-[#8B5CF6]' },
  { to: '/clients', label: 'Clientes',         icon: Users,       color: 'bg-[#F59E0B]' },
  { to: '/catalog', label: 'Lista de precios', icon: Package,     color: 'bg-[#64748B]' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { followUps }    = useCRMStore()
  const { getAllProducts } = useCatalogStore()
  const { quotes }       = useSavedQuotesStore()
  const { clients }      = useClientStore()
  const { company }      = useSettingsStore()

  // Follow-ups
  const pending   = followUps.filter(f => f.status === 'pending')
  const urgent    = pending
    .filter(f => classifyDate(f.scheduled_date) === 'overdue' || classifyDate(f.scheduled_date) === 'today')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const upcoming  = pending
    .filter(f => classifyDate(f.scheduled_date) === 'soon')
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const overdueCount = pending.filter(f => classifyDate(f.scheduled_date) === 'overdue').length

  // Quotes stats
  const thisMonth = new Date().getMonth()
  const thisYear  = new Date().getFullYear()
  const quotesThisMonth = quotes.filter(q => {
    const d = new Date(q.created_at)
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear
  })
  const acceptedTotal = quotes
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => {
      const amount = q.currency === 'ARS' ? q.total : q.total * q.exchange_rate
      return sum + amount
    }, 0)
  const recentQuotes = [...quotes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  const companyName = company.name || 'AgroCotizar'

  const STATS = [
    {
      label: 'Cotizaciones este mes', value: String(quotesThisMonth.length),
      sub: `${quotes.length} en total`,
      icon: FileText, color: 'text-[#3B82F6]', bg: 'bg-[#EFF6FF]', to: '/quotes',
    },
    {
      label: 'Monto aceptado (ARS)', value: acceptedTotal > 0 ? `$${fmt(Math.round(acceptedTotal / 1000))}k` : '$0',
      sub: `${quotes.filter(q => q.status === 'accepted').length} aceptadas`,
      icon: TrendingUp, color: 'text-[#22C55E]', bg: 'bg-[#F0FDF4]', to: '/quotes',
    },
    {
      label: 'Clientes registrados', value: String(clients.length),
      sub: getAllProducts().length + ' productos en catálogo',
      icon: Users, color: 'text-[#8B5CF6]', bg: 'bg-[#F5F3FF]', to: '/clients',
    },
    {
      label: 'Seguimientos pendientes', value: String(pending.length),
      sub: overdueCount > 0 ? `${overdueCount} vencido${overdueCount !== 1 ? 's' : ''}` : 'Sin vencidos',
      icon: overdueCount > 0 ? AlertTriangle : Bell,
      color: overdueCount > 0 ? 'text-[#EF4444]' : 'text-[#F59E0B]',
      bg: overdueCount > 0 ? 'bg-[#FEF2F2]' : 'bg-[#FFFBEB]',
      to: '/crm',
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={companyName + ' · Panel de control'}
      />

      <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* Quick access */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-3">
          {QUICK.map((q, i) => (
            <Link key={q.to} to={q.to} className={i === 4 ? 'col-span-2 lg:col-span-1' : ''}>
              <div className="flex items-center gap-2.5 px-3 py-3 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#22C55E]/40 hover:bg-[#F0FDF4] hover:shadow-sm transition-all cursor-pointer group h-full">
                <div className={`w-7 h-7 rounded-lg ${q.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <q.icon size={13} className="text-white" />
                </div>
                <span className="text-[12px] lg:text-[13px] font-medium text-[#475569] leading-tight">{q.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Main content: recent quotes + follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

          {/* Recent quotes */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#94A3B8]" />
                <span className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8]">Últimas cotizaciones</span>
              </div>
              <Link to="/quotes" className="text-[12px] text-[#3B82F6] hover:underline font-medium">Ver todas →</Link>
            </div>

            {recentQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <FileText size={28} className="text-[#CBD5E1]" />
                <p className="text-[13px] text-[#94A3B8]">Sin cotizaciones todavía</p>
                <Link to="/quoter" className="text-[12px] text-[#22C55E] font-medium hover:underline">
                  Crear primera cotización →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#F1F5F9]">
                {recentQuotes.map(q => {
                  const Icon = STATUS_ICON[q.status] ?? Clock
                  return (
                    <div key={q.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-[11px] text-[#94A3B8] shrink-0">{q.quote_number}</span>
                          <span className="text-[13px] font-semibold text-[#0F172A] truncate">
                            {q.data?.client?.name || 'Sin cliente'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#94A3B8]">{fmtDate(q.created_at)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={cn('flex items-center gap-1 text-[11px] font-medium', STATUS_COLOR[q.status])}>
                          <Icon size={12} />
                          <span className="hidden sm:inline">{STATUS_LABEL[q.status]}</span>
                        </div>
                        <span className="text-[12px] font-semibold text-[#0F172A]">
                          {q.currency} {fmt(q.total)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Follow-ups */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <Bell size={14} className={urgent.length > 0 ? 'text-[#EF4444]' : 'text-[#94A3B8]'} />
                <span className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8]">Seguimientos</span>
                {urgent.length > 0 && (
                  <span className="text-[10px] font-bold text-white bg-[#EF4444] px-1.5 py-0.5 rounded-full">{urgent.length}</span>
                )}
              </div>
              <Link to="/crm" className="text-[12px] text-[#3B82F6] hover:underline font-medium">Ver todos →</Link>
            </div>

            <div className="p-4 space-y-2">
              {urgent.length === 0 && upcoming.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle size={24} className="text-[#22C55E]/40" />
                  <p className="text-[13px] text-[#94A3B8]">
                    {pending.length === 0 ? 'Sin seguimientos activos' : 'Todo al día'}
                  </p>
                </div>
              ) : (
                <>
                  {urgent.map(fu => <ReminderCard key={fu.id} fu={fu} />)}
                  {upcoming.slice(0, 3 - urgent.length > 0 ? 3 - urgent.length : 0).map(fu => (
                    <ReminderCard key={fu.id} fu={fu} />
                  ))}
                  {(urgent.length + upcoming.length) > 4 && (
                    <Link to="/crm" className="block text-center text-[12px] text-[#3B82F6] font-medium pt-1 hover:underline">
                      +{urgent.length + upcoming.length - 4} más →
                    </Link>
                  )}
                </>
              )}
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
