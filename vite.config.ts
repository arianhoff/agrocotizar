import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'http'
import { createRequire } from 'module'
import fs from 'fs'
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const forge = _require('node-forge') as any

// ─── AFIP WSAA helpers (solo en dev) ─────────────────────────────────────────

const TOKEN_FILE = '.wsaa-token.json'

type WSAACache = { token: string; sign: string; expiry: string }

function loadCachedToken(): { token: string; sign: string; expiry: Date } | null {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, 'utf8')
    const c: WSAACache = JSON.parse(raw)
    const expiry = new Date(c.expiry)
    if (expiry > new Date(Date.now() + 5 * 60_000)) {
      return { token: c.token, sign: c.sign, expiry }
    }
  } catch { /* no file or expired */ }
  return null
}

function saveCachedToken(token: string, sign: string, expiry: Date) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, sign, expiry: expiry.toISOString() }))
}

let wsaaCache: { token: string; sign: string; expiry: Date } | null = loadCachedToken()

function buildTRA(service: string): string {
  const now  = new Date()
  const from = new Date(now.getTime() - 60_000)
  const to   = new Date(now.getTime() + 12 * 3600_000)
  // AFIP espera hora local Argentina (UTC-3) con offset explícito
  const fmt  = (d: Date) => {
    const ar = new Date(d.getTime() - 3 * 3600_000)
    return ar.toISOString().replace('Z', '-03:00')
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Math.floor(Date.now() / 1000)}</uniqueId>
    <generationTime>${fmt(from)}</generationTime>
    <expirationTime>${fmt(to)}</expirationTime>
  </header>
  <service>${service}</service>
</loginTicketRequest>`
}

function signTRA(tra: string, certPem: string, keyPem: string): string {
  const cert       = forge.pki.certificateFromPem(certPem)
  const privateKey = forge.pki.privateKeyFromPem(keyPem)
  const p7         = forge.pkcs7.createSignedData()
  p7.content       = forge.util.createBuffer(tra, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key: privateKey,
    certificate: cert,
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

async function getWSAAToken(certPem: string, keyPem: string): Promise<{ token: string; sign: string }> {
  if (wsaaCache && wsaaCache.expiry > new Date(Date.now() + 5 * 60_000)) {
    return { token: wsaaCache.token, sign: wsaaCache.sign }
  }
  const tra  = buildTRA('ws_sr_padron_a5')
  const cms  = signTRA(tra, certPem, keyPem)
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:log="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <log:loginCms><log:in0>${cms}</log:in0></log:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`

  const res = await globalThis.fetch('https://wsaahomo.afip.gov.ar/ws/services/LoginCms', {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '""' },
    body: soap,
  })
  const xml = await res.text()
  const token  = xml.match(/<token>([\s\S]*?)<\/token>/)?.[1]?.trim()
  const sign   = xml.match(/<sign>([\s\S]*?)<\/sign>/)?.[1]?.trim()
  const expiry = xml.match(/<expirationTime>([\s\S]*?)<\/expirationTime>/)?.[1]?.trim()
  // coe.alreadyAuthenticated = AFIP tiene un TA activo, usamos el que tengamos en disco
  if (xml.includes('alreadyAuthenticated')) {
    const disk = loadCachedToken()
    if (disk) {
      wsaaCache = disk
      return { token: disk.token, sign: disk.sign }
    }
    throw new Error('AFIP tiene un TA activo pero no tenemos el token guardado. Esperá 12hs o eliminá .wsaa-token.json')
  }
  if (!token || !sign) throw new Error(`WSAA falló: ${xml.substring(0, 400)}`)
  const expiryDate = expiry ? new Date(expiry) : new Date(Date.now() + 11 * 3600_000)
  wsaaCache = { token, sign, expiry: expiryDate }
  saveCachedToken(token, sign, expiryDate)
  return { token, sign }
}

// ─── Plugins ──────────────────────────────────────────────────────────────────

function bcraProxyPlugin(): Plugin {
  return {
    name: 'bcra-proxy',
    configureServer(server) {
      server.middlewares.use('/api/bcra', (req: Connect.IncomingMessage, res: ServerResponse) => {
        const targetPath = (req.url ?? '').replace(/^\/?/, '/')
        globalThis.fetch(`https://api.bcra.gob.ar${targetPath}`, {
          method: req.method ?? 'GET',
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'es-AR,es;q=0.9',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        })
          .then(async upstream => {
            const body = await upstream.text()
            res.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
              'Access-Control-Allow-Origin': '*',
            })
            res.end(body)
          })
          .catch((err: Error) => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: err.message }))
          })
      })
    },
  }
}

function afipProxyPlugin(certPem: string, keyPem: string): Plugin {
  return {
    name: 'afip-proxy',
    configureServer(server) {
      server.middlewares.use('/api/afip', (req: Connect.IncomingMessage, res: ServerResponse) => {
        const send = (data: unknown) => {
          if (res.writableEnded) return
          const body = JSON.stringify(data)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.statusCode = 200
          res.end(body)
        }

        const run = async () => {
          if (!certPem || !keyPem) {
            return send({ error: 'AFIP_NOT_CONFIGURED', message: 'AFIP_CERT / AFIP_KEY no configurados en .env' })
          }

          const cuit = (req.url ?? '').split('/').pop()?.split('?')[0] ?? ''
          if (!/^\d{11}$/.test(cuit)) {
            return send({ error: 'CUIT inválido', cuit })
          }

          const { token, sign } = await getWSAAToken(certPem, keyPem)
          const upstream = await globalThis.fetch(
            `https://awshomo.afip.gov.ar/sr-padron/v2/persona/${cuit}`,
            { headers: { Authorization: `WSAA token="${token}",sign="${sign}"`, Accept: 'application/json' } }
          )
          const text = await upstream.text()
          if (!upstream.ok) {
            return send({ error: 'PADRON_ERROR', status: upstream.status, message: text.substring(0, 400) })
          }
          try { send(JSON.parse(text)) }
          catch { send({ error: 'PADRON_PARSE_ERROR', message: text.substring(0, 400) }) }
        }

        run().catch(err => {
          const msg = (err as Error).message ?? String(err)
          console.error('[afip-proxy]', msg)
          send({ error: 'WSAA_ERROR', message: msg })
        })
      })
    },
  }
}

function anthropicProxyPlugin(apiKey: string): Plugin {
  return {
    name: 'anthropic-proxy',
    configureServer(server) {
      server.middlewares.use('/api/anthropic', (req: Connect.IncomingMessage, res: ServerResponse) => {
        if (!apiKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada en .env.local' }))
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString()
          let parsed: Record<string, unknown>
          try { parsed = JSON.parse(body) } catch { parsed = {} }
          const isStream = !!parsed.stream

          globalThis.fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body,
          })
            .then(async upstream => {
              const contentType = upstream.headers.get('content-type') ?? 'application/json'
              res.writeHead(upstream.status, {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                ...(isStream ? { 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' } : {}),
              })
              if (upstream.body) {
                const reader = upstream.body.getReader()
                const pump = async () => {
                  const { done, value } = await reader.read()
                  if (done) { res.end(); return }
                  res.write(value)
                  pump()
                }
                pump()
              } else {
                const text = await upstream.text()
                res.end(text)
              }
            })
            .catch((err: Error) => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: err.message }))
            })
        })
      })
    },
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const certPem = (env.AFIP_CERT ?? '').replace(/\\n/g, '\n')
  const keyPem  = (env.AFIP_KEY  ?? '').replace(/\\n/g, '\n')
  return {
    plugins: [
      react(),
      tailwindcss(),
      bcraProxyPlugin(),
      afipProxyPlugin(certPem, keyPem),
      anthropicProxyPlugin(env.ANTHROPIC_API_KEY ?? ''),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  }
})
