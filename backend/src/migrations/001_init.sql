-- Phase I schema (ARCHITECTURE §6.1). Money is integer paisa; timestamps are timestamptz (API formats to Z seconds).
-- Ids are client/seed-chosen text, stored verbatim. Append-only tables are guarded by triggers.

CREATE TABLE tenants (
  tenant_id  text PRIMARY KEY,
  name       text NOT NULL,
  logo_url   text,
  colors     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE users (
  user_id       text PRIMARY KEY,
  email         text NOT NULL,
  password_hash text NOT NULL,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('super_admin','league_organizer','club_manager','player','viewer')),
  tenant_id     text REFERENCES tenants(tenant_id),
  league_ids    text[] NOT NULL DEFAULT '{}',
  club_id       text,
  player_id     text
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE sports (
  sport_id      text PRIMARY KEY,
  name          text NOT NULL,
  scoring_model text NOT NULL CHECK (scoring_model IN ('event','innings','round')),
  config        jsonb NOT NULL,
  is_seed       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clubs (
  club_id    text PRIMARY KEY,
  tenant_id  text NOT NULL REFERENCES tenants(tenant_id),
  name       text NOT NULL,
  home_venue jsonb NOT NULL DEFAULT '{}'::jsonb,
  socials    jsonb NOT NULL DEFAULT '{}'::jsonb,
  staff      jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX clubs_tenant_idx ON clubs (tenant_id);

CREATE TABLE players (
  player_id text PRIMARY KEY,
  name      text NOT NULL,
  position  text,
  club_id   text REFERENCES clubs(club_id)
);

CREATE TABLE leagues (
  league_id               text PRIMARY KEY,
  tenant_id               text REFERENCES tenants(tenant_id),
  sport_id                text REFERENCES sports(sport_id),
  name                    text NOT NULL,
  teams                   text[] NOT NULL DEFAULT '{}',
  points                  jsonb NOT NULL DEFAULT '{"win":3,"draw":1,"loss":0}'::jsonb,
  tie_break_order         text[] NOT NULL DEFAULT '{}',
  qualification_spots     integer,
  lots_seed               integer NOT NULL DEFAULT 42,
  transfer_window_open    date,
  transfer_window_close   date,
  max_squad_size          integer,
  required_positions      jsonb NOT NULL DEFAULT '{}'::jsonb,
  organizer_user_id       text,
  created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leagues_tenant_idx ON leagues (tenant_id);

CREATE TABLE matches (
  match_id           text PRIMARY KEY,
  sport_id           text NOT NULL REFERENCES sports(sport_id),
  league_id          text REFERENCES leagues(league_id),
  home_team_id       text NOT NULL,
  away_team_id       text NOT NULL,
  version            integer NOT NULL DEFAULT 0,        -- event count, maintained in the append transaction
  status_cache       text NOT NULL DEFAULT 'upcoming',  -- denormalized for lists only; audit reads derive from events
  scheduled_at       timestamptz,
  venue_id           text,
  pinned_product_id  text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX matches_league_idx ON matches (league_id);

CREATE TABLE match_events (
  event_id          text PRIMARY KEY,
  match_id          text NOT NULL REFERENCES matches(match_id),
  sequence          integer NOT NULL CHECK (sequence >= 1),
  type              text NOT NULL,
  payload           jsonb NOT NULL,
  payload_canonical text NOT NULL,
  signature         text NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
  request_hash      text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, sequence)
);

CREATE TABLE squads (
  league_id text NOT NULL REFERENCES leagues(league_id),
  squad_id  text NOT NULL,
  club_id   text NOT NULL REFERENCES clubs(club_id),
  tenant_id text NOT NULL REFERENCES tenants(tenant_id),
  name      text NOT NULL,
  PRIMARY KEY (league_id, squad_id)
);

CREATE TABLE registrations (
  league_id         text NOT NULL REFERENCES leagues(league_id),
  player_id         text NOT NULL REFERENCES players(player_id),
  squad_id          text,                -- null = released
  parent_squad_id   text,                -- lender during a loan
  registration_type text NOT NULL CHECK (registration_type IN ('initial','transfer','loan')),
  start_date        date NOT NULL,
  loan_end_date     date,
  role              text NOT NULL CHECK (role IN ('captain','vice_captain','starter','substitute')),
  state             text NOT NULL DEFAULT 'active' CHECK (state IN ('active','deferred_until_match_end')),
  blocking_match_id text,
  PRIMARY KEY (league_id, player_id)
);
CREATE INDEX registrations_squad_idx ON registrations (league_id, squad_id);

CREATE TABLE roster_matches_in_progress (
  league_id      text NOT NULL REFERENCES leagues(league_id),
  match_id       text NOT NULL,
  home_squad_id  text NOT NULL,
  away_squad_id  text NOT NULL,
  ordinal        integer NOT NULL,
  PRIMARY KEY (league_id, match_id)
);

CREATE TABLE roster_audit (
  audit_seq     bigserial PRIMARY KEY,
  audit_id      text NOT NULL UNIQUE,
  action        text NOT NULL CHECK (action IN ('transfer','loan','release','loan_return')),
  player_id     text NOT NULL,
  league_id     text NOT NULL,
  from_squad_id text,
  to_squad_id   text,
  effective_date date NOT NULL,
  state         text NOT NULL,
  who           text NOT NULL,
  occurred_at   timestamptz NOT NULL,
  why           text NOT NULL,
  loan_audit_id text            -- audit_id of the loan this return belongs to
);
CREATE UNIQUE INDEX roster_audit_loan_return_uq ON roster_audit (loan_audit_id) WHERE action = 'loan_return';
CREATE INDEX roster_audit_player_idx ON roster_audit (player_id, audit_seq);

CREATE TABLE products (
  product_id  text PRIMARY KEY,
  tenant_id   text NOT NULL REFERENCES tenants(tenant_id),
  club_id     text REFERENCES clubs(club_id),
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN ('apparel','accessory','digital')),
  description text,
  image_url   text
);

CREATE TABLE variants (
  variant_id  text PRIMARY KEY,
  product_id  text NOT NULL REFERENCES products(product_id),
  size        text,
  color       text,
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  stock       integer NOT NULL CHECK (stock >= 0),
  reserved    integer NOT NULL DEFAULT 0 CHECK (reserved >= 0)
);

CREATE TABLE price_schedules (
  variant_id     text NOT NULL REFERENCES variants(variant_id),
  effective_from timestamptz NOT NULL,
  price_minor    bigint NOT NULL CHECK (price_minor >= 0),
  PRIMARY KEY (variant_id, effective_from)
);

CREATE TABLE discount_codes (
  code    text PRIMARY KEY,
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
  active  boolean NOT NULL DEFAULT true
);

CREATE TABLE reservations (
  reservation_id text PRIMARY KEY,
  order_id       text NOT NULL,
  items          jsonb NOT NULL,
  expires_at     timestamptz NOT NULL,
  state          text NOT NULL CHECK (state IN ('held','committed','released')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservations_held_idx ON reservations (expires_at) WHERE state = 'held';

CREATE TABLE orders (
  order_id       text PRIMARY KEY,
  customer_id    text NOT NULL,
  status         text NOT NULL CHECK (status IN ('pending','paid','packed','shipped','delivered','cancelled','refunded')),
  club_id        text,
  items          jsonb NOT NULL,
  subtotal_minor bigint NOT NULL,
  discount_minor bigint NOT NULL,
  total_minor    bigint NOT NULL,
  payment        jsonb NOT NULL,
  receipt        jsonb NOT NULL,
  pdf            bytea,
  request_hash   text NOT NULL,
  response       jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_customer_idx ON orders (customer_id);

CREATE TABLE payment_attempts (
  id         bigserial PRIMARY KEY,
  order_id   text NOT NULL,
  token      text NOT NULL,
  outcome    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency (
  scope        text NOT NULL,
  client_id    text NOT NULL,
  request_hash text NOT NULL,
  status_code  integer NOT NULL,
  response     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, client_id)
);

CREATE TABLE offline_sync_actions (
  device_id  text NOT NULL,
  action_id  text NOT NULL,
  result     jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, action_id)
);

CREATE TABLE outbox (
  id           bigserial PRIMARY KEY,
  topic        text NOT NULL,
  type         text NOT NULL,
  aggregate_id text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_unpublished_idx ON outbox (id) WHERE published_at IS NULL;

CREATE TABLE counters (
  name  text PRIMARY KEY,
  value bigint NOT NULL DEFAULT 0
);

CREATE TABLE app_state (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- Append-only guard: UPDATE/DELETE/TRUNCATE are rejected unless the session flag is on
-- (set with SET LOCAL by the reset and by roster re-setup only).
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.allow_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END $$;

CREATE TRIGGER match_events_append_only BEFORE UPDATE OR DELETE ON match_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER match_events_no_truncate BEFORE TRUNCATE ON match_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER roster_audit_append_only BEFORE UPDATE OR DELETE ON roster_audit
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER roster_audit_no_truncate BEFORE TRUNCATE ON roster_audit
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
