import { create } from 'zustand'

export type Plan = 'free' | 'vendedores' | 'concesionarios'

interface SubscriptionStore {
  plan:           Plan
  planExpiresAt:  string | null   // ISO date — paid plan expiry
  trialEndsAt:    string | null   // ISO date — trial expiry
  isActive:       boolean         // paid plan or active trial
  inTrial:        boolean         // in free-trial period

  hydrate: (data: { plan?: string | null; plan_expires_at?: string | null; trial_ends_at?: string | null }) => void
  clear:   () => void
}

function compute(plan: Plan, planExpiresAt: string | null, trialEndsAt: string | null) {
  const now         = Date.now()
  const expiresMs   = planExpiresAt ? new Date(planExpiresAt).getTime() : 0
  const trialMs     = trialEndsAt   ? new Date(trialEndsAt).getTime()   : 0
  const isPaid      = plan !== 'free' && expiresMs > now
  const inTrial     = plan !== 'free' && !isPaid && trialMs > now
  return { isActive: isPaid || inTrial, inTrial }
}

export const useSubscriptionStore = create<SubscriptionStore>((set) => ({
  plan:          'free',
  planExpiresAt: null,
  trialEndsAt:   null,
  isActive:      false,
  inTrial:       false,

  hydrate({ plan, plan_expires_at, trial_ends_at }) {
    const safePlan = (plan as Plan) ?? 'free'
    const { isActive, inTrial } = compute(safePlan, plan_expires_at ?? null, trial_ends_at ?? null)
    set({ plan: safePlan, planExpiresAt: plan_expires_at ?? null, trialEndsAt: trial_ends_at ?? null, isActive, inTrial })
  },

  clear() {
    set({ plan: 'free', planExpiresAt: null, trialEndsAt: null, isActive: false, inTrial: false })
  },
}))

// ─── Plan limits ─────────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    quotes_per_month:    10,
    ai_queries_per_month: 10,
    price_lists:         1,
  },
  vendedores:     null,  // unlimited
  concesionarios: null,  // unlimited
} as const

export const PLAN_NAMES: Record<Plan, string> = {
  free:           'Gratis',
  vendedores:     'Vendedores',
  concesionarios: 'Concesionarios',
}

// ─── AI query counter (monthly, localStorage) ────────────────────────────────

const AI_COUNT_KEY = 'agrocotizar-ai-count'

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

export function getAIQueryCount(): number {
  try {
    const raw = localStorage.getItem(AI_COUNT_KEY)
    if (!raw) return 0
    const { month, count } = JSON.parse(raw)
    return month === currentMonth() ? (count as number) : 0
  } catch { return 0 }
}

export function incrementAIQueryCount() {
  try {
    const count = getAIQueryCount()
    localStorage.setItem(AI_COUNT_KEY, JSON.stringify({ month: currentMonth(), count: count + 1 }))
  } catch { /* ignore */ }
}

// ─── Gate helper ─────────────────────────────────────────────────────────────

const GEA_LIST_ID = '00000000-0000-0000-0000-000000000001'

export type GateAction = 'quote' | 'ai' | 'priceList'

export function checkPlanGate(
  action: GateAction,
  plan: Plan,
  isActive: boolean,
  counts: { quotesThisMonth: number; priceListCount: number }
): { allowed: boolean; reason?: string } {
  // Paid plan that expired
  if (plan !== 'free' && !isActive) {
    return { allowed: false, reason: 'expired' }
  }
  // Active paid plan — unlimited
  if (plan !== 'free' && isActive) {
    return { allowed: true }
  }
  // Free plan — check limits
  const limits = PLAN_LIMITS.free
  if (action === 'quote' && counts.quotesThisMonth >= limits.quotes_per_month) {
    return { allowed: false, reason: 'quotes' }
  }
  if (action === 'ai' && getAIQueryCount() >= limits.ai_queries_per_month) {
    return { allowed: false, reason: 'ai' }
  }
  if (action === 'priceList' && counts.priceListCount >= limits.price_lists) {
    return { allowed: false, reason: 'priceList' }
  }
  return { allowed: true }
}

export { GEA_LIST_ID }
