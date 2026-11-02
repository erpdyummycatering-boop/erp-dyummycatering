-- Integrasi Kledo (order catering saja).
-- Idempoten. Jalankan MANUAL di Neon branch staging.
-- Jangan jalankan ke branch produksi (main). Tidak ada DML / perubahan data lama.
-- Pengecualian aturan "No Migration Files" di AGENTS.md.

BEGIN;

CREATE TABLE IF NOT EXISTS integration_configs (
  id               BIGSERIAL PRIMARY KEY,
  tenant_code      VARCHAR(50)  NOT NULL DEFAULT 'dyummy',
  environment      VARCHAR(20)  NOT NULL DEFAULT 'demo',
  kledo_account    VARCHAR(100),
  provider         VARCHAR(30)  NOT NULL DEFAULT 'kledo',
  lini             VARCHAR(20)  NOT NULL DEFAULT 'catering',
  name             VARCHAR(100) NOT NULL,
  base_url         TEXT         NOT NULL,
  token_ciphertext TEXT         NOT NULL,
  token_iv         TEXT         NOT NULL,
  token_tag        TEXT         NOT NULL,
  token_last4      VARCHAR(4),
  key_version      SMALLINT     NOT NULL DEFAULT 1,
  token_expires_at TIMESTAMPTZ,
  settings         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active        BOOLEAN      NOT NULL DEFAULT false,
  sync_enabled     BOOLEAN      NOT NULL DEFAULT false,
  go_live_date     DATE,
  last_tested_at   TIMESTAMPTZ,
  last_test_ok     BOOLEAN,
  last_test_message TEXT,
  created_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT ck_integration_env CHECK (environment IN ('demo','staging','production'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_configs_active
  ON integration_configs (tenant_code, provider, lini, environment) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_configs_account
  ON integration_configs (provider, kledo_account) WHERE kledo_account IS NOT NULL;

CREATE TABLE IF NOT EXISTS integration_mappings (
  id             BIGSERIAL PRIMARY KEY,
  config_id      BIGINT      NOT NULL REFERENCES integration_configs(id) ON DELETE RESTRICT,
  entity_type    VARCHAR(30) NOT NULL,
  local_id       BIGINT      NOT NULL,
  local_ref      VARCHAR(100),
  remote_id      BIGINT      NOT NULL,
  remote_ref     VARCHAR(100),
  payload_hash   CHAR(64),
  remote_status  VARCHAR(30),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_map_local  UNIQUE (config_id, entity_type, local_id),
  CONSTRAINT uq_map_remote UNIQUE (config_id, entity_type, remote_id)
);

CREATE TABLE IF NOT EXISTS integration_sync_jobs (
  id              BIGSERIAL PRIMARY KEY,
  config_id       BIGINT       NOT NULL REFERENCES integration_configs(id) ON DELETE RESTRICT,
  entity_type     VARCHAR(30)  NOT NULL,
  local_id        BIGINT       NOT NULL,
  action          VARCHAR(30)  NOT NULL,
  idempotency_key VARCHAR(150) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
  priority        SMALLINT     NOT NULL DEFAULT 5,
  attempts        SMALLINT     NOT NULL DEFAULT 0,
  max_attempts    SMALLINT     NOT NULL DEFAULT 6,
  run_after       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  locked_at       TIMESTAMPTZ,
  locked_by       VARCHAR(100),
  last_error      TEXT,
  blocked_reason  VARCHAR(100),
  triggered_by    VARCHAR(30),
  created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  CONSTRAINT uq_sync_job_idem UNIQUE (idempotency_key),
  CONSTRAINT ck_sync_job_status CHECK (status IN
    ('pending','processing','success','failed','blocked','dead','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_due
  ON integration_sync_jobs (run_after, priority)
  WHERE status IN ('pending','failed');

CREATE INDEX IF NOT EXISTS idx_sync_jobs_entity
  ON integration_sync_jobs (entity_type, local_id);

CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id            BIGSERIAL PRIMARY KEY,
  job_id        BIGINT REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
  config_id     BIGINT REFERENCES integration_configs(id) ON DELETE SET NULL,
  http_method   VARCHAR(10),
  url_path      TEXT,
  request_body  JSONB,
  response_code INT,
  response_body JSONB,
  duration_ms   INT,
  ratelimit_remaining INT,
  error_message TEXT,
  qstash_message_id VARCHAR(100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_job ON integration_sync_logs (job_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON integration_sync_logs (created_at);

-- orders.order_no: lpad hanya untuk id < 1000 (lpad memotong id > 999).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_no'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_no VARCHAR(20) GENERATED ALWAYS AS (
      'ORD-' || CASE WHEN id < 1000 THEN lpad(id::text, 3, '0') ELSE id::text END
    ) STORED;
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_config_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_so_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_so_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_invoice_id BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_invoice_number VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_sync_status VARCHAR(20) NOT NULL DEFAULT 'not_synced';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_last_synced_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kledo_sync_error TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_kledo_config') THEN
    ALTER TABLE orders
      ADD CONSTRAINT fk_orders_kledo_config
      FOREIGN KEY (kledo_config_id) REFERENCES integration_configs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_no ON orders (order_no);
CREATE INDEX IF NOT EXISTS idx_orders_kledo_pending
  ON orders (delivery_date)
  WHERE lini = 'catering' AND kledo_invoice_id IS NULL AND kledo_so_id IS NOT NULL;

-- VARCHAR(32): ada nomor mentah sampai 24 digit. VARCHAR(20) gagal saat kolom generated diisi.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone_normalized'
      AND character_maximum_length < 32
  ) THEN
    DROP INDEX IF EXISTS idx_customers_phone_norm;
    ALTER TABLE customers DROP COLUMN phone_normalized;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone_normalized'
  ) THEN
    ALTER TABLE customers ADD COLUMN phone_normalized VARCHAR(32) GENERATED ALWAYS AS (
      CASE
        WHEN phone IS NULL OR regexp_replace(phone, '\D', '', 'g') = '' THEN NULL
        WHEN regexp_replace(phone, '\D', '', 'g') LIKE '62%'
          THEN '0' || substr(regexp_replace(phone, '\D', '', 'g'), 3)
        WHEN regexp_replace(phone, '\D', '', 'g') LIKE '0%'
          THEN regexp_replace(phone, '\D', '', 'g')
        ELSE '0' || regexp_replace(phone, '\D', '', 'g')
      END
    ) STORED;
  END IF;
END $$;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS kledo_contact_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_customers_phone_norm ON customers (phone_normalized);
-- UNIQUE phone_normalized sengaja belum dibuat: 16 grup duplikat harus dirapikan dulu.

ALTER TABLE products ADD COLUMN IF NOT EXISTS kledo_product_id BIGINT;

COMMIT;
