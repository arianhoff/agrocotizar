import { useState, useRef } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Button, Input, Label, FieldGroup, Textarea } from '@/components/ui'
import { useClientStore, type Client, type ClientImportRow } from '@/store/clientStore'
import { useSavedQuotesStore } from '@/store/savedQuotesStore'
import { fmt } from '@/utils'
import {
  Users, Search, Phone, Mail, MapPin, FileText, Plus,
  Pencil, Trash2, X, Check, MessageCircle, Upload, Download,
  AlertCircle, CheckCircle2, FileSpreadsheet,
} from 'lucide-react'

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const TEMPLATE_CSV = `nombre,cuit,telefono,email,provincia,localidad,notas
Juan Pérez,20-12345678-9,3562-123456,juan@email.com,Córdoba,Río Cuarto,Cliente frecuente
Agropecuaria Los Sauces SA,30-98765432-1,351-4567890,info@lossauces.com.ar,Santa Fe,Rosario,`

const COL_MAP: Record<string, keyof ClientImportRow> = {
  nombre: 'name', name: 'name',
  cuit: 'cuit', 'cuit/cuil': 'cuit', cuil: 'cuit',
  telefono: 'phone', phone: 'phone', tel: 'phone', celular: 'phone', movil: 'phone',
  email: 'email', correo: 'email', 'e-mail': 'email',
  provincia: 'province', province: 'province',
  localidad: 'city', ciudad: 'city', city: 'city',
  notas: 'notes', notes: 'notes', observaciones: 'notes', comentarios: 'notes',
}

function parseCSV(text: string): ClientImportRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse a CSV line respecting quoted fields
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
  const headers = ['nombre', 'cuit', 'telefono', 'email', 'provincia', 'localidad', 'notas']
  const escape = (v?: string) => v ? `"${v.replace(/"/g, '""')}"` : ''
  const rows = clients.map(c => [
    escape(c.name), escape(c.cuit), escape(c.phone),
    escape(c.email), escape(c.province), escape(c.city), escape(c.notes),
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
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
    setError(null)
    setPreview(null)
    setResult(null)
    setFileName(file.name)
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
    const res = importBulk(preview)
    setResult(res)
  }

  const newCount = preview?.filter(r => {
    const c = r.cuit?.replace(/\D/g, '') ?? ''
    return !c || !existingCuits.has(c)
  }).length ?? 0
  const updateCount = (preview?.length ?? 0) - newCount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-white rounded-xl shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
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
              {/* Template download */}
              <div className="flex items-center justify-between bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-3">
                <div>
                  <div className="text-[13px] font-medium text-[#0F172A]">¿Cómo debe estar el archivo?</div>
                  <div className="text-[11px] text-[#64748B] mt-0.5">
                    CSV con columnas: nombre, cuit, telefono, email, provincia, localidad, notas
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] text-[12px] font-medium text-[#374151] rounded-lg hover:border-[#3B82F6]/40 hover:text-[#3B82F6] transition-colors cursor-pointer shrink-0 ml-3"
                >
                  <Download size={12} /> Plantilla
                </button>
              </div>

              {/* File drop zone */}
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

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#EF4444]/20 rounded-lg px-3 py-2.5">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className="space-y-3">
                  {/* Summary */}
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

                  {/* Table preview */}
                  <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-44">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            {(['nombre', 'cuit', 'telefono', 'email', 'localidad'] as const).map(h => (
                              <th key={h} className="text-left px-3 py-2 font-semibold text-[#64748B] uppercase tracking-wide whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                              <td className="px-3 py-1.5 font-medium text-[#0F172A] max-w-[120px] truncate">{row.name}</td>
                              <td className="px-3 py-1.5 font-mono text-[#64748B]">{row.cuit || '—'}</td>
                              <td className="px-3 py-1.5 text-[#64748B]">{row.phone || '—'}</td>
                              <td className="px-3 py-1.5 text-[#64748B] max-w-[120px] truncate">{row.email || '—'}</td>
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
            /* Success */
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

        {/* Footer */}
        <div className="flex gap-2 px-6 pb-5">
          {!result ? (
            <>
              <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
              <Button
                variant="primary"
                className="flex-1"
                disabled={!preview || preview.length === 0}
                onClick={handleImport}
              >
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
    phone:    client?.phone    ?? '',
    email:    client?.email    ?? '',
    province: client?.province ?? '',
    city:     client?.city     ?? '',
    notes:    client?.notes    ?? '',
  })

  const handleSave = () => {
    if (!form.name.trim()) return
    if (client?.id) {
      updateClient(client.id, form)
    } else {
      upsertFromQuote({
        ...form,
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
          <FieldGroup>
            <Label>CUIT</Label>
            <Input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))}
              placeholder="20-12345678-9" maxLength={13} />
          </FieldGroup>
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

  // Quotes linked to this client (by name or CUIT)
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

  return (
    <>
      {editing && <ClientModal client={client} onClose={() => setEditing(false)} />}
      <div className="fixed inset-0 z-50 flex items-end sm:items-end sm:justify-end" onClick={onClose}>
        <div
          className="h-[92vh] sm:h-full w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-[#E2E8F0] shadow-2xl overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-[#E2E8F0] px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center shrink-0">
                <span className="text-[#22C55E] text-[14px] font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#0F172A] leading-tight">{client.name}</div>
                {client.cuit && <div className="text-[11px] text-[#94A3B8] font-mono">{client.cuit}</div>}
              </div>
            </div>
            <div className="flex items-center gap-1">
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

          <div className="p-6 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#0F172A]">{clientQuotes.length}</div>
                <div className="text-[10px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-0.5">Cotizaciones</div>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                <div className="text-[20px] font-bold text-[#22C55E]">
                  {clientQuotes.filter(q => q.status === 'accepted').length}
                </div>
                <div className="text-[10px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-0.5">Aceptadas</div>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3 text-center border border-[#E2E8F0]">
                <div className="text-[13px] font-bold text-[#7C3AED]">$ {fmt(totalBilled)}</div>
                <div className="text-[10px] text-[#94A3B8] font-semibold tracking-wide uppercase mt-0.5">Total ARS</div>
              </div>
            </div>

            {/* Contact info */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8]">Contacto</div>
              {client.phone && (
                <a href={`tel:${client.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors group">
                  <Phone size={14} className="text-[#22C55E] shrink-0" />
                  <span className="text-[13px] text-[#0F172A]">{client.phone}</span>
                  <span className="text-[10px] text-[#94A3B8] ml-auto group-hover:text-[#22C55E] transition-colors">Llamar</span>
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#F8FAFC] transition-colors group">
                  <Mail size={14} className="text-[#3B82F6] shrink-0" />
                  <span className="text-[13px] text-[#0F172A] truncate">{client.email}</span>
                  <span className="text-[10px] text-[#94A3B8] ml-auto group-hover:text-[#3B82F6] transition-colors">Email</span>
                </a>
              )}
              {(client.city || client.province) && (
                <div className="flex items-center gap-3 p-3">
                  <MapPin size={14} className="text-[#F59E0B] shrink-0" />
                  <span className="text-[13px] text-[#0F172A]">
                    {[client.city, client.province].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {!client.phone && !client.email && !client.city && (
                <p className="text-[12px] text-[#94A3B8] italic pl-3">Sin datos de contacto</p>
              )}
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="space-y-2">
                <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8]">Notas internas</div>
                <div className="p-3 bg-[#FFFBEB] border border-[#FED7AA]/50 rounded-lg text-[12px] text-[#92400E] leading-relaxed">
                  {client.notes}
                </div>
              </div>
            )}

            {/* Quote history */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#94A3B8]">
                Historial de cotizaciones ({clientQuotes.length})
              </div>
              {clientQuotes.length === 0 ? (
                <p className="text-[12px] text-[#94A3B8] italic">Sin cotizaciones guardadas</p>
              ) : (
                <div className="space-y-2">
                  {clientQuotes.map(q => {
                    const statusColors: Record<string, string> = {
                      draft: 'text-[#94A3B8]', sent: 'text-[#F59E0B]',
                      accepted: 'text-[#22C55E]', rejected: 'text-[#EF4444]', expired: 'text-[#94A3B8]',
                    }
                    const statusLabel: Record<string, string> = {
                      draft: 'Borrador', sent: 'Enviada', accepted: 'Aceptada',
                      rejected: 'Rechazada', expired: 'Vencida',
                    }
                    return (
                      <div key={q.id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                        <FileText size={13} className="text-[#94A3B8] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-[#22C55E] font-mono">{q.quote_number}</div>
                          <div className="text-[10px] text-[#94A3B8]">
                            {new Date(q.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[12px] font-semibold text-[#0F172A]">
                            {q.currency} {fmt(q.total)}
                          </div>
                          <div className={`text-[10px] font-medium ${statusColors[q.status] ?? 'text-[#94A3B8]'}`}>
                            {statusLabel[q.status] ?? q.status}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer meta */}
            <div className="pt-3 border-t border-[#F1F5F9] text-[10px] text-[#CBD5E1] space-y-0.5">
              <div>Cliente desde {new Date(client.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
              {client.last_quote_number && (
                <div>Última cotización: {client.last_quote_number}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
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

const ACTIVITY_LABEL: Record<string, string> = {
  hot:  'Activo',
  warm: 'Inactivo',
  cold: 'Frío',
  none: '',
}

// ─── Client card ──────────────────────────────────────────────────────────────

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  const activity = activityLevel(client.last_quote_date)
  const ago      = timeAgo(client.last_quote_date)
  const waPhone  = client.phone ? `54${client.phone.replace(/\D/g, '').replace(/^0/, '')}` : ''

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-xl cursor-pointer hover:border-[#22C55E]/40 hover:shadow-lg transition-all group overflow-hidden flex flex-col"
    >
      {/* ── Main body ── */}
      <div className="p-4 flex-1">

        {/* Header: avatar + name + quote count */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with activity dot */}
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-[#22C55E]/10 flex items-center justify-center">
                <span className="text-[#22C55E] text-[16px] font-bold">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${ACTIVITY_DOT[activity]}`}
                title={ACTIVITY_LABEL[activity]}
              />
            </div>

            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#0F172A] truncate group-hover:text-[#22C55E] transition-colors leading-tight">
                {client.name}
              </div>
              {client.cuit
                ? <div className="text-[11px] text-[#94A3B8] font-mono mt-0.5">{client.cuit}</div>
                : <div className="text-[11px] text-[#CBD5E1] mt-0.5 italic">Sin CUIT</div>
              }
            </div>
          </div>

          {/* Quote count */}
          <div className="shrink-0 text-right">
            <div className="text-[20px] font-bold text-[#0F172A] leading-none">{client.quote_count}</div>
            <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide mt-0.5">cotiz.</div>
          </div>
        </div>

        {/* Location */}
        {(client.city || client.province) && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin size={11} className="text-[#F59E0B] shrink-0" />
            <span className="text-[12px] text-[#64748B] truncate">
              {[client.city, client.province].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Quick contact actions — stop propagation so they don't open the detail panel */}
        {(client.phone || client.email) && (
          <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#22C55E]/20 text-[#16A34A] text-[11px] font-medium rounded-lg hover:bg-[#22C55E] hover:text-white hover:border-[#22C55E] transition-all"
              >
                <Phone size={11} /> Llamar
              </a>
            )}
            {client.phone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0FDF4] border border-[#22C55E]/20 text-[#16A34A] text-[11px] font-medium rounded-lg hover:bg-[#25D366] hover:text-white hover:border-[#25D366] transition-all"
              >
                <MessageCircle size={11} /> WhatsApp
              </a>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#EFF6FF] border border-[#3B82F6]/20 text-[#3B82F6] text-[11px] font-medium rounded-lg hover:bg-[#3B82F6] hover:text-white hover:border-[#3B82F6] transition-all"
              >
                <Mail size={11} /> Email
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC] flex items-center justify-between">
        {client.last_quote_number ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <FileText size={11} className="text-[#94A3B8] shrink-0" />
            <span className="text-[11px] text-[#94A3B8] truncate">
              Última: <span className="font-mono text-[#22C55E] font-semibold">{client.last_quote_number}</span>
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-[#CBD5E1] italic">Sin cotizaciones</span>
        )}
        {ago && (
          <span className="text-[10px] text-[#CBD5E1] shrink-0 ml-2">{ago}</span>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { clients } = useClientStore()
  const [search, setSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.cuit ?? '').includes(search) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.city ?? '').toLowerCase().includes(search.toLowerCase())
  )

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
        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Buscar por nombre, CUIT, email o ciudad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#22C55E]/60 transition-colors shadow-sm"
          />
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

        {/* No results */}
        {clients.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-[#94A3B8] text-[13px]">
            Sin resultados para "{search}"
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => (
              <ClientCard key={c.id} client={c} onClick={() => setSelectedClient(c)} />
            ))}
          </div>
        )}
      </div>

      {showNew && <ClientModal onClose={() => setShowNew(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  )
}
