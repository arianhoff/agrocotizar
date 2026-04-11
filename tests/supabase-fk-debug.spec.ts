/**
 * Playwright diagnostic — FK violation en product_options
 *
 * Cómo usar:
 *   1.  Asegúrate de que la app esté corriendo: npm run dev
 *   2.  npx playwright test tests/supabase-fk-debug.spec.ts --headed --timeout=120000 --reporter=line
 *   3.  Si la app pide login, iniciá sesión en el browser que abrió.
 *       El test espera 60 s a que llegues a /catalog.
 */

import { test } from '@playwright/test'

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://yolbbkxxtsrhpfkowejd.supabase.co'
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || ''
const APP_URL       = 'http://localhost:5173'

test.setTimeout(120_000)

// ── helpers inline ──────────────────────────────────────────────────────────

async function sbFetch(token: string, path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
    },
  })
  return res.json()
}

// ── test ────────────────────────────────────────────────────────────────────

test('diagnose FK violations via app context', async ({ page }) => {

  // ── 1. Abrir la app ─────────────────────────────────────────────────────
  await page.goto(`${APP_URL}/catalog`)
  await page.waitForTimeout(1500)

  // Password gate
  const pwInput = page.locator('input[type="password"]').first()
  if (await pwInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pwInput.fill('agrocotizar2026')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)
  }

  // Esperar login manual si redirige a /login
  if (page.url().includes('login') || page.url().includes('auth')) {
    console.log('\n⚠️  Iniciá sesión manualmente. El test espera hasta 60s...')
    await page.waitForURL(u => u.includes('/catalog'), { timeout: 60_000 })
  }

  await page.waitForTimeout(3000)

  // ── 2. Obtener estado de localStorage (sin serialization issues) ─────────
  console.log('\n══════ LOCAL STATE (localStorage) ══════')
  const localState = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('agrocotizar-catalog')
      if (!raw) return { error: 'No catalog key in localStorage' }
      const state = JSON.parse(raw).state || {}
      const opts  = state.options || {}
      const prods = state.products || []
      const lists = state.priceLists || []

      const optDetails: any[] = []
      for (const [pid, optsArr] of Object.entries(opts)) {
        for (const o of (optsArr as any[])) {
          optDetails.push({
            optId:      o.id,
            name:       o.name,
            product_id: o.product_id,
            mapKey:     pid,
            keyMatch:   o.product_id === pid,
          })
        }
      }

      return {
        version:        JSON.parse(raw).version,
        priceListCount: lists.length,
        productCount:   prods.length,
        optionCount:    optDetails.length,
        priceLists:     lists.map((pl: any) => ({ id: pl.id, brand: pl.brand, name: pl.name })),
        products:       prods.map((p: any) => ({ id: p.id, code: p.code, name: (p.name || '').substring(0, 30), pl: p.price_list_id })),
        optionDetails,
      }
    } catch (e: any) {
      return { error: String(e) }
    }
  })
  console.log(JSON.stringify(localState, null, 2))

  // ── 3. Obtener token de sesión de Supabase desde localStorage ────────────
  const authToken = await page.evaluate(() => {
    // Supabase guarda el token con key que empieza en sb- y termina en -auth-token
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!keys.length) return null
    try {
      const session = JSON.parse(localStorage.getItem(keys[0]) || '{}')
      return session.access_token || null
    } catch { return null }
  })

  if (!authToken) {
    console.log('\n⚠️  No Supabase session token found. No se puede consultar la DB.')
    console.log('   Asegurate de estar logueado en la app.\n')
  } else {
    console.log(`\n✅ Session token found (${authToken.substring(0, 20)}…)`)

    // ── 4. Estado real en Supabase ──────────────────────────────────────────
    console.log('\n══════ SUPABASE DB STATE ══════')
    const [priceLists, products, productOptions] = await Promise.all([
      sbFetch(authToken, 'price_lists?select=id,brand,name,user_id&order=created_at.desc&limit=10'),
      sbFetch(authToken, 'products?select=id,price_list_id,code,name&order=created_at.desc&limit=30'),
      sbFetch(authToken, 'product_options?select=id,product_id,name,price&limit=100'),
    ])

    const dbProds = Array.isArray(products)      ? products       : []
    const dbOpts  = Array.isArray(productOptions) ? productOptions : []
    const dbLists = Array.isArray(priceLists)     ? priceLists     : []

    console.log(`price_lists: ${dbLists.length}`)
    console.log(`products:    ${dbProds.length}`)
    console.log(`product_options: ${dbOpts.length}`)
    if (dbLists.length > 0) console.log('Lists:', JSON.stringify(dbLists, null, 2))
    if (dbProds.length > 0) console.log('Products (first 10):', JSON.stringify(dbProds.slice(0, 10), null, 2))

    // ── 5. Orphaned options en la DB ────────────────────────────────────────
    console.log('\n══════ ORPHANED OPTIONS CHECK (DB) ══════')
    const dbProdIds = new Set(dbProds.map((p: any) => p.id))
    const orphanedInDB = dbOpts.filter((o: any) => !dbProdIds.has(o.product_id))
    if (orphanedInDB.length > 0) {
      console.log(`🚨 ${orphanedInDB.length} ORPHANED ROWS IN product_options (FK references missing products):`)
      for (const o of orphanedInDB) {
        console.log(`   opt.id=${o.id} → product_id=${o.product_id} name="${o.name}"`)
      }
      console.log('\n⚡ Ejecutá en Supabase → SQL Editor:')
      console.log('   DELETE FROM product_options WHERE product_id NOT IN (SELECT id FROM products);')
    } else {
      console.log('✅ No orphaned options in Supabase DB')
    }

    // ── 6. Cross-reference: local vs DB ────────────────────────────────────
    console.log('\n══════ LOCAL vs SUPABASE ══════')
    if (!('error' in localState)) {
      const ls = localState as any
      for (const p of (ls.products as any[])) {
        const inDB = dbProdIds.has(p.id)
        const icon = inDB ? '✅' : '🚨'
        console.log(`${icon} Product "${p.name}" (${p.id.substring(0,8)}…) — ${inDB ? 'IN DB' : 'NOT IN DB'}`)
      }
      console.log('')
      for (const opt of (ls.optionDetails as any[])) {
        const parentInDB = dbProdIds.has(opt.product_id)
        const icon = parentInDB ? '✅' : '🚨'
        if (!parentInDB) {
          console.log(`${icon} Option "${opt.name}" (${opt.optId.substring(0,8)}…) → parent product_id=${opt.product_id.substring(0,8)}… NOT IN DB → would cause FK violation on sync!`)
        }
      }
    }
  }

  // ── 7. Capturar lo que pasa al hacer Sincronizar ─────────────────────────
  console.log('\n══════ CLICK SINCRONIZAR + WATCH 15s ══════')
  const errors: string[] = []
  const networkLog: string[] = []

  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('[catalog]') || text.includes('foreign key') || msg.type() === 'error') {
      errors.push(`[${msg.type()}] ${text}`)
    }
  })
  page.on('request', req => {
    const u = req.url()
    if (u.includes('supabase') && (u.includes('products') || u.includes('product_options'))) {
      const short = u.replace(SUPABASE_URL + '/rest/v1/', '')
      networkLog.push(`→ ${req.method()} /${short.substring(0, 100)}`)
      const body = req.postData()
      if (body) networkLog.push(`   body: ${body.substring(0, 150)}`)
    }
  })
  page.on('response', async res => {
    const u = res.url()
    if (u.includes('supabase') && (u.includes('products') || u.includes('product_options'))) {
      const status = res.status()
      const short  = u.replace(SUPABASE_URL + '/rest/v1/', '')
      networkLog.push(`← ${status} /${short.substring(0, 100)}`)
      if (status >= 400) {
        try {
          const body = await res.text()
          networkLog.push(`   ERROR: ${body.substring(0, 200)}`)
        } catch { /* ignore */ }
      }
    }
  })

  // Intentar hacer click en Sincronizar
  const syncBtn = page.locator('button[title*="incronizar"], button:text("Sincronizar")').first()
  if (await syncBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await syncBtn.click()
    console.log('✅ Clicked Sincronizar')
  } else {
    // Disparar syncAll directamente
    await page.evaluate(() => {
      // Buscar el store de Zustand expuesto internamente
      // y llamar syncAll si está disponible
      const el = document.querySelector('[data-testid="sync-btn"]')
      if (el) (el as HTMLElement).click()
    })
    console.log('ℹ️  Button not found — waiting for auto-sync...')
  }

  await page.waitForTimeout(15_000)

  console.log('\n── Network log ──')
  for (const l of networkLog) console.log(l)
  console.log('\n── Console errors ──')
  for (const e of errors) console.log(e)

  // ── 8. Verificar la versión del bundle (detectar si es código viejo) ──────
  console.log('\n══════ BUNDLE VERSION CHECK ══════')
  const bundleInfo = await page.evaluate(() => {
    // Buscar scripts cargados
    const scripts = Array.from(document.querySelectorAll('script[src]'))
      .map((s: any) => s.src)
      .filter(s => s.includes('index-') || s.includes('catalog') || s.includes('App'))
    return { scripts }
  })
  console.log('Loaded chunks:', bundleInfo.scripts)
  console.log('(Si ves index-BbEg6Uqu.js = build viejo sin nuestros fixes)')
  console.log('(El fix correcto tiene syncOption SOLO en syncAll, no en addOption)')

  // ── Siempre pasa — es sólo diagnóstico ───────────────────────────────────
  console.log('\n══════ DONE ══════')
})
