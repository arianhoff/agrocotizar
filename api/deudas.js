/**
 * /api/deudas?cuit=20392481770
 * Proxy BCRA Central de Deudores
 * NOTE: BCRA blocks cloud IPs — returns 503 immediately.
 */
import { handleCors } from './_cors.js'

export default async function handler(req, res) {
  const { handled, cors } = handleCors(req, res)
  if (handled) return

  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
  res.setHeader('Content-Type', 'application/json')
  res.statusCode = 503
  res.end(JSON.stringify({
    error: 'BCRA_BLOCKED',
    detail: 'BCRA bloquea las IPs de servidores en la nube. Consultá directamente en bcra.gob.ar',
  }))
}
