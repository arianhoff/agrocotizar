import { useState, useRef } from 'react'
import { Eye, EyeOff, Mail, Lock, UserPlus, LogIn, RefreshCw, ShieldCheck } from 'lucide-react'
import caLogo from '@/assets/ca.svg'
import { supabase } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// Tracks failed attempts per session. After 3 failures adds a delay warning;
// after 5 failures locks the form for 60 seconds.

const LOCKOUT_AFTER    = 5    // attempts before full lockout
const WARN_AFTER       = 3    // attempts before warning
const LOCKOUT_SECS     = 60

type Mode = 'login' | 'register' | 'forgot'

export function LoginPage({ onLogin, initialMode = 'login' }: { onLogin: () => void; initialMode?: Mode }) {
  const [mode, setMode]         = useState<Mode>(initialMode)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]           = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<string | null>(null)
  const [shaking, setShaking]           = useState(false)

  // ── Email confirmation state ──────────────────────────────────────────────
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [resendLoading, setResendLoading]         = useState(false)
  const [resendSent, setResendSent]               = useState(false)

  // ── Forgot password state ─────────────────────────────────────────────────
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSent, setForgotSent]       = useState(false)

  // ── Rate limiting (in-memory, resets on page load) ────────────────────────
  const failedAttempts = useRef(0)
  const lockedUntil    = useRef(0)
  const [lockSecsLeft, setLockSecsLeft] = useState(0)

  const shake = () => {
    setShaking(true)
    setTimeout(() => setShaking(false), 400)
  }

  // Updates the countdown display every second while locked
  function startLockCountdown() {
    const tick = () => {
      const left = Math.ceil((lockedUntil.current - Date.now()) / 1000)
      if (left <= 0) { setLockSecsLeft(0); return }
      setLockSecsLeft(left)
      setTimeout(tick, 1000)
    }
    tick()
  }

  function recordFailure() {
    failedAttempts.current++
    if (failedAttempts.current >= LOCKOUT_AFTER) {
      lockedUntil.current = Date.now() + LOCKOUT_SECS * 1000
      startLockCountdown()
    }
  }

  function isLocked(): boolean {
    return Date.now() < lockedUntil.current
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setNeedsConfirmation(false)

    // ── Rate limit check ──────────────────────────────────────────────────
    if (isLocked()) {
      setError(`Demasiados intentos fallidos. Esperá ${lockSecsLeft} segundos.`)
      shake()
      return
    }

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
          recordFailure()

          if (err.message.toLowerCase().includes('email not confirmed')) {
            // Account exists but email not yet verified
            setNeedsConfirmation(true)
            setError('Confirmá tu email antes de ingresar. Revisá tu bandeja de entrada.')
          } else {
            // Use a generic message for login failures — avoids leaking whether
            // the email is registered or not (prevents account enumeration)
            const attemptsLeft = Math.max(0, LOCKOUT_AFTER - failedAttempts.current)
            setError(
              failedAttempts.current >= WARN_AFTER
                ? `Email o contraseña incorrectos. ${attemptsLeft > 0 ? `Quedan ${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''} antes del bloqueo.` : ''}`
                : 'Email o contraseña incorrectos.'
            )
          }
          shake()
        } else {
          failedAttempts.current = 0
          onLogin()
        }

      } else {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })

        if (err) {
          if (err.message.toLowerCase().includes('already registered')) {
            // Don't expose that the email exists — show same success message
            // (Supabase will send a "security alert" email to the existing user)
            setSuccess('¡Listo! Si el email no está registrado, recibirás un link de confirmación. Revisá tu bandeja.')
          } else {
            setError(err.message)
            shake()
          }
        } else {
          setSuccess('¡Cuenta creada! Revisá tu email y hacé click en el link de confirmación para activar tu cuenta.')
          setMode('login')
          setPassword('')
          setConfirm('')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // Resend confirmation email
  const handleResend = async () => {
    if (!email || resendLoading) return
    setResendLoading(true)
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setResendLoading(false)
    if (!err) {
      setResendSent(true)
      setTimeout(() => setResendSent(false), 30_000)
    }
  }

  // Forgot password — sends reset email
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || forgotLoading) return
    setForgotLoading(true)
    setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    })
    setForgotLoading(false)
    if (err) {
      setError('No se pudo enviar el email. Verificá que el email sea correcto.')
      shake()
    } else {
      setForgotSent(true)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setSuccess(null)
    setNeedsConfirmation(false)
    setResendSent(false)
    setForgotSent(false)
    setPassword('')
    setConfirm('')
  }

  const locked = isLocked()

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
          <img src={caLogo} alt="Cotizagro" className="w-20 h-auto mx-auto mb-5 brightness-0 invert" />
          <div className="text-[28px] font-bold text-white tracking-tight leading-none">
            Cotiz<span className="text-[#22C55E]">agro</span>
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

          {/* Success banner */}
          {success && (
            <div className="mb-4 p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[12px] text-[#22C55E] leading-relaxed flex items-start gap-2">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {/* Email not confirmed banner */}
          {needsConfirmation && (
            <div className="mb-4 p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[12px] text-[#F59E0B] leading-relaxed">
              <div className="font-semibold mb-1">Email sin confirmar</div>
              <div className="text-[#F59E0B]/80 mb-2">
                Revisá tu bandeja de entrada (y el spam) y hacé click en el link que te enviamos.
              </div>
              {resendSent ? (
                <div className="text-[#22C55E] font-medium">✓ Email reenviado. Revisá tu bandeja.</div>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading || !email}
                  className="flex items-center gap-1.5 text-[#F59E0B] hover:text-white font-medium cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={resendLoading ? 'animate-spin' : ''} />
                  {resendLoading ? 'Enviando...' : 'Reenviar email de confirmación'}
                </button>
              )}
            </div>
          )}

          {/* Lockout banner */}
          {locked && (
            <div className="mb-4 p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/20 text-[12px] text-[#EF4444] leading-relaxed">
              Formulario bloqueado por demasiados intentos. Intentá en <span className="font-bold">{lockSecsLeft}s</span>.
            </div>
          )}

          {/* ── Forgot password panel ───────────────────────────────────── */}
          {mode === 'forgot' && (
            <div>
              {forgotSent ? (
                <div className="p-4 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[13px] text-[#22C55E] leading-relaxed">
                  <div className="font-semibold mb-1">¡Email enviado!</div>
                  Revisá tu bandeja de entrada y hacé click en el link para restablecer tu contraseña.
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="block mt-3 text-white/50 hover:text-white text-[12px] cursor-pointer transition-colors"
                  >
                    ← Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <p className="text-[13px] text-white/50 leading-relaxed">
                    Ingresá tu email y te mandamos un link para restablecer tu contraseña.
                  </p>
                  <div className={`space-y-3 ${shaking ? 'animate-shake' : ''}`}>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(null) }}
                        placeholder="Email"
                        autoFocus
                        autoComplete="email"
                        className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all ${
                          error ? 'border-[#EF4444]/60' : 'border-white/10 focus:border-[#22C55E]/60 focus:bg-white/[0.1]'
                        }`}
                      />
                    </div>
                    {error && <p className="text-[11px] text-[#EF4444] ml-1">{error}</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={!email || forgotLoading}
                    className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#22C55E]/20"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar link de recuperación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full text-center text-[12px] text-white/30 hover:text-white/60 cursor-pointer transition-colors"
                  >
                    ← Volver al login
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Google OAuth — only shown in login/register mode */}
          {mode !== 'forgot' && <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading || locked}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white hover:bg-gray-50 text-[14px] font-medium text-[#0F172A] transition-all cursor-pointer disabled:opacity-60 shadow-sm mb-5"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
          </button>}

          {mode !== 'forgot' && <><div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-white/30 font-medium shrink-0">o con email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

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
                  autoComplete="email"
                  disabled={locked}
                  className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all disabled:opacity-40 ${
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
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  disabled={locked}
                  className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-11 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all disabled:opacity-40 ${
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

              {/* Confirm password — register only */}
              {mode === 'register' && (
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => { setConfirm(e.target.value); setError(null) }}
                    placeholder="Repetí la contraseña"
                    autoComplete="new-password"
                    disabled={locked}
                    className={`w-full bg-white/[0.07] border rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-white/30 text-[14px] outline-none transition-all disabled:opacity-40 ${
                      error
                        ? 'border-[#EF4444]/60 focus:border-[#EF4444]'
                        : 'border-white/10 focus:border-[#22C55E]/60 focus:bg-white/[0.1]'
                    }`}
                  />
                </div>
              )}

              {error && !needsConfirmation && !locked && (
                <p className="text-[11px] text-[#EF4444] ml-1 leading-relaxed">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!email || !password || (mode === 'register' && !confirm) || loading || locked}
              className="w-full py-3.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#22C55E]/20 mt-1"
            >
              {loading
                ? (mode === 'login' ? 'Ingresando...' : 'Creando cuenta...')
                : (mode === 'login' ? 'Ingresar' : 'Crear cuenta')
              }
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="w-full text-center text-[12px] text-white/30 hover:text-white/60 cursor-pointer transition-colors pt-1"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </form>
          </>}
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          © {new Date().getFullYear()} Cotizagro
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
