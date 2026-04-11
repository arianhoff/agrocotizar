/**
 * DIAGNÓSTICO - Ejecutar en la consola del browser (F12) mientras estás en /catalog
 *
 * Copia y pega todo este bloque en la consola del browser y presiona Enter.
 * El script imprime el estado completo de Supabase + localStorage.
 */
(async () => {
  const SUPABASE_URL  = 'https://yolbbkxxtsrhpfkowejd.supabase.co'
  const SUPABASE_ANON = 'sb_publishable_AuAbFJ7Dwyn5HCwXaqVA3A_qpbCUbww'

  const sep = (title) => console.log(`\n${'═'.repeat(50)}\n${title}\n${'═'.repeat(50)}`)

  // ── 1. Session token ───────────────────────────────────────────────────────
  let token = null
  const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
  if (sbKey) {
    try { token = JSON.parse(localStorage.getItem(sbKey)).access_token } catch {}
  }
  sep('SESSION')
  console.log(token ? `✅ token found (${token.substring(0,30)}…)` : '🚨 NO TOKEN — estás logueado?')
  if (!token) return

  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }
  const get = async (path) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers })
    return r.json()
  }

  // ── 2. localStorage state ──────────────────────────────────────────────────
  sep('LOCAL STATE (Zustand)')
  const raw = localStorage.getItem('agrocotizar-catalog')
  if (!raw) { console.log('🚨 No agrocotizar-catalog key'); }
  else {
    const state = JSON.parse(raw).state || {}
    const opts  = state.options || {}
    const prods = state.products || []
    const lists = state.priceLists || []
    console.log(`version:      ${JSON.parse(raw).version}`)
    console.log(`price_lists:  ${lists.length}`)
    console.log(`products:     ${prods.length}`)
    const optCount = Object.values(opts).reduce((a, v) => a + v.length, 0)
    console.log(`options:      ${optCount}`)
    console.table(prods.map(p => ({ id: p.id.substring(0,8), name: p.name.substring(0,25), pl: p.price_list_id.substring(0,8) })))
    const optDetails = Object.entries(opts).flatMap(([pid, arr]) =>
      arr.map(o => ({
        opt_id:     o.id.substring(0,8),
        name:       o.name,
        product_id: o.product_id.substring(0,8),
        key:        pid.substring(0,8),
        key_match:  o.product_id === pid ? '✅' : '🚨 MISMATCH'
      }))
    )
    if (optDetails.length) console.table(optDetails)
  }

  // ── 3. Supabase DB state ───────────────────────────────────────────────────
  sep('SUPABASE DB STATE')
  const [dbLists, dbProds, dbOpts] = await Promise.all([
    get('price_lists?select=id,brand,name&order=created_at.desc&limit=10'),
    get('products?select=id,price_list_id,code,name&order=created_at.desc&limit=30'),
    get('product_options?select=id,product_id,name,price&limit=100'),
  ])

  console.log(`price_lists:      ${Array.isArray(dbLists) ? dbLists.length : 'ERROR: ' + JSON.stringify(dbLists)}`)
  console.log(`products:         ${Array.isArray(dbProds) ? dbProds.length : 'ERROR: ' + JSON.stringify(dbProds)}`)
  console.log(`product_options:  ${Array.isArray(dbOpts)  ? dbOpts.length  : 'ERROR: ' + JSON.stringify(dbOpts)}`)

  if (Array.isArray(dbLists) && dbLists.length) console.table(dbLists.map(l => ({ id: l.id.substring(0,8), brand: l.brand, name: l.name })))
  if (Array.isArray(dbProds) && dbProds.length) console.table(dbProds.map(p => ({ id: p.id.substring(0,8), pl: p.price_list_id.substring(0,8), code: p.code, name: (p.name||'').substring(0,25) })))

  // ── 4. Orphaned options en DB ──────────────────────────────────────────────
  sep('ORPHANED OPTIONS CHECK (DB)')
  if (Array.isArray(dbProds) && Array.isArray(dbOpts)) {
    const prodIds = new Set(dbProds.map(p => p.id))
    const orphans = dbOpts.filter(o => !prodIds.has(o.product_id))
    if (orphans.length) {
      console.warn(`🚨 ${orphans.length} ORPHANED ROWS in product_options (product_id not in products):`)
      console.table(orphans.map(o => ({ opt_id: o.id.substring(0,8), product_id: o.product_id.substring(0,8), name: o.name })))
      console.log('\n⚡ FIX — ejecuta en Supabase SQL Editor:')
      console.log('DELETE FROM product_options WHERE product_id NOT IN (SELECT id FROM products);')
    } else {
      console.log('✅ No orphaned options in DB')
    }
  }

  // ── 5. Cross-reference local vs DB ────────────────────────────────────────
  sep('LOCAL vs SUPABASE CROSS-REFERENCE')
  if (raw && Array.isArray(dbProds)) {
    const state   = JSON.parse(raw).state || {}
    const localPs = state.products || []
    const dbProdIds = new Set(dbProds.map(p => p.id))

    console.log('--- Products ---')
    for (const p of localPs) {
      const inDB = dbProdIds.has(p.id)
      console.log(`${inDB ? '✅' : '🚨'} "${(p.name||'').substring(0,30)}" (${p.id.substring(0,8)}…) → ${inDB ? 'IN Supabase' : '🚨 NOT in Supabase — syncAll will insert it'}`)
    }

    console.log('\n--- Options ---')
    const opts = state.options || {}
    for (const [pid, optsArr] of Object.entries(opts)) {
      for (const o of optsArr) {
        const parentInDB = dbProdIds.has(o.product_id)
        if (!parentInDB) {
          console.warn(`🚨 Option "${o.name}" (${o.id.substring(0,8)}…) → product_id=${o.product_id.substring(0,8)}… NOT in Supabase → FK violation when syncAll runs!`)
        }
      }
    }
    const allOk = [...Object.entries(opts)].every(([, arr]) =>
      arr.every(o => dbProdIds.has(o.product_id))
    )
    if (allOk) console.log('✅ All local options have parent products in Supabase')
  }

  // ── 6. Bundle version check ────────────────────────────────────────────────
  sep('BUNDLE VERSION')
  const scripts = [...document.querySelectorAll('script[src]')].map(s => s.src.split('/').pop())
  console.log('Loaded scripts:', scripts)
  const indexChunk = scripts.find(s => s && s.startsWith('index-'))
  if (indexChunk) {
    const hash = indexChunk.replace('index-', '').replace('.js', '')
    if (hash === 'BbEg6Uqu') {
      console.warn('🚨 BUNDLE HASH = BbEg6Uqu → VIEJO (sin nuestros fixes). Hacé Ctrl+Shift+R y re-deployá.')
    } else {
      console.log(`✅ Bundle hash: ${hash} (no es el viejo BbEg6Uqu)`)
    }
  }

  console.log('\n══════ DONE ══════\n')
})()
