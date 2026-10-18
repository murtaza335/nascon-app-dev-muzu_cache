-- Part II schema (day2/ARCHITECTURE.md §3). Forward-only; Phase I tables untouched except the two user columns.
ALTER TABLE users ADD COLUMN token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN erased_at timestamptz;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE stream_keys (
  stream_key text PRIMARY KEY,
  player_id  text NOT NULL REFERENCES players(player_id),
  label      text NOT NULL,
  status     text NOT NULL CHECK (status IN ('active','revoked')),
  match_id   text,
  live       boolean NOT NULL DEFAULT false,
  seq        bigserial,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  signature  text NOT NULL
);
CREATE UNIQUE INDEX stream_keys_one_active ON stream_keys (player_id) WHERE status = 'active';
CREATE INDEX stream_keys_player_idx ON stream_keys (player_id, seq);

CREATE TABLE vods (
  vod_id      text PRIMARY KEY,
  stream_key  text,
  player_id   text,
  match_id    text,
  session_id  text,
  object_key  text NOT NULL,
  duration_s  integer,
  recorded_at timestamptz NOT NULL
);
CREATE INDEX vods_player_idx ON vods (player_id);
CREATE INDEX vods_match_idx ON vods (match_id);

CREATE TABLE costream_sessions (
  session_id          text PRIMARY KEY,
  host_player_id      text NOT NULL,
  active_host         text,
  participants        jsonb NOT NULL,
  active_participants jsonb NOT NULL,
  layout              text NOT NULL,
  status              text NOT NULL,
  handoff_occurred    boolean NOT NULL,
  request_hash        text NOT NULL,
  response            jsonb NOT NULL,
  match_id            text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE costream_participant_state (
  session_id text NOT NULL,
  player_id  text NOT NULL,
  muted      boolean NOT NULL DEFAULT false,
  spotlight  boolean NOT NULL DEFAULT false,
  kicked     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (session_id, player_id)
);

CREATE TABLE qr_codes (
  entity_id   text PRIMARY KEY,
  short_code  text NOT NULL UNIQUE,
  entity_type text NOT NULL,
  scan_count  bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- Privacy by design (NFR-9): only hour bucket + device family + count. No IP, UA or cookie column exists.
CREATE TABLE qr_scan_buckets (
  entity_id     text NOT NULL,
  bucket_hour   timestamptz NOT NULL,
  device_family text NOT NULL CHECK (device_family IN ('mobile','desktop')),
  scans         bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (entity_id, bucket_hour, device_family)
);

CREATE TABLE guest_tokens (
  guest_token         text PRIMARY KEY,
  status              text NOT NULL CHECK (status IN ('active','merged','wiped')),
  linked_user_id      text,
  merged_request_hash text,
  merge_receipt       jsonb,
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE guest_cart_items (
  guest_token text NOT NULL REFERENCES guest_tokens(guest_token) ON DELETE CASCADE,
  variant_id  text NOT NULL REFERENCES variants(variant_id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (guest_token, variant_id)
);
CREATE TABLE carts (
  user_id    text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cart_items (
  user_id    text NOT NULL REFERENCES carts(user_id) ON DELETE CASCADE,
  variant_id text NOT NULL REFERENCES variants(variant_id),
  quantity   integer NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (user_id, variant_id)
);

CREATE TABLE chat_rooms (
  chat_room_id text PRIMARY KEY,
  last_seq     bigint NOT NULL DEFAULT 0
);
CREATE TABLE chat_messages (
  chat_room_id      text NOT NULL REFERENCES chat_rooms(chat_room_id),
  seq               bigint NOT NULL,
  message_id        text NOT NULL,
  client_message_id text,
  sender            text NOT NULL,
  text              text NOT NULL,
  flagged           boolean NOT NULL,
  reason            text,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_room_id, seq),
  UNIQUE (chat_room_id, client_message_id)
);
CREATE TABLE moderation_actions (
  chat_room_id text NOT NULL,
  user_id      text NOT NULL,
  action       text NOT NULL CHECK (action IN ('kick','mute')),
  reason       text NOT NULL,
  signature    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_room_id, user_id, action)
);

CREATE TABLE notification_dlq (
  dlq_id           bigserial PRIMARY KEY,
  event_id         text NOT NULL UNIQUE,
  topic            text NOT NULL,
  target           text NOT NULL,
  payload          jsonb NOT NULL,
  attempts         integer NOT NULL,
  last_error       text NOT NULL,
  dead_lettered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE follows (
  follower_id text NOT NULL,
  athlete_id  text NOT NULL REFERENCES players(player_id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, athlete_id)
);
CREATE INDEX follows_athlete_idx ON follows (athlete_id);
