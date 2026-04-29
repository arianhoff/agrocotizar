import { useState, useEffect } from 'react'
import { HighlightedText } from '../../components/ui/highlighted-text'
import logoUrl from '../../assets/ca.svg'
import step1Img from '../../assets/step-1-lista.png'
import step2Img from '../../assets/step-2-ia.png'
import step3Img from '../../assets/step-3-cotizacion.png'
import martinImg from '../../assets/Gemini_Generated_Image_i3dgw0i3dgw0i3dg.png'
import federicoImg from '../../assets/Gemini_Generated_Image_lkn77klkn77klkn7.png'
import carlaImg from '../../assets/Gemini_Generated_Image_cr07qncr07qncr07.png'

const Arrow   = (p: React.SVGProps<SVGSVGElement>) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const Check   = (p: React.SVGProps<SVGSVGElement>) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...p}><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
const Plus    = (p: React.SVGProps<SVGSVGElement>) => <svg width="14" height="14" viewBox="0 0 14 14" fill="none" {...p}><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
const Bolt    = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M11 2L4 11h5l-1 7 7-9h-5l1-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
const Sparkle = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M10 3v4M10 13v4M3 10h4M13 10h4M5 5l2.5 2.5M12.5 12.5L15 15M5 15l2.5-2.5M12.5 7.5L15 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const Doc     = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M5 2h7l4 4v12H5V2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M12 2v4h4M8 10h5M8 13h5M8 7h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const Clock   = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.6"/><path d="M10 5.5V10l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const Shield  = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M10 2l6 2v5c0 4-3 7-6 9-3-2-6-5-6-9V4l6-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M7.5 10l2 2 3-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
const Phone   = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M6 2h8v16H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8.5 15.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const Bell    = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M10 2a6 6 0 0 1 6 6v3l1.5 2.5H2.5L4 11V8a6 6 0 0 1 6-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 15.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
const Wa      = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" {...p}><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>
const StarSvg  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
const TrendUp  = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><path d="M3 14l4.5-4.5 3 3L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 7h3v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
const Group    = (p: React.SVGProps<SVGSVGElement>) => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...p}><circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.6"/><path d="M2 17c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="15" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M17.5 16c0-2.485-1.567-3.756-3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>


// ─── Main ─────────────────────────────────────────────────────────────────────
export function LandingPage({ onLogin }: { onLogin: (plan?: string) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [faqOpen, setFaqOpen]   = useState<number>(0)
  const [annual, setAnnual]     = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const LOGOS = [
    'AgroDistribuidora','Las Acacias','CAMPO & CO.','Implementos del Sur',
    'Don Ángel','Agro Pampeana','La Sembradora','RuralTec',
  ]

  const BENEFITS = [
    { icon: <Bolt/>,    t: '10× más rápido',           d: 'Lo que antes te llevaba una tarde ahora se resuelve en minutos. Cargás la lista y ya podés cotizar.' },
    { icon: <Sparkle/>, t: 'IA que entiende tu rubro',  d: 'Entrenada con listas reales de maquinaria agrícola. Reconoce modelos, marcas y variantes sin ayuda.' },
    { icon: <Doc/>,     t: 'Cotizaciones profesionales',d: 'PDFs con tu marca, listos para mandar. Números claros, sin confusiones ni errores de tipeo.' },
    { icon: <Shield/>,  t: 'Verificación de clientes',  d: 'Consultá el historial crediticio BCRA del cliente antes de cerrar. Situación financiera en tiempo real.' },
    { icon: <Bell/>,    t: 'Seguimiento automático',    d: 'Recordatorios automáticos al compartir una cotización. Nunca más pierdas una venta por no hacer seguimiento.' },
    { icon: <Phone/>,   t: 'Pensado para el campo',     d: 'Funciona bien con señal baja. Lo usás desde el celular en la camioneta o desde la compu en la oficina.' },
  ]

  const TESTIMONIALS = [
    { q: 'Cotizaba con Excel y cada cliente me llevaba media hora. Ahora mando cotizaciones en el mismo momento que me piden el precio.', n: 'Martín Arrigoni', r: 'Concesionario · Pergamino',        img: martinImg  },
    { q: 'Lo más útil fue poder cargar la lista del proveedor como viene — en PDF, con logos, con todo — y que salga bien ordenada.',     n: 'Carla Giménez',   r: 'Vendedora · Venado Tuerto',        img: carlaImg   },
    { q: 'Lo uso desde el celular cuando estoy recorriendo campos. Armo la cotización ahí mismo y se la mando por WhatsApp al productor.', n: 'Federico Olmedo', r: 'Contratista rural · Río Cuarto',   img: federicoImg },
  ]

  const FAQS = [
    { q: '¿Qué tipo de listas de precios puedo cargar?',     a: 'Podés subir PDFs, Excel o imágenes (foto de una lista impresa). La IA reconoce el formato y extrae productos, marcas y precios automáticamente.' },
    { q: '¿Necesito saber de computación para usarlo?',      a: 'No. Está pensado para que cualquiera lo use. Si sabés mandar un WhatsApp y abrir un PDF, sabés usar Cotizagro. Si te trabás, el soporte contesta rápido.' },
    { q: '¿Funciona sin buena señal de internet?',           a: 'Sí. La app está optimizada para conexiones lentas del interior. Una vez cargada, podés armar cotizaciones aunque pierdas señal y se sincroniza cuando vuelve.' },
    { q: '¿Puedo cancelar cuando quiera?',                   a: 'Sí, sin preguntas. No hay permanencia ni letra chica. Cancelás desde Configuración con un click.' },
    { q: '¿Mis listas de precios son privadas?',             a: '100%. Tus listas, tus clientes y tus márgenes son solo tuyos. No los compartimos, no los usamos para nada, no los vendemos. Punto.' },
    { q: '¿Cómo funciona el plan Concesionarios?',           a: 'El administrador crea hasta 5 vendedores. Cada uno accede con sus propias credenciales, carga sus listas y arma cotizaciones. El admin ve todas las cotizaciones del equipo en un solo lugar.' },
  ]

  const monthlyPrices = { vendedores: 4.50,  concesionarios: 14.50 }
  const annualPrices  = { vendedores: 3.60,  concesionarios: 11.60 }
  const prices = annual ? annualPrices : monthlyPrices

  const PLANS = [
    {
      name: 'Gratis', desc: 'Para dar los primeros pasos sin pagar nada.',
      price: '$0', origPrice: null as string|null,
      note: 'Gratis para siempre',
      features: ['Hasta 10 cotizaciones / mes','Asistente IA (10 consultas)','1 lista de precios activa','PDF básico','Verificación BCRA','Soporte por email'],
      cta: 'Crear cuenta', featured: false,
      intentPrimary: undefined as string|undefined, intentSecondary: undefined as string|undefined,
    },
    {
      name: 'Vendedores', desc: 'Para vendedores que cotizan todos los días.',
      price: `$${prices.vendedores.toFixed(2)}`, origPrice: '$9',
      note: annual ? 'USD / mes · facturado anual' : 'USD / mes · facturación mensual',
      features: ['Cotizaciones ilimitadas','IA ilimitada + importación PDF','Listas de precios ilimitadas','PDF profesional con tu logo','Verificación BCRA ilimitada','CRM y seguimiento automático','Envío por WhatsApp','Soporte por WhatsApp'],
      cta: 'Empezar 14 días gratis', featured: true,
      intentPrimary: 'trial_vendedores', intentSecondary: 'checkout_vendedores',
    },
    {
      name: 'Concesionarios', desc: 'Para equipos con varios vendedores.',
      price: `$${prices.concesionarios.toFixed(2)}`, origPrice: '$29',
      note: annual ? 'USD / mes · hasta 5 vendedores · anual' : 'USD / mes · hasta 5 vendedores',
      features: ['Todo lo del plan Vendedores','Hasta 5 vendedores en el equipo','Admin ve cotizaciones de todos','Cada vendedor gestiona sus listas','Dashboard gerencial','Soporte prioritario'],
      cta: 'Empezar 14 días gratis', featured: false,
      intentPrimary: 'trial_concesionarios', intentSecondary: 'checkout_concesionarios',
    },
  ]

  return (
    <>
      <style>{`
        .lp-root { font-family: "Geist", system-ui, -apple-system, sans-serif; color: #0E1513; background: #FFFFFF; font-size: 16px; line-height: 1.55; -webkit-font-smoothing: antialiased; }
        .lp-root * { box-sizing: border-box; }
        .lp-root a { color: inherit; text-decoration: none; }
        .lp-root button { font-family: inherit; cursor: pointer; }
        .lp-root button:not(.lp-btn) { background: none; border: none; }
        .lp-container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 24px; }

        /* ── Nav ── */
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: rgba(255,255,255,0.85); backdrop-filter: saturate(180%) blur(12px); -webkit-backdrop-filter: saturate(180%) blur(12px); border-bottom: 1px solid transparent; transition: border-color .2s; }
        .lp-nav-spacer { height: 64px; }
        .lp-nav.scrolled { border-bottom-color: #E7EBE8; }
        .lp-nav-inner { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .lp-logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; letter-spacing: -0.01em; color: #0E1513; }
        .lp-logo img { height: 30px; width: auto; flex-shrink: 0; display: block; }
        .lp-nav-links { display: flex; gap: 32px; align-items: center; font-size: 14px; color: #394742; }
        .lp-nav-links button { color: #394742; font-size: 14px; padding: 4px 0; }
        .lp-nav-links button:hover { color: #0E1513; }
        .lp-nav-cta { display: flex; gap: 10px; align-items: center; }
        @media (max-width: 820px) { .lp-nav-links { display: none; } }
        @media (max-width: 480px) { .lp-nav-cta .lp-btn-ghost { display: none; } }

        /* Hamburger */
        .lp-hamburger { display: none; flex-direction: column; justify-content: center; gap: 5px; width: 36px; height: 36px; padding: 6px; border-radius: 8px; transition: background .15s; }
        .lp-hamburger:hover { background: #F2F4F1; }
        @media (max-width: 820px) { .lp-hamburger { display: flex; } }
        .lp-hamburger-bar { width: 20px; height: 2px; background: #0E1513; border-radius: 2px; transition: transform .22s ease, opacity .22s ease; transform-origin: center; }
        .lp-hamburger.open .lp-hamburger-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .lp-hamburger.open .lp-hamburger-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .lp-hamburger.open .lp-hamburger-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
        .lp-mobile-menu { display: none; position: absolute; top: 64px; left: 0; right: 0; background: white; border-bottom: 1px solid #E7EBE8; padding: 8px 24px 24px; box-shadow: 0 12px 32px -8px rgba(14,21,19,.14); flex-direction: column; z-index: 49; }
        .lp-mobile-menu.open { display: flex; }
        .lp-mobile-menu-link { text-align: left; padding: 14px 0; font-size: 16px; font-weight: 500; color: #394742; border-bottom: 1px solid #F0F2F0; width: 100%; }
        .lp-mobile-menu-link:last-of-type { border-bottom: none; }
        .lp-mobile-menu-link:hover { color: #3FA34D; }
        .lp-mobile-menu-cta { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }

        /* ── Buttons ── */
        .lp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; transition: transform .08s, background .15s, border-color .15s, box-shadow .15s; white-space: nowrap; }
        .lp-btn:active { transform: translateY(1px); }
        .lp-btn-lg { padding: 14px 22px; font-size: 15px; }
        .lp-btn-primary { background: #3FA34D; color: white; }
        .lp-btn-primary:hover { background: #1F5F3F; }
        .lp-btn-ghost { color: #0E1513; background: transparent; }
        .lp-btn-ghost:hover { background: #F2F4F1; }
        .lp-btn-outline { border: 1px solid #E7EBE8; color: #0E1513; background: white; }
        .lp-btn-outline:hover { border-color: #394742; }

        /* ── Sections ── */
        .lp-section { padding: 96px 0; }
        @media (max-width: 820px) { .lp-section { padding: 72px 0; } }
        @media (max-width: 480px) { .lp-section { padding: 56px 0; } }
        .lp-eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #1F5F3F; margin-bottom: 16px; display: inline-flex; align-items: center; gap: 8px; font-family: ui-monospace, "Geist Mono", monospace; }
        .lp-eyebrow::before { content: ""; width: 16px; height: 1px; background: currentColor; flex-shrink: 0; }
        .lp-section-title { font-size: clamp(28px, 4vw, 44px); line-height: 1.08; letter-spacing: -0.02em; margin: 0 0 16px; font-weight: 600; }
        .lp-section-sub { font-size: 18px; color: #6B7872; max-width: 620px; margin: 0; }
        .lp-section-head { margin-bottom: 56px; }
        @media (max-width: 820px) {
          .lp-section-head { text-align: center; display: flex; flex-direction: column; align-items: center; margin-bottom: 40px; }
          .lp-section-sub { text-align: center; margin: 0 auto; }
          .lp-section-title br { display: none; }
        }

        /* ── Hero ── */
        .lp-hero { padding: 72px 0 88px; position: relative; overflow: hidden; }
        @media (max-width: 820px) { .lp-hero { padding: 48px 0 64px; } }
        @media (max-width: 480px) { .lp-hero { padding: 32px 0 48px; } }
        .lp-hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; }
        @media (max-width: 960px) { .lp-hero-grid { grid-template-columns: 1fr; gap: 40px; } }
        @media (max-width: 820px) { .lp-hero-grid { text-align: center; } }
        .lp-hero-badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border: 1px solid #E7EBE8; border-radius: 999px; font-size: 13px; color: #394742; margin-bottom: 24px; background: white; }
        .lp-hero-badge-tag { background: #EAF5EC; color: #1F5F3F; padding: 2px 10px; border-radius: 999px; font-weight: 500; font-size: 12px; }
        .lp-hero h1 { font-size: clamp(36px, 5.5vw, 64px); line-height: 1.05; letter-spacing: -0.03em; margin: 0 0 24px; font-weight: 600; }
        .lp-hero h1 em { font-style: normal; color: #3FA34D; }
        .lp-hero-sub { font-size: 18px; color: #394742; max-width: 520px; margin: 0 0 32px; line-height: 1.5; }
        @media (max-width: 820px) { .lp-hero-sub { margin: 0 auto 32px; } }
        .lp-hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px; }
        @media (max-width: 820px) { .lp-hero-ctas { justify-content: center; } }
        @media (max-width: 420px) { .lp-hero-ctas { flex-direction: column; } .lp-hero-ctas .lp-btn { width: 100%; justify-content: center; } }
        .lp-hero-trust { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        @media (max-width: 820px) { .lp-hero-trust { justify-content: center; } }
        .lp-trust-stat { display: flex; flex-direction: column; gap: 1px; }
        .lp-trust-stat-val { font-size: 18px; font-weight: 600; color: #0E1513; letter-spacing: -0.02em; line-height: 1.1; }
        .lp-trust-stat-label { font-size: 12px; color: #6B7872; }
        .lp-trust-divider { width: 1px; height: 32px; background: #E7EBE8; flex-shrink: 0; }
        @media (max-width: 960px) { .lp-mock-wrap { display: none; } }

        /* Mock */
        .lp-mock { background: white; border: 1px solid #E7EBE8; border-radius: 16px; box-shadow: 0 1px 2px rgba(14,21,19,.04), 0 20px 40px -16px rgba(14,21,19,.14), 0 40px 80px -30px rgba(31,95,63,.18); overflow: hidden; }
        .lp-mock-bar { display: flex; align-items: center; gap: 6px; padding: 10px 14px; border-bottom: 1px solid #E7EBE8; background: #FAFAF7; }
        .lp-mock-dot { width: 10px; height: 10px; border-radius: 50%; background: #DADFD9; }
        .lp-mock-url { margin-left: 12px; font-family: ui-monospace, monospace; font-size: 11px; color: #6B7872; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lp-mock-body { padding: 20px; }
        .lp-mock-title { font-size: 13px; color: #6B7872; font-family: ui-monospace, monospace; margin-bottom: 10px; }
        .lp-mock-row { display: grid; grid-template-columns: 1.2fr 0.8fr 0.7fr 0.6fr; gap: 12px; padding: 12px 0; border-bottom: 1px dashed #E7EBE8; font-size: 14px; align-items: center; }
        .lp-mock-row:last-child { border-bottom: none; }
        .lp-mock-row.head { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6B7872; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #E7EBE8; }
        .lp-mock-price { font-weight: 500; color: #0E1513; }
        .lp-mock-chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #EAF5EC; color: #1F5F3F; font-weight: 500; }
        .lp-ai-card { position: absolute; right: -20px; bottom: -24px; background: white; border: 1px solid #E7EBE8; border-radius: 14px; padding: 14px 16px; box-shadow: 0 10px 30px -12px rgba(14,21,19,.2); display: flex; align-items: center; gap: 12px; font-size: 13px; max-width: 280px; }
        @media (max-width: 500px) { .lp-ai-card { right: 12px; bottom: -16px; } }
        .lp-ai-icon { width: 32px; height: 32px; border-radius: 10px; background: #3FA34D; display: grid; place-items: center; color: white; flex-shrink: 0; }
        .lp-ai-label { color: #6B7872; font-size: 11px; }
        .lp-ai-val { color: #0E1513; font-weight: 500; }

        /* ── Logos ── */
        .lp-logos-row { padding: 40px 0; border-top: 1px solid #E7EBE8; border-bottom: 1px solid #E7EBE8; background: #FAFAF7; overflow: hidden; }
        .lp-logos-inner { display: flex; align-items: center; gap: 24px; }
        .lp-logos-label { flex-shrink: 0; padding-left: 24px; font-size: 12px; font-family: ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; color: #6B7872; white-space: nowrap; }
        @media (max-width: 480px) { .lp-logos-label { display: none; } }
        .lp-logos-viewport { flex: 1; overflow: hidden; mask-image: linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent); -webkit-mask-image: linear-gradient(to right, transparent, black 48px, black calc(100% - 48px), transparent); }
        .lp-logos-track { display: flex; gap: 56px; width: max-content; animation: lp-scroll 38s linear infinite; }
        .lp-logos-track:hover { animation-play-state: paused; }
        .lp-logos-track > * { flex-shrink: 0; white-space: nowrap; font-size: 20px; color: #394742; opacity: 0.7; font-style: italic; letter-spacing: -0.01em; }
        @keyframes lp-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        /* ── How ── */
        .lp-how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 820px) { .lp-how-grid { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; } }
        .lp-step { position: relative; border-radius: 18px; border: 1px solid rgba(14,21,19,.08); background: rgba(255,255,255,.55); backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%); overflow: hidden; transition: border-color .3s, box-shadow .3s, transform .3s; display: flex; flex-direction: column; }
        .lp-step:hover { border-color: rgba(63,163,77,.5); box-shadow: 0 20px 50px -20px rgba(31,95,63,.2); transform: translateY(-2px); }
        .lp-step-media { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #FAFAF7; }
        .lp-step-illus { position: absolute; inset: 0; width: 100%; height: 100%; }
        .lp-step-media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(255,255,255,.7), transparent 60%); opacity: .7; transition: opacity .3s; pointer-events: none; }
        .lp-step:hover .lp-step-media::after { opacity: .45; }
        .lp-step-tags { position: absolute; bottom: 12px; left: 12px; display: flex; gap: 6px; z-index: 2; flex-wrap: wrap; }
        .lp-step-tag { background: rgba(255,255,255,.7); backdrop-filter: blur(8px); color: #394742; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 500; border: 1px solid rgba(14,21,19,.06); }
        .lp-step-tag.green { background: #3FA34D; color: white; border-color: transparent; }
        .lp-step-action { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(255,255,255,.25); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px); opacity: 0; transition: opacity .3s; z-index: 3; }
        .lp-step:hover .lp-step-action { opacity: 1; }
        .lp-step-action-btn { display: inline-flex; align-items: center; gap: 8px; background: #3FA34D; color: white; padding: 10px 18px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 10px 24px -8px rgba(31,95,63,.5); transition: transform .15s; }
        .lp-step-action-btn:hover { transform: scale(1.04); }
        .lp-step-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; flex: 1; }
        .lp-step-num { font-size: 11px; color: #1F5F3F; display: flex; align-items: center; gap: 10px; letter-spacing: .06em; font-family: ui-monospace, monospace; }
        .lp-step-num-circle { width: 24px; height: 24px; border-radius: 50%; background: #EAF5EC; color: #1F5F3F; display: grid; place-items: center; font-weight: 600; font-size: 12px; flex-shrink: 0; }
        .lp-step-title { font-size: 19px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 6px; line-height: 1.2; }
        .lp-step-desc { color: #6B7872; font-size: 14px; margin: 0; line-height: 1.55; }
        .lp-step-foot { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid rgba(14,21,19,.08); font-size: 12px; color: #6B7872; }
        .lp-step-foot-meta { display: flex; align-items: center; gap: 8px; }
        .lp-step-foot-icon { width: 28px; height: 28px; border-radius: 50%; background: #EAF5EC; color: #1F5F3F; display: grid; place-items: center; flex-shrink: 0; }
        .lp-step-foot-name { color: #0E1513; font-weight: 500; font-size: 12px; }

        /* ── Benefits ── */
        .lp-benefits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: #E7EBE8; border: 1px solid #E7EBE8; border-radius: 16px; overflow: hidden; }
        @media (max-width: 820px) { .lp-benefits-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .lp-benefits-grid { grid-template-columns: 1fr; } }
        .lp-benefit { background: white; padding: 28px 24px; transition: background .2s; }
        .lp-benefit { background: white; padding: 32px 28px; transition: background .2s; }
        .lp-benefit:hover { background: #FAFDF8; }
        .lp-benefit-icon { width: 40px; height: 40px; border-radius: 10px; background: #EAF5EC; color: #1F5F3F; display: grid; place-items: center; margin-bottom: 20px; }
        .lp-benefit h3 { font-size: 17px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.01em; }
        .lp-benefit p { margin: 0; font-size: 15px; color: #6B7872; line-height: 1.5; }

        /* ── Testimonials ── */
        .lp-testim-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; justify-items: center; }
        @media (max-width: 820px) { .lp-testim-grid { grid-template-columns: 1fr; max-width: 380px; margin: 0 auto; } }
        .lp-testim { width: 100%; max-width: 340px; background: white; color: #0E1513; border: 1px solid #E7EBE8; border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; transition: transform .3s, box-shadow .3s, border-color .3s; }
        .lp-testim:hover { transform: translateY(-4px); border-color: rgba(63,163,77,.4); box-shadow: 0 24px 50px -25px rgba(31,95,63,.25); }
        .lp-testim-photo { position: relative; overflow: hidden; margin: 8px 8px 0; border-radius: 14px; background: #EAF5EC; }
        .lp-testim-photo img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: top center; transition: transform .5s ease; }
        .lp-testim:hover .lp-testim-photo img { transform: scale(1.04); }
        .lp-testim-stars { position: absolute; top: 12px; left: 12px; z-index: 2; display: flex; gap: 2px; background: rgba(255,255,255,.85); backdrop-filter: blur(8px); padding: 5px 9px; border-radius: 999px; color: #E8A41A; }
        .lp-testim-body { padding: 20px 22px 22px; }
        .lp-testim-quote { font-size: 15px; font-weight: 500; line-height: 1.55; color: #0E1513; margin: 0 0 18px; padding-bottom: 18px; border-bottom: 1px solid #E7EBE8; }
        .lp-testim-name { font-size: 15px; font-weight: 500; margin: 0 0 2px; }
        .lp-testim-role { font-size: 13px; font-weight: 500; color: #1F5F3F; }

        /* ── Pricing ── */
        .lp-pricing-toggle { display: inline-flex; padding: 4px; background: white; border: 1px solid #E7EBE8; border-radius: 999px; margin-bottom: 48px; }
        .lp-pricing-toggle button { padding: 8px 18px; border-radius: 999px; font-size: 13px; font-weight: 500; color: #6B7872; transition: all .2s; display: flex; align-items: center; gap: 6px; }
        .lp-pricing-toggle button.active { background: #0E1513; color: white; }
        .lp-pricing-save { background: #EAF5EC; color: #1F5F3F; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
        button.active .lp-pricing-save { background: rgba(255,255,255,.2); color: white; }
        .lp-pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; align-items: stretch; }
        @media (max-width: 820px) { .lp-pricing-grid { grid-template-columns: 1fr; max-width: 440px; margin: 0 auto; } }
        .lp-plan { background: white; border: 1px solid #E7EBE8; border-radius: 16px; padding: 32px 28px; display: flex; flex-direction: column; position: relative; }
        .lp-plan.featured { border-color: #3FA34D; border-width: 2px; box-shadow: 0 20px 40px -20px rgba(31,95,63,.25); }
        .lp-plan-badge { position: absolute; top: -11px; left: 24px; background: #3FA34D; color: white; font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
        .lp-plan-name { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
        .lp-plan-desc { font-size: 14px; color: #6B7872; margin: 0 0 24px; min-height: 40px; }
        .lp-plan-price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
        .lp-plan-price .amt { font-size: 42px; font-weight: 600; letter-spacing: -0.02em; line-height: 1; }
        .lp-plan-price .orig { font-size: 20px; color: #6B7872; text-decoration: line-through; margin-left: 4px; }
        .lp-plan-note { font-size: 12px; color: #6B7872; margin-bottom: 6px; }
        .lp-plan-off { display: inline-block; background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-bottom: 10px; }
        .lp-plan-no-card { font-size: 12px; color: #6B7872; margin-bottom: 16px; display: flex; align-items: center; gap: 5px; }
        .lp-plan-no-card svg { color: #3FA34D; flex-shrink: 0; }
        .lp-plan ul { list-style: none; padding: 0; margin: 0 0 28px; font-size: 14px; flex: 1; }
        .lp-plan li { padding: 8px 0; display: flex; gap: 10px; align-items: flex-start; color: #394742; border-bottom: 1px solid #F0F5F0; }
        .lp-plan li:last-child { border-bottom: none; }
        .lp-plan li svg { flex-shrink: 0; margin-top: 2px; color: #3FA34D; }
.lp-plan-secondary { font-size: 13px; color: #6B7872; padding: 8px; width: 100%; text-align: center; margin-top: 6px; }
        .lp-plan-secondary:hover { color: #0E1513; }

        /* ── FAQ ── */
        .lp-faq-wrap { max-width: 760px; margin: 0 auto; }
        .lp-faq-item { border-bottom: 1px solid #E7EBE8; }
        .lp-faq-q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 24px 0; font-size: 16px; font-weight: 500; text-align: left; color: #0E1513; }
        .lp-faq-q:hover { color: #1F5F3F; }
        .lp-faq-icon { width: 24px; height: 24px; min-width: 24px; border-radius: 50%; background: #FAFAF7; display: grid; place-items: center; flex-shrink: 0; transition: transform .25s, background .2s; color: #394742; }
        .lp-faq-item.open .lp-faq-icon { transform: rotate(45deg); background: #3FA34D; color: white; }
        .lp-faq-a { max-height: 0; overflow: hidden; transition: max-height .3s ease; font-size: 15px; color: #6B7872; line-height: 1.6; }
        .lp-faq-item.open .lp-faq-a { max-height: 300px; padding-bottom: 24px; }

        /* ── CTA ── */
        .lp-cta-box { background: #0E1513; color: white; border-radius: 24px; padding: 72px 56px; position: relative; overflow: hidden; }
        @media (max-width: 680px) { .lp-cta-box { padding: 44px 28px; border-radius: 20px; } }
        .lp-cta-box::before { content: ""; position: absolute; right: -120px; top: -120px; width: 420px; height: 420px; border-radius: 50%; background: radial-gradient(circle, rgba(63,163,77,.28), transparent 65%); pointer-events: none; }
        .lp-cta-box::after  { content: ""; position: absolute; left: -80px; bottom: -80px; width: 280px; height: 280px; border-radius: 50%; background: radial-gradient(circle, rgba(63,163,77,.15), transparent 65%); pointer-events: none; }
        .lp-cta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; position: relative; z-index: 1; }
        @media (max-width: 820px) { .lp-cta-grid { grid-template-columns: 1fr; gap: 40px; } }
        .lp-cta-box h2 { font-size: clamp(30px, 3.8vw, 46px); line-height: 1.08; letter-spacing: -0.025em; margin: 0 0 14px; font-weight: 600; }
        .lp-cta-sub { color: rgba(255,255,255,.6); font-size: 16px; margin: 0 0 32px; line-height: 1.55; }
        .lp-cta-pills { display: flex; align-items: center; gap: 6px; margin-top: 20px; flex-wrap: wrap; }
        .lp-cta-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: rgba(255,255,255,.5); }
        .lp-cta-pill::before { content: "✓"; color: #3FA34D; font-weight: 700; }
        .lp-cta-box .lp-btn-primary { background: #3FA34D; box-shadow: 0 4px 20px -4px rgba(63,163,77,.5); }
        .lp-cta-box .lp-btn-primary:hover { background: #4FB35E; box-shadow: 0 6px 24px -4px rgba(63,163,77,.65); }
        .lp-cta-box .lp-btn-outline { color: white; border-color: rgba(255,255,255,.22); background: transparent; }
        .lp-cta-box .lp-btn-outline:hover { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.4); }
        .lp-contact-card { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; padding: 28px; display: flex; flex-direction: column; gap: 0; }
        .lp-contact-card-title { font-size: 13px; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .08em; font-family: ui-monospace, monospace; margin-bottom: 20px; }
        .lp-contact-item { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid rgba(255,255,255,.07); flex-wrap: wrap; }
        @media (max-width: 400px) { .lp-contact-action { width: 100%; } .lp-contact-btn { width: 100%; justify-content: center; } }
        .lp-contact-item:last-child { border-bottom: none; padding-bottom: 0; }
        .lp-contact-item:first-of-type { padding-top: 0; }
        .lp-contact-icon { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; }
        .lp-contact-icon.wa  { background: rgba(37,211,102,.18); color: #25D366; }
        .lp-contact-icon.mail { background: rgba(255,255,255,.1); color: rgba(255,255,255,.7); }
        .lp-contact-icon svg, .lp-contact-icon svg path { fill: currentColor; }
        .lp-contact-label { font-size: 11px; color: rgba(255,255,255,.4); margin-bottom: 2px; text-transform: uppercase; letter-spacing: .05em; font-family: ui-monospace, monospace; }
        .lp-contact-value { font-size: 14px; font-weight: 500; color: white; }
        .lp-contact-action { margin-left: auto; flex-shrink: 0; }
        .lp-contact-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background .15s, transform .1s; }
        .lp-contact-btn:active { transform: translateY(1px); }
        .lp-contact-btn.wa   { background: #25D366; color: white; }
        .lp-contact-btn.wa:hover { background: #1EB555; }
        .lp-contact-btn.wa svg, .lp-contact-btn.wa svg path { fill: white; }
        .lp-contact-btn.mail { background: rgba(255,255,255,.12); color: white; border: 1px solid rgba(255,255,255,.15); }
        .lp-contact-btn.mail:hover { background: rgba(255,255,255,.2); }
        .lp-respond-badge { display: inline-flex; align-items: center; gap: 6px; margin-top: 16px; padding: 6px 10px; background: rgba(63,163,77,.15); border: 1px solid rgba(63,163,77,.25); border-radius: 999px; font-size: 12px; color: rgba(255,255,255,.65); }
        .lp-respond-dot { width: 6px; height: 6px; border-radius: 50%; background: #3FA34D; animation: lp-pulse 2s ease-in-out infinite; flex-shrink: 0; }
        @keyframes lp-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

        /* ── Footer ── */
        footer.lp-footer { padding: 48px 0 32px; border-top: 1px solid #E7EBE8; color: #6B7872; font-size: 14px; }
        .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        @media (max-width: 820px) { .lp-footer-grid { grid-template-columns: 2fr 1fr 1fr; gap: 28px; } }
        @media (max-width: 540px) { .lp-footer-grid { grid-template-columns: 1fr 1fr; gap: 24px; } }
        .lp-footer-col h4 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #0E1513; margin: 0 0 16px; font-weight: 600; }
        .lp-footer-col a, .lp-footer-col button { display: block; padding: 6px 0; color: #6B7872; font-size: 14px; background: none; border: none; font-family: inherit; cursor: pointer; text-align: left; }
        .lp-footer-col a:hover, .lp-footer-col button:hover { color: #0E1513; }
        .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; padding-top: 24px; border-top: 1px solid #E7EBE8; font-size: 13px; }

        /* ── Problem ── */
        .lp-prob-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; margin-bottom: 20px; }
        @media (max-width: 820px) { .lp-prob-grid { grid-template-columns: 1fr; margin: 0 auto 20px; } }
        @media (max-width: 480px) { .lp-prob-resolution { padding: 28px 20px; } }
        .lp-prob-card { background: white; border: 1px solid #E7EBE8; border-radius: 16px; padding: 32px 28px; display: flex; flex-direction: column; gap: 12px; transition: border-color .2s, box-shadow .2s; }
        .lp-prob-card:hover { border-color: rgba(63,163,77,.35); box-shadow: 0 12px 32px -12px rgba(14,21,19,.1); }
        .lp-prob-icon { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; }
        .lp-prob-card--red   .lp-prob-icon { background: #FEF2F2; color: #EF4444; }
        .lp-prob-card--amber .lp-prob-icon { background: #FFFBEB; color: #D97706; }
        .lp-prob-card--green .lp-prob-icon { background: #EAF5EC; color: #3FA34D; }
        .lp-prob-stat { font-size: 52px; font-weight: 700; letter-spacing: -0.04em; line-height: 1; }
        .lp-prob-card--red   .lp-prob-stat { color: #EF4444; }
        .lp-prob-card--amber .lp-prob-stat { color: #D97706; }
        .lp-prob-card--green .lp-prob-stat { color: #3FA34D; }
        .lp-prob-desc { font-size: 15px; color: #6B7872; margin: 0; line-height: 1.5; }
        .lp-prob-resolution { background: #EAF5EC; border: 1px solid rgba(63,163,77,.25); border-radius: 16px; padding: 40px 48px; text-align: center; }
        @media (max-width: 680px) { .lp-prob-resolution { padding: 28px 24px; } }
        .lp-prob-resolution-title { font-size: clamp(20px, 3vw, 26px); font-weight: 600; color: #0E1513; margin: 0 0 12px; letter-spacing: -0.02em; line-height: 1.25; }
        .lp-prob-resolution-sub { font-size: 15px; color: #6B7872; margin: 0 auto; max-width: 560px; line-height: 1.6; }

        /* ── WhatsApp float ── */
        .lp-wa-float { position: fixed; bottom: 20px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background: #25D366; display: grid; place-items: center; color: white; box-shadow: 0 10px 30px -8px rgba(37,211,102,.5); z-index: 40; transition: transform .2s; text-decoration: none; }
        .lp-wa-float:hover { transform: scale(1.08); }
        .lp-wa-float svg, .lp-wa-float svg path { fill: white; }
        .lp-wa-btn svg, .lp-wa-btn svg path { fill: white; }
      `}</style>

      <div className="lp-root">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
          <div className="lp-container lp-nav-inner">
            <button onClick={() => { window.scrollTo({top:0,behavior:'smooth'}); setMenuOpen(false); }} className="lp-logo">
              <img src={logoUrl} alt="Cotizagro"/>
              Cotizagro
            </button>
            <div className="lp-nav-links">
              {[['how','Cómo funciona'],['benefits','Beneficios'],['pricing','Precios'],['faq','Preguntas']].map(([id,label]) => (
                <button key={id} onClick={() => scrollTo(id)}>{label}</button>
              ))}
            </div>
            <div className="lp-nav-cta">
              <button onClick={() => onLogin()} className="lp-btn lp-btn-ghost">Iniciar sesión</button>
              <button onClick={() => onLogin()} className="lp-btn lp-btn-primary">Crear cuenta <Arrow/></button>
              <button className={`lp-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
                <span className="lp-hamburger-bar"/><span className="lp-hamburger-bar"/><span className="lp-hamburger-bar"/>
              </button>
            </div>
          </div>
          <div className={`lp-mobile-menu${menuOpen ? ' open' : ''}`}>
            {[['how','Cómo funciona'],['benefits','Beneficios'],['pricing','Precios'],['faq','Preguntas']].map(([id,label]) => (
              <button key={id} className="lp-mobile-menu-link" onClick={() => scrollTo(id)}>{label}</button>
            ))}
            <div className="lp-mobile-menu-cta">
              <button onClick={() => { onLogin(); setMenuOpen(false); }} className="lp-btn lp-btn-primary" style={{width:'100%',justifyContent:'center'}}>Crear cuenta gratis <Arrow/></button>
              <button onClick={() => { onLogin(); setMenuOpen(false); }} className="lp-btn lp-btn-outline" style={{width:'100%',justifyContent:'center'}}>Iniciar sesión</button>
            </div>
          </div>
        </nav>

        <div className="lp-nav-spacer"/>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="lp-hero" id="hero">
          <div className="lp-container lp-hero-grid">
            <div>
              <div className="lp-hero-badge">
                <span className="lp-hero-badge-tag">Gratis</span>
                <span>Importá PDF, Excel o foto · Sin formateo manual</span>
              </div>
              <h1>Cotizá tus máquinas <HighlightedText delay={0.2}>10× más rápido</HighlightedText></h1>
              <p className="lp-hero-sub">Cargá tu lista de precios y nuestra IA la pasa en limpio. Mandá cotizaciones profesionales en minutos, no en horas.</p>
              <div className="lp-hero-ctas">
                <button onClick={() => onLogin()} className="lp-btn lp-btn-primary lp-btn-lg">Crear cuenta gratis <Arrow/></button>
                <button onClick={() => scrollTo('how')} className="lp-btn lp-btn-outline lp-btn-lg">Ver cómo funciona</button>
              </div>
              <div className="lp-hero-trust">
                <div className="lp-trust-stat">
                  <span className="lp-trust-stat-val">+200</span>
                  <span className="lp-trust-stat-label">vendedores activos</span>
                </div>
                <div className="lp-trust-divider"/>
                <div className="lp-trust-stat">
                  <span className="lp-trust-stat-val">10×</span>
                  <span className="lp-trust-stat-label">más rápido cotizando</span>
                </div>
                <div className="lp-trust-divider"/>
                <div className="lp-trust-stat">
                  <span className="lp-trust-stat-val">14 días</span>
                  <span className="lp-trust-stat-label">gratis, sin tarjeta</span>
                </div>
              </div>
            </div>
            <div className="lp-mock-wrap" style={{position:'relative', paddingBottom: 28}}>
              <div className="lp-mock">
                <div className="lp-mock-bar">
                  <div className="lp-mock-dot"/><div className="lp-mock-dot"/><div className="lp-mock-dot"/>
                  <span className="lp-mock-url">cotizagro.com.ar/cotizaciones/nueva</span>
                </div>
                <div className="lp-mock-body">
                  <div className="lp-mock-title">Cotización #2847 · Campo Los Álamos</div>
                  <div className="lp-mock-row head"><div>Producto</div><div>Marca</div><div style={{textAlign:'right'}}>Precio</div><div/></div>
                  {[
                    ['Cosechadora 9500','John Deere','USD 285.000','Stock'],
                    ['Tractor 7230J','John Deere','USD 142.500','Stock'],
                    ['Sembradora VT','Agrometal','USD 68.900','Pedido'],
                    ['Pulverizadora 3200','Metalfor','USD 94.200','Stock'],
                  ].map(([prod,brand,price,status]) => (
                    <div className="lp-mock-row" key={prod}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{prod}</div>
                      <div style={{color:'#6B7872',fontSize:12}}>{brand}</div>
                      <div className="lp-mock-price" style={{textAlign:'right',fontSize:12}}>{price}</div>
                      <div style={{textAlign:'right'}}>
                        <span className="lp-mock-chip" style={status==='Pedido'?{background:'#FEF3E2',color:'#B6691A'}:undefined}>{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lp-ai-card">
                <div className="lp-ai-icon"><Sparkle/></div>
                <div>
                  <div className="lp-ai-label">IA · procesado en</div>
                  <div className="lp-ai-val">1,2 segundos · 47 productos</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Logos ───────────────────────────────────────────────────────── */}
        <div className="lp-logos-row">
          <div className="lp-logos-inner">
            <span className="lp-logos-label">Confiado por</span>
            <div className="lp-logos-viewport">
              <div className="lp-logos-track">
                {[...LOGOS,...LOGOS].map((l,i) => <span key={i}>{l}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* ── Problem ─────────────────────────────────────────────────────── */}
        <section className="lp-section" id="problem">
          <div className="lp-container">
            <div className="lp-section-head" style={{textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div className="lp-eyebrow">El problema</div>
              <h2 className="lp-section-title">
                ¿Cuánto tiempo perdés<br/>en cada <HighlightedText delay={0.1}>cotización?</HighlightedText>
              </h2>
              <p className="lp-section-sub" style={{textAlign:'center'}}>
                La mayoría de los vendedores de maquinaria agrícola siguen usando Excel o Word. Eso tiene un costo enorme.
              </p>
            </div>

            <div className="lp-prob-grid">
              {[
                { icon: <Clock style={{width:24,height:24}}/>,   stat:'45 min', desc:'promedio por cotización en Excel',                      color:'red'   },
                { icon: <TrendUp style={{width:24,height:24}}/>, stat:'30%',    desc:'de ventas perdidas por falta de seguimiento',            color:'amber' },
                { icon: <Group style={{width:24,height:24}}/>,   stat:'3×',     desc:'más clientes al adoptar herramientas de automatización', color:'green' },
              ].map((item,i) => (
                <div className={`lp-prob-card lp-prob-card--${item.color}`} key={i}>
                  <div className="lp-prob-icon">{item.icon}</div>
                  <div className="lp-prob-stat">{item.stat}</div>
                  <p className="lp-prob-desc">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="lp-prob-resolution">
              <p className="lp-prob-resolution-title">
                Cotizagro lo resuelve todo en{' '}
                <span style={{color:'#3FA34D'}}>menos de 2 minutos</span>
              </p>
              <p className="lp-prob-resolution-sub">
                IA que entiende tu catálogo, genera el PDF, verifica el cliente y registra el seguimiento automáticamente.
              </p>
            </div>
          </div>
        </section>

        {/* ── How ─────────────────────────────────────────────────────────── */}
        <section className="lp-section" id="how">
          <div className="lp-container">
            <div className="lp-section-head">
              <div className="lp-eyebrow">Cómo funciona</div>
              <h2 className="lp-section-title">Tres pasos. <HighlightedText>Listo.</HighlightedText></h2>
              <p className="lp-section-sub">De la lista de precios que te mandan los proveedores a una cotización presentable — sin pasar horas en Excel.</p>
            </div>
            <div className="lp-how-grid">
              {[
                { n:1, kind:'CARGAR',   title:'Subí la lista',           desc:'Subí el PDF, Excel o imagen que te pasó tu proveedor. Como venga, no importa el formato.', tags:[{t:'PDF'},{t:'Excel'},{t:'Imagen',green:true}], foot:'~ 30 segundos', cta:'Probar carga',  img: step1Img },
                { n:2, kind:'PROCESAR', title:'La IA la pasa en limpio', desc:'Reconoce productos, marcas y precios. Los organiza en tu catálogo automáticamente.',        tags:[{t:'IA',green:true},{t:'OCR'},{t:'Auto'}],       foot:'~ 2 segundos',  cta:'Ver demo',     img: step2Img },
                { n:3, kind:'ENVIAR',   title:'Armá y mandá',            desc:'Seleccioná productos, ajustá márgenes y generá el PDF. Mandalo por WhatsApp o email.',        tags:[{t:'PDF'},{t:'WhatsApp',green:true},{t:'Email'}], foot:'~ 1 minuto',    cta:'Ver ejemplo',  img: step3Img },
              ].map(s => (
                <div className="lp-step" key={s.n}>
                  <div className="lp-step-media">
                    <img src={s.img} alt={s.title} className="lp-step-illus" style={{objectFit:'cover', objectPosition:'top left'}}/>
                    <div className="lp-step-tags">
                      {s.tags.map((tag,j) => <span key={j} className={`lp-step-tag${tag.green?' green':''}`}>{tag.t}</span>)}
                    </div>
                    <div className="lp-step-action">
                      <button className="lp-btn lp-step-action-btn" onClick={() => onLogin()}><Arrow/> {s.cta}</button>
                    </div>
                  </div>
                  <div className="lp-step-body">
                    <div className="lp-step-num"><span className="lp-step-num-circle">{s.n}</span>{s.kind}</div>
                    <div>
                      <h3 className="lp-step-title">{s.title}</h3>
                      <p className="lp-step-desc">{s.desc}</p>
                    </div>
                    <div className="lp-step-foot">
                      <div className="lp-step-foot-meta">
                        <span className="lp-step-foot-icon"><Sparkle style={{width:13,height:13}}/></span>
                        <div><div className="lp-step-foot-name">Paso {s.n} de 3</div><div>Cotizagro</div></div>
                      </div>
                      <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                        <Clock style={{width:12,height:12}}/> {s.foot}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Benefits ────────────────────────────────────────────────────── */}
        <section className="lp-section" id="benefits" style={{background:'#FAFAF7'}}>
          <div className="lp-container">
            <div className="lp-section-head">
              <div className="lp-eyebrow">Beneficios</div>
              <h2 className="lp-section-title">Hecho para quien vende<br/><HighlightedText delay={0.1}>maquinaria y servicios.</HighlightedText></h2>
              <p className="lp-section-sub">No un CRM genérico adaptado a la fuerza. Una herramienta pensada desde el día uno para el negocio agropecuario.</p>
            </div>
            <div className="lp-benefits-grid">
              {BENEFITS.map((b,i) => (
                <div className="lp-benefit" key={i}>
                  <div className="lp-benefit-icon">{b.icon}</div>
                  <h3>{b.t}</h3>
                  <p>{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ────────────────────────────────────────────────── */}
        <section className="lp-section" id="testimonials">
          <div className="lp-container">
            <div className="lp-section-head">
              <div className="lp-eyebrow">Testimonios</div>
              <h2 className="lp-section-title">Lo que dicen<br/><HighlightedText delay={0.1}>quienes ya lo usan.</HighlightedText></h2>
              <p className="lp-section-sub">Vendedores de todo el país, de todo tipo de concesionarias y rubros de maquinaria.</p>
            </div>
            <div className="lp-testim-grid">
              {TESTIMONIALS.map((t,i) => (
                <div className="lp-testim" key={i}>
                  <div className="lp-testim-photo">
                    <img src={t.img} alt={t.n} loading="lazy"/>
                    <div className="lp-testim-stars">{Array.from({length:5}).map((_,j) => <StarSvg key={j}/>)}</div>
                  </div>
                  <div className="lp-testim-body">
                    <p className="lp-testim-quote">"{t.q}"</p>
                    <div className="lp-testim-name">— {t.n}</div>
                    <div className="lp-testim-role">{t.r}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────────────────────────── */}
        <section className="lp-section" id="pricing" style={{background:'#FAFAF7'}}>
          <div className="lp-container">
            <div className="lp-section-head" style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center'}}>
              <div className="lp-eyebrow">Precios</div>
              <h2 className="lp-section-title">Simple. <HighlightedText>Sin letra chica.</HighlightedText></h2>
              <p className="lp-section-sub" style={{textAlign:'center',marginBottom:24}}>Empezá gratis. Pagás solo cuando necesitás cotizar más.</p>
              <div style={{background:'#FEF3C7',color:'#92400E',borderRadius:8,padding:'8px 16px',fontSize:13,fontWeight:600,border:'1px solid #FDE68A',marginBottom:24}}>
                🎉 50% OFF por lanzamiento — precio especial por tiempo limitado
              </div>
              <div className="lp-pricing-toggle">
                <button className={!annual ? 'active' : ''} onClick={() => setAnnual(false)}>Mensual</button>
                <button className={annual ? 'active' : ''} onClick={() => setAnnual(true)}>
                  Anual <span className="lp-pricing-save">−20%</span>
                </button>
              </div>
            </div>
            <div className="lp-pricing-grid">
              {PLANS.map((p,i) => (
                <div className={`lp-plan${p.featured?' featured':''}`} key={i}>
                  {p.featured && <div className="lp-plan-badge">Más elegido</div>}
                  <h3 className="lp-plan-name">{p.name}</h3>
                  <p className="lp-plan-desc">{p.desc}</p>
                  <div className="lp-plan-price">
                    <span className="amt">{p.price}</span>
                    {p.origPrice && <span className="orig">{p.origPrice}</span>}
                  </div>
                  <div className="lp-plan-note">{p.note}</div>
                  {p.origPrice && <span className="lp-plan-off">50% OFF lanzamiento</span>}
                  {p.intentPrimary && (
                    <div className="lp-plan-no-card">
                      <Check style={{width:13,height:13}}/> Sin tarjeta de crédito requerida
                    </div>
                  )}
                  <ul>
                    {p.features.map((f,j) => <li key={j}><Check/>{f}</li>)}
                  </ul>
                  <button
                    onClick={() => onLogin(p.intentPrimary)}
                    className={`lp-btn lp-btn-lg ${p.featured?'lp-btn-primary':'lp-btn-outline'}`}
                    style={{width:'100%'}}
                  >
                    {p.cta}
                  </button>
                  {p.intentSecondary && (
                    <button onClick={() => onLogin(p.intentSecondary)} className="lp-plan-secondary">
                      Contratar sin prueba
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ─────────────────────────────────────────────────────────── */}
        <section className="lp-section" id="faq">
          <div className="lp-container">
            <div className="lp-section-head" style={{textAlign:'center',maxWidth:600,margin:'0 auto 48px'}}>
              <div className="lp-eyebrow">Preguntas frecuentes</div>
              <h2 className="lp-section-title"><HighlightedText>Lo que suelen</HighlightedText> preguntarnos.</h2>
            </div>
            <div className="lp-faq-wrap">
              {FAQS.map((it,i) => (
                <div className={`lp-faq-item${faqOpen===i?' open':''}`} key={i}>
                  <button className="lp-faq-q" onClick={() => setFaqOpen(faqOpen===i?-1:i)}>
                    {it.q}
                    <span className="lp-faq-icon"><Plus/></span>
                  </button>
                  <div className="lp-faq-a"><div>{it.a}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────────── */}
        <section className="lp-section" id="contact">
          <div className="lp-container">
            <div className="lp-cta-box">
              <div className="lp-cta-grid">

                {/* Left */}
                <div>
                  <h2>Empezá a cotizar<br/><HighlightedText delay={0.1}>10× más rápido</HighlightedText> hoy.</h2>
                  <p className="lp-cta-sub">14 días de prueba gratis. Sin tarjeta de crédito.<br/>Cancelás cuando quieras, sin preguntas.</p>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    <button onClick={() => onLogin()} className="lp-btn lp-btn-primary lp-btn-lg">
                      Crear cuenta gratis <Arrow/>
                    </button>
                    <button onClick={() => scrollTo('pricing')} className="lp-btn lp-btn-outline lp-btn-lg">
                      Ver planes
                    </button>
                  </div>
                  <div className="lp-cta-pills">
                    {['Sin tarjeta requerida','Cancelás cuando quieras','Soporte incluido'].map(t => (
                      <span key={t} className="lp-cta-pill">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Right */}
                <div className="lp-contact-card">
                  <div className="lp-contact-card-title">Contacto directo</div>

                  <div className="lp-contact-item">
                    <div className="lp-contact-icon wa"><Wa style={{width:20,height:20}}/></div>
                    <div>
                      <div className="lp-contact-label">WhatsApp</div>
                      <div className="lp-contact-value">Escribinos ahora</div>
                    </div>
                    <div className="lp-contact-action">
                      <a href="https://wa.me/5491123456789" target="_blank" rel="noopener noreferrer" className="lp-contact-btn wa">
                        <Wa style={{width:15,height:15}}/> Abrir
                      </a>
                    </div>
                  </div>

                  <div className="lp-contact-item">
                    <div className="lp-contact-icon mail">
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M2 6l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    </div>
                    <div>
                      <div className="lp-contact-label">Email</div>
                      <div className="lp-contact-value">hola@cotizagro.com.ar</div>
                    </div>
                    <div className="lp-contact-action">
                      <a href="mailto:hola@cotizagro.com.ar" className="lp-contact-btn mail">Escribir</a>
                    </div>
                  </div>

                  <div className="lp-respond-badge">
                    <span className="lp-respond-dot"/>
                    Respondemos en menos de 24 h
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="lp-footer">
          <div className="lp-container">
            <div className="lp-footer-grid">
              <div className="lp-footer-col">
                <div className="lp-logo" style={{marginBottom:16}}>
                  <img src={logoUrl} alt="Cotizagro"/>
                  Cotizagro
                </div>
                <p style={{margin:0,maxWidth:280,fontSize:14}}>La herramienta de cotizaciones hecha para el campo argentino.</p>
              </div>
              <div className="lp-footer-col">
                <h4>Producto</h4>
                <button onClick={() => scrollTo('how')}>Cómo funciona</button>
                <button onClick={() => scrollTo('pricing')}>Precios</button>
                <button onClick={() => scrollTo('faq')}>Preguntas</button>
              </div>
              <div className="lp-footer-col">
                <h4>Cuenta</h4>
                <button onClick={() => onLogin()}>Iniciar sesión</button>
                <button onClick={() => onLogin()}>Crear cuenta</button>
              </div>
              <div className="lp-footer-col">
                <h4>Contacto</h4>
                <a href="mailto:hola@cotizagro.com.ar">hola@cotizagro.com.ar</a>
                <a href="https://cotizagro.com.ar">cotizagro.com.ar</a>
              </div>
            </div>
            <div className="lp-footer-bottom">
              <span>© {new Date().getFullYear()} Cotizagro. Todos los derechos reservados.</span>
              <span style={{fontFamily:'ui-monospace,monospace',fontSize:12}}>Maquinaria Agrícola Argentina</span>
            </div>
          </div>
        </footer>

        {/* ── WhatsApp float ──────────────────────────────────────────────── */}
        <a href="https://wa.me/5491123456789" target="_blank" rel="noopener noreferrer" className="lp-wa-float" aria-label="WhatsApp">
          <Wa/>
        </a>

      </div>
    </>
  )
}
