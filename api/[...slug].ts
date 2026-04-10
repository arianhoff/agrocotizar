/**
 * Top-level catch-all router.
 * Vercel doesn't support nested catch-all routes in subdirectories,
 * so we route /api/afip/* and /api/bcra/* from here.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import afipHandler from './afip/[...path]'
import bcraHandler from './bcra/[...path]'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? ''
  if (url.startsWith('/api/afip/') || url.startsWith('/api/afip?')) {
    return afipHandler(req, res)
  }
  if (url.startsWith('/api/bcra/') || url.startsWith('/api/bcra?')) {
    return bcraHandler(req, res)
  }
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 404
  res.end(JSON.stringify({ error: 'Not found' }))
}
