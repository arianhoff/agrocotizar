import { useState } from 'react'
import { Eye, EyeOff, Tractor, Mail, Lock, UserPlus, LogIn } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const SESSION_KEY = 'agrocotizar_auth'

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'ok'
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY)
  supabase.auth.signOut()
}

type Mode = 'login' | 'register'

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode]           = useState<Mode>('login')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [shaking, setShaking]     = useState(false)

  const shake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email || !password) {
      setError('Completá todos los campos.')
      shake()
      return
    }

    if (mode === 'register') {
      if (password !== confirm) {
        setError('Las contraseñas no coinciden.')
        shake()
        return
      }
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.')
        shake()
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) {
          setError(
            err.message.includes('Invalid login')
              ? 'Email o contraseña incorrectos.'
              : err.message
          )
          shake()
        } else {
          sessionStorage.setItem(SESSION_KEY, 'ok')
          onLogin()
        }
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) {
          setError(
            err.message.includes('already registered')
              ? 'Ya existe una cuenta con ese email.'
              : err.message
          )
          shake()
        } else {
          setSuccess('¡Cuenta creada! Revisá tu email para confirmar tu cuenta y luego iniciá sesión.')
          setMode('login')
          setPassword('')
          setConfirm('')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E2235] via-[#252d42] to-[#1a1f30] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#22C55E]/5 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#22C55E]/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 mb-5">
            <Tractor size={28} className="text-[#22C55E]" />
          </div>
          <div className="text-[28px] font-bold text-white tracking-tight leading-none">
            Agro<span className="text-[#22C55E]">Cotizar</span>
          </div>
          <div className="text-[11px] text-white/30 tracking-widest uppercase mt-2 font-mono">
            Sistema de cotización agrícola
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-white/[0.06] rounded-xl p-1 mb-5 gap-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/20'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <LogIn size={14} />
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#22C55E] text-white shadow-lg shadow-[#22C55E]/20'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <UserPlus size={14} />
            Crear cuenta
          </button>
        </div>

        {/* Card */}
        <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[12px] text-[#22C55E] leading-relaxed">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className={`space-y-3.5 transition-transform duration-100 ${shaking ? 'animate-shake' : ''}`}>
              {/* Email */}
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null) }}
                  placeholder="Email"
                  autoFocus
                  className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all ${
                    error
                      ? 'border-[#EF4444]/60 focus:border-[#EF4444]'
                      : 'border-white/10 focus:border-[#22C55E]/60 focus:bg-white/[0.1]'
                  }`}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null) }}
                  placeholder={mode === 'register' ? 'Contraseña (mín. 8 caracteres)' : 'Contraseña'}
                  className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-11 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all ${
                    error
                      ? 'border-[#EF4444]/60 focus:border-[#EF4444]'
                      : 'border-white/10 focus:border-[#22C55E]/60 focus:bg-white/[0.1]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Confirm password — only in register mode */}
              {mode === 'register' && (
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(null) }}
                    placeholder="Repetí la contraseña"
                    className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all ${
                      error
                        ? 'border-[#EF4444]/60 focus:border-[#EF4444]'
                        : 'border-white/10 focus:border-[#22C55E]/60 focus:bg-white/[0.1]'
                    }`}
                  />
                </div>
              )}

              {error && (
                <p className="text-[11px] text-[#EF4444] ml-1 leading-relaxed">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!email || !password || (mode === 'register' && !confirm) || loading}
              className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#22C55E]/20 mt-1"
            >
              {loading
                ? (mode === 'login' ? 'Ingresando...' : 'Creando cuenta...')
                : (mode === 'login' ? 'Ingresar' : 'Crear cuenta')
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          © {new Date().getFullYear()} AgroCotizar
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) }
          20% { transform: translateX(-6px) }
          40% { transform: translateX(6px) }
          60% { transform: translateX(-4px) }
          80% { transform: translateX(4px) }
        }
        .animate-shake { animation: shake 0.4s ease-in-out }
      `}</style>
    </div>
  )
}
