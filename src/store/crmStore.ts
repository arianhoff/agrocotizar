import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { FollowUp } from '@/types'

interface CRMStore {
  followUps: FollowUp[]
  sellerEmail: string
  setSellerEmail: (email: string) => void
  addFollowUp:    (f: Omit<FollowUp, 'id' | 'created_at'>) => FollowUp
  updateFollowUp: (id: string, patch: Partial<FollowUp>) => void
  deleteFollowUp: (id: string) => void
  /** Marca como hecho y agenda el próximo recordatorio automáticamente */
  completeAndReschedule: (id: string, notes?: string) => void
}

const uid = () => Math.random().toString(36).slice(2, 9)

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export const useCRMStore = create<CRMStore>()(
  devtools(
    persist(
      (set, get) => ({
        followUps: [],
        sellerEmail: '',

        setSellerEmail: (email) => set({ sellerEmail: email }),

        addFollowUp: (f) => {
          const newF: FollowUp = {
            ...f,
            id: uid(),
            created_at: new Date().toISOString(),
            reminder_days: f.reminder_days ?? 3,
          }
          set(s => ({ followUps: [...s.followUps, newF] }))
          return newF
        },

        updateFollowUp: (id, patch) => set(s => ({
          followUps: s.followUps.map(f => f.id === id ? { ...f, ...patch } : f),
        })),

        deleteFollowUp: (id) => set(s => ({
          followUps: s.followUps.filter(f => f.id !== id),
        })),

        completeAndReschedule: (id, notes) => {
          const fu = get().followUps.find(f => f.id === id)
          if (!fu) return
          // Mark current as done
          set(s => ({
            followUps: s.followUps.map(f => f.id === id ? { ...f, status: 'done' } : f),
          }))
          // Create next follow-up
          const nextDate = addDays(new Date().toISOString().split('T')[0], fu.reminder_days)
          const next: FollowUp = {
            ...fu,
            id: uid(),
            created_at: new Date().toISOString(),
            scheduled_date: nextDate,
            status: 'pending',
            notes: notes ?? `Seguimiento automático — ${fu.reminder_days} días desde último contacto`,
          }
          set(s => ({ followUps: [...s.followUps, next] }))
        },
      }),
      { name: 'agrocotizar-crm' }
    ),
    { name: 'CRMStore' }
  )
)
