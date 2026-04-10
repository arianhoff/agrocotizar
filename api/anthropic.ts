import type { IncomingMessage, ServerResponse } from 'http'
import { getCorsHeaders } from './_cors'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = (req.headers.origin as string) ?? ''
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

  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', async () => {
    const body = Buffer.concat(chunks).toString()
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
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
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
        pump()
      }
      pump()
    } else {
      res.end(await upstream.text())
    }
  })
}
