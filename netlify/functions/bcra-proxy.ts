/**
 * Netlify Function — BCRA Central de Deudores proxy
 *
 * The BCRA API (api.bcra.gob.ar) blocks non-browser TLS via JA3 fingerprinting.
 * We use undici directly with a custom Agent that disables TLS verification
 * and uses a Chrome-like cipher list to bypass this restriction.
 */

import { Agent, fetch as undiciFetch } from 'undici'
import type { Handler } from '@netlify/functions'
import { getCorsHeaders } from './_cors'

// Agent with browser-like TLS settings to bypass BCRA JA3 fingerprinting
const agent = new Agent({
  connect: {
    rejectUnauthorized: false,   // bypass self-signed / pinned cert check
    ciphers: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
    minVersion: 'TLSv1.2',
  },
})

export const handler: Handler = async (event) => {
  const origin = event.headers.origin ?? event.headers.Origin ?? ''
  const cors = getCorsHeaders(origin)

  // Only allow GET
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'OPTIONS') {
    return { statusCode: 405, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }

  // Base URL is hardcoded to BCRA — no path traversal risk
  const path = event.path.replace(/^\/.netlify\/functions\/bcra-proxy/, '') || '/'
  const query = event.rawQuery ? `?${event.rawQuery}` : ''
  const url = `https://api.bcra.gob.ar${path}${query}`

  try {
    const upstream = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        Connection: 'keep-alive',
      },
      // @ts-expect-error — undici-specific dispatcher option
      dispatcher: agent,
    })

    const body = await upstream.text()

    return {
      statusCode: upstream.status,
      headers: {
        ...cors,
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
      body,
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `BCRA proxy error: ${msg}` }),
    }
  }
}
