/**
 * /api/share?q=COT-7597
 * Looks up the storage path for the quote, generates a fresh signed URL, and redirects.
 */
import { createClient } from '@supabase/supabase-js'
import { handleCors } from './_cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return

  const { q } = req.query
  if (!q) return res.status(400).json({ error: 'Missing q param' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

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
