/**
 * GET  /api/share?q=COT-7597       → redirect to fresh signed PDF URL
 * POST /api/share { quote_number, storage_path, tenant_id }  → upsert path (uses service role, bypasses RLS)
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
  if (handleCors(req, res)) return

  // ── POST: save storage path ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { quote_number, storage_path, tenant_id } = req.body ?? {}
    if (!quote_number || !storage_path || !tenant_id) {
      return res.status(400).json({ error: 'Missing fields' })
    }

    const supabase = serviceSupabase()
    const { error } = await supabase.from('quote_shares').upsert(
      { quote_number, storage_path, tenant_id },
      { onConflict: 'quote_number' },
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // ── GET: redirect to signed URL ────────────────────────────────────────────
  const { q } = req.query
  if (!q) return res.status(400).send('Missing q param')

  const supabase = serviceSupabase()

  const { data, error } = await supabase
    .from('quote_shares')
    .select('storage_path')
    .eq('quote_number', q)
    .single()

  if (error || !data) return res.status(404).send('Cotización no encontrada')

  const { data: signed, error: signErr } = await supabase.storage
    .from('quote-pdfs')
    .createSignedUrl(data.storage_path, 60 * 60 * 24 * 7) // 7 days

  if (signErr || !signed?.signedUrl) return res.status(500).send('Error generando enlace')

  res.redirect(302, signed.signedUrl)
}
