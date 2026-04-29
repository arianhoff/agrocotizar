/**
 * /api/padron?cuit=20392481770
 * Proxy ARCA/AFIP Padrón — ws_sr_padron_a13 SOAP
 *
 * Supports ?warm=true to pre-heat the WSAA token without making a padron call.
 */
import { createClient } from '@supabase/supabase-js'
import { Agent, fetch as undiciFetch } from 'undici'
import { handleCors } from './_cors.js'
import { getOrFetchToken, getAfipEnvVars, getUrls } from './_afip.js'

const tlsAgent = new Agent({
  connect: {
    rejectUnauthorized: false,
    ciphers: [
      'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
    minVersion: 'TLSv1.2',
  },
})

async function verifySupabaseToken(bearerToken) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return { ok: false, reason: 'SUPABASE_URL o SUPABASE_ANON_KEY no configuradas' }
  if (!bearerToken) return { ok: false, reason: 'Sin token Bearer en el request' }
  const { data: { user }, error } = await createClient(url, key).auth.getUser(bearerToken)
  if (error || !user) return { ok: false, reason: error?.message || 'Token inválido o expirado' }
  return { ok: true }
}

function send(res, status, headers, body) {
  const json = JSON.stringify(body)
  Object.entries({ ...headers, 'Content-Type': 'application/json' })
    .forEach(([k, v]) => res.setHeader(k, v))
  res.statusCode = status
  res.end(json)
}

export default async function handler(req, res) {
  const { handled, cors } = handleCors(req, res)
  if (handled) return

  const authHeader = req.headers.authorization || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const auth = await verifySupabaseToken(bearerToken)
  if (!auth.ok) {
    return send(res, 401, cors, { error: 'Unauthorized', reason: auth.reason })
  }

  const { certPem, keyPem, afipCuit } = getAfipEnvVars()
  if (!certPem || !keyPem || !afipCuit) {
    return send(res, 503, cors, { error: 'AFIP_NOT_CONFIGURED', message: 'AFIP_CERT / AFIP_KEY / AFIP_CUIT no configuradas' })
  }

  const { wsaaUrl, padronUrl } = getUrls()
  const reqUrl = new URL(req.url || '', 'http://localhost')

  // Warmup: just acquire/validate the WSAA token, no padron call
  if (reqUrl.searchParams.get('warm') === 'true') {
    try {
      await getOrFetchToken(certPem, keyPem, wsaaUrl)
      return send(res, 200, cors, { ok: true })
    } catch (err) {
      // Never fail hard on warmup — client ignores the response anyway
      return send(res, 200, cors, { ok: false, reason: err.message })
    }
  }

  const cuit = reqUrl.searchParams.get('cuit') || ''
  if (!/^\d{11}$/.test(cuit)) {
    return send(res, 400, cors, { error: 'CUIT inválido', cuit })
  }

  try {
    const { token: wsaaToken, sign } = await getOrFetchToken(certPem, keyPem, wsaaUrl)

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ns2="http://a13.soap.ws.server.puc.sr/">
  <soapenv:Header/>
  <soapenv:Body>
    <ns2:getPersona>
      <token>${wsaaToken}</token>
      <sign>${sign}</sign>
      <cuitRepresentada>${afipCuit}</cuitRepresentada>
      <idPersona>${cuit}</idPersona>
    </ns2:getPersona>
  </soapenv:Body>
</soapenv:Envelope>`

    const padronRes = await undiciFetch(padronUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPAction': '"http://a13.soap.ws.server.puc.sr/getPersona"',
      },
      body: soapBody,
      signal: AbortSignal.timeout(15000),
      dispatcher: tlsAgent,
    })
    const xml = await padronRes.text()

    if (!padronRes.ok) {
      return send(res, padronRes.status >= 500 ? 502 : padronRes.status, cors,
        { error: 'PADRON_ERROR', status: padronRes.status, url: padronUrl, message: xml.substring(0, 300) })
    }

    const faultMsg = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]?.trim()
    if (faultMsg) {
      return send(res, 400, cors, { error: 'PADRON_FAULT', message: faultMsg })
    }

    const personaXml = xml.match(/<personaReturn>([\s\S]*?)<\/personaReturn>/)?.[1] || xml
    const p = (src, tag) => src.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() || ''
    const innerXml = personaXml.match(/<persona>([\s\S]*?)<\/persona>/)?.[1] || personaXml
    const domXml = innerXml.match(/<domicilio>([\s\S]*?)<\/domicilio>/)?.[1] || ''

    const apellido = p(innerXml, 'apellido')
    const nombre   = p(innerXml, 'nombre')
    const denominacion = p(innerXml, 'denominacion') || (apellido ? `${apellido}${nombre ? ', ' + nombre : ''}` : nombre)

    const ivaDesc = p(innerXml, 'descripcionIVA') || p(innerXml, 'condicionIVA') ||
      [...innerXml.matchAll(/<impuesto>([\s\S]*?)<\/impuesto>/g)]
        .map(m => p(m[1], 'descripcionImpuesto') || p(m[1], 'descripcion'))
        .find(d => /iva|monotribut/i.test(d)) || ''

    const actividadesXml = [...innerXml.matchAll(/<actividadesEconomicas>([\s\S]*?)<\/actividadesEconomicas>/g)]
    const actPrincipalDirecta = p(innerXml, 'descripcionActividadPrincipal')

    const data = {
      idPersona:    p(innerXml, 'idPersona') || p(personaXml, 'idPersona'),
      nombre:       denominacion,
      denominacion,
      tipoPersona:  p(innerXml, 'tipoPersona') || p(personaXml, 'tipoPersona'),
      tipoClave:    p(innerXml, 'tipoClave')    || p(personaXml, 'tipoClave'),
      estadoClave:  p(innerXml, 'estadoClave')  || p(personaXml, 'estadoClave'),
      categoriasIVA: ivaDesc ? [{ descripcion: ivaDesc }] : [],
      domicilioFiscal: domXml ? {
        direccion:            p(domXml, 'calle') + (p(domXml, 'numero') ? ' ' + p(domXml, 'numero') : ''),
        localidad:            p(domXml, 'descripcionLocalidad') || p(domXml, 'localidad'),
        descripcionProvincia: p(domXml, 'descripcionProvincia'),
        codPostal:            p(domXml, 'codigoPostal') || p(domXml, 'codPostal'),
      } : undefined,
      actividades: actividadesXml.length > 0
        ? actividadesXml.map(a => ({
            orden: parseInt(p(a[1], 'orden') || '0'),
            descripcionActividad: p(a[1], 'descripcionActividad') || p(a[1], 'actividad'),
          }))
        : actPrincipalDirecta
          ? [{ orden: 1, descripcionActividad: actPrincipalDirecta }]
          : [],
      _raw: process.env.NODE_ENV === 'development' ? xml.substring(0, 1500) : undefined,
    }

    return send(res, 200, cors, { datosGenerales: data })
  } catch (err) {
    const msg = err.message || String(err)
    // alreadyAuthenticated means AFIP has an active session we can't recover — tell the client
    if (msg === 'WSAA_ALREADY_AUTH') {
      return send(res, 503, cors, { error: 'WSAA_ALREADY_AUTH', message: 'El servicio ARCA está temporalmente no disponible. Intentá de nuevo en unos segundos.' })
    }
    return send(res, 500, cors, { error: 'WSAA_ERROR', message: msg })
  }
}
