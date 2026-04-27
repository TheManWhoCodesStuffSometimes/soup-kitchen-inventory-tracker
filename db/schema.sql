-- Soup Kitchen Inventory Tracker - Neon schema
-- Run this once against the new database. Idempotent: safe to re-run.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions group items captured during one sorting run.
-- A volunteer starts a session when they begin processing a pickup,
-- ends it when done. Multiple donors can be tagged within a session.
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id         text UNIQUE NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finalized','abandoned')),
  user_label      text,
  total_items     integer NOT NULL DEFAULT 0,
  total_weight_lbs numeric(10,2) NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_modified   timestamptz NOT NULL DEFAULT now()
);

-- Items are individual food entries. The cascade fills these in async.
-- All legacy dashboard fields are preserved so the existing Dashboard
-- component can keep working with minimal change.
CREATE TABLE IF NOT EXISTS items (
  id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id               uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  form_id                  text NOT NULL,
  item_index               integer NOT NULL,
  status                   text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','resolved','needs_review','approved','failed')),

  -- Donor stamp at time of capture
  donor_name               text,
  donor_custom             text,

  -- Cascade-extracted fields (legacy dashboard schema preserved)
  description              text,
  food_type                text,
  soup_kitchen_category    text CHECK (soup_kitchen_category IN ('Perishable','Catering/Banquet','Shelf Stable') OR soup_kitchen_category IS NULL),
  weight_lbs               numeric(10,2),
  weight_source            text CHECK (weight_source IN ('scale','standard','estimated','manual') OR weight_source IS NULL),
  quantity                 integer,
  expiration_date          date,

  -- Pricing analysis (from existing AI Agent1 logic)
  estimated_value          numeric(10,2),
  price_per_unit           numeric(10,2),
  confidence_level         text,
  pricing_source           text,
  search_results_summary   text,
  pricing_notes            text,

  -- Cascade debug + retry support
  cascade_raw              jsonb,
  cascade_run_at           timestamptz,
  cascade_attempts         integer NOT NULL DEFAULT 0,
  cascade_error            text,

  created_at               timestamptz NOT NULL DEFAULT now(),
  last_modified            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_session_id ON items(session_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_form_id ON items(form_id);

-- Photos are the source of truth for an item's appearance.
-- Stored separately so retroactive review and additional captures
-- don't require modifying the item row.
CREATE TABLE IF NOT EXISTS photos (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id      uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  blob_url     text NOT NULL,
  photo_index  integer NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_item_id ON photos(item_id);

-- Trigger to keep last_modified accurate on items + sessions
CREATE OR REPLACE FUNCTION touch_last_modified()
RETURNS trigger AS $$
BEGIN
  NEW.last_modified = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS items_touch_modified ON items;
CREATE TRIGGER items_touch_modified
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION touch_last_modified();

DROP TRIGGER IF EXISTS sessions_touch_modified ON sessions;
CREATE TRIGGER sessions_touch_modified
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION touch_last_modified();
