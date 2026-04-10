-- ============================================================
-- Cotizagro — Supabase Schema v2
-- Modelo simplificado: cada usuario tiene sus propios datos.
-- RLS usa auth.uid() directamente (sin multi-tenant complejo).
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── AFIP token cache (server-side only, no RLS) ──────────────
-- Persiste el token WSAA entre cold-starts de Netlify Functions.
-- Solo accedido con SUPABASE_SERVICE_ROLE_KEY desde el servidor.
CREATE TABLE IF NOT EXISTS afip_token_cache (
  service     text PRIMARY KEY,       -- 'ws_sr_padron_a5'
  token       text NOT NULL,
  sign        text NOT NULL,
  expiry_at   timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- Sin RLS: la tabla solo la lee/escribe el server via service role key.
ALTER TABLE afip_token_cache DISABLE ROW LEVEL SECURITY;

-- ─── Profiles (configuración del vendedor/empresa) ────────────
-- Se crea automáticamente al registrarse (trigger abajo).
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         text,
  settings      jsonb NOT NULL DEFAULT '{}'::jsonb,  -- seller, company, quoteDefaults
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Price lists ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS price_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users ON DELETE CASCADE,  -- NULL = global (GEA)
  brand         text NOT NULL,
  name          text NOT NULL,
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  valid_from    date NOT NULL,
  valid_until   date,
  is_active             boolean NOT NULL DEFAULT true,
  iva_included          boolean NOT NULL DEFAULT true,
  iva_rate              numeric(5,2) NOT NULL DEFAULT 10.5,
  payment_conditions    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id  uuid NOT NULL REFERENCES price_lists ON DELETE CASCADE,
  code           text NOT NULL DEFAULT '',
  name           text NOT NULL,
  description    text,
  category       text NOT NULL,
  base_price     numeric(12,2) NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Product options ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_options (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid NOT NULL REFERENCES products ON DELETE CASCADE,
  name                 text NOT NULL,
  price                numeric(12,2) NOT NULL,
  currency             text NOT NULL DEFAULT 'USD',
  requires_commission  boolean NOT NULL DEFAULT true
);

-- ─── Clients ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  name              text NOT NULL,
  cuit              text,
  province          text,
  city              text,
  phone             text,
  email             text,
  notes             text,
  quote_count       int NOT NULL DEFAULT 0,
  last_quote_number text,
  last_quote_date   date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_user_idx ON clients(user_id);
CREATE INDEX IF NOT EXISTS clients_name_idx ON clients(user_id, name);

-- ─── Quotes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  quote_number  text NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  currency      text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(10,2),
  total         numeric(14,2),
  valid_days    int NOT NULL DEFAULT 15,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_user_idx    ON quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx  ON quotes(status);
CREATE INDEX IF NOT EXISTS quotes_created_idx ON quotes(created_at DESC);

-- ─── Follow-ups CRM ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_ups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE DEFAULT auth.uid(),
  quote_id        text,
  quote_number    text,
  client_name     text,
  client_phone    text,
  client_email    text,
  seller_email    text,
  scheduled_date  date,
  reminder_days   int NOT NULL DEFAULT 3,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','done','cancelled')),
  sent_at         date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS follow_ups_user_idx   ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS follow_ups_status_idx ON follow_ups(user_id, status);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients        ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups     ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve/edita solo el suyo
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (id = auth.uid());

-- Price lists: globales (user_id IS NULL) son solo lectura para todos; las propias son de escritura
CREATE POLICY "price_lists_read"  ON price_lists FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "price_lists_write" ON price_lists FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "price_lists_update" ON price_lists FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "price_lists_delete" ON price_lists FOR DELETE
  USING (user_id = auth.uid());

-- Products: heredan permiso de su price_list
CREATE POLICY "products_read" ON products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id
      AND (pl.user_id IS NULL OR pl.user_id = auth.uid())
  ));
CREATE POLICY "products_write" ON products FOR ALL
  USING (EXISTS (
    SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id
      AND pl.user_id = auth.uid()
  ));

-- Product options: igual que products
CREATE POLICY "options_read" ON product_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN price_lists pl ON pl.id = p.price_list_id
    WHERE p.id = product_id
      AND (pl.user_id IS NULL OR pl.user_id = auth.uid())
  ));
CREATE POLICY "options_write" ON product_options FOR ALL
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN price_lists pl ON pl.id = p.price_list_id
    WHERE p.id = product_id AND pl.user_id = auth.uid()
  ));

-- Clients, Quotes, Follow-ups: solo el dueño
CREATE POLICY "clients_own"    ON clients    FOR ALL USING (user_id = auth.uid());
CREATE POLICY "quotes_own"     ON quotes     FOR ALL USING (user_id = auth.uid());
CREATE POLICY "follow_ups_own" ON follow_ups FOR ALL USING (user_id = auth.uid());

-- ─── updated_at triggers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at   BEFORE UPDATE ON profiles   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER clients_updated_at    BEFORE UPDATE ON clients    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER quotes_updated_at     BEFORE UPDATE ON quotes     FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Auto-crear profile al registrarse ───────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Storage bucket: PDFs de cotizaciones ────────────────────
-- Ejecutar en Supabase Dashboard → Storage → New bucket:
--   Name: quote-pdfs | Public: OFF
-- Luego ejecutar estas políticas:
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Solo el dueño puede subir/borrar sus PDFs
CREATE POLICY "quote_pdfs_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "quote_pdfs_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'quote-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Las URLs firmadas (signed URLs) permiten descarga sin autenticación (no requiere policy SELECT).

-- ─── Seed: lista GEA global (visible para todos) ─────────────
INSERT INTO price_lists (id, user_id, brand, name, currency, valid_from, iva_included, iva_rate)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'GEA', 'Lista Enero 2026', 'USD', '2026-01-01', true, 10.5)
ON CONFLICT (id) DO NOTHING;
