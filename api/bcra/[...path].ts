import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Agent, fetch as undiciFetch } from 'undici'
import { getCorsHeaders } from '../_cors'

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) ?? ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return res.status(204).set(cors).end()
  if (req.method !== 'GET') return res.status(405).set(cors).json({ error: 'Method not allowed' })

  const path = (req.url ?? '').replace(/^\/api\/bcra/, '') || '/'
  const url = `https://api.bcra.gob.ar${path}`

  try {
    const upstream = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-site',
        Connection: 'keep-alive',
      },
      // @ts-expect-error — undici dispatcher
      dispatcher: agent,
    })
    const body = await upstream.text()
    res.status(upstream.status)
      .set({ ...cors, 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' })
      .send(body)
  } catch (err) {
    res.status(500).set(cors).json({ error: `BCRA proxy error: ${(err as Error).message}` })
  }
}
