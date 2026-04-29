import {
  Document, Page, Text, View, StyleSheet, pdf, Image,
} from '@react-pdf/renderer'
import type { Quote, QuoteTotals } from '@/types'
import { computeTotals } from '@/store/quoteStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { CompanyProfile, SellerProfile } from '@/store/settingsStore'
import { fmt, fmtDate } from '@/utils'
import { supabase } from '@/lib/supabase/client'

// ─── Payment comparison helper ────────────────────────────────

interface PaymentOption {
  label: string
  discount: number
  detail: string
  total: number
  total_ars: number
  isActive?: boolean
}

/** Builds comparison rows from user-selected list conditions (if any), otherwise hardcoded defaults. */
function buildComparisonRows(quote: Quote): PaymentOption[] {
  if (quote.payment_comparison_conditions && quote.payment_comparison_conditions.length > 0) {
    return quote.payment_comparison_conditions.map(t => {
      const t_quote = { ...quote, payment: { ...quote.payment, ...t.condition } }
      const t_totals = computeTotals(t_quote)
      const detail = [
        t.condition.num_checks ? `${t.condition.num_checks} valores` : '',
        t.condition.installments ? `${t.condition.installments} cuotas` : '',
        t.condition.financial_entity ?? '',
      ].filter(Boolean).join(' · ') || t.condition.mode
      const isActive =
        quote.payment.mode === t.condition.mode &&
        (quote.payment.discount_pct ?? 0) === (t.condition.discount_pct ?? 0)
      return {
        label: t.label,
        discount: t.condition.discount_pct ?? 0,
        detail,
        total: t_totals.total,
        total_ars: t_totals.total,
        isActive,
      }
    })
  }
  // Fallback: hardcoded conditions
  const CONDITIONS = [
    { label: 'Contado',           discount: 20, detail: 'Transferencia / E.Cheq mismo día',      mode: 'contado' as const },
    { label: '3 valores',         discount: 15, detail: 'E.Cheq 0-30-60 días',                   mode: 'cheques' as const },
    { label: '7 valores',         discount: 8,  detail: 'E.Cheq 0-30-...-180 días',              mode: 'cheques' as const },
    { label: '10 valores',        discount: 3,  detail: 'E.Cheq 0-30-...-270 días',              mode: 'cheques' as const },
    { label: '12 valores s/int.', discount: 0,  detail: 'E.Cheq 0-30-...-330 días, sin interés', mode: 'cheques' as const },
  ]
  return CONDITIONS.map((c) => {
    const t = computeTotals({ ...quote, payment: { ...quote.payment, mode: c.mode, discount_pct: c.discount } })
    const isActive = quote.payment.mode === c.mode && (quote.payment.discount_pct ?? 0) === c.discount
    return { ...c, total: t.total, total_ars: quote.currency === 'ARS' ? t.total : t.total * quote.exchange_rate, isActive }
  })
}

export function computePaymentOptions(quote: Quote): PaymentOption[] {
  return buildComparisonRows(quote)
}

// ─── WhatsApp & Email helpers ─────────────────────────────────

export function buildWhatsAppText(quote: Quote, totals: QuoteTotals): string {
  const { company, seller } = useSettingsStore.getState()
  const companyName = company.name || 'Cotizagro'
  const contactEmail = seller.email || company.email || ''

  const isUSDListWA = quote.currency === 'USD'
  const arsDisplay = (val: number) => `$ ${fmt(Math.round(val))}`
  const usdDisplay = (val: number) => `U$S ${fmt(val / quote.exchange_rate)}`
  const validUntil = new Date(quote.created_at)
  validUntil.setDate(validUntil.getDate() + quote.valid_days)

  const options = buildComparisonRows(quote)

  const lines: string[] = [
    `🌾 *${companyName}*`,
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
    const usdRef = isUSDListWA ? ` (${usdDisplay(opt.total)})` : ''
    lines.push(`${icon} ${opt.label}${desc}: ${arsDisplay(opt.total)}${usdRef}`)
  })

  if (isUSDListWA) lines.push(`_TC: $${quote.exchange_rate.toLocaleString('es-AR')} Dólar BNA vendedor_`)

  lines.push('')
  if (contactEmail) lines.push(`Consultas: ${contactEmail}`)

  return lines.join('\n')
}

export function buildEmailSubject(quote: Quote): string {
  const { company } = useSettingsStore.getState()
  const companyName = company.name || 'Cotizagro'
  return `Cotización ${companyName} — ${quote.quote_number}${quote.client.name ? ` — ${quote.client.name}` : ''}`
}

export function buildEmailBody(quote: Quote, totals: QuoteTotals): string {
  const text = buildWhatsAppText(quote, totals)
  return text.replace(/\*/g, '')
}

// ─── Styles ───────────────────────────────────────────────────

const GREEN   = '#22C55E'
const GREEN_D = '#16A34A'
const NAVY    = '#0F172A'
const SLATE   = '#64748B'
const SLATE_L = '#94A3B8'
const BORDER  = '#BBF7D0'
const BG_SOFT = '#F0FDF4'
const BG_ROW  = '#F8FFFA'
const RED     = '#EF4444'

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: NAVY,
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
    borderBottomColor: GREEN,
  },
  logoImg: { height: 70, maxWidth: 240, objectFit: 'contain' },
  logoText: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: NAVY },
  logoAccent: { color: GREEN },
  logoSub: { fontSize: 7, color: GREEN_D, letterSpacing: 2, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  cotNumber: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GREEN },
  cotDate: { fontSize: 8, color: SLATE_L, marginTop: 2 },
  badge: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: GREEN_D, borderRadius: 2 },
  badgeText: { fontSize: 7, color: '#FFFFFF', letterSpacing: 1 },

  grid2: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  col: { flex: 1 },

  card: { padding: 12, borderWidth: 1, borderColor: BORDER, borderRadius: 3, backgroundColor: BG_SOFT },
  cardTitle: { fontSize: 7, letterSpacing: 2, color: SLATE_L, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { color: SLATE_L, fontSize: 8 },
  value: { color: NAVY, fontSize: 8, fontFamily: 'Helvetica-Bold' },

  sectionTitle: {
    fontSize: 8, letterSpacing: 3, color: GREEN_D,
    textTransform: 'uppercase', fontFamily: 'Helvetica-Bold',
    marginBottom: 8, marginTop: 16,
    borderBottomWidth: 1, borderBottomColor: GREEN,
    paddingBottom: 3,
  },

  tableHeader: { flexDirection: 'row', backgroundColor: NAVY, padding: 6, borderRadius: 2, marginBottom: 1 },
  tableHeaderText: { color: '#FFFFFF', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  tableRow: { flexDirection: 'row', padding: 5, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tableRowAlt: { backgroundColor: BG_ROW },
  tableCell: { fontSize: 8, color: NAVY },
  tableCellRight: { fontSize: 8, color: NAVY, textAlign: 'right' },
  tableCellGreen: { fontSize: 8, color: GREEN_D, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  totalsBox: {
    marginTop: 12, padding: 12,
    backgroundColor: BG_SOFT, borderWidth: 1, borderColor: GREEN, borderRadius: 3,
    alignSelf: 'flex-end', width: 220,
  },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { fontSize: 8, color: SLATE },
  totalValue: { fontSize: 8, color: NAVY },
  grandTotalLine: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 6, paddingTop: 6,
    borderTopWidth: 1.5, borderTopColor: GREEN,
  },
  grandLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: NAVY },
  grandValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN },

  paymentBox: { padding: 10, backgroundColor: BG_SOFT, borderWidth: 1, borderColor: BORDER, borderRadius: 3, marginTop: 10 },
  paymentTitle: { fontSize: 8, color: GREEN_D, fontFamily: 'Helvetica-Bold', marginBottom: 4 },

  cmpHeader: { flexDirection: 'row', backgroundColor: NAVY, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 2, marginBottom: 1 },
  cmpHeaderText: { color: '#E2E8F0', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  cmpRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  cmpRowHighlight: { backgroundColor: '#DCFCE7' },
  cmpCell: { fontSize: 8, color: NAVY },
  cmpCellGreen: { fontSize: 9, color: GREEN_D, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  cmpCellGray: { fontSize: 7, color: SLATE_L, textAlign: 'right' },
  cmpDiscount: { fontSize: 8, color: GREEN_D, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36,
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 6,
  },
  footerText: { fontSize: 7, color: SLATE_L },

  notesBox: { padding: 10, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 3, marginTop: 10 },
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

function QuotePDF({
  quote,
  totals,
  company,
  seller,
}: {
  quote: Quote
  totals: QuoteTotals
  company: CompanyProfile
  seller: SellerProfile
}) {
  const { payment, taxes, delivery } = quote
  const client = quote.client
  const isUSDList = quote.currency === 'USD'
  const ars = (val: number) => `$ ${fmt(Math.round(val))}`
  const usd = (val: number) => `U$S ${fmt(val / quote.exchange_rate)}`
  const validUntil = new Date(quote.created_at)
  validUntil.setDate(validUntil.getDate() + quote.valid_days)

  const paymentOptions = buildComparisonRows(quote)

  const companyName    = company.name  || 'Cotizagro'
  const companyEmail   = company.email || seller.email || ''
  const companyPhone   = company.phone || seller.phone || ''
  const hasLogo        = Boolean(company.logo_base64)

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <View>
            {hasLogo ? (
              <Image src={company.logo_base64} style={S.logoImg} />
            ) : (
              <>
                <Text style={S.logoText}>
                  {companyName.slice(0, -1)}
                  <Text style={S.logoAccent}>{companyName.slice(-1)}</Text>
                </Text>
                <Text style={S.logoSub}>MAQUINARIA AGRÍCOLA · ARGENTINA</Text>
              </>
            )}
          </View>
          <View style={S.headerRight}>
            <Text style={S.cotNumber}>{quote.quote_number}</Text>
            <Text style={S.cotDate}>Fecha: {fmtDate(quote.created_at)}</Text>
            <Text style={S.cotDate}>Válida hasta: {validUntil.toLocaleDateString('es-AR')}</Text>
            <View style={S.badge}>
              <Text style={S.badgeText}>{companyName.toUpperCase()}</Text>
            </View>
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
              <Text style={[S.tableCell, { flex: 1, color: SLATE_L }]}>{item.category}</Text>
              <Text style={[S.tableCellRight, { width: 35 }]}>{item.quantity}</Text>
              <Text style={[S.tableCellRight, { width: 70 }]}>{ars(item.unit_price)}</Text>
              <Text style={[S.tableCellRight, { width: 40, color: item.discount_pct > 0 ? RED : SLATE_L }]}>
                {item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}
              </Text>
              <Text style={[S.tableCellGreen, { width: 75 }]}>{ars(sub)}</Text>
            </View>
          )
        })}

        {/* ── Totals ── */}
        <View style={S.totalsBox}>
          {totals.item_discounts > 0 && (
            <><View style={S.totalLine}><Text style={S.totalLabel}>Subtotal bruto</Text><Text style={S.totalValue}>{ars(totals.gross)}</Text></View>
              <View style={S.totalLine}><Text style={S.totalLabel}>Desc. por ítem</Text><Text style={[S.totalValue, { color: RED }]}>– {ars(totals.item_discounts)}</Text></View></>
          )}
          {totals.general_discounts > 0 && (
            <View style={S.totalLine}><Text style={S.totalLabel}>Desc. generales</Text><Text style={[S.totalValue, { color: RED }]}>– {ars(totals.general_discounts)}</Text></View>
          )}
          {totals.payment_discount > 0 && (
            <View style={S.totalLine}><Text style={S.totalLabel}>Desc. {PAYMENT_LABEL[payment.mode]}</Text><Text style={[S.totalValue, { color: RED }]}>– {ars(totals.payment_discount)}</Text></View>
          )}
          {totals.freight > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>Flete</Text><Text style={S.totalValue}>{ars(totals.freight)}</Text></View>}
          {totals.iibb > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>IIBB</Text><Text style={S.totalValue}>{ars(totals.iibb)}</Text></View>}
          {totals.iva > 0 && <View style={S.totalLine}><Text style={S.totalLabel}>IVA ({taxes.iva_pct}%)</Text><Text style={S.totalValue}>{ars(totals.iva)}</Text></View>}
          <View style={S.grandTotalLine}>
            <Text style={S.grandLabel}>TOTAL</Text>
            <Text style={S.grandValue}>{ars(totals.total)}</Text>
          </View>
          {isUSDList && (
            <View style={[S.totalLine, { marginTop: 4 }]}>
              <Text style={[S.totalLabel, { fontSize: 7 }]}>Equivalente USD (TC ${quote.exchange_rate.toLocaleString('es-AR')})</Text>
              <Text style={[S.totalValue, { fontSize: 7 }]}>{usd(totals.total)}</Text>
            </View>
          )}
        </View>

        {/* ── Financing simulation ── */}
        {(payment.mode === 'financiado' || payment.mode === 'leasing') && totals.installment_amount && (
          <View style={S.paymentBox}>
            <Text style={S.paymentTitle}>SIMULACIÓN DE {payment.mode === 'leasing' ? 'LEASING' : 'FINANCIAMIENTO'}</Text>
            {payment.mode === 'financiado' && totals.deposit !== undefined && (
              <View>
                <View style={S.totalLine}><Text style={S.totalLabel}>Anticipo ({payment.deposit_pct}%)</Text><Text style={S.totalValue}>{ars(totals.deposit)}</Text></View>
                <View style={S.totalLine}><Text style={S.totalLabel}>{payment.installments} cuotas de</Text><Text style={[S.totalValue, { color: GREEN_D }]}>{ars(totals.installment_amount)}/mes</Text></View>
                {totals.total_financed && <View style={S.totalLine}><Text style={S.totalLabel}>Total financiado</Text><Text style={S.totalValue}>{ars(totals.total_financed)}</Text></View>}
              </View>
            )}
            {payment.mode === 'leasing' && (
              <View>
                <View style={S.totalLine}><Text style={S.totalLabel}>{payment.lease_term_months} cánones de</Text><Text style={[S.totalValue, { color: GREEN_D }]}>{ars(totals.installment_amount)}/mes</Text></View>
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
          <Text style={[S.cmpHeaderText, { width: isUSDList ? 90 : 120, textAlign: 'right' }]}>TOTAL PESOS</Text>
          {isUSDList && <Text style={[S.cmpHeaderText, { width: 80, textAlign: 'right' }]}>TOTAL USD</Text>}
        </View>
        {paymentOptions.map((opt, i) => (
          <View key={opt.label} style={[S.cmpRow, opt.isActive ? S.cmpRowHighlight : (i % 2 === 1 ? { backgroundColor: BG_ROW } : {})]}>
            <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {opt.isActive && <Text style={{ fontSize: 7, color: GREEN_D }}>✓ </Text>}
              <Text style={S.cmpCell}>{opt.label}</Text>
              <Text style={{ fontSize: 7, color: SLATE_L, marginLeft: 4 }}>{opt.detail}</Text>
            </View>
            <Text style={[S.cmpDiscount, { width: 60 }]}>{opt.discount > 0 ? `${opt.discount}%` : '—'}</Text>
            <Text style={[S.cmpCellGreen, { width: isUSDList ? 90 : 120 }]}>$ {fmt(Math.round(opt.total_ars))}</Text>
            {isUSDList && <Text style={[S.cmpCellGray, { width: 80 }]}>{usd(opt.total)}</Text>}
          </View>
        ))}
        <View style={{ marginTop: 4, paddingHorizontal: 8 }}>
          <Text style={{ fontSize: 7, color: SLATE_L }}>
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
        <View style={[S.notesBox, { marginTop: 10, backgroundColor: BG_SOFT, borderColor: BORDER }]}>
          <Text style={[S.notesText, { color: SLATE, fontSize: 7 }]}>
            {isUSDList
              ? `Los precios se expresan en pesos argentinos al TC Dólar BNA vendedor $${quote.exchange_rate.toLocaleString('es-AR')}. Los valores en USD son de referencia. `
              : 'Los precios se expresan en pesos argentinos. '}
            Precios incluyen IVA 10,5%. {companyName} se reserva el derecho de modificar precios sin previo aviso. Oferta válida por {quote.valid_days} días.
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>Cotizagro · {quote.quote_number} · {fmtDate(quote.created_at)}</Text>
          <Text style={S.footerText}>
            {companyName}{companyEmail ? ` · ${companyEmail}` : ''}{companyPhone ? ` · ${companyPhone}` : ''}
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ─── Export functions ─────────────────────────────────────────

function getSettings() {
  const { company, seller } = useSettingsStore.getState()
  return { company, seller }
}

export async function downloadQuotePDF(quote: Quote): Promise<void> {
  const { company, seller } = getSettings()
  const totals = computeTotals(quote)
  const blob = await pdf(<QuotePDF quote={quote} totals={totals} company={company} seller={seller} />).toBlob()
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
  const { company, seller } = getSettings()
  const totals = computeTotals(quote)
  const blob = await pdf(<QuotePDF quote={quote} totals={totals} company={company} seller={seller} />).toBlob()
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
  const win = window.open('about:blank', '_blank')

  const totals  = computeTotals(quote)
  const file    = await buildQuotePDFFile(quote)
  const subject = buildEmailSubject(quote)
  const { company, seller } = getSettings()
  const companyName = company.name || 'Cotizagro'
  const shortMsg = `Hola${quote.client.name ? ` ${quote.client.name}` : ''}, te envío la cotización ${quote.quote_number} de ${companyName}. Adjunto el PDF. ¡Cualquier consulta estoy a disposición!`

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
      if ((e as Error).name === 'AbortError') return
    }
  }

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

    // Save storage path via API (service role bypasses RLS)
    await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_number: quote.quote_number, storage_path: path, tenant_id: session.user.id }),
    })

    const shortUrl = `${window.location.origin}/api/share?q=${encodeURIComponent(quote.quote_number)}`
    return { ok: true, url: shortUrl }
  } catch (e) {
    return { ok: false, reason: 'upload', detail: String(e) }
  }
}

export { QuotePDF }
