import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import { Card, CardTitle, FieldGroup, Label, Input, Select } from '@/components/ui'
import { PROVINCES } from '@/utils'
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Info } from 'lucide-react'

// ─── BNA Dollar rate ──────────────────────────────────────────────────────────

interface BNARate {
  venta: number
  compra: number
  fechaActualizacion: string
}

/** Returns the date string (YYYY-MM-DD) in Buenos Aires timezone */
function toBuenosAiresDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

/** true if the rate's date is before today in Buenos Aires */
function isStale(fechaActualizacion: string): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  return toBuenosAiresDate(fechaActualizacion) < today
}

async function fetchBNARate(): Promise<BNARate> {
  // Primary: dolarapi.com
  const [dolarRes, bluelyticsRes] = await Promise.allSettled([
    fetch('https://dolarapi.com/v1/dolares/oficial').then(r => r.ok ? r.json() : Promise.reject(r.status)),
    fetch('https://api.bluelytics.com.ar/v2/latest').then(r => r.ok ? r.json() : Promise.reject(r.status)),
  ])

  const dolar = dolarRes.status === 'fulfilled' ? {
    venta: dolarRes.value.venta as number,
    compra: dolarRes.value.compra as number,
    fechaActualizacion: dolarRes.value.fechaActualizacion as string,
  } : null

  const blue = bluelyticsRes.status === 'fulfilled' ? {
    venta: bluelyticsRes.value.oficial.value_sell as number,
    compra: bluelyticsRes.value.oficial.value_buy as number,
    fechaActualizacion: bluelyticsRes.value.last_update as string,
  } : null

  if (!dolar && !blue) throw new Error('No se pudo obtener la cotización BNA')

  // Prefer the source with the most recent date.
  // If dolar is stale but blue is fresh today, use blue.
  if (dolar && blue) {
    const dolarDate = toBuenosAiresDate(dolar.fechaActualizacion)
    const blueDate  = toBuenosAiresDate(blue.fechaActualizacion)
    return blueDate > dolarDate ? blue : dolar
  }

  return dolar ?? blue!
}

function useBNARate(onRate: (venta: number) => void) {
  const [loading, setLoading] = useState(false)
  const [lastRate, setLastRate] = useState<BNARate | null>(null)
  const [stale, setStale] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const rate = await fetchBNARate()
      setLastRate(rate)
      setStale(isStale(rate.fechaActualizacion))
      onRate(rate.venta)
    } finally {
      setLoading(false)
    }
  }, [onRate])

  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, lastRate, stale, refresh }
}

// ─── BCRA Central de Deudores ─────────────────────────────────────────────────

type SituacionCode = 1 | 2 | 3 | 4 | 5 | 6

interface DeudorEntidad {
  entidad: string
  situacion: SituacionCode
  monto: number
  diasAtrasoPago: number
  procesoJud?: boolean
  situacionJuridica?: boolean
}

interface DeudorPeriodo {
  periodo: string
  entidades: DeudorEntidad[]
}

interface DeudorResult {
  identificacion: number
  denominacion: string
  periodos: DeudorPeriodo[]
}

type BCRAState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: DeudorResult }
  | { status: 'sin_deudas'; denominacion: string }
  | { status: 'error'; message: string }

const SITUACION_LABEL: Record<SituacionCode, string> = {
  1: 'Normal (Situación 1)',
  2: 'Riesgo bajo (Sit. 2)',
  3: 'Riesgo medio (Sit. 3)',
  4: 'Riesgo alto (Sit. 4)',
  5: 'Irrecuperable (Sit. 5)',
  6: 'Irrecuperable disp. técnica (Sit. 6)',
}

function maxSituacion(periodos: DeudorPeriodo[]): SituacionCode {
  let max: SituacionCode = 1
  for (const p of periodos)
    for (const e of p.entidades)
      if (e.situacion > max) max = e.situacion as SituacionCode
  return max
}

const BCRA_WORKER = 'https://broken-snow-e6e3.arianhoffmann16.workers.dev'

async function bcraFetch(path: string): Promise<Response> {
  const cuit = path.split('/').pop() ?? ''
  const historicas = path.includes('Historicas')

  try {
    const direct = await fetch(`https://api.bcra.gob.ar${path}`, {
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(6000),
    })
    if (direct.ok || direct.status === 404) return direct
  } catch { /* fall through */ }

  const workerUrl = `${BCRA_WORKER}?cuit=${cuit}${historicas ? '&historicas=true' : ''}`
  const res = await fetch(workerUrl, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  // 520 = Cloudflare origin error (BCRA server failed) — retry once after brief pause
  if (!res || (res.status >= 500 && res.status !== 404)) {
    await new Promise(r => setTimeout(r, 1500))
    return fetch(workerUrl, { signal: AbortSignal.timeout(10000) })
  }
  return res
}

async function checkBCRA(cuit: string): Promise<BCRAState> {
  const clean = cuit.replace(/-/g, '')
  if (clean.length !== 11) return { status: 'error', message: 'CUIT inválido (debe tener 11 dígitos)' }

  try {
    const res = await bcraFetch(`/centraldedeudores/v1.0/Deudas/${clean}`)
    if (res.status === 404) {
      const resHist = await bcraFetch(`/centraldedeudores/v1.0/Deudas/Historicas/${clean}`).catch(() => null)
      let denominacion = ''
      if (resHist?.ok) {
        const histData = await resHist.json().catch(() => null)
        denominacion = histData?.results?.denominacion ?? ''
      }
      return { status: 'sin_deudas', denominacion }
    }
    if (!res.ok) {
      const msg = res.status >= 500
        ? 'El servicio BCRA no está disponible ahora. Podés continuar la cotización igual.'
        : `Error al consultar BCRA (${res.status})`
      return { status: 'error', message: msg }
    }
    const json = await res.json()
    return { status: 'ok', data: json.results as DeudorResult }
  } catch {
    return { status: 'error', message: 'No se pudo conectar con el BCRA' }
  }
}

// ─── AFIP/ARCA Padrón lookup ──────────────────────────────────────────────────

interface AFIPData {
  nombre: string
  domicilio?: string
  localidad?: string
  provincia?: string
  condicionIVA?: string
  estadoClave?: string
}

async function lookupAFIP(cuit: string): Promise<AFIPData | null> {
  const clean = cuit.replace(/-/g, '')
  try {
    const { authFetch } = await import('@/lib/api')
    const res = await authFetch(`/api/padron?cuit=${clean}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json.error) return null // AFIP_AUTH_REQUIRED or PROXY_ERROR

    const d = json.datosGenerales ?? json
    return {
      nombre: d.nombre ?? d.denominacion ?? '',
      domicilio: d.domicilioFiscal?.direccion ?? '',
      localidad: d.domicilioFiscal?.localidad ?? '',
      provincia: d.domicilioFiscal?.descripcionProvincia ?? '',
      condicionIVA: d.categoriasIVA?.[0]?.descripcion ?? '',
      estadoClave: d.estadoClave ?? '',
    }
  } catch {
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuoteHeader() {
  const { quote, setClient, setExchangeRate, setValidDays, setQuoteNumber } = useQuoteStore()
  const { client, exchange_rate, valid_days, quote_number } = quote

  const [bcraState, setBcraState] = useState<BCRAState>({ status: 'idle' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { loading: bnaLoading, lastRate, stale: bnaStale, refresh: refreshBNA } = useBNARate(setExchangeRate)

  // Auto-check CUIT when 11 digits entered (debounced)
  const handleCUITChange = (value: string) => {
    setClient({ cuit: value })
    setBcraState({ status: 'idle' })

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const digits = value.replace(/-/g, '')
    if (digits.length === 11) {
      setBcraState({ status: 'loading' })
      debounceRef.current = setTimeout(async () => {
        const result = await checkBCRA(value)
        setBcraState(result)

        // Auto-fill name if not already set
        const denominacion =
          result.status === 'ok' ? result.data.denominacion
          : result.status === 'sin_deudas' ? result.denominacion
          : ''

        if (denominacion && !client.name) {
          setClient({ name: denominacion })
        }

        // Try AFIP for full data
        const afipData = await lookupAFIP(value)
        if (afipData) {
          setClient({
            ...(afipData.nombre && !client.name ? { name: afipData.nombre } : {}),
            ...(afipData.domicilio ? { address: afipData.domicilio } : {}),
            ...(afipData.localidad ? { city: afipData.localidad } : {}),
            ...(afipData.provincia ? { province: normalizeProvincia(afipData.provincia) } : {}),
            ...(afipData.condicionIVA ? { iva_condition: afipData.condicionIVA } : {}),
          })
        }
      }, 600)
    }
  }

  // Map AFIP province names to our list
  function normalizeProvincia(prov: string): string {
    const map: Record<string, string> = {
      'BUENOS AIRES': 'Buenos Aires',
      'CAPITAL FEDERAL': 'CABA',
      'CABA': 'CABA',
      'CATAMARCA': 'Catamarca',
      'CHACO': 'Chaco',
      'CHUBUT': 'Chubut',
      'CORDOBA': 'Córdoba',
      'CORRIENTES': 'Corrientes',
      'ENTRE RIOS': 'Entre Ríos',
      'FORMOSA': 'Formosa',
      'JUJUY': 'Jujuy',
      'LA PAMPA': 'La Pampa',
      'LA RIOJA': 'La Rioja',
      'MENDOZA': 'Mendoza',
      'MISIONES': 'Misiones',
      'NEUQUEN': 'Neuquén',
      'RIO NEGRO': 'Río Negro',
      'SALTA': 'Salta',
      'SAN JUAN': 'San Juan',
      'SAN LUIS': 'San Luis',
      'SANTA CRUZ': 'Santa Cruz',
      'SANTA FE': 'Santa Fe',
      'SANTIAGO DEL ESTERO': 'Santiago del Estero',
      'TIERRA DEL FUEGO': 'Tierra del Fuego',
      'TUCUMAN': 'Tucumán',
    }
    return map[prov.toUpperCase()] ?? prov
  }

  // ── BCRA status badge ─────────────────────────────────────────────────────

  const situacion = bcraState.status === 'ok' ? maxSituacion(bcraState.data.periodos) : null

  function BCRABadge() {
    if (bcraState.status === 'idle') return null

    if (bcraState.status === 'loading') {
      return (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
          <Loader2 size={13} className="animate-spin text-[#94A3B8]" />
          <span className="text-[11px] text-[#64748B]">Verificando CUIT en BCRA...</span>
        </div>
      )
    }

    if (bcraState.status === 'error') {
      return (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#F59E0B]/30 bg-[#FFFBEB]">
          <Info size={13} className="text-[#F59E0B] shrink-0" />
          <span className="text-[11px] text-[#92400E] flex-1">{bcraState.message} Probá de nuevo en unos instantes.</span>
          <button
            onClick={() => { if (client.cuit) { setBcraState({ status: 'loading' }); checkBCRA(client.cuit).then(setBcraState) } }}
            className="text-[10px] font-semibold text-[#D97706] hover:text-[#92400E] underline cursor-pointer whitespace-nowrap"
          >
            Reintentar
          </button>
        </div>
      )
    }

    if (bcraState.status === 'sin_deudas') {
      return (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#22C55E]/30 bg-[#F0FDF4]">
          <CheckCircle2 size={13} className="text-[#22C55E] shrink-0" />
          <div>
            <span className="text-[11px] font-semibold text-[#16A34A]">Sin deudas en el sistema financiero</span>
            {bcraState.denominacion && (
              <span className="block text-[10px] text-[#22C55E]/70 font-mono">{bcraState.denominacion}</span>
            )}
          </div>
        </div>
      )
    }

    if (bcraState.status === 'ok' && situacion !== null) {
      const isNormal = situacion === 1
      const isLow = situacion === 2
      const isHigh = situacion >= 3

      return (
        <div className={`mt-2 rounded-lg border px-3 py-2.5 ${
          isNormal ? 'border-[#22C55E]/30 bg-[#F0FDF4]'
          : isLow   ? 'border-[#F59E0B]/30 bg-[#FFFBEB]'
          :           'border-[#EF4444]/30 bg-[#FEF2F2]'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {isNormal ? <CheckCircle2 size={13} className="text-[#22C55E] shrink-0" />
              : isLow ? <AlertTriangle size={13} className="text-[#F59E0B] shrink-0" />
              :         <XCircle size={13} className="text-[#EF4444] shrink-0" />}
            <span className={`text-[11px] font-semibold ${isNormal ? 'text-[#16A34A]' : isLow ? 'text-[#92400E]' : 'text-[#991B1B]'}`}>
              {SITUACION_LABEL[situacion]}
            </span>
          </div>
          {bcraState.data.denominacion && (
            <div className="font-mono text-[9px] opacity-60 mb-1.5 pl-5">{bcraState.data.denominacion}</div>
          )}
          {bcraState.data.periodos[0]?.entidades.map((e, i) => (
            <div key={i} className="font-mono text-[9px] pl-5 opacity-70 flex justify-between">
              <span className="truncate max-w-[60%]">{e.entidad}</span>
              <span>${(e.monto * 1000).toLocaleString('es-AR')} ARS</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

      {/* ── Cliente ── */}
      <Card>
        <CardTitle>Cliente</CardTitle>

        <FieldGroup>
          <Label>CUIT</Label>
          <div className="relative">
            <Input
              value={client.cuit ?? ''}
              onChange={e => handleCUITChange(e.target.value)}
              placeholder="20-12345678-9"
              maxLength={13}
            />
            {bcraState.status === 'loading' && (
              <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#94A3B8]" />
            )}
          </div>
          <BCRABadge />
        </FieldGroup>

        <FieldGroup>
          <Label>Razón Social / Nombre</Label>
          <Input
            value={client.name}
            onChange={e => setClient({ name: e.target.value })}
            placeholder="Se completa automáticamente al ingresar el CUIT"
          />
        </FieldGroup>

        <FieldGroup>
          <Label>Domicilio</Label>
          <Input
            value={client.address ?? ''}
            onChange={e => setClient({ address: e.target.value })}
            placeholder="Calle 123, Localidad"
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Provincia</Label>
            <Select
              value={client.province ?? ''}
              onChange={e => setClient({ province: e.target.value })}
            >
              <option value="">Seleccionar...</option>
              {PROVINCES.map(p => <option key={p}>{p}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Localidad</Label>
            <Input
              value={client.city ?? ''}
              onChange={e => setClient({ city: e.target.value })}
              placeholder="Ciudad"
            />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>Teléfono</Label>
            <Input
              value={client.phone ?? ''}
              onChange={e => setClient({ phone: e.target.value })}
              placeholder="3562-123456"
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Email</Label>
            <Input
              value={client.email ?? ''}
              onChange={e => setClient({ email: e.target.value })}
              placeholder="cliente@ejemplo.com"
            />
          </FieldGroup>
        </div>
      </Card>

      {/* ── Cotización ── */}
      <Card>
        <CardTitle>Cotización</CardTitle>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup>
            <Label>N° Cotización</Label>
            <Input
              value={quote_number}
              onChange={e => setQuoteNumber(e.target.value)}
              placeholder="COT-0001"
            />
          </FieldGroup>
          <FieldGroup>
            <Label>Validez</Label>
            <Select value={valid_days} onChange={e => setValidDays(Number(e.target.value))}>
              {[7, 15, 30, 45, 60].map(d => (
                <option key={d} value={d}>{d} días</option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        {/* BNA rate — always USD, shown as reference */}
        <FieldGroup>
          <Label>Dólar BNA vendedor (referencia)</Label>
          <div className="flex items-center gap-2">
            <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border ${bnaStale ? 'bg-[#FFFBEB] border-[#F59E0B]/40' : 'bg-[#F8FAFC] border-[#E2E8F0]'}`}>
              <span className="text-[12px] font-mono text-[#64748B]">$</span>
              <input
                type="number"
                value={exchange_rate}
                onChange={e => setExchangeRate(Number(e.target.value))}
                className="flex-1 bg-transparent text-[14px] font-bold text-[#0F172A] outline-none font-mono min-w-0"
                min={1}
              />
              {lastRate && (
                <span className={`text-[10px] shrink-0 font-mono ${bnaStale ? 'text-[#D97706]' : 'text-[#94A3B8]'}`}>
                  {new Date(lastRate.fechaActualizacion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button
              onClick={refreshBNA}
              disabled={bnaLoading}
              title="Actualizar desde Banco Nación"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-[#64748B] hover:border-[#22C55E]/50 hover:text-[#22C55E] transition-colors cursor-pointer disabled:opacity-50 shrink-0 text-[12px] font-medium bg-white"
            >
              <RefreshCw size={13} className={bnaLoading ? 'animate-spin' : ''} />
              BNA
            </button>
          </div>
          {bnaStale ? (
            <p className="text-[10px] text-[#D97706] mt-1 flex items-center gap-1">
              <AlertTriangle size={11} />
              Cotización del día anterior — BNA aún no publicó la de hoy. Podés editarla manualmente.
            </p>
          ) : (
            <p className="text-[10px] text-[#94A3B8] mt-1">
              La cotización se expresa en USD y en pesos al tipo de cambio BNA vendedor del día.
            </p>
          )}
        </FieldGroup>

        <FieldGroup>
          <Label>Empresa / Concesionario</Label>
          <Input placeholder="Nombre del concesionario" />
        </FieldGroup>
        <FieldGroup>
          <Label>Vendedor</Label>
          <Input placeholder="Nombre del vendedor" />
        </FieldGroup>
      </Card>
    </div>
  )
}
