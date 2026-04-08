import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { AIChat } from '@/components/chat/AIChat'
import { QuoteHeader } from '@/components/quoter/QuoteHeader'
import { ItemsTable, GeneralDiscounts } from '@/components/quoter/ItemsTable'
import { PaymentConditions } from '@/components/payment/PaymentConditions'
import { QuoteSummary } from '@/components/quoter/QuoteSummary'
import { Divider, SectionTitle, Textarea, FieldGroup, Label } from '@/components/ui'
import { useQuoteStore, computeTotals } from '@/store/quoteStore'
import { fmtCurrency } from '@/utils'
import { X, Receipt } from 'lucide-react'

export function QuoterPage() {
  const { quote, setNotes } = useQuoteStore()
  const totals = computeTotals(quote)
  const sym = (n: number) => fmtCurrency(n, quote.currency)
  const [showMobileSummary, setShowMobileSummary] = useState(false)

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader
        title="Nueva Cotización"
        subtitle={`${quote.quote_number}`}
      />

      {/* Main content — on lg+ right padding reserves space for the floating panel */}
      <div className="p-4 sm:p-6 md:p-8 lg:pr-[352px]">
        {/* AI Chat */}
        <AIChat />

        {/* 01 — Datos */}
        <SectionTitle>01 — Datos de la Cotización</SectionTitle>
        <QuoteHeader />

        <Divider />

        {/* 02 — Equipos */}
        <SectionTitle>02 — Equipos y Productos</SectionTitle>
        <ItemsTable />

        <Divider />

        {/* 03 — Descuentos generales */}
        <SectionTitle>03 — Descuentos & Recargos Generales</SectionTitle>
        <GeneralDiscounts />

        <Divider />

        {/* 04 — Condición de pago */}
        <SectionTitle>04 — Condición de Pago</SectionTitle>
        <PaymentConditions />

        <Divider />

        {/* 05 — Observaciones */}
        <SectionTitle>05 — Observaciones</SectionTitle>
        <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 sm:p-6 shadow-sm">
          <FieldGroup>
            <Label>Notas generales</Label>
            <Textarea
              rows={3}
              value={quote.notes ?? ''}
              onChange={e => setNotes(e.target.value)}
              placeholder="Incluye garantía, accesorios, condiciones especiales, etc."
            />
          </FieldGroup>
        </div>
      </div>

      {/* Desktop: Floating summary panel */}
      <div className="hidden lg:block fixed right-6 top-20 w-80 z-40 max-h-[calc(100vh-88px)] overflow-y-auto rounded-xl shadow-2xl ring-1 ring-black/5">
        <QuoteSummary />
      </div>

      {/* Mobile/tablet: sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[#94A3B8] uppercase tracking-wider font-semibold">Total cotización</div>
            <div className="text-[20px] font-bold text-[#22C55E] leading-tight tabular-nums">{sym(totals.total)}</div>
          </div>
          <button
            onClick={() => setShowMobileSummary(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1E2235] text-white text-[13px] font-semibold rounded-xl cursor-pointer"
          >
            <Receipt size={15} />
            Ver resumen
          </button>
        </div>
      </div>

      {/* Mobile: Summary sheet */}
      {showMobileSummary && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end" onClick={() => setShowMobileSummary(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-t-2xl max-h-[88vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] flex-shrink-0">
              <span className="text-[14px] font-semibold text-[#0F172A]">Resumen de cotización</span>
              <button onClick={() => setShowMobileSummary(false)} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">
                <X size={18} />
              </button>
            </div>
            {/* Sheet body */}
            <div className="overflow-y-auto flex-1 p-4">
              <QuoteSummary />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
