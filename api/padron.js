/**
 * /api/padron?cuit=20392481770
 * Proxy ARCA/AFIP Padrón — ws_sr_padron_a13 SOAP
 */
import { createClient } from '@supabase/supabase-js'
import { Agent, fetch as undiciFetch } from 'undici'

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

let _forge = null
async function getForge() {
  if (!_forge) {
    const m = await import('node-forge')
    _forge = m.default ?? m
  }
  return _forge
}

const ALLOWED_ORIGINS = [
  process.env.SITE_URL || '',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

function getCorsHeaders(origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function getUrls() {
  const isProd = (process.env.AFIP_ENV || '').toLowerCase().trim() === 'prod'
  return {
    wsaaUrl: isProd
      ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    padronUrl: isProd
      ? 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13'
      : 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13',
  }
}

const SERVICE = 'ws_sr_padron_a13'
let memCache = null

function getSupabase() {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function verifySupabaseToken(bearerToken) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return { ok: false, reason: 'SUPABASE_URL o SUPABASE_ANON_KEY no configuradas' }
  if (!bearerToken) return { ok: false, reason: 'Sin token Bearer en el request' }
  const { data: { user }, error } = await createClient(url, key).auth.getUser(bearerToken)
  if (error || !user) return { ok: false, reason: error?.message || 'Token inválido o expirado' }
  return { ok: true }
}

async function readCachedToken() {
  if (memCache && memCache.expiry > new Date(Date.now() + 5 * 60000)) {
    return { token: memCache.token, sign: memCache.sign }
  }
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data } = await sb
      .from('afip_token_cache')
      .select('token, sign, expiry_at')
      .eq('service', SERVICE)
      .single()
    if (!data) return null
    const expiry = new Date(data.expiry_at)
    if (expiry > new Date(Date.now() + 5 * 60000)) {
      memCache = { token: data.token, sign: data.sign, expiry }
      return { token: data.token, sign: data.sign }
    }
  } catch { /* table may not exist */ }
  return null
}

async function saveCachedToken(token, sign, expiry) {
  memCache = { token, sign, expiry }
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('afip_token_cache').upsert({
      service: SERVICE, token, sign,
      expiry_at: expiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch { /* non-fatal */ }
}

function buildTRA() {
  const now  = new Date()
  const from = new Date(now.getTime() - 60000)
  const to   = new Date(now.getTime() + 12 * 3600000)
  const fmtTs = (d) => {
    const ar = new Date(d.getTime() - 3 * 3600000)
    return ar.toISOString().replace('Z', '-03:00')
  }
  const uniqueId = Date.now() % 999999999
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${fmtTs(from)}</generationTime>
    <expirationTime>${fmtTs(to)}</expirationTime>
  </header>
  <service>${SERVICE}</service>
</loginTicketRequest>`
}

async function signTRA(tra, certPem, keyPem) {
  const forge = await getForge()
  const cert       = forge.pki.certificateFromPem(certPem)
  const privateKey = forge.pki.privateKeyFromPem(keyPem)
  const p7         = forge.pkcs7.createSignedData()
  p7.content       = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey, certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  })
  p7.sign()
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return forge.util.encode64(der)
}

async function fetchFreshToken(certPem, keyPem, wsaaUrl) {
  const cms = await signTRA(buildTRA(), certPem, keyPem)
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:log="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <log:loginCms><log:in0>${cms}</log:in0></log:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(wsaaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '""' },
    body: soapBody,
    signal: AbortSignal.timeout(15000),
  })
  const xml = await res.text()

  const innerRaw = xml.match(/<loginCmsReturn[^>]*>([\s\S]*?)<\/loginCmsReturn>/)?.[1] || xml
  const inner = innerRaw
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&#xD;/g, '')

  if (xml.includes('alreadyAuthenticated') || inner.includes('alreadyAuthenticated')) {
    const sb = getSupabase()
    if (sb) {
      try {
        const { data } = await sb.from('afip_token_cache').select('token, sign, expiry_at')
          .eq('service', SERVICE).single()
        if (data) {
          memCache = { token: data.token, sign: data.sign, expiry: new Date(data.expiry_at) }
          return { token: data.token, sign: data.sign }
        }
      } catch { /* no row */ }
    }
    throw new Error('WSAA alreadyAuthenticated — sin token en caché')
  }

  const tokenMatch  = inner.match(/<token>([\s\S]*?)<\/token>/)
  const signMatch   = inner.match(/<sign>([\s\S]*?)<\/sign>/)
  const expiryMatch = inner.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)

  if (!tokenMatch || !signMatch) {
    const faultMsg = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]?.trim() || ''
    throw new Error(`WSAA error${faultMsg ? `: ${faultMsg}` : ''} — ${xml.substring(0, 300)}`)
  }

  const token  = tokenMatch[1].trim()
  const sign   = signMatch[1].trim()
  const expiry = expiryMatch ? new Date(expiryMatch[1].trim()) : new Date(Date.now() + 11 * 3600000)
  await saveCachedToken(token, sign, expiry)
  return { token, sign }
}

function normalizePem(raw) {
  const s = raw.replace(/\\n/g, '\n').trim()
  if (s.includes('\n')) return s
  const m = s.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END ([^-]+)-----/)
  if (!m) return s
  const b64 = m[2].replace(/\s+/g, '')
  const lines = (b64.match(/.{1,64}/g) || []).join('\n')
  return `-----BEGIN ${m[1]}-----\n${lines}\n-----END ${m[3]}-----`
}

function send(res, status, headers, body) {
  const json = JSON.stringify(body)
  Object.entries({ ...headers, 'Content-Type': 'application/json' })
    .forEach(([k, v]) => res.setHeader(k, v))
  res.statusCode = status
  res.end(json)
}

export default async function handler(req, res) {
  const origin = req.headers.origin || ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  const authHeader = req.headers.authorization || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const auth = await verifySupabaseToken(bearerToken)
  if (!auth.ok) {
    return send(res, 401, cors, { error: 'Unauthorized', reason: auth.reason })
  }

  const reqUrl = new URL(req.url || '', 'http://localhost')
  const cuit = reqUrl.searchParams.get('cuit') || ''
  if (!/^\d{11}$/.test(cuit)) {
    return send(res, 400, cors, { error: 'CUIT inválido', cuit })
  }

  const certPem  = normalizePem(process.env.AFIP_CERT || '')
  const keyPem   = (process.env.AFIP_KEY || '').replace(/\\n/g, '\n')
  const afipCuit = process.env.AFIP_CUIT || ''

  if (!certPem || !keyPem || !afipCuit) {
    return send(res, 503, cors, { error: 'AFIP_NOT_CONFIGURED', message: 'AFIP_CERT / AFIP_KEY / AFIP_CUIT no configuradas' })
  }

  const { wsaaUrl, padronUrl } = getUrls()

  try {
    const cached = await readCachedToken()
    const { token: wsaaToken, sign } = cached || (await fetchFreshToken(certPem, keyPem, wsaaUrl))

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
      _raw: xml.substring(0, 1500),
    }

    return send(res, 200, cors, { datosGenerales: data })
  } catch (err) {
    const msg = err.message || String(err)
    return send(res, 500, cors, { error: 'WSAA_ERROR', message: msg })
  }
}
