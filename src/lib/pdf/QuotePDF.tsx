import {
  Document, Page, Text, View, StyleSheet, pdf,
} from '@react-pdf/renderer'
import type { Quote, QuoteTotals } from '@/types'
import { computeTotals } from '@/store/quoteStore'
import { fmt, fmtDate } from '@/utils'
import { GEA_PAYMENT_CONDITIONS } from '@/data/gea'
import { supabase } from '@/lib/supabase/client'

// ─── Payment comparison helper ────────────────────────────────

interface PaymentOption {
  label: string
  discount: number
  detail: string
  total: number
  total_ars: number
}

export function computePaymentOptions(quote: Quote): PaymentOption[] {
  const CONDITIONS = [
    { label: 'Contado',           discount: 20, detail: 'Transferencia / E.Cheq mismo día',    mode: 'contado'  as const },
    { label: '3 valores',         discount: 15, detail: 'E.Cheq 0-30-60 días',                  mode: 'cheques'  as const },
    { label: '7 valores',         discount: 8,  detail: 'E.Cheq 0-30-...-180 días',             mode: 'cheques'  as const },
    { label: '10 valores',        discount: 3,  detail: 'E.Cheq 0-30-...-270 días',             mode: 'cheques'  as const },
    { label: '12 valores s/int.', discount: 0,  detail: 'E.Cheq 0-30-...-330 días, sin interés', mode: 'cheques' as const },
  ]
  return CONDITIONS.map(c => {
    const t = computeTotals({ ...quote, payment: { ...quote.payment, mode: c.mode, discount_pct: c.discount } })
    return { ...c, total: t.total, total_ars: t.total * quote.exchange_rate }
  })
}

// ─── WhatsApp & Email helpers ─────────────────────────────────

export function buildWhatsAppText(quote: Quote, totals: QuoteTotals): string {
  const arsDisplay = (usd: number) => `$ ${fmt(Math.round(usd * quote.exchange_rate))}`
  const usdDisplay = (usd: number) => `U$S ${fmt(usd)}`
  const validUntil = new Date(quote.created_at)
  validUntil.setDate(validUntil.getDate() + quote.valid_days)

  const options = computePaymentOptions(quote)

  const lines: string[] = [
    '🌾 *GEA Gergolet Agrícola*',
    `Cotización N° ${quote.quote_number}`,
    `📅 Válida hasta: ${validUntil.toLocaleDateString('es-AR')}`,
    '',
  ]

  if (quote.client.name) {
    lines.push(`👤 *Cliente:* ${quote.client.name}`)
    if (quote.client.province) lines.push(`📍 ${quote.client.province}${quote.client.city ? ` · ${quote.client.city}` : ''}`)
    lines.push('')
  }

  if (quote.items.length > 0) {
    lines.push('*Equipos cotizados:*')
    quote.items.forEach(item => {
      lines.push(`• ${item.description} — ${arsDisplay(item.unit_price)}${item.quantity > 1 ? ` × ${item.quantity}` : ''}`)
    })
    lines.push('')
  }

  lines.push('*Condiciones de pago:*')
  options.forEach((opt, i) => {
    const icon = i === 0 ? '✅' : '📋'
    const desc = opt.discount > 0 ? ` (${opt.discount}% dto)` : ''
    lines.push(`${icon} ${opt.label}${desc}: ${arsDisplay(opt.total)} (${usdDisplay(opt.total)})`)
  })

  lines.push(`_TC: $${quote.exchange_rate.toLocaleString('es-AR')} Dólar BNA vendedor_`)

  lines.push('')
  lines.push('Consultas: consultas@gergolet.com.ar')

  return lines.join('\n')
}

export function buildEmailSubject(quote: Quote): string {
  return `Cotización GEA — ${quote.quote_number}${quote.client.name ? ` — ${quote.client.name}` : ''}`
}

export function buildEmailBody(quote: Quote, totals: QuoteTotals): string {
  const text = buildWhatsAppText(quote, totals)
  // Strip markdown bold for plain email
  return text.replace(/\*/g, '')
}

// ─── Styles ───────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#2C3E50',
    paddingTop: 32,
    paddingBottom: 40,
    paddingHorizontal: 36,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#C8952A',
  },
  logoText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#3D2B1F' },
  logoAccent: { color: '#C8952A' },
  logoSub: { fontSize: 7, color: '#4A6741', letterSpacing: 2, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  cotNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#C8952A' },
  cotDate: { fontSize: 8, color: '#8B9BAA', marginTop: 2 },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#4A6741', borderRadius: 2 },
  badgeText: { fontSize: 7, color: '#FFFFFF', letterSpacing: 1 },

  grid2: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  col: { flex: 1 },

  card: { padding: 12, borderWidth: 1, borderColor: '#E8DCC8', borderRadius: 3, backgroundColor: '#FDFAF4' },
  cardTitle: { fontSize: 7, letterSpacing: 2, color: '#8B9BAA', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: '#8B9BAA', fontSize: 8 },
  value: { color: '#2C3E50', fontSize: 8, fontFamily: 'Helvetica-Bold' },

  sectionTitle: {
    fontSize: 8, letterSpacing: 3, color: '#C8952A',
    textTransform: 'uppercase', fontFamily: 'Helvetica-Bold',
    marginBottom: 8, marginTop: 16,
    borderBottomWidth: 1, borderBottomColor: '#C8952A',
    paddingBottom: 3,
  },

  tableHeader: { flexDirection: 'row', backgroundColor: '#4A6741', padding: 6, borderRadius: 2, marginBottom: 1 },
  tableHeaderText: { color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  tableRow: { flexDirection: 'row', padding: 5, borderBottomWidth: 1, borderBottomColor: '#F0EAD8' },
  tableRowAlt: { backgroundColor: '#FDFAF4' },
  tableCell: { fontSize: 8, color: '#2C3E50' },
  tableCellRight: { fontSize: 8, color: '#2C3E50', textAlign: 'right' },
  tableCellTrigo: { fontSize: 8, color: '#C8952A', fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  totalsBox: {
    marginTop: 12, padding: 12,
    backgroundColor: '#F5EDD8', borderWidth: 1, borderColor: '#C8952A', borderRadius: 3,
    alignSelf: 'flex-end', width: 220,
  },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { fontSize: 8, color: '#8B9BAA' },
  totalValue: { fontSize: 8, color: '#2C3E50' },
  grandTotalLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 6, paddingTop: 6,
    borderTopWidth: 1.5, borderTopColor: '#C8952A',
  },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#3D2B1F' },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#C8952A' },

  paymentBox: { padding: 10, backgroundColor: '#F0F7EE', borderWidth: 1, borderColor: '#4A6741', borderRadius: 3, marginTop: 10 },
  paymentTitle: { fontSize: 8, color: '#4A6741', fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  // Payment comparison table
  cmpHeader: { flexDirection: 'row', backgroundColor: '#3D2B1F', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 2, marginBottom: 1 },
  cmpHeaderText: { color: '#F5EDD8', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  cmpRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#EDE0C8' },
  cmpRowHighlight: { backgroundColor: '#FFF8EC' },
  cmpCell: { fontSize: 8, color: '#2C3E50' },
  cmpCellGold: { fontSize: 9, color: '#C8952A', fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cmpCellGray: { fontSize: 7, color: '#8B9BAA', textAlign: 'right' },
  cmpDiscount: { fontSize: 8, color: '#4A6741', fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#E8DCC8', paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#8B9BAA' },

  notesBox: { padding: 10, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E0D8C8', borderRadius: 3, marginTop: 10 },
  notesText: { fontSize: 8, color: '#5A5A5A', lineHeight: 1.5 },
})

// ─── Helpers ──────────────────────────────────────────────────

const sym = (n: number, currency: 'USD' | 'ARS') =>
  (currency === 'USD' ? 'U$S ' : '$ ') + fmt(n)

const PAYMENT_LABEL: Record<string, string> = {
  contado: 'Contado',
  cheques: 'Cheques diferidos',
  financiado: 'Financiado',
  leasing: 'Leasing',
}

// ─── PDF Document ─────────────────────────────────────────────

function QuotePDF({ quote, totals }: { quote: Quote; totals: QuoteTotals }) {
  const { client, currency, payment, taxes, delivery } = quote
  const ars = (usd: number) => `$ ${fmt(Math.round(usd * quote.exchange_rate))}`
  const usd = (n: number) => `U$S ${fmt(n)}`
  const validUntil = new Date(quote.created_at)
  validUntil.setDate(validUntil.getDate() + quote.valid_days)

  const paymentOptions = computePaymentOptions(quote)

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            <Text style={S.logoText}>Agro<Text style={S.logoAccent}>Cotizar</Text></Text>
            <Text style={S.logoSub}>MAQUINARIA AGRÍCOLA · ARGENTINA</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.cotNumber}>{quote.quote_number}</Text>
            <Text style={S.cotDate}>Fecha: {fmtDate(quote.created_at)}</Text>
            <Text style={S.cotDate}>Válida hasta: {validUntil.toLocaleDateString('es-AR')}</Text>
            <View style={S.badge}><Text style={S.badgeText}>GEA · GERGOLET AGRÍCOLA</Text></View>
          </View>
        </View>

        {/* ── Client + Payment info ── */}
        <View style={S.grid2}>
          <View style={[S.card, S.col]}>
            <Text style={S.cardTitle}>Cliente</Text>
            <View style={S.row}><Text style={S.label}>Razón Social</Text><Text style={S.value}>{client.name || '—'}</Text></View>
            {client.cuit && <View style={S.row}><Text style={S.label}>CUIT</Text><Text style={S.value}>{client.cuit}</Text></View>}
            {client.province && <View style={S.row}><Text style={S.label}>Provincia</Text><Text style={S.value}>{client.province}{client.city ? ` · ${client.city}` : ''}</Text></View>}
            {client.phone && <View style={S.row}><Text style={S.label}>Teléfono</Text><Text style={S.value}>{client.phone}</Text></View>}
            {client.email && <View style={S.row}><Text style={S.label}>Email</Text><Text style={S.value}>{client.email}</Text></View>}
          </View>
          <View style={[S.card, S.col]}>
            <Text style={S.cardTitle}>Condición de Pago Seleccionada</Text>
            <View style={S.row}><Text style={S.label}>Modalidad</Text><Text style={S.value}>{PAYMENT_LABEL[payment.mode]}</Text></View>
            {payment.discount_pct! > 0 && <View style={S.row}><Text style={S.label}>Descuento</Text><Text style={S.value}>{payment.discount_pct}%</Text></View>}
            {payment.mode === 'cheques' && payment.num_checks && <View style={S.row}><Text style={S.label}>Valores</Text><Text style={S.value}>{payment.num_checks} cheques diferidos</Text></View>}
            {payment.mode === 'financiado' && <>
              <View style={S.row}><Text style={S.label}>Anticipo</Text><Text style={S.value}>{payment.deposit_pct}%</Text></View>
              <View style={S.row}><Text style={S.label}>Cuotas</Text><Text style={S.value}>{payment.installments} × {ars(totals.installment_amount ?? 0)}/mes</Text></View>
              {payment.financial_entity && <View style={S.row}><Text style={S.label}>Entidad</Text><Text style={S.value}>{payment.financial_entity}</Text></View>}
            </>}
            {payment.mode === 'leasing' && <>
              <View style={S.row}><Text style={S.label}>Plazo</Text><Text style={S.value}>{payment.lease_term_months} meses</Text></View>
              <View style={S.row}><Text style={S.label}>Canon</Text><Text style={S.value}>{ars(totals.installment_amount ?? 0)}/mes</Text></View>
            </>}
            <View style={S.row}><Text style={S.label}>Entrega</Text><Text style={S.value}>{delivery.location === 'planta' ? 'En planta' : delivery.location === 'campo' ? 'En campo' : 'A acordar'}</Text></View>
            {delivery.estimated_days && <View style={S.row}><Text style={S.label}>Plazo</Text><Text style={S.value}>{delivery.estimated_days}</Text></View>}
          </View>
        </View>

        {/* ── Items table ── */}
        <Text style={S.sectionTitle}>EQUIPOS Y PRODUCTOS</Text>
        <View style={S.tableHeader}>
          <Text style={[S.tableHeaderText, { flex: 3 }]}>DESCRIPCIÓN</Text>
          <Text style={[S.tableHeaderText, { flex: 1 }]}>CATEGORÍA</Text>
          <Text style={[S.tableHeaderText, { width: 35, textAlign: 'center' }]}>CANT</Text>
          <Text style={[S.tableHeaderText, { width: 70, textAlign: 'right' }]}>P. UNIT.</Text>
          <Text style={[S.tableHeaderText, { width: 40, textAlign: 'center' }]}>DESC</Text>
          <Text style={[S.tableHeaderText, { width: 75, textAlign: 'right' }]}>SUBTOTAL</Text>
        </View>
        {quote.items.map((item, i) => {
          const sub = item.unit_price * item.quantity * (1 - item.discount_pct / 100)
          return (
            <View key={item.id} style={[S.tableRow, i % 2 === 1 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 3 }]}>{item.description}</Text>
              <Text style={[S.tableCell, { flex: 1, color: '#8B9BAA' }]}>{item.category}</Text>
              <Text style={[S.tableCellRight, { width: 35 }]}>{item.quantity}</Text>
              <Text style={[S.tableCellRight, { width: 70 }]}>{ars(item.unit_price)}</Text>
              <Text style={[S.tableCellRight, { width: 40, color: item.discount_pct > 0 ? '#C0392B' : '#8B9BAA' }]}>
                {item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}
              </Text>
              <Text style={[S.tableCellTrigo, { width: 75 }]}>{ars(sub)}</Text>
            </View>
          )
        })}

        {/* ── Totals ── */}
        <View style={S.totalsBox}>
          {totals.item_discounts > 0 && (
            <><View style={S.totalLine}><Text style={S.totalLabel}>Subtotal bruto</Text><Text style={S.totalValue}>{ars(totals.gross)}</Text></View>
              <View style={S.totalLine}><Text style={S.totalLabel}>Desc. por ítem</Text><Text style={[S.totalValue, { color: '#C0392B' }]}>– {ars(totals.item_discounts)}</Text></View></>
          )}
          {totals.general_discounts > 0 && (
            <View style={S.totalLine}><Text style={S.totalLabel}>Desc. generales</Text><Text style={[S.totalValue, { color: '#C0392B' }]}>– {ars(totals.general_discounts)}</Text></View>
          )}
          {totals.payment_discount > 0 && (
            <View style={S.totalLine}><Text style={S.totalLabel}>Desc. {PAYMENT_LABEL[payment.mode]}</Text><Text style={[S.totalValue, { color: '#C0392B' }]}>– {ars(totals.payment_discount)}</Text></View>
          )}
          {totals.freight > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>Flete</Text><Text style={S.totalValue}>{ars(totals.freight)}</Text></View>}
          {totals.iibb > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>IIBB</Text><Text style={S.totalValue}>{ars(totals.iibb)}</Text></View>}
          {totals.iva > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>IVA ({taxes.iva_pct}%)</Text><Text style={S.totalValue}>{ars(totals.iva)}</Text></View>}
          <View style={S.grandTotalLine}>
            <Text style={S.grandLabel}>TOTAL</Text>
            <Text style={S.grandValue}>{ars(totals.total)}</Text>
          </View>
          <View style={[S.totalLine, { marginTop: 4 }]}>
            <Text style={[S.totalLabel, { fontSize: 7 }]}>Equivalente USD (TC ${quote.exchange_rate.toLocaleString('es-AR')})</Text>
            <Text style={[S.totalValue, { fontSize: 7 }]}>{usd(totals.total)}</Text>
          </View>
        </View>

        {/* ── Financing simulation ── */}
        {(payment.mode === 'financiado' || payment.mode === 'leasing') && totals.installment_amount && (
          <View style={S.paymentBox}>
            <Text style={S.paymentTitle}>SIMULACIÓN DE {payment.mode === 'leasing' ? 'LEASING' : 'FINANCIAMIENTO'}</Text>
            {payment.mode === 'financiado' && totals.deposit !== undefined && (
              <View>
                <View style={S.totalLine}><Text style={S.totalLabel}>Anticipo ({payment.deposit_pct}%)</Text><Text style={S.totalValue}>{ars(totals.deposit)}</Text></View>
                <View style={S.totalLine}><Text style={S.totalLabel}>{payment.installments} cuotas de</Text><Text style={[S.totalValue, { color: '#4A6741' }]}>{ars(totals.installment_amount)}/mes</Text></View>
                {totals.total_financed && <View style={S.totalLine}><Text style={S.totalLabel}>Total financiado</Text><Text style={S.totalValue}>{ars(totals.total_financed)}</Text></View>}
              </View>
            )}
            {payment.mode === 'leasing' && (
              <View>
                <View style={S.totalLine}><Text style={S.totalLabel}>{payment.lease_term_months} cánones de</Text><Text style={[S.totalValue, { color: '#4A6741' }]}>{ars(totals.installment_amount)}/mes</Text></View>
                <View style={S.totalLine}><Text style={S.totalLabel}>Opción de compra ({payment.buyout_pct}%)</Text><Text style={S.totalValue}>{ars(totals.total * (payment.buyout_pct ?? 10) / 100)}</Text></View>
                {totals.total_financed && <View style={S.totalLine}><Text style={S.totalLabel}>Total leasing</Text><Text style={S.totalValue}>{ars(totals.total_financed)}</Text></View>}
              </View>
            )}
          </View>
        )}

        {/* ── Payment comparison table ── */}
        <Text style={S.sectionTitle}>OPCIONES DE PAGO — COMPARATIVA</Text>
        <View style={S.cmpHeader}>
          <Text style={[S.cmpHeaderText, { flex: 2 }]}>MODALIDAD</Text>
          <Text style={[S.cmpHeaderText, { width: 60, textAlign: 'center' }]}>DESCUENTO</Text>
          <Text style={[S.cmpHeaderText, { width: 90, textAlign: 'right' }]}>TOTAL PESOS</Text>
          <Text style={[S.cmpHeaderText, { width: 80, textAlign: 'right' }]}>TOTAL USD</Text>
        </View>
        {paymentOptions.map((opt, i) => {
          const isSelected = payment.mode === (i === 0 ? 'contado' : 'cheques') && payment.discount_pct === opt.discount
          return (
            <View key={opt.label} style={[S.cmpRow, isSelected ? S.cmpRowHighlight : (i % 2 === 1 ? { backgroundColor: '#FAFAF8' } : {})]}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isSelected && <Text style={{ fontSize: 7, color: '#4A6741' }}>✓ </Text>}
                <Text style={S.cmpCell}>{opt.label}</Text>
                <Text style={{ fontSize: 7, color: '#8B9BAA', marginLeft: 4 }}>{opt.detail}</Text>
              </View>
              <Text style={[S.cmpDiscount, { width: 60 }]}>{opt.discount > 0 ? `${opt.discount}%` : '—'}</Text>
              <Text style={[S.cmpCellGold, { width: 90 }]}>$ {fmt(Math.round(opt.total_ars))}</Text>
              <Text style={[S.cmpCellGray, { width: 80 }]}>{usd(opt.total)}</Text>
            </View>
          )
        })}
        <View style={{ marginTop: 4, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 7, color: '#8B9BAA' }}>
            Precios en pesos argentinos. TC Dólar BNA vendedor: ${quote.exchange_rate.toLocaleString('es-AR')}. Incluye IVA 10,5%.
          </Text>
        </View>

        {/* ── Notes ── */}
        {quote.notes && (
          <>
            <Text style={[S.sectionTitle, { marginTop: 14 }]}>OBSERVACIONES</Text>
            <View style={S.notesBox}><Text style={S.notesText}>{quote.notes}</Text></View>
          </>
        )}

        {/* ── Legal note ── */}
        <View style={[S.notesBox, { marginTop: 10, backgroundColor: '#FFF9F0', borderColor: '#C8952A' }]}>
          <Text style={[S.notesText, { color: '#8B6A20', fontSize: 7 }]}>
            Los precios se expresan en pesos argentinos al TC Dólar BNA vendedor ${quote.exchange_rate.toLocaleString('es-AR')}. Los valores en USD son de referencia.
            Precios incluyen IVA 10,5%. GEA se reserva el derecho de modificar precios sin previo aviso. Oferta válida por {quote.valid_days} días.
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>AgroCotizar · {quote.quote_number} · {fmtDate(quote.created_at)}</Text>
          <Text style={S.footerText}>Gergolet Agrícola S.A. · consultas@gergolet.com.ar</Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Export functions ─────────────────────────────────────────

export async function downloadQuotePDF(quote: Quote): Promise<void> {
  const totals = computeTotals(quote)
  const blob = await pdf(<QuotePDF quote={quote} totals={totals} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${quote.quote_number}-${(quote.client.name || 'cliente').replace(/\s+/g, '-')}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Genera el PDF como File (para Web Share API o adjuntos) */
export async function buildQuotePDFFile(quote: Quote): Promise<File> {
  const totals = computeTotals(quote)
  const blob = await pdf(<QuotePDF quote={quote} totals={totals} />).toBlob()
  const name = `${quote.quote_number}-${(quote.client.name || 'cliente').replace(/\s+/g, '-')}.pdf`
  return new File([blob], name, { type: 'application/pdf' })
}

/**
 * Comparte el PDF via Web Share API (soporta adjuntos en Chrome/Edge/Safari móvil).
 * Si el browser no soporta file sharing, descarga el PDF y abre el canal (wa.me / mailto).
 *
 * @param channel 'whatsapp' | 'email'
 */
export async function shareQuotePDF(
  quote: Quote,
  channel: 'whatsapp' | 'email',
): Promise<void> {
  // Open the window SYNCHRONOUSLY while we're still inside the user-gesture handler.
  // Browsers block window.open() called after any await.
  const win = window.open('about:blank', '_blank')

  const totals  = computeTotals(quote)
  const file    = await buildQuotePDFFile(quote)
  const subject = buildEmailSubject(quote)
  const shortMsg = `Hola${quote.client.name ? ` ${quote.client.name}` : ''}, te envío la cotización ${quote.quote_number} de GEA Gergolet Agrícola. Adjunto el PDF. ¡Cualquier consulta estoy a disposición!`

  // ── Web Share API ────────────────────────────────────────────────────────────
  const canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })

  if (canShare) {
    win?.close()
    try {
      await navigator.share({
        files:   [file],
        title:   subject,
        text:    shortMsg,
      })
      return
    } catch (e) {
      // User cancelled or error — fall through to fallback
      if ((e as Error).name === 'AbortError') return
    }
  }

  // ── Fallback: descarga PDF + navega la ventana ya abierta ────────────────────
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url; a.download = file.name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)

  const notice = `(El PDF se descargó — adjuntalo manualmente)`

  if (channel === 'whatsapp') {
    const phone = quote.client.phone?.replace(/\D/g, '') ?? ''
    const arg   = phone.startsWith('54') ? phone : phone ? `54${phone}` : ''
    const text  = `${shortMsg}\n\n${notice}`
    const link  = arg ? `https://wa.me/${arg}?text=${encodeURIComponent(text)}`
                      : `https://wa.me/?text=${encodeURIComponent(text)}`
    if (win) win.location.href = link
    else window.open(link, '_blank')
  } else {
    const to   = quote.client.email ?? ''
    const body = `${shortMsg}\n\n${notice}\n\n---\n${buildEmailBody(quote, totals)}`
    const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    if (win) win.location.href = mailto
    else window.open(mailto, '_blank')
  }
}

export type UploadResult =
  | { ok: true;  url: string }
  | { ok: false; reason: 'bucket_missing' | 'auth' | 'upload' | 'sign'; detail: string }

/**
 * Sube el PDF a Supabase Storage y devuelve una URL firmada válida 30 días.
 * Siempre devuelve un objeto con `ok: true | false` para que el llamador
 * pueda mostrar un error accionable.
 */
export async function uploadQuotePDF(quote: Quote): Promise<UploadResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) {
      return { ok: false, reason: 'auth', detail: 'No hay sesión activa' }
    }

    const file = await buildQuotePDFFile(quote)
    const path = `${session.user.id}/${quote.quote_number}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(path, file, { contentType: 'application/pdf', upsert: true })

    if (uploadError) {
      const msg = uploadError.message ?? ''
      const isMissing = /not.found|bucket|no.*exist/i.test(msg)
      return {
        ok: false,
        reason: isMissing ? 'bucket_missing' : 'upload',
        detail: msg,
      }
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('quote-pdfs')
      .createSignedUrl(path, 60 * 60 * 24 * 30) // 30 días

    if (signError || !signed?.signedUrl) {
      return { ok: false, reason: 'sign', detail: signError?.message ?? 'Sin URL firmada' }
    }

    return { ok: true, url: signed.signedUrl }
  } catch (e) {
    return { ok: false, reason: 'upload', detail: String(e) }
  }
}

export { QuotePDF }
