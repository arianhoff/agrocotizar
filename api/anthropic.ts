import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getCorsHeaders } from './_cors'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) ?? ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') return res.status(204).set(cors).end()
  if (req.method !== 'POST') return res.status(405).set(cors).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).set(cors).json({ error: 'ANTHROPIC_API_KEY no configurada' })

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

    const contentType = upstream.headers.get('content-type') ?? 'application/json'
    res.status(upstream.status).set({
      ...cors,
      'Content-Type': contentType,
      ...(isStream ? { 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } : {}),
    })

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
