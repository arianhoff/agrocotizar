/**
 * /api/deudas?cuit=20392481770
 * /api/deudas?cuit=20392481770&historicas=true
 * Proxy BCRA Central de Deudores — autónomo, sin imports locales.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import { Agent, fetch as undiciFetch } from 'undici'

const ALLOWED_ORIGINS = [
  process.env.SITE_URL ?? '',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

function getCorsHeaders(origin: string): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

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

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  const origin = (req.headers.origin as string) ?? ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  const reqUrl = new URL(req.url ?? '', 'http://localhost')
  const cuit = reqUrl.searchParams.get('cuit') ?? ''
  const historicas = reqUrl.searchParams.get('historicas') === 'true'

  const bcraPath = historicas
    ? `/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    : `/centraldedeudores/v1.0/Deudas/${cuit}`
  const url = `https://api.bcra.gob.ar${bcraPath}`

  try {
    const upstream = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      dispatcher: agent as never,
    })
    const body = await upstream.text()
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    res.statusCode = upstream.status
    res.end(body)
  } catch (err) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    res.end(JSON.stringify({ error: `BCRA proxy error: ${(err as Error).message}` }))
  }
}
