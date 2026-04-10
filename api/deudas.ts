/**
 * /api/deudas?cuit=20392481770
 * /api/deudas?cuit=20392481770&historicas=true
 * Proxy BCRA Central de Deudores.
 */
import type { IncomingMessage, ServerResponse } from 'http'
import handler from './_bcra-handler'

export default function deudas(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  const url = new URL(req.url ?? '', 'http://localhost')
  const cuit = url.searchParams.get('cuit') ?? ''
  const historicas = url.searchParams.get('historicas') === 'true'
  const path = historicas
    ? `/centraldedeudores/v1.0/Deudas/Historicas/${cuit}`
    : `/centraldedeudores/v1.0/Deudas/${cuit}`
  req.url = `/api/bcra${path}`
  return handler(req, res)
}
