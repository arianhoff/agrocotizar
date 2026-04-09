/**
 * CORS helper for Netlify Functions.
 * Allows requests only from the configured site URL and localhost.
 */

const ALLOWED_ORIGINS = [
  // Netlify auto-injects the primary URL as process.env.URL
  process.env.URL ?? '',
  // Allow local dev
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? '')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}
