/**
 * /api/anthropic
 * Proxy Anthropic API
 */
const ALLOWED_ORIGINS = [
  process.env.SITE_URL || '',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

function getCorsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  if (req.method !== 'POST') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }))
  }

  try {
    const body = await readBody(req)
    let isStream = false
    try { isStream = !!JSON.parse(body).stream } catch { /* ignore */ }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    })

    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    if (isStream) {
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('X-Accel-Buffering', 'no')
    }
    res.statusCode = upstream.status

    if (upstream.body) {
      const reader = upstream.body.getReader()
      const pump = async () => {
        const { done, value } = await reader.read()
        if (done) { res.end(); return }
        res.write(value)
        return pump()
      }
      await pump()
    } else {
      res.end(await upstream.text())
    }
  } catch (err) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message || String(err) }))
  }
}
