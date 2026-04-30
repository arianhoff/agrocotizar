import { useNavigate } from 'react-router-dom'
import { X, Zap, Lock, AlertTriangle } from 'lucide-react'
import { PLAN_LIMITS } from '@/store/subscriptionStore'

interface Props {
  reason: 'quotes' | 'ai' | 'priceList' | 'expired'
  onClose: () => void
}

const MESSAGES = {
  quotes: {
    icon: AlertTriangle,
    color: '#F59E0B',
    bg: '#FFFBEB',
    border: '#F59E0B',
    title: 'Límite de cotizaciones alcanzado',
    body: `El plan Gratis incluye hasta ${PLAN_LIMITS.free.quotes_per_month} cotizaciones por mes. Actualizá tu plan para cotizar sin límites.`,
  },
  ai: {
    icon: Zap,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#7C3AED',
    title: 'Límite de consultas IA alcanzado',
    body: `El plan Gratis incluye hasta ${PLAN_LIMITS.free.ai_queries_per_month} consultas IA por mes. Actualizá tu plan para usar la IA sin límites.`,
  },
  priceList: {
    icon: Lock,
    color: '#0EA5E9',
    bg: '#F0F9FF',
    border: '#0EA5E9',
    title: 'Límite de listas de precios alcanzado',
    body: `El plan Gratis incluye ${PLAN_LIMITS.free.price_lists} lista de precios. Actualizá tu plan para crear listas ilimitadas.`,
  },
  expired: {
    icon: AlertTriangle,
    color: '#EF4444',
    bg: '#FFF8F8',
    border: '#EF4444',
    title: 'Tu plan venció',
    body: 'Tu período de acceso terminó. Renovalo para seguir usando todas las funciones de Cotizagro.',
  },
}

export function UpgradePrompt({ reason, onClose }: Props) {
  const navigate = useNavigate()
  const msg = MESSAGES[reason]
  const Icon = msg.icon

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ border: `1px solid ${msg.border}30` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: msg.bg }}
            >
              <Icon size={16} style={{ color: msg.color }} />
            </div>
            <div className="text-[14px] font-semibold text-[#0F172A] leading-tight">{msg.title}</div>
          </div>
          <button onClick={onClose} className="text-[#CBD5E1] hover:text-[#64748B] cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-4">
          <p className="text-[13px] text-[#475569] leading-relaxed">{msg.body}</p>

          <div
            className="rounded-xl p-3 text-[12px]"
            style={{ background: msg.bg }}
          >
            <div className="font-semibold mb-1.5" style={{ color: msg.color }}>Plan Vendedores incluye:</div>
            <ul className="space-y-0.5 text-[#475569]">
              <li>✓ Cotizaciones ilimitadas</li>
              <li>✓ IA ilimitada + importación PDF</li>
              <li>✓ Listas de precios ilimitadas</li>
              <li>✓ PDF profesional con tu logo</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => { navigate('/settings?section=subscription'); onClose() }}
              className="w-full py-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap size={13} /> Contratar plan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
