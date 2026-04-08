import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Button, Input, Label, FieldGroup, Textarea, Badge, Select } from '@/components/ui'
import { useCRMStore } from '@/store/crmStore'
import type { FollowUp } from '@/types'
import { cn } from '@/utils'
import {
  CalendarCheck, Clock, CheckCircle, AlertTriangle, Plus, Trash2, Edit3, X,
  RotateCcw, ChevronLeft, ChevronRight, List, Calendar,
} from 'lucide-react'

// ─── Date helpers ─────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0]

function classifyDate(dateStr: string): 'overdue' | 'today' | 'week' | 'later' {
  const d = new Date(dateStr); const now = new Date()
  now.setHours(0,0,0,0); d.setHours(0,0,0,0)
  const diff = Math.floor((d.getTime() - now.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 7) return 'week'
  return 'later'
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
function formatDateShort(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ─── Follow-up modal ──────────────────────────────────────────────────────────

interface ModalProps {
  initial?: Partial<FollowUp>
  onSave: (f: Omit<FollowUp, 'id' | 'created_at'>) => void
  onClose: () => void
}

function FollowUpModal({ initial, onSave, onClose }: ModalProps) {
  const { sellerEmail } = useCRMStore()
  const [form, setForm] = useState({
    quote_id:       initial?.quote_id       ?? '',
    quote_number:   initial?.quote_number   ?? '',
    client_name:    initial?.client_name    ?? '',
    client_phone:   initial?.client_phone   ?? '',
    client_email:   initial?.client_email   ?? '',
    seller_email:   initial?.seller_email   ?? sellerEmail ?? '',
    scheduled_date: initial?.scheduled_date ?? today(),
    reminder_days:  initial?.reminder_days  ?? 3,
    notes:          initial?.notes          ?? '',
    status:         initial?.status         ?? 'pending' as FollowUp['status'],
  })

  const valid = form.client_name.trim() && form.scheduled_date

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-0 sm:px-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-t-2xl sm:rounded-xl shadow-xl p-5 sm:p-7" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="text-lg font-semibold text-[#0F172A]">
            {initial?.id ? 'Editar seguimiento' : 'Nuevo seguimiento'}
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Cliente</Label>
              <Input value={form.client_name} onChange={e => setForm(s => ({ ...s, client_name: e.target.value }))} placeholder="Nombre del cliente" />
            </FieldGroup>
            <FieldGroup>
              <Label>N° Cotización</Label>
              <Input value={form.quote_number} onChange={e => setForm(s => ({ ...s, quote_number: e.target.value }))} placeholder="COT-XXXX" />
            </FieldGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Teléfono del cliente</Label>
              <Input value={form.client_phone} onChange={e => setForm(s => ({ ...s, client_phone: e.target.value }))} placeholder="Ej: 3562-123456" />
            </FieldGroup>
            <FieldGroup>
              <Label>Email del cliente</Label>
              <Input value={form.client_email} onChange={e => setForm(s => ({ ...s, client_email: e.target.value }))} placeholder="cliente@email.com" type="email" />
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Tu email (recordatorios)</Label>
            <Input value={form.seller_email} onChange={e => setForm(s => ({ ...s, seller_email: e.target.value }))} placeholder="vendedor@email.com" type="email" />
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Fecha de seguimiento</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(s => ({ ...s, scheduled_date: e.target.value }))} />
            </FieldGroup>
            <FieldGroup>
              <Label>Recordar cada</Label>
              <Select value={form.reminder_days} onChange={e => setForm(s => ({ ...s, reminder_days: Number(e.target.value) }))}>
                {[1, 2, 3, 5, 7, 10, 14, 30].map(d => (
                  <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>
                ))}
              </Select>
            </FieldGroup>
          </div>
          <FieldGroup>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="Recordatorio, qué consultar, próximo paso..." />
          </FieldGroup>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" disabled={!valid}
            onClick={() => { if (valid) { onSave(form); onClose() } }}>
            {initial?.id ? 'Guardar cambios' : 'Agendar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Follow-up card ───────────────────────────────────────────────────────────

function FollowUpCard({ fu, onDone, onReschedule, onEdit, onDelete }: {
  fu: FollowUp; onDone: () => void; onReschedule: () => void; onEdit: () => void; onDelete: () => void
}) {
  const cls = classifyDate(fu.scheduled_date)
  return (
    <div className={cn(
      'rounded border p-4 transition-all',
      fu.status === 'done'      ? 'bg-[#F8FAFC] border-[#E2E8F0] opacity-60'
        : cls === 'overdue'    ? 'bg-[#FEF2F2] border-[#EF4444]/30'
        : cls === 'today'      ? 'bg-[#FFFBEB] border-[#F59E0B]/40'
        : 'bg-white border-[#E2E8F0] hover:border-[#22C55E]/30'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-[#0F172A] truncate">{fu.client_name}</span>
            {fu.quote_number && (
              <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-0.5 rounded-md font-mono">
                {fu.quote_number}
              </span>
            )}
            {fu.status === 'done'                          && <Badge variant="verde">Completado</Badge>}
            {fu.status !== 'done' && cls === 'overdue'    && <Badge variant="rojo">Vencido</Badge>}
            {fu.status !== 'done' && cls === 'today'      && <Badge variant="trigo">Hoy</Badge>}
          </div>
          <div className="text-[11px] text-[#64748B] mb-2">📅 {formatDateShort(fu.scheduled_date)}</div>
          {fu.notes && <p className="text-[12px] text-[#64748B] leading-relaxed">{fu.notes}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {fu.status === 'pending' && (
            <>
              <button onClick={onReschedule} title={`Contactado — reagendar en ${fu.reminder_days} días`}
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all cursor-pointer">
                <RotateCcw size={14} />
              </button>
              <button onClick={onDone} title="Finalizar seguimiento"
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#22C55E] hover:bg-[#22C55E]/10 transition-all cursor-pointer">
                <CheckCircle size={14} />
              </button>
            </>
          )}
          <button onClick={onEdit} title="Editar"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all cursor-pointer">
            <Edit3 size={14} />
          </button>
          <button onClick={onDelete} title="Eliminar"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count, color }: {
  icon: React.ReactNode; label: string; count: number; color: string
}) {
  return (
    <div className={cn('flex items-center gap-2 mb-3 pb-2 border-b', color)}>
      {icon}
      <span className="font-mono text-[11px] tracking-[2px] uppercase font-semibold">{label}</span>
      <span className={cn('ml-auto font-mono text-[11px] px-2 py-0.5 rounded-full', color)}>{count}</span>
    </div>
  )
}

// ─── Calendar view ────────────────────────────────────────────────────────────

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function CalendarView({
  followUps,
  onEdit, onDone, onReschedule, onDelete,
}: {
  followUps: FollowUp[]
  onEdit: (fu: FollowUp) => void
  onDone: (id: string) => void
  onReschedule: (id: string) => void
  onDelete: (id: string) => void
}) {
  const todayStr = today()
  const [vm, setVm] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  function prevMonth() {
    setVm(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 })
  }
  function nextMonth() {
    setVm(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 })
  }

  // Map follow-ups by date string
  const byDate = followUps.reduce<Record<string, FollowUp[]>>((acc, fu) => {
    ;(acc[fu.scheduled_date] ??= []).push(fu)
    return acc
  }, {})

  // Build grid: padding + days of the month
  const firstDow = (new Date(vm.year, vm.month, 1).getDay() + 6) % 7 // Mon=0
  const totalDays = new Date(vm.year, vm.month + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1
      return `${vm.year}-${String(vm.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }),
  ]
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedFUs = selectedDate ? (byDate[selectedDate] ?? []) : []

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      {/* Calendar card */}
      <Card className="p-0 overflow-hidden self-start">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-[#0F172A]">
            {MONTH_NAMES[vm.month]} {vm.year}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors cursor-pointer">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Week day headers */}
        <div className="grid grid-cols-7 px-3 pt-3 pb-1">
          {WEEK_DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-[#94A3B8] tracking-wider uppercase py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 px-3 pb-4 gap-0.5">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`e${i}`} />
            const fus = byDate[dateStr] ?? []
            const isToday    = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const isPast     = dateStr < todayStr
            const hasOverdue = fus.some(f => f.status === 'pending' && isPast)
            const hasPending = fus.some(f => f.status === 'pending' && !isPast)

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(s => s === dateStr ? null : dateStr)}
                className={cn(
                  'flex flex-col items-center justify-start py-1.5 px-0.5 rounded-lg transition-all cursor-pointer min-h-[48px]',
                  isSelected                    ? 'bg-[#1E2235] text-white'
                    : isToday                   ? 'bg-[#22C55E]/10 text-[#166534] font-semibold'
                    : isPast && fus.length > 0  ? 'hover:bg-[#FEF2F2] text-[#64748B]'
                    : 'hover:bg-[#F1F5F9] text-[#0F172A]'
                )}
              >
                <span className={cn(
                  'text-[13px] leading-none mb-1',
                  isSelected ? 'text-white' : isToday ? 'text-[#166534]' : isPast ? 'text-[#94A3B8]' : 'text-[#0F172A]'
                )}>
                  {new Date(dateStr + 'T00:00:00').getDate()}
                </span>
                {/* Status dots */}
                {fus.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {hasOverdue && <div className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-[#FCA5A5]' : 'bg-[#EF4444]')} />}
                    {hasPending && <div className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-[#93C5FD]' : 'bg-[#3B82F6]')} />}
                    {fus.some(f => f.status === 'done') && <div className={cn('w-1.5 h-1.5 rounded-full', isSelected ? 'bg-[#86EFAC]' : 'bg-[#22C55E]')} />}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="px-5 pb-4 flex items-center gap-4">
          {[
            { color: 'bg-[#EF4444]', label: 'Vencido' },
            { color: 'bg-[#3B82F6]', label: 'Pendiente' },
            { color: 'bg-[#22C55E]', label: 'Completado' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${l.color}`} />
              <span className="text-[10px] text-[#94A3B8]">{l.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Day detail panel */}
      <div>
        {selectedDate ? (
          <div>
            <div className="text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-3">
              {formatDate(selectedDate)}
            </div>
            {selectedFUs.length === 0 ? (
              <Card className="text-center py-10">
                <CalendarCheck size={28} className="text-[#CBD5E1] mx-auto mb-3" />
                <p className="text-[13px] text-[#94A3B8]">Sin seguimientos para este día</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {selectedFUs.map(fu => (
                  <FollowUpCard
                    key={fu.id}
                    fu={fu}
                    onDone={() => onDone(fu.id)}
                    onReschedule={() => onReschedule(fu.id)}
                    onEdit={() => onEdit(fu)}
                    onDelete={() => onDelete(fu.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card className="text-center py-16">
            <Calendar size={32} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-[13px] text-[#94A3B8]">Seleccioná un día para ver los seguimientos</p>
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CRMPage() {
  const { followUps, addFollowUp, updateFollowUp, deleteFollowUp, completeAndReschedule } = useCRMStore()
  const [modal, setModal] = useState<{ open: boolean; editing?: FollowUp }>({ open: false })
  const [showDone, setShowDone] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('calendar')

  const pending = followUps.filter(f => f.status === 'pending')
  const done    = followUps.filter(f => f.status === 'done')

  const overdue   = pending.filter(f => classifyDate(f.scheduled_date) === 'overdue').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const todayList = pending.filter(f => classifyDate(f.scheduled_date) === 'today')
  const weekList  = pending.filter(f => classifyDate(f.scheduled_date) === 'week').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const laterList = pending.filter(f => classifyDate(f.scheduled_date) === 'later').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

  const doneThisMonth = done.filter(f =>
    new Date(f.created_at).getMonth() === new Date().getMonth()
  ).length

  const openNew    = () => setModal({ open: true })
  const openEdit   = (fu: FollowUp) => setModal({ open: true, editing: fu })
  const closeModal = () => setModal({ open: false })

  const handleSave = (form: Omit<FollowUp, 'id' | 'created_at'>) => {
    if (modal.editing) updateFollowUp(modal.editing.id, form)
    else addFollowUp(form)
  }

  const handleDone       = (id: string) => updateFollowUp(id, { status: 'done' })
  const handleReschedule = (id: string) => completeAndReschedule(id)
  const handleDelete     = (id: string) => {
    if (confirm('¿Eliminar este seguimiento?')) deleteFollowUp(id)
  }

  return (
    <div>
      <PageHeader
        title="Seguimientos"
        subtitle="CRM · Gestión de clientes"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
                  view === 'list' ? 'bg-[#1E2235] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                )}
              >
                <List size={13} /><span className="hidden lg:inline"> Lista</span>
              </button>
              <button
                onClick={() => setView('calendar')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
                  view === 'calendar' ? 'bg-[#1E2235] text-white' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                )}
              >
                <Calendar size={13} /><span className="hidden lg:inline"> Calendario</span>
              </button>
            </div>
            <Button variant="primary" className="flex items-center gap-1.5" onClick={openNew}>
              <Plus size={14} />
              <span className="hidden sm:inline">Nuevo seguimiento</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <Card className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-4 sm:p-6 text-center sm:text-left">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFFBEB] flex items-center justify-center flex-shrink-0">
              <Clock size={16} className="text-[#F59E0B]" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-[#0F172A]">{pending.length}</div>
              <div className="text-[11px] sm:text-[12px] text-[#64748B] leading-tight">Pendientes</div>
            </div>
          </Card>
          <Card className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-4 sm:p-6 text-center sm:text-left">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-[#EF4444]" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-[#EF4444]">{overdue.length}</div>
              <div className="text-[11px] sm:text-[12px] text-[#64748B] leading-tight">Vencidos</div>
            </div>
          </Card>
          <Card className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 p-4 sm:p-6 text-center sm:text-left">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
              <CheckCircle size={16} className="text-[#22C55E]" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-[#22C55E]">{doneThisMonth}</div>
              <div className="text-[11px] sm:text-[12px] text-[#64748B] leading-tight">Hechos este mes</div>
            </div>
          </Card>
        </div>

        {/* Empty state */}
        {followUps.length === 0 && (
          <Card className="text-center py-16">
            <CalendarCheck size={40} className="text-[#CBD5E1] mx-auto mb-4" />
            <p className="text-xl font-medium text-[#94A3B8] mb-2">Sin seguimientos aún</p>
            <p className="text-[12px] text-[#94A3B8] mb-6">
              Agendá un seguimiento desde aquí o desde la lista de cotizaciones
            </p>
            <Button variant="primary" onClick={openNew} className="flex items-center gap-2 mx-auto">
              <Plus size={14} /> Crear primer seguimiento
            </Button>
          </Card>
        )}

        {/* ── CALENDAR VIEW ── */}
        {followUps.length > 0 && view === 'calendar' && (
          <CalendarView
            followUps={followUps}
            onEdit={openEdit}
            onDone={handleDone}
            onReschedule={handleReschedule}
            onDelete={handleDelete}
          />
        )}

        {/* ── LIST VIEW ── */}
        {followUps.length > 0 && view === 'list' && (
          <div className="space-y-8">

            {overdue.length > 0 && (
              <div>
                <SectionHeader icon={<AlertTriangle size={14} className="text-[#EF4444]" />}
                  label="Vencidos — Requieren atención" count={overdue.length}
                  color="text-[#EF4444] border-[#EF4444]/30" />
                <div className="space-y-2">
                  {overdue.map(fu => (
                    <FollowUpCard key={fu.id} fu={fu}
                      onDone={() => handleDone(fu.id)} onReschedule={() => handleReschedule(fu.id)}
                      onEdit={() => openEdit(fu)} onDelete={() => handleDelete(fu.id)} />
                  ))}
                </div>
              </div>
            )}

            {todayList.length > 0 && (
              <div>
                <SectionHeader icon={<Clock size={14} className="text-[#F59E0B]" />}
                  label={`Hoy — ${formatDate(today())}`} count={todayList.length}
                  color="text-[#F59E0B] border-[#F59E0B]/30" />
                <div className="space-y-2">
                  {todayList.map(fu => (
                    <FollowUpCard key={fu.id} fu={fu}
                      onDone={() => handleDone(fu.id)} onReschedule={() => handleReschedule(fu.id)}
                      onEdit={() => openEdit(fu)} onDelete={() => handleDelete(fu.id)} />
                  ))}
                </div>
              </div>
            )}

            {weekList.length > 0 && (
              <div>
                <SectionHeader icon={<CalendarCheck size={14} className="text-[#3B82F6]" />}
                  label="Esta semana" count={weekList.length}
                  color="text-[#3B82F6] border-[#3B82F6]/30" />
                <div className="space-y-2">
                  {weekList.map(fu => (
                    <FollowUpCard key={fu.id} fu={fu}
                      onDone={() => handleDone(fu.id)} onReschedule={() => handleReschedule(fu.id)}
                      onEdit={() => openEdit(fu)} onDelete={() => handleDelete(fu.id)} />
                  ))}
                </div>
              </div>
            )}

            {laterList.length > 0 && (
              <div>
                <SectionHeader icon={<CalendarCheck size={14} className="text-[#64748B]" />}
                  label="Más adelante" count={laterList.length}
                  color="text-[#64748B] border-[#E2E8F0]" />
                <div className="space-y-2">
                  {laterList.map(fu => (
                    <FollowUpCard key={fu.id} fu={fu}
                      onDone={() => handleDone(fu.id)} onReschedule={() => handleReschedule(fu.id)}
                      onEdit={() => openEdit(fu)} onDelete={() => handleDelete(fu.id)} />
                  ))}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <button onClick={() => setShowDone(s => !s)}
                  className="flex items-center gap-2 text-[12px] font-medium text-[#64748B] hover:text-[#0F172A] transition-colors cursor-pointer mb-3">
                  <CheckCircle size={13} />
                  Completados ({done.length})
                  <span className="text-[10px]">{showDone ? '▲' : '▼'}</span>
                </button>
                {showDone && (
                  <div className="space-y-2">
                    {done.map(fu => (
                      <FollowUpCard key={fu.id} fu={fu}
                        onDone={() => {}} onReschedule={() => {}}
                        onEdit={() => openEdit(fu)} onDelete={() => handleDelete(fu.id)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {modal.open && (
        <FollowUpModal initial={modal.editing} onSave={handleSave} onClose={closeModal} />
      )}
    </div>
  )
}
