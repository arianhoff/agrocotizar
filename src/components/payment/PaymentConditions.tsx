import { useQuoteStore } from '@/store/quoteStore'
import { Card, CardTitle, FieldGroup, Label, Input, Select, PrefixInput } from '@/components/ui'
import { generateCheckDates, fmt, cn } from '@/utils'
import type { PaymentMode } from '@/types'

const MODES: { id: PaymentMode; icon: string; label: string; desc: string }[] = [
  { id: 'contado',    icon: '💵', label: 'Contado',           desc: 'Pago inmediato · Mejor descuento' },
  { id: 'cheques',    icon: '🧾', label: 'Cheques diferidos', desc: 'Hasta 12 valores · Sin interés' },
  { id: 'financiado', icon: '🏦', label: 'Financiado',        desc: 'Banco · Cuotas · Tasa pactada' },
  { id: 'leasing',    icon: '📋', label: 'Leasing',           desc: 'Canon mensual · Opción de compra' },
]

export function PaymentConditions() {
  const { quote, setPayment, setTaxes, setDelivery, setCurrency, setExchangeRate } = useQuoteStore()
  const { payment, taxes, delivery, currency, exchange_rate } = quote

  const checkDates = generateCheckDates(payment.num_checks ?? 3)

  return (
    <div className="space-y-5">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
              <PaymentNote>
                Con el descuento de contado el precio queda al valor de lista del día de pago.
              </PaymentNote>
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
              <PaymentNote>
                Cheques sin leyenda "NO A LA ORDEN", tinta negra, titulares sin mora (situación 1).
              </PaymentNote>
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
              <PaymentNote>
                ⚠ Con anticipo el fabricante puede reservar el orden de producción. El saldo puede ajustarse al tipo de cambio del día de entrega según condiciones pactadas.
              </PaymentNote>
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
              <PaymentNote>
                El canon se calcula sobre el capital financiado (precio total menos opción de compra). La opción de compra se abona al final del contrato.
              </PaymentNote>
            </>
          )}
        </Card>

        {/* RIGHT: TC + IVA + Logística */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Tipo de Cambio & Moneda</CardTitle>
            <FieldGroup>
              <Label>Moneda</Label>
              <div className="flex gap-2">
                {(['USD', 'ARS'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)}
                    className={cn('flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all cursor-pointer',
                      currency === c ? 'bg-[#F0FDF4] border-[#22C55E] text-[#16A34A]' : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-[#22C55E]/40')}>
                    {c === 'USD' ? '🇺🇸 USD' : '🇦🇷 ARS'}
                  </button>
                ))}
              </div>
            </FieldGroup>
            <FieldGroup>
              <Label>Tipo de cambio · Dólar BNA vendedor</Label>
              <PrefixInput prefix="$" type="number" value={exchange_rate} min={1}
                onChange={e => setExchangeRate(Number(e.target.value))} />
              <p className="font-mono text-[10px] text-[#8B9BAA] mt-1">Actualizado automáticamente al abrir el cotizador</p>
            </FieldGroup>
          </Card>

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
                <PrefixInput prefix={currency === 'USD' ? 'U$S' : '$'} type="number" value={delivery.freight ?? 0} min={0}
                  onChange={e => setDelivery({ freight: Number(e.target.value) })} />
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
