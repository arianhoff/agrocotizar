/**
 * Netlify Edge Function — Anthropic API proxy
 *
 * Edge Functions run on V8 isolates (Deno runtime), support streaming
 * responses natively, and have no 10-second timeout limit.
 *
 * The ANTHROPIC_API_KEY env var is injected by Netlify at runtime and
 * never exposed to the browser.
 */

// Netlify auto-injects URL env var with the primary site URL
const ALLOWED_ORIGINS = [
  Netlify.env.get('URL') ?? '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  }
}

export default async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get('origin') ?? ''

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    })
  }

  // Edge Functions use Deno.env (not process.env)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
    )
  }

  const body = await req.text()

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body,
  })

  // Stream the response body directly (edge functions support this natively)
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const config = { path: '/api/anthropic' }
