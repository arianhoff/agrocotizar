import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Badge, Button, Input, Label, FieldGroup, Textarea, Select } from '@/components/ui'
import { FileText, Download, Trash2, Send, CheckCircle, XCircle, Clock, PlusCircle, CalendarPlus, X, Bell } from 'lucide-react'
import { useQuotes, useUpdateQuoteStatus, useDeleteQuote } from '@/hooks/useSupabase'
import { downloadQuotePDF } from '@/lib/pdf/QuotePDF'
import { fmt, fmtDate } from '@/utils'
import { cn } from '@/utils'
import type { Quote } from '@/types'
import { useCRMStore } from '@/store/crmStore'

type Status = 'all' | Quote['status']

const STATUS_TABS: { id: Status; label: string }[] = [
  { id: 'all',      label: 'Todas' },
  { id: 'draft',    label: 'Borradores' },
  { id: 'sent',     label: 'Enviadas' },
  { id: 'accepted', label: 'Aceptadas' },
  { id: 'rejected', label: 'Rechazadas' },
  { id: 'expired',  label: 'Vencidas' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'trigo' | 'verde' | 'rojo' | 'acero'; icon: typeof Clock }> = {
  draft:    { label: 'Borrador',  variant: 'acero', icon: Clock },
  sent:     { label: 'Enviada',   variant: 'trigo', icon: Send },
  accepted: { label: 'Aceptada',  variant: 'verde', icon: CheckCircle },
  rejected: { label: 'Rechazada', variant: 'rojo',  icon: XCircle },
  expired:  { label: 'Vencida',   variant: 'acero', icon: Clock },
}

// ─── Send + auto follow-up modal ─────────────────────────────

function SendModal({ quoteId, quoteNumber, clientName, clientPhone, clientEmail, onConfirm, onClose }: {
  quoteId: string; quoteNumber: string; clientName: string
  clientPhone?: string; clientEmail?: string
  onConfirm: () => void; onClose: () => void
}) {
  const { addFollowUp, sellerEmail } = useCRMStore()
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    phone:        clientPhone ?? '',
    email:        clientEmail ?? '',
    seller_email: sellerEmail ?? '',
    reminder_days: 3,
    first_date:   today,
    notes:        '',
  })

  function handleConfirm() {
    addFollowUp({
      quote_id:      quoteId,
      quote_number:  quoteNumber,
      client_name:   clientName,
      client_phone:  form.phone || undefined,
      client_email:  form.email || undefined,
      seller_email:  form.seller_email || undefined,
      scheduled_date: form.first_date,
      reminder_days: form.reminder_days,
      notes:         form.notes || `Primera llamada / mensaje post-cotización ${quoteNumber}`,
      status:        'pending',
      sent_at:       today,
    })
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-t-2xl sm:rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-base font-semibold text-[#0F172A]">Marcar como enviada</div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#F0FDF4] border border-[#22C55E]/20 rounded-lg">
          <Bell size={13} className="text-[#22C55E] shrink-0" />
          <p className="text-[12px] text-[#16A34A]">
            Se creará un seguimiento automático para recordarte contactar al cliente.
          </p>
        </div>

        <div className="text-[12px] font-medium text-[#0F172A] mb-3">{quoteNumber} · {clientName}</div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Teléfono del cliente</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ej: 3562-123456" />
            </FieldGroup>
            <FieldGroup>
              <Label>Email del cliente</Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="cliente@email.com" type="email" />
            </FieldGroup>
          </div>

          <FieldGroup>
            <Label>Tu email (para recordatorios)</Label>
            <Input value={form.seller_email} onChange={e => setForm(f => ({ ...f, seller_email: e.target.value }))}
              placeholder="vendedor@email.com" type="email" />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Primer seguimiento</Label>
              <Input type="date" value={form.first_date} min={today}
                onChange={e => setForm(f => ({ ...f, first_date: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Recordar cada</Label>
              <Select value={form.reminder_days}
                onChange={e => setForm(f => ({ ...f, reminder_days: Number(e.target.value) }))}>
                {[1, 2, 3, 5, 7, 10, 14, 30].map(d => (
                  <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                ))}
              </Select>
            </FieldGroup>
          </div>

          <FieldGroup>
            <Label>Notas iniciales</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Llamar para confirmar si revisó la cotización..." />
          </FieldGroup>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={handleConfirm}>
            Confirmar envío
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Manual schedule modal ────────────────────────────────────

function ScheduleModal({ quoteId, quoteNumber, clientName, onClose }: {
  quoteId: string; quoteNumber: string; clientName: string; onClose: () => void
}) {
  const { addFollowUp, sellerEmail } = useCRMStore()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [reminderDays, setReminderDays] = useState(3)
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    addFollowUp({
      quote_id: quoteId, quote_number: quoteNumber, client_name: clientName,
      seller_email: sellerEmail || undefined,
      scheduled_date: date, reminder_days: reminderDays, notes, status: 'pending',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-white border border-[#E2E8F0] rounded-t-2xl sm:rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-base font-semibold text-[#0F172A]">Agendar seguimiento</div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={16} /></button>
        </div>
        <div className="text-[12px] text-[#64748B] mb-4">{quoteNumber} · {clientName}</div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Fecha</Label>
              <Input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} />
            </FieldGroup>
            <FieldGroup>
              <Label>Recordar cada</Label>
              <Select value={reminderDays} onChange={e => setReminderDays(Number(e.target.value))}>
                {[1, 2, 3, 5, 7, 10, 14, 30].map(d => (
                  <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                ))}
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Notas</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Llamar para confirmar, revisar financiación..." />
          </FieldGroup>
        </div>
        <div className="flex gap-2 mt-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave}>Agendar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Row actions ──────────────────────────────────────────────

function RowActions({ row, clientName, quoteData, downloadingId, onSchedule, onSend, onDownload, onUpdateStatus, onDelete }: {
  row: { id: string; status: string; quote_number: string; currency: string }
  clientName: string
  quoteData: Quote | undefined
  downloadingId: string | null
  onSchedule: () => void
  onSend: () => void
  onDownload: () => void
  onUpdateStatus: (s: string) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={onSchedule} title="Agendar seguimiento"
        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all cursor-pointer">
        <CalendarPlus size={14} />
      </button>
      <button onClick={onDownload} disabled={downloadingId === row.id || !quoteData}
        title="Exportar PDF"
        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-all disabled:opacity-40 cursor-pointer">
        <Download size={14} />
      </button>
      {row.status === 'draft' && (
        <button onClick={onSend} title="Marcar como enviada"
          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all cursor-pointer">
          <Send size={14} />
        </button>
      )}
      {row.status === 'sent' && (
        <>
          <button onClick={() => onUpdateStatus('accepted')} title="Marcar como aceptada"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all cursor-pointer">
            <CheckCircle size={14} />
          </button>
          <button onClick={() => onUpdateStatus('rejected')} title="Marcar como rechazada"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer">
            <XCircle size={14} />
          </button>
        </>
      )}
      <button onClick={onDelete} title="Eliminar"
        className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer">
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function QuotesListPage() {
  const [activeStatus, setActiveStatus] = useState<Status>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState<{ id: string; number: string; client: string } | null>(null)
  const [sending, setSending] = useState<{ id: string; number: string; client: string; phone?: string; email?: string } | null>(null)

  const { data: quotes = [], isLoading } = useQuotes(
    activeStatus !== 'all' ? { status: activeStatus } : undefined
  )
  const updateStatus = useUpdateQuoteStatus()
  const deleteQuote  = useDeleteQuote()

  const handleDownload = async (row: { id: string; data: unknown }) => {
    setDownloadingId(row.id)
    try {
      await downloadQuotePDF(row.data as Quote)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    deleteQuote.mutate(id)
  }

  return (
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle="Historial completo"
        actions={
          <Link to="/quoter">
            <Button variant="primary" className="flex items-center gap-1.5">
              <PlusCircle size={14} />
              <span className="hidden sm:inline">Nueva Cotización</span>
              <span className="sm:hidden">Nueva</span>
            </Button>
          </Link>
        }
      />

      <div className="p-4 sm:p-6 md:p-8">
        {/* Status tabs — scrollable on mobile */}
        <div className="flex gap-1 mb-6 bg-[#F1F5F9] p-1 rounded-xl w-full overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatus(tab.id)}
              className={cn(
                'px-3 sm:px-4 py-2 rounded-sm font-mono text-[10px] sm:text-[11px] tracking-[1px] uppercase transition-all cursor-pointer whitespace-nowrap flex-shrink-0',
                activeStatus === tab.id
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-20 text-[#94A3B8] text-sm">Cargando...</div>
        )}

        {!isLoading && quotes.length === 0 && (
          <Card className="text-center py-16">
            <FileText size={32} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-lg font-medium text-[#94A3B8]">No hay cotizaciones</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">
              {activeStatus !== 'all' ? `Sin cotizaciones en estado "${STATUS_CONFIG[activeStatus]?.label}"` : 'Creá tu primera cotización'}
            </p>
            <Link to="/quoter" className="inline-block mt-4">
              <Button variant="primary">+ Nueva Cotización</Button>
            </Link>
          </Card>
        )}

        {!isLoading && quotes.length > 0 && (
          <>
            {/* ── Desktop table (md+) ── */}
            <div className="hidden md:block rounded-xl bg-white border border-[#E2E8F0] overflow-hidden shadow-sm">
              <div className="grid px-5 py-3 border-b border-[#E2E8F0] text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] bg-[#F8FAFC]"
                style={{ gridTemplateColumns: '1fr 2fr 1.2fr 1fr 1fr 1fr 140px' }}>
                <span>N° Cotización</span>
                <span>Cliente</span>
                <span>Estado</span>
                <span>Moneda</span>
                <span>Total</span>
                <span>Fecha</span>
                <span />
              </div>

              {quotes.map((row) => {
                const status = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.draft
                const StatusIcon = status.icon
                const quoteData = row.data as Quote | undefined
                const clientName = quoteData?.client?.name ?? '—'
                const total = row.total ?? quoteData?.totals?.total ?? 0
                const sym = row.currency === 'USD' ? 'U$S ' : '$ '

                return (
                  <div key={row.id}
                    className="grid px-5 py-3.5 border-b border-[#F1F5F9] hover:bg-[#FAFAFA] transition-colors items-center"
                    style={{ gridTemplateColumns: '1fr 2fr 1.2fr 1fr 1fr 1fr 140px' }}
                  >
                    <span className="font-mono text-[12px] text-[#22C55E] font-semibold">{row.quote_number}</span>
                    <span className="text-sm text-[#0F172A] truncate pr-4">{clientName}</span>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon size={12} className={status.variant === 'verde' ? 'text-[#22C55E]' : status.variant === 'rojo' ? 'text-[#EF4444]' : 'text-[#94A3B8]'} />
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <span className="text-[11px] text-[#64748B]">{row.currency}</span>
                    <span className="text-[13px] text-[#0F172A] font-semibold">{sym}{fmt(total)}</span>
                    <span className="text-[11px] text-[#64748B]">{fmtDate(row.created_at)}</span>
                    <div className="flex items-center gap-1 justify-end">
                      <RowActions
                        row={row}
                        clientName={clientName}
                        quoteData={quoteData}
                        downloadingId={downloadingId}
                        onSchedule={() => setScheduling({ id: row.id, number: row.quote_number, client: clientName })}
                        onSend={() => setSending({ id: row.id, number: row.quote_number, client: clientName, phone: quoteData?.client?.phone, email: quoteData?.client?.email })}
                        onDownload={() => handleDownload(row)}
                        onUpdateStatus={s => updateStatus.mutate({ id: row.id, status: s as Quote['status'] })}
                        onDelete={() => handleDelete(row.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Mobile cards (< md) ── */}
            <div className="md:hidden space-y-3">
              {quotes.map((row) => {
                const status = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.draft
                const StatusIcon = status.icon
                const quoteData = row.data as Quote | undefined
                const clientName = quoteData?.client?.name ?? '—'
                const total = row.total ?? quoteData?.totals?.total ?? 0
                const sym = row.currency === 'USD' ? 'U$S ' : '$ '

                return (
                  <div key={row.id} className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[13px] text-[#22C55E] font-bold">{row.quote_number}</span>
                        <div className="text-[14px] font-semibold text-[#0F172A] mt-0.5 truncate">{clientName}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <StatusIcon size={12} className={status.variant === 'verde' ? 'text-[#22C55E]' : status.variant === 'rojo' ? 'text-[#EF4444]' : 'text-[#94A3B8]'} />
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[16px] font-bold text-[#0F172A]">{sym}{fmt(total)}</div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5">{fmtDate(row.created_at)}</div>
                      </div>
                      <RowActions
                        row={row}
                        clientName={clientName}
                        quoteData={quoteData}
                        downloadingId={downloadingId}
                        onSchedule={() => setScheduling({ id: row.id, number: row.quote_number, client: clientName })}
                        onSend={() => setSending({ id: row.id, number: row.quote_number, client: clientName, phone: quoteData?.client?.phone, email: quoteData?.client?.email })}
                        onDownload={() => handleDownload(row)}
                        onUpdateStatus={s => updateStatus.mutate({ id: row.id, status: s as Quote['status'] })}
                        onDelete={() => handleDelete(row.id)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {scheduling && (
        <ScheduleModal
          quoteId={scheduling.id}
          quoteNumber={scheduling.number}
          clientName={scheduling.client}
          onClose={() => setScheduling(null)}
        />
      )}

      {sending && (
        <SendModal
          quoteId={sending.id}
          quoteNumber={sending.number}
          clientName={sending.client}
          clientPhone={sending.phone}
          clientEmail={sending.email}
          onConfirm={() => updateStatus.mutate({ id: sending.id, status: 'sent' })}
          onClose={() => setSending(null)}
        />
      )}
    </div>
  )
}
