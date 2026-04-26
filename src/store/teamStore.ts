import { create } from 'zustand'

export interface TeamMember {
  id:         string
  email:      string
  name:       string
  created_at: string
}

interface TeamStore {
  members:    TeamMember[]
  setMembers: (members: TeamMember[]) => void
  removeMember: (id: string) => void
  clear:      () => void
  nameById:   (id: string) => string
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  members: [],

  setMembers: (members) => set({ members }),

  removeMember: (id) => set(s => ({ members: s.members.filter(m => m.id !== id) })),

  clear: () => set({ members: [] }),

  nameById: (id) => get().members.find(m => m.id === id)?.name ?? '',
}))
