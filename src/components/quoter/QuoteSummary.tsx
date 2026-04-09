import { useState } from 'react'
import { useQuoteStore, computeTotals } from '@/store/quoteStore'
import { fmt, fmtCurrency } from '@/utils'
import { Printer, RotateCcw, Save, Loader2, MessageCircle, Mail, ChevronDown, ChevronUp, Bell, X } from 'lucide-react'
import { Button, Input, Label, FieldGroup, Select, Textarea } from '@/components/ui'
import { cn } from '@/utils'
import { downloadQuotePDF, shareQuotePDF } from '@/lib/pdf/QuotePDF'
import { useSaveQuote } from '@/hooks/useSupabase'
import { useClientStore } from '@/store/clientStore'
import { useCRMStore } from '@/store/crmStore'

// ─── Follow-up quick modal (shown after sharing) ─────────────────────────────

function QuickFollowUpModal({ quoteNumber, clientName, clientPhone, clientEmail, onClose }: {
  quoteNumber: string; clientName: string
  clientPhone?: string; clientEmail?: string
  onClose: () => void
}) {
  const { addFollowUp, sellerEmail } = useCRMStore()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    scheduled_date: today,
    reminder_days: 3,
    notes: '',
    seller_email: sellerEmail ?? '',
  })

  const handleSave = () => {
    addFollowUp({
      quote_id: quoteNumber,
      quote_number: quoteNumber,
      client_name: clientName,
      client_phone: clientPhone,
      client_email: clientEmail,
      seller_email: form.seller_email || undefined,
      scheduled_date: form.scheduled_date,
      reminder_days: form.reminder_days,
      notes: form.notes || `Seguimiento post-envío — ${quoteNumber}`,
      status: 'pending',
      sent_at: today,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[14px] font-semibold text-[#0F172A]">Agendar seguimiento</div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#F0FDF4] border border-[#22C55E]/20 rounded-lg">
          <Bell size={12} className="text-[#22C55E] shrink-0" />
          <p className="text-[11px] text-[#16A34A]">Cotización enviada a <b>{clientName}</b>. ¿Querés agendar un recordatorio?</p>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Primer contacto</Label>
              <Input type="date" value={form.scheduled_date} min={today}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Recordar cada</Label>
              <Select value={form.reminder_days} onChange={e => setForm(f => ({ ...f, reminder_days: Number(e.target.value) }))}>
                {[1, 2, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Preguntar si revisó la propuesta..." />
          </FieldGroup>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Omitir</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>Agendar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteSummary() {
  const { quote, resetQuote } = useQuoteStore()
  const totals = computeTotals(quote)
  const { currency, exchange_rate, payment } = quote
  const sym = (n: number) => fmtCurrency(n, currency)
  const arsVal = (n: number) => exchange_rate > 0 ? `$ ${fmt(n * exchange_rate)}` : sym(n)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [sharingWA, setSharingWA]   = useState(false)
  const [sharingEM, setSharingEM]   = useState(false)
  const [collapsed, setCollapsed]   = useState(false)
  const [showFollowUp, setShowFollowUp] = useState(false)
  const saveQuote = useSaveQuote()
  const { upsertFromQuote } = useClientStore()

  const hasItems = quote.items.length > 0

  const handleReset = () => {
    if (confirm('¿Reiniciar la cotización? Se borrarán todos los datos.')) resetQuote()
  }

  const handlePDF = async () => {
    setPdfLoading(true)
    try { await downloadQuotePDF({ ...quote, totals }) }
    finally { setPdfLoading(false) }
  }

  const handleSave = () => {
    saveQuote.mutate({ ...quote, totals } as any)
    // Auto-save client when saving quote
    if (quote.client?.name?.trim()) {
      upsertFromQuote({
        ...quote.client,
        name: quote.client.name,
        quote_number: quote.quote_number,
        quote_date: new Date().toISOString().split('T')[0],
      })
    }
  }

  const afterShare = () => {
    // Save client to CRM
    if (quote.client?.name?.trim()) {
      upsertFromQuote({
        ...quote.client,
        name: quote.client.name,
        quote_number: quote.quote_number,
        quote_date: new Date().toISOString().split('T')[0],
      })
    }
    // Show follow-up modal
    if (quote.client?.name?.trim()) {
      setShowFollowUp(true)
    }
  }

  const handleWhatsApp = async () => {
    setSharingWA(true)
    try {
      await shareQuotePDF({ ...quote, totals }, 'whatsapp')
      afterShare()
    } finally { setSharingWA(false) }
  }

  const handleEmail = async () => {
    setSharingEM(true)
    try {
      await shareQuotePDF({ ...quote, totals }, 'email')
      afterShare()
    } finally { setSharingEM(false) }
  }

  return (
    <>
    {showFollowUp && (
      <QuickFollowUpModal
        quoteNumber={quote.quote_number}
        clientName={quote.client.name}
        clientPhone={quote.client.phone}
        clientEmail={quote.client.email}
        onClose={() => setShowFollowUp(false)}
      />
    )}
    <div className="bg-white rounded-xl overflow-hidden border border-[#E2E8F0]">

      {/* ── Header / collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 bg-[#1E2235] hover:bg-[#252d42] transition-colors cursor-pointer group"
      >
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-[10px] font-semibold tracking-widest uppercase text-white/40 leading-none">
            {collapsed ? 'Ver detalle' : 'Total cotización'}
          </span>
          <span className="text-[20px] font-bold text-[#22C55E] leading-tight tabular-nums">
            {arsVal(totals.total)}
          </span>
          {totals.total > 0 && exchange_rate > 0 && (
            <span className="text-[11px] text-white/50 font-mono leading-none">
              ≈ {sym(totals.total)} · TC $ {fmt(exchange_rate)}
            </span>
          )}
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors bg-white/10 group-hover:bg-white/20`}>
          {collapsed
            ? <ChevronDown size={14} className="text-white/70" />
            : <ChevronUp   size={14} className="text-white/70" />
          }
        </div>
      </button>

      {/* ── Collapsible body ── */}
      {!collapsed && (
        <div className="p-5 space-y-4">

          {/* Totals breakdown */}
          <div className="space-y-0.5">
            <SummaryRow label="Subtotal bruto" value={arsVal(totals.gross)} />
            {totals.item_discounts > 0    && <SummaryRow label="Desc. por ítem"    value={`– ${arsVal(totals.item_discounts)}`}    accent="rojo" />}
            {totals.general_discounts > 0 && <SummaryRow label="Desc. generales"   value={`– ${arsVal(totals.general_discounts)}`} accent="rojo" />}
            {totals.payment_discount > 0  && (
              <SummaryRow label={`Desc. ${payment.mode} (${payment.discount_pct}%)`} value={`– ${arsVal(totals.payment_discount)}`} accent="rojo" />
            )}
            <SummaryRow label="Subtotal neto" value={arsVal(totals.net)} />
            {totals.freight > 0 && <SummaryRow label="Flete"          value={arsVal(totals.freight)} />}
            {totals.iibb > 0    && <SummaryRow label="Percep. IIBB"   value={arsVal(totals.iibb)} />}
            {totals.iva > 0 && (
              <>
                <SummaryRow label="Base imponible"             value={arsVal(totals.tax_base)} />
                <SummaryRow label={`IVA (${quote.taxes.iva_pct}%)`} value={arsVal(totals.iva)} />
              </>
            )}
            <div className="pt-3 mt-2 border-t-2 border-[#E2E8F0]">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-semibold text-[#0F172A]">TOTAL</span>
                <div className="text-right">
                  <div className="text-[20px] font-bold text-[#22C55E]">{arsVal(totals.total)}</div>
                  {exchange_rate > 0 && (
                    <div className="text-[11px] text-[#94A3B8] font-mono">≈ {sym(totals.total)} · TC {exchange_rate.toLocaleString('es-AR')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Financing simulation */}
          {(payment.mode === 'financiado' || payment.mode === 'leasing') && totals.installment_amount !== undefined && (
            <div className="pt-3 border-t border-[#F1F5F9]">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">
                {payment.mode === 'leasing' ? 'Simulación Leasing' : 'Simulación Financiamiento'}
              </div>
              <div className="space-y-1">
                {payment.mode === 'financiado' && totals.deposit !== undefined && (
                  <>
                    <FinancingRow label={`Anticipo (${payment.deposit_pct}%)`}       value={arsVal(totals.deposit)} />
                    <FinancingRow label="Saldo a financiar"                           value={arsVal(totals.total - totals.deposit)} />
                    <FinancingRow label={`${payment.installments} cuotas de`}         value={`${arsVal(totals.installment_amount)}/mes`} accent />
                    {totals.total_financed && <FinancingRow label="Total financiado"  value={arsVal(totals.total_financed)} />}
                  </>
                )}
                {payment.mode === 'leasing' && (
                  <>
                    <FinancingRow label={`Canon × ${payment.lease_term_months} meses`}       value={`${arsVal(totals.installment_amount)}/mes`} accent />
                    <FinancingRow label={`Opción de compra (${payment.buyout_pct}%)`}         value={arsVal(totals.total * (payment.buyout_pct ?? 10) / 100)} />
                    {totals.total_financed && <FinancingRow label="Total leasing"             value={arsVal(totals.total_financed)} />}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <Button variant="primary" className="w-full flex items-center justify-center gap-2"
              onClick={handlePDF} disabled={pdfLoading || !hasItems}>
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              {pdfLoading ? 'Generando PDF...' : 'Exportar PDF'}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleWhatsApp} disabled={!hasItems || sharingWA}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-[12px] font-medium transition-all cursor-pointer',
                  hasItems && !sharingWA
                    ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/20'
                    : 'opacity-40 border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                )}>
                {sharingWA ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                WhatsApp
              </button>
              <button onClick={handleEmail} disabled={!hasItems || sharingEM}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-[12px] font-medium transition-all cursor-pointer',
                  hasItems && !sharingEM
                    ? 'bg-[#3B82F6]/10 border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/20'
                    : 'opacity-40 border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                )}>
                {sharingEM ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Email
              </button>
            </div>

            <Button variant="secondary" className="w-full flex items-center justify-center gap-2"
              onClick={handleSave} disabled={saveQuote.isPending || !hasItems}>
              {saveQuote.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saveQuote.isPending ? 'Guardando...' : 'Guardar Cotización'}
            </Button>
            {saveQuote.isSuccess && <p className="text-center text-[12px] text-[#22C55E] font-medium">✓ Guardada correctamente</p>}
            {saveQuote.isError   && <p className="text-center text-[12px] text-[#EF4444] font-medium">⚠ Error al guardar</p>}

            <Button variant="ghost" className="w-full flex items-center justify-center gap-2" onClick={handleReset}>
              <RotateCcw size={14} /> Nueva Cotización
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function SummaryRow({ label, value, accent }: { label: string; value: string; accent?: 'rojo' }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9] last:border-0">
      <span className="text-[13px] text-[#64748B]">{label}</span>
      <span className={cn('text-[13px] font-medium', accent === 'rojo' ? 'text-[#EF4444]' : 'text-[#0F172A]')}>{value}</span>
    </div>
  )
}

function FinancingRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#F1F5F9] last:border-0">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span className={cn('text-[13px] font-semibold', accent ? 'text-[#22C55E]' : 'text-[#0F172A]')}>{value}</span>
    </div>
  )
}
