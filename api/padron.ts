/**
 * /api/padron?cuit=20392481770
 * Proxy ARCA/AFIP Padrón — acepta el CUIT como query parameter.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import handler from './_afip-handler.js'

export default function padron(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // Rewrite req.url so _afip-handler extracts the CUIT from the last segment
  const url = new URL(req.url ?? '', 'http://localhost')
  const cuit = url.searchParams.get('cuit') ?? ''
  req.url = `/api/afip/sr-padron/v2/persona/${cuit}`
  return handler(req, res)
}
