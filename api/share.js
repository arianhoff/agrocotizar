/**
 * GET  /api/share?t=TOKEN          → redirect to fresh signed PDF URL
 * POST /api/share { quote_number, storage_path, tenant_id } → upsert, returns { token }
 *
 * Security: the token is a 128-bit random hex string, unguessable even knowing the quote number.
 */
import { createClient } from '@supabase/supabase-js'
import { handleCors } from './_cors.js'

function serviceSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export default async function handler(req, res) {
  const { handled } = handleCors(req, res)
  if (handled) return

  // ── POST: save storage path, return opaque token ───────────────────────────
  if (req.method === 'POST') {
    const { quote_number, storage_path, tenant_id } = req.body ?? {}
    if (!quote_number || !storage_path || !tenant_id) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    // Generate a 128-bit random token (unguessable)
    const token = Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
      b => b.toString(16).padStart(2, '0')
    ).join('')

    const supabase = serviceSupabase()
    const { error } = await supabase.from('quote_shares').upsert(
      { quote_number, storage_path, tenant_id, token },
      { onConflict: 'quote_number' },
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true, token })
  }

  // ── GET: redirect to signed URL using opaque token ─────────────────────────
  const { t } = req.query
  if (!t) return res.status(400).send('Missing token')

  const supabase = serviceSupabase()

  const { data, error } = await supabase
    .from('quote_shares')
    .select('storage_path')
    .eq('token', t)
    .single()

  if (error || !data) return res.status(404).send('Enlace no encontrado o expirado')

  const { data: signed, error: signErr } = await supabase.storage
    .from('quote-pdfs')
    .createSignedUrl(data.storage_path, 60 * 60 * 24 * 7) // 7 days

  if (signErr || !signed?.signedUrl) return res.status(500).send('Error generando enlace')

  res.redirect(302, signed.signedUrl)
}
