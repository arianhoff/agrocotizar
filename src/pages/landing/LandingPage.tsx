import { useState, useEffect } from 'react'
import {
  Tractor, Zap, FileText, Users, Bell, Share2,
  ArrowRight, Check, Star, ChevronDown, Menu, X,
  MessageSquare, BarChart3,
} from 'lucide-react'

// ─── Google icon ──────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color }: {
  icon: React.ElementType; title: string; desc: string; color: string
}) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-[#22C55E]/30 hover:bg-white/[0.05] transition-all">
      <div className="flex items-start gap-4 sm:block">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 sm:mb-4 ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <div className="text-[15px] font-semibold text-white mb-1 sm:mb-2">{title}</div>
          <div className="text-[13px] text-white/50 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Step ─────────────────────────────────────────────────────────────────────
function Step({ n, title, desc, last = false }: { n: number; title: string; desc: string; last?: boolean }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full bg-[#22C55E] flex items-center justify-center text-white font-bold text-[13px] shrink-0">
          {n}
        </div>
        {!last && <div className="flex-1 w-px bg-[#22C55E]/20 min-h-[32px] mt-1" />}
      </div>
      <div className={last ? 'pb-0' : 'pb-7'}>
        <div className="text-[15px] sm:text-[16px] font-semibold text-white mb-1">{title}</div>
        <div className="text-[13px] text-white/50 leading-relaxed">{desc}</div>
      </div>
    </div>
  )
}

// ─── Testimonial ──────────────────────────────────────────────────────────────
function Testimonial({ name, role, company, text }: { name: string; role: string; company: string; text: string }) {
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
      <div className="flex gap-1 mb-3">
        {[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-[#F59E0B] fill-[#F59E0B]" />)}
      </div>
      <p className="text-[13px] text-white/70 leading-relaxed mb-4">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-white text-[12px] font-bold shrink-0">
          {name.charAt(0)}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-white">{name}</div>
          <div className="text-[11px] text-white/40">{role} · {company}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Main landing page ────────────────────────────────────────────────────────
export function LandingPage({ onLogin }: { onLogin: () => void }) {
  const [mobileMenu, setMobileMenu] = useState(false)

  // Close mobile menu on scroll
  useEffect(() => {
    if (!mobileMenu) return
    const close = () => setMobileMenu(false)
    window.addEventListener('scroll', close, { passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [mobileMenu])

  const FEATURES = [
    { icon: Zap,       title: 'Asistente IA',          desc: 'Dictá o escribí el pedido y la IA completa toda la cotización: cliente, equipos, precios y condición de pago.',      color: 'bg-[#7C3AED]' },
    { icon: FileText,  title: 'Importación inteligente',desc: 'Subí el PDF de tu lista de precios y la IA lo extrae completo. Detecta modelos, opcionales y precios en segundos.',   color: 'bg-[#0EA5E9]' },
    { icon: Users,     title: 'Gestión de clientes',    desc: 'Ficha completa con CUIT, historial de cotizaciones, estado y datos de contacto en un solo lugar.',                    color: 'bg-[#22C55E]' },
    { icon: Bell,      title: 'Seguimiento CRM',        desc: 'Recordatorios automáticos cuando compartís una cotización. Nunca más pierdas una venta por olvido.',                  color: 'bg-[#F59E0B]' },
    { icon: Share2,    title: 'Compartir por WhatsApp', desc: 'Enviá la cotización directamente al cliente por WhatsApp o email con un solo click. Formato profesional incluido.',    color: 'bg-[#25D366]' },
    { icon: BarChart3, title: 'Dashboard de ventas',    desc: 'Seguí el estado de tus cotizaciones, montos totales y conversión. Todo en un panel claro.',                           color: 'bg-[#EF4444]' },
  ]

  const NAV_LINKS = [
    { href: '#features', label: 'Funciones' },
    { href: '#how',      label: 'Cómo funciona' },
    { href: '#pricing',  label: 'Precios' },
  ]

  return (
    <div className="min-h-screen bg-[#0F1120] text-white overflow-x-hidden">

      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0F1120]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="text-[20px] font-bold tracking-tight shrink-0">
            Cotiza<span className="text-[#22C55E]">gro</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-[13px] text-white/50">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onLogin}
              className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-semibold px-3 sm:px-4 py-2 rounded-lg transition-all cursor-pointer shadow-lg shadow-[#22C55E]/20 shrink-0"
            >
              Ingresar <ArrowRight size={13} />
            </button>
            {/* Hamburger */}
            <button
              className="md:hidden p-2 text-white/50 hover:text-white cursor-pointer transition-colors"
              onClick={() => setMobileMenu(v => !v)}
              aria-label="Menú"
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#0F1120] px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileMenu(false)}
                className="block px-3 py-2.5 text-[15px] text-white/70 hover:text-white rounded-lg hover:bg-white/[0.05] transition-all"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 sm:pt-20 md:pt-24 pb-14 sm:pb-20 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[300px] sm:h-[400px] bg-[#22C55E]/8 rounded-full blur-[100px] sm:blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/25 text-[11px] sm:text-[12px] font-medium text-[#22C55E] mb-6 sm:mb-8">
            <Zap size={11} /> Impulsado por Inteligencia Artificial · Claude AI
          </div>

          <h1 className="text-[36px] sm:text-[50px] md:text-[64px] lg:text-[72px] font-bold leading-[1.1] tracking-tight mb-5 sm:mb-6">
            Cotizaciones de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22C55E] to-[#4ADE80]">
              maquinaria agrícola
            </span>{' '}
            en segundos
          </h1>

          <p className="text-[15px] sm:text-[17px] md:text-[18px] text-white/50 leading-relaxed max-w-2xl mx-auto mb-8 sm:mb-10">
            El sistema que usan los vendedores de maquinaria agrícola en Argentina para cotizar más rápido,
            hacer seguimiento de clientes y nunca perder una venta.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            <button
              onClick={onLogin}
              className="flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[15px] font-bold px-7 py-3.5 rounded-xl transition-all cursor-pointer shadow-xl shadow-[#22C55E]/25"
            >
              Empezar gratis <ArrowRight size={16} />
            </button>
            <a
              href="#how"
              className="flex items-center justify-center gap-2 text-white/60 hover:text-white text-[14px] font-medium px-6 py-3.5 rounded-xl border border-white/10 hover:border-white/20 transition-all"
            >
              Ver cómo funciona <ChevronDown size={14} />
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 sm:flex sm:flex-wrap sm:justify-center sm:gap-10 mt-12 sm:mt-14 pt-8 sm:pt-10 border-t border-white/[0.06]">
            {[
              { value: '10x', label: 'más rápido que Excel' },
              { value: 'IA', label: 'extracción automática' },
              { value: '100%', label: 'datos locales' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[24px] sm:text-[30px] font-bold text-[#22C55E]">{s.value}</div>
                <div className="text-[11px] sm:text-[12px] text-white/40 mt-0.5 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Preview mockup — desktop only ──────────────────────────────────── */}
      <section className="hidden md:block px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 bg-[#1E2235]">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161929] border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                <div className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
              </div>
              <div className="flex-1 mx-3 bg-white/[0.05] rounded-md px-3 py-1 text-[11px] text-white/30 font-mono truncate">
                cotizagro.app/quoter
              </div>
            </div>
            {/* Mock content */}
            <div className="p-5 grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-3">
                <div className="rounded-xl border border-[#C4B5FD]/20 bg-[#F5F3FF]/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#7C3AED] flex items-center justify-center text-[12px]">🤖</div>
                    <span className="text-[12px] font-semibold text-[#C4B5FD]">Asistente IA</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-[#7C3AED]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#7C3AED] animate-pulse" /> Listo
                    </span>
                  </div>
                  <div className="bg-[#EDE9FE]/10 rounded-lg p-3 text-[11px] text-[#C4B5FD]/80 mb-2">
                    ¡Hola! Contame qué equipos necesitás cotizar...
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-[11px] text-white/80 text-right">
                    Mixer 110F con balanza electrónica, pago contado, cliente Juan Pérez de Córdoba
                  </div>
                  <div className="bg-[#EDE9FE]/10 rounded-lg p-3 text-[11px] text-[#22C55E]/90 mt-2">
                    ✅ Apliqué: Juan Pérez · 1 equipo · Pago: contado · 20% dto
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Equipos</div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-[12px] font-semibold text-white">Mixer Vertical 110F</div>
                      <div className="text-[10px] text-white/40">Mixer / Unifeed · 1 unidad</div>
                    </div>
                    <div className="text-[13px] font-bold text-[#22C55E]">USD 29.000</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Resumen</div>
                {[['Subtotal','USD 29.000'],['Dto. 20%','− 5.800'],['Total','USD 23.200']].map(([k,v]) => (
                  <div key={k} className={`flex justify-between text-[11px] ${k==='Total'?'font-bold text-[#22C55E] border-t border-white/[0.08] pt-2':'text-white/50'}`}>
                    <span>{k}</span><span>{v}</span>
                  </div>
                ))}
                <button className="w-full mt-1 py-2 rounded-lg bg-[#25D366] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5">
                  <MessageSquare size={11} /> Enviar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Funciones</div>
            <h2 className="text-[28px] sm:text-[34px] md:text-[38px] font-bold text-white mb-3 sm:mb-4">
              Todo lo que necesitás para vender más
            </h2>
            <p className="text-[14px] sm:text-[15px] text-white/40 max-w-xl mx-auto">
              Diseñado para vendedores y concesionarios de maquinaria agrícola en Argentina.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ─── How it works ───────────────────────────────────────────────────── */}
      <section id="how" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
            <div>
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Cómo funciona</div>
              <h2 className="text-[28px] sm:text-[34px] md:text-[38px] font-bold text-white mb-8 sm:mb-10">
                De pedido a cotización en 30 segundos
              </h2>
              <div>
                <Step n={1} title="Hablá o escribí el pedido"
                  desc="Contale al asistente IA qué equipo necesita el cliente, el modelo, opcionales y condición de pago. Podés dictarlo por voz." />
                <Step n={2} title="La IA arma la cotización"
                  desc="El sistema completa automáticamente todos los campos: cliente, equipos, precios del catálogo, descuentos y resumen de pago." />
                <Step n={3} title="Enviá por WhatsApp o email" last
                  desc="Con un click compartís la cotización al cliente. El sistema registra el seguimiento automáticamente." />
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-4">
              <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-1">Incluye además</div>
              {[
                'Importación de listas de precios desde PDF o imagen',
                'Verificación de deudores BCRA en tiempo real',
                'Historial completo por cliente con todos sus pedidos',
                'Dashboard de seguimientos y oportunidades abiertas',
                'Soporte multi-moneda USD / ARS con tipo de cambio',
                'Funciona sin internet — datos guardados localmente',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={11} className="text-[#22C55E]" />
                  </div>
                  <span className="text-[13px] text-white/60 leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Testimonials ───────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Testimonios</div>
            <h2 className="text-[28px] sm:text-[34px] md:text-[38px] font-bold text-white">
              Lo usan vendedores como vos
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Testimonial
              name="Martín R." role="Vendedor" company="Concesionaria Rosario"
              text="Antes me tomaba 30 minutos armar una cotización en Excel. Ahora la dicto en 2 minutos y sale perfecta."
            />
            <Testimonial
              name="Claudia M." role="Gerente comercial" company="Agromaquinaria Sur"
              text="La importación de la lista de precios por PDF nos ahorró días de carga. La IA la leyó completa sin errores."
            />
            <Testimonial
              name="Diego F." role="Asesor de ventas" company="Implementos del Litoral"
              text="Los seguimientos automáticos me cambiaron la vida. Antes perdía clientes por no llamar a tiempo."
            />
          </div>
        </div>
      </section>

      {/* ─── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Precios</div>
            <h2 className="text-[28px] sm:text-[34px] md:text-[38px] font-bold text-white mb-3">
              Simple y transparente
            </h2>
            <p className="text-[14px] sm:text-[15px] text-white/40">Sin contratos. Sin sorpresas.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
            {/* Free */}
            <div className="p-6 sm:p-7 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="text-[14px] font-semibold text-white/60 mb-1">Básico</div>
              <div className="text-[38px] sm:text-[42px] font-bold text-white mb-1">Gratis</div>
              <div className="text-[12px] text-white/30 mb-6">Para empezar</div>
              <div className="space-y-3 mb-7">
                {['Cotizaciones ilimitadas','Asistente IA','1 lista de precios','Clientes y seguimientos'].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13px] text-white/60">
                    <Check size={13} className="text-[#22C55E] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <button onClick={onLogin}
                className="w-full py-3 rounded-xl border border-white/15 text-white text-[14px] font-semibold hover:bg-white/[0.05] transition-all cursor-pointer">
                Empezar gratis
              </button>
            </div>
            {/* Pro */}
            <div className="relative mt-4 sm:mt-0 p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-[#22C55E]/10 to-transparent border border-[#22C55E]/30">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#22C55E] rounded-full text-[10px] font-bold text-white whitespace-nowrap">
                RECOMENDADO
              </div>
              <div className="text-[14px] font-semibold text-[#22C55E] mb-1">Pro</div>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-[38px] sm:text-[42px] font-bold text-white">$15</span>
                <span className="text-[13px] text-white/40 mb-2">USD/mes</span>
              </div>
              <div className="text-[12px] text-white/30 mb-6">Por vendedor</div>
              <div className="space-y-3 mb-7">
                {['Todo lo del plan básico','Listas de precios ilimitadas','Importación PDF ilimitada','Soporte prioritario','Múltiples vendedores','Exportación a PDF'].map(f => (
                  <div key={f} className="flex items-center gap-2.5 text-[13px] text-white/70">
                    <Check size={13} className="text-[#22C55E] shrink-0" /> {f}
                  </div>
                ))}
              </div>
              <button onClick={onLogin}
                className="w-full py-3 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-bold transition-all cursor-pointer shadow-lg shadow-[#22C55E]/25">
                14 días gratis
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center mx-auto mb-6 sm:mb-8">
            <Tractor size={24} className="text-[#22C55E]" />
          </div>
          <h2 className="text-[30px] sm:text-[38px] md:text-[44px] font-bold text-white mb-4 sm:mb-5 leading-tight">
            Empezá hoy.<br />
            <span className="text-[#22C55E]">Sin tarjeta de crédito.</span>
          </h2>
          <p className="text-[14px] sm:text-[16px] text-white/40 mb-8 sm:mb-10">
            Ingresá con tu cuenta de Google y empezá a cotizar en minutos.
          </p>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-3 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[15px] sm:text-[16px] font-bold px-8 sm:px-10 py-4 rounded-xl transition-all cursor-pointer shadow-xl shadow-[#22C55E]/25"
          >
            Empezar gratis <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-center sm:text-left">
          <div className="text-[18px] font-bold">
            Cotiza<span className="text-[#22C55E]">gro</span>
          </div>
          <div className="text-[12px] text-white/25">
            © {new Date().getFullYear()} Cotizagro · Maquinaria Agrícola Argentina
          </div>
          <button
            onClick={onLogin}
            className="text-[12px] text-white/30 hover:text-white transition-colors cursor-pointer"
          >
            Ingresar
          </button>
        </div>
      </footer>

    </div>
  )
}
