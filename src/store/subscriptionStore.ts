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

// ─── Plan limits (free tier) ──────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: {
    quotes_per_month: 10,
    ai_queries_per_month: 10,
    price_lists: 1,
  },
} as const

export const PLAN_NAMES: Record<Plan, string> = {
  free:           'Gratis',
  vendedores:     'Vendedores',
  concesionarios: 'Concesionarios',
}
