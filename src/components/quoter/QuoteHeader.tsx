import { useState, useEffect, useCallback } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import { Card, CardTitle, FieldGroup, Label, Input, Select } from '@/components/ui'
import { PROVINCES } from '@/utils'
import { RefreshCw } from 'lucide-react'

// ─── BNA Dollar rate ──────────────────────────────────────────────────────────

interface BNARate {
  venta: number
  compra: number
  fechaActualizacion: string
}

async function fetchBNARate(): Promise<BNARate> {
  const res = await fetch('https://dolarapi.com/v1/dolares/oficial')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return { venta: data.venta, compra: data.compra, fechaActualizacion: data.fechaActualizacion }
}

function useBNARate(onRate: (venta: number) => void) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [lastRate, setLastRate] = useState<BNARate | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const rate = await fetchBNARate()
      setLastRate(rate)
      onRate(rate.venta)
    } catch (e) {
      setError('No se pudo obtener la cotización')
    } finally {
      setLoading(false)
    }
  }, [onRate])

  // Auto-fetch on mount
  useEffect(() => { refresh() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return { loading, error, lastRate, refresh }
}

// ─── BCRA Central de Deudores ─────────────────────────────────────────────────
type SituacionCode = 1 | 2 | 3 | 4 | 5 | 6

interface DeudorEntidad {
  entidad: string
  situacion: SituacionCode
  fechaSit1?: string
  monto: number
  diasAtrasoPago: number
  refinanciaciones?: boolean
  recategorizacionOblig?: boolean
  situacionJuridica?: boolean
  irrecDisposicionTecnica?: boolean
  enRevision?: boolean
  procesoJud?: boolean
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

type CheckState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: DeudorResult }
  | { status: 'sin_deudas' }
  | { status: 'error'; message: string }

const SITUACION_LABEL: Record<SituacionCode, string> = {
  1: 'Normal',
  2: 'Riesgo bajo',
  3: 'Riesgo medio',
  4: 'Riesgo alto',
  5: 'Irrecuperable',
  6: 'Irrecuperable (disp. técnica)',
}

function maxSituacion(periodos: DeudorPeriodo[]): SituacionCode {
  let max: SituacionCode = 1
  for (const p of periodos)
    for (const e of p.entidades)
      if (e.situacion > max) max = e.situacion as SituacionCode
  return max
}

async function checkDeudor(cuit: string): Promise<CheckState> {
  const clean = cuit.replace(/-/g, '')
  if (clean.length !== 11) return { status: 'error', message: 'CUIT inválido (debe tener 11 dígitos)' }

  try {
    const base = '/api/bcra'
    const res = await fetch(`${base}/centraldedeudores/v1.0/Deudas/${clean}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.status === 404) return { status: 'sin_deudas' }
    if (res.status === 400) return { status: 'error', message: 'CUIT no válido para el BCRA' }
    if (res.status === 429) return { status: 'error', message: 'Límite de consultas, intentá en unos segundos' }
    if (!res.ok) {
      let detail = ''
      try { const t = await res.text(); detail = t.slice(0, 120) } catch { /* ignore */ }
      return { status: 'error', message: `BCRA respondió ${res.status}${detail ? ': ' + detail : ''}` }
    }
    const json = await res.json()
    return { status: 'ok', data: json.results as DeudorResult }
  } catch {
    return { status: 'error', message: 'No se pudo conectar con el BCRA' }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function QuoteHeader() {
  const { quote, setClient, setCurrency, setExchangeRate, setValidDays, setQuoteNumber } = useQuoteStore()
  const { client, currency, exchange_rate, valid_days, quote_number } = quote
  const [checkState, setCheckState] = useState<CheckState>({ status: 'idle' })

  const { loading: bnaLoading, error: bnaError, lastRate, refresh: refreshBNA } = useBNARate(setExchangeRate)

  async function handleCheckDeudor() {
    setCheckState({ status: 'loading' })
    const result = await checkDeudor(client.cuit ?? '')
    setCheckState(result)
  }

  const situacion = checkState.status === 'ok' ? maxSituacion(checkState.data.periodos) : null
  const situacionColor =
    situacion === null ? ''
    : situacion === 1 ? 'text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10'
    : situacion === 2 ? 'text-[#F59E0B] border-[#F59E0B]/30 bg-[#F59E0B]/10'
    : 'text-[#EF4444] border-[#EF4444]/30 bg-[#EF4444]/10'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Cliente */}
      <Card>
        <CardTitle>Cliente</CardTitle>
        <FieldGroup>
          <Label>Razón Social / Nombre</Label>
          <Input
            value={client.name}
            onChange={e => setClient({ name: e.target.value })}
            placeholder="Ej: Juan Pérez / Agropecuaria Los Sauces SA"
          />
        </FieldGroup>
        <FieldGroup>
          <Label>CUIT</Label>
          <div className="flex gap-2">
            <Input
              value={client.cuit ?? ''}
              onChange={e => {
                setClient({ cuit: e.target.value })
                setCheckState({ status: 'idle' })
              }}
              placeholder="20-12345678-9"
              maxLength={13}
            />
            <button
              onClick={handleCheckDeudor}
              disabled={checkState.status === 'loading' || !client.cuit}
              className="shrink-0 px-3 py-2 text-[11px] font-medium rounded-lg border border-[#E2E8F0] text-[#64748B] bg-white hover:bg-[#F1F5F9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {checkState.status === 'loading' ? '...' : 'Verificar'}
            </button>
          </div>

          {/* Resultado BCRA */}
          {checkState.status === 'sin_deudas' && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10">
              <span className="text-[#22C55E] text-xs">✓</span>
              <span className="text-[11px] text-[#22C55E] font-medium">Sin deudas en el sistema financiero</span>
            </div>
          )}

          {checkState.status === 'error' && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10">
              <span className="text-[#EF4444] text-xs">✗</span>
              <span className="text-[11px] text-[#EF4444] font-medium">{checkState.message}</span>
            </div>
          )}

          {checkState.status === 'ok' && situacion !== null && (
            <div className={`mt-2 px-3 py-2 rounded-sm border ${situacionColor}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] tracking-[1px] uppercase opacity-70">Situación BCRA</span>
                <span className="font-mono text-[10px] font-semibold tracking-[0.5px]">
                  {situacion} — {SITUACION_LABEL[situacion]}
                </span>
              </div>
              {checkState.data.denominacion && (
                <div className="font-mono text-[9px] opacity-60 mb-1.5">{checkState.data.denominacion}</div>
              )}
              {checkState.data.periodos.length > 0 && (
                <div className="space-y-1">
                  {checkState.data.periodos[0].entidades.map((e, i) => (
                    <div key={i} className="font-mono text-[9px] opacity-80">
                      <div className="flex justify-between">
                        <span className="truncate max-w-[55%]">{e.entidad}</span>
                        <span>${(e.monto * 1000).toLocaleString('es-AR')} ARS</span>
                      </div>
                      {(e.diasAtrasoPago > 0 || e.procesoJud || e.situacionJuridica) && (
                        <div className="flex gap-2 mt-0.5 opacity-70">
                          {e.diasAtrasoPago > 0 && <span>{e.diasAtrasoPago}d atraso</span>}
                          {e.procesoJud && <span>· Proceso judicial</span>}
                          {e.situacionJuridica && <span>· Sit. jurídica</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
              placeholder="Ej: 3562-123456"
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

      {/* Cotización */}
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

        <FieldGroup>
          <Label>Moneda</Label>
          <div className="flex gap-2">
            {(['USD', 'ARS'] as const).map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${
                  currency === c
                    ? 'bg-[#F0FDF4] border-[#22C55E] text-[#16A34A]'
                    : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#22C55E]/40'
                }`}
              >
                {c === 'USD' ? '🇺🇸 USD' : '🇦🇷 ARS'}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup>
          <Label>Tipo de cambio · Dólar BNA vendedor</Label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#64748B] pointer-events-none">$</span>
              <Input
                type="number"
                value={exchange_rate}
                onChange={e => setExchangeRate(Number(e.target.value))}
                className="pl-9"
                min={1}
              />
            </div>
            <button
              onClick={refreshBNA}
              disabled={bnaLoading}
              title="Actualizar desde Banco Nación"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:border-[#22C55E]/50 hover:text-[#22C55E] transition-colors cursor-pointer disabled:opacity-50 shrink-0 text-[12px] font-medium"
            >
              <RefreshCw size={13} className={bnaLoading ? 'animate-spin' : ''} />
              {bnaLoading ? 'Actualizando...' : 'BNA'}
            </button>
          </div>
          {bnaError && (
            <p className="text-[11px] text-[#EF4444] mt-1">{bnaError}</p>
          )}
          {lastRate && !bnaError && (
            <p className="text-[11px] text-[#94A3B8] mt-1">
              Compra ${lastRate.compra.toLocaleString('es-AR')} · Venta ${lastRate.venta.toLocaleString('es-AR')}
              {' · '}{new Date(lastRate.fechaActualizacion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
