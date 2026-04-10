import { useState } from 'react'
import { useQuoteStore } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'
import { Card, CardTitle, FieldGroup, Label, Input, Select, Button } from '@/components/ui'
import { GeneralDiscounts } from '@/components/quoter/ItemsTable'
import { generateCheckDates, fmt, cn } from '@/utils'
import { CheckCircle2, Settings2 } from 'lucide-react'
import type { PaymentMode, PaymentConditionTemplate } from '@/types'

// ─── Mode metadata ────────────────────────────────────────────────────────────

const MODES: { id: PaymentMode; icon: string; label: string; desc: string }[] = [
  { id: 'contado',    icon: '💵', label: 'Contado',           desc: 'Pago inmediato · Mejor descuento' },
  { id: 'cheques',    icon: '🧾', label: 'Cheques diferidos', desc: 'Hasta 12 valores · Sin interés' },
  { id: 'financiado', icon: '🏦', label: 'Financiado',        desc: 'Banco · Cuotas · Tasa pactada' },
  { id: 'leasing',    icon: '📋', label: 'Leasing',           desc: 'Canon mensual · Opción de compra' },
]

const MODE_META: Record<string, { icon: string; color: string; bg: string }> = {
  contado:    { icon: '💵', color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4] border-[#22C55E]/30' },
  cheques:    { icon: '🧾', color: 'text-[#92400E]', bg: 'bg-[#FFFBEB] border-[#F59E0B]/30' },
  financiado: { icon: '🏦', color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF] border-[#93C5FD]/50' },
  leasing:    { icon: '📋', color: 'text-[#6D28D9]', bg: 'bg-[#F5F3FF] border-[#C4B5FD]/50' },
}

// ─── Payment detail panel (manual mode) ───────────────────────────────────────

function PaymentDetailPanel() {
  const { quote, setPayment, setTaxes, setDelivery } = useQuoteStore()
  const { payment, taxes, delivery } = quote

  const checkDates = generateCheckDates(payment.num_checks ?? 3)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
      {/* LEFT: payment details */}
      <Card>
        {/* CONTADO */}
        {payment.mode === 'contado' && (
          <>
            <CardTitle>Pago al Contado</CardTitle>
            <FieldGroup>
              <Label>Descuento %</Label>
              <Input type="number" value={payment.discount_pct ?? 20} min={0} max={100} step={0.5}
                onChange={e => setPayment({ discount_pct: Number(e.target.value) })} />
            </FieldGroup>
            <FieldGroup>
              <Label>Instrumento de pago</Label>
              <Select value={payment.instrument ?? 'transferencia'} onChange={e => setPayment({ instrument: e.target.value as typeof payment.instrument })}>
                <option value="transferencia">Transferencia bancaria</option>
                <option value="echeq">E.Cheq (electrónico)</option>
                <option value="cheque_cert">Cheque certificado</option>
                <option value="efectivo">Efectivo</option>
              </Select>
            </FieldGroup>
            <PaymentNote>Con el descuento de contado el precio queda al valor de lista del día de pago.</PaymentNote>
          </>
        )}

        {/* CHEQUES */}
        {payment.mode === 'cheques' && (
          <>
            <CardTitle>Cheques Diferidos</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <Label>Cantidad de cheques</Label>
                <Input type="number" value={payment.num_checks ?? 3} min={1} max={12}
                  onChange={e => setPayment({ num_checks: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup>
                <Label>Descuento %</Label>
                <Input type="number" value={payment.discount_pct ?? 15} min={0} max={100} step={0.5}
                  onChange={e => setPayment({ discount_pct: Number(e.target.value) })} />
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label>Vencimientos</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {checkDates.map((d, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#22C55E]/30 text-[#22C55E] font-medium">
                    {i === 0 ? 'A la firma' : `+${i * 30}d · ${new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`}
                  </span>
                ))}
              </div>
            </FieldGroup>
            <PaymentNote>Cheques sin leyenda "NO A LA ORDEN", tinta negra, titulares sin mora (situación 1).</PaymentNote>
          </>
        )}

        {/* FINANCIADO */}
        {payment.mode === 'financiado' && (
          <>
            <CardTitle>Financiado</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <Label>Anticipo %</Label>
                <Input type="number" value={payment.deposit_pct ?? 30} min={0} max={100} step={5}
                  onChange={e => setPayment({ deposit_pct: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup>
                <Label>Cuotas</Label>
                <Select value={payment.installments ?? 12} onChange={e => setPayment({ installments: Number(e.target.value) })}>
                  {[3, 6, 12, 18, 24, 36, 48, 60].map(n => <option key={n} value={n}>{n}</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label>Tasa mensual %</Label>
                <Input type="number" value={payment.monthly_rate ?? 4.5} min={0} step={0.1}
                  onChange={e => setPayment({ monthly_rate: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup>
                <Label>Tipo de crédito</Label>
                <Select value={payment.credit_type ?? 'prendario'} onChange={e => setPayment({ credit_type: e.target.value as typeof payment.credit_type })}>
                  <option value="prendario">Crédito prendario</option>
                  <option value="personal">Crédito personal</option>
                  <option value="fae_bice">Fondo FAE / BICE</option>
                </Select>
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label>Entidad financiera</Label>
              <Input value={payment.financial_entity ?? ''} onChange={e => setPayment({ financial_entity: e.target.value })}
                placeholder="Ej: Banco Nación, Banco Macro, BICE..." />
            </FieldGroup>
            <PaymentNote>⚠ Con anticipo el fabricante puede reservar el orden de producción.</PaymentNote>
          </>
        )}

        {/* LEASING */}
        {payment.mode === 'leasing' && (
          <>
            <CardTitle>Leasing</CardTitle>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <Label>Plazo (meses)</Label>
                <Select value={payment.lease_term_months ?? 36} onChange={e => setPayment({ lease_term_months: Number(e.target.value) })}>
                  {[24, 36, 48, 60].map(n => <option key={n} value={n}>{n} meses</option>)}
                </Select>
              </FieldGroup>
              <FieldGroup>
                <Label>Opción de compra %</Label>
                <Input type="number" value={payment.buyout_pct ?? 10} min={0} max={50} step={1}
                  onChange={e => setPayment({ buyout_pct: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup>
                <Label>Tasa mensual %</Label>
                <Input type="number" value={payment.lease_rate ?? 3.8} min={0} step={0.1}
                  onChange={e => setPayment({ lease_rate: Number(e.target.value) })} />
              </FieldGroup>
              <FieldGroup>
                <Label>Empresa de leasing</Label>
                <Input value={payment.lease_company ?? ''} onChange={e => setPayment({ lease_company: e.target.value })}
                  placeholder="Ej: Macro Leasing, BBVA..." />
              </FieldGroup>
            </div>
          </>
        )}
      </Card>

      {/* RIGHT: IVA + Logística */}
      <div className="space-y-4">
        <Card>
          <CardTitle>IVA & Impuestos</CardTitle>
          <FieldGroup>
            <Label>IVA aplicable</Label>
            <Select value={taxes.iva_pct} onChange={e => setTaxes({ iva_pct: Number(e.target.value) })}>
              <option value={0}>Incluido en precio</option>
              <option value={10.5}>IVA Reducido 10,5% adicional</option>
              <option value={21}>IVA General 21% adicional</option>
              <option value={27}>IVA Diferencial 27% adicional</option>
            </Select>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Percepción IIBB %</Label>
              <Input type="number" value={taxes.iibb_pct} min={0} max={10} step={0.1}
                onChange={e => setTaxes({ iibb_pct: Number(e.target.value) })} />
            </FieldGroup>
            <FieldGroup>
              <Label>Otros impuestos %</Label>
              <Input type="number" value={taxes.other_pct} min={0} step={0.1}
                onChange={e => setTaxes({ other_pct: Number(e.target.value) })} />
            </FieldGroup>
          </div>
        </Card>

        <Card>
          <CardTitle>Logística & Entrega</CardTitle>
          <FieldGroup>
            <Label>Lugar de entrega</Label>
            <Select value={delivery.location} onChange={e => setDelivery({ location: e.target.value as typeof delivery.location })}>
              <option value="planta">En planta / concesionario</option>
              <option value="campo">En campo del cliente</option>
              <option value="acordar">A acordar</option>
            </Select>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Flete (monto fijo)</Label>
              <Input type="number" value={delivery.freight ?? 0} min={0}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelivery({ freight: Number(e.target.value) })} />
            </FieldGroup>
            <FieldGroup>
              <Label>Plazo estimado</Label>
              <Input value={delivery.estimated_days ?? ''} onChange={e => setDelivery({ estimated_days: e.target.value })}
                placeholder="Ej: 30 días hábiles" />
            </FieldGroup>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── List conditions quick-selector ───────────────────────────────────────────

function ListConditionSelector({ conditions }: { conditions: PaymentConditionTemplate[] }) {
  const { quote, setPayment } = useQuoteStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)

  function applyTemplate(t: PaymentConditionTemplate) {
    setSelectedId(t.id)
    setShowCustom(false)
    setPayment({ ...t.condition })
  }

  return (
    <div className="space-y-4">
      {/* Condition cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {conditions.map(t => {
          const meta = MODE_META[t.condition.mode] ?? MODE_META.contado
          const isSelected = selectedId === t.id
          return (
            <button
              key={t.id}
              onClick={() => applyTemplate(t)}
              className={cn(
                'text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer',
                isSelected
                  ? 'border-[#22C55E] bg-[#F0FDF4] shadow-sm'
                  : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#22C55E]/40 hover:bg-white'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 border', meta.bg)}>
                  {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#0F172A] truncate">{t.label}</div>
                  <div className={cn('text-[11px] font-medium capitalize mt-0.5', meta.color)}>
                    {t.condition.mode}
                    {t.condition.discount_pct ? ` · ${t.condition.discount_pct}% desc.` : ''}
                    {t.condition.num_checks   ? ` · ${t.condition.num_checks} cheques` : ''}
                    {t.condition.installments ? ` · ${t.condition.installments} cuotas` : ''}
                  </div>
                </div>
                {isSelected && <CheckCircle2 size={16} className="text-[#22C55E] shrink-0" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Personalizar toggle */}
      <button
        onClick={() => setShowCustom(v => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[12px] font-medium transition-colors cursor-pointer px-1',
          showCustom ? 'text-[#0F172A]' : 'text-[#94A3B8] hover:text-[#64748B]'
        )}
      >
        <Settings2 size={13} />
        {showCustom ? 'Ocultar personalización' : 'Personalizar condición'}
      </button>

      {showCustom && (
        <div className="pt-1">
          {/* Mode selector — manual override */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  const defaults: Record<PaymentMode, Partial<typeof quote.payment>> = {
                    contado:    { mode: 'contado',    discount_pct: 20 },
                    cheques:    { mode: 'cheques',    discount_pct: 15, num_checks: 3 },
                    financiado: { mode: 'financiado', discount_pct: 0,  deposit_pct: 30, installments: 12, monthly_rate: 4.5 },
                    leasing:    { mode: 'leasing',    discount_pct: 0,  lease_term_months: 36, buyout_pct: 10, lease_rate: 3.8 },
                  }
                  setPayment(defaults[m.id])
                  setSelectedId(null)
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all cursor-pointer',
                  quote.payment.mode === m.id
                    ? 'bg-[#F0FDF4] border-[#22C55E] border-2 shadow-sm'
                    : 'bg-white border-[#E2E8F0] hover:border-[#22C55E]/40 hover:bg-[#F8FAFC]'
                )}
              >
                <span className="text-2xl leading-none">{m.icon}</span>
                <span className={cn('text-[13px] font-semibold', quote.payment.mode === m.id ? 'text-[#0F172A]' : 'text-[#64748B]')}>{m.label}</span>
                <span className={cn('text-[10px] leading-snug text-center', quote.payment.mode === m.id ? 'text-[#22C55E]' : 'text-[#94A3B8]')}>{m.desc}</span>
              </button>
            ))}
          </div>
          <PaymentDetailPanel />
        </div>
      )}

      {/* Always show IVA + Logística even without personalizar */}
      {!showCustom && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          <IvaTaxCard />
          <LogisticaCard />
        </div>
      )}
    </div>
  )
}

// ─── Shared sub-cards ─────────────────────────────────────────────────────────

function IvaTaxCard() {
  const { quote, setTaxes } = useQuoteStore()
  const { taxes } = quote
  return (
    <Card>
      <CardTitle>IVA & Impuestos</CardTitle>
      <FieldGroup>
        <Label>IVA aplicable</Label>
        <Select value={taxes.iva_pct} onChange={e => setTaxes({ iva_pct: Number(e.target.value) })}>
          <option value={0}>Incluido en precio</option>
          <option value={10.5}>IVA Reducido 10,5% adicional</option>
          <option value={21}>IVA General 21% adicional</option>
          <option value={27}>IVA Diferencial 27% adicional</option>
        </Select>
      </FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label>Percepción IIBB %</Label>
          <Input type="number" value={taxes.iibb_pct} min={0} max={10} step={0.1}
            onChange={e => setTaxes({ iibb_pct: Number(e.target.value) })} />
        </FieldGroup>
        <FieldGroup>
          <Label>Otros impuestos %</Label>
          <Input type="number" value={taxes.other_pct} min={0} step={0.1}
            onChange={e => setTaxes({ other_pct: Number(e.target.value) })} />
        </FieldGroup>
      </div>
    </Card>
  )
}

function LogisticaCard() {
  const { quote, setDelivery } = useQuoteStore()
  const { delivery } = quote
  return (
    <Card>
      <CardTitle>Logística & Entrega</CardTitle>
      <FieldGroup>
        <Label>Lugar de entrega</Label>
        <Select value={delivery.location} onChange={e => setDelivery({ location: e.target.value as typeof delivery.location })}>
          <option value="planta">En planta / concesionario</option>
          <option value="campo">En campo del cliente</option>
          <option value="acordar">A acordar</option>
        </Select>
      </FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup>
          <Label>Flete (monto fijo)</Label>
          <Input type="number" value={delivery.freight ?? 0} min={0}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelivery({ freight: Number(e.target.value) })} />
        </FieldGroup>
        <FieldGroup>
          <Label>Plazo estimado</Label>
          <Input value={delivery.estimated_days ?? ''} onChange={e => setDelivery({ estimated_days: e.target.value })}
            placeholder="Ej: 30 días hábiles" />
        </FieldGroup>
      </div>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PaymentConditions({ priceListId }: { priceListId?: string | null }) {
  const { quote, setPayment } = useQuoteStore()
  const { payment } = quote
  const { priceLists } = useCatalogStore()

  const activeList  = priceListId ? priceLists.find(pl => pl.id === priceListId) : null
  const listConditions = activeList?.payment_conditions ?? []
  const hasListConditions = listConditions.length > 0

  const checkDates = generateCheckDates(payment.num_checks ?? 3)

  return (
    <div className="space-y-6">

      {/* ── Condition selector ── */}
      {hasListConditions ? (
        // List has conditions — show as quick-select
        <ListConditionSelector conditions={listConditions} />
      ) : (
        // No list / no conditions — full manual mode
        <div className="space-y-5">
          {activeList && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
              <span className="text-[11px] text-[#94A3B8]">
                La lista <span className="font-semibold text-[#64748B]">{activeList.brand} — {activeList.name}</span> no tiene condiciones de pago configuradas. Podés agregarlas en <span className="font-semibold">Catálogo → Condiciones de pago</span>, o ingresar la condición manualmente:
              </span>
            </div>
          )}

          {/* Mode selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  const defaults: Record<PaymentMode, Partial<typeof payment>> = {
                    contado:    { mode: 'contado',    discount_pct: 20 },
                    cheques:    { mode: 'cheques',    discount_pct: 15, num_checks: 3 },
                    financiado: { mode: 'financiado', discount_pct: 0,  deposit_pct: 30, installments: 12, monthly_rate: 4.5 },
                    leasing:    { mode: 'leasing',    discount_pct: 0,  lease_term_months: 36, buyout_pct: 10, lease_rate: 3.8 },
                  }
                  setPayment(defaults[m.id])
                }}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all cursor-pointer',
                  payment.mode === m.id
                    ? 'bg-[#F0FDF4] border-[#22C55E] border-2 shadow-sm'
                    : 'bg-white border-[#E2E8F0] hover:border-[#22C55E]/40 hover:bg-[#F8FAFC]'
                )}
              >
                <span className="text-2xl leading-none">{m.icon}</span>
                <span className={cn('text-[13px] font-semibold', payment.mode === m.id ? 'text-[#0F172A]' : 'text-[#64748B]')}>{m.label}</span>
                <span className={cn('text-[10px] leading-snug text-center', payment.mode === m.id ? 'text-[#22C55E]' : 'text-[#94A3B8]')}>{m.desc}</span>
              </button>
            ))}
          </div>

          <PaymentDetailPanel />
        </div>
      )}

      {/* ── Divider ── */}
      <div className="border-t border-[#E2E8F0]" />

      {/* ── Descuentos & Recargos Generales ── */}
      <div>
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-3">
          Descuentos & Recargos Generales
        </div>
        <GeneralDiscounts />
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PaymentNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 text-[12px] text-[#64748B] leading-relaxed px-3.5 py-2.5 bg-[#F8FAFC] border-l-[3px] border-[#22C55E]/40 rounded-r-lg">
      {children}
    </div>
  )
}
