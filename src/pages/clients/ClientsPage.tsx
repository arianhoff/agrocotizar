import { useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, Button, Input, Label, FieldGroup, Textarea, Badge } from '@/components/ui'
import { useClientStore, type Client } from '@/store/clientStore'
import { useSavedQuotesStore } from '@/store/savedQuotesStore'
import { cn } from '@/utils'
import { fmt } from '@/utils'
import {
  Users, Search, Phone, Mail, MapPin, FileText, Plus,
  Pencil, Trash2, X, Check, Building2, Calendar, TrendingUp,
} from 'lucide-react'

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

// ─── Client card ──────────────────────────────────────────────────────────────

function ClientCard({ client, onClick }: { client: Client; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-xl p-5 cursor-pointer hover:border-[#22C55E]/40 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#22C55E]/10 flex items-center justify-center shrink-0">
          <span className="text-[#22C55E] text-[15px] font-bold">
            {client.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#0F172A] truncate group-hover:text-[#22C55E] transition-colors">
            {client.name}
          </div>
          {client.cuit && (
            <div className="text-[11px] text-[#94A3B8] font-mono mt-0.5">{client.cuit}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[18px] font-bold text-[#0F172A]">{client.quote_count}</div>
          <div className="text-[9px] text-[#94A3B8] uppercase tracking-wide">cotiz.</div>
        </div>
      </div>

      {/* Contact row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {client.phone && (
          <div className="flex items-center gap-1.5">
            <Phone size={11} className="text-[#22C55E]" />
            <span className="text-[11px] text-[#64748B]">{client.phone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail size={11} className="text-[#3B82F6] shrink-0" />
            <span className="text-[11px] text-[#64748B] truncate">{client.email}</span>
          </div>
        )}
        {(client.city || client.province) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-[#F59E0B]" />
            <span className="text-[11px] text-[#64748B]">{[client.city, client.province].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#F1F5F9]">
        {client.last_quote_number ? (
          <div className="flex items-center gap-1.5">
            <FileText size={11} className="text-[#94A3B8]" />
            <span className="text-[11px] text-[#94A3B8]">Última: <span className="font-mono text-[#22C55E]">{client.last_quote_number}</span></span>
          </div>
        ) : <div />}
        {client.last_quote_date && (
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-[#CBD5E1]" />
            <span className="text-[10px] text-[#CBD5E1]">
              {new Date(client.last_quote_date + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
          </div>
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
          <Button variant="primary" onClick={() => setShowNew(true)} className="flex items-center gap-1.5">
            <Plus size={12} />
            <span className="hidden sm:inline">Nuevo cliente</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
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
            <p className="text-lg font-medium text-[#94A3B8]">Sin clientes</p>
            <p className="text-[12px] text-[#94A3B8] mt-1">
              Los clientes se agregan automáticamente cuando guardás o enviás una cotización.
            </p>
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#22C55E] text-white text-[13px] font-medium rounded-lg hover:bg-[#16A34A] transition-colors cursor-pointer">
              <Plus size={13} /> Agregar manualmente
            </button>
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
      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  )
}
