/**
 * Shared CORS helper for Vercel API functions.
 * Returns headers only for allowed origins; rejects others with 403.
 */

const ALLOWED_ORIGINS = [
  process.env.SITE_URL || '',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  // Vercel preview URLs for the teste branch
  process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

/**
 * Returns CORS headers if origin is allowed, or null if it should be rejected.
 * Non-browser requests (no Origin header) are always allowed — they come from
 * server-to-server or curl, where CORS doesn't apply.
 */
export function getCorsHeaders(origin) {
  if (!origin) {
    // No Origin = server-side / curl request, not a browser cross-origin call
    return {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  }
  if (!ALLOWED_ORIGINS.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

/**
 * Handles preflight and CORS rejection.
 * Returns true if the request was handled (caller should return immediately).
 */
export function handleCors(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    if (cors) Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    res.end()
    return { handled: true, cors: cors || {} }
  }

  if (origin && !cors) {
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 403
    res.end(JSON.stringify({ error: 'Origin not allowed' }))
    return { handled: true, cors: {} }
  }

  return { handled: false, cors: cors || {} }
}
