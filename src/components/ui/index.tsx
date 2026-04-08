import { cn } from '@/utils'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-[11px] font-semibold tracking-widest uppercase text-[#94A3B8] mb-4', className)}>
      {children}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'add'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  children: ReactNode
}

export function Button({ variant = 'secondary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'text-[13px] font-medium px-4 py-2 rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2',
        variant === 'primary'   && 'bg-[#22C55E] text-white hover:bg-[#16A34A] shadow-sm',
        variant === 'secondary' && 'bg-white text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC] shadow-sm',
        variant === 'ghost'     && 'bg-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]',
        variant === 'danger'    && 'bg-transparent text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 text-[12px] py-1.5 px-3',
        variant === 'add'       && 'bg-[#F0FDF4] text-[#22C55E] border border-dashed border-[#22C55E]/40 hover:border-solid hover:bg-[#DCFCE7] w-full py-3',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────
export function Label({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('block text-[12px] font-medium text-[#374151] mb-1.5', className)}
    >
      {children}
    </label>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-3.5 py-2.5',
        'outline-none transition-colors placeholder:text-[#94A3B8]',
        'focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10',
        className
      )}
      {...props}
    />
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-3.5 py-2.5',
        'outline-none transition-colors appearance-none',
        'focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10',
        '[&>option]:bg-white',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full bg-white border border-[#E2E8F0] rounded-lg text-[#0F172A] text-sm px-3.5 py-2.5',
        'outline-none transition-colors placeholder:text-[#94A3B8] resize-none',
        'focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/10',
        className
      )}
      {...props}
    />
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = 'trigo', className }: { children: ReactNode; variant?: 'trigo' | 'verde' | 'rojo' | 'acero'; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full',
      variant === 'trigo' && 'bg-amber-100 text-amber-700',
      variant === 'verde' && 'bg-green-100 text-green-700',
      variant === 'rojo'  && 'bg-red-100 text-red-600',
      variant === 'acero' && 'bg-slate-100 text-slate-500',
      className
    )}>
      {children}
    </span>
  )
}

// ─── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return (
    <div className={cn('h-px my-6 bg-[#E2E8F0]', className)} />
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 mb-4', className)}>
      <span className="text-[12px] font-semibold tracking-wider uppercase text-[#64748B] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-[#E2E8F0]" />
    </div>
  )
}

// ─── FieldGroup ──────────────────────────────────────────────────────────────
export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4', className)}>{children}</div>
}

// ─── PrefixInput ─────────────────────────────────────────────────────────────
export function PrefixInput({ prefix, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix: string }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#64748B] pointer-events-none">
        {prefix}
      </span>
      <Input className={cn('pl-9', className)} {...props} />
    </div>
  )
}
