import { useState, useRef } from 'react'
import {
  User, Building2, FileText, Lock, Upload, X, Check,
  Phone, Mail, Globe, MapPin, Hash, Banknote, Clock, ChevronRight, CreditCard,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Button, Input, Select, Textarea, FieldGroup, Label } from '@/components/ui'
import { useSettingsStore } from '@/store/settingsStore'
import type { SellerProfile, CompanyProfile, QuoteDefaults } from '@/store/settingsStore'
import { SubscriptionSection } from './SubscriptionSection'
import { useSubscriptionStore } from '@/store/subscriptionStore'

// ─── Section nav ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'seller',       icon: User,        label: 'Vendedor',       desc: 'Tu perfil personal' },
  { id: 'company',      icon: Building2,   label: 'Empresa',        desc: 'Datos de tu empresa' },
  { id: 'quotes',       icon: FileText,    label: 'Cotizaciones',   desc: 'Valores por defecto' },
  { id: 'subscription', icon: CreditCard,  label: 'Suscripción',    desc: 'Plan y facturación' },
  { id: 'account',      icon: Lock,        label: 'Cuenta',         desc: 'Acceso y seguridad' },
] as const

type SectionId = typeof SECTIONS[number]['id']

// ─── Save banner ──────────────────────────────────────────────────────────────
function SaveBanner({ onSave, onDiscard }: { onSave: () => void; onDiscard: () => void }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#0F172A] text-white px-5 py-3 rounded-xl shadow-2xl border border-white/10 w-[calc(100%-2rem)] sm:w-auto justify-between sm:justify-start">
      <span className="text-[13px]">Tenés cambios sin guardar</span>
      <Button variant="ghost" onClick={onDiscard} className="text-white/60 hover:text-white hover:bg-white/10 text-[12px] py-1.5 px-3">
        Descartar
      </Button>
      <button
        onClick={onSave}
        className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
      >
        <Check size={14} /> Guardar cambios
      </button>
    </div>
  )
}

// ─── Logo uploader ────────────────────────────────────────────────────────────
function LogoUploader({ value, onChange }: { value: string; onChange: (b64: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-4">
      <div
        onClick={() => ref.current?.click()}
        className="w-20 h-20 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center cursor-pointer hover:border-[#22C55E]/50 hover:bg-[#F0FDF4] transition-colors overflow-hidden shrink-0"
      >
        {value
          ? <img src={value} alt="Logo" className="w-full h-full object-contain p-1" />
          : <Upload size={20} className="text-[#CBD5E1]" />
        }
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={() => ref.current?.click()} className="text-[12px] py-1.5">
          <Upload size={13} /> {value ? 'Cambiar logo' : 'Subir logo'}
        </Button>
        {value && (
          <button onClick={() => onChange('')} className="flex items-center gap-1.5 text-[11px] text-[#EF4444] hover:text-[#DC2626] cursor-pointer transition-colors">
            <X size={11} /> Eliminar logo
          </button>
        )}
        <p className="text-[11px] text-[#94A3B8]">PNG, JPG o SVG · Máx. 2 MB</p>
      </div>
    </div>
  )
}

// ─── Field with icon ──────────────────────────────────────────────────────────
function IconField({
  icon: Icon, label, value, onChange, placeholder, type = 'text',
}: {
  icon: React.ElementType
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <FieldGroup>
      <Label>{label}</Label>
      <div className="relative">
        <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        <Input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
    </FieldGroup>
  )
}

// ─── Section: Vendedor ────────────────────────────────────────────────────────
function SellerSection({ draft, onChange }: { draft: SellerProfile; onChange: (p: Partial<SellerProfile>) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={User}
        title="Perfil del vendedor"
        desc="Tu nombre e información de contacto aparecen en las cotizaciones enviadas."
      />

      {/* Avatar */}
      <div className="flex items-center gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center shrink-0">
          <span className="text-white text-xl font-bold">
            {draft.name ? draft.name.charAt(0).toUpperCase() : '?'}
          </span>
        </div>
        <div>
          <div className="text-[14px] font-semibold text-[#0F172A]">{draft.name || 'Sin nombre'}</div>
          <div className="text-[12px] text-[#94A3B8]">{draft.role}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup>
          <Label>Nombre completo</Label>
          <Input value={draft.name} onChange={e => onChange({ name: e.target.value })} placeholder="Ej: Juan Pérez" />
        </FieldGroup>
        <FieldGroup>
          <Label>Rol / Cargo</Label>
          <Input value={draft.role} onChange={e => onChange({ role: e.target.value })} placeholder="Ej: Vendedor, Gerente..." />
        </FieldGroup>
      </div>

      <IconField icon={Mail} label="Email" value={draft.email} onChange={v => onChange({ email: v })} placeholder="vendedor@empresa.com" type="email" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IconField icon={Phone} label="Teléfono" value={draft.phone} onChange={v => onChange({ phone: v })} placeholder="+54 9 11 0000-0000" />
        <IconField icon={Phone} label="WhatsApp" value={draft.whatsapp} onChange={v => onChange({ whatsapp: v })} placeholder="+54 9 11 0000-0000" />
      </div>
    </div>
  )
}

// ─── Section: Empresa ─────────────────────────────────────────────────────────
function CompanySection({ draft, onChange }: { draft: CompanyProfile; onChange: (p: Partial<CompanyProfile>) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Building2}
        title="Datos de la empresa"
        desc="Esta información aparece en el encabezado de todas las cotizaciones."
      />

      {/* Logo */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
        <div className="text-[11px] font-semibold text-[#64748B] mb-3">Logo de la empresa</div>
        <LogoUploader value={draft.logo_base64} onChange={v => onChange({ logo_base64: v })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup>
          <Label>Nombre de la empresa</Label>
          <Input value={draft.name} onChange={e => onChange({ name: e.target.value })} placeholder="Ej: Agromec S.A." />
        </FieldGroup>
        <IconField icon={Hash} label="CUIT" value={draft.cuit} onChange={v => onChange({ cuit: v })} placeholder="30-00000000-0" />
      </div>

      <IconField icon={MapPin} label="Dirección" value={draft.address} onChange={v => onChange({ address: v })} placeholder="Av. San Martín 123" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldGroup>
          <Label>Ciudad</Label>
          <Input value={draft.city} onChange={e => onChange({ city: e.target.value })} placeholder="Ej: Rosario" />
        </FieldGroup>
        <FieldGroup>
          <Label>Provincia</Label>
          <Input value={draft.province} onChange={e => onChange({ province: e.target.value })} placeholder="Ej: Santa Fe" />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <IconField icon={Phone} label="Teléfono empresa" value={draft.phone} onChange={v => onChange({ phone: v })} placeholder="+54 341 000-0000" />
        <IconField icon={Mail} label="Email empresa" value={draft.email} onChange={v => onChange({ email: v })} placeholder="info@empresa.com" type="email" />
      </div>

      <IconField icon={Globe} label="Sitio web" value={draft.website} onChange={v => onChange({ website: v })} placeholder="www.empresa.com" />
    </div>
  )
}

// ─── Section: Cotizaciones ────────────────────────────────────────────────────
function QuotesSection({ draft, onChange }: { draft: QuoteDefaults; onChange: (p: Partial<QuoteDefaults>) => void }) {
  return (
    <div className="space-y-6">
      <SectionHeader
        icon={FileText}
        title="Configuración de cotizaciones"
        desc="Valores por defecto que se usan al crear una nueva cotización."
      />

      {/* Numeración */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-4">
        <div className="text-[11px] font-semibold text-[#64748B]">Numeración</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup>
            <Label>Prefijo</Label>
            <Input value={draft.prefix} onChange={e => onChange({ prefix: e.target.value })} placeholder="COT-" />
          </FieldGroup>
          <div className="flex flex-col justify-end pb-0.5">
            <div className="text-[11px] text-[#94A3B8] mb-1">Vista previa</div>
            <div className="text-[14px] font-mono font-semibold text-[#0F172A]">{draft.prefix}1234</div>
          </div>
        </div>
      </div>

      {/* Moneda y tipo de cambio */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-4">
        <div className="text-[11px] font-semibold text-[#64748B]">Moneda y tipo de cambio</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup>
            <Label>Moneda por defecto</Label>
            <Select value={draft.currency} onChange={e => onChange({ currency: e.target.value as 'USD' | 'ARS' })}>
              <option value="USD">USD — Dólar</option>
              <option value="ARS">ARS — Peso argentino</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Tipo de cambio</Label>
            <div className="relative">
              <Banknote size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              <Input
                type="number"
                value={draft.exchange_rate}
                onChange={e => onChange({ exchange_rate: Number(e.target.value) })}
                min={1}
                className="pl-9"
              />
            </div>
          </FieldGroup>
        </div>
      </div>

      {/* Validez y pago */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-4">
        <div className="text-[11px] font-semibold text-[#64748B]">Condición de pago por defecto</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FieldGroup>
            <Label>Validez (días)</Label>
            <div className="relative">
              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
              <Input
                type="number"
                value={draft.valid_days}
                onChange={e => onChange({ valid_days: Number(e.target.value) })}
                min={1}
                className="pl-9"
              />
            </div>
          </FieldGroup>
          <FieldGroup>
            <Label>Forma de pago</Label>
            <Select value={draft.payment_mode} onChange={e => onChange({ payment_mode: e.target.value as QuoteDefaults['payment_mode'] })}>
              <option value="contado">Contado</option>
              <option value="cheques">Cheques / Valores</option>
              <option value="financiado">Financiado</option>
              <option value="leasing">Leasing</option>
            </Select>
          </FieldGroup>
          <FieldGroup>
            <Label>Descuento contado %</Label>
            <Input
              type="number"
              value={draft.payment_discount_pct}
              onChange={e => onChange({ payment_discount_pct: Number(e.target.value) })}
              min={0}
              max={100}
              step={0.5}
            />
          </FieldGroup>
        </div>
      </div>

      {/* Impuestos */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-4">
        <div className="text-[11px] font-semibold text-[#64748B]">Impuestos por defecto</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup>
            <Label>IVA %</Label>
            <Select value={String(draft.iva_pct)} onChange={e => onChange({ iva_pct: Number(e.target.value) })}>
              <option value="0">Sin IVA</option>
              <option value="10.5">10.5%</option>
              <option value="21">21%</option>
            </Select>
          </FieldGroup>
        </div>
      </div>

      {/* Notas predeterminadas */}
      <FieldGroup>
        <Label>Observaciones predeterminadas</Label>
        <Textarea
          rows={4}
          value={draft.default_notes}
          onChange={e => onChange({ default_notes: e.target.value })}
          placeholder="Texto que aparece en el campo de observaciones de cada nueva cotización. Ej: Precios sujetos a variación cambiaria."
        />
      </FieldGroup>
    </div>
  )
}

// ─── Section: Cuenta ──────────────────────────────────────────────────────────
function AccountSection() {
  const [showPwd, setShowPwd] = useState(false)
  const [pwd, setPwd] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSavePwd() {
    if (!pwd.trim()) return
    // Store in sessionStorage so it takes effect on next login
    sessionStorage.setItem('agrocotizar_custom_pwd', pwd.trim())
    setSaved(true)
    setPwd('')
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={Lock}
        title="Cuenta y seguridad"
        desc="Configuración de acceso al sistema."
      />

      {/* Login info */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
        <div className="text-[11px] font-semibold text-[#64748B] mb-3">Información de acceso</div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center">
            <Lock size={16} className="text-[#22C55E]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-[#0F172A]">Acceso con contraseña</div>
            <div className="text-[11px] text-[#94A3B8]">Sistema de login simplificado — sin usuarios múltiples</div>
          </div>
          <span className="ml-auto text-[10px] font-bold text-[#22C55E] bg-[#F0FDF4] border border-[#22C55E]/20 px-2 py-0.5 rounded-full">ACTIVO</span>
        </div>
      </div>

      {/* Password change */}
      <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold text-[#64748B]">Cambiar contraseña</div>
          <button
            onClick={() => setShowPwd(v => !v)}
            className="text-[11px] text-[#22C55E] hover:text-[#16A34A] cursor-pointer font-medium transition-colors"
          >
            {showPwd ? 'Cancelar' : 'Cambiar'}
          </button>
        </div>
        {showPwd && (
          <div className="space-y-3">
            <FieldGroup>
              <Label>Nueva contraseña</Label>
              <Input
                type="password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
            </FieldGroup>
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={handleSavePwd} disabled={pwd.length < 6}>
                <Check size={13} /> Guardar contraseña
              </Button>
              {saved && <span className="text-[12px] text-[#22C55E] font-medium">¡Guardada!</span>}
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              La nueva contraseña se aplica en el próximo inicio de sesión.
            </p>
          </div>
        )}
      </div>

      {/* Data management */}
      <div className="p-4 bg-[#FFF8F8] border border-[#EF4444]/20 rounded-xl space-y-3">
        <div className="text-[11px] font-semibold text-[#64748B]">Datos locales</div>
        <p className="text-[12px] text-[#94A3B8]">
          Todos los datos (cotizaciones, clientes, lista de precios) se almacenan localmente en este navegador.
        </p>
        <button
          onClick={() => {
            if (confirm('¿Seguro que querés borrar todos los datos? Esta acción no se puede deshacer.')) {
              localStorage.clear()
              sessionStorage.clear()
              window.location.reload()
            }
          }}
          className="text-[12px] font-medium text-[#EF4444] hover:text-[#DC2626] cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <X size={13} /> Borrar todos los datos locales
        </button>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pb-2 border-b border-[#E2E8F0]">
      <div className="w-9 h-9 rounded-lg bg-[#F0FDF4] border border-[#22C55E]/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={16} className="text-[#22C55E]" />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-[#0F172A]">{title}</div>
        <div className="text-[12px] text-[#94A3B8] mt-0.5">{desc}</div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const store        = useSettingsStore()
  const subscription = useSubscriptionStore()

  // If redirected back from MP with ?section=subscription, open that tab
  const initialSection = (() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('payment')) return 'subscription' as SectionId
    return 'seller' as SectionId
  })()

  const [active, setActive] = useState<SectionId>(initialSection)

  // Local drafts (unsaved)
  const [seller,  setSeller]  = useState<SellerProfile>(() => ({ ...store.seller }))
  const [company, setCompany] = useState<CompanyProfile>(() => ({ ...store.company }))
  const [quotes,  setQuotes]  = useState<QuoteDefaults>(() => ({ ...store.quoteDefaults }))

  const isDirty =
    JSON.stringify(seller)  !== JSON.stringify(store.seller)  ||
    JSON.stringify(company) !== JSON.stringify(store.company) ||
    JSON.stringify(quotes)  !== JSON.stringify(store.quoteDefaults)

  function handleSave() {
    store.updateSeller(seller)
    store.updateCompany(company)
    store.updateQuoteDefaults(quotes)
  }

  function handleDiscard() {
    setSeller({ ...store.seller })
    setCompany({ ...store.company })
    setQuotes({ ...store.quoteDefaults })
  }

  return (
    <>
      <PageHeader title="Configuración" subtitle="Perfil, empresa y preferencias del sistema" />

      {/* Mobile/tablet tab nav */}
      <div className="lg:hidden flex overflow-x-auto gap-1 px-4 py-2 bg-white border-b border-[#E2E8F0] shrink-0">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const isActive = active === s.id
          return (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap shrink-0 text-[12px] font-medium transition-all cursor-pointer ${
                isActive ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#22C55E]/30' : 'text-[#64748B] hover:bg-[#F8FAFC]'
              }`}
            >
              <Icon size={13} className={isActive ? 'text-[#22C55E]' : 'text-[#94A3B8]'} />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-[calc(100vh-73px)]">
        {/* Sidebar nav — desktop only (lg+) */}
        <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-[#E2E8F0] flex-col pt-4">
          {SECTIONS.map(s => {
            const Icon = s.icon
            const isActive = active === s.id
            const showBadge = s.id === 'subscription' && subscription.isActive
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-3 mx-3 px-3 py-3 rounded-lg text-left transition-all cursor-pointer group ${
                  isActive ? 'bg-[#F0FDF4] text-[#16A34A]' : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive ? 'bg-[#22C55E]/20' : 'bg-[#F1F5F9] group-hover:bg-[#E2E8F0]'
                }`}>
                  <Icon size={15} className={isActive ? 'text-[#22C55E]' : 'text-[#94A3B8]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-medium ${isActive ? 'text-[#16A34A]' : ''}`}>{s.label}</div>
                  <div className="text-[11px] text-[#94A3B8] truncate">{s.desc}</div>
                </div>
                {showBadge && (
                  <span className="text-[9px] font-bold text-[#22C55E] bg-[#F0FDF4] border border-[#22C55E]/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Activo
                  </span>
                )}
                {isActive && <ChevronRight size={14} className="text-[#22C55E] shrink-0" />}
              </button>
            )
          })}
        </aside>

        {/* Content */}
        <main className="flex-1 bg-[#F8FAFC]">
          <div className="max-w-2xl mx-auto p-4 sm:p-6 md:p-8">
            {active === 'seller' && (
              <SellerSection draft={seller} onChange={p => setSeller(s => ({ ...s, ...p }))} />
            )}
            {active === 'company' && (
              <CompanySection draft={company} onChange={p => setCompany(s => ({ ...s, ...p }))} />
            )}
            {active === 'quotes' && (
              <QuotesSection draft={quotes} onChange={p => setQuotes(s => ({ ...s, ...p }))} />
            )}
            {active === 'subscription' && (
              <SubscriptionSection />
            )}
            {active === 'account' && (
              <AccountSection />
            )}

            {/* Inline save button (only for editable sections) */}
            {active !== 'account' && active !== 'subscription' && (
              <div className="mt-8 flex items-center justify-end gap-3">
                {isDirty && (
                  <button onClick={handleDiscard} className="text-[12px] text-[#94A3B8] hover:text-[#64748B] cursor-pointer transition-colors">
                    Descartar cambios
                  </button>
                )}
                <Button variant="primary" onClick={handleSave} disabled={!isDirty}>
                  <Check size={14} /> Guardar cambios
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Floating save banner */}
      {isDirty && <SaveBanner onSave={handleSave} onDiscard={handleDiscard} />}
    </>
  )
}
