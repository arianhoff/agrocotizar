import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('⚠️  VITE_SUPABASE_URL no configurado — las funciones de base de datos no funcionarán.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
