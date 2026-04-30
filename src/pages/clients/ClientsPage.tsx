import { useState, useMemo, useRef } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Button, Input, Label, FieldGroup, Textarea } from '@/components/ui'
import { useClientStore, type Client, type ClientType, type ClientImportRow } from '@/store/clientStore'
import { useSavedQuotesStore } from '@/store/savedQuotesStore'
import { fmt } from '@/utils'
import {
  Users, Search, Phone, Mail, MapPin, FileText, Plus,
  Pencil, Trash2, X, Check, MessageCircle, Upload, Download,
  AlertCircle, CheckCircle2, FileSpreadsheet, ChevronDown,
} from 'lucide-react'

// ─── Client type config ────────────────────────────────────────────────────────

const CLIENT_TYPE_CONFIG: Record<ClientType, { label: string; bg: string; text: string; border: string }> = {
  productor:    { label: 'Productor',    bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]', border: 'border-[#22C55E]/30' },
  empresa:      { label: 'Empresa',      bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#3B82F6]/30' },
  contratista:  { label: 'Contratista',  bg: 'bg-[#FFF7ED]', text: 'text-[#C2410C]', border: 'border-[#F97316]/30' },
  acopio:       { label: 'Acopio',       bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]', border: 'border-[#8B5CF6]/30' },
  distribuidor: { label: 'Distribuidor', bg: 'bg-[#FFF1F2]', text: 'text-[#BE123C]', border: 'border-[#F43F5E]/30' },
  particular:   { label: 'Particular',   bg: 'bg-[#F8FAFC]', text: 'text-[#475569]', border: 'border-[#94A3B8]/30' },
}

const CLIENT_TYPES: ClientType[] = ['productor', 'empresa', 'contratista', 'acopio', 'distribuidor', 'particular']

function TypeBadge({ type }: { type?: ClientType }) {
  if (!type) return null
  const cfg = CLIENT_TYPE_CONFIG[type]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const TEMPLATE_CSV = `nombre,cuit,tipo,telefono,email,provincia,localidad,notas
Juan Pérez,20-12345678-9,productor,3562-123456,juan@email.com,Córdoba,Río Cuarto,Cliente frecuente
Agropecuaria Los Sauces SA,30-98765432-1,empresa,351-4567890,info@lossauces.com.ar,Santa Fe,Rosario,`

const COL_MAP: Record<string, keyof ClientImportRow> = {
  nombre: 'name', name: 'name',
  cuit: 'cuit', 'cuit/cuil': 'cuit', cuil: 'cuit',
  tipo: 'type', type: 'type',
  telefono: 'phone', phone: 'phone', tel: 'phone', celular: 'phone', movil: 'phone',
  email: 'email', correo: 'email', 'e-mail': 'email',
  provincia: 'province', province: 'province',
  localidad: 'city', ciudad: 'city', city: 'city',
  notas: 'notes', notes: 'notes', observaciones: 'notes', comentarios: 'notes',
}

function parseCSV(text: string): ClientImportRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const parseLine = (line: string): string[] => {
    const fields: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        fields.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().trim())
  const colKeys = headers.map(h => COL_MAP[h] ?? null)

  return lines.slice(1).map(line => {
    const vals = parseLine(line)
    const row: Record<string, string> = {}
    colKeys.forEach((key, i) => { if (key && vals[i]) row[key] = vals[i] })
    return row as unknown as ClientImportRow
  }).filter(r => r.name?.trim())
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'plantilla_clientes.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportCSV(clients: Client[]) {
  const headers = ['nombre', 'cuit', 'tipo', 'telefono', 'email', 'provincia', 'localidad', 'notas']
  const escape = (v?: string) => v ? `"${v.replace(/"/g, '""')}"` : ''
  const rows = clients.map(c => [
    escape(c.name), escape(c.cuit), escape(c.type),
    escape(c.phone), escape(c.email), escape(c.province), escape(c.city), escape(c.notes),
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr?: string): string | null {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7)  return `hace ${days} días`
  if (days < 30) return `hace ${Math.floor(days / 7)} sem.`
  if (days < 365) return `hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`
  return `hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`
}

function activityLevel(dateStr?: string): 'hot' | 'warm' | 'cold' | 'none' {
  if (!dateStr) return 'none'
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000)
  if (days <= 30) return 'hot'
  if (days <= 90) return 'warm'
  return 'cold'
}

const ACTIVITY_DOT: Record<string, string> = {
  hot:  'bg-[#22C55E]',
  warm: 'bg-[#F59E0B]',
  cold: 'bg-[#CBD5E1]',
  none: 'bg-[#E2E8F0]',
}

// ─── Import modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose }: { onClose: () => void }) {
  const { clients, importBulk } = useClientStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ClientImportRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: number; updated: number } | null>(null)
  const [fileName, setFileName] = useState('')

  const existingCuits = new Set(clients.map(c => c.cuit?.replace(/\D/g, '')).filter(Boolean))

  function handleFile(file: File) {
    setError(null); setPreview(null); setResult(null); setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length === 0) {
        setError('No se encontraron clientes válidos. Verificá que el archivo tenga la columna "nombre".')
        return
      }
      setPreview(rows)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleImport() {
    if (!preview) return
    setResult(importBulk(preview))
  }

  const newCount = preview?.filter(r => {
    const c = r.cuit?.replace(/\D/g, '') ?? ''
    return !c || !existingCuits.has(c)
  }).length ?? 0
  const updateCount = (preview?.length ?? 0) - newCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Upload size={15} className="text-[#3B82F6]" />
            </div>
            <div className="text-[15px] font-semibold text-[#0F172A]">Importar clientes</div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {!result ? (
            <>
              <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-[#0F172A]">¿Cómo debe estar el archivo?</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    CSV con columnas: nombre, cuit, tipo, telefono, email, provincia, localidad, notas
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] text-[12px] font-medium text-[#374151] rounded-lg hover:border-[#3B82F6]/40 hover:text-[#3B82F6] transition-colors cursor-pointer shrink-0 ml-3"
                >
                  <Download size={12} /> Plantilla
                </button>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#E2E8F0] rounded-xl py-8 cursor-pointer hover:border-[#3B82F6]/50 hover:bg-[#EFF6FF]/30 transition-all group"
              >
                <FileSpreadsheet size={28} className="text-[#CBD5E1] group-hover:text-[#3B82F6] transition-colors" />
                {fileName ? (
                  <div className="text-[13px] font-medium text-[#3B82F6]">{fileName}</div>
                ) : (
                  <>
                    <div className="text-[13px] font-medium text-[#374151]">Arrastrá tu archivo o hacé clic para elegir</div>
                    <div className="text-[11px] text-[#94A3B8]">Soporta .csv y .txt — también Excel exportado como CSV</div>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#EF4444]/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />{error}
                </div>
              )}

              {preview && (
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex-1 bg-[#F0FDF4] border border-[#22C55E]/20 rounded-xl p-3 text-center">
                      <div className="text-[22px] font-bold text-[#16A34A]">{newCount}</div>
                      <div className="text-[10px] text-[#16A34A] font-semibold uppercase tracking-wide mt-0.5">Nuevos</div>
                    </div>
                    {updateCount > 0 && (
                      <div className="flex-1 bg-[#EFF6FF] border border-[#3B82F6]/20 rounded-xl p-3 text-center">
                        <div className="text-[22px] font-bold text-[#2563EB]">{updateCount}</div>
                        <div className="text-[10px] text-[#2563EB] font-semibold uppercase tracking-wide mt-0.5">Actualizan</div>
                      </div>
                    )}
                    <div className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-center">
                      <div className="text-[22px] font-bold text-[#0F172A]">{preview.length}</div>
                      <div className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wide mt-0.5">Total</div>
                    </div>
                  </div>
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-44">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            {(['nombre', 'cuit', 'tipo', 'telefono', 'localidad'] as const).map(h => (
                              <th key={h} className="text-left px-3 py-2 font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                              <td className="px-3 py-1.5 font-medium text-[#0F172A] max-w-[120px] truncate">{row.name}</td>
                              <td className="px-3 py-1.5 font-mono text-[#64748B]">{row.cuit || '—'}</td>
                              <td className="px-3 py-1.5 text-[#64748B]">{row.type || '—'}</td>
                              <td className="px-3 py-1.5 text-[#64748B]">{row.phone || '—'}</td>
                              <td className="px-3 py-1.5 text-[#64748B]">{row.city || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {preview.length > 5 && (
                      <div className="px-3 py-2 text-[10px] text-[#94A3B8] bg-[#F8FAFC] border-t border-[#E2E8F0]">
                        + {preview.length - 5} filas más
                      </div>
                    )}
                  </div>
                  {updateCount > 0 && (
                    <p className="text-[11px] text-[#64748B]">
                      Los clientes que se actualizan solo completan campos vacíos — no pisarán datos existentes.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="py-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-[#F0FDF4] flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-[#22C55E]" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[#0F172A]">Importación exitosa</div>
                <div className="text-[13px] text-[#64748B] mt-1">
                  {result.added > 0 && <span>{result.added} cliente{result.added !== 1 ? 's' : ''} nuevo{result.added !== 1 ? 's' : ''}</span>}
                  {result.added > 0 && result.updated > 0 && <span> · </span>}
                  {result.updated > 0 && <span>{result.updated} actualizado{result.updated !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 pb-5">
          {!result ? (
            <>
              <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" className="flex-1" disabled={!preview || preview.length === 0} onClick={handleImport}>
                <Upload size={13} className="inline mr-1.5" />
                Importar {preview ? `${preview.length} clientes` : ''}
              </Button>
            </>
          ) : (
            <Button variant="primary" className="flex-1" onClick={onClose}>Listo</Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit / Create modal ──────────────────────────────────────────────────────

function ClientModal({ client, onClose }: { client?: Client; onClose: () => void }) {
  const { updateClient, upsertFromQuote } = useClientStore()
  const [form, setForm] = useState({
    name:     client?.name     ?? '',
    cuit:     client?.cuit     ?? '',
    type:     client?.type     ?? '' as ClientType | '',
    phone:    client?.phone    ?? '',
    email:    client?.email    ?? '',
    province: client?.province ?? '',
    city:     client?.city     ?? '',
    notes:    client?.notes    ?? '',
  })

  const handleSave = () => {
    if (!form.name.trim()) return
    const patch = { ...form, type: (form.type || undefined) as ClientType | undefined }
    if (client?.id) {
      updateClient(client.id, patch)
    } else {
      upsertFromQuote({
        ...patch,
        quote_number: '',
        quote_date: new Date().toISOString().split('T')[0],
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="text-base font-semibold text-[#0F172A]">
            {client ? 'Editar cliente' : 'Nuevo cliente'}
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <FieldGroup>
            <Label>Razón Social / Nombre *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Juan Pérez / Agropecuaria Los Sauces SA" autoFocus />
          </FieldGroup>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>CUIT</Label>
              <Input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))}
                placeholder="20-12345678-9" maxLength={13} />
            </FieldGroup>
            <FieldGroup>
              <Label>Tipo de cliente</Label>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as ClientType | '' }))}
                  className="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-lg text-[13px] text-[#0F172A] outline-none focus:border-[#22C55E]/60 transition-colors"
                >
                  <option value="">Sin especificar</option>
                  {CLIENT_TYPES.map(t => (
                    <option key={t} value={t}>{CLIENT_TYPE_CONFIG[t].label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              </div>
            </FieldGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Teléfono</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ej: 3562-123456" />
            </FieldGroup>
            <FieldGroup>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="cliente@email.com" />
            </FieldGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <Label>Provincia</Label>
              <Input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                placeholder="Ej: Córdoba" />
            </FieldGroup>
            <FieldGroup>
              <Label>Localidad</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="Ej: Río Cuarto" />
            </FieldGroup>
          </div>

          <FieldGroup>
            <Label>Notas internas</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: Prefiere contacto por WhatsApp, interesado en financiamiento..." />
          </FieldGroup>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={handleSave} disabled={!form.name.trim()}>
            <Check size={14} className="inline mr-1.5" />
            {client ? 'Guardar cambios' : 'Crear cliente'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Client detail panel ──────────────────────────────────────────────────────

function ClientDetail({ client, onClose }: { client: Client; onClose: () => void }) {
  const { deleteClient } = useClientStore()
  const { quotes } = useSavedQuotesStore()
  const [editing, setEditing] = useState(false)

  const clientQuotes = quotes.filter(q => {
    const qClient = q.data?.client
    if (!qClient) return false
    if (client.cuit && qClient.cuit?.replace(/-/g, '') === client.cuit.replace(/-/g, '')) return true
    return qClient.name?.toLowerCase() === client.name.toLowerCase()
  })

  const totalBilled = clientQuotes.reduce((sum, q) => {
    const t = q.total ?? 0
    return sum + (q.currency === 'USD' ? t * (q.exchange_rate ?? 1) : t)
  }, 0)

  const handleDelete = () => {
    if (confirm(`¿Eliminar a ${client.name}?`)) {
      deleteClient(client.id)
      onClose()
    }
  }

  const waPhone = client.phone ? `54${client.phone.replace(/\D/g, '').replace(/^0/, '')}` : ''
  const activity = activityLevel(client.last_quote_date)
  const typeCfg = client.type ? CLIENT_TYPE_CONFIG[client.type] : null
  const statusColors: Record<string, string> = {
    draft: 'text-[#94A3B8]', sent: 'text-[#F59E0B]',
    accepted: 'text-[#22C55E]', rejected: 'text-[#EF4444]', expired: 'text-[#94A3B8]',
  }
  const statusLabel: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada', rejected: 'Rechazada', expired: 'Vencida',
  }

  return (
    <>
      {editing && <ClientModal client={client} onClose={() => setEditing(false)} />}
      <div className="fixed inset-0 z-50 flex items-end sm:items-end sm:justify-end" onClick={onClose}>
        <div
          className="h-[92vh] sm:h-full w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-[#E2E8F0] shadow-2xl overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-5 py-4 z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${typeCfg ? typeCfg.bg : 'bg-[#22C55E]/10'}`}>
                    <span className={`text-[17px] font-bold ${typeCfg ? typeCfg.text : 'text-[#22C55E]'}`}>
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${ACTIVITY_DOT[activity]}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[#0F172A] leading-tight truncate">{client.name}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {client.type && <TypeBadge type={client.type} />}
                    {client.cuit && <span className="text-[11px] text-[#94A3B8] font-mono">{client.cuit}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditing(true)} className="p-2 rounded-lg text-[#94A3B8] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all cursor-pointer">
                  <Pencil size={14} />
                </button>
                <button onClick={handleDelete} className="p-2 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all cursor-pointer">
                  <Trash2 size={14} />
                </button>
                <button onClick={onClose} className="p-2 rounded-lg text-[#94A3B8] hover:text-[#0F172A] transition-all cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">

            {/* ── Actividad comercial ── */}
            <div>
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-3">Actividad comercial</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                  <div className="text-[22px] font-bold text-[#0F172A] leading-none">{client.quote_count}</div>
                  <div className="text-[9px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-1">Cotizaciones</div>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                  <div className="text-[22px] font-bold text-[#22C55E] leading-none">
                    {clientQuotes.filter(q => q.status === 'accepted').length}
                  </div>
                  <div className="text-[9px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-1">Aceptadas</div>
                </div>
                <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                  <div className="text-[11px] font-bold text-[#7C3AED] leading-none pt-1">$ {fmt(totalBilled)}</div>
                  <div className="text-[9px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-1">Total ARS</div>
                </div>
              </div>

              {client.last_quote_number && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg">
                  <FileText size={12} className="text-[#94A3B8]" />
                  <span className="text-[12px] text-[#64748B]">Última cotización:</span>
                  <span className="text-[12px] font-semibold font-mono text-[#22C55E]">{client.last_quote_number}</span>
                  {client.last_quote_date && (
                    <span className="text-[11px] text-[#CBD5E1] ml-auto">{timeAgo(client.last_quote_date)}</span>
                  )}
                </div>
              )}
            </div>

            {/* ── Datos de contacto ── */}
            <div>
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Datos de contacto</div>
              <div className="space-y-1">
                {client.phone && (
                  <a href={`tel:${client.phone}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors group">
                    <Phone size={14} className="text-[#22C55E] shrink-0" />
                    <span className="text-[13px] text-[#0F172A] flex-1">{client.phone}</span>
                    {client.phone && (
                      <a
                        href={`https://wa.me/${waPhone}`}
                        target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 text-[11px] text-[#94A3B8] hover:text-[#25D366] transition-colors"
                      >
                        <MessageCircle size={12} /> WA
                      </a>
                    )}
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#22C55E] transition-colors ml-1">Llamar</span>
                  </a>
                )}
                {client.email && (
                  <a
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email!)}`}
                target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F8FAFC] transition-colors group"
                  >
                    <Mail size={14} className="text-[#3B82F6] shrink-0" />
                    <span className="text-[13px] text-[#0F172A] truncate flex-1">{client.email}</span>
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#3B82F6] transition-colors">Enviar</span>
                  </a>
                )}
                {(client.city || client.province) && (
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <MapPin size={14} className="text-[#F59E0B] shrink-0" />
                    <span className="text-[13px] text-[#0F172A]">
                      {[client.city, client.province].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
                {!client.phone && !client.email && !client.city && (
                  <p className="text-[12px] text-[#94A3B8] italic px-3 py-2">Sin datos de contacto</p>
                )}
              </div>
            </div>

            {/* ── Notas ── */}
            {client.notes && (
              <div>
                <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">Notas internas</div>
                <div className="p-3 bg-[#FFFBEB] border border-[#FED7AA]/50 rounded-lg text-[12px] text-[#92400E] leading-relaxed">
                  {client.notes}
                </div>
              </div>
            )}

            {/* ── Historial ── */}
            <div>
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-2">
                Historial ({clientQuotes.length})
              </div>
              {clientQuotes.length === 0 ? (
                <p className="text-[12px] text-[#94A3B8] italic px-1">Sin cotizaciones guardadas</p>
              ) : (
                <div className="space-y-2">
                  {clientQuotes.map(q => (
                    <div key={q.id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                      <FileText size={13} className="text-[#94A3B8] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-[#22C55E] font-mono">{q.quote_number}</div>
                        <div className="text-[10px] text-[#94A3B8]">
                          {new Date(q.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-semibold text-[#0F172A]">{q.currency} {fmt(q.total)}</div>
                        <div className={`text-[10px] font-medium ${statusColors[q.status] ?? 'text-[#94A3B8]'}`}>
                          {statusLabel[q.status] ?? q.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer meta */}
            <div className="pt-3 border-t border-[#F1F5F9] text-[10px] text-[#CBD5E1]">
              Cliente desde {new Date(client.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Client row ───────────────────────────────────────────────────────────────

function ClientRow({ client, onClick }: { client: Client; onClick: () => void }) {
  const activity = activityLevel(client.last_quote_date)
  const ago      = timeAgo(client.last_quote_date)
  const waPhone  = client.phone ? `54${client.phone.replace(/\D/g, '').replace(/^0/, '')}` : ''
  const typeCfg  = client.type ? CLIENT_TYPE_CONFIG[client.type] : null

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3 border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer group transition-colors"
    >
      {/* Avatar + activity dot */}
      <div className="relative shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${typeCfg ? typeCfg.bg : 'bg-[#22C55E]/10'}`}>
          <span className={`text-[12px] font-bold ${typeCfg ? typeCfg.text : 'text-[#22C55E]'}`}>
            {client.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${ACTIVITY_DOT[activity]}`} />
      </div>

      {/* Name + type + cuit/location */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-[#0F172A] truncate group-hover:text-[#22C55E] transition-colors">
            {client.name}
          </span>
          {client.type && <TypeBadge type={client.type} />}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {client.cuit && <span className="text-[11px] text-[#94A3B8] font-mono">{client.cuit}</span>}
          {(client.city || client.province) && (
            <span className="text-[11px] text-[#94A3B8]">
              {[client.city, client.province].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Contact icons */}
      <div className="hidden sm:flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
        {client.phone && (
          <a href={`tel:${client.phone}`} title={client.phone}
            className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-[#22C55E] hover:bg-[#F0FDF4] transition-all">
            <Phone size={13} />
          </a>
        )}
        {client.phone && (
          <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" title="WhatsApp"
            className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-[#25D366] hover:bg-[#F0FDF4] transition-all">
            <MessageCircle size={13} />
          </a>
        )}
        {client.email && (
          <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}`}
            target="_blank" rel="noreferrer" title={client.email}
            className="p-1.5 rounded-lg text-[#CBD5E1] hover:text-[#3B82F6] hover:bg-[#EFF6FF] transition-all">
            <Mail size={13} />
          </a>
        )}
      </div>

      {/* Last quote */}
      <div className="hidden md:flex flex-col items-end shrink-0 w-[110px]">
        {client.last_quote_number
          ? <span className="text-[12px] font-mono font-semibold text-[#22C55E]">{client.last_quote_number}</span>
          : <span className="text-[11px] text-[#E2E8F0] italic">—</span>
        }
        {ago && <span className="text-[10px] text-[#CBD5E1] mt-0.5">{ago}</span>}
      </div>

      {/* Quote count */}
      <div className="shrink-0 text-right w-8">
        <div className="text-[14px] font-bold text-[#0F172A] leading-none">{client.quote_count}</div>
        <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">cotiz.</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SortKey = 'recent' | 'name' | 'quotes'

export function ClientsPage() {
  const { clients } = useClientStore()
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')

  const filtered = useMemo(() => {
    let list = clients.filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        c.name.toLowerCase().includes(q) ||
        (c.cuit ?? '').includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      )
    })
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    else if (sort === 'quotes') list = [...list].sort((a, b) => b.quote_count - a.quote_count)
    return list
  }, [clients, search, sort])

  const totalQuotes = clients.reduce((s, c) => s + c.quote_count, 0)

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} cliente${clients.length !== 1 ? 's' : ''} · ${totalQuotes} cotizaciones`}
        actions={
          <div className="flex items-center gap-2">
            {clients.length > 0 && (
              <button
                onClick={() => exportCSV(clients)}
                title="Exportar clientes como CSV"
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] text-[12px] font-medium text-[#374151] rounded-lg hover:border-[#22C55E]/40 hover:text-[#16A34A] transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] text-[12px] font-medium text-[#374151] rounded-lg hover:border-[#3B82F6]/40 hover:text-[#3B82F6] transition-colors cursor-pointer"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Importar CSV</span>
              <span className="sm:hidden">Importar</span>
            </button>
            <Button variant="primary" onClick={() => setShowNew(true)} className="flex items-center gap-1.5">
              <Plus size={12} />
              <span className="hidden sm:inline">Nuevo cliente</span>
              <span className="sm:hidden">Nuevo</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 md:p-8">

        {/* Search + Sort row */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Buscar por nombre, CUIT, email o ciudad..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#22C55E]/60 transition-colors shadow-sm"
            />
          </div>

          {/* Sort */}
          <div className="relative shrink-0">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[13px] text-[#374151] outline-none focus:border-[#22C55E]/60 transition-colors shadow-sm cursor-pointer"
            >
              <option value="recent">Más reciente</option>
              <option value="name">Nombre A–Z</option>
              <option value="quotes">Más cotizaciones</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          </div>
        </div>

        {/* Empty state */}
        {clients.length === 0 && (
          <Card className="text-center py-16">
            <Users size={32} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="text-lg font-medium text-[#94A3B8]">Sin clientes todavía</p>
            <p className="text-[12px] text-[#94A3B8] mt-1 max-w-sm mx-auto">
              Los clientes se agregan automáticamente al guardar cotizaciones, o podés importar tu lista existente.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button onClick={() => setShowImport(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#E2E8F0] text-[#374151] text-[13px] font-medium rounded-lg hover:border-[#3B82F6]/40 hover:text-[#3B82F6] transition-colors cursor-pointer">
                <Upload size={13} /> Importar CSV
              </button>
              <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#22C55E] text-white text-[13px] font-medium rounded-lg hover:bg-[#16A34A] transition-colors cursor-pointer">
                <Plus size={13} /> Agregar manualmente
              </button>
            </div>
          </Card>
        )}

        {/* List */}
        {clients.length > 0 && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="flex items-center gap-4 px-4 py-2 border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="w-8 shrink-0" />
              <div className="flex-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Cliente</div>
              <div className="hidden sm:block w-[76px] shrink-0" />
              <div className="hidden md:block w-[110px] text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right shrink-0">Última cotiz.</div>
              <div className="w-8 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider text-right shrink-0">#</div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-10 text-center text-[#94A3B8] text-[13px]">
                Sin resultados para "{search}"
              </div>
            ) : (
              filtered.map(c => (
                <ClientRow key={c.id} client={c} onClick={() => setSelectedClient(c)} />
              ))
            )}
          </div>
        )}
      </div>

      {showNew && <ClientModal onClose={() => setShowNew(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {selectedClient && (
        <ClientDetail client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  )
}
