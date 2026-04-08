import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'placeholder-key'

if (!import.meta.env.VITE_SUPABASE_URL) {
  console.warn('⚠️  VITE_SUPABASE_URL no configurado — las funciones de base de datos no funcionarán.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Row Level Security: all queries are automatically scoped
// to the user's tenant_id via Supabase policies.
// Schema (run in Supabase SQL editor):
//
// CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, slug text UNIQUE, ...);
// CREATE TABLE users (id uuid PRIMARY KEY REFERENCES auth.users, tenant_id uuid REFERENCES tenants, role text, ...);
// CREATE TABLE quotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid REFERENCES tenants, data jsonb, ...);
// CREATE TABLE price_lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid, ...);
//
// RLS policies:
// ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "tenant_isolation" ON quotes USING (tenant_id = auth.jwt() -> 'tenant_id');
