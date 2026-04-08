/**
 * Netlify Edge Function — Anthropic API proxy
 *
 * Edge Functions run on V8 isolates (Deno runtime), support streaming
 * responses natively, and have no 10-second timeout limit.
 *
 * The ANTHROPIC_API_KEY env var is injected by Netlify at runtime and
 * never exposed to the browser.
 */

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Edge Functions use Deno.env (not process.env)
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

export const config = { path: '/api/anthropic' }
