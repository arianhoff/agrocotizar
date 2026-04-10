/**
 * /api/deudas?cuit=20392481770
 * /api/deudas?cuit=20392481770&historicas=true
 * Proxy BCRA Central de Deudores
 */
import { Agent, fetch as undiciFetch } from 'undici'

const agent = new Agent({
  connect: {
    rejectUnauthorized: false,
    ciphers: [
      'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
    minVersion: 'TLSv1.2',
  },
})

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

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  const reqUrl = new URL(req.url || '', 'http://localhost')
  const cuit = reqUrl.searchParams.get('cuit') || ''
  const historicas = reqUrl.searchParams.get('historicas') === 'true'

  const bcraPath = historicas
    ? `/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    : `/centraldedeudores/v1.0/Deudas/${cuit}`
  const url = `https://api.bcra.gob.ar${bcraPath}`

  // Try multiple fetch strategies — BCRA blocks some IPs/TLS fingerprints
  const fetchStrategies = [
    // Strategy 1: undici with custom TLS (bypasses fingerprint checks)
    () => undiciFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
        'sec-ch-ua-mobile': '?0',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        Referer: 'https://www.bcra.gob.ar/',
        Origin: 'https://www.bcra.gob.ar',
      },
      dispatcher: agent,
    }),
    // Strategy 2: native fetch (different TLS stack)
    () => fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    }),
  ]

  let lastErr = null
  for (const strategy of fetchStrategies) {
    try {
      const upstream = await strategy()
      const body = await upstream.text()
      if (upstream.status >= 500) { lastErr = { status: upstream.status, body }; continue }
      Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
      res.statusCode = upstream.status
      return res.end(body)
    } catch (err) {
      lastErr = { status: 500, body: err.message }
    }
  }

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = lastErr.status || 500
  res.end(JSON.stringify({ error: `BCRA proxy error`, detail: String(lastErr.body).substring(0, 200) }))
}
