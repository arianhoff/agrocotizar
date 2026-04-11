/**
 * DIAGNÓSTICO v2 — Ejecutar en la consola del browser (F12) mientras estás en /catalog
 *
 * Copia y pega todo este bloque en la consola del browser y presiona Enter.
 * Verifica: migración v5, opciones corruptas, estado en Supabase, y errores FK.
 */
;(async () => {
  // Obtené estos valores desde Supabase Dashboard → Settings → API
  const SUPABASE_URL  = 'https://yolbbkxxtsrhpfkowejd.supabase.co'
  const SUPABASE_ANON = window.__SUPABASE_ANON__ || prompt('Ingresá el anon key de Supabase:')

  const isUUID = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const sep = (title) => console.log(`\n${'═'.repeat(55)}\n  ${title}\n${'═'.repeat(55)}`)

  // ── 1. Session ─────────────────────────────────────────────────────────────
  sep('1. SESIÓN')
  let token = null
  const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (sbKey) {
    try { token = JSON.parse(localStorage.getItem(sbKey)).access_token } catch {}
  }
  if (token) {
    console.log(`✅ Token encontrado (${token.substring(0, 30)}…)`)
  } else {
    console.error('🚨 SIN TOKEN — ¿estás logueado?')
    return
  }

  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }
  const get = async (path) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
    return r.json()
  }

  // ── 2. Versión del store y migración v5 ────────────────────────────────────
  sep('2. VERSIÓN DEL STORE (migración v5)')
  const raw = localStorage.getItem('agrocotizar-catalog')
  if (!raw) {
    console.error('🚨 No existe la clave agrocotizar-catalog en localStorage')
    return
  }
  const parsed  = JSON.parse(raw)
  const version = parsed.version
  console.log(`Versión guardada: ${version}`)
  if (version >= 5) {
    console.log('✅ Migración v5 ejecutada — el store está actualizado')
  } else {
    console.warn(`🚨 Versión ${version} — la migración v5 AÚN NO CORRIÓ. Recargá la página (Ctrl+Shift+R) con el nuevo bundle deployado.`)
  }

  // ── 3. Estado de localStorage ──────────────────────────────────────────────
  sep('3. ESTADO LOCAL (Zustand)')
  const state = parsed.state || {}
  const opts  = state.options  || {}
  const prods = state.products || []
  const lists = state.priceLists || []
  const allOpts = Object.values(opts).flat()

  console.log(`price_lists : ${lists.length}`)
  console.log(`products    : ${prods.length}`)
  console.log(`options     : ${allOpts.length}`)

  // Detectar opciones con product_id no-UUID (las que causaban el FK)
  const corruptKeys  = Object.keys(opts).filter(k => !isUUID(k))
  const corruptOpts  = allOpts.filter(o => !isUUID(o.product_id))
  if (corruptKeys.length || corruptOpts.length) {
    console.error(`🚨 ${corruptKeys.length} claves no-UUID en el mapa de opciones`)
    console.error(`🚨 ${corruptOpts.length} opciones con product_id no-UUID → causarían FK violation`)
    if (corruptKeys.length) console.table(corruptKeys.map(k => ({ key: k })))
  } else {
    console.log('✅ Ninguna opción con product_id no-UUID — localStorage limpio')
  }

  // Mostrar productos y listas
  if (prods.length) console.table(prods.map(p => ({
    id: p.id.substring(0, 8),
    name: (p.name || '').substring(0, 30),
    pl: p.price_list_id.substring(0, 8),
    id_ok: isUUID(p.id) ? '✅' : '🚨',
  })))

  // ── 4. Estado en Supabase ──────────────────────────────────────────────────
  sep('4. SUPABASE — estado actual')
  const [dbLists, dbProds, dbOpts] = await Promise.all([
    get('price_lists?select=id,brand,name&order=created_at.desc&limit=20'),
    get('products?select=id,price_list_id,code,name&order=created_at.desc&limit=50'),
    get('product_options?select=id,product_id,name,price&limit=500'),
  ])

  const listsOk = Array.isArray(dbLists)
  const prodsOk = Array.isArray(dbProds)
  const optsOk  = Array.isArray(dbOpts)

  console.log(`price_lists     : ${listsOk ? dbLists.length : 'ERROR: ' + JSON.stringify(dbLists)}`)
  console.log(`products        : ${prodsOk ? dbProds.length : 'ERROR: ' + JSON.stringify(dbProds)}`)
  console.log(`product_options : ${optsOk  ? dbOpts.length  : 'ERROR: ' + JSON.stringify(dbOpts)}`)

  if (listsOk && dbLists.length) console.table(dbLists.map(l => ({ id: l.id.substring(0,8), brand: l.brand, name: l.name })))
  if (prodsOk && dbProds.length) console.table(dbProds.map(p => ({ id: p.id.substring(0,8), pl: p.price_list_id.substring(0,8), code: p.code, name: (p.name||'').substring(0,25) })))

  // ── 5. Orphaned options en Supabase ────────────────────────────────────────
  sep('5. OPCIONES HUÉRFANAS EN SUPABASE (FK check)')
  if (prodsOk && optsOk) {
    const dbProdIds = new Set(dbProds.map(p => p.id))
    const orphans   = dbOpts.filter(o => !dbProdIds.has(o.product_id))
    if (orphans.length) {
      console.error(`🚨 ${orphans.length} OPCIONES HUÉRFANAS en product_options (product_id sin producto):`)
      console.table(orphans.map(o => ({ opt_id: o.id.substring(0,8), product_id: o.product_id.substring(0,8), name: o.name })))
      console.log('\n⚡ Para limpiarlas, ejecutá en Supabase → SQL Editor:')
      console.log('DELETE FROM product_options WHERE product_id NOT IN (SELECT id FROM products);')
    } else {
      console.log('✅ Sin opciones huérfanas en Supabase')
    }
  }

  // ── 6. Cross-reference local vs Supabase ───────────────────────────────────
  sep('6. LOCAL vs SUPABASE (cross-reference)')
  if (prodsOk) {
    const dbProdIds = new Set(dbProds.map(p => p.id))
    let allGood = true

    for (const p of prods) {
      const inDB = dbProdIds.has(p.id)
      if (!inDB) {
        console.warn(`🚨 Producto "${(p.name||'').substring(0,30)}" (${p.id.substring(0,8)}…) NO está en Supabase → syncAll lo insertará`)
        allGood = false
      }
    }
    for (const [pid, optsArr] of Object.entries(opts)) {
      for (const o of optsArr) {
        if (!dbProdIds.has(o.product_id)) {
          console.warn(`🚨 Opción "${o.name}" → product_id=${o.product_id.substring(0,8)}… NOT in Supabase → FK violation en syncAll`)
          allGood = false
        }
      }
    }
    if (allGood) console.log('✅ Todo sincronizado — local y Supabase coinciden')
  }

  // ── 7. Simular syncAll (capturar errores de red) ───────────────────────────
  sep('7. SIMULACIÓN syncAll — interceptar errores FK')
  const networkErrors = []
  const origFetch = window.fetch
  window.fetch = async (...args) => {
    const res = await origFetch(...args)
    const url = typeof args[0] === 'string' ? args[0] : args[0].url || ''
    if (url.includes('supabase') && url.includes('product_options') && res.status >= 400) {
      const clone = res.clone()
      const body  = await clone.text().catch(() => '?')
      networkErrors.push({ status: res.status, url: url.split('/rest/v1/')[1] || url, body })
    }
    return res
  }

  // Buscar y hacer click en Sincronizar
  const syncBtn = [...document.querySelectorAll('button')].find(b =>
    b.textContent?.includes('Sincronizar') || b.title?.toLowerCase().includes('sincronizar')
  )
  if (syncBtn) {
    console.log('▶ Haciendo click en Sincronizar…')
    syncBtn.click()
  } else {
    console.warn('ℹ️  Botón "Sincronizar" no encontrado — esperando sync automático 10s…')
  }

  await new Promise(r => setTimeout(r, 10_000))
  window.fetch = origFetch  // restaurar

  if (networkErrors.length) {
    console.error(`\n🚨 ${networkErrors.length} ERROR(ES) de red en product_options:`)
    console.table(networkErrors.map(e => ({ status: e.status, url: e.url.substring(0,60), body: e.body.substring(0,120) })))
  } else {
    console.log('✅ Sin errores de red en product_options durante syncAll')
  }

  // ── 8. Bundle version ──────────────────────────────────────────────────────
  sep('8. BUNDLE VERSION')
  const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop())
  console.log('Scripts cargados:', scripts)
  const indexChunk = scripts.find(s => s && s.startsWith('index-'))
  if (indexChunk) {
    const hash = indexChunk.replace('index-', '').replace('.js', '')
    if (hash === 'BbEg6Uqu') {
      console.error('🚨 Bundle hash = BbEg6Uqu → BUILD VIEJO sin nuestros fixes. Hacé Ctrl+Shift+R y re-deployá.')
    } else {
      console.log(`✅ Bundle hash: ${hash}`)
    }
  }

  console.log('\n══════ DIAGNÓSTICO COMPLETO ══════\n')
})()
