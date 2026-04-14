/**
 * /api/cron-trial-reminder
 * Runs daily via Vercel Cron.
 * Finds users whose free trial expires in ~3 days and sends a reminder email via Resend.
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY
 *   CRON_SECRET  (Vercel sets this automatically; validates the request is from Vercel)
 *   SITE_URL     (https://cotizagro.com.ar)
 */

import { createClient } from '@supabase/supabase-js'

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
  )
}

function buildEmailHtml(email, daysLeft, trialEndsAt, siteUrl) {
  const expiry = new Date(trialEndsAt).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const urgencyColor = daysLeft <= 1 ? '#EF4444' : '#F59E0B'

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A,#22C55E);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:14px;margin-bottom:16px;">
              <span style="font-size:28px;">🚜</span>
            </div>
            <div style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
              Cotiz<span style="opacity:0.85;">agro</span>
            </div>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0F172A;">
              Tu prueba gratuita vence pronto
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Tu período de prueba de <strong>14 días gratis</strong> en Cotizagro vence el <strong>${expiry}</strong>.
            </p>

            <!-- Days left badge -->
            <div style="text-align:center;margin:24px 0;">
              <div style="display:inline-block;background:${urgencyColor}15;border:1px solid ${urgencyColor}30;border-radius:12px;padding:16px 32px;">
                <div style="font-size:36px;font-weight:900;color:${urgencyColor};line-height:1;">${daysLeft}</div>
                <div style="font-size:13px;color:${urgencyColor};font-weight:600;margin-top:4px;">
                  día${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
              Para seguir usando todas las funciones sin interrupciones, contratá el plan:
            </p>

            <!-- Features -->
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
              <div style="font-size:12px;font-weight:700;color:#22C55E;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">Plan Vendedores — USD 9/mes</div>
              <table cellpadding="0" cellspacing="0" width="100%">
                ${[
                  'Cotizaciones ilimitadas',
                  'IA ilimitada + importación PDF',
                  'Listas de precios ilimitadas',
                  'PDF profesional con tu logo',
                  'CRM y seguimiento automático',
                  'Soporte por WhatsApp',
                ].map(f => `<tr><td style="padding:3px 0;font-size:13px;color:#475569;">✓&nbsp;&nbsp;${f}</td></tr>`).join('')}
              </table>
            </div>

            <div style="text-align:center;margin:0 0 24px;">
              <a href="${siteUrl}/settings?section=subscription"
                style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(34,197,94,0.35);">
                Contratar plan ahora
              </a>
            </div>

            <p style="margin:0;font-size:13px;color:#94A3B8;line-height:1.6;text-align:center;">
              Sin contratos · Cancelás cuando querás · Pagos via Mercado Pago
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;text-align:center;">
              Recibís este email porque tenés una cuenta en Cotizagro (${email}).<br>
              © ${new Date().getFullYear()} Cotizagro · <a href="${siteUrl}" style="color:#94A3B8;">cotizagro.com.ar</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export default async function handler(req, res) {
  // Vercel passes CRON_SECRET as Bearer token — reject everything else
  const authHeader = req.headers.authorization || ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })

  const siteUrl = process.env.SITE_URL || 'https://cotizagro.com.ar'
  const now = new Date()

  // Find trials expiring in 2–4 days (window handles slight cron drift)
  const windowStart = new Date(now.getTime() + 2 * 86_400_000).toISOString()
  const windowEnd   = new Date(now.getTime() + 4 * 86_400_000).toISOString()

  const { data: profiles, error } = await serviceClient()
    .from('profiles')
    .select('id, email, trial_ends_at, plan_expires_at')
    .not('trial_ends_at', 'is', null)
    .gt('trial_ends_at', windowStart)
    .lt('trial_ends_at', windowEnd)

  if (error) {
    console.error('[cron-trial-reminder] Supabase error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  let sent = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    // Skip if user already has an active paid plan
    if (profile.plan_expires_at && new Date(profile.plan_expires_at) > now) {
      skipped++
      continue
    }
    if (!profile.email) { skipped++; continue }

    const trialEnd = new Date(profile.trial_ends_at)
    const daysLeft = Math.ceil((trialEnd - now) / 86_400_000)

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Cotizagro <noreply@cotizagro.com.ar>',
        to:      [profile.email],
        subject: `Tu prueba gratuita vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''} — Cotizagro`,
        html:    buildEmailHtml(profile.email, daysLeft, profile.trial_ends_at, siteUrl),
      }),
    })

    if (emailRes.ok) {
      sent++
      console.log(`[cron-trial-reminder] Sent to ${profile.email} (${daysLeft} days left)`)
    } else {
      const err = await emailRes.json().catch(() => ({}))
      console.error(`[cron-trial-reminder] Failed for ${profile.email}:`, err)
    }
  }

  return res.status(200).json({ ok: true, sent, skipped, total: (profiles ?? []).length })
}
