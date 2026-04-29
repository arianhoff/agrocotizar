import { useState, useRef, useEffect } from 'react'
import { validateCuit } from '@/utils'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card } from '@/components/ui'
import {
  Search, CheckCircle2, AlertTriangle, XCircle, Loader2,
  Building2, MapPin, AlertCircle, User, Briefcase, ShieldCheck, ShieldAlert, ShieldX,
  CircleCheck, CircleX, CircleMinus, Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SituacionCode = 1 | 2 | 3 | 4 | 5 | 6

interface DeudorEntidad {
  entidad: string
  situacion: SituacionCode
  monto: number
  diasAtrasoPago: number
  refinanciaciones?: boolean
  recategorizacionOblig?: boolean
  procesoJud?: boolean
  situacionJuridica?: boolean
  irrecDisposicionTecnica?: boolean
  enRevision?: boolean
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

interface CUITResult {
  cuit: string
  denominacion: string
  tipoClave?: string        // CUIT / CUIL / CDI
  tipoPersona?: string      // FISICA / JURIDICA
  domicilio?: string
  localidad?: string
  provincia?: string
  condicionIVA?: string
  actividadPrincipal?: string
  estadoClave?: string
  bcra: 'ok' | 'sin_deudas' | 'error'
  bcraData?: DeudorResult
  bcraError?: string
  maxSituacion?: SituacionCode
  afipError?: string        // error message from ARCA proxy
}

const SITUACION_LABEL: Record<SituacionCode, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  1: { label: 'Situación 1 — Normal',                    color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#22C55E]/30', icon: CheckCircle2 },
  2: { label: 'Situación 2 — Riesgo bajo',               color: 'text-[#92400E]', bg: 'bg-[#FFFBEB]', border: 'border-[#F59E0B]/30', icon: AlertTriangle },
  3: { label: 'Situación 3 — Riesgo medio',              color: 'text-[#9A3412]', bg: 'bg-[#FFF7ED]', border: 'border-[#F97316]/30', icon: AlertTriangle },
  4: { label: 'Situación 4 — Riesgo alto',               color: 'text-[#991B1B]', bg: 'bg-[#FEF2F2]', border: 'border-[#EF4444]/30', icon: XCircle },
  5: { label: 'Situación 5 — Irrecuperable',             color: 'text-[#7F1D1D]', bg: 'bg-[#FEF2F2]', border: 'border-[#EF4444]/50', icon: XCircle },
  6: { label: 'Situación 6 — Irrecuperable (disp. téc)', color: 'text-[#7F1D1D]', bg: 'bg-[#FEF2F2]', border: 'border-[#EF4444]/50', icon: XCircle },
}

function maxSit(periodos: DeudorPeriodo[]): SituacionCode {
  let max: SituacionCode = 1
  for (const p of periodos)
    for (const e of p.entidades)
      if (e.situacion > max) max = e.situacion as SituacionCode
  return max
}

// ─── API calls ────────────────────────────────────────────────────────────────

const BCRA_WORKER = 'https://broken-snow-e6e3.arianhoffmann16.workers.dev'

async function bcraFetch(path: string, attempt = 0): Promise<Response> {
  const cuit = path.split('/').pop() ?? ''
  const historicas = path.includes('Historicas')
  const MAX_ATTEMPTS = 3
  const RETRY_DELAY = 1200 // ms

  // Try direct browser fetch with no Referer (BCRA blocks requests with Referer from unknown domains)
  try {
    const direct = await fetch(`https://api.bcra.gob.ar${path}`, {
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(6000),
    })
    if (direct.ok || direct.status === 404) return direct
    // 5xx from BCRA — retry if attempts remain
    if (direct.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY))
      return bcraFetch(path, attempt + 1)
    }
  } catch { /* fall through to Worker */ }

  // Fallback: Cloudflare Worker proxy (also with retry)
  try {
    const workerUrl = `${BCRA_WORKER}?cuit=${cuit}${historicas ? '&historicas=true' : ''}`
    const worker = await fetch(workerUrl, { signal: AbortSignal.timeout(8000) })
    if (worker.ok || worker.status === 404) return worker
    if (worker.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY))
      return bcraFetch(path, attempt + 1)
    }
    return worker
  } catch (e) {
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise(r => setTimeout(r, RETRY_DELAY))
      return bcraFetch(path, attempt + 1)
    }
    throw e
  }
}

async function fetchBCRA(cuit: string): Promise<
  | { status: 'ok'; data: DeudorResult }
  | { status: 'sin_deudas'; denominacion: string }
  | { status: 'error'; message: string }
> {
  const clean = cuit.replace(/-/g, '')
  try {
    const res = await bcraFetch(`/centraldedeudores/v1.0/Deudas/${clean}`)
    if (res.status === 404) {
      const resHist = await bcraFetch(`/centraldedeudores/v1.0/Deudas/Historicas/${clean}`).catch(() => null)
      let denominacion = ''
      if (resHist?.ok) {
        const d = await resHist.json().catch(() => null)
        denominacion = d?.results?.denominacion ?? ''
      }
      return { status: 'sin_deudas', denominacion }
    }
    if (!res.ok) return {
      status: 'error',
      message: res.status >= 500
        ? 'El servicio BCRA no está disponible ahora. Podés continuar sin este dato.'
        : `BCRA respondió ${res.status}`,
    }
    const json = await res.json()
    return { status: 'ok', data: json.results as DeudorResult }
  } catch {
    return { status: 'error', message: 'No se pudo conectar con el BCRA' }
  }
}

type AFIPResult =
  | { ok: true; nombre?: string; tipoPersona?: string; tipoClave?: string; domicilio?: string; localidad?: string; provincia?: string; condicionIVA?: string; actividadPrincipal?: string; estadoClave?: string }
  | { ok: false; errorCode: string; errorMessage: string }

async function warmupAfip() {
  try {
    const { authFetch } = await import('@/lib/api')
    await authFetch('/api/padron?warm=true')
  } catch { /* non-critical */ }
}

async function fetchAFIP(cuit: string): Promise<AFIPResult> {
  const clean = cuit.replace(/-/g, '')
  try {
    const { authFetch } = await import('@/lib/api')
    const res = await authFetch(`/api/padron?cuit=${clean}`, { headers: { Accept: 'application/json' } })
    const json = await res.json()
    if (json.error) {
      console.warn('[AFIP proxy]', json.error, json.message, json.detail ?? '')
      return { ok: false, errorCode: json.error, errorMessage: json.message ?? json.error }
    }
    if (!res.ok) {
      return { ok: false, errorCode: 'HTTP_ERROR', errorMessage: `HTTP ${res.status}` }
    }
    const d = json.datosGenerales ?? json
    // Actividad principal
    const actividades: { descripcionActividad?: string; orden?: number }[] = d.actividades ?? []
    const actPrincipal = actividades.find(a => a.orden === 1)?.descripcionActividad
      ?? actividades[0]?.descripcionActividad
    return {
      ok: true,
      nombre:            d.nombre ?? d.denominacion ?? '',
      tipoPersona:       d.tipoPersona ?? '',
      tipoClave:         d.tipoClave ?? '',
      domicilio:         d.domicilioFiscal?.direccion ?? '',
      localidad:         d.domicilioFiscal?.localidad ?? '',
      provincia:         d.domicilioFiscal?.descripcionProvincia ?? '',
      condicionIVA:      d.categoriasIVA?.[0]?.descripcion ?? '',
      actividadPrincipal: actPrincipal ?? '',
      estadoClave:       d.estadoClave ?? '',
    }
  } catch (e) {
    return { ok: false, errorCode: 'FETCH_ERROR', errorMessage: (e as Error).message ?? 'Error de conexión' }
  }
}

// ─── Resumen para cotización ──────────────────────────────────────────────────

function CotizacionSummary({ result }: { result: CUITResult }) {
  const sit = result.maxSituacion ?? 1
  const estadoOk = !result.estadoClave || result.estadoClave === 'ACTIVO'
  const bcraOk   = result.bcra === 'sin_deudas' || sit === 1
  const bcraRisk = result.bcra === 'ok' && sit >= 2 && sit <= 3
  const bcraHigh = result.bcra === 'ok' && sit >= 4

  if (bcraHigh || !estadoOk) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#FEF2F2] border border-[#EF4444]/30">
        <ShieldX size={18} className="text-[#EF4444] shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-[#991B1B]">Precaución antes de cotizar</div>
          <div className="text-[12px] text-[#B91C1C] mt-0.5">
            {!estadoOk
              ? `Estado ARCA ${result.estadoClave} — verificar habilitación fiscal antes de operar.`
              : `Registra deudas en situación ${sit} en el sistema financiero. Evaluar condiciones de pago con garantía.`
            }
          </div>
        </div>
      </div>
    )
  }

  if (bcraRisk) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/30">
        <ShieldAlert size={18} className="text-[#F59E0B] shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-[#92400E]">Riesgo moderado</div>
          <div className="text-[12px] text-[#92400E] mt-0.5">
            Registra antecedentes en el sistema financiero (sit. {sit}). Se recomienda solicitar garantía o pago anticipado.
          </div>
        </div>
      </div>
    )
  }

  if (bcraOk && estadoOk) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-[#F0FDF4] border border-[#22C55E]/30">
        <ShieldCheck size={18} className="text-[#22C55E] shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-[#16A34A]">Apto para cotizar</div>
          <div className="text-[12px] text-[#166534] mt-0.5">
            Sin antecedentes en el sistema financiero y estado fiscal activo.
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CUITPage() {
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<CUITResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pre-heat the WSAA token so the first real query is fast
  useEffect(() => { warmupAfip() }, [])

  const clean11 = input.replace(/-/g, '')
  const isValid = clean11.length === 11 && validateCuit(clean11)

  async function handleSearch() {
    const clean = input.replace(/-/g, '')
    if (clean.length !== 11) { setError('El CUIT debe tener 11 dígitos.'); return }
    if (!validateCuit(clean)) { setError('CUIT inválido (dígito verificador incorrecto).'); return }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const [bcraRes, afipRes] = await Promise.all([fetchBCRA(input), fetchAFIP(input)])

      const afipOk = afipRes.ok ? afipRes : null
      const afipErr = !afipRes.ok ? afipRes : null

      const denominacion =
        bcraRes.status === 'ok' ? bcraRes.data.denominacion
        : bcraRes.status === 'sin_deudas' ? bcraRes.denominacion
        : afipOk?.nombre ?? ''

      const r: CUITResult = {
        cuit:              input,
        denominacion:      afipOk?.nombre || denominacion,
        tipoPersona:       afipOk?.tipoPersona,
        tipoClave:         afipOk?.tipoClave,
        domicilio:         afipOk?.domicilio,
        localidad:         afipOk?.localidad,
        provincia:         afipOk?.provincia,
        condicionIVA:      afipOk?.condicionIVA,
        actividadPrincipal: afipOk?.actividadPrincipal,
        estadoClave:       afipOk?.estadoClave,
        bcra:              bcraRes.status,
        bcraData:          bcraRes.status === 'ok' ? bcraRes.data : undefined,
        bcraError:         bcraRes.status === 'error' ? bcraRes.message : undefined,
        maxSituacion:      bcraRes.status === 'ok' ? maxSit(bcraRes.data.periodos)
                           : bcraRes.status === 'sin_deudas' ? 1 : undefined,
        afipError:         afipErr ? `${afipErr.errorCode}: ${afipErr.errorMessage}` : undefined,
      }

      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader title="Verificar CUIT" subtitle="Consultá datos fiscales y estado crediticio de cualquier CUIT" />

      <div className="p-4 sm:p-6 md:p-8 max-w-2xl">

        {/* Search */}
        <Card className="mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => { setInput(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter' && isValid) handleSearch() }}
                placeholder="20-12345678-9"
                maxLength={13}
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#E2E8F0] text-[15px] font-mono text-[#0F172A] outline-none focus:border-[#22C55E] focus:bg-[#F0FDF4]/50 transition-all bg-white"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!isValid || loading}
              className="flex items-center gap-2 px-5 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {loading ? 'Consultando...' : 'Consultar'}
            </button>
          </div>
          {error && <p className="text-[12px] text-[#EF4444] mt-2 ml-1">{error}</p>}
          <p className="text-[11px] text-[#94A3B8] mt-2">
            Ingresá el CUIT con o sin guiones. Se consulta ARCA (ex-AFIP) y BCRA Central de Deudores en tiempo real.
          </p>
        </Card>

        {/* Loading */}
        {loading && (
          <Card>
            <div className="flex items-center gap-3 py-2">
              <Loader2 size={20} className="animate-spin text-[#22C55E]" />
              <div>
                <div className="text-[14px] font-medium text-[#0F172A]">Consultando...</div>
                <div className="text-[12px] text-[#64748B]">ARCA (ex-AFIP) y BCRA Central de Deudores</div>
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">

            {/* Resumen aptitud */}
            <CotizacionSummary result={result} />

            {/* Identidad */}
            <Card className="space-y-0 p-0 overflow-hidden">
              {/* Header con nombre */}
              <div className="flex items-center gap-3 px-5 py-4 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                <div className="w-10 h-10 rounded-xl bg-[#1E2235] flex items-center justify-center shrink-0">
                  {result.tipoPersona === 'FISICA'
                    ? <User size={18} className="text-white/70" />
                    : <Building2 size={18} className="text-white/70" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-[#0F172A] leading-tight">
                    {result.denominacion || <span className="text-[#94A3B8] font-normal text-[14px]">Sin datos de nombre</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-[12px] text-[#64748B]">{result.cuit}</span>
                    {result.tipoPersona && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B]">
                        {result.tipoPersona === 'FISICA' ? 'Persona física' : 'Persona jurídica'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Filas de verificación */}
              <div className="divide-y divide-[#F8FAFC]">

                {/* Estado administrativo */}
                {result.estadoClave ? (
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    {result.estadoClave === 'ACTIVO'
                      ? <CircleCheck size={15} className="text-[#22C55E] shrink-0 mt-0.5" />
                      : <CircleX size={15} className="text-[#EF4444] shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[#374151]">Estado administrativo</span>
                        <span className={`text-[12px] font-bold ${result.estadoClave === 'ACTIVO' ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                          {result.estadoClave}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        {result.estadoClave === 'ACTIVO'
                          ? 'Habilitado para operar. Puede emitir y recibir comprobantes.'
                          : 'Estado irregular ante ARCA. Verificar habilitación antes de operar.'
                        }
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <CircleMinus size={15} className="text-[#94A3B8] shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#374151]">Estado administrativo</span>
                      <span className="text-[11px] text-[#94A3B8]">Sin datos de ARCA</span>
                    </div>
                  </div>
                )}

                {/* Condición IVA */}
                {result.condicionIVA ? (() => {
                  const ri = result.condicionIVA.toLowerCase().includes('inscripto') || result.condicionIVA.toLowerCase().includes('inscript')
                  const mono = result.condicionIVA.toLowerCase().includes('monotribut')
                  const exento = result.condicionIVA.toLowerCase().includes('exento')
                  let nota = ''
                  if (ri) nota = 'Corresponde sumar IVA a la cotización.'
                  else if (mono) nota = 'Monotributista — no corresponde discriminar IVA.'
                  else if (exento) nota = 'Exento de IVA — no corresponde sumar IVA.'
                  else nota = 'Verificar tratamiento de IVA antes de cotizar.'
                  return (
                    <div className="flex items-start gap-3 px-5 py-3.5">
                      <Info size={15} className="text-[#3B82F6] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold text-[#374151]">Condición ante IVA</span>
                          <span className="text-[12px] font-bold text-[#0F172A] text-right">{result.condicionIVA}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">{nota}</div>
                      </div>
                    </div>
                  )
                })() : (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <CircleMinus size={15} className="text-[#94A3B8] shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#374151]">Condición ante IVA</span>
                      <span className="text-[11px] text-[#94A3B8]">Sin datos de ARCA</span>
                    </div>
                  </div>
                )}

                {/* Actividad económica */}
                {result.actividadPrincipal ? (
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <Briefcase size={15} className="text-[#8B5CF6] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#374151] mb-0.5">Actividad económica</div>
                      <div className="text-[12px] text-[#0F172A] leading-snug">{result.actividadPrincipal}</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Verificar que corresponda al rubro de la operación.</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <CircleMinus size={15} className="text-[#94A3B8] shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#374151]">Actividad económica</span>
                      <span className="text-[11px] text-[#94A3B8]">Sin datos de ARCA</span>
                    </div>
                  </div>
                )}

                {/* Domicilio fiscal */}
                {(result.domicilio || result.localidad || result.provincia) ? (
                  <div className="flex items-start gap-3 px-5 py-3.5">
                    <MapPin size={15} className="text-[#F59E0B] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-[#374151] mb-0.5">Domicilio fiscal</div>
                      <div className="text-[12px] text-[#0F172A] leading-snug">
                        {[result.domicilio, result.localidad, result.provincia].filter(Boolean).join(', ')}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Confirmar que la dirección declarada sea válida para la operación.</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-5 py-3.5">
                    <CircleMinus size={15} className="text-[#94A3B8] shrink-0" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#374151]">Domicilio fiscal</span>
                      <span className="text-[11px] text-[#94A3B8]">Sin datos de ARCA</span>
                    </div>
                  </div>
                )}

              </div>
            </Card>

            {/* BCRA — sin deudas */}
            {result.bcra === 'sin_deudas' && (
              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] border border-[#22C55E]/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={20} className="text-[#22C55E]" />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-[#16A34A]">Sin deudas en el sistema financiero</div>
                    <div className="text-[12px] text-[#64748B]">BCRA Central de Deudores — sin registros activos</div>
                  </div>
                </div>
              </Card>
            )}

            {/* BCRA — con deudas */}
            {result.bcra === 'ok' && result.bcraData && result.maxSituacion && (
              <Card className="p-0 overflow-hidden">
                {(() => {
                  const sit = SITUACION_LABEL[result.maxSituacion!]
                  const Icon = sit.icon
                  return (
                    <div className={`flex items-center gap-3 px-5 py-4 border-b border-[#F1F5F9] ${sit.bg}`}>
                      <Icon size={18} className={`${sit.color} shrink-0`} />
                      <div>
                        <div className={`text-[13px] font-semibold ${sit.color}`}>{sit.label}</div>
                        <div className="text-[11px] text-[#64748B]">BCRA Central de Deudores</div>
                      </div>
                    </div>
                  )
                })()}

                <div className="divide-y divide-[#F1F5F9]">
                  {result.bcraData.periodos.slice(0, 3).map((periodo, pi) => (
                    <div key={pi} className="px-5 py-3">
                      <div className="text-[10px] font-bold tracking-widest uppercase text-[#94A3B8] mb-2">
                        Período {periodo.periodo}
                      </div>
                      <div className="space-y-2.5">
                        {periodo.entidades.map((ent, ei) => {
                          const s = SITUACION_LABEL[ent.situacion as SituacionCode]
                          return (
                            <div key={ei} className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium text-[#0F172A] truncate">{ent.entidad}</div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                                    Sit. {ent.situacion}
                                  </span>
                                  {ent.diasAtrasoPago > 0 && (
                                    <span className="text-[10px] text-[#EF4444]">{ent.diasAtrasoPago}d de atraso</span>
                                  )}
                                  {ent.procesoJud && <span className="text-[10px] text-[#EF4444]">Proceso judicial</span>}
                                  {ent.refinanciaciones && <span className="text-[10px] text-[#F59E0B]">Refinanciado</span>}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[13px] font-bold text-[#0F172A]">
                                  $ {(ent.monto * 1000).toLocaleString('es-AR')}
                                </div>
                                <div className="text-[10px] text-[#94A3B8]">ARS</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* BCRA — error */}
            {result.bcra === 'error' && (
              <Card>
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-[#F59E0B] shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-[#92400E]">No se pudo consultar el BCRA</div>
                    <div className="text-[12px] text-[#64748B]">Probá de nuevo en unos instantes.</div>
                  </div>
                  <button
                    onClick={handleSearch}
                    className="text-[11px] font-semibold text-[#D97706] hover:text-[#92400E] underline cursor-pointer whitespace-nowrap"
                  >
                    Reintentar
                  </button>
                </div>
              </Card>
            )}

            {/* Nota discreta si ARCA no devolvió datos fiscales */}
            {result.afipError && !result.estadoClave && !result.condicionIVA && (
              <div className="flex items-center gap-2 px-1">
                <AlertCircle size={13} className="text-[#CBD5E1] shrink-0" />
                <p className="text-[11px] text-[#94A3B8]">
                  Datos fiscales de ARCA no disponibles en este momento.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
