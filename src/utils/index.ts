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

// Valida CUIT/CUIL argentino usando el algoritmo módulo 11
export function validateCuit(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 11) return false
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = mult.reduce((acc, m, i) => acc + m * Number(digits[i]), 0)
  const remainder = sum % 11
  const verifier = remainder === 0 ? 0 : 11 - remainder
  if (verifier === 10) return false  // CUIT inválido por definición
  return verifier === Number(digits[10])
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
