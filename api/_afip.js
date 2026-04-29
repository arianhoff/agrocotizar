/**
 * Shared WSAA token management for AFIP/ARCA services.
 * Imported by api/padron.js and api/cron-afip-warmup.js
 */

import { createClient } from '@supabase/supabase-js'

const SERVICE = 'ws_sr_padron_a13'

let _forge = null
async function getForge() {
  if (!_forge) {
    const m = await import('node-forge')
    _forge = m.default ?? m
  }
  return _forge
}

export function getUrls() {
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

function getSupabase() {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// In-process cache (survives within the same Vercel instance, reset on cold start)
let memCache = null

async function readCachedToken() {
  // 60-second pre-expiry window: avoids triggering alreadyAuthenticated
  // while still giving enough buffer before the token actually expires
  const minExpiry = new Date(Date.now() + 60 * 1000)
  if (memCache && memCache.expiry > minExpiry) {
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
    if (expiry > minExpiry) {
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
    // AFIP says there's already a valid session — recover it from Supabase
    const sb = getSupabase()
    if (sb) {
      // First try immediately
      try {
        const { data } = await sb.from('afip_token_cache')
          .select('token, sign, expiry_at')
          .eq('service', SERVICE).single()
        if (data) {
          memCache = { token: data.token, sign: data.sign, expiry: new Date(data.expiry_at) }
          return { token: data.token, sign: data.sign }
        }
      } catch { /* no row */ }

      // Another concurrent instance may be saving — wait and retry once
      await new Promise(r => setTimeout(r, 2500))
      try {
        const { data } = await sb.from('afip_token_cache')
          .select('token, sign, expiry_at')
          .eq('service', SERVICE).single()
        if (data) {
          memCache = { token: data.token, sign: data.sign, expiry: new Date(data.expiry_at) }
          return { token: data.token, sign: data.sign }
        }
      } catch { /* still nothing */ }
    }
    throw new Error('WSAA_ALREADY_AUTH')
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

// Deduplicates concurrent calls within the same function instance
let _inflightTokenFetch = null

export async function getOrFetchToken(certPem, keyPem, wsaaUrl) {
  const cached = await readCachedToken()
  if (cached) return cached

  if (!_inflightTokenFetch) {
    _inflightTokenFetch = fetchFreshToken(certPem, keyPem, wsaaUrl)
      .finally(() => { _inflightTokenFetch = null })
  }
  return _inflightTokenFetch
}

export function normalizePem(raw) {
  const s = raw.replace(/\\n/g, '\n').trim()
  if (s.includes('\n')) return s
  const m = s.match(/-----BEGIN ([^-]+)-----([\s\S]*?)-----END ([^-]+)-----/)
  if (!m) return s
  const b64 = m[2].replace(/\s+/g, '')
  const lines = (b64.match(/.{1,64}/g) || []).join('\n')
  return `-----BEGIN ${m[1]}-----\n${lines}\n-----END ${m[3]}-----`
}

export function getAfipEnvVars() {
  return {
    certPem:  normalizePem(process.env.AFIP_CERT || ''),
    keyPem:   (process.env.AFIP_KEY || '').replace(/\\n/g, '\n'),
    afipCuit: process.env.AFIP_CUIT || '',
  }
}
