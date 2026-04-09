import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Mic, MicOff, Volume2, Loader2, ArrowRight, RotateCcw, AlertCircle, Pencil, Check, X } from 'lucide-react'
import { useQuoteStore } from '@/store/quoteStore'
import { useCatalogStore } from '@/store/catalogStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'assistant' | 'user'
  text: string
}

interface QuoteState {
  items: { descripcion: string; precio_usd: number; cantidad: number; descuento_pct: number }[]
  cliente_nombre: string
  cliente_cuit: string
  condicion_pago: 'contado' | 'cheques' | 'financiado' | 'leasing'
  descuento_pct: number
  notas: string
}

interface ClaudeResponse {
  speak: string
  update?: Partial<QuoteState> & {
    item?: { descripcion: string; precio_usd: number; cantidad: number; descuento_pct: number }
  }
  done?: boolean
}

// ─── Speech helpers ───────────────────────────────────────────────────────────

const SR = (window as unknown as Record<string, unknown>).SpeechRecognition as
  (new () => { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void;
    onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean }; length: number } }) => void) | null
    onerror: ((e: { error: string }) => void) | null
    onend: (() => void) | null }) | undefined
  ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition as
  (new () => { lang: string; continuous: boolean; interimResults: boolean; start(): void; stop(): void; abort(): void;
    onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string }; isFinal: boolean }; length: number } }) => void) | null
    onerror: ((e: { error: string }) => void) | null
    onend: (() => void) | null }) | undefined

function speak(text: string, onEnd?: () => void) {
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.lang = 'es-AR'
  utt.rate = 1.1
  utt.pitch = 1
  const voices = window.speechSynthesis.getVoices()
  const es = voices.find(v => v.lang.startsWith('es')) ?? null
  if (es) utt.voice = es
  if (onEnd) utt.onend = onEnd
  window.speechSynthesis.speak(utt)
}

// ─── AFIP helpers ─────────────────────────────────────────────────────────────

async function lookupCuit(cuit: string): Promise<{ nombre: string } | null> {
  try {
    const { authFetch } = await import('@/lib/api')
    const res = await authFetch(`/api/afip/sr-padron/v2/persona/${cuit}`)
    const data = await res.json()
    if (data.error) return null
    const nombre = data.nombre ?? data.razonSocial ?? data.apellido ?? null
    return nombre ? { nombre } : null
  } catch {
    return null
  }
}

function extractCuit(text: string): string | null {
  // Try exact 11-digit token
  const tokens = text.replace(/[^\d\s]/g, ' ').split(/\s+/)
  for (const tok of tokens) {
    if (/^\d{11}$/.test(tok)) return tok
  }
  // Try dash-formatted: 20-12345678-9
  const m = text.match(/(\d{2})[-\s](\d{8})[-\s](\d)/)
  if (m) return m[1] + m[2] + m[3]
  return null
}

// ─── Claude conversation ──────────────────────────────────────────────────────

async function askClaude(
  history: Message[],
  quoteState: QuoteState,
  catalog: string,
): Promise<ClaudeResponse> {
  const system = `Sos un asistente de ventas de maquinaria agrícola argentina, con acento y modismos rioplatenses bien marcados.
Charlás con el vendedor como si estuvieras en el mostrador de un concesionario del interior.

TONO — OBLIGATORIO:
- Usá "vos" siempre: "¿cómo pagás?", "¿me pasás el CUIT?", "¿qué más le ponemos?"
- Expresiones típicas argentinas: "dale", "joya", "bárbaro", "buenísimo", "perfecto", "listo", "anotado", "claro"
- Nunca uses "tú", "usted" ni frases españolas ("por supuesto", "procederé", "le informo que")
- Informal pero prolijo, como un vendedor que conoce el campo

ESTILO DE RESPUESTA — MUY IMPORTANTE:
- Respondé CORTITO: 5 a 8 palabras máximo.
- Confirmá y preguntá en la misma oración cuando puedas: "Joya, ¿contado o en cuotas?"
- Ejemplos perfectos:
  "Dale. ¿El CUIT del cliente?"
  "Bárbaro, ¿cómo lo pagamos?"
  "Joya. ¿Algo más le sumamos?"
  "Cambiado, ¿cerramos así?"
  "¿Cuántas cuotas serían?"
- Si te corrigen algo ("no, era contado", "cambiá el precio", "el nombre está mal"), actualizalo sin drama: "Listo, corregido."

CORRECCIONES — IMPORTANTE:
- El usuario puede corregir cualquier dato hablando o escribiendo en el chat.
- Si dice "el nombre está mal, es [nombre correcto]", actualizá cliente_nombre.
- Si dice "las cuotas son 12 no 6", actualizá el dato correspondiente.
- Si dice "el precio era 50000 no 45000", actualizá precio_usd del ítem.
- Aceptá correcciones de buena gana: "Listo, lo corrijo."

ESPAÑOL RIOPLATENSE — DELETREO:
"ve"/"ve corta"=V | "be"/"be larga"=B | "ge"=G | "eme"=M | "ene"=N
"erre"=R | "ese"=S | "te"=T | "pe"=P | "ce"=C | "de"=D
"doble ve"=W | "equis"=X | "ye"/"i griega"=Y | "zeta"=Z
Ejemplos: "eme ge ve"→MGV | "jota de be"→JDB

IDENTIFICACIÓN DEL CLIENTE:
- Pedí siempre el CUIT (11 dígitos) — el sistema lo consulta en AFIP automáticamente.
- Cuando el mensaje incluye "[AFIP: CUIT X → Y]", confirmá el nombre: "Joya, [nombre], ¿cómo pagamos?"
- Si no hay datos AFIP, pedí el nombre directamente.

CATÁLOGO:
${catalog || 'Sin productos cargados.'}

COTIZACIÓN EN PROGRESO:
${JSON.stringify(quoteState, null, 2)}

CIERRE: Cuando tenés al menos 1 producto + CUIT/nombre + condición de pago → done: true, speak: "¿Cerramos así la cotización?"

Respondé SOLO JSON válido:
{"speak":"...","update":{...},"done":false}
"update" solo con los campos de este turno. "item" para agregar un producto.`

  const messages = history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, system, messages }),
  })
  if (!res.ok) throw new Error('Error de conexión con IA')
  const data = await res.json()
  const text = (data.content?.[0]?.text ?? '').trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Respuesta inesperada de IA')
  return JSON.parse(match[0]) as ClaudeResponse
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_QUOTE: QuoteState = {
  items: [], cliente_nombre: '', cliente_cuit: '',
  condicion_pago: 'contado', descuento_pct: 0, notas: '',
}

type EditTarget =
  | { field: 'cliente_nombre' | 'cliente_cuit' | 'notas' }
  | { field: 'condicion_pago' }
  | { field: 'descuento_pct' }
  | { field: 'item_descripcion' | 'item_precio' | 'item_cantidad' | 'item_descuento'; idx: number }

export function VoiceQuoterPage() {
  const navigate   = useNavigate()
  const quoteStore = useQuoteStore()
  const { products, priceLists } = useCatalogStore()

  const [messages,  setMessages]  = useState<Message[]>([])
  const [quoteData, setQuoteData] = useState<QuoteState>({ ...EMPTY_QUOTE })
  const [phase, setPhase]         = useState<'idle' | 'speaking' | 'listening' | 'thinking' | 'done'>('idle')
  const [interim,   setInterim]   = useState('')
  const [error,     setError]     = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editValue,  setEditValue]  = useState('')
  const [textDraft,  setTextDraft]  = useState('')
  const textInputRef = useRef<HTMLInputElement>(null)

  const srRef          = useRef<InstanceType<NonNullable<typeof SR>> | null>(null)
  const interruptSrRef = useRef<InstanceType<NonNullable<typeof SR>> | null>(null)
  const quoteRef       = useRef(quoteData)
  const messagesRef    = useRef(messages)
  const processInputRef = useRef<(text: string) => Promise<void>>(async () => {})
  quoteRef.current    = quoteData
  messagesRef.current = messages

  const supported = !!SR

  const catalogText = (() => {
    if (!products.length) return ''
    return products.slice(0, 80).map(p => {
      const list = priceLists.find(pl => pl.id === p.price_list_id)
      return `${p.name}${list ? ` | ${list.brand} ${list.name}` : ''} | USD ${p.base_price}`
    }).join('\n')
  })()

  useEffect(() => () => {
    srRef.current?.abort()
    interruptSrRef.current?.abort()
    window.speechSynthesis.cancel()
  }, [])

  const addMessage = useCallback((role: 'assistant' | 'user', text: string) => {
    setMessages(prev => [...prev, { role, text }])
  }, [])

  const applyUpdate = useCallback((update: ClaudeResponse['update']) => {
    if (!update) return
    setQuoteData(prev => {
      const next = { ...prev }
      if (update.cliente_nombre) next.cliente_nombre = update.cliente_nombre
      if (update.cliente_cuit)   next.cliente_cuit   = update.cliente_cuit
      if (update.condicion_pago) next.condicion_pago = update.condicion_pago
      if (typeof update.descuento_pct === 'number') next.descuento_pct = update.descuento_pct
      if (update.notas)          next.notas          = update.notas
      if (update.item)           next.items          = [...prev.items, update.item!]
      return next
    })
  }, [])

  // ── Forward declaration for speakAndListen (used by processInput) ─────────────
  const speakAndListenRef = useRef<(text: string) => void>(() => {})

  // ── Core: process what the user said ─────────────────────────────────────────
  const processInput = useCallback(async (text: string) => {
    addMessage('user', text)
    setPhase('thinking')
    setInterim('')

    // CUIT enrichment
    let contextText = text
    const cuit = extractCuit(text)
    if (cuit) {
      const info = await lookupCuit(cuit)
      if (info) {
        contextText = `${text} [AFIP: CUIT ${cuit} → "${info.nombre}"]`
        setQuoteData(prev => ({ ...prev, cliente_cuit: cuit, cliente_nombre: info.nombre }))
      }
    }

    try {
      const history = [...messagesRef.current, { role: 'user' as const, text: contextText }]
      const reply   = await askClaude(history, quoteRef.current, catalogText)
      applyUpdate(reply.update)
      if (reply.done) {
        setPhase('done')
        addMessage('assistant', reply.speak)
        speak(reply.speak)
      } else {
        speakAndListenRef.current(reply.speak)
      }
    } catch (err) {
      setError((err as Error).message)
      setPhase('idle')
    }
  }, [addMessage, applyUpdate, catalogText])

  processInputRef.current = processInput

  // ── Start listening for user speech ──────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!SR) return
    setError(null)
    setInterim('')
    setPhase('listening')
    interruptSrRef.current?.abort()

    const recognition = new SR()
    recognition.lang = 'es-AR'
    recognition.continuous = false
    recognition.interimResults = true

    let finalText = ''
    recognition.onresult = (e) => {
      let fin = '', inter = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript
        else inter = e.results[i][0].transcript
      }
      finalText = fin
      setInterim(inter || fin)
    }
    recognition.onerror = (e) => {
      if (e.error !== 'aborted' && e.error !== 'no-speech') {
        setError('Error de micrófono.')
        setPhase('idle')
      }
    }
    recognition.onend = () => {
      setInterim('')
      const text = finalText.trim()
      if (!text) { setPhase('idle'); return }
      processInputRef.current(text)
    }
    srRef.current = recognition
    recognition.start()
  }, [])

  // ── Speak + immediately arm interrupt listener ────────────────────────────────
  const speakAndListen = useCallback((text: string) => {
    setPhase('speaking')
    addMessage('assistant', text)

    // Arm an interrupt listener after a short delay (AEC needs ~500ms to kick in)
    const armTimer = setTimeout(() => {
      if (!SR || !window.speechSynthesis.speaking) return
      try {
        const recog = new SR()
        recog.lang = 'es-AR'
        recog.continuous = false
        recog.interimResults = false
        let captured = ''
        recog.onresult = (e) => {
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) captured += e.results[i][0].transcript
          }
        }
        recog.onend = () => {
          if (captured.trim() && window.speechSynthesis.speaking) {
            // User interrupted — cancel AI and process
            window.speechSynthesis.cancel()
            processInputRef.current(captured.trim())
          }
        }
        recog.onerror = () => {}
        recog.start()
        interruptSrRef.current = recog
      } catch {}
    }, 500)

    speak(text, () => {
      clearTimeout(armTimer)
      interruptSrRef.current?.abort()
      setTimeout(() => startListening(), 150)
    })
  }, [addMessage, startListening])

  speakAndListenRef.current = speakAndListen

  // ── Manual interrupt (tap button while AI speaks) ─────────────────────────────
  const handleInterrupt = useCallback(() => {
    window.speechSynthesis.cancel()
    interruptSrRef.current?.abort()
    setTimeout(() => startListening(), 150)
  }, [startListening])

  function handleTextSubmit() {
    const text = textDraft.trim()
    if (!text || phase === 'thinking') return
    setTextDraft('')
    // Cancel any ongoing speech/recognition and process as if spoken
    window.speechSynthesis.cancel()
    srRef.current?.abort()
    interruptSrRef.current?.abort()
    processInputRef.current(text)
  }

  function handleStart() {
    setMessages([])
    setQuoteData({ ...EMPTY_QUOTE })
    setError(null)
    setEditTarget(null)
    startListening()
  }

  function handleReset() {
    srRef.current?.abort()
    interruptSrRef.current?.abort()
    window.speechSynthesis.cancel()
    setMessages([])
    setQuoteData({ ...EMPTY_QUOTE })
    setPhase('idle')
    setError(null)
    setInterim('')
    setEditTarget(null)
    setTextDraft('')
  }

  function handleConfirm() {
    const q = quoteRef.current
    quoteStore.initFromPriceList('', undefined)
    const s = useQuoteStore.getState()
    s.setClient({ name: q.cliente_nombre, ...(q.cliente_cuit ? { cuit: q.cliente_cuit } : {}) })
    s.setPayment({ mode: q.condicion_pago, discount_pct: q.descuento_pct })
    for (const item of q.items) {
      s.addItem({ id: Math.random().toString(36).slice(2, 9), product_id: '', description: item.descripcion, quantity: item.cantidad || 1, unit_price: item.precio_usd || 0, discount_pct: item.descuento_pct || 0 })
    }
    if (q.notas) s.setNotes(q.notas)
    navigate('/quoter')
  }

  // ── Inline edit helpers ───────────────────────────────────────────────────────
  function startEdit(target: EditTarget, value: string) {
    setEditTarget(target)
    setEditValue(value)
  }

  function saveEdit() {
    if (!editTarget) return
    setQuoteData(prev => {
      const next = { ...prev }
      if (editTarget.field === 'cliente_nombre') next.cliente_nombre = editValue
      else if (editTarget.field === 'cliente_cuit') next.cliente_cuit = editValue
      else if (editTarget.field === 'notas') next.notas = editValue
      else if (editTarget.field === 'condicion_pago') next.condicion_pago = editValue as QuoteState['condicion_pago']
      else if (editTarget.field === 'descuento_pct') next.descuento_pct = Number(editValue) || 0
      else if ('idx' in editTarget) {
        const items = [...prev.items]
        const item = { ...items[editTarget.idx] }
        if (editTarget.field === 'item_descripcion') item.descripcion = editValue
        else if (editTarget.field === 'item_precio')    item.precio_usd = Number(editValue) || 0
        else if (editTarget.field === 'item_cantidad')  item.cantidad   = Number(editValue) || 1
        else if (editTarget.field === 'item_descuento') item.descuento_pct = Number(editValue) || 0
        items[editTarget.idx] = item
        next.items = items
      }
      return next
    })
    setEditTarget(null)
  }

  function cancelEdit() { setEditTarget(null) }

  function removeItem(idx: number) {
    setQuoteData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  const isActive = phase !== 'idle' && phase !== 'done'
  const totalUSD = quoteData.items.reduce((s, i) => s + i.precio_usd * i.cantidad, 0)
  const hasPanel = quoteData.items.length > 0 || quoteData.cliente_nombre || quoteData.cliente_cuit

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <PageHeader title="Cotizar por voz" subtitle="Conversación en tiempo real con el asistente" />

      {!supported ? (
        <div className="p-6 max-w-lg">
          <div className="flex items-start gap-3 p-4 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl">
            <AlertCircle size={18} className="text-[#F97316] shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-[#92400E]">Requiere Chrome o Edge</div>
              <div className="text-[12px] text-[#92400E]/80 mt-0.5">El reconocimiento de voz no está disponible en este navegador.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Chat ── */}
          <div className="flex-1 flex flex-col min-w-0">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
              {messages.length === 0 && phase === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
                  <div className="w-20 h-20 rounded-full bg-[#F0FDF4] border-2 border-[#22C55E]/30 flex items-center justify-center">
                    <Mic size={32} className="text-[#22C55E]" />
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold text-[#0F172A]">Cotización por voz</div>
                    <div className="text-[13px] text-[#64748B] mt-1 max-w-xs">
                      Hablá como si charlaras con un vendedor. Podés interrumpir cuando quieras.
                    </div>
                  </div>
                  <button
                    onClick={handleStart}
                    className="flex items-center gap-2 px-6 py-3 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold rounded-xl cursor-pointer transition-colors shadow-lg shadow-[#22C55E]/20"
                  >
                    <Mic size={16} /> Empezar
                  </button>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-[14px] leading-snug ${
                    m.role === 'user'
                      ? 'bg-[#22C55E] text-white rounded-br-sm'
                      : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-bl-sm shadow-sm'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}

              {/* Live transcript */}
              {phase === 'listening' && interim && (
                <div className="flex justify-end">
                  <div className="max-w-[78%] px-3.5 py-2 rounded-2xl rounded-br-sm bg-[#22C55E]/10 border border-[#22C55E]/20 text-[13px] text-[#16A34A] italic">
                    {interim}
                  </div>
                </div>
              )}

              {phase === 'thinking' && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-[#E2E8F0] shadow-sm flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-[#FEF2F2] border border-[#EF4444]/20 rounded-lg text-[12px] text-[#EF4444]">
                <AlertCircle size={13} /> {error}
              </div>
            )}

            {/* Text input for corrections — always visible once conversation starts */}
            {messages.length > 0 && (
              <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-2 flex gap-2 items-center">
                <input
                  ref={textInputRef}
                  type="text"
                  value={textDraft}
                  onChange={e => setTextDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit() }}
                  placeholder="Escribí para corregir (nombre, monto, cuotas...)"
                  disabled={phase === 'thinking'}
                  className="flex-1 text-[13px] bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 outline-none focus:border-[#22C55E] placeholder:text-[#CBD5E1] disabled:opacity-50"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textDraft.trim() || phase === 'thinking'}
                  className="px-3 py-1.5 bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-40 text-white text-[12px] font-semibold rounded-lg cursor-pointer transition-colors disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </div>
            )}

            {/* Bottom bar */}
            <div className="border-t border-[#E2E8F0] bg-white px-4 py-3">
              {phase === 'done' ? (
                <div className="flex gap-2">
                  <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                    <RotateCcw size={13} /> Nueva
                  </button>
                  <button onClick={handleConfirm} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold rounded-xl cursor-pointer transition-colors">
                    Crear cotización <ArrowRight size={16} />
                  </button>
                </div>
              ) : phase === 'speaking' ? (
                /* While AI speaks: show interrupt button */
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-[13px] text-[#94A3B8]">
                    <Volume2 size={15} className="text-[#22C55E] animate-pulse" />
                    <span>Hablando...</span>
                  </div>
                  <button
                    onClick={handleInterrupt}
                    className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[13px] font-semibold rounded-xl cursor-pointer transition-colors shadow-md"
                  >
                    <Mic size={14} /> Interrumpir
                  </button>
                </div>
              ) : phase === 'listening' ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#22C55E]">
                    <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                    Escuchando...
                  </div>
                  <button onClick={handleReset} className="text-[12px] text-[#94A3B8] hover:text-[#EF4444] cursor-pointer flex items-center gap-1">
                    <MicOff size={13} /> Cancelar
                  </button>
                </div>
              ) : phase === 'thinking' ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[13px] text-[#94A3B8]">
                    <Loader2 size={14} className="animate-spin" /> Procesando...
                  </div>
                  <button onClick={handleReset} className="text-[12px] text-[#94A3B8] hover:text-[#EF4444] cursor-pointer flex items-center gap-1">
                    <MicOff size={13} /> Cancelar
                  </button>
                </div>
              ) : (
                /* Idle with context = restart button */
                messages.length > 0 ? (
                  <div className="flex gap-2">
                    <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                      <RotateCcw size={13} /> Reiniciar
                    </button>
                    <button onClick={startListening} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold rounded-xl cursor-pointer transition-colors">
                      <Mic size={16} /> Continuar
                    </button>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* ── Panel cotización editable ── */}
          {hasPanel && (
            <div className="hidden lg:flex w-72 border-l border-[#E2E8F0] bg-[#F8FAFC] flex-col">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Cotización</div>
                {isActive && (
                  <span className="flex items-center gap-1 text-[10px] text-[#22C55E]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" /> en vivo
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[13px]">

                {/* Cliente */}
                {(quoteData.cliente_nombre || quoteData.cliente_cuit) && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1.5">Cliente</div>
                    <div className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 space-y-1">
                      <EditableRow
                        label="Nombre"
                        value={quoteData.cliente_nombre || '—'}
                        isEditing={editTarget?.field === 'cliente_nombre'}
                        editValue={editValue}
                        onEdit={() => startEdit({ field: 'cliente_nombre' }, quoteData.cliente_nombre)}
                        onChange={setEditValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                      <EditableRow
                        label="CUIT"
                        value={quoteData.cliente_cuit || '—'}
                        isEditing={editTarget?.field === 'cliente_cuit'}
                        editValue={editValue}
                        onEdit={() => startEdit({ field: 'cliente_cuit' }, quoteData.cliente_cuit)}
                        onChange={setEditValue}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        mono
                      />
                    </div>
                  </div>
                )}

                {/* Items */}
                {quoteData.items.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1.5">Productos</div>
                    <div className="space-y-2">
                      {quoteData.items.map((item, idx) => (
                        <div key={idx} className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2 space-y-1">
                          <EditableRow
                            label="Equipo"
                            value={item.descripcion}
                            isEditing={editTarget?.field === 'item_descripcion' && 'idx' in editTarget! && editTarget.idx === idx}
                            editValue={editValue}
                            onEdit={() => startEdit({ field: 'item_descripcion', idx }, item.descripcion)}
                            onChange={setEditValue}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                          />
                          <EditableRow
                            label="Precio USD"
                            value={`USD ${item.precio_usd.toLocaleString('es-AR')}`}
                            isEditing={editTarget?.field === 'item_precio' && 'idx' in editTarget! && editTarget.idx === idx}
                            editValue={editValue}
                            onEdit={() => startEdit({ field: 'item_precio', idx }, String(item.precio_usd))}
                            onChange={setEditValue}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                            inputType="number"
                          />
                          <div className="flex items-center justify-between">
                            <div className="flex gap-3">
                              <EditableRow
                                label="Cant."
                                value={String(item.cantidad)}
                                isEditing={editTarget?.field === 'item_cantidad' && 'idx' in editTarget! && editTarget.idx === idx}
                                editValue={editValue}
                                onEdit={() => startEdit({ field: 'item_cantidad', idx }, String(item.cantidad))}
                                onChange={setEditValue}
                                onSave={saveEdit}
                                onCancel={cancelEdit}
                                inputType="number"
                                compact
                              />
                              {item.descuento_pct > 0 && (
                                <EditableRow
                                  label="Dto%"
                                  value={`${item.descuento_pct}%`}
                                  isEditing={editTarget?.field === 'item_descuento' && 'idx' in editTarget! && editTarget.idx === idx}
                                  editValue={editValue}
                                  onEdit={() => startEdit({ field: 'item_descuento', idx }, String(item.descuento_pct))}
                                  onChange={setEditValue}
                                  onSave={saveEdit}
                                  onCancel={cancelEdit}
                                  inputType="number"
                                  compact
                                />
                              )}
                            </div>
                            <button onClick={() => removeItem(idx)} className="text-[#CBD5E1] hover:text-[#EF4444] cursor-pointer transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pago */}
                {quoteData.condicion_pago && (
                  <div>
                    <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-1.5">Condición de pago</div>
                    <div className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-2">
                      {editTarget?.field === 'condicion_pago' ? (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="flex-1 text-[12px] border border-[#22C55E] rounded px-1.5 py-1 outline-none bg-white"
                          >
                            {['contado', 'cheques', 'financiado', 'leasing'].map(v => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                          <button onClick={saveEdit} className="text-[#22C55E] cursor-pointer"><Check size={13} /></button>
                          <button onClick={cancelEdit} className="text-[#94A3B8] cursor-pointer"><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#0F172A] capitalize">{quoteData.condicion_pago}
                            {quoteData.descuento_pct > 0 && <span className="text-[#16A34A] ml-1">· {quoteData.descuento_pct}%</span>}
                          </span>
                          <button onClick={() => startEdit({ field: 'condicion_pago' }, quoteData.condicion_pago)} className="text-[#CBD5E1] hover:text-[#64748B] cursor-pointer ml-2">
                            <Pencil size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {totalUSD > 0 && (
                <div className="border-t border-[#E2E8F0] px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#64748B]">Total estimado</span>
                    <span className="text-[14px] font-bold text-[#0F172A]">USD {totalUSD.toLocaleString('es-AR')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── EditableRow sub-component ────────────────────────────────────────────────

function EditableRow({
  label, value, isEditing, editValue, onEdit, onChange, onSave, onCancel,
  mono = false, inputType = 'text', compact = false,
}: {
  label: string; value: string; isEditing: boolean; editValue: string
  onEdit: () => void; onChange: (v: string) => void; onSave: () => void; onCancel: () => void
  mono?: boolean; inputType?: string; compact?: boolean
}) {
  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[#94A3B8] shrink-0">{label}</span>
        <input
          type={inputType}
          value={editValue}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
          autoFocus
          className="flex-1 min-w-0 text-[12px] border border-[#22C55E] rounded px-1.5 py-0.5 outline-none"
        />
        <button onClick={onSave} className="text-[#22C55E] cursor-pointer shrink-0"><Check size={12} /></button>
        <button onClick={onCancel} className="text-[#94A3B8] cursor-pointer shrink-0"><X size={12} /></button>
      </div>
    )
  }
  if (compact) {
    return (
      <div className="flex items-center gap-1 group cursor-pointer" onClick={onEdit}>
        <span className="text-[10px] text-[#94A3B8]">{label}</span>
        <span className={`text-[12px] text-[#0F172A] ${mono ? 'font-mono' : ''}`}>{value}</span>
        <Pencil size={9} className="text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between group">
      <div className="min-w-0">
        <div className="text-[10px] text-[#94A3B8]">{label}</div>
        <div className={`text-[12px] text-[#0F172A] font-medium leading-snug truncate ${mono ? 'font-mono' : ''}`}>{value}</div>
      </div>
      <button onClick={onEdit} className="text-[#CBD5E1] hover:text-[#64748B] cursor-pointer ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil size={11} />
      </button>
    </div>
  )
}
