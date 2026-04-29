/**
 * /api/team
 * Manage team members for Concesionarios plan admins.
 *
 * GET  /api/team              — list members
 * POST /api/team { action: 'create', email, password, name }  — add member
 * POST /api/team { action: 'remove', memberId }               — remove member
 *
 * Auth: Authorization: Bearer <supabase-session-token>
 */

import { createClient } from '@supabase/supabase-js'

function buildWelcomeEmail({ name, email, password, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

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

        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0F172A;">
              ¡Bienvenido/a, ${name}!
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
              Tu acceso a <strong>Cotizagro</strong> está listo. Podés ingresar con las siguientes credenciales:
            </p>

            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;width:90px;">Email</td>
                  <td style="padding:6px 0;font-size:14px;color:#0F172A;font-weight:600;">${email}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:12px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.05em;">Contraseña</td>
                  <td style="padding:6px 0;font-size:14px;color:#0F172A;font-weight:600;font-family:monospace;">${password}</td>
                </tr>
              </table>
            </div>

            <p style="margin:0 0 20px;font-size:13px;color:#64748B;line-height:1.6;">
              Te recomendamos cambiar tu contraseña desde <strong>Configuración</strong> después de tu primer ingreso.
            </p>

            <div style="text-align:center;margin:0 0 24px;">
              <a href="${siteUrl}"
                style="display:inline-block;background:#22C55E;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;box-shadow:0 4px 12px rgba(34,197,94,0.35);">
                Ingresar a Cotizagro
              </a>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #F1F5F9;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;line-height:1.6;text-align:center;">
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

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export default async function handler(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = serviceClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Verify caller is a concesionarios admin (not a member themselves)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, trial_ends_at, owner_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) return res.status(500).json({ error: 'Profile not found' })
  if (profile.plan !== 'concesionarios') return res.status(403).json({ error: 'Plan concesionarios requerido' })
  if (profile.owner_id !== null) return res.status(403).json({ error: 'Solo el administrador puede gestionar el equipo' })

  // ── GET: list members ────────────────────────────────────────
  if (req.method === 'GET') {
    const { data: members, error } = await supabase
      .from('profiles')
      .select('id, email, settings, created_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })

    const result = (members ?? []).map(m => ({
      id:         m.id,
      email:      m.email ?? '',
      name:       m.settings?.seller?.name ?? m.email ?? '',
      created_at: m.created_at,
    }))

    return res.status(200).json({ members: result, seats_used: result.length, seats_total: 5 })
  }

  // ── POST ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action } = req.body ?? {}

    // Create member
    if (action === 'create') {
      const { email, password, name } = req.body ?? {}

      if (!email || !password || !name)
        return res.status(400).json({ error: 'email, password y nombre son requeridos' })

      // Check seat limit
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)

      if ((count ?? 0) >= 5)
        return res.status(400).json({ error: 'seat_limit', message: 'Límite de 5 vendedores alcanzado' })

      // Create Supabase auth user (email pre-confirmed)
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError) {
        if (createError.message.toLowerCase().includes('already'))
          return res.status(400).json({ error: 'email_taken', message: 'Este email ya está registrado' })
        return res.status(400).json({ error: createError.message })
      }

      // Update their auto-created profile with owner_id, plan and name
      await supabase
        .from('profiles')
        .update({
          owner_id:        user.id,
          plan:            'concesionarios',
          plan_expires_at: profile.plan_expires_at,
          trial_ends_at:   profile.trial_ends_at,
          settings:        { seller: { name } },
        })
        .eq('id', newUser.user.id)

      // Send welcome email with credentials
      const siteUrl = process.env.SITE_URL || 'https://cotizagro.com.ar'
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'Cotizagro <noreply@cotizagro.com.ar>',
            to:      [email],
            subject: 'Tu acceso a Cotizagro está listo',
            html:    buildWelcomeEmail({ name, email, password, siteUrl }),
          }),
        }).catch(e => console.error('[team] Failed to send welcome email:', e))
      }

      console.log(`[team] Created member ${email} under admin ${user.id}`)
      return res.status(200).json({ ok: true, member: { id: newUser.user.id, email, name } })
    }

    // Remove member
    if (action === 'remove') {
      const { memberId } = req.body ?? {}
      if (!memberId) return res.status(400).json({ error: 'memberId requerido' })

      // Verify member belongs to this admin
      const { data: member } = await supabase
        .from('profiles')
        .select('owner_id')
        .eq('id', memberId)
        .single()

      if (!member || member.owner_id !== user.id)
        return res.status(403).json({ error: 'Forbidden' })

      // Delete auth user — cascades to profile and all their data
      const { error: deleteError } = await supabase.auth.admin.deleteUser(memberId)
      if (deleteError) return res.status(500).json({ error: deleteError.message })

      console.log(`[team] Removed member ${memberId} from admin ${user.id}`)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Acción desconocida' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
