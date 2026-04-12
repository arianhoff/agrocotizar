/**
 * /api/mercadopago
 * Mercado Pago integration — subscription billing for Cotizagro
 *
 * POST { action: 'create_preference', plan: 'vendedores'|'concesionarios' }  + Bearer token
 *   → { init_point, sandbox_init_point, preference_id }
 *
 * POST { action: 'start_trial' }  + Bearer token
 *   → { ok: true }
 *
 * POST ?webhook=1  (no auth — called by Mercado Pago)
 *   → 200 OK
 *
 * GET ?action=status  + Bearer token
 *   → { plan, plan_expires_at, trial_ends_at, is_active, in_trial }
 */

import { createClient } from '@supabase/supabase-js'
import { handleCors } from './_cors.js'

// ─── Plan catalogue ───────────────────────────────────────────────────────────
// ARS prices at ~$1250 / USD
const PLANS = {
  vendedores: {
    name:        'Plan Vendedores — Cotizagro',
    description: 'Cotizaciones ilimitadas · IA ilimitada · CRM · Soporte WhatsApp',
    price_ars:   11250,
    price_usd:   9,
  },
  concesionarios: {
    name:        'Plan Concesionarios — Cotizagro',
    description: 'Hasta 10 usuarios · Dashboard gerencial · Soporte prioritario',
    price_ars:   36250,
    price_usd:   29,
  },
}

const TRIAL_DAYS  = 14
const EXPIRY_DAYS = 33   // 1 month + 2 day grace period

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function anonClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
  )
}

function serviceClient() {
  // Falls back to anon key if service role key is not configured.
  // The service role key bypasses RLS — set SUPABASE_SERVICE_ROLE_KEY in Vercel
  // for full security. The anon key still works for updates on the user's own row.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  return createClient(process.env.SUPABASE_URL, key)
}

async function verifyToken(bearerToken) {
  if (!bearerToken) return null
  const { data: { user }, error } = await anonClient().auth.getUser(bearerToken)
  return (error || !user) ? null : user
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  const { handled, cors } = handleCors(req, res)
  if (handled) return

  function json(status, data) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = status
    res.end(JSON.stringify(data))
  }

  const mpToken = process.env.MP_ACCESS_TOKEN
  if (!mpToken) return json(500, { error: 'MP_ACCESS_TOKEN no configurado en Vercel' })

  // Parse query string from req.url
  const url        = new URL(req.url, 'http://localhost')
  const isWebhook  = url.searchParams.get('webhook') === '1'
  const actionQS   = url.searchParams.get('action')

  // ─── Webhook — no auth, called directly by Mercado Pago ────────────────────
  if (req.method === 'POST' && isWebhook) {
    const raw = await readBody(req)
    let notification
    try { notification = JSON.parse(raw) } catch { return json(200, { ok: true }) }

    // MP payment notification: { type: 'payment', data: { id: '...' } }
    if (notification.type !== 'payment' || !notification.data?.id) {
      return json(200, { ok: true })
    }

    const paymentId = notification.data.id

    // Verify with MP API
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${mpToken}` },
    })
    if (!mpRes.ok) return json(200, { ok: true })

    const payment = await mpRes.json()
    if (payment.status !== 'approved') return json(200, { ok: true })

    const userId = payment.external_reference
    const plan   = payment.metadata?.plan
    if (!userId || !plan || !PLANS[plan]) return json(200, { ok: true })

    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86_400_000).toISOString()

    await serviceClient()
      .from('profiles')
      .update({
        plan,
        plan_expires_at: expiresAt,
        mp_payment_id:   String(paymentId),
      })
      .eq('id', userId)

    return json(200, { ok: true })
  }

  // ─── Authenticated routes ───────────────────────────────────────────────────
  const authHeader  = req.headers.authorization || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const user        = await verifyToken(bearerToken)
  if (!user) return json(401, { error: 'No autorizado' })

  // GET ?action=status
  if (req.method === 'GET' && actionQS === 'status') {
    const { data } = await serviceClient()
      .from('profiles')
      .select('plan, plan_expires_at, trial_ends_at')
      .eq('id', user.id)
      .single()

    const now          = Date.now()
    const expiresAt    = data?.plan_expires_at  ? new Date(data.plan_expires_at).getTime()  : 0
    const trialEndsAt  = data?.trial_ends_at    ? new Date(data.trial_ends_at).getTime()    : 0
    const plan         = data?.plan ?? 'free'
    const isPaid       = plan !== 'free' && expiresAt > now
    const inTrial      = plan !== 'free' && !isPaid && trialEndsAt > now

    return json(200, {
      plan,
      plan_expires_at:  data?.plan_expires_at  ?? null,
      trial_ends_at:    data?.trial_ends_at    ?? null,
      is_active:        isPaid || inTrial,
      in_trial:         inTrial,
    })
  }

  // POST actions
  if (req.method === 'POST') {
    const raw = await readBody(req)
    let body
    try { body = JSON.parse(raw) } catch { return json(400, { error: 'JSON inválido' }) }

    const { action, plan } = body

    // ── Start free trial ──────────────────────────────────────────────────────
    if (action === 'start_trial') {
      if (!plan || !PLANS[plan]) return json(400, { error: 'Plan inválido' })

      // Check if already had a trial (one trial per account)
      const { data: profile } = await serviceClient()
        .from('profiles')
        .select('plan, trial_ends_at')
        .eq('id', user.id)
        .single()

      if (profile?.trial_ends_at) {
        return json(409, { error: 'Ya usaste el período de prueba gratuita' })
      }
      if (profile?.plan && profile.plan !== 'free') {
        return json(409, { error: 'Ya tenés un plan activo' })
      }

      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()

      await serviceClient()
        .from('profiles')
        .update({ plan, trial_ends_at: trialEndsAt })
        .eq('id', user.id)

      return json(200, { ok: true, trial_ends_at: trialEndsAt })
    }

    // ── Create MP Checkout Pro preference ─────────────────────────────────────
    if (action === 'create_preference') {
      if (!plan || !PLANS[plan]) return json(400, { error: 'Plan inválido' })

      const planInfo  = PLANS[plan]
      const siteUrl   = process.env.SITE_URL || 'https://cotizagro.com.ar'
      const webhookUrl = `${siteUrl}/api/mercadopago?webhook=1`

      const preference = {
        items: [{
          id:           plan,
          title:        planInfo.name,
          description:  planInfo.description,
          quantity:     1,
          currency_id:  'ARS',
          unit_price:   planInfo.price_ars,
        }],
        payer: {
          email: user.email,
        },
        external_reference: user.id,
        metadata: {
          plan,
          user_id: user.id,
        },
        back_urls: {
          success: `${siteUrl}/settings?payment=success&plan=${plan}`,
          failure: `${siteUrl}/settings?payment=failure`,
          pending: `${siteUrl}/settings?payment=pending`,
        },
        auto_return:          'approved',
        notification_url:     webhookUrl,
        statement_descriptor: 'COTIZAGRO',
        expires:              false,
      }

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preference),
      })

      if (!mpRes.ok) {
        const err = await mpRes.json().catch(() => ({}))
        console.error('[mercadopago] Error creando preferencia:', err)
        return json(502, { error: 'Error al crear preferencia en Mercado Pago' })
      }

      const pref = await mpRes.json()
      return json(200, {
        init_point:         pref.init_point,
        sandbox_init_point: pref.sandbox_init_point,
        preference_id:      pref.id,
      })
    }

    // ── Cancel subscription ───────────────────────────────────────────────────
    if (action === 'cancel_subscription') {
      // Reset plan to free; keep trial_ends_at so they can't restart a trial
      await serviceClient()
        .from('profiles')
        .update({ plan: 'free', plan_expires_at: null })
        .eq('id', user.id)

      return json(200, { ok: true })
    }

    return json(400, { error: 'Acción desconocida' })
  }

  return json(405, { error: 'Method not allowed' })
}
