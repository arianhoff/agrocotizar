/**
 * /api/anthropic
 * Proxy Anthropic API — requires valid Supabase JWT
 */
import { createClient } from '@supabase/supabase-js'
import { handleCors } from './_cors.js'

async function verifySupabaseToken(bearerToken) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return { ok: false, reason: 'SUPABASE_URL o SUPABASE_ANON_KEY no configuradas' }
  if (!bearerToken) return { ok: false, reason: 'Sin token Bearer en el request' }
  const { data: { user }, error } = await createClient(url, key).auth.getUser(bearerToken)
  if (error || !user) return { ok: false, reason: error?.message || 'Token inválido o expirado' }
  return { ok: true }
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
  const { handled, cors } = handleCors(req, res)
  if (handled) return

  if (req.method !== 'POST') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 405
    return res.end(JSON.stringify({ error: 'Method not allowed' }))
  }

  const authHeader = req.headers.authorization || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const auth = await verifySupabaseToken(bearerToken)
  if (!auth.ok) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 401
    return res.end(JSON.stringify({ error: 'Unauthorized', reason: auth.reason }))
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 500
    return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada' }))
  }

  // Allowed models — only Haiku to prevent cost abuse
  const ALLOWED_MODELS = new Set([
    'claude-haiku-4-5-20251001',
    'claude-haiku-4-5',
  ])
  // Hard cap on tokens regardless of what the client sends
  const MAX_TOKENS_CAP = 16000
  // Max messages in a single request
  const MAX_MESSAGES = 10

  try {
    const rawBody = await readBody(req)
    let parsed
    try { parsed = JSON.parse(rawBody) } catch {
      Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'Invalid JSON body' }))
    }

    // Validate model
    if (!parsed.model || !ALLOWED_MODELS.has(parsed.model)) {
      Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'Modelo no permitido' }))
    }

    // Enforce token cap
    if (!parsed.max_tokens || parsed.max_tokens > MAX_TOKENS_CAP) {
      parsed.max_tokens = MAX_TOKENS_CAP
    }

    // Enforce messages limit
    if (Array.isArray(parsed.messages) && parsed.messages.length > MAX_MESSAGES) {
      Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 400
      return res.end(JSON.stringify({ error: 'Demasiados mensajes en el request' }))
    }

    const isStream = !!parsed.stream
    const body = JSON.stringify(parsed)

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
