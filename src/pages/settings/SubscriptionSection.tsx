import { useState, useEffect } from 'react'
import { CreditCard, Check, Star, AlertTriangle, Clock, Loader2, ExternalLink, Zap, Lock } from 'lucide-react'
import { Button } from '@/components/ui'
import { useSubscriptionStore, PLAN_NAMES, type Plan } from '@/store/subscriptionStore'
import { supabase } from '@/lib/supabase/client'

// ─── Plan catalogue (must match api/mercadopago.js) ───────────────────────────

const PLANS_INFO: Array<{
  id:      Exclude<Plan, 'free'>
  name:    string
  usd:     number
  ars:     number
  badge?:  string
  accent:  boolean
  locked?: boolean
  features: string[]
}> = [
  {
    id:      'vendedores',
    name:    'Vendedores',
    usd:     9,
    ars:     11250,
    badge:   'Más popular',
    accent:  true,
    features: [
      'Cotizaciones ilimitadas',
      'IA ilimitada + importación PDF',
      'Listas de precios ilimitadas',
      'PDF profesional con tu logo',
      'Verificación BCRA ilimitada',
      'CRM y seguimiento automático',
      'Envío por WhatsApp',
      'Soporte por WhatsApp',
    ],
  },
  {
    id:      'concesionarios',
    name:    'Concesionarios',
    usd:     29,
    ars:     36250,
    accent:  false,
    features: [
      'Todo lo del plan Vendedores',
      'Hasta 5 vendedores en tu equipo',
      'Cada vendedor con su propia cuenta',
      'El admin ve todas las cotizaciones',
      'Gestión centralizada del equipo',
      'PDF profesional con logo propio',
      'Soporte prioritario por WhatsApp',
    ],
  },
]

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function daysUntil(iso: string | null) {
  if (!iso) return 0
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

// ─── Current plan card ────────────────────────────────────────────────────────

function CurrentPlanCard() {
  const { plan, planExpiresAt, trialEndsAt, isActive, inTrial } = useSubscriptionStore()

  if (plan === 'free') {
    return (
      <div className="flex items-center gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
        <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center shrink-0">
          <CreditCard size={18} className="text-[#94A3B8]" />
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#0F172A]">Plan Gratis</div>
          <div className="text-[12px] text-[#94A3B8] mt-0.5">
            10 cotizaciones · 10 consultas IA · 1 lista de precios
          </div>
        </div>
        <span className="text-[10px] font-bold text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-2.5 py-1 rounded-full uppercase tracking-wider">
          Gratis
        </span>
      </div>
    )
  }

  const planName = PLAN_NAMES[plan]
  const activeDate = inTrial ? trialEndsAt : planExpiresAt
  const daysLeft  = daysUntil(activeDate)
  const expiring  = daysLeft <= 7 && daysLeft > 0

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border ${
      isActive
        ? 'bg-[#F0FDF4] border-[#22C55E]/30'
        : 'bg-[#FFF8F8] border-[#EF4444]/20'
    }`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        isActive ? 'bg-[#22C55E]/15' : 'bg-[#EF4444]/10'
      }`}>
        {isActive
          ? <Star size={18} className="text-[#22C55E]" />
          : <AlertTriangle size={18} className="text-[#EF4444]" />
        }
      </div>
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[#0F172A]">Plan {planName}</div>
        {isActive && inTrial && (
          <div className="text-[12px] text-[#F59E0B] mt-0.5 flex items-center gap-1">
            <Clock size={11} />
            Prueba gratuita · {daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
            {activeDate ? ` (vence ${formatDate(activeDate)})` : ''}
          </div>
        )}
        {isActive && !inTrial && (
          <div className={`text-[12px] mt-0.5 flex items-center gap-1 ${
            expiring ? 'text-[#F59E0B]' : 'text-[#22C55E]'
          }`}>
            <Clock size={11} />
            {expiring
              ? `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''} · ${formatDate(activeDate)}`
              : `Activo hasta ${formatDate(activeDate)}`
            }
          </div>
        )}
        {!isActive && (
          <div className="text-[12px] text-[#EF4444] mt-0.5">
            Suscripción vencida · Renovar para continuar usando todas las funciones
          </div>
        )}
      </div>
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
        isActive
          ? 'text-[#22C55E] bg-[#F0FDF4] border-[#22C55E]/20'
          : 'text-[#EF4444] bg-[#FFF8F8] border-[#EF4444]/20'
      }`}>
        {isActive ? 'Activo' : 'Vencido'}
      </span>
    </div>
  )
}

// ─── Payment result banner ─────────────────────────────────────────────────────

function PaymentBanner({ result }: { result: 'success' | 'failure' | 'pending' }) {
  if (result === 'success') return (
    <div className="flex items-center gap-3 p-4 bg-[#F0FDF4] border border-[#22C55E]/30 rounded-xl">
      <Check size={18} className="text-[#22C55E] shrink-0" />
      <div>
        <div className="text-[14px] font-semibold text-[#16A34A]">¡Pago confirmado!</div>
        <div className="text-[12px] text-[#22C55E]">Tu plan fue activado. Podés empezar a usar todas las funciones.</div>
      </div>
    </div>
  )
  if (result === 'pending') return (
    <div className="flex items-center gap-3 p-4 bg-[#FFFBEB] border border-[#F59E0B]/30 rounded-xl">
      <Clock size={18} className="text-[#F59E0B] shrink-0" />
      <div>
        <div className="text-[14px] font-semibold text-[#92400E]">Pago pendiente de acreditación</div>
        <div className="text-[12px] text-[#F59E0B]">Tu plan se activará automáticamente cuando Mercado Pago confirme el pago.</div>
      </div>
    </div>
  )
  return (
    <div className="flex items-center gap-3 p-4 bg-[#FFF8F8] border border-[#EF4444]/20 rounded-xl">
      <AlertTriangle size={18} className="text-[#EF4444] shrink-0" />
      <div>
        <div className="text-[14px] font-semibold text-[#EF4444]">El pago no pudo procesarse</div>
        <div className="text-[12px] text-[#94A3B8]">Podés intentarlo de nuevo. Si el problema persiste, contactanos por WhatsApp.</div>
      </div>
    </div>
  )
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentPlan,
  isActive,
  onCheckout,
  loading,
}: {
  plan:        typeof PLANS_INFO[number]
  currentPlan: Plan
  isActive:    boolean
  onCheckout:  (planId: Exclude<Plan, 'free'>) => void
  loading:     string | null
}) {
  const isCurrent  = currentPlan === plan.id && isActive
  const isLoading  = loading === plan.id
  const isLocked   = plan.locked

  return (
    <div
      className={`relative flex flex-col p-6 rounded-2xl border transition-all ${isLocked ? 'opacity-60' : ''}`}
      style={plan.accent ? {
        background:   'linear-gradient(160deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)',
        borderColor:  'rgba(34,197,94,0.35)',
        boxShadow:    '0 8px 30px rgba(34,197,94,0.07)',
      } : {
        background:   'rgba(248,250,252,1)',
        borderColor:  '#E2E8F0',
      }}
    >
      {plan.badge && !isLocked && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#22C55E] rounded-full text-[10px] font-bold text-white whitespace-nowrap tracking-wider uppercase">
          {plan.badge}
        </div>
      )}
      {isLocked && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-0.5 bg-[#64748B] rounded-full text-[10px] font-bold text-white whitespace-nowrap tracking-wider uppercase">
          <Lock size={9} /> Próximamente
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 right-4 px-3 py-0.5 bg-[#0F172A] rounded-full text-[10px] font-bold text-white whitespace-nowrap tracking-wider uppercase">
          Tu plan
        </div>
      )}

      {/* Pricing */}
      <div className="mb-5">
        <div className={`text-[11px] font-bold tracking-widest uppercase mb-2 ${plan.accent ? 'text-[#22C55E]' : 'text-[#94A3B8]'}`}>
          {plan.name}
        </div>
        <div className="flex items-end gap-1.5 mb-0.5">
          <span className="text-[36px] font-black text-[#0F172A] leading-none">${plan.usd}</span>
          <span className="text-[12px] text-[#94A3B8] mb-1.5">USD / mes</span>
        </div>
        <div className="text-[11px] text-[#94A3B8]">≈ ${plan.ars.toLocaleString('es-AR')} ARS</div>
      </div>

      {/* Features */}
      <div className="flex-1 space-y-2.5 mb-6">
        {plan.features.map(f => (
          <div key={f} className="flex items-start gap-2">
            <Check size={13} className={`shrink-0 mt-0.5 ${plan.accent ? 'text-[#22C55E]' : 'text-[#64748B]'}`} />
            <span className="text-[12px] text-[#475569] leading-snug">{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {isLocked ? (
        <div className="w-full py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#94A3B8] text-center bg-[#F8FAFC] flex items-center justify-center gap-2 cursor-not-allowed">
          <Lock size={13} /> En desarrollo
        </div>
      ) : isCurrent ? (
        <div className="w-full py-2.5 rounded-xl border border-[#22C55E]/40 text-[13px] font-semibold text-[#22C55E] text-center bg-[#F0FDF4]">
          Plan actual
        </div>
      ) : (
        <button
          onClick={() => onCheckout(plan.id)}
          disabled={!!loading}
          className="w-full py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#22C55E]/20"
        >
          {loading === `checkout-${plan.id}` ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={13} />}
          {loading === `checkout-${plan.id}` ? 'Redirigiendo...' : 'Contratar plan'}
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SubscriptionSection() {
  const { plan, isActive, hydrate } = useSubscriptionStore()
  const [loading,       setLoading]       = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [currency,      setCurrency]      = useState<'USD' | 'ARS'>('USD')
  const [cancelConfirm, setCancelConfirm] = useState(false)

  // Read URL params
  const searchParams  = new URLSearchParams(window.location.search)
  const paymentResult = searchParams.get('payment') as 'success' | 'failure' | 'pending' | null
  // Reload subscription state after successful payment
  useEffect(() => {
    if (paymentResult !== 'success') return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return
      supabase
        .from('profiles')
        .select('plan, plan_expires_at, trial_ends_at')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          if (data) hydrate(data)
        })
    })
  }, [paymentResult])


  async function callApi(body: object): Promise<{ ok: boolean; data: any }> {
    const token = await getToken()
    const res   = await fetch('/api/mercadopago', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    })
    // Try to parse JSON; if it fails (HTML error page from Vercel) surface the status
    let data: any = {}
    try { data = await res.json() } catch {
      data = { error: `Error del servidor (HTTP ${res.status}) — revisá los logs de Vercel` }
    }
    return { ok: res.ok, data }
  }

  async function reloadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at, trial_ends_at')
      .eq('id', user.id)
      .single()
    if (profile) hydrate(profile)
  }


  async function handleCheckout(planId: Exclude<Plan, 'free'>) {
    setLoading(`checkout-${planId}`)
    setError(null)
    try {
      const { ok, data } = await callApi({ action: 'create_preference', plan: planId })
      if (!ok) { setError(data.error ?? 'No se pudo iniciar el pago.'); return }
      const dest = data.init_point ?? data.sandbox_init_point
      if (dest) window.location.href = dest
      else setError('Mercado Pago no devolvió una URL de pago.')
    } catch (e: any) {
      setError(`Error de conexión: ${e?.message ?? 'desconocido'}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3 pb-2 border-b border-[#E2E8F0]">
        <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] border border-[#22C55E]/20 flex items-center justify-center shrink-0 mt-0.5">
          <CreditCard size={16} className="text-[#22C55E]" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#0F172A]">Suscripción y plan</div>
          <div className="text-[12px] text-[#94A3B8] mt-0.5">
            Gestioná tu plan y método de pago.
          </div>
        </div>
      </div>

      {/* Payment result banner */}
      {paymentResult && <PaymentBanner result={paymentResult} />}

      {/* Current plan */}
      <CurrentPlanCard />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-[#FFF8F8] border border-[#EF4444]/20 rounded-lg text-[13px] text-[#EF4444]">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Currency toggle */}
      {plan === 'free' || !isActive ? (
        <>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8]">
              {isActive ? 'Cambiar plan' : 'Elegí un plan'}
            </div>
            <div className="flex items-center gap-0.5 rounded-full p-0.5 bg-[#F1F5F9] border border-[#E2E8F0]">
              {(['USD', 'ARS'] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                    currency === c
                      ? 'bg-white text-[#0F172A] shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#64748B]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {currency === 'ARS' && (
            <p className="text-[11px] text-[#94A3B8] -mt-3">
              Precio referencial · cotización dólar blue aproximada
            </p>
          )}

          {/* Plan cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            {PLANS_INFO.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                currentPlan={plan}
                isActive={isActive}

                onCheckout={handleCheckout}
                loading={loading}
              />
            ))}
          </div>

          {/* Free plan row */}
          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[12px] text-[#94A3B8]">
            Plan <span className="font-semibold text-[#64748B]">Gratis</span> incluye:{' '}
            10 cotizaciones/mes · 10 consultas IA · 1 lista de precios · PDF básico sin logo ·
            Verificación BCRA · Clientes básico.
          </div>
        </>
      ) : (
        /* Already on paid plan — show simple upgrade / manage options */
        <div className="space-y-4">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8]">
            Renovar suscripción
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PLANS_INFO.filter(p => p.id === plan || plan === 'vendedores').map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                currentPlan={plan}
                isActive={isActive}

                onCheckout={handleCheckout}
                loading={loading}
              />
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-[11px] text-[#94A3B8]">
        Los pagos se procesan de forma segura a través de Mercado Pago.
        Sin contratos — cancelás cuando querés.
        Para soporte escribí a <span className="text-[#22C55E]">hola@cotizagro.com.ar</span>.
      </p>

      {/* Cancel subscription */}
      {plan !== 'free' && (
        <div className="pt-2 border-t border-[#F1F5F9] text-center">
          {!cancelConfirm ? (
            <button
              onClick={() => setCancelConfirm(true)}
              className="text-[11px] text-[#CBD5E1] hover:text-[#EF4444] transition-colors cursor-pointer underline underline-offset-2"
            >
              Cancelar suscripción
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[12px] text-[#64748B]">
                ¿Confirmás la cancelación? Tu acceso se dará de baja de inmediato.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    setLoading('cancel')
                    setError(null)
                    try {
                      const { ok, data } = await callApi({ action: 'cancel_subscription' })
                      if (!ok) { setError(data.error ?? 'No se pudo cancelar.'); return }
                      await reloadProfile()
                      setCancelConfirm(false)
                    } catch (e: any) {
                      setError(`Error de conexión: ${e?.message ?? 'desconocido'}`)
                    } finally {
                      setLoading(null)
                    }
                  }}
                  disabled={loading === 'cancel'}
                  className="text-[12px] font-semibold text-[#EF4444] hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {loading === 'cancel' && <Loader2 size={11} className="animate-spin" />}
                  Sí, cancelar
                </button>
                <span className="text-[#E2E8F0]">·</span>
                <button
                  onClick={() => setCancelConfirm(false)}
                  className="text-[12px] text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
                >
                  No, mantener plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
