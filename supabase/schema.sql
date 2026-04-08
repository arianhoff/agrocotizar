-- ============================================================
-- AgroCotizar — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Tenants (concesionarios) ────────────────────────────────
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  logo_url    text,
  phone       text,
  email       text,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Users (vendedores / admins) ─────────────────────────────
CREATE TABLE users (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'seller' CHECK (role IN ('admin','seller','viewer')),
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Price lists ──────────────────────────────────────────────
CREATE TABLE price_lists (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants ON DELETE CASCADE,  -- NULL = global (GEA)
  brand         text NOT NULL,
  name          text NOT NULL,
  currency      text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','ARS')),
  valid_from    date NOT NULL,
  valid_until   date,
  is_active     boolean NOT NULL DEFAULT true,
  iva_included  boolean NOT NULL DEFAULT true,
  iva_rate      numeric(5,2) NOT NULL DEFAULT 10.5,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── Products ─────────────────────────────────────────────────
CREATE TABLE products (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id  uuid NOT NULL REFERENCES price_lists ON DELETE CASCADE,
  code           text NOT NULL,
  name           text NOT NULL,
  description    text,
  category       text NOT NULL,
  base_price     numeric(12,2) NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Product options ──────────────────────────────────────────
CREATE TABLE product_options (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           uuid NOT NULL REFERENCES products ON DELETE CASCADE,
  name                 text NOT NULL,
  price                numeric(12,2) NOT NULL,
  requires_commission  boolean NOT NULL DEFAULT true
);

-- ─── Clients ──────────────────────────────────────────────────
CREATE TABLE clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  name        text NOT NULL,
  cuit        text,
  province    text,
  city        text,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Quotes ───────────────────────────────────────────────────
CREATE TABLE quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  seller_id     uuid NOT NULL REFERENCES users ON DELETE SET NULL,
  client_id     uuid REFERENCES clients ON DELETE SET NULL,
  quote_number  text NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  data          jsonb NOT NULL DEFAULT '{}',   -- full Quote object snapshot
  currency      text NOT NULL DEFAULT 'USD',
  exchange_rate numeric(10,2),
  total         numeric(14,2),
  valid_days    int NOT NULL DEFAULT 15,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quotes_tenant_idx ON quotes(tenant_id);
CREATE INDEX quotes_status_idx ON quotes(status);
CREATE INDEX quotes_created_idx ON quotes(created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's tenant_id from JWT claim
CREATE OR REPLACE FUNCTION my_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid
$$;

-- Tenants: users can read their own tenant
CREATE POLICY "tenant_read"  ON tenants FOR SELECT USING (id = my_tenant_id());

-- Users: can read users in same tenant
CREATE POLICY "users_read"   ON users   FOR SELECT USING (tenant_id = my_tenant_id());
CREATE POLICY "users_update" ON users   FOR UPDATE USING (id = auth.uid());

-- Price lists: global (tenant_id IS NULL) + own tenant
CREATE POLICY "price_lists_read" ON price_lists FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = my_tenant_id());
CREATE POLICY "price_lists_write" ON price_lists FOR ALL
  USING (tenant_id = my_tenant_id());

-- Products & options: same logic as price lists
CREATE POLICY "products_read" ON products FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM price_lists pl WHERE pl.id = price_list_id
      AND (pl.tenant_id IS NULL OR pl.tenant_id = my_tenant_id())
  ));

CREATE POLICY "options_read" ON product_options FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM products p
    JOIN price_lists pl ON pl.id = p.price_list_id
    WHERE p.id = product_id
      AND (pl.tenant_id IS NULL OR pl.tenant_id = my_tenant_id())
  ));

-- Clients: own tenant only
CREATE POLICY "clients_all" ON clients FOR ALL USING (tenant_id = my_tenant_id());

-- Quotes: own tenant only
CREATE POLICY "quotes_all"  ON quotes  FOR ALL USING (tenant_id = my_tenant_id());

-- ─── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Seed: GEA as global price list ──────────────────────────
-- (tenant_id NULL = visible to all tenants)
INSERT INTO price_lists (id, tenant_id, brand, name, currency, valid_from, iva_included, iva_rate)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 'GEA', 'Lista Enero 2026', 'USD', '2026-01-01', true, 10.5);
