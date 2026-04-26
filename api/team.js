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
