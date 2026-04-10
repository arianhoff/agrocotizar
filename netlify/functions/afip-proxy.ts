/**
 * Netlify Function — ARCA (ex-AFIP) Padrón Alcance 5
 *
 * Flujo WSAA:
 * 1. Genera TRA (Ticket de Requerimiento de Acceso) en XML
 * 2. Firma el TRA con la clave privada + certificado (PKCS#7 CMS)
 * 3. Envía al WSAA → obtiene TOKEN + SIGN (válidos 12hs)
 * 4. Llama a ws_sr_padron_a5 con TOKEN + SIGN → datos del contribuyente
 *
 * El token se persiste en Supabase (tabla afip_token_cache) para sobrevivir
 * cold starts de Netlify — así se evita el límite de AFIP por certificado.
 *
 * Variables de entorno requeridas (Netlify):
 *   AFIP_CUIT              — CUIT del contribuyente (ej: 20392481770)
 *   AFIP_CERT              — Certificado PEM firmado por AFIP
 *   AFIP_KEY               — Clave privada RSA en PEM
 *   AFIP_ENV               — "prod" usa producción, cualquier otro valor usa homologación
 *   SUPABASE_URL           — URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (para leer/escribir la caché sin RLS)
 *   SUPABASE_ANON_KEY      — Fallback si no hay service role key
 */

import type { Handler } from '@netlify/functions'
import * as forge from 'node-forge'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from './_cors'

// ─── Configuración URLs ───────────────────────────────────────────────────────

const isProd = (process.env.AFIP_ENV ?? '').toLowerCase() === 'prod'

const WSAA_URL   = isProd
  ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'

const PADRON_URL = isProd
  ? 'https://aws.afip.gov.ar/sr-padron/v2/persona'
  : 'https://awshomo.afip.gov.ar/sr-padron/v2/persona'

const SERVICE = 'ws_sr_padron_a5'

// ─── In-memory cache (respaldo rápido entre hot invocations) ──────────────────

let memCache: { token: string; sign: string; expiry: Date } | null = null

// ─── Supabase client (service role para bypassear RLS) ───────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.SUPABASE_ANON_KEY
           ?? process.env.VITE_SUPABASE_ANON_KEY
           ?? ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function verifySupabaseToken(bearerToken: string): Promise<boolean> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !supabaseKey) return false
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
  return !error && !!user
}

// ─── Token cache: Supabase ────────────────────────────────────────────────────

interface TokenRow { token: string; sign: string; expiry_at: string }

async function readCachedToken(): Promise<{ token: string; sign: string } | null> {
  // 1. Memory cache (fast path — same function instance)
  if (memCache && memCache.expiry > new Date(Date.now() + 5 * 60_000)) {
    return { token: memCache.token, sign: memCache.sign }
  }

  // 2. Supabase cache (survives cold starts)
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
      // Warm memory cache too
      memCache = { token: data.token, sign: data.sign, expiry }
      return { token: data.token, sign: data.sign }
    }
  } catch {
    // Table might not exist yet — proceed to fetch fresh token
  }
  return null
}

async function saveCachedToken(token: string, sign: string, expiry: Date): Promise<void> {
  memCache = { token, sign, expiry }
  const sb = getSupabase()
  if (!sb) return
  try {
    await sb.from('afip_token_cache').upsert({
      service: SERVICE,
      token,
      sign,
      expiry_at: expiry.toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch {
    // Non-fatal — in-memory cache is still available
  }
}

// ─── Helpers WSAA ─────────────────────────────────────────────────────────────

function buildTRA(): string {
  const now  = new Date()
  const from = new Date(now.getTime() - 60_000)
  const to   = new Date(now.getTime() + 12 * 3600_000)

  const fmtTs = (d: Date) => {
    const ar = new Date(d.getTime() - 3 * 3600_000)
    return ar.toISOString().replace('Z', '-03:00')
  }

  // uniqueId: seconds + random suffix to avoid collisions across cold starts
  const uniqueId = `${Math.floor(Date.now() / 1000)}${Math.floor(Math.random() * 1000)}`

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

function signTRA(tra: string, certPem: string, keyPem: string): string {
  const cert       = forge.pki.certificateFromPem(certPem)
  const privateKey = forge.pki.privateKeyFromPem(keyPem)

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key:         privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType,   value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime,   value: new Date() },
    ],
  })
  p7.sign()

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return forge.util.encode64(der)
}

async function fetchFreshToken(certPem: string, keyPem: string): Promise<{ token: string; sign: string }> {
  const tra     = buildTRA()
  const cms     = signTRA(tra, certPem, keyPem)

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:log="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <log:loginCms>
      <log:in0>${cms}</log:in0>
    </log:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(WSAA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', 'SOAPAction': '""' },
    body: soapBody,
    signal: AbortSignal.timeout(15_000),
  })

  const xml = await res.text()

  const tokenMatch  = xml.match(/<token>([\s\S]*?)<\/token>/)
  const signMatch   = xml.match(/<sign>([\s\S]*?)<\/sign>/)
  const expiryMatch = xml.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)

  if (!tokenMatch || !signMatch) {
    // Log the WSAA error for debugging
    const faultMsg = xml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)?.[1]?.trim() ?? ''
    throw new Error(`WSAA error${faultMsg ? `: ${faultMsg}` : ''} — ${xml.substring(0, 300)}`)
  }

  const token  = tokenMatch[1].trim()
  const sign   = signMatch[1].trim()
  const expiry = expiryMatch
    ? new Date(expiryMatch[1].trim())
    : new Date(Date.now() + 11 * 3600_000)

  await saveCachedToken(token, sign, expiry)
  return { token, sign }
}

async function getToken(certPem: string, keyPem: string): Promise<{ token: string; sign: string }> {
  const cached = await readCachedToken()
  if (cached) return cached
  return fetchFreshToken(certPem, keyPem)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler: Handler = async (event) => {
  const origin = event.headers.origin ?? event.headers.Origin ?? ''
  const cors = {
    ...getCorsHeaders(origin),
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  const authHeader = event.headers.authorization ?? event.headers.Authorization ?? ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearerToken) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) }
  }
  const isValid = await verifySupabaseToken(bearerToken)
  if (!isValid) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  // ── Validar CUIT ──────────────────────────────────────────────────────────
  const cuit = event.path.split('/').pop()?.replace(/\D/g, '')
  if (!cuit || !/^\d{11}$/.test(cuit)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'CUIT inválido' }) }
  }

  // ── Credenciales AFIP ────────────────────────────────────────────────────
  const certPem  = (process.env.AFIP_CERT  ?? '').replace(/\\n/g, '\n')
  const keyPem   = (process.env.AFIP_KEY   ?? '').replace(/\\n/g, '\n')
  const afipCuit = process.env.AFIP_CUIT   ?? ''

  if (!certPem || !keyPem || !afipCuit) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({
        error: 'AFIP_NOT_CONFIGURED',
        message: 'Variables AFIP_CERT / AFIP_KEY / AFIP_CUIT no configuradas en el servidor',
      }),
    }
  }

  // ── Consultar Padrón ─────────────────────────────────────────────────────
  try {
    const { token: wsaaToken, sign } = await getToken(certPem, keyPem)

    const res = await fetch(`${PADRON_URL}/${cuit}`, {
      headers: {
        Authorization: `WSAA token="${wsaaToken}",sign="${sign}"`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    })

    const text = await res.text()

    if (!res.ok) {
      // If token rejected (401), clear cache and retry once with fresh token
      if (res.status === 401) {
        memCache = null
        const { token: t2, sign: s2 } = await fetchFreshToken(certPem, keyPem)
        const res2 = await fetch(`${PADRON_URL}/${cuit}`, {
          headers: { Authorization: `WSAA token="${t2}",sign="${s2}"`, Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res2.ok) {
          return { statusCode: res2.status >= 500 ? 502 : res2.status, headers: cors,
            body: JSON.stringify({ error: 'PADRON_ERROR', status: res2.status, message: (await res2.text()).substring(0, 200) }) }
        }
        return { statusCode: 200, headers: cors, body: await res2.text() }
      }
      return {
        statusCode: res.status >= 500 ? 502 : res.status,
        headers: cors,
        body: JSON.stringify({ error: 'PADRON_ERROR', status: res.status, message: text.substring(0, 200) }),
      }
    }

    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      return {
        statusCode: 502,
        headers: cors,
        body: JSON.stringify({ error: 'PADRON_PARSE_ERROR', message: text.substring(0, 200) }),
      }
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify(data) }

  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'WSAA_ERROR', message: msg }),
    }
  }
}
