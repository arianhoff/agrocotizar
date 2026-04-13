import { useState, useEffect, useRef } from 'react'
import {
  Tractor, Zap, FileText, Users, Bell, Share2,
  ArrowRight, Check, Star, ChevronDown, Menu, X,
  MessageSquare, BarChart3, Clock, TrendingUp, ShieldCheck,
} from 'lucide-react'

// ─── Scroll animation hook ────────────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function Reveal({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string
}) {
  const { ref, visible } = useInView()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, delay = 0 }: {
  icon: React.ElementType; title: string; desc: string; color: string; delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <div className="h-full p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-[#22C55E]/30 hover:bg-white/[0.05] transition-all group">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="text-[15px] font-semibold text-white mb-2">{title}</div>
        <div className="text-[13px] text-white/50 leading-relaxed">{desc}</div>
      </div>
    </Reveal>
  )
}

// ─── Testimonial ──────────────────────────────────────────────────────────────
function Testimonial({ name, role, company, text, delay = 0 }: {
  name: string; role: string; company: string; text: string; delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <div className="h-full p-6 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-all">
        <div className="flex gap-1 mb-4">
          {[...Array(5)].map((_, i) => <Star key={i} size={13} className="text-[#F59E0B] fill-[#F59E0B]" />)}
        </div>
        <p className="text-[13px] text-white/70 leading-relaxed mb-5">"{text}"</p>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center text-white text-[13px] font-bold shrink-0">
            {name.charAt(0)}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white">{name}</div>
            <div className="text-[11px] text-white/40">{role} · {company}</div>
          </div>
        </div>
      </div>
    </Reveal>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function LandingPage({ onLogin }: { onLogin: (plan?: string) => void }) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD')

  useEffect(() => {
    if (!mobileMenu) return
    const close = () => setMobileMenu(false)
    window.addEventListener('scroll', close, { passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [mobileMenu])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    setMobileMenu(false)
  }

  const FEATURES = [
    { icon: Zap,       title: 'Asistente IA',           desc: 'Dictá o escribí el pedido y la IA completa toda la cotización: cliente, equipos, precios y condición de pago en segundos.',  color: 'bg-[#7C3AED]' },
    { icon: FileText,  title: 'Importación de precios',  desc: 'Subí el PDF de tu lista y la IA extrae modelos, opcionales y precios automáticamente. Sin tipear nada.',                       color: 'bg-[#0EA5E9]' },
    { icon: ShieldCheck,title: 'Verificación BCRA',      desc: 'Consultá el historial crediticio del cliente antes de cotizar. Situación financiera en tiempo real.',                          color: 'bg-[#22C55E]' },
    { icon: Bell,      title: 'CRM y seguimiento',       desc: 'Recordatorios automáticos al compartir una cotización. Nunca más pierdas una venta por no hacer el seguimiento.',             color: 'bg-[#F59E0B]' },
    { icon: Share2,    title: 'WhatsApp y PDF',           desc: 'Enviá la cotización al cliente por WhatsApp o como PDF profesional con un solo click.',                                       color: 'bg-[#25D366]' },
    { icon: BarChart3, title: 'Dashboard de ventas',     desc: 'Estado de cotizaciones, montos y conversión. Sabé en qué etapa está cada oportunidad.',                                       color: 'bg-[#EF4444]' },
  ]

  const NAV_LINKS = [
    { id: 'features', label: 'Funciones' },
    { id: 'how',      label: 'Cómo funciona' },
    { id: 'pricing',  label: 'Precios' },
  ]

  return (
    <div className="min-h-screen bg-[#0F1120] text-white overflow-x-hidden">

      {/* ─── Navbar flotante (pill) ───────────────────────────────────────────── */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
        <nav
          className="flex items-center h-14 px-3 rounded-full border border-white/10 shadow-2xl shadow-black/50"
          style={{ background: 'rgba(18,21,38,0.96)', backdropFilter: 'blur(20px)' }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 pl-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
              <Tractor size={14} className="text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight">
              Cotiz<span className="text-[#22C55E]">agro</span>
            </span>
          </div>

          {/* Links — desktop */}
          <div className="hidden md:flex items-center gap-1 mx-auto">
            {NAV_LINKS.map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="px-4 py-2 rounded-full text-[13px] text-white/55 hover:text-white hover:bg-white/[0.07] transition-all cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={() => onLogin()}
              className="hidden sm:block text-[13px] text-white/55 hover:text-white px-3 py-2 rounded-full hover:bg-white/[0.07] transition-all cursor-pointer"
            >
              Ingresar
            </button>
            <button
              onClick={() => onLogin()}
              className="flex items-center gap-1.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-semibold px-4 py-2 rounded-full transition-all cursor-pointer shadow-lg shadow-[#22C55E]/25"
            >
              Empezar gratis
            </button>
            <button
              className="md:hidden p-2 text-white/50 hover:text-white cursor-pointer transition-colors"
              onClick={() => setMobileMenu(v => !v)}
              aria-label="Menú"
            >
              {mobileMenu ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenu && (
          <div
            className="md:hidden mt-2 rounded-2xl border border-white/10 px-3 py-3 flex flex-col gap-1 shadow-2xl shadow-black/50"
            style={{ background: 'rgba(18,21,38,0.97)', backdropFilter: 'blur(20px)' }}
          >
            {NAV_LINKS.map(l => (
              <button
                key={l.id}
                onClick={() => scrollTo(l.id)}
                className="block w-full text-left px-4 py-3 text-[15px] text-white/70 hover:text-white rounded-xl hover:bg-white/[0.05] transition-all cursor-pointer"
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 sm:pt-36 md:pt-40 pb-16 sm:pb-24 px-4 sm:px-6 overflow-hidden">
        {/* Fondo glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[#22C55E]/6 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-[#7C3AED]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-10 right-1/4 w-[250px] h-[250px] bg-[#0EA5E9]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge animado */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#22C55E]/10 border border-[#22C55E]/25 text-[11px] sm:text-[12px] font-medium text-[#22C55E] mb-7"
            style={{ animation: 'fadeDown 0.6s ease both' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            Impulsado por Claude AI · Para maquinaria agrícola
          </div>

          <h1
            className="text-[38px] sm:text-[54px] md:text-[68px] font-bold leading-[1.08] tracking-tight mb-6"
            style={{ animation: 'fadeUp 0.7s ease 0.1s both' }}
          >
            Cotizá maquinaria agrícola{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22C55E] to-[#4ADE80]">
              10 veces más rápido
            </span>
          </h1>

          <p
            className="text-[16px] sm:text-[18px] text-white/50 leading-relaxed max-w-2xl mx-auto mb-10"
            style={{ animation: 'fadeUp 0.7s ease 0.2s both' }}
          >
            El sistema que usan vendedores de maquinaria agrícola en Argentina para
            armar cotizaciones profesionales, verificar clientes y nunca perder una venta.
          </p>

          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3"
            style={{ animation: 'fadeUp 0.7s ease 0.3s both' }}
          >
            <button
              onClick={() => onLogin()}
              className="flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[15px] font-bold px-8 py-4 rounded-xl transition-all cursor-pointer shadow-2xl shadow-[#22C55E]/30 hover:shadow-[#22C55E]/40 hover:-translate-y-0.5"
            >
              Empezar gratis <ArrowRight size={16} />
            </button>
            <button
              onClick={() => scrollTo('how')}
              className="flex items-center justify-center gap-2 text-white/50 hover:text-white text-[14px] font-medium px-6 py-4 rounded-xl border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              Ver cómo funciona <ChevronDown size={14} />
            </button>
          </div>

          {/* Stats */}
          <div
            className="grid grid-cols-3 gap-6 sm:flex sm:justify-center sm:gap-14 mt-14 pt-10 border-t border-white/[0.06]"
            style={{ animation: 'fadeUp 0.7s ease 0.4s both' }}
          >
            {[
              { value: '< 2 min', label: 'por cotización' },
              { value: 'IA',      label: 'que entiende tu catálogo' },
              { value: '100%',    label: 'hecho en Argentina' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[22px] sm:text-[28px] font-bold text-[#22C55E]">{s.value}</div>
                <div className="text-[11px] sm:text-[12px] text-white/35 mt-1 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Mockup ───────────────────────────────────────────────────────────── */}
      <section className="hidden md:block px-6 pb-24">
        <Reveal>
          <div className="max-w-5xl mx-auto">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 bg-[#1E2235]">
              <div className="flex items-center gap-2 px-4 py-3 bg-[#161929] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
                </div>
                <div className="flex-1 mx-3 bg-white/[0.05] rounded-md px-3 py-1 text-[11px] text-white/30 font-mono">
                  cotizagro.app/quoter
                </div>
                <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              </div>
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
                      Mixer 110F con balanza, pago contado, cliente Juan Pérez de Córdoba
                    </div>
                    <div className="bg-[#EDE9FE]/10 rounded-lg p-3 text-[11px] text-[#22C55E]/90 mt-2">
                      ✅ Juan Pérez · Mixer 110F · Contado · 20% dto → <span className="font-bold">USD 23.200</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Equipos cotizados</div>
                    <div className="flex items-center justify-between py-2 border-b border-white/[0.05]">
                      <div>
                        <div className="text-[12px] font-semibold text-white">Mixer Vertical 110F</div>
                        <div className="text-[10px] text-white/40">Mixer / Unifeed · con balanza electrónica</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-bold text-[#22C55E]">USD 23.200</div>
                        <div className="text-[10px] text-white/30 line-through">29.000</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Resumen</div>
                    {[['Subtotal','USD 29.000'],['Dto. contado 20%','− 5.800'],['IVA 21%','+ 4.872'],['Total','USD 28.072']].map(([k,v]) => (
                      <div key={k} className={`flex justify-between text-[11px] ${k==='Total'?'font-bold text-[#22C55E] border-t border-white/[0.08] pt-2':'text-white/50'}`}>
                        <span>{k}</span><span>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Cliente</div>
                    <div className="text-[12px] font-semibold text-white">Juan Pérez</div>
                    <div className="text-[11px] text-white/40">Córdoba · CUIT 20-123...</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                      <span className="text-[10px] text-[#22C55E]">BCRA: Sin deudas</span>
                    </div>
                  </div>
                  <button className="w-full py-2.5 rounded-lg bg-[#25D366] text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-[#20ba5a] transition-colors cursor-pointer">
                    <MessageSquare size={11} /> Enviar por WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── Problema / Solución ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">El problema</div>
              <h2 className="text-[28px] sm:text-[36px] font-bold text-white mb-4">
                ¿Cuánto tiempo perdés en cada cotización?
              </h2>
              <p className="text-[14px] sm:text-[15px] text-white/40 max-w-xl mx-auto">
                La mayoría de los vendedores de maquinaria agrícola siguen usando Excel o Word. Eso tiene un costo enorme.
              </p>
            </div>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {[
              { icon: Clock,      value: '45 min',  label: 'promedio por cotización en Excel',    color: 'text-[#EF4444]' },
              { icon: TrendingUp, value: '30%',     label: 'de ventas perdidas por falta de seguimiento', color: 'text-[#F59E0B]' },
              { icon: Users,      value: '3x',      label: 'más clientes con automatización',     color: 'text-[#22C55E]' },
            ].map(({ icon: Icon, value, label, color }, i) => (
              <Reveal key={label} delay={i * 100}>
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] text-center">
                  <Icon size={24} className={`${color} mx-auto mb-3`} />
                  <div className={`text-[36px] font-bold ${color} mb-1`}>{value}</div>
                  <div className="text-[13px] text-white/40 leading-snug">{label}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="rounded-2xl border border-[#22C55E]/20 bg-[#22C55E]/5 p-6 sm:p-8 text-center">
              <div className="text-[22px] sm:text-[26px] font-bold text-white mb-2">
                Cotizagro lo resuelve todo en <span className="text-[#22C55E]">menos de 2 minutos</span>
              </div>
              <p className="text-[14px] text-white/50 max-w-lg mx-auto">
                IA que entiende tu catálogo, genera el PDF, verifica el cliente y registra el seguimiento automáticamente.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Funciones</div>
              <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-bold text-white mb-4">
                Todo lo que necesitás para vender más
              </h2>
              <p className="text-[14px] sm:text-[15px] text-white/40 max-w-xl mx-auto">
                Diseñado específicamente para vendedores y concesionarios de maquinaria agrícola en Argentina.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} delay={i * 80} />)}
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────────────── */}
      <section id="how" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Cómo funciona</div>
              <h2 className="text-[28px] sm:text-[36px] md:text-[40px] font-bold text-white mb-4">
                De pedido a cotización en 3 pasos
              </h2>
              <p className="text-[14px] text-white/40 max-w-lg mx-auto">
                Sin capacitación. Sin configuración compleja. Empezás a cotizar el mismo día.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              {
                n: '01',
                title: 'Dictá o escribí el pedido',
                desc: 'Contale al asistente IA qué equipo necesita el cliente, el modelo, opcionales y condición de pago. Por voz o texto.',
                color: 'from-[#7C3AED] to-[#6D28D9]',
              },
              {
                n: '02',
                title: 'La IA arma todo',
                desc: 'Completa cliente, equipos, precios del catálogo, descuentos por condición de pago y genera el resumen.',
                color: 'from-[#0EA5E9] to-[#0284C7]',
              },
              {
                n: '03',
                title: 'Enviá y hacé seguimiento',
                desc: 'Compartís por WhatsApp o PDF en un click. El sistema registra el seguimiento y te recuerda cuándo llamar.',
                color: 'from-[#22C55E] to-[#16A34A]',
              },
            ].map(({ n, title, desc, color }, i) => (
              <Reveal key={n} delay={i * 120}>
                <div className="relative p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] transition-all">
                  <div className={`text-[48px] font-black bg-gradient-to-br ${color} bg-clip-text text-transparent leading-none mb-4 select-none`}>
                    {n}
                  </div>
                  <div className="text-[15px] font-semibold text-white mb-2">{title}</div>
                  <div className="text-[13px] text-white/50 leading-relaxed">{desc}</div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
              <div className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-5">También incluye</div>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  'Importación de listas de precios desde PDF o imagen',
                  'Verificación de deudores BCRA en tiempo real',
                  'Historial completo por cliente',
                  'Dashboard de seguimientos y oportunidades',
                  'Soporte multi-moneda USD / ARS con tipo de cambio',
                  'Funciona sin internet — datos guardados localmente',
                  'Exportación a PDF con tu marca',
                  'Condiciones de pago personalizables',
                ].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center shrink-0">
                      <Check size={11} className="text-[#22C55E]" />
                    </div>
                    <span className="text-[13px] text-white/60 leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Testimonios</div>
              <h2 className="text-[28px] sm:text-[36px] font-bold text-white mb-3">
                Lo usan vendedores como vos
              </h2>
              <p className="text-[14px] text-white/40">De todo el país, en todo tipo de concesionarias.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Testimonial delay={0}
              name="Martín R." role="Vendedor" company="Concesionaria Rosario"
              text="Antes me tomaba 40 minutos armar una cotización en Excel. Ahora la dicto en 2 minutos y sale perfecta. El cliente recibe el PDF por WhatsApp al toque."
            />
            <Testimonial delay={80}
              name="Claudia M." role="Gerente comercial" company="Agromaquinaria Sur"
              text="La importación de la lista de precios por PDF nos ahorró días de carga. La IA la leyó completa sin errores. Un antes y un después para el equipo."
            />
            <Testimonial delay={160}
              name="Diego F." role="Asesor de ventas" company="Implementos del Litoral"
              text="Los seguimientos automáticos me cambiaron la vida. Antes perdía clientes por no llamar a tiempo. Ahora el sistema me avisa solo."
            />
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-16 sm:py-20 md:py-24 px-4 sm:px-6 border-t border-white/[0.05]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-10">
              <div className="text-[11px] font-bold tracking-widest uppercase text-[#22C55E] mb-3">Planes</div>
              <h2 className="text-[28px] sm:text-[36px] md:text-[42px] font-bold text-white mb-3">
                El plan justo para tu operación
              </h2>
              <p className="text-[14px] text-white/40 mb-7">Sin contratos. Cancelás cuando querés. Empezá gratis.</p>

              {/* Toggle USD / ARS */}
              <div className="inline-flex items-center rounded-full p-1 bg-white/[0.06] border border-white/[0.08]">
                {(['USD', 'ARS'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer ${
                      currency === c
                        ? 'bg-white text-[#0F1120] shadow'
                        : 'text-white/45 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {currency === 'ARS' && (
                <p className="text-[11px] text-white/25 mt-2">Precio referencial · cotización dólar blue aproximada</p>
              )}
            </div>
          </Reveal>

          {(() => {
            const ARS_RATE = 1250
            const fmt = (usd: number) =>
              currency === 'USD'
                ? { price: `$${usd}`, unit: 'USD / mes' }
                : usd === 0
                ? { price: '$0', unit: '' }
                : { price: `$${(usd * ARS_RATE).toLocaleString('es-AR')}`, unit: 'ARS / mes' }

            const plans: Array<{
              name: string; accent: boolean; badge?: string
              price: string; unit: string; sub: string
              features: { text: string; inc: boolean }[]
              cta: string; ctaStyle: string; intent?: string
            }> = [
              {
                name: 'Gratis',
                accent: false,
                ...fmt(0),
                sub: 'Para dar los primeros pasos',
                features: [
                  { text: 'Hasta 10 cotizaciones / mes', inc: true },
                  { text: 'Asistente IA (10 consultas)', inc: true },
                  { text: '1 lista de precios', inc: true },
                  { text: 'PDF básico sin logo', inc: true },
                  { text: 'Verificación BCRA', inc: true },
                  { text: 'Gestión de clientes básica', inc: true },
                  { text: 'Soporte por email', inc: true },
                  { text: 'PDF con tu logo', inc: false },
                ],
                cta: 'Comenzar gratis',
                ctaStyle: 'border',
              },
              {
                name: 'Vendedores',
                accent: true,
                badge: 'Más popular',
                ...fmt(9),
                sub: 'Por vendedor · facturación mensual',
                features: [
                  { text: 'Cotizaciones ilimitadas', inc: true },
                  { text: 'IA ilimitada + importación PDF', inc: true },
                  { text: 'Listas de precios ilimitadas', inc: true },
                  { text: 'PDF profesional con tu logo', inc: true },
                  { text: 'Verificación BCRA ilimitada', inc: true },
                  { text: 'CRM y seguimiento automático', inc: true },
                  { text: 'Envío por WhatsApp', inc: true },
                  { text: 'Soporte por WhatsApp', inc: true },
                ],
                cta: '14 días gratis · sin tarjeta',
                ctaStyle: 'solid',
                intent: 'trial_vendedores',
              },
              {
                name: 'Concesionarios',
                accent: false,
                ...fmt(29),
                sub: 'Hasta 10 vendedores incluidos',
                features: [
                  { text: 'Todo lo del plan Vendedores', inc: true },
                  { text: 'Hasta 10 usuarios simultáneos', inc: true },
                  { text: 'Dashboard gerencial', inc: true },
                  { text: 'Reportes de conversión y ventas', inc: true },
                  { text: 'Múltiples marcas y sucursales', inc: true },
                  { text: 'Logo y colores propios en PDFs', inc: true },
                  { text: 'Nuevas funciones anticipadas', inc: true },
                  { text: 'Soporte prioritario 24 hs', inc: true },
                ],
                cta: '14 días gratis · sin tarjeta',
                ctaStyle: 'solid',
                intent: 'concesionarios',
              },
            ]

            return (
              <div className="grid md:grid-cols-3 gap-4 items-stretch">
                {plans.map((plan, i) => (
                  <Reveal key={plan.name} delay={i * 80}>
                    <div
                      className="relative h-full flex flex-col p-7 rounded-2xl border transition-all"
                      style={plan.accent ? {
                        background: 'linear-gradient(160deg, rgba(34,197,94,0.13) 0%, rgba(34,197,94,0.04) 100%)',
                        borderColor: 'rgba(34,197,94,0.42)',
                        boxShadow: '0 20px 60px rgba(34,197,94,0.10)',
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        borderColor: 'rgba(255,255,255,0.08)',
                      }}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#22C55E] rounded-full text-[11px] font-bold text-white whitespace-nowrap tracking-wider uppercase">
                          {plan.badge}
                        </div>
                      )}

                      {/* Header */}
                      <div className="mb-6">
                        <div className={`text-[11px] font-bold tracking-widest uppercase mb-3 ${plan.accent ? 'text-[#22C55E]' : 'text-white/35'}`}>
                          {plan.name}
                        </div>
                        <div className="flex items-end gap-1.5 mb-1">
                          <span className="text-[44px] font-black text-white leading-none">{plan.price}</span>
                          {plan.unit && <span className="text-[12px] text-white/40 mb-2">{plan.unit}</span>}
                        </div>
                        <div className="text-[12px] text-white/35 mt-1">{plan.sub}</div>
                      </div>

                      {/* Features */}
                      <div className="flex-1 space-y-3 mb-8">
                        {plan.features.map(f => (
                          <div key={f.text} className="flex items-start gap-2.5">
                            {f.inc
                              ? <Check size={13} className={`shrink-0 mt-0.5 ${plan.accent ? 'text-[#22C55E]' : 'text-white/40'}`} />
                              : <span className="w-[13px] h-[13px] shrink-0 mt-0.5 flex items-center justify-center text-white/20 text-[10px] leading-none">—</span>
                            }
                            <span className={`text-[13px] ${f.inc ? (plan.accent ? 'text-white/80' : 'text-white/55') : 'text-white/25 line-through'}`}>
                              {f.text}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      {plan.ctaStyle === 'solid' ? (
                        <div className="space-y-2">
                          <button
                            onClick={() => onLogin(plan.intent)}
                            className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-bold transition-all cursor-pointer shadow-lg shadow-[#22C55E]/30"
                          >
                            {plan.cta}
                          </button>
                          <button
                            onClick={() => onLogin(plan.intent ? `checkout_${plan.intent.replace('trial_', '')}` : undefined)}
                            className="w-full py-2.5 rounded-xl border border-white/15 text-white/55 text-[12px] font-semibold hover:bg-white/[0.06] hover:text-white/80 transition-all cursor-pointer"
                          >
                            Contratar plan
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onLogin(plan.intent)}
                          className="w-full py-3 rounded-xl border border-white/15 text-white/75 text-[13px] font-semibold hover:bg-white/[0.06] hover:text-white transition-all cursor-pointer"
                        >
                          {plan.cta}
                        </button>
                      )}
                    </div>
                  </Reveal>
                ))}
              </div>
            )
          })()}

          {/* Nota debajo */}
          <Reveal delay={280}>
            <p className="text-center text-[12px] text-white/25 mt-8">
              Todos los planes incluyen actualizaciones automáticas · Soporte en español · Datos almacenados en Argentina
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── CTA Final ────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-white/[0.05]">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center mx-auto mb-8">
              <Tractor size={28} className="text-[#22C55E]" />
            </div>
            <h2 className="text-[32px] sm:text-[42px] md:text-[50px] font-bold text-white mb-5 leading-tight">
              Empezá hoy.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22C55E] to-[#4ADE80]">
                Sin tarjeta de crédito.
              </span>
            </h2>
            <p className="text-[15px] sm:text-[17px] text-white/40 mb-10 max-w-lg mx-auto leading-relaxed">
              Ingresá con tu cuenta de Google y empezá a cotizar en minutos.
              Gratis para siempre en el plan básico.
            </p>
            <button
              onClick={() => onLogin()}
              className="inline-flex items-center gap-3 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[16px] font-bold px-10 py-4.5 rounded-xl transition-all cursor-pointer shadow-2xl shadow-[#22C55E]/30 hover:shadow-[#22C55E]/50 hover:-translate-y-0.5"
            >
              Empezar gratis ahora <ArrowRight size={18} />
            </button>
            <p className="text-[12px] text-white/20 mt-5">
              No requiere tarjeta · Configuración en 2 minutos · Cancelás cuando querés
            </p>
          </div>
        </Reveal>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="text-[18px] font-bold">
            Cotiz<span className="text-[#22C55E]">agro</span>
          </div>
          <div className="text-[12px] text-white/25">
            © {new Date().getFullYear()} Cotizagro · Maquinaria Agrícola Argentina
          </div>
          <div className="flex items-center gap-4 text-[12px] text-white/30">
            <button onClick={() => onLogin()} className="hover:text-white transition-colors cursor-pointer">
              Ingresar
            </button>
            <span>·</span>
            <a href="mailto:hola@cotizagro.app" className="hover:text-white transition-colors">
              Contacto
            </a>
          </div>
        </div>
      </footer>

      {/* ─── Keyframes ────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
