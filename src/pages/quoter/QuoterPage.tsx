import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { QuoteHeader } from '@/components/quoter/QuoteHeader'
import { ItemsTable } from '@/components/quoter/ItemsTable'
import { PaymentConditions } from '@/components/payment/PaymentConditions'
import { QuoteSummary } from '@/components/quoter/QuoteSummary'
import { UpgradePrompt } from '@/components/plan/UpgradePrompt'
import { Divider, SectionTitle, Textarea, FieldGroup, Label, Badge } from '@/components/ui'

import { useQuoteStore, computeTotals } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'
import { useSavedQuotesStore } from '@/store/savedQuotesStore'
import { useSubscriptionStore, checkPlanGate } from '@/store/subscriptionStore'
import { fmtCurrency, fmt } from '@/utils'
import { X, Receipt, Package, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import type { PriceList } from '@/types'

// ─── List picker ─────────────────────────────────────────────────────────────

function ListPicker({
  activePriceListId,
  onSelect,
  onClear,
}: {
  activePriceListId: string | null
  onSelect: (pl: PriceList) => void
  onClear: () => void
}) {
  const { priceLists, getProductsByList } = useCatalogStore()
  const [open, setOpen] = useState(false)
  const [pendingListId, setPendingListId] = useState<string | null>(activePriceListId)

  const activeList  = priceLists.find(pl => pl.id === activePriceListId)
  const pendingList = priceLists.find(pl => pl.id === pendingListId)

  if (priceLists.length === 0) return null

  function handleOpen() {
    setPendingListId(activePriceListId)
    setOpen(true)
  }

  function handleConfirm() {
    if (!pendingList) return
    onSelect(pendingList)
    setOpen(false)
  }

  function handleClear() {
    onClear()
    setPendingListId(null)
  }

  return (
    <div className="mb-6">
      {/* ── Collapsed bar ── */}
      {!open && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all group ${
            activeList
              ? 'bg-white border-[#E2E8F0] hover:border-[#22C55E]/40'
              : 'bg-[#F8FAFC] border-dashed border-[#CBD5E1] hover:border-[#22C55E]/50 hover:bg-white'
          }`}
          onClick={handleOpen}
        >
          <Package size={15} className={activeList ? 'text-[#22C55E] shrink-0' : 'text-[#94A3B8] shrink-0'} />

          {activeList ? (
            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold text-[#0F172A]">{activeList.brand}</span>
              <span className="text-[12px] text-[#64748B]">{activeList.name}</span>
              <Badge variant="acero">{activeList.currency}</Badge>
              <span className="text-[11px] text-[#94A3B8]">
                · {getProductsByList(activeList.id).length} prod.
                {(activeList.payment_conditions?.length ?? 0) > 0
                  ? ` · ${activeList.payment_conditions!.length} condiciones`
                  : ''}
              </span>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <span className="text-[13px] text-[#94A3B8]">Sin lista seleccionada</span>
              <span className="text-[12px] text-[#CBD5E1] ml-2">— los precios se ingresan manualmente</span>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {activeList && (
              <button
                onClick={e => { e.stopPropagation(); handleClear() }}
                className="text-[#CBD5E1] hover:text-[#EF4444] transition-colors cursor-pointer p-0.5 rounded"
                title="Quitar lista"
              ><X size={13} /></button>
            )}
            <span className="text-[11px] text-[#94A3B8] group-hover:text-[#22C55E] transition-colors flex items-center gap-1 font-medium">
              {activeList ? 'Cambiar' : 'Seleccionar'}<ChevronDown size={12} />
            </span>
          </div>
        </div>
      )}

      {/* ── Expanded picker ── */}
      {open && (
        <div className="rounded-xl border border-[#22C55E]/30 bg-white shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#F0FDF4] border-b border-[#22C55E]/20">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-[#22C55E]" />
              <span className="text-[12px] font-semibold text-[#16A34A] uppercase tracking-wider">Seleccionar lista de precios</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer transition-colors">
              <ChevronUp size={16} />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {priceLists.map(pl => {
                const count     = getProductsByList(pl.id).length
                const condCount = pl.payment_conditions?.length ?? 0
                const isSelected = pendingListId === pl.id
                return (
                  <button
                    key={pl.id}
                    onClick={() => setPendingListId(pl.id)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#22C55E] bg-[#F0FDF4] shadow-sm'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#22C55E]/40 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Package size={12} className={isSelected ? 'text-[#22C55E]' : 'text-[#94A3B8]'} />
                          <span className="text-[13px] font-semibold text-[#0F172A] truncate">{pl.brand}</span>
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate pl-[20px]">{pl.name}</div>
                        <div className="flex items-center gap-2 mt-1.5 pl-[20px]">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-[#22C55E]/15 text-[#16A34A]' : 'bg-[#F1F5F9] text-[#94A3B8]'
                          }`}>{pl.currency}</span>
                          <span className="text-[10px] text-[#94A3B8]">{count} prod.</span>
                          {condCount > 0 && <span className="text-[10px] text-[#94A3B8]">· {condCount} cond.</span>}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 size={16} className="text-[#22C55E] shrink-0 mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-1 border-t border-[#F1F5F9]">
              <button
                onClick={handleConfirm}
                disabled={!pendingListId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E] text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-[#16A34A] transition-colors shadow-sm shadow-[#22C55E]/20"
              >
                <CheckCircle2 size={14} />
                {activePriceListId ? 'Actualizar lista' : 'Confirmar selección'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main QuoterPage ──────────────────────────────────────────────────────────

export function QuoterPage() {
  const { quote, setNotes, initFromPriceList } = useQuoteStore()
  const totals = computeTotals(quote)
  const sym = (n: number) => fmtCurrency(n, quote.currency)
  const [showMobileSummary, setShowMobileSummary] = useState(false)
  const [activePriceListId, setActivePriceListId] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const { plan, isActive } = useSubscriptionStore()
  const { quotes } = useSavedQuotesStore()
  const thisMonth = new Date().toISOString().slice(0, 7)
  const quotesThisMonth = quotes.filter(q => q.created_at.startsWith(thisMonth)).length
  const gate = checkPlanGate('quote', plan, isActive, { quotesThisMonth, priceListCount: 0 })

  if (!gate.allowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <UpgradePrompt reason={gate.reason as 'quotes' | 'expired'} onClose={() => window.history.back()} />
      </div>
    )
  }

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader title="Nueva Cotización" subtitle={quote.quote_number} />

      <div className="p-4 sm:p-6 md:p-8 lg:pr-[352px]">

        {/* List picker */}
        <ListPicker
          activePriceListId={activePriceListId}
          onSelect={(pl) => {
            initFromPriceList(pl.id, undefined, pl.currency)
            setActivePriceListId(pl.id)
          }}
          onClear={() => setActivePriceListId(null)}
        />

        {/* 01 — Datos */}
        <SectionTitle>01 — Datos de la Cotización</SectionTitle>
        <QuoteHeader />

        <Divider />

        {/* 02 — Equipos */}
        <SectionTitle>02 — Equipos y Productos</SectionTitle>
        <ItemsTable priceListId={activePriceListId} />

        <Divider />

        {/* 03 — Condición de pago + Descuentos */}
        <SectionTitle>03 — Condición de Pago</SectionTitle>
        <PaymentConditions priceListId={activePriceListId} />

        <Divider />

        {/* 04 — Observaciones */}
        <SectionTitle>04 — Observaciones</SectionTitle>
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
          <div className="relative bg-white rounded-t-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] flex-shrink-0">
              <span className="text-[14px] font-semibold text-[#0F172A]">Resumen de cotización</span>
              <button onClick={() => setShowMobileSummary(false)} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <QuoteSummary />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
