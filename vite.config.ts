import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin, Connect } from 'vite'
import type { ServerResponse } from 'http'

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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), bcraProxyPlugin(), anthropicProxyPlugin(env.ANTHROPIC_API_KEY ?? '')],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  }
})
