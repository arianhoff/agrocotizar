import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as forge from 'node-forge'
import { createClient } from '@supabase/supabase-js'
import { getCorsHeaders } from '../_cors'

const isProd = (process.env.AFIP_ENV ?? '').toLowerCase() === 'prod'

const WSAA_URL = isProd
  ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'

const PADRON_URL = isProd
  ? 'https://aws.afip.gov.ar/sr-padron/v2/persona'
  : 'https://awshomo.afip.gov.ar/sr-padron/v2/persona'

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

function signTRA(tra: string, certPem: string, keyPem: string): string {
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

async function fetchFreshToken(certPem: string, keyPem: string): Promise<{ token: string; sign: string }> {
  const cms = signTRA(buildTRA(), certPem, keyPem)
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:log="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <log:loginCms><log:in0>${cms}</log:in0></log:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await fetch(WSAA_URL, {
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

async function getToken(certPem: string, keyPem: string) {
  return (await readCachedToken()) ?? fetchFreshToken(certPem, keyPem)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers.origin as string) ?? ''
  const cors = { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }

  if (req.method === 'OPTIONS') return res.status(204).set(cors).end()

  const authHeader = (req.headers.authorization as string) ?? ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!bearerToken || !(await verifySupabaseToken(bearerToken))) {
    return res.status(401).set(cors).json({ error: 'Unauthorized' })
  }

  const url = req.url ?? ''
  const cuit = url.split('/').pop()?.split('?')[0]?.replace(/\D/g, '') ?? ''
  if (!/^\d{11}$/.test(cuit)) {
    return res.status(400).set(cors).json({ error: 'CUIT inválido', cuit })
  }

  const certPem  = (process.env.AFIP_CERT ?? '').replace(/\\n/g, '\n')
  const keyPem   = (process.env.AFIP_KEY  ?? '').replace(/\\n/g, '\n')
  const afipCuit = process.env.AFIP_CUIT  ?? ''

  if (!certPem || !keyPem || !afipCuit) {
    return res.status(503).set(cors).json({
      error: 'AFIP_NOT_CONFIGURED',
      message: 'Variables AFIP_CERT / AFIP_KEY / AFIP_CUIT no configuradas',
    })
  }

  try {
    const { token: wsaaToken, sign } = await getToken(certPem, keyPem)

    const padronRes = await fetch(`${PADRON_URL}/${cuit}`, {
      headers: { Authorization: `WSAA token="${wsaaToken}",sign="${sign}"`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    const text = await padronRes.text()

    if (!padronRes.ok) {
      if (padronRes.status === 401) {
        memCache = null
        const { token: t2, sign: s2 } = await fetchFreshToken(certPem, keyPem)
        const res2 = await fetch(`${PADRON_URL}/${cuit}`, {
          headers: { Authorization: `WSAA token="${t2}",sign="${s2}"`, Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        })
        const text2 = await res2.text()
        if (!res2.ok) return res.status(res2.status >= 500 ? 502 : res2.status).set(cors)
          .json({ error: 'PADRON_ERROR', status: res2.status, message: text2.substring(0, 200) })
        try { return res.status(200).set(cors).json(JSON.parse(text2)) } catch {
          return res.status(502).set(cors).json({ error: 'PADRON_PARSE_ERROR', message: text2.substring(0, 200) })
        }
      }
      return res.status(padronRes.status >= 500 ? 502 : padronRes.status).set(cors)
        .json({ error: 'PADRON_ERROR', status: padronRes.status, message: text.substring(0, 200) })
    }

    try {
      return res.status(200).set(cors).json(JSON.parse(text))
    } catch {
      return res.status(502).set(cors).json({ error: 'PADRON_PARSE_ERROR', message: text.substring(0, 200) })
    }
  } catch (err) {
    const msg = (err as Error).message ?? String(err)
    return res.status(500).set(cors).json({ error: 'WSAA_ERROR', message: msg })
  }
}
