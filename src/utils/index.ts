import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmt(n: number): string {
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtCurrency(n: number, currency: 'USD' | 'ARS' = 'USD'): string {
  const sym = currency === 'USD' ? 'U$S ' : '$ '
  return sym + fmt(n)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function generateCheckDates(numChecks: number): string[] {
  const today = new Date()
  const dates: string[] = []
  for (let i = 0; i < numChecks; i++) {
    dates.push(addDays(today, i * 30).toISOString().split('T')[0])
  }
  return dates
}

export function quoteStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    expired: 'Vencida',
  }
  return map[status] ?? status
}

export const PROVINCES = [
  'Buenos Aires', 'Santa Fe', 'Córdoba', 'Entre Ríos', 'La Pampa',
  'Santiago del Estero', 'Chaco', 'Tucumán', 'Salta', 'Mendoza',
  'San Luis', 'Río Negro', 'Neuquén', 'Formosa', 'Misiones',
  'Corrientes', 'Jujuy', 'Catamarca', 'San Juan', 'La Rioja',
  'Tierra del Fuego', 'Santa Cruz', 'Chubut',
]
