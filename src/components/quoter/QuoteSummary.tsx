import { useState, useEffect, useRef } from 'react'
import { useQuoteStore, computeTotals } from '@/store/quoteStore'
import { fmt, fmtCurrency } from '@/utils'
import { Printer, RotateCcw, Save, Loader2, MessageCircle, Mail, ChevronDown, ChevronUp, X, Share2, Copy, Check, Download, Link, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils'
import { downloadQuotePDF, buildQuotePDFFile, buildWhatsAppText, buildEmailSubject, buildEmailBody, uploadQuotePDF, type UploadResult } from '@/lib/pdf/QuotePDF'
import { useSaveQuote } from '@/hooks/useSupabase'
import { useClientStore } from '@/store/clientStore'
import { useCRMStore } from '@/store/crmStore'
import type { Quote, QuoteTotals } from '@/types'

// ─── Share Modal ─────────────────────────────────────────────────────────────

function ShareModal({ quote, totals, onClose, afterShare }: {
  quote: Quote; totals: QuoteTotals; onClose: () => void; afterShare: () => void
}) {
  const [status, setStatus] = useState<'preparing' | 'ready' | 'fallback'>('preparing')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [sharingNative, setSharingNative] = useState(false)
  const fileRef = useRef<File | null>(null)

  useEffect(() => {
    let cancelled = false
    async function prepare() {
      const file = await buildQuotePDFFile(quote)
      if (cancelled) return
      fileRef.current = file
      const result = await uploadQuotePDF(quote)
      if (cancelled) return
      setUploadResult(result)
      if (result.ok) {
        setShareUrl(result.url ?? null)
        setStatus('ready')
      } else {
        setStatus('fallback')
      }
    }
    prepare()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shortMsg = `Hola${quote.client.name ? ` ${quote.client.name}` : ''}, te envío la cotización ${quote.quote_number} de GEA Gergolet Agrícola.`

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // Compute href values reactively so they reflect the final shareUrl.
  // Using <a href> instead of window.open() avoids popup-blocker issues.
  const waPhone = quote.client.phone?.replace(/\D/g, '') ?? ''
  const waArg   = waPhone.startsWith('54') ? waPhone : waPhone ? `54${waPhone}` : ''
  const waText  = shareUrl
    ? `${shortMsg}\nDescargá el PDF desde este enlace:\n${shareUrl}`
    : buildWhatsAppText(quote, totals)
  const waHref  = waArg
    ? `https://wa.me/${waArg}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/?text=${encodeURIComponent(waText)}`

  const emailSubject = buildEmailSubject(quote)
  const emailBody    = shareUrl
    ? `${shortMsg}\n\nDescargá el PDF desde este enlace:\n${shareUrl}\n\n---\n${buildEmailBody(quote, totals)}`
    : buildEmailBody(quote, totals)
  const emailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(quote.client.email ?? '')}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`

  const handleDownload = async () => {
    if (!fileRef.current) return
    const url = URL.createObjectURL(fileRef.current)
    const a = document.createElement('a')
    a.href = url; a.download = fileRef.current.name
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleNativeShare = async () => {
    if (!fileRef.current) return
    setSharingNative(true)
    try {
      await navigator.share({
        files: [fileRef.current],
        title: buildEmailSubject(quote),
        text: shortMsg,
      })
      afterShare(); onClose()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {/* ignore */}
    } finally {
      setSharingNative(false)
    }
  }

  const canShareNative = status !== 'preparing'
    && typeof navigator.share === 'function'
    && !!navigator.canShare
    && fileRef.current !== null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-t-2xl sm:rounded-xl shadow-xl p-6 mx-0 sm:mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[14px] font-semibold text-[#0F172A]">Compartir cotización</div>
            <div className="text-[11px] text-[#94A3B8] font-mono">{quote.quote_number}</div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={16} /></button>
        </div>

        {/* Status / Link */}
        {status === 'preparing' && (
          <div className="flex items-center gap-2.5 px-3 py-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg mb-4">
            <Loader2 size={14} className="animate-spin text-[#64748B] shrink-0" />
            <span className="text-[12px] text-[#64748B]">Generando y subiendo PDF...</span>
          </div>
        )}

        {status === 'ready' && shareUrl && (
          <div className="mb-4">
            <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-1.5">Enlace directo al PDF</div>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F0FDF4] border border-[#22C55E]/30 rounded-lg">
              <Link size={12} className="text-[#22C55E] shrink-0" />
              <span className="text-[11px] text-[#16A34A] truncate flex-1 font-mono select-all">
                {shareUrl.replace('https://', '')}
              </span>
              <button
                onClick={handleCopy}
                className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A] hover:text-[#15803D] cursor-pointer transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1">Enlace permanente · El destinatario descarga sin necesidad de cuenta</p>
          </div>
        )}

        {status === 'fallback' && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FEF9EE] border border-[#F59E0B]/30 rounded-lg mb-4">
            <AlertTriangle size={13} className="text-[#D97706] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#92400E] space-y-1">
              {uploadResult && !uploadResult.ok && uploadResult.reason === 'bucket_missing' ? (
                <>
                  <p className="font-semibold">El storage de PDFs no está configurado.</p>
                  <p>En Supabase Dashboard → Storage → "New bucket", creá un bucket llamado <span className="font-mono font-bold">quote-pdfs</span> (privado). Después los enlaces funcionarán automáticamente.</p>
                </>
              ) : uploadResult && !uploadResult.ok && uploadResult.reason === 'auth' ? (
                <p>Sesión expirada. Cerrá sesión y volvé a ingresar.</p>
              ) : (
                <>
                  <p>No se pudo generar el enlace. Descargá el PDF y adjuntalo manualmente.</p>
                  {uploadResult && !uploadResult.ok && (
                    <p className="font-mono text-[10px] opacity-70 break-all">{uploadResult.detail}</p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {/* Native share — best on mobile */}
          {canShareNative && (
            <button
              onClick={handleNativeShare}
              disabled={sharingNative}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-[13px] font-medium hover:bg-[#1E293B] transition-colors cursor-pointer disabled:opacity-50"
            >
              {sharingNative ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              Compartir archivo (adjunto)
            </button>
          )}

          {/* Copy link — primary CTA when link available */}
          {status === 'ready' && shareUrl && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#16A34A] text-[13px] font-semibold hover:bg-[#22C55E]/20 transition-colors cursor-pointer"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Enlace copiado' : 'Copiar enlace'}
            </button>
          )}

          {/* WhatsApp + Email — rendered as <a> to avoid popup-blocker */}
          {status !== 'preparing' && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { afterShare(); onClose() }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-[12px] font-medium hover:bg-[#25D366]/20 transition-colors cursor-pointer no-underline"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
              <a
                href={emailHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { afterShare(); onClose() }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/30 text-[#3B82F6] text-[12px] font-medium hover:bg-[#3B82F6]/20 transition-colors cursor-pointer no-underline"
              >
                <Mail size={13} />
                Email
              </a>
            </div>
          )}

          {/* Download — always available (not just fallback) */}
          <button
            onClick={handleDownload}
            disabled={status === 'preparing'}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-[#E2E8F0] text-[#64748B] text-[12px] font-medium hover:border-[#94A3B8] transition-colors cursor-pointer bg-white disabled:opacity-50"
          >
            <Download size={14} />
            Descargar PDF
          </button>
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
  const arsVal = (n: number) => `$ ${fmt(n)}`
  const usdSec = (n: number) => exchange_rate > 0 ? `U$S ${fmt(n / exchange_rate)}` : ''
  const [pdfLoading, setPdfLoading] = useState(false)
  const [collapsed, setCollapsed]   = useState(false)
  const [showShare, setShowShare]   = useState(false)
  const saveQuote = useSaveQuote()
  const { upsertFromQuote } = useClientStore()
  const { addFollowUp, sellerEmail } = useCRMStore()

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
    const today = new Date().toISOString().split('T')[0]
    // Save client to CRM
    if (quote.client?.name?.trim()) {
      upsertFromQuote({
        ...quote.client,
        name: quote.client.name,
        quote_number: quote.quote_number,
        quote_date: today,
      })
    }
    // Auto-create follow-up in 5 days (no modal)
    if (quote.client?.name?.trim()) {
      const followUpDate = new Date()
      followUpDate.setDate(followUpDate.getDate() + 5)
      addFollowUp({
        quote_id: quote.quote_number,
        quote_number: quote.quote_number,
        client_name: quote.client.name,
        client_phone: quote.client.phone,
        client_email: quote.client.email,
        seller_email: sellerEmail || undefined,
        scheduled_date: followUpDate.toISOString().split('T')[0],
        reminder_days: 5,
        notes: `Seguimiento post-envío — ${quote.quote_number}`,
        status: 'pending',
        sent_at: today,
      })
    }
  }

  return (
    <>
    {showShare && (
      <ShareModal
        quote={{ ...quote, totals } as any}
        totals={totals}
        onClose={() => setShowShare(false)}
        afterShare={afterShare}
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
          {totals.total > 0 && currency === 'USD' && exchange_rate > 0 && (
            <span className="text-[11px] text-white/50 font-mono leading-none">
              ≈ {usdSec(totals.total)} · TC $ {fmt(exchange_rate)}
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
                  {currency === 'USD' && exchange_rate > 0 && (
                    <div className="text-[11px] text-[#94A3B8] font-mono">≈ {usdSec(totals.total)} · TC {exchange_rate.toLocaleString('es-AR')}</div>
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
            <div className="grid grid-cols-2 gap-2">
              <Button variant="primary" className="flex items-center justify-center gap-2"
                onClick={handlePDF} disabled={pdfLoading || !hasItems}>
                {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                {pdfLoading ? 'Generando...' : 'PDF'}
              </Button>
              <button
                onClick={() => setShowShare(true)}
                disabled={!hasItems}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-[13px] font-semibold transition-all cursor-pointer',
                  hasItems
                    ? 'bg-[#0F172A] border-[#0F172A] text-white hover:bg-[#1E293B]'
                    : 'opacity-40 border-[#E2E8F0] text-[#94A3B8] cursor-not-allowed'
                )}
              >
                <Share2 size={14} />
                Compartir
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
