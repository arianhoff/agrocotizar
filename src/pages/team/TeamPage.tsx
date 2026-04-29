import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { useTeamStore, type TeamMember } from '@/store/teamStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { supabase } from '@/lib/supabase/client'
import { UserPlus, Trash2, Users, X, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { fmtDate } from '@/utils'

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function apiFetch(method: string, body?: object) {
  const token = await getToken()
  const res = await fetch('/api/team', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// ─── Add member modal ────────────────────────────────────────

function AddMemberModal({ onClose, onAdded }: { onClose: () => void; onAdded: (m: TeamMember) => void }) {
  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name || !form.email || !form.password)
      return setError('Completá todos los campos')
    if (form.password.length < 8)
      return setError('La contraseña debe tener al menos 8 caracteres')

    setLoading(true)
    const res = await apiFetch('POST', { action: 'create', ...form })
    setLoading(false)

    if (res.error) {
      setError(res.message ?? res.error)
      return
    }
    onAdded({ id: res.member.id, email: res.member.email, name: res.member.name, created_at: new Date().toISOString() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F172A]">Agregar vendedor</h2>
            <p className="text-[12px] text-[#94A3B8] mt-0.5">El vendedor podrá ingresar con estas credenciales</p>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Juan Pérez"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="vendedor@empresa.com"
              className="w-full px-3 py-2.5 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] placeholder-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E]"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-[#FEF2F2] border border-[#FCA5A5]/40 rounded-lg">
              <AlertTriangle size={13} className="text-[#EF4444] shrink-0" />
              <span className="text-[12px] text-[#EF4444]">{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#22C55E] text-white text-[13px] font-semibold rounded-xl hover:bg-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {loading ? 'Creando...' : 'Crear vendedor'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-[13px] font-medium text-[#64748B] hover:bg-[#F1F5F9] rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── TeamPage ─────────────────────────────────────────────────

export function TeamPage() {
  const { members, setMembers, removeMember } = useTeamStore()
  const { isAdmin, isActive }                 = useSubscriptionStore()
  const [showAdd, setShowAdd]                 = useState(false)
  const [loading, setLoading]                 = useState(true)
  const [confirmRemove, setConfirmRemove]     = useState<string | null>(null)
  const [removing, setRemoving]               = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    apiFetch('GET')
      .then(res => { if (res.members) setMembers(res.members) })
      .finally(() => setLoading(false))
  }, [isAdmin])

  async function handleRemove(id: string) {
    setRemoving(true)
    const res = await apiFetch('POST', { action: 'remove', memberId: id })
    setRemoving(false)
    if (!res.error) {
      removeMember(id)
      setConfirmRemove(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Users size={40} className="text-[#CBD5E1] mb-4" />
        <p className="text-[14px] text-[#94A3B8]">Esta sección es exclusiva del plan Concesionarios.</p>
      </div>
    )
  }

  const seatsUsed  = members.length
  const seatsTotal = 5

  return (
    <div className="pb-20 lg:pb-0">
      <PageHeader
        title="Equipo"
        subtitle={`${seatsUsed} / ${seatsTotal} vendedores`}
        actions={
          isActive && seatsUsed < seatsTotal ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#22C55E] text-white text-[13px] font-semibold rounded-xl hover:bg-[#16A34A] transition-colors cursor-pointer shadow-sm shadow-[#22C55E]/20"
            >
              <UserPlus size={14} />
              Agregar vendedor
            </button>
          ) : undefined
        }
      />

      <div className="p-4 sm:p-6 md:p-8 max-w-3xl">

        {/* Seats indicator */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">Vendedores activos</span>
            <span className="text-[13px] font-bold text-[#0F172A]">{seatsUsed} / {seatsTotal}</span>
          </div>
          <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#22C55E] rounded-full transition-all"
              style={{ width: `${(seatsUsed / seatsTotal) * 100}%` }}
            />
          </div>
          {seatsUsed >= seatsTotal && (
            <p className="text-[11px] text-[#F59E0B] mt-2 font-medium">Límite alcanzado. Eliminá un vendedor para agregar uno nuevo.</p>
          )}
        </div>

        {/* Members list */}
        {loading ? (
          <div className="text-[13px] text-[#94A3B8] py-8 text-center">Cargando equipo...</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] flex items-center justify-center mb-4">
              <Users size={24} className="text-[#22C55E]" />
            </div>
            <p className="text-[14px] font-semibold text-[#0F172A] mb-1">Sin vendedores todavía</p>
            <p className="text-[13px] text-[#94A3B8]">Agregá tu primer vendedor con el botón de arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {members.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#E2E8F0] shadow-sm"
              >
                <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center shrink-0">
                  <span className="text-[#22C55E] text-[13px] font-bold">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-[#0F172A] truncate">{m.name}</div>
                  <div className="text-[12px] text-[#64748B] truncate">{m.email}</div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5">
                    Agregado el {fmtDate(m.created_at)}
                  </div>
                </div>
                {confirmRemove === m.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-[#EF4444] font-medium">¿Eliminar?</span>
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={removing}
                      className="px-3 py-1.5 bg-[#EF4444] text-white text-[11px] font-semibold rounded-lg hover:bg-[#DC2626] disabled:opacity-50 cursor-pointer transition-colors"
                    >
                      {removing ? '...' : 'Sí'}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="px-3 py-1.5 bg-[#F1F5F9] text-[#64748B] text-[11px] font-semibold rounded-lg hover:bg-[#E2E8F0] cursor-pointer transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(m.id)}
                    className="text-[#CBD5E1] hover:text-[#EF4444] transition-colors cursor-pointer shrink-0 p-1"
                    title="Eliminar vendedor"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-[11px] text-[#CBD5E1] leading-relaxed">
          Al eliminar un vendedor se elimina su acceso y todos sus datos (cotizaciones, clientes, seguimientos).
          Esta acción no se puede deshacer.
        </p>
      </div>

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onAdded={(m) => setMembers([...members, m])}
        />
      )}
    </div>
  )
}
