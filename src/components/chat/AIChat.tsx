import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Mic, MicOff, Loader2, Wheat } from 'lucide-react'
import { cn } from '@/utils'
import { extractQuoteFromText, CATEGORY_ICONS } from '@/lib/ai/extraction'
import { useQuoteStore } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'
import type { ChatMessage, AIQuoteExtraction } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 9)

// ─── Component ────────────────────────────────────────────────────────────────

export function AIChat() {
  const applyAIExtraction = useQuoteStore(s => s.applyAIExtraction)
  const addItem = useQuoteStore(s => s.addItem)
  const getAllProducts = useCatalogStore(s => s.getAllProducts)

  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: 'welcome',
    role: 'assistant',
    content: '¡Hola! Soy tu asistente de cotización. Contame qué equipos necesitás cotizar y los cargo automáticamente.\n\nPodés hablar o escribir, por ejemplo: _"Mixer 110F con balanza electrónica, pago contado"_',
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Scroll only within the messages container
  const scrollToBottom = () => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }
  useEffect(() => { scrollToBottom() }, [messages])

  const addMsg = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { id: uid(), role, content, timestamp: new Date() }])
  }

  // ─── Dynamic chips from catalog ────────────────────────────────────────────

  const products = getAllProducts()

  const chips = products.length > 0
    ? products.slice(0, 5).map(p => {
        const icon = CATEGORY_ICONS[p.category] ?? '📦'
        const shortName = p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name
        return {
          label: `${icon} ${shortName}`,
          prompt: `Cotizá ${p.name} (${p.currency} ${p.base_price.toLocaleString('es-AR')}) pago contado`,
        }
      })
    : [
        { label: '📦 Equipo + contado', prompt: 'Quiero cotizar un equipo agrícola con pago contado' },
        { label: '🏦 Financiado 12 cuotas', prompt: 'Cotizá un equipo con financiamiento a 12 cuotas' },
        { label: '🧾 3 cheques diferidos', prompt: 'Quiero cotizar con 3 cheques diferidos' },
      ]

  // ─── Process text through AI ─────────────────────────────────────────────

  const processText = useCallback(async (text: string) => {
    if (!text.trim()) return

    addMsg('user', text)
    setLoading(true)

    try {
      const extraction: AIQuoteExtraction = await extractQuoteFromText(text, getAllProducts())

      const storePayload: Parameters<typeof applyAIExtraction>[0] = {}

      if (extraction.client) storePayload.client = extraction.client as typeof storePayload.client
      if (extraction.currency) storePayload.currency = extraction.currency
      if (extraction.exchange_rate) storePayload.exchange_rate = extraction.exchange_rate
      if (extraction.payment) storePayload.payment = extraction.payment as typeof storePayload.payment
      if (extraction.taxes) storePayload.taxes = extraction.taxes as typeof storePayload.taxes
      if (extraction.delivery) storePayload.delivery = extraction.delivery as typeof storePayload.delivery
      if (extraction.notes) storePayload.notes = extraction.notes

      if (extraction.items?.length) {
        storePayload.items = extraction.items.map(i => ({
          id: uid(),
          description: i.description ?? '',
          category: i.category ?? 'Implemento varios',
          quantity: i.quantity ?? 1,
          unit_price: i.unit_price ?? 0,
          discount_pct: i.discount_pct ?? 0,
          subtotal: (i.unit_price ?? 0) * (i.quantity ?? 1) * (1 - (i.discount_pct ?? 0) / 100),
        })) as typeof storePayload.items
      }

      if (extraction.discounts?.length) {
        storePayload.discounts = extraction.discounts.map(d => ({
          id: uid(),
          type: d.type ?? 'discount',
          concept: d.concept ?? '',
          percentage: d.percentage ?? 0,
        })) as typeof storePayload.discounts
      }

      applyAIExtraction(storePayload)

      const applied: string[] = []
      if (extraction.client?.name) applied.push(extraction.client.name)
      if (extraction.items?.length) applied.push(`${extraction.items.length} equipo(s)`)
      if (extraction.payment?.mode) applied.push(`Pago: ${extraction.payment.mode}`)
      if (extraction.payment?.discount_pct) applied.push(`${extraction.payment.discount_pct}% dto`)

      addMsg('assistant',
        `✅ **¡Cotización cargada!**\n\nApliqué: ${applied.join(' · ')}\n\nRevisá los datos en el formulario. ¿Querés agregar algo más?`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      addMsg('assistant', `⚠️ Error: ${msg}. Volvé a intentar.`)
    } finally {
      setLoading(false)
    }
  }, [applyAIExtraction, addItem, getAllProducts])

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    processText(text)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ─── Voice recording ──────────────────────────────────────────────────────

  const startRecording = () => {
    const SR = window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition
    if (!SR) { addMsg('assistant', '⚠️ Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.'); return }

    const recognition = new SR()
    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = true

    let finalTranscript = ''

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' '
        else interim += e.results[i][0].transcript
      }
      setInput((finalTranscript + interim).trim())
    }

    recognition.onerror = () => stopRecording(finalTranscript)
    recognition.onend = () => {
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
      if (finalTranscript.trim()) processText(finalTranscript.trim())
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }

  const stopRecording = (transcript?: string) => {
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
    if (transcript?.trim()) setInput(transcript.trim())
  }

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording()
  }

  const recMin = Math.floor(recordingTime / 60)
  const recSec = String(recordingTime % 60).padStart(2, '0')

  const C = {
    accent:      '#7C3AED',
    accentLight: '#EDE9FE',
    accentBorder:'#C4B5FD',
    headerBg:    '#F5F3FF',
    userBubble:  '#EDE9FE',
    sendBtn:     '#7C3AED',
    sendHover:   '#6D28D9',
    dotPulse:    '#7C3AED',
    focus:       '#7C3AED',
    chip:        '#7C3AED',
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm mb-6 border border-[#C4B5FD]/50">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-[#C4B5FD]/40" style={{ background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)' }}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.accent }}>
          <Wheat size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#1E1B4B]">Asistente IA</div>
          <div className="text-[11px] text-[#6D28D9]/70 truncate">
            {products.length > 0
              ? `${products.length} producto${products.length !== 1 ? 's' : ''} en catálogo`
              : 'Cotización por voz o texto'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: C.accent }} />
          <span className="text-[11px] font-medium" style={{ color: C.accent }}>Listo</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="px-4 sm:px-6 py-5 max-h-64 overflow-y-auto flex flex-col gap-3.5 bg-white">
        {messages.map(msg => (
          <div key={msg.id} className={cn('flex gap-2.5 items-start', msg.role === 'user' && 'flex-row-reverse')}>
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 mt-0.5',
              msg.role === 'assistant' ? 'border' : 'bg-[#F1F5F9] border border-[#E2E8F0]'
            )} style={msg.role === 'assistant' ? { background: C.accentLight, borderColor: C.accentBorder } : {}}>
              {msg.role === 'assistant' ? '🤖' : '👤'}
            </div>
            <div
              className={cn(
                'max-w-[80%] px-3.5 py-2.5 text-[13px] leading-relaxed border',
                msg.role === 'assistant'
                  ? 'text-[#1E1B4B] rounded-tr-xl rounded-b-xl'
                  : 'text-[#0F172A] text-right rounded-tl-xl rounded-b-xl'
              )}
              style={msg.role === 'assistant'
                ? { background: '#FAF8FF', borderColor: C.accentBorder + '60' }
                : { background: C.accentLight, borderColor: C.accentBorder + '80' }
              }
              dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.*?)\*\*/g, `<strong style="color:${C.accent}">$1</strong>`)
                  .replace(/_(.*?)_/g, '<em>$1</em>')
                  .replace(/\n/g, '<br/>')
              }}
            />
          </div>
        ))}

        {loading && (
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center border text-sm"
              style={{ background: C.accentLight, borderColor: C.accentBorder }}>🤖</div>
            <div className="rounded-tr-xl rounded-b-xl px-3.5 py-3 border"
              style={{ background: '#FAF8FF', borderColor: C.accentBorder + '60' }}>
              <div className="flex gap-1 items-center">
                {[0, 0.2, 0.4].map((d, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full opacity-60 animate-bounce"
                    style={{ backgroundColor: C.accent, animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chips — dynamic from catalog */}
      <div className="flex gap-2 flex-wrap px-4 sm:px-6 pb-3 bg-white">
        {chips.map(chip => (
          <button
            key={chip.label}
            onClick={() => processText(chip.prompt)}
            disabled={loading}
            className="text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 cursor-pointer whitespace-nowrap"
            style={{ borderColor: C.accentBorder + '80', color: C.accent }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = C.accentLight
              e.currentTarget.style.borderColor = C.accentBorder
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = ''
              e.currentTarget.style.borderColor = C.accentBorder + '80'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Recording status */}
      {isRecording && (
        <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-2 px-3.5 py-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
          <div className="flex gap-0.5 items-center h-4">
            {[4, 8, 6, 10, 5, 9, 3].map((h, i) => (
              <span key={i} className="w-0.5 bg-[#EF4444] rounded-sm animate-pulse" style={{ height: h + 'px', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <span className="text-[11px] font-medium text-[#EF4444]">GRABANDO {recMin}:{recSec}</span>
          <span className="ml-auto text-[11px] text-[#EF4444]/70 hidden sm:inline">Hablá tu pedido</span>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 items-end px-4 sm:px-6 py-3 border-t" style={{ background: '#FAF8FF', borderColor: C.accentBorder + '40' }}>
        <button
          onClick={toggleRecording}
          title={isRecording ? 'Detener grabación' : 'Grabar con micrófono'}
          className={cn(
            'w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer',
            isRecording ? 'bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]' : 'bg-white text-[#64748B]'
          )}
          style={!isRecording ? { borderColor: C.accentBorder + '80' } : {}}
        >
          {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Describí la cotización…"
          rows={1}
          className="flex-1 min-w-0 bg-white rounded-lg text-[#0F172A] text-sm px-3 py-2.5 outline-none resize-none placeholder:text-[#94A3B8] min-h-[40px] max-h-[120px] border transition-colors"
          style={{ borderColor: C.accentBorder + '80' }}
          onFocus={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentLight}` }}
          onBlur={e => { e.currentTarget.style.borderColor = C.accentBorder + '80'; e.currentTarget.style.boxShadow = '' }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 120) + 'px'
          }}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="w-10 h-10 rounded-lg text-white flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          style={{ backgroundColor: C.accent }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = C.sendHover }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = C.accent }}
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  )
}
