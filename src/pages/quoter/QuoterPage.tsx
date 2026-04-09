import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { QuoteHeader } from '@/components/quoter/QuoteHeader'
import { ItemsTable, GeneralDiscounts } from '@/components/quoter/ItemsTable'
import { PaymentConditions } from '@/components/payment/PaymentConditions'
import { QuoteSummary } from '@/components/quoter/QuoteSummary'
import { Divider, SectionTitle, Textarea, FieldGroup, Label, Badge } from '@/components/ui'
import { useQuoteStore, computeTotals } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'
import { fmtCurrency, fmt } from '@/utils'
import { X, Receipt, Package, CheckCircle2, ChevronDown, ChevronUp, CreditCard, Tag } from 'lucide-react'
import type { PriceList, PaymentConditionTemplate } from '@/types'

// ─── Payment mode icons & labels ─────────────────────────────────────────────

const MODE_META: Record<string, { icon: string; color: string; bg: string }> = {
  contado:    { icon: '💵', color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4] border-[#22C55E]/30' },
  cheques:    { icon: '🧾', color: 'text-[#92400E]', bg: 'bg-[#FFFBEB] border-[#F59E0B]/30' },
  financiado: { icon: '🏦', color: 'text-[#1D4ED8]', bg: 'bg-[#EFF6FF] border-[#93C5FD]/50' },
  leasing:    { icon: '📋', color: 'text-[#6D28D9]', bg: 'bg-[#F5F3FF] border-[#C4B5FD]/50' },
}

// ─── List + payment config panel ─────────────────────────────────────────────

function ListPicker({
  activePriceListId,
  activeTemplateId,
  onSelect,
  onClear,
}: {
  activePriceListId: string | null
  activeTemplateId: string | null
  onSelect: (pl: PriceList, template?: PaymentConditionTemplate) => void
  onClear: () => void
}) {
  const { priceLists, getProductsByList } = useCatalogStore()
  const [open, setOpen] = useState(false)
  // locally track which list is being previewed before confirming
  const [pendingListId, setPendingListId] = useState<string | null>(activePriceListId)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(activeTemplateId)

  const activeList = priceLists.find(pl => pl.id === activePriceListId)
  const activeTemplate = activeList?.payment_conditions?.find(t => t.id === activeTemplateId)
  const pendingList = priceLists.find(pl => pl.id === pendingListId)
  const pendingConditions = pendingList?.payment_conditions ?? []

  if (priceLists.length === 0) return null

  function handleOpen() {
    setPendingListId(activePriceListId)
    setPendingTemplateId(activeTemplateId)
    setOpen(true)
  }

  function handleConfirm() {
    if (!pendingList) return
    const template = pendingConditions.find(t => t.id === pendingTemplateId)
    onSelect(pendingList, template)
    setOpen(false)
  }

  function handleClear() {
    onClear()
    setPendingListId(null)
    setPendingTemplateId(null)
  }

  const modeMeta = activeTemplate ? (MODE_META[activeTemplate.condition.mode] ?? MODE_META.contado) : null

  return (
    <div className="mb-6">
      {/* ── Collapsed summary bar ── */}
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
            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[#0F172A]">{activeList.brand}</span>
                <span className="text-[12px] text-[#64748B]">{activeList.name}</span>
                <Badge variant="acero">{activeList.currency}</Badge>
              </div>
              {activeTemplate && modeMeta && (
                <>
                  <span className="text-[#CBD5E1]">·</span>
                  <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${modeMeta.bg} ${modeMeta.color}`}>
                    <span>{modeMeta.icon}</span>
                    <span>{activeTemplate.label}</span>
                    {activeTemplate.condition.discount_pct ? <span>· {activeTemplate.condition.discount_pct}%</span> : null}
                  </div>
                </>
              )}
              {!activeTemplate && (
                <span className="text-[11px] text-[#94A3B8] italic">sin condición de pago</span>
              )}
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
              >
                <X size={13} />
              </button>
            )}
            <span className="text-[11px] text-[#94A3B8] group-hover:text-[#22C55E] transition-colors flex items-center gap-1 font-medium">
              {activeList ? 'Cambiar' : 'Seleccionar'}
              <ChevronDown size={12} />
            </span>
          </div>
        </div>
      )}

      {/* ── Expanded picker panel ── */}
      {open && (
        <div className="rounded-xl border border-[#22C55E]/30 bg-white shadow-md overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#F0FDF4] border-b border-[#22C55E]/20">
            <div className="flex items-center gap-2">
              <Package size={14} className="text-[#22C55E]" />
              <span className="text-[12px] font-semibold text-[#16A34A] uppercase tracking-wider">Configurar cotización</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer transition-colors">
              <ChevronUp size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Step 1 — Lista */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-[#1E2235] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white">1</span>
                </div>
                <span className="text-[13px] font-semibold text-[#0F172A]">Lista de precios</span>
                {pendingList && <CheckCircle2 size={14} className="text-[#22C55E]" />}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {priceLists.map(pl => {
                  const count = getProductsByList(pl.id).length
                  const condCount = pl.payment_conditions?.length ?? 0
                  const isSelected = pendingListId === pl.id
                  return (
                    <button
                      key={pl.id}
                      onClick={() => {
                        setPendingListId(pl.id)
                        setPendingTemplateId(null) // reset payment when changing list
                      }}
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
                            {condCount > 0 && (
                              <span className="text-[10px] text-[#94A3B8]">· {condCount} cond.</span>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <CheckCircle2 size={16} className="text-[#22C55E] shrink-0 mt-0.5" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2 — Condición de pago (only if selected list has conditions) */}
            {pendingList && pendingConditions.length > 0 && (
              <div className="border-t border-[#F1F5F9] pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${pendingTemplateId ? 'bg-[#22C55E]' : 'bg-[#1E2235]'}`}>
                    <span className="text-[10px] font-bold text-white">2</span>
                  </div>
                  <span className="text-[13px] font-semibold text-[#0F172A]">Condición de pago</span>
                  {pendingTemplateId && <CheckCircle2 size={14} className="text-[#22C55E]" />}
                  <span className="text-[11px] text-[#94A3B8] ml-1">(opcional)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pendingConditions.map(t => {
                    const meta = MODE_META[t.condition.mode] ?? MODE_META.contado
                    const isSelected = pendingTemplateId === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setPendingTemplateId(isSelected ? null : t.id)}
                        className={`text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#22C55E] bg-[#F0FDF4] shadow-sm'
                            : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#22C55E]/40 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 border ${meta.bg}`}>
                            {meta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-[#0F172A] truncate">{t.label}</div>
                            <div className={`text-[11px] font-medium capitalize mt-0.5 ${meta.color}`}>
                              {t.condition.mode}
                              {t.condition.discount_pct ? ` · ${t.condition.discount_pct}% desc.` : ''}
                              {t.condition.num_checks ? ` · ${t.condition.num_checks} cheques` : ''}
                              {t.condition.installments ? ` · ${t.condition.installments} cuotas` : ''}
                            </div>
                          </div>
                          {isSelected && <CheckCircle2 size={16} className="text-[#22C55E] shrink-0" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Confirm button */}
            <div className="flex items-center gap-3 pt-1 border-t border-[#F1F5F9]">
              <button
                onClick={handleConfirm}
                disabled={!pendingListId}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22C55E] text-white text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-[#16A34A] transition-colors shadow-sm shadow-[#22C55E]/20"
              >
                <CheckCircle2 size={14} />
                {activePriceListId ? 'Actualizar selección' : 'Confirmar selección'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2.5 rounded-xl text-[13px] font-medium text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              {!pendingListId && (
                <span className="text-[11px] text-[#94A3B8] ml-auto">Seleccioná una lista para continuar</span>
              )}
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
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader title="Nueva Cotización" subtitle={quote.quote_number} />

      <div className="p-4 sm:p-6 md:p-8 lg:pr-[352px]">

        {/* List + payment picker — optional, collapsible */}
        <ListPicker
          activePriceListId={activePriceListId}
          activeTemplateId={activeTemplateId}
          onSelect={(pl, template) => {
            initFromPriceList(pl.id, template)
            setActivePriceListId(pl.id)
            setActiveTemplateId(template?.id ?? null)
          }}
          onClear={() => { setActivePriceListId(null); setActiveTemplateId(null) }}
        />

        {/* 01 — Datos */}
        <SectionTitle>01 — Datos de la Cotización</SectionTitle>
        <QuoteHeader />

        <Divider />

        {/* 02 — Equipos */}
        <SectionTitle>02 — Equipos y Productos</SectionTitle>
        <ItemsTable priceListId={activePriceListId} />

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
