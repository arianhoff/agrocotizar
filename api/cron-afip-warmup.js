/**
 * /api/cron-afip-warmup
 * Runs every 6 hours via Vercel Cron.
 * Proactively refreshes the AFIP WSAA token in Supabase so that cold-start
 * padron requests always find a valid cached token and respond immediately.
 *
 * Required env vars: AFIP_CERT, AFIP_KEY, AFIP_CUIT, SUPABASE_URL,
 *                    SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET
 */
import { getOrFetchToken, getAfipEnvVars, getUrls } from './_afip.js'

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { certPem, keyPem, afipCuit } = getAfipEnvVars()
  if (!certPem || !keyPem || !afipCuit) {
    return res.status(500).json({ error: 'AFIP env vars not configured' })
  }

  const { wsaaUrl } = getUrls()

  try {
    await getOrFetchToken(certPem, keyPem, wsaaUrl)
    console.log('[cron-afip-warmup] WSAA token refreshed OK')
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[cron-afip-warmup] Failed:', err.message)
    return res.status(500).json({ ok: false, error: err.message })
  }
}
