-- ============================================================
-- Migration: Team / Multi-user support (Concesionarios)
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add owner_id to profiles
--    NULL  = usuario independiente o admin del plan Concesionarios
--    UUID  = vendedor que pertenece a ese admin
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_owner_idx ON profiles(owner_id);

-- 2. profiles RLS: admin puede leer perfiles de su equipo
DROP POLICY IF EXISTS "profiles_own" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (id = auth.uid());

-- 3. quotes RLS: admin puede leer cotizaciones de su equipo
DROP POLICY IF EXISTS "quotes_own" ON quotes;

CREATE POLICY "quotes_select" ON quotes FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM profiles WHERE owner_id = auth.uid())
  );

CREATE POLICY "quotes_insert" ON quotes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "quotes_update" ON quotes FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "quotes_delete" ON quotes FOR DELETE
  USING (user_id = auth.uid());

-- 4. clients RLS: admin puede leer clientes de su equipo
DROP POLICY IF EXISTS "clients_own" ON clients;

CREATE POLICY "clients_select" ON clients FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM profiles WHERE owner_id = auth.uid())
  );

CREATE POLICY "clients_insert" ON clients FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "clients_update" ON clients FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "clients_delete" ON clients FOR DELETE
  USING (user_id = auth.uid());

-- 5. follow_ups RLS: admin puede leer seguimientos de su equipo
DROP POLICY IF EXISTS "follow_ups_own" ON follow_ups;

CREATE POLICY "follow_ups_select" ON follow_ups FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM profiles WHERE owner_id = auth.uid())
  );

CREATE POLICY "follow_ups_insert" ON follow_ups FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "follow_ups_update" ON follow_ups FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "follow_ups_delete" ON follow_ups FOR DELETE
  USING (user_id = auth.uid());
