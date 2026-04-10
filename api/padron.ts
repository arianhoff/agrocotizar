/**
 * /api/padron?cuit=20392481770
 * Proxy ARCA/AFIP Padrón — autónomo, sin imports locales.
 */
import type { IncomingMessage, ServerResponse } from 'http'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _forge: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getForge(): Promise<any> {
  if (!_forge) {
    const m = await import('node-forge')
    _forge = (m as any).default ?? m
  }
  return _forge
}

const ALLOWED_ORIGINS = [
  process.env.SITE_URL ?? '',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean)

function getCorsHeaders(origin: string): Record<string, string> {
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
  const isProd = (process.env.AFIP_ENV ?? '').toLowerCase().trim() === 'prod'
  return {
    wsaaUrl: isProd
      ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
      : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    padronUrl: isProd
      ? 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA13'
      : 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA13',
    isProd,
  }
}

const SERVICE = 'ws_sr_padron_a13'

let memCache: { token: string; sign: string; expiry: Date } | null = null

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function verifySupabaseToken(bearerToken: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_ANON_KEY ?? ''
  if (!url || !key) return false
  const { data: { user }, error } = await createClient(url, key).auth.getUser(bearerToken)
  return !error && !!user
}

interface TokenRow { token: string; sign: string; expiry_at: string }

async function readCachedToken(): Promise<{ token: string; sign: string } | null> {
  if (memCache && memCache.expiry > new Date(Date.now() + 5 * 60_000)) {
    return { token: memCache.token, sign: memCache.sign }
  }
  const sb = getSupabase()
  if (!sb) return null
  try {
    const { data } = await sb
      .from('afip_token_cache')
      .select('token, sign, expiry_at')
      .eq('service', SERVICE)
      .single<TokenRow>()
    if (!data) return null
    const expiry = new Date(data.expiry_at)
    if (expiry > new Date(Date.now() + 5 * 60_000)) {
      memCache = { token: data.token, sign: data.sign, expiry }
      return { token: data.token, sign: data.sign }
    }
  } catch { /* table may not exist yet */ }
  return null
}

async function saveCachedToken(token: string, sign: string, expiry: Date): Promise<void> {
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

function buildTRA(): string {
  const now  = new Date()
  const from = new Date(now.getTime() - 60_000)
  const to   = new Date(now.getTime() + 12 * 3600_000)
  const fmtTs = (d: Date) => {
    const ar = new Date(d.getTime() - 3 * 3600_000)
    return ar.toISOString().replace('Z', '-03:00')
  }
  const uniqueId = Date.now() % 999_999_999
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

async function signTRA(tra: string, certPem: string, keyPem: string): Promise<string> {
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
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  })
  p7.sign()
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return forge.util.encode64(der)
}

async function fetchFreshToken(certPem: string, keyPem: string, wsaaUrl: string): Promise<{ token: string; sign: string }> {
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
    signal: AbortSignal.timeout(15_000),
  })
  const xml = await res.text()

  const innerRaw = xml.match(/<loginCmsReturn[^>]*>([\s\S]*?)<\/loginCmsReturn>/)?.[1] ?? xml
  const inner = innerRaw
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/&#xD;/g, '')

  if (xml.includes('alreadyAuthenticated') || inner.includes('alreadyAuthenticated')) {
    const sb = getSupabase()
    if (sb) {
      try {
        const { data } = await sb.from('afip_token_cache').select('token, sign, expiry_at')
          .eq('service', SERVICE).single<TokenRow>()
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
    const faultMsg = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]?.trim() ?? ''
    throw new Error(`WSAA error${faultMsg ? `: ${faultMsg}` : ''} — ${xml.substring(0, 300)}`)
  }

  const token  = tokenMatch[1].trim()
  const sign   = signMatch[1].trim()
  const expiry = expiryMatch ? new Date(expiryMatch[1].trim()) : new Date(Date.now() + 11 * 3600_000)
  await saveCachedToken(token, sign, expiry)
  return { token, sign }
}

function normalizePem(raw: string): string {
  // Replace literal \n and normalize spaces/newlines
  const s = raw.replace(/\\n/g, '\n').trim()
  // If it already has real newlines it's fine
  if (s.includes('\n')) return s
  // Cert was stored with spaces — reconstruct valid PEM
  const m = s.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END ([^-]+)-----/)
  if (!m) return s
  const b64 = m[2].replace(/\s+/g, '')
  const lines = (b64.match(/.{1,64}/g) ?? []).join('\n')
  return `-----BEGIN ${m[1]}-----\n${lines}\n-----END ${m[3]}-----`
}

function send(res: ServerResponse, status: number, headers: Record<string, string>, body: unknown) {
  const json = JSON.stringify(body)
  Object.entries({ ...headers, 'Content-Type': 'application/json' })
    .forEach(([k, v]) => res.setHeader(k, v))
  res.statusCode = status
  res.end(json)
}

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  const origin = (req.headers.origin as string) ?? ''
  const cors = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
    res.statusCode = 204
    return res.end()
  }

  const authHeader = (req.headers.authorization as string) ?? ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearerToken || !(await verifySupabaseToken(bearerToken))) {
    return send(res, 401, cors, { error: 'Unauthorized' })
  }

  const reqUrl = new URL(req.url ?? '', 'http://localhost')
  const cuit = reqUrl.searchParams.get('cuit') ?? ''
  if (!/^\d{11}$/.test(cuit)) {
    return send(res, 400, cors, { error: 'CUIT inválido', cuit })
  }

  const certPem  = normalizePem(process.env.AFIP_CERT ?? '')
  const keyPem   = (process.env.AFIP_KEY  ?? '').replace(/\\n/g, '\n')
  const afipCuit = process.env.AFIP_CUIT  ?? ''

  if (!certPem || !keyPem || !afipCuit) {
    return send(res, 503, cors, {
      error: 'AFIP_NOT_CONFIGURED',
      message: 'Variables AFIP_CERT / AFIP_KEY / AFIP_CUIT no configuradas',
    })
  }

  const { wsaaUrl, padronUrl } = getUrls()

  try {
    const { token: wsaaToken, sign } = (await readCachedToken()) ?? (await fetchFreshToken(certPem, keyPem, wsaaUrl))

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
      signal: AbortSignal.timeout(15_000),
      dispatcher: tlsAgent as never,
    })
    const xml = await padronRes.text()

    if (!padronRes.ok) {
      return send(res, padronRes.status >= 500 ? 502 : padronRes.status, cors,
        { error: 'PADRON_ERROR', status: padronRes.status, url: padronUrl, message: xml.substring(0, 300) })
    }

    // Parse SOAP response — extract <personaReturn> content
    const faultMsg = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]?.trim()
    if (faultMsg) {
      return send(res, 400, cors, { error: 'PADRON_FAULT', message: faultMsg })
    }

    const personaXml = xml.match(/<personaReturn>([\s\S]*?)<\/personaReturn>/)?.[1] ?? xml
    const p = (src: string, tag: string) => src.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? ''

    // A13 wraps data inside <persona>
    const innerXml = personaXml.match(/<persona>([\s\S]*?)<\/persona>/)?.[1] ?? personaXml

    // Domicilio tag is <domicilio> in A13 (not <domicilioFiscal>)
    const domXml = innerXml.match(/<domicilio>([\s\S]*?)<\/domicilio>/)?.[1] ?? ''

    // Full name: apellido + nombre for FISICA, denominacion for JURIDICA
    const apellido = p(innerXml, 'apellido')
    const nombre   = p(innerXml, 'nombre')
    const denominacion = p(innerXml, 'denominacion') || (apellido ? `${apellido}${nombre ? ', ' + nombre : ''}` : nombre)

    // IVA: try multiple possible tags
    const ivaDesc = p(innerXml, 'descripcionIVA') || p(innerXml, 'condicionIVA') ||
      [...innerXml.matchAll(/<impuesto>([\s\S]*?)<\/impuesto>/g)]
        .map(m => p(m[1], 'descripcionImpuesto') || p(m[1], 'descripcion'))
        .find(d => /iva|monotribut/i.test(d)) ?? ''

    // Actividades: try <actividadesEconomicas> blocks, fallback to <descripcionActividadPrincipal>
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
    const msg = (err as Error).message ?? String(err)
    return send(res, 500, cors, { error: 'WSAA_ERROR', message: msg })
  }
}
