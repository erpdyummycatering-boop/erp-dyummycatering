-- ================================================================
-- D'YUMMY ERP — FULL MIGRATION v4.0
-- Schema Terpadu: Catering + Siap Saji
-- ================================================================
-- SEMUA REVISI TERAKUMULASI:
--   v1 → Catering eksisting
--   v2 → Channel dinamis, Wilayah dinamis, Akuntansi terpadu, RFM MV
--   v3 → Patokan, Ongkir per zona, Rekening per order, Porsi 1/2 SKU
--         terpisah, Cover Kota Cimahi & Kab. Bandung, Rekap tabel view
--         Seed 23 order nyata (18 Jun 2026), brand name di settings
--   v4 → area_channel_shipping: tarif ongkir dinamis per area × channel
--         (hierarkis: spesifik > zona default > 0)
--         shipping_zones tetap sebagai fallback default
--         Tidak ada perubahan pada orders, order_items, views operasional
-- ================================================================
-- URUTAN EKSEKUSI:
--   1. Tabel master baru (areas, shipping_zones, channels,
--      area_channel_shipping)
--   2. ALTER tabel eksisting
--   3. Tabel akuntansi terpadu (coa, kas_bank, dll)
--   4. Tabel junction (product_channels)
--   5. Materialized View RFM
--   6. Views operasional
--   7. SEED DATA (urutan: master → transaksi → keuangan)
-- ================================================================


-- ----------------------------------------------------------------
-- BAGIAN 1: TABEL MASTER BARU
-- ----------------------------------------------------------------

-- 1A. AREAS — Master Wilayah + zona default ongkir
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS areas_id_seq;

CREATE TABLE IF NOT EXISTS "public"."areas" (
    "id"            int8         NOT NULL DEFAULT nextval('areas_id_seq'::regclass),
    "kecamatan"     varchar(100) NOT NULL,
    "kota"          varchar(100) NOT NULL,
    "provinsi"      varchar(100) NOT NULL DEFAULT 'Jawa Barat',
    "shipping_zone" varchar(30)  NOT NULL DEFAULT 'dalam_kota',
    "is_active"     boolean      NOT NULL DEFAULT true,
    "created_at"    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'areas_kecamatan_kota_key') THEN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'areas_kecamatan_kota_key') THEN
            DROP INDEX IF EXISTS areas_kecamatan_kota_key;
        END IF;
        ALTER TABLE "public"."areas" ADD CONSTRAINT areas_kecamatan_kota_key UNIQUE (kecamatan, kota);
    END IF;
END $$;

COMMENT ON COLUMN public.areas.shipping_zone IS
    'FK ke shipping_zones.zone_key — tarif default jika tidak ada baris '
    'spesifik di area_channel_shipping untuk kombinasi area × channel ini.';


-- 1B. SHIPPING_ZONES — Tarif default per zona (fallback)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."shipping_zones" (
    "zone_key"   varchar(30)   NOT NULL,
    "label"      varchar(100)  NOT NULL,
    "fee"        numeric(15,2) NOT NULL,
    "keterangan" text,
    PRIMARY KEY ("zone_key")
);

COMMENT ON TABLE public.shipping_zones IS
    'Tarif ongkir default per zona. Dipakai sebagai fallback level-2 '
    'jika tidak ada entry di area_channel_shipping untuk kombinasi '
    'area × channel tertentu.';


-- 1C. CHANNELS — Master Channel Penjualan (dinamis)
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS channels_id_seq;

CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id"           int8         NOT NULL DEFAULT nextval('channels_id_seq'::regclass),
    "name"         varchar(100) NOT NULL,
    "lini"         varchar(20)  NOT NULL DEFAULT 'siap_saji',
    "harga_type"   varchar(20)  NOT NULL DEFAULT 'normal',
    "platform_key" varchar(50),
    "is_active"    boolean      NOT NULL DEFAULT true,
    "urutan"       int4         NOT NULL DEFAULT 99,
    "created_at"   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channels_name_lini_key') THEN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'channels_name_lini_key') THEN
            DROP INDEX IF EXISTS channels_name_lini_key;
        END IF;
        ALTER TABLE "public"."channels" ADD CONSTRAINT channels_name_lini_key UNIQUE (name, lini);
    END IF;
END $$;

COMMENT ON COLUMN public.channels.harga_type IS
    'normal | marketplace — menentukan harga produk (price vs harga_override)';
COMMENT ON COLUMN public.channels.platform_key IS
    'Slug untuk API Fase-2: gojek | ahsan | shopee | tokopedia | grabfood';


-- 1D. AREA_CHANNEL_SHIPPING — Matriks Tarif Ongkir Area × Channel
--     INI ADALAH TABEL BARU UTAMA v4
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."area_channel_shipping" (
    "area_id"      int8          NOT NULL,
    "channel_id"   int8          NOT NULL,
    "shipping_fee" numeric(15,2) NOT NULL,
    "is_active"    boolean       NOT NULL DEFAULT true,
    "notes"        text,
    "created_at"   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("area_id", "channel_id")
);

COMMENT ON TABLE public.area_channel_shipping IS
    'Tarif ongkir spesifik per kombinasi area × channel. '
    'Level prioritas tertinggi dalam hierarki lookup ongkir: '
    '1. area_channel_shipping (spesifik) '
    '2. shipping_zones via areas.shipping_zone (zona default) '
    '3. 0 (fallback akhir). '
    'Tidak perlu mengisi semua kombinasi — hanya yang berbeda dari default zona.';

COMMENT ON COLUMN public.area_channel_shipping.notes IS
    'Keterangan, misal: "Marketplace gratis ongkir", "Ahsan flat 15k semua area"';


-- ----------------------------------------------------------------
-- BAGIAN 2: ALTER TABEL EKSISTING
-- ----------------------------------------------------------------

-- 2A. products
-- ----------------------------------------------------------------
ALTER TABLE "public"."products"
    ADD COLUMN IF NOT EXISTS "sku"               varchar(50),
    ADD COLUMN IF NOT EXISTS "lini"              varchar(20)   NOT NULL DEFAULT 'catering',
    ADD COLUMN IF NOT EXISTS "harga_marketplace" numeric(15,2),
    ADD COLUMN IF NOT EXISTS "is_half_portion"   boolean       NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "parent_sku"        varchar(50);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_sku_key') THEN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'products_sku_key') THEN
            DROP INDEX IF EXISTS products_sku_key;
        END IF;
        ALTER TABLE "public"."products" ADD CONSTRAINT products_sku_key UNIQUE (sku);
    END IF;
END $$;

COMMENT ON COLUMN public.products.is_half_portion IS
    'true = produk ini varian 1/2 porsi — SKU terpisah, harga berbeda';
COMMENT ON COLUMN public.products.parent_sku IS
    'SKU produk porsi penuh. Diisi jika is_half_portion = true.';


-- 2B. customers
-- ----------------------------------------------------------------
ALTER TABLE "public"."customers"
    ADD COLUMN IF NOT EXISTS "area_id" int8,
    ADD COLUMN IF NOT EXISTS "patokan" text,
    ADD COLUMN IF NOT EXISTS "lini"    varchar(20) NOT NULL DEFAULT 'catering';

COMMENT ON COLUMN public.customers.patokan IS
    'Landmark/patokan lokasi untuk kurir. Terpisah dari address. '
    'Contoh: "Dekat RS Harapan Bunda, depan puskesmas ada gerbang"';
COMMENT ON COLUMN public.customers.area_id IS
    'FK ke areas.id. Wajib untuk SS. Dipakai lookup ongkir otomatis.';


-- 2C. orders
-- ----------------------------------------------------------------
ALTER TABLE "public"."orders"
    ADD COLUMN IF NOT EXISTS "lini"            varchar(20)  NOT NULL DEFAULT 'catering',
    ADD COLUMN IF NOT EXISTS "channel_id"      int8,
    ADD COLUMN IF NOT EXISTS "no_struk"        varchar(30),
    ADD COLUMN IF NOT EXISTS "input_source"    varchar(30)  NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS "platform_ref"    varchar(100),
    ADD COLUMN IF NOT EXISTS "shipping_zone"   varchar(30),
    ADD COLUMN IF NOT EXISTS "payment_bank"    varchar(50),
    ADD COLUMN IF NOT EXISTS "payment_account" varchar(50),
    ADD COLUMN IF NOT EXISTS "cancel_reason"   text,
    ADD COLUMN IF NOT EXISTS "cancelled_by"    int8,
    ADD COLUMN IF NOT EXISTS "cancelled_at"    timestamp,
    ADD COLUMN IF NOT EXISTS "journal_id"      int8;

CREATE UNIQUE INDEX IF NOT EXISTS orders_no_struk_key
    ON public.orders (no_struk) WHERE no_struk IS NOT NULL;

COMMENT ON COLUMN public.orders.shipping_zone IS
    'Snapshot zona saat order dibuat (dari areas.shipping_zone). '
    'shipping_fee = nilai aktual yang berlaku saat itu.';
COMMENT ON COLUMN public.orders.payment_bank IS
    'BCA | Mandiri — rekening tujuan pembayaran customer';
COMMENT ON COLUMN public.orders.payment_account IS
    'Nomor rekening: 2832835545 | 1310017802705';


-- 2D. overheads
-- ----------------------------------------------------------------
ALTER TABLE "public"."overheads"
    ADD COLUMN IF NOT EXISTS "lini" varchar(20) NOT NULL DEFAULT 'catering';


-- ----------------------------------------------------------------
-- BAGIAN 3: TABEL AKUNTANSI TERPADU
-- ----------------------------------------------------------------

-- 3A. COA
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS coa_id_seq;

CREATE TABLE IF NOT EXISTS "public"."coa" (
    "id"           int8         NOT NULL DEFAULT nextval('coa_id_seq'::regclass),
    "lini"         varchar(20)  NOT NULL DEFAULT 'siap_saji',
    "kode_akun"    varchar(20)  NOT NULL,
    "nama_akun"    varchar(150) NOT NULL,
    "kelompok"     varchar(50)  NOT NULL,
    "sub_kelompok" varchar(100),
    "is_active"    boolean      NOT NULL DEFAULT true,
    "created_at"   timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coa_lini_kode_key') THEN
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'coa_lini_kode_key') THEN
            DROP INDEX IF EXISTS coa_lini_kode_key;
        END IF;
        ALTER TABLE "public"."coa" ADD CONSTRAINT coa_lini_kode_key UNIQUE (lini, kode_akun);
    END IF;
END $$;

COMMENT ON COLUMN public.coa.kelompok IS
    'Aset | Liabilitas | Ekuitas | Pendapatan | Beban';
COMMENT ON COLUMN public.coa.lini IS
    'siap_saji | catering. Kode akun boleh sama antar lini (unique per lini+kode).';


-- 3B. KAS_BANK
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS kas_bank_id_seq;

CREATE TABLE IF NOT EXISTS "public"."kas_bank" (
    "id"                 int8          NOT NULL DEFAULT nextval('kas_bank_id_seq'::regclass),
    "lini"               varchar(20)   NOT NULL DEFAULT 'siap_saji',
    "nama_rekening"      varchar(150)  NOT NULL,
    "jenis"              varchar(20)   NOT NULL DEFAULT 'Bank',
    "no_rekening"        varchar(50),
    "nama_bank"          varchar(100),
    "saldo_awal"         numeric(15,2) NOT NULL DEFAULT 0,
    "saldo_kini"         numeric(15,2) NOT NULL DEFAULT 0,
    "is_active"          boolean       NOT NULL DEFAULT true,
    "is_payment_default" boolean       NOT NULL DEFAULT false,
    "created_at"         timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

COMMENT ON COLUMN public.kas_bank.is_payment_default IS
    'true = rekening ini muncul sebagai default di form order baru';


-- 3C. KAS_MUTASI
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS kas_mutasi_id_seq;

CREATE TABLE IF NOT EXISTS "public"."kas_mutasi" (
    "id"          int8          NOT NULL DEFAULT nextval('kas_mutasi_id_seq'::regclass),
    "kas_bank_id" int8          NOT NULL,
    "lini"        varchar(20)   NOT NULL DEFAULT 'siap_saji',
    "mutasi_date" date          NOT NULL,
    "jenis"       varchar(20)   NOT NULL,
    "nominal"     numeric(15,2) NOT NULL,
    "ref_type"    varchar(30),
    "ref_id"      int8,
    "keterangan"  text,
    "created_at"  timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

COMMENT ON COLUMN public.kas_mutasi.jenis IS 'Masuk | Keluar';
COMMENT ON COLUMN public.kas_mutasi.ref_type IS
    'penjualan | pembelian | biaya | modal | lainnya';


-- 3D. PURCHASES
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS purchases_id_seq;

CREATE TABLE IF NOT EXISTS "public"."purchases" (
    "id"             int8          NOT NULL DEFAULT nextval('purchases_id_seq'::regclass),
    "lini"           varchar(20)   NOT NULL DEFAULT 'siap_saji',
    "ref_type"       varchar(30)   NOT NULL DEFAULT 'pembelian_nota',
    "catering_po_id" int8,
    "finance_id"     int8,
    "purchase_date"  date          NOT NULL,
    "nota_ref"       varchar(100),
    "keterangan"     text          NOT NULL,
    "total_amount"   numeric(15,2) NOT NULL,
    "coa_id"         int8,
    "kas_bank_id"    int8,
    "status"         varchar(30)   NOT NULL DEFAULT 'Final',
    "created_at"     timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

COMMENT ON COLUMN public.purchases.ref_type IS
    'pembelian_nota (SS, dari nota langsung) | realisasi_po (Catering Fase-2, dari PO)';


-- 3E. JOURNALS
-- ----------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS journals_id_seq;

CREATE TABLE IF NOT EXISTS "public"."journals" (
    "id"           int8          NOT NULL DEFAULT nextval('journals_id_seq'::regclass),
    "lini"         varchar(20)   NOT NULL DEFAULT 'siap_saji',
    "journal_date" date          NOT NULL,
    "ref_type"     varchar(30)   NOT NULL,
    "ref_id"       int8          NOT NULL,
    "ref_no"       varchar(50),
    "akun_debit"   int8          NOT NULL,
    "akun_kredit"  int8          NOT NULL,
    "nominal"      numeric(15,2) NOT NULL,
    "keterangan"   text,
    "created_at"   timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

COMMENT ON COLUMN public.journals.ref_type IS
    'penjualan | pembelian | biaya | modal | koreksi';
COMMENT ON COLUMN public.journals.lini IS
    'siap_saji | catering — untuk filter P&L & Neraca per lini';


-- ----------------------------------------------------------------
-- BAGIAN 4: TABEL JUNCTION & PENDUKUNG
-- ----------------------------------------------------------------

-- 4A. PRODUCT_CHANNELS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."product_channels" (
    "product_id"     int8          NOT NULL,
    "channel_id"     int8          NOT NULL,
    "harga_override" numeric(15,2),
    "is_active"      boolean       NOT NULL DEFAULT true,
    "created_at"     timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("product_id", "channel_id")
);

COMMENT ON COLUMN public.product_channels.harga_override IS
    'NULL = pakai products.price. Diisi untuk channel marketplace.';


-- 4B. SETTINGS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."settings" (
    "key"        varchar(100) NOT NULL,
    "value"      text,
    "updated_at" timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("key")
);

COMMENT ON TABLE public.settings IS
    'Key-value config: counter struk per bulan, brand name, RFM status, dll.';


-- ----------------------------------------------------------------
-- ----------------------------------------------------------------
-- BAGIAN 5: FOREIGN KEYS
-- ----------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customers_area') THEN
        ALTER TABLE "public"."customers" ADD CONSTRAINT fk_customers_area FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_channel') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_channel FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_cancelled_by') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_cancelled_by FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_journal') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_journal FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pc_product') THEN
        ALTER TABLE "public"."product_channels" ADD CONSTRAINT fk_pc_product FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pc_channel') THEN
        ALTER TABLE "public"."product_channels" ADD CONSTRAINT fk_pc_channel FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_acs_area') THEN
        ALTER TABLE "public"."area_channel_shipping" ADD CONSTRAINT fk_acs_area FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_acs_channel') THEN
        ALTER TABLE "public"."area_channel_shipping" ADD CONSTRAINT fk_acs_channel FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journals_debit') THEN
        ALTER TABLE "public"."journals" ADD CONSTRAINT fk_journals_debit FOREIGN KEY ("akun_debit") REFERENCES "public"."coa"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journals_kredit') THEN
        ALTER TABLE "public"."journals" ADD CONSTRAINT fk_journals_kredit FOREIGN KEY ("akun_kredit") REFERENCES "public"."coa"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_kas_mutasi_bank') THEN
        ALTER TABLE "public"."kas_mutasi" ADD CONSTRAINT fk_kas_mutasi_bank FOREIGN KEY ("kas_bank_id") REFERENCES "public"."kas_bank"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_coa') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_coa FOREIGN KEY ("coa_id") REFERENCES "public"."coa"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_kas') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_kas FOREIGN KEY ("kas_bank_id") REFERENCES "public"."kas_bank"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_finance') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_finance FOREIGN KEY ("finance_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_po') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_po FOREIGN KEY ("catering_po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;
    END IF;
END $$;


-- ----------------------------------------------------------------
-- BAGIAN 6: INDEX PERFORMA
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_lini_date
    ON public.orders (lini, delivery_date)
    WHERE status_order <> 'Dibatalkan';

CREATE INDEX IF NOT EXISTS idx_orders_no_struk
    ON public.orders (no_struk) WHERE no_struk IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_channel
    ON public.orders (channel_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone
    ON public.customers (phone);

CREATE INDEX IF NOT EXISTS idx_customers_area
    ON public.customers (area_id);

CREATE INDEX IF NOT EXISTS idx_customers_lini
    ON public.customers (lini);

CREATE INDEX IF NOT EXISTS idx_products_lini
    ON public.products (lini, status);

CREATE INDEX IF NOT EXISTS idx_products_sku
    ON public.products (sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product
    ON public.order_items (product_id);

CREATE INDEX IF NOT EXISTS idx_journals_lini_date
    ON public.journals (lini, journal_date);

CREATE INDEX IF NOT EXISTS idx_kas_mutasi_bank_date
    ON public.kas_mutasi (kas_bank_id, mutasi_date);

CREATE INDEX IF NOT EXISTS idx_purchases_lini_date
    ON public.purchases (lini, purchase_date);

-- Index untuk lookup ongkir
CREATE INDEX IF NOT EXISTS idx_acs_channel
    ON public.area_channel_shipping (channel_id);

CREATE INDEX IF NOT EXISTS idx_acs_area
    ON public.area_channel_shipping (area_id);


-- ================================================================
-- BAGIAN 7: FUNCTION LOOKUP ONGKIR (hierarkis)
-- ================================================================
-- Dipanggil dari aplikasi atau langsung saat butuh fee:
--   SELECT get_shipping_fee(:area_id, :channel_id);
-- Hierarki:
--   1. area_channel_shipping spesifik (area × channel)
--   2. shipping_zones default (via areas.shipping_zone)
--   3. 0 (fallback akhir)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_shipping_fee(
    p_area_id    int8,
    p_channel_id int8
) RETURNS numeric AS $$
DECLARE
    v_fee numeric;
BEGIN
    -- Level 1: Spesifik area × channel
    SELECT acs.shipping_fee INTO v_fee
    FROM public.area_channel_shipping acs
    WHERE acs.area_id    = p_area_id
      AND acs.channel_id = p_channel_id
      AND acs.is_active  = true
    LIMIT 1;

    IF v_fee IS NOT NULL THEN
        RETURN v_fee;
    END IF;

    -- Level 2: Default zona (shipping_zones via areas)
    SELECT sz.fee INTO v_fee
    FROM public.areas a
    JOIN public.shipping_zones sz ON sz.zone_key = a.shipping_zone
    WHERE a.id = p_area_id
    LIMIT 1;

    IF v_fee IS NOT NULL THEN
        RETURN v_fee;
    END IF;

    -- Level 3: Fallback akhir
    RETURN 0;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_shipping_fee IS
    'Lookup tarif ongkir hierarkis: '
    '1=area_channel_shipping spesifik, 2=zona default, 3=0. '
    'Dipanggil saat form order baru setelah pilih area & channel.';


-- ================================================================
-- BAGIAN 8: MATERIALIZED VIEW — RFM SCORES
-- Refresh: Vercel Cron 01:30 WIB (18:30 UTC) → /api/cron/rfm-refresh
-- ================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS "public"."rfm_scores" AS
WITH base AS (
    SELECT
        c.id                                              AS customer_id,
        c.name                                            AS nama,
        c.phone,
        a.kecamatan,
        a.kota,
        a.shipping_zone,
        CURRENT_DATE - MAX(o.order_date)::date            AS recency_days,
        COUNT(o.id)                                       AS frequency,
        COALESCE(SUM(o.grand_total), 0)                   AS monetary,
        MAX(o.order_date)                                 AS last_order_date,
        MIN(o.order_date)                                 AS first_order_date,
        MODE() WITHIN GROUP (ORDER BY ch.name)            AS channel_favorit
    FROM public.customers c
    JOIN public.orders o      ON o.customer_id = c.id
    LEFT JOIN public.areas a   ON a.id = c.area_id
    LEFT JOIN public.channels ch ON ch.id = o.channel_id
    WHERE c.lini IN ('siap_saji','keduanya')
      AND o.lini = 'siap_saji'
      AND o.status_order <> 'Dibatalkan'
    GROUP BY c.id, c.name, c.phone, a.kecamatan, a.kota, a.shipping_zone
),
scored AS (
    SELECT *,
        6 - NTILE(5) OVER (ORDER BY recency_days ASC)    AS r_score,
        NTILE(5) OVER (ORDER BY frequency ASC)            AS f_score,
        NTILE(5) OVER (ORDER BY monetary ASC)             AS m_score
    FROM base
),
segmented AS (
    SELECT *,
        (r_score + f_score + m_score)                     AS rfm_total,
        CASE
            WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4   THEN 'Champions'
            WHEN f_score >= 4 AND (r_score + m_score) >= 6        THEN 'Loyal Customers'
            WHEN r_score >= 4 AND f_score <= 2 AND m_score <= 2   THEN 'New Customers'
            WHEN r_score <= 2 AND (f_score >= 3 OR m_score >= 3)  THEN 'At Risk'
            WHEN r_score <= 2 AND f_score <= 2 AND m_score <= 2   THEN 'Dormant'
            ELSE 'Potential Loyalist'
        END                                               AS segmen
    FROM scored
)
SELECT
    customer_id, nama, phone, kecamatan, kota, shipping_zone,
    recency_days, frequency, monetary,
    last_order_date, first_order_date, channel_favorit,
    r_score, f_score, m_score, rfm_total, segmen,
    NOW() AS refreshed_at
FROM segmented
ORDER BY rfm_total DESC, monetary DESC;

CREATE UNIQUE INDEX IF NOT EXISTS rfm_scores_customer_id_key
    ON public.rfm_scores (customer_id);

COMMENT ON MATERIALIZED VIEW public.rfm_scores IS
    'Skor RFM per customer SS. Refresh harian 01:30 WIB via Vercel Cron. '
    'Quintile NTILE(5) dinamis — tidak ada hardcode threshold.';


-- ================================================================
-- BAGIAN 9: VIEWS OPERASIONAL
-- ================================================================

-- 9A. Lookup ongkir per area × channel (untuk UI Master Shipping)
CREATE OR REPLACE VIEW "public"."v_shipping_matrix" AS
SELECT
    a.id                                              AS area_id,
    a.kecamatan,
    a.kota,
    a.shipping_zone,
    sz.label                                          AS zone_label,
    sz.fee                                            AS fee_default,
    ch.id                                             AS channel_id,
    ch.name                                           AS channel_name,
    acs.shipping_fee                                  AS fee_override,
    COALESCE(acs.shipping_fee, sz.fee, 0)             AS fee_efektif,
    CASE WHEN acs.shipping_fee IS NOT NULL
         THEN 'spesifik' ELSE 'zona_default' END      AS sumber_fee,
    acs.notes
FROM public.areas a
JOIN public.shipping_zones sz ON sz.zone_key = a.shipping_zone
CROSS JOIN public.channels ch
LEFT JOIN public.area_channel_shipping acs
    ON acs.area_id = a.id AND acs.channel_id = ch.id AND acs.is_active = true
WHERE a.is_active = true AND ch.is_active = true AND ch.lini = 'siap_saji'
ORDER BY a.shipping_zone, a.kota, a.kecamatan, ch.urutan;

COMMENT ON VIEW public.v_shipping_matrix IS
    'Matriks lengkap ongkir per area × channel. '
    'fee_efektif = nilai yang dipakai form order. '
    'sumber_fee: spesifik (dari acs) | zona_default (dari shipping_zones).';


-- 9B. Laporan Penjualan Harian → Produksi
CREATE OR REPLACE VIEW "public"."v_laporan_harian_ss" AS
SELECT
    o.delivery_date                                   AS tanggal,
    ch.name                                           AS channel,
    p.sku,
    p.name                                            AS nama_barang,
    p.is_half_portion,
    SUM(oi.quantity)                                  AS total_qty,
    STRING_AGG(DISTINCT oi.notes, '; ' ORDER BY oi.notes)
        FILTER (WHERE oi.notes IS NOT NULL AND oi.notes <> '') AS notes_gabungan
FROM public.orders o
JOIN public.order_items oi  ON oi.order_id = o.id
JOIN public.products p      ON p.id = oi.product_id
LEFT JOIN public.channels ch ON ch.id = o.channel_id
WHERE o.lini = 'siap_saji'
  AND o.status_order <> 'Dibatalkan'
GROUP BY o.delivery_date, ch.name, p.sku, p.name, p.is_half_portion
ORDER BY o.delivery_date, ch.name, p.is_half_portion, p.name;

COMMENT ON VIEW public.v_laporan_harian_ss IS
    'Rekap qty per produk per hari — input untuk produksi dapur. '
    'Porsi 1/2 (is_half_portion=true) tampil terpisah di bawah porsi penuh.';


-- 9C. Daftar Order → Pengiriman
CREATE OR REPLACE VIEW "public"."v_daftar_order_ss" AS
SELECT
    o.delivery_date                                   AS tanggal,
    ch.name                                           AS channel,
    o.no_struk,
    c.name                                            AS nama_customer,
    c.phone                                           AS no_hp,
    a.kecamatan,
    a.kota,
    a.shipping_zone,
    c.address                                         AS alamat,
    c.patokan,
    STRING_AGG(
        p.name || ' (x' || oi.quantity || ')',
        ', ' ORDER BY p.name
    )                                                 AS daftar_order,
    o.shipping_fee,
    o.grand_total,
    o.payment_bank,
    o.status_payment
FROM public.orders o
JOIN public.customers c     ON c.id = o.customer_id
JOIN public.order_items oi  ON oi.order_id = o.id
JOIN public.products p      ON p.id = oi.product_id
LEFT JOIN public.channels ch ON ch.id = o.channel_id
LEFT JOIN public.areas a    ON a.id = c.area_id
WHERE o.lini = 'siap_saji'
  AND o.status_order <> 'Dibatalkan'
GROUP BY
    o.delivery_date, ch.name, o.no_struk, o.shipping_fee,
    o.grand_total, o.payment_bank, o.status_payment,
    c.name, c.phone, a.kecamatan, a.kota, a.shipping_zone,
    c.address, c.patokan
ORDER BY
    o.delivery_date,
    ch.name,
    CASE a.shipping_zone WHEN 'dalam_kota' THEN 1 ELSE 2 END,
    a.kota,
    a.kecamatan,
    c.name;

COMMENT ON VIEW public.v_daftar_order_ss IS
    'Daftar order per customer untuk pengiriman. '
    'Patokan ditampilkan terpisah. Urut: channel → zona → kecamatan.';


-- 9D. Rekap Tabel Harian → CS (pengganti sheet manual)
CREATE OR REPLACE VIEW "public"."v_rekap_harian_ss" AS
SELECT
    o.delivery_date                      AS tanggal,
    c.name                               AS pelanggan,
    (o.grand_total - o.shipping_fee)     AS penjualan,
    o.shipping_fee                       AS ongkir,
    o.grand_total                        AS total,
    o.payment_bank                       AS bank,
    o.payment_account                    AS no_rekening,
    o.status_payment                     AS status,
    ch.name                              AS channel,
    a.kecamatan
FROM public.orders o
JOIN public.customers c     ON c.id = o.customer_id
LEFT JOIN public.channels ch ON ch.id = o.channel_id
LEFT JOIN public.areas a    ON a.id = c.area_id
WHERE o.lini = 'siap_saji'
  AND o.status_order <> 'Dibatalkan'
ORDER BY o.delivery_date, ch.name, c.name;

COMMENT ON VIEW public.v_rekap_harian_ss IS
    'Format rekap tabel manual CS: Pelanggan | Penjualan | Ongkir | '
    'Rekening | Status. Kolom ongkir sudah termasuk dalam total.';


-- 9E. P&L per lini per bulan
CREATE OR REPLACE VIEW "public"."v_pl_summary" AS
SELECT
    j.lini,
    DATE_TRUNC('month', j.journal_date)  AS bulan,
    SUM(CASE WHEN c.kelompok = 'Pendapatan' THEN j.nominal ELSE 0 END)  AS pendapatan,
    SUM(CASE WHEN c.kelompok = 'Beban'
              AND c.sub_kelompok = 'Beban Pokok Penjualan'
             THEN j.nominal ELSE 0 END)                                  AS hpp,
    SUM(CASE WHEN c.kelompok = 'Beban'
              AND c.sub_kelompok = 'Beban Operasional'
             THEN j.nominal ELSE 0 END)                                  AS biaya_operasional,
    SUM(CASE WHEN c.kelompok = 'Pendapatan' THEN j.nominal ELSE 0 END)
    - SUM(CASE WHEN c.kelompok = 'Beban' THEN j.nominal ELSE 0 END)     AS laba_bersih
FROM public.journals j
JOIN public.coa c ON c.id = j.akun_debit
GROUP BY j.lini, DATE_TRUNC('month', j.journal_date)
ORDER BY j.lini, bulan;


-- 9F. Neraca Saldo (Trial Balance)
CREATE OR REPLACE VIEW "public"."v_neraca_saldo" AS
SELECT
    j.lini,
    c.kode_akun,
    c.nama_akun,
    c.kelompok,
    c.sub_kelompok,
    SUM(CASE WHEN j.akun_debit  = c.id THEN j.nominal ELSE 0 END) AS total_debit,
    SUM(CASE WHEN j.akun_kredit = c.id THEN j.nominal ELSE 0 END) AS total_kredit,
    SUM(CASE WHEN j.akun_debit  = c.id THEN j.nominal ELSE 0 END)
    - SUM(CASE WHEN j.akun_kredit = c.id THEN j.nominal ELSE 0 END) AS saldo
FROM public.journals j
JOIN public.coa c ON c.id = j.akun_debit OR c.id = j.akun_kredit
GROUP BY j.lini, c.id, c.kode_akun, c.nama_akun, c.kelompok, c.sub_kelompok
ORDER BY j.lini, c.kode_akun;


-- ================================================================
-- BAGIAN 10: SEED DATA
-- ================================================================


-- ----------------------------------------------------------------
-- S1. SETTINGS
-- ----------------------------------------------------------------
INSERT INTO "public"."settings" ("key", "value") VALUES
    ('ss_struk_counter_2026_06',  '266'),
    ('ss_struk_counter_2026_08',  '9'),
    ('brand_name_struk',          'DYummy Catering'),
    ('brand_address_struk',       'Jl Sindangsari 4 No 48, Kota Bandung Jawa Barat'),
    ('rfm_last_refresh',          NULL),
    ('rfm_refresh_status',        'idle'),
    ('app_version',               '4.0.0')
ON CONFLICT ("key") DO NOTHING;


-- ----------------------------------------------------------------
-- S2. SHIPPING ZONES — tarif default per zona (fallback level-2)
-- ----------------------------------------------------------------
INSERT INTO "public"."shipping_zones" ("zone_key", "label", "fee", "keterangan") VALUES
    ('dalam_kota', 'Dalam Kota Bandung',               12000, 'Kecamatan dalam Kota Bandung'),
    ('luar_kota',  'Luar Kota (Cimahi/Kab. Bandung)',  14000, 'Kota Cimahi, Kab. Bandung')
ON CONFLICT ("zone_key") DO NOTHING;


-- ----------------------------------------------------------------
-- S3. AREAS — Kota Bandung + Kota Cimahi + Kab. Bandung
-- ----------------------------------------------------------------
INSERT INTO "public"."areas" ("kecamatan", "kota", "provinsi", "shipping_zone") VALUES
    -- KOTA BANDUNG — dalam_kota (Rp12.000 default)
    ('Arcamanik',            'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Antapani',             'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Astanaanyar',          'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Babakan Ciparay',      'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Batununggal',          'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Bojongloa Kaler',      'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Buahbatu',             'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Cibeunying Kaler',     'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Cibeunying Kidul',     'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Cicendo',              'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Cidadap',              'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Cinambo',              'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Coblong',              'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Gedebage',             'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Kiaracondong',         'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Lengkong',             'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Mandalajati',          'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Panyileukan',          'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Rancasari',            'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Regol',                'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Sukajadi',             'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Sukamiskin',           'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    ('Ujungberung',          'Kota Bandung',      'Jawa Barat', 'dalam_kota'),
    -- KOTA CIMAHI — luar_kota (Rp14.000 default)
    ('Cimahi Utara',         'Kota Cimahi',       'Jawa Barat', 'luar_kota'),
    ('Cimahi Tengah',        'Kota Cimahi',       'Jawa Barat', 'luar_kota'),
    ('Cimahi Selatan',       'Kota Cimahi',       'Jawa Barat', 'luar_kota'),
    -- KABUPATEN BANDUNG — luar_kota (Rp14.000 default)
    ('Bojongsoang',          'Kabupaten Bandung', 'Jawa Barat', 'luar_kota'),
    ('Cileunyi',             'Kabupaten Bandung', 'Jawa Barat', 'luar_kota'),
    ('Cimenyan',             'Kabupaten Bandung', 'Jawa Barat', 'luar_kota'),
    ('Cipagalo',             'Kabupaten Bandung', 'Jawa Barat', 'luar_kota'),
    ('Margahayu',            'Kabupaten Bandung', 'Jawa Barat', 'luar_kota'),
    ('Rancaekek',            'Kabupaten Bandung', 'Jawa Barat', 'luar_kota')
ON CONFLICT (kecamatan, kota) DO NOTHING;


-- ----------------------------------------------------------------
-- S4. CHANNELS
-- ----------------------------------------------------------------
INSERT INTO "public"."channels"
    ("name", "lini", "harga_type", "platform_key", "is_active", "urutan")
VALUES
    ('Gojek Offline',   'siap_saji', 'normal',      'gojek',       true, 1),
    ('Ahsan',           'siap_saji', 'normal',      'ahsan',       true, 2),
    ('Marketplace',     'siap_saji', 'marketplace', 'marketplace', true, 3),
    ('Walk-in',         'siap_saji', 'normal',       NULL,          true, 4),
    ('WhatsApp Direct', 'siap_saji', 'normal',       NULL,          true, 5)
ON CONFLICT (name, lini) DO NOTHING;


-- ----------------------------------------------------------------
-- S5. AREA_CHANNEL_SHIPPING — Matriks tarif ongkir spesifik
--     Menggunakan DO block karena butuh lookup ID area & channel
-- ----------------------------------------------------------------
DO $$
DECLARE
    ch_gojek  int8; ch_ahsan   int8; ch_market int8;
    ch_walkin int8; ch_wa      int8;
    rec       RECORD;
BEGIN
    SELECT id INTO ch_gojek  FROM public.channels WHERE name='Gojek Offline'   AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_ahsan  FROM public.channels WHERE name='Ahsan'           AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_market FROM public.channels WHERE name='Marketplace'     AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_walkin FROM public.channels WHERE name='Walk-in'         AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_wa     FROM public.channels WHERE name='WhatsApp Direct' AND lini='siap_saji' LIMIT 1;

    -- ============================================================
    -- MARKETPLACE: SEMUA AREA GRATIS (Rp0)
    -- Override zona default untuk seluruh area
    -- ============================================================
    FOR rec IN SELECT id FROM public.areas WHERE is_active = true LOOP
        INSERT INTO public.area_channel_shipping
            (area_id, channel_id, shipping_fee, notes)
        VALUES
            (rec.id, ch_market, 0, 'Marketplace gratis ongkir — ongkir ditanggung platform')
        ON CONFLICT (area_id, channel_id) DO NOTHING;
    END LOOP;

    -- ============================================================
    -- AHSAN: FLAT Rp15.000 semua area (berbeda dari Gojek)
    -- ============================================================
    FOR rec IN SELECT id FROM public.areas WHERE is_active = true LOOP
        INSERT INTO public.area_channel_shipping
            (area_id, channel_id, shipping_fee, notes)
        VALUES
            (rec.id, ch_ahsan, 15000, 'Ahsan flat Rp15.000 semua area')
        ON CONFLICT (area_id, channel_id) DO NOTHING;
    END LOOP;

    -- ============================================================
    -- WALK-IN: Rp0 (datang langsung, tidak ada ongkir)
    -- ============================================================
    FOR rec IN SELECT id FROM public.areas WHERE is_active = true LOOP
        INSERT INTO public.area_channel_shipping
            (area_id, channel_id, shipping_fee, notes)
        VALUES
            (rec.id, ch_walkin, 0, 'Walk-in tidak ada biaya kirim')
        ON CONFLICT (area_id, channel_id) DO NOTHING;
    END LOOP;

    -- ============================================================
    -- WHATSAPP DIRECT: sama dengan Gojek (ikut zona default)
    -- Tidak perlu insert — pakai fallback shipping_zones
    -- ============================================================
    -- (tidak ada INSERT untuk WhatsApp × semua area)

    -- ============================================================
    -- GOJEK OFFLINE: ikut zona default (shipping_zones)
    -- Kecuali kecamatan yang perlu override spesifik:
    -- Cimenyan (Kab. Bandung) → Rp16.000 karena akses susah
    -- Cileunyi → Rp13.000 (negosiasi khusus driver)
    -- ============================================================
    INSERT INTO public.area_channel_shipping
        (area_id, channel_id, shipping_fee, notes)
    SELECT a.id, ch_gojek, 16000, 'Cimenyan akses susah — override dari zona default 14k'
    FROM public.areas a
    WHERE a.kecamatan = 'Cimenyan' AND a.kota = 'Kabupaten Bandung'
    ON CONFLICT (area_id, channel_id) DO NOTHING;

    INSERT INTO public.area_channel_shipping
        (area_id, channel_id, shipping_fee, notes)
    SELECT a.id, ch_gojek, 13000, 'Cileunyi — negosiasi khusus driver Rp13.000'
    FROM public.areas a
    WHERE a.kecamatan = 'Cileunyi' AND a.kota = 'Kabupaten Bandung'
    ON CONFLICT (area_id, channel_id) DO NOTHING;

END $$;


-- ----------------------------------------------------------------
-- S6. USERS
-- ----------------------------------------------------------------
INSERT INTO "public"."users" ("name", "email", "role", "status") VALUES
    ('Wanti Nova',     'wanti@dyummy.com',    'CS_SS',       'Aktif'),
    ('Dewi Anggraini', 'dewi.ss@dyummy.com',  'CS_SS',       'Aktif'),
    ('Nisa Keuangan',  'nisa.keu@dyummy.com', 'Keuangan_SS', 'Aktif')
ON CONFLICT (email) DO NOTHING;


-- ----------------------------------------------------------------
-- S7. PRODUCT CATEGORIES
-- ----------------------------------------------------------------
INSERT INTO "public"."product_categories" ("name") VALUES
    ('Lauk Ayam'),
    ('Lauk Daging'),
    ('Lauk Ikan & Seafood'),
    ('Lauk Telur'),
    ('Sayuran & Tumisan'),
    ('Sup & Kuah'),
    ('Mie & Nasi Goreng')
ON CONFLICT (name) DO NOTHING;


-- ----------------------------------------------------------------
-- S8. PRODUCTS — SKU nyata dari nota PDF + varian 1/2 porsi
-- ----------------------------------------------------------------
DO $$
DECLARE
    cat_ayam    int8; cat_daging  int8; cat_ikan   int8;
    cat_telur   int8; cat_sayur   int8; cat_sup    int8;
    cat_mie     int8;
BEGIN
    SELECT id INTO cat_ayam   FROM public.product_categories WHERE name='Lauk Ayam'           LIMIT 1;
    SELECT id INTO cat_daging FROM public.product_categories WHERE name='Lauk Daging'         LIMIT 1;
    SELECT id INTO cat_ikan   FROM public.product_categories WHERE name='Lauk Ikan & Seafood' LIMIT 1;
    SELECT id INTO cat_telur  FROM public.product_categories WHERE name='Lauk Telur'          LIMIT 1;
    SELECT id INTO cat_sayur  FROM public.product_categories WHERE name='Sayuran & Tumisan'   LIMIT 1;
    SELECT id INTO cat_sup    FROM public.product_categories WHERE name='Sup & Kuah'          LIMIT 1;
    SELECT id INTO cat_mie    FROM public.product_categories WHERE name='Mie & Nasi Goreng'   LIMIT 1;

    -- PORSI PENUH
    INSERT INTO public.products
        (sku, name, category_id, description, price, lini, status, is_half_portion)
    VALUES
        ('SP-A01','Ayam Goreng Terasi Jeruk',    cat_ayam,  'Ayam goreng bumbu terasi jeruk, porsi penuh',     100000,'siap_saji','Aktif',false),
        ('SP-D01','Beef Yakiniku',               cat_daging,'Daging sapi yakiniku saus teriyaki',              100000,'siap_saji','Aktif',false),
        ('SP-D02','Rendang Daging',              cat_daging,'Rendang daging sapi khas Padang',                  75000,'siap_saji','Aktif',false),
        ('SP-D03','Beef Teriyaki',               cat_daging,'Daging sapi saus teriyaki Jepang',                 85000,'siap_saji','Aktif',false),
        ('SP-I01','Udang Bakar Saus Jimbaran',   cat_ikan,  'Udang segar bakar saus Jimbaran',                100000,'siap_saji','Aktif',false),
        ('SP-I02','Bandeng Isi',                 cat_ikan,  'Bandeng presto diisi bumbu rempah',                65000,'siap_saji','Aktif',false),
        ('SP-I03','Dori Asam Manis',             cat_ikan,  'Ikan dori fillet saus asam manis',                 45000,'siap_saji','Aktif',false),
        ('SP-T01','Telur Ceplok Saus Tiram',     cat_telur, 'Telur mata sapi saus tiram & cabai hijau',         50000,'siap_saji','Aktif',false),
        ('SP-T02','Semur Jengkol',               cat_telur, 'Semur jengkol bumbu hitam manis',                  50000,'siap_saji','Aktif',false),
        ('SP-S01','Terong Balado',               cat_sayur, 'Terong goreng saus balado merah',                  35000,'siap_saji','Aktif',false),
        ('SP-S02','Capcay',                      cat_sayur, 'Capcay kuah campur sayur segar',                   35000,'siap_saji','Aktif',false),
        ('SP-S03','Puyunghai',                   cat_sayur, 'Telur dadar Puyunghai saus asam manis',            35000,'siap_saji','Aktif',false),
        ('SP-S04','Sayur Lodeh',                 cat_sayur, 'Sayur lodeh santan campuran',                      25000,'siap_saji','Aktif',false),
        ('SP-K01','Sop Ayam',                    cat_sup,   'Sop ayam kuah bening',                             35000,'siap_saji','Aktif',false),
        ('SP-K02','Sop Daging Iga',              cat_sup,   'Sop tulang iga sapi kuah bening',                  35000,'siap_saji','Aktif',false),
        ('SP-K03','Sop Baso',                    cat_sup,   'Sop bakso kuah bening dengan bihun',               35000,'siap_saji','Aktif',false),
        ('SP-M01','Mie Goreng Baso',             cat_mie,   'Mie goreng dengan bakso dan sayuran',              35000,'siap_saji','Aktif',false)
    ON CONFLICT (sku) DO NOTHING;

    -- PORSI 1/2 — SKU TERPISAH (harga dari struk nyata)
    INSERT INTO public.products
        (sku, name, category_id, description, price, lini, status, is_half_portion, parent_sku)
    VALUES
        ('SP-A01H','Ayam Goreng Terasi Jeruk (1/2)',cat_ayam, 'Porsi 1/2 dari SP-A01', 50000,'siap_saji','Aktif',true,'SP-A01'),
        ('SP-D01H','Beef Yakiniku (1/2)',           cat_daging,'Porsi 1/2 dari SP-D01', 50000,'siap_saji','Aktif',true,'SP-D01'),
        ('SP-I01H','Udang Bakar Saus Jimbaran (1/2)',cat_ikan, 'Porsi 1/2 dari SP-I01', 50000,'siap_saji','Aktif',true,'SP-I01'),
        ('SP-T01H','Telur Ceplok Saus Tiram (1/2)', cat_telur,'Porsi 1/2 dari SP-T01', 25000,'siap_saji','Aktif',true,'SP-T01'),
        ('SP-S01H','Terong Balado (1/2)',            cat_sayur,'Porsi 1/2 dari SP-S01', 20000,'siap_saji','Aktif',true,'SP-S01'),
        ('SP-S02H','Capcay (1/2)',                   cat_sayur,'Porsi 1/2 dari SP-S02', 20000,'siap_saji','Aktif',true,'SP-S02'),
        ('SP-S03H','Puyunghai 1/2',                  cat_sayur,'Porsi 1/2 dari SP-S03', 20000,'siap_saji','Aktif',true,'SP-S03'),
        ('SP-K01H','Sop Ayam 1/2',                  cat_sup,  'Porsi 1/2 dari SP-K01', 20000,'siap_saji','Aktif',true,'SP-K01'),
        ('SP-M01H','Mie Goreng Baso 1/2',            cat_mie,  'Porsi 1/2 dari SP-M01', 20000,'siap_saji','Aktif',true,'SP-M01')
    ON CONFLICT (sku) DO NOTHING;
END $$;


-- ----------------------------------------------------------------
-- S9. PRODUCT_CHANNELS — ketersediaan & harga per channel
-- ----------------------------------------------------------------
DO $$
DECLARE
    ch_gojek  int8; ch_ahsan  int8; ch_market int8;
    ch_walkin int8; ch_wa     int8;
    rec       RECORD;
BEGIN
    SELECT id INTO ch_gojek  FROM public.channels WHERE name='Gojek Offline'   AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_ahsan  FROM public.channels WHERE name='Ahsan'           AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_market FROM public.channels WHERE name='Marketplace'     AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_walkin FROM public.channels WHERE name='Walk-in'         AND lini='siap_saji' LIMIT 1;
    SELECT id INTO ch_wa     FROM public.channels WHERE name='WhatsApp Direct' AND lini='siap_saji' LIMIT 1;

    -- Semua produk SS → Gojek, Ahsan, Walk-in, WA (harga normal)
    FOR rec IN SELECT id FROM public.products WHERE lini='siap_saji' AND status='Aktif' LOOP
        INSERT INTO public.product_channels (product_id, channel_id, harga_override, is_active)
        VALUES
            (rec.id, ch_gojek,  NULL, true),
            (rec.id, ch_ahsan,  NULL, true),
            (rec.id, ch_walkin, NULL, true),
            (rec.id, ch_wa,     NULL, true)
        ON CONFLICT (product_id, channel_id) DO NOTHING;
    END LOOP;

    -- Marketplace: porsi penuh saja, harga +20% (dibulatkan ke 500)
    FOR rec IN
        SELECT id, price FROM public.products
        WHERE lini='siap_saji' AND status='Aktif' AND is_half_portion = false
    LOOP
        INSERT INTO public.product_channels (product_id, channel_id, harga_override, is_active)
        VALUES (rec.id, ch_market,
                ROUND(rec.price * 1.20 / 500.0) * 500,
                true)
        ON CONFLICT (product_id, channel_id) DO NOTHING;
    END LOOP;
END $$;


-- ----------------------------------------------------------------
-- S10. KAS_BANK — 2 rekening nyata + kas tunai
-- ----------------------------------------------------------------
INSERT INTO public.kas_bank
    (lini, nama_rekening, jenis, no_rekening, nama_bank, saldo_awal, saldo_kini, is_payment_default)
VALUES
    ('siap_saji','BCA DYummy SS',     'Bank','2832835545',    'BCA',    10000000,10000000, true),
    ('siap_saji','Mandiri DYummy SS', 'Bank','1310017802705', 'Mandiri', 5000000, 5000000, false),
    ('siap_saji','Kas Tunai SS',      'Kas', NULL,            NULL,      2000000, 2000000, false)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------
-- S11. COA — Chart of Accounts Siap Saji
-- ----------------------------------------------------------------
INSERT INTO public.coa (lini, kode_akun, nama_akun, kelompok, sub_kelompok) VALUES
    ('siap_saji','1-1001','Kas Tunai SS',             'Aset',       'Aset Lancar'),
    ('siap_saji','1-1002','Bank BCA SS',              'Aset',       'Aset Lancar'),
    ('siap_saji','1-1003','Bank Mandiri SS',          'Aset',       'Aset Lancar'),
    ('siap_saji','1-1004','Piutang Dagang SS',        'Aset',       'Aset Lancar'),
    ('siap_saji','2-1001','Utang Usaha SS',           'Liabilitas', 'Liabilitas Lancar'),
    ('siap_saji','3-1001','Modal Siap Saji',          'Ekuitas',    'Modal'),
    ('siap_saji','3-1002','Laba Ditahan SS',          'Ekuitas',    'Laba Ditahan'),
    ('siap_saji','4-1001','Pendapatan Penjualan SS',  'Pendapatan', 'Penjualan'),
    ('siap_saji','4-1002','Pendapatan Ongkir SS',     'Pendapatan', 'Pendapatan Lain'),
    ('siap_saji','5-1001','HPP Bahan Baku SS',        'Beban',      'Beban Pokok Penjualan'),
    ('siap_saji','5-1002','HPP Kemasan SS',           'Beban',      'Beban Pokok Penjualan'),
    ('siap_saji','6-1001','Beban Gaji SS',            'Beban',      'Beban Operasional'),
    ('siap_saji','6-1002','Beban Listrik & Air SS',   'Beban',      'Beban Operasional'),
    ('siap_saji','6-1003','Beban Sewa Dapur SS',      'Beban',      'Beban Operasional'),
    ('siap_saji','6-1004','Beban Transport SS',       'Beban',      'Beban Operasional'),
    ('siap_saji','6-1005','Beban Marketing SS',       'Beban',      'Beban Operasional'),
    ('siap_saji','6-1006','Beban Perlengkapan SS',    'Beban',      'Beban Operasional')
ON CONFLICT (lini, kode_akun) DO NOTHING;


-- ----------------------------------------------------------------
-- S12. CUSTOMERS — 23 customer nyata dari nota 18 Jun 2026
-- ----------------------------------------------------------------
DO $$
DECLARE
    a_mandalajati   int8; a_cimenyan    int8; a_regol       int8;
    a_rancasari     int8; a_gedebage    int8; a_cinambo     int8;
    a_cimahi_utara  int8; a_cib_kidul   int8; a_lengkong    int8;
    a_cicendo       int8; a_cileunyi    int8; a_bojongsoang int8;
    a_arcamanik     int8; a_ujungberung int8;
BEGIN
    SELECT id INTO a_mandalajati  FROM public.areas WHERE kecamatan='Mandalajati'     AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_cimenyan     FROM public.areas WHERE kecamatan='Cimenyan'        AND kota='Kabupaten Bandung' LIMIT 1;
    SELECT id INTO a_regol        FROM public.areas WHERE kecamatan='Regol'           AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_rancasari    FROM public.areas WHERE kecamatan='Rancasari'       AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_gedebage     FROM public.areas WHERE kecamatan='Gedebage'        AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_cinambo      FROM public.areas WHERE kecamatan='Cinambo'         AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_cimahi_utara FROM public.areas WHERE kecamatan='Cimahi Utara'    AND kota='Kota Cimahi'       LIMIT 1;
    SELECT id INTO a_cib_kidul    FROM public.areas WHERE kecamatan='Cibeunying Kidul' AND kota='Kota Bandung'     LIMIT 1;
    SELECT id INTO a_lengkong     FROM public.areas WHERE kecamatan='Lengkong'        AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_cicendo      FROM public.areas WHERE kecamatan='Cicendo'         AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_cileunyi     FROM public.areas WHERE kecamatan='Cileunyi'        AND kota='Kabupaten Bandung' LIMIT 1;
    SELECT id INTO a_bojongsoang  FROM public.areas WHERE kecamatan='Bojongsoang'     AND kota='Kabupaten Bandung' LIMIT 1;
    SELECT id INTO a_arcamanik    FROM public.areas WHERE kecamatan='Arcamanik'       AND kota='Kota Bandung'      LIMIT 1;
    SELECT id INTO a_ujungberung  FROM public.areas WHERE kecamatan='Ujungberung'     AND kota='Kota Bandung'      LIMIT 1;

    INSERT INTO public.customers
        (name, phone, type, address, patokan, area_id, lini, status)
    VALUES
    ('nane aprilia lestari','08111100001','Personal',
     'Jl Haji Sobandi no 63 C Rt 2 Rw 16, Jatihandap Cicaheum',
     'Diatas pagar ada baling-baling', a_mandalajati,'siap_saji','Aktif'),

    ('Irham','08111100002','Personal',
     'Komplek Palm Bridge No.1G, Jl. Cukangkawung, Cibeunying, Kec. Cimenyan, Kab. Bandung',
     NULL, a_cimenyan,'siap_saji','Aktif'),

    ('Novi','08111100003','Personal',
     'Jl Pasirhuni III no 16 kec Regol',
     'Rumah di ujung hadap tembok', a_regol,'siap_saji','Aktif'),

    ('Ibu Elly','08111100004','Personal',
     'Jl Pluto I Blok C No 5, Kel Margasari, Kec Rancasari',
     'Dekat Griya Margahayuraya, di situ ada RS Harapan Bunda dan puskemas, depan puskesmas ada gerbang, masuk aja itu sudah Jln Pluto',
     a_rancasari,'siap_saji','Aktif'),

    ('Ibu Miang Sutisna','08111100005','Personal',
     'Summarecon cluster flora 2 FB 18, kelurahan cisaranten, kecamatan Gedebage',
     NULL, a_gedebage,'siap_saji','Aktif'),

    ('Tina Kurniasih','08111100006','Personal',
     'Komplek Bandung Timur Regency Jl BTR VI no 11, Kec Cinambo',
     NULL, a_cinambo,'siap_saji','Aktif'),

    ('Heni Puspita','08111100007','Personal',
     'Jl Batu Pualam No B4 Rt 2 Rw 2, Cimahi Utara, Kota Cimahi',
     'Patokan: Gunung Batu', a_cimahi_utara,'siap_saji','Aktif'),

    ('dewi puspita','08111100008','Personal',
     'Komplek Suci Residence E 1, Cibeunying Kidul, Kota Bandung',
     'Sebelum angklung udjo', a_cib_kidul,'siap_saji','Aktif'),

    ('Nasikun','08111100009','Personal',
     'Komp. Margahayu Raya Jl. Saturnus Raya no 39 (blok R-15), Rancasari',
     'Di sebelah SD Asy Syifa, masuk lalu belok kanan, lurus sampai perempatan Saturnus Raya, rumah di pojok kiri',
     a_rancasari,'siap_saji','Aktif'),

    ('Ibu Prawoto','08111100010','Personal',
     'Komp. Cimindi Raya Blok AC 1, Kel. Pasirkaliki, Cimahi Utara, Kota Cimahi',
     'Masuk komplek dari sebelah indomart', a_cimahi_utara,'siap_saji','Aktif'),

    ('Ilhamdaniah','08111100011','Personal',
     'Jl. Pinus V No.28 Kompleks Bumi Adipura Rancabolang Gedebage Bandung',
     'Cluster Pinus', a_gedebage,'siap_saji','Aktif'),

    ('Ibu Maria','08111100012','Personal',
     'Gatot Subroto no 8 Greja Alpha Omega bdg, Kecamatan Lengkong',
     'Samping tugu teng baja, parkiran mobil BPI, gerbang di belokan',
     a_lengkong,'siap_saji','Aktif'),

    ('nadia inda','08111100013','Personal',
     'The Royal Stavana C2, Kecamatan Rancasari',
     'Depan ANRI', a_rancasari,'siap_saji','Aktif'),

    ('Rizky','08111100014','Personal',
     'Jl. Bima No. 46, RT08 RW 04, Kel. Arjuna, Kec. Cicendo, Kota Bandung 40172',
     'Pagar Putih, sebrang gerbang Landmark Residence', a_cicendo,'siap_saji','Aktif'),

    ('Leanna','08111100015','Personal',
     'Tamansari Manglayang Regency Blok C2 No. 33-34, Desa Cimekar, Kecamatan Cileunyi, Kab Bandung',
     'Dari jalan cileunyi masuk ke jalan SMP1 naik ke atas sampai mentok, ketemu masjid al firdaus belok kiri',
     a_cileunyi,'siap_saji','Aktif'),

    ('Marni','08111100016','Personal',
     'Komp. Bumi Harapan Cibiru blok CC2 no.16, Cibiru hilir, Cileunyi, Kab Bandung',
     NULL, a_cileunyi,'siap_saji','Aktif'),

    ('Nuning Novini','08111100017','Personal',
     'Komplek Cibiru Asri 1 Blok K no 6 Jl Sadang Cibiru, Kec Cileunyi, Kab Bandung',
     'POM bensin am masoem sebelah kiri setelah bunderan cibiru',
     a_cileunyi,'siap_saji','Aktif'),

    ('Assad','08111100018','Personal',
     'De Green Villa Mutiara Residence Blok C No 4, Cipagalo',
     'Rumah dekat taman bojongsoang', a_bojongsoang,'siap_saji','Aktif'),

    ('Lely Meilia','08111100019','Personal',
     'Jl Sarimas IV No 57 Cicaheum Bandung, Kec Arcamanik',
     NULL, a_arcamanik,'siap_saji','Aktif'),

    ('Ayu/Yudi','08111100020','Personal',
     'Jalan Antasari VIII No 13, masjid Al Muhajirin',
     NULL, a_rancasari,'siap_saji','Aktif'),

    ('Dewi Sukma','08111100021','Personal',
     'Jl. Budi Raya, Kompleks El Verde No 62, Kel. Pasirkaliki, Cimahi Utara',
     'Jembatan di atas jalan tol pasteur, sebrang apartemen gateway pasteur',
     a_cimahi_utara,'siap_saji','Aktif'),

    ('Syulastri Teh Achi','08111100022','Personal',
     'Rumah kedua belakang mebel reza paledang nagrog, Ujungberung',
     'Masuk ke gerbang sebelah mebel reza paledang nagrog, rumah kedua abu-abu (om andri)',
     a_ujungberung,'siap_saji','Aktif'),

    ('Eva Mandini','08111100023','Personal',
     'Komp. SUNNY TOWN REGENCY No.A6 Rt/Rw 07/11, Jl.Ciganitri Utara, Cipagalo, Bojongsoang',
     NULL, a_bojongsoang,'siap_saji','Aktif')

    ON CONFLICT (phone) DO NOTHING;
END $$;


-- ----------------------------------------------------------------
-- S13. ORDERS — 23 order nyata dari nota 18 Jun 2026
--      shipping_fee menggunakan get_shipping_fee() untuk konsistensi
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_gojek   int8; v_wanti   int8;
    v_bca_id  int8; v_mdr_id  int8;
    -- customer IDs
    c01 int8; c02 int8; c03 int8; c04 int8; c05 int8; c06 int8;
    c07 int8; c08 int8; c09 int8; c10 int8; c11 int8; c12 int8;
    c13 int8; c14 int8; c15 int8; c16 int8; c17 int8; c18 int8;
    c19 int8; c20 int8; c21 int8; c22 int8; c23 int8;
    -- fee variables
    f01 numeric; f02 numeric; f03 numeric; f04 numeric; f05 numeric;
    f06 numeric; f07 numeric; f08 numeric; f09 numeric; f10 numeric;
    f11 numeric; f12 numeric; f13 numeric; f14 numeric; f15 numeric;
    f16 numeric; f17 numeric; f18 numeric; f19 numeric; f20 numeric;
    f21 numeric; f22 numeric; f23 numeric;
BEGIN
    SELECT id INTO v_gojek  FROM public.channels  WHERE name='Gojek Offline' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_wanti  FROM public.users      WHERE email='wanti@dyummy.com' LIMIT 1;
    SELECT id INTO v_bca_id FROM public.kas_bank   WHERE no_rekening='2832835545'    AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_mdr_id FROM public.kas_bank   WHERE no_rekening='1310017802705' AND lini='siap_saji' LIMIT 1;

    SELECT id INTO c01 FROM public.customers WHERE phone='08111100001' LIMIT 1;
    SELECT id INTO c02 FROM public.customers WHERE phone='08111100002' LIMIT 1;
    SELECT id INTO c03 FROM public.customers WHERE phone='08111100003' LIMIT 1;
    SELECT id INTO c04 FROM public.customers WHERE phone='08111100004' LIMIT 1;
    SELECT id INTO c05 FROM public.customers WHERE phone='08111100005' LIMIT 1;
    SELECT id INTO c06 FROM public.customers WHERE phone='08111100006' LIMIT 1;
    SELECT id INTO c07 FROM public.customers WHERE phone='08111100007' LIMIT 1;
    SELECT id INTO c08 FROM public.customers WHERE phone='08111100008' LIMIT 1;
    SELECT id INTO c09 FROM public.customers WHERE phone='08111100009' LIMIT 1;
    SELECT id INTO c10 FROM public.customers WHERE phone='08111100010' LIMIT 1;
    SELECT id INTO c11 FROM public.customers WHERE phone='08111100011' LIMIT 1;
    SELECT id INTO c12 FROM public.customers WHERE phone='08111100012' LIMIT 1;
    SELECT id INTO c13 FROM public.customers WHERE phone='08111100013' LIMIT 1;
    SELECT id INTO c14 FROM public.customers WHERE phone='08111100014' LIMIT 1;
    SELECT id INTO c15 FROM public.customers WHERE phone='08111100015' LIMIT 1;
    SELECT id INTO c16 FROM public.customers WHERE phone='08111100016' LIMIT 1;
    SELECT id INTO c17 FROM public.customers WHERE phone='08111100017' LIMIT 1;
    SELECT id INTO c18 FROM public.customers WHERE phone='08111100018' LIMIT 1;
    SELECT id INTO c19 FROM public.customers WHERE phone='08111100019' LIMIT 1;
    SELECT id INTO c20 FROM public.customers WHERE phone='08111100020' LIMIT 1;
    SELECT id INTO c21 FROM public.customers WHERE phone='08111100021' LIMIT 1;
    SELECT id INTO c22 FROM public.customers WHERE phone='08111100022' LIMIT 1;
    SELECT id INTO c23 FROM public.customers WHERE phone='08111100023' LIMIT 1;

    -- Hitung ongkir via function get_shipping_fee (area × channel)
    -- Hasilnya akan cocok dengan nota: mayoritas 12k, Cimahi/Kab 14k,
    -- kecuali Cileunyi override 13k dan Cimenyan override 16k
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f01 FROM public.customers c WHERE c.id=c01;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f02 FROM public.customers c WHERE c.id=c02;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f03 FROM public.customers c WHERE c.id=c03;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f04 FROM public.customers c WHERE c.id=c04;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f05 FROM public.customers c WHERE c.id=c05;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f06 FROM public.customers c WHERE c.id=c06;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f07 FROM public.customers c WHERE c.id=c07;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f08 FROM public.customers c WHERE c.id=c08;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f09 FROM public.customers c WHERE c.id=c09;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f10 FROM public.customers c WHERE c.id=c10;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f11 FROM public.customers c WHERE c.id=c11;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f12 FROM public.customers c WHERE c.id=c12;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f13 FROM public.customers c WHERE c.id=c13;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f14 FROM public.customers c WHERE c.id=c14;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f15 FROM public.customers c WHERE c.id=c15;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f16 FROM public.customers c WHERE c.id=c16;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f17 FROM public.customers c WHERE c.id=c17;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f18 FROM public.customers c WHERE c.id=c18;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f19 FROM public.customers c WHERE c.id=c19;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f20 FROM public.customers c WHERE c.id=c20;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f21 FROM public.customers c WHERE c.id=c21;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f22 FROM public.customers c WHERE c.id=c22;
    SELECT public.get_shipping_fee(c.area_id, v_gojek) INTO f23 FROM public.customers c WHERE c.id=c23;

    -- Catatan: grand_total = subtotal_items + shipping_fee dari nota
    -- Items diinsert di S14, grand_total dihitung dari subtotal+fee
    INSERT INTO public.orders
        (customer_id, pic_id, lini, channel_id, no_struk,
         order_date, delivery_date, departure_time, arrival_time,
         venue, order_notes, status_order, status_payment,
         shipping_fee, shipping_zone, grand_total,
         payment_bank, payment_account,
         input_source, jenis_order, closing_date)
    VALUES
    (c01,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00266','2026-06-18','2026-06-18','06:30','07:00',
     'Jl Haji Sobandi no 63 C Rt 2 Rw 16 Mandalajati','',
     'Aktif','Lunas',f01,'dalam_kota', 85000+f01,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c02,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00265','2026-06-18','2026-06-18','06:30','07:00',
     'Komplek Palm Bridge No.1G Jl. Cukangkawung Cimenyan','',
     'Aktif','Lunas',f02,'luar_kota', 100000+f02,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c03,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00264','2026-06-18','2026-06-18','06:30','07:00',
     'Jl Pasirhuni III no 16 kec Regol','',
     'Aktif','Lunas',f03,'dalam_kota',110000+f03,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c04,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00263','2026-06-18','2026-06-18','06:30','07:00',
     'Jl Pluto I Blok C No 5 Kec Rancasari Kel Margasari','',
     'Aktif','Lunas',f04,'dalam_kota',120000+f04,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c05,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00262','2026-06-18','2026-06-18','06:30','07:00',
     'Summarecon cluster flora 2 FB 18 Gedebage','',
     'Aktif','Lunas',f05,'dalam_kota',285000+f05,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c06,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00261','2026-06-18','2026-06-18','06:30','07:00',
     'Komplek Bandung Timur Regency Jl BTR VI no 11 Cinambo','',
     'Aktif','Lunas',f06,'dalam_kota', 35000+f06,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c07,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00260','2026-06-18','2026-06-18','06:30','07:00',
     'Jl Batu Pualam No B4 Rt 2 Rw 2 Cimahi Utara','',
     'Aktif','Lunas',f07,'luar_kota', 120000+f07,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c08,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00259','2026-06-18','2026-06-18','06:30','07:00',
     'Komplek Suci Residence E 1 Cibeunying Kidul','',
     'Aktif','Lunas',f08,'dalam_kota',135000+f08,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c09,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00258','2026-06-18','2026-06-18','06:30','07:00',
     'Komp. Margahayu Raya Jl. Saturnus Raya no 39 Rancasari','',
     'Aktif','Lunas',f09,'dalam_kota', 90000+f09,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c10,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00257','2026-06-18','2026-06-18','06:30','07:00',
     'Komp. Cimindi Raya Blok AC 1 Cimahi Utara','',
     'Aktif','Lunas',f10,'luar_kota',105000+f10,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c11,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00256','2026-06-18','2026-06-18','06:30','07:00',
     'Jl. Pinus V No.28 Kompleks Bumi Adipura Gedebage','',
     'Aktif','Lunas',f11,'dalam_kota',170000+f11,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c12,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00255','2026-06-18','2026-06-18','06:30','07:00',
     'Gatot Subroto no 8 Greja Alpha Omega Lengkong','',
     'Aktif','Lunas',f12,'dalam_kota',150000+f12,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c13,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00254','2026-06-18','2026-06-18','06:30','07:00',
     'The Royal Stavana C2 Rancasari','',
     'Aktif','Lunas',f13,'dalam_kota', 45000+f13,'Mandiri','1310017802705','manual','New Order','2026-06-18'),

    (c14,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00253','2026-06-18','2026-06-18','06:30','07:00',
     'Jl. Bima No. 46 RT08 RW 04 Cicendo','',
     'Aktif','Lunas',f14,'dalam_kota', 70000+f14,'Mandiri','1310017802705','manual','New Order','2026-06-18'),

    (c15,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00252','2026-06-18','2026-06-18','06:30','07:00',
     'Tamansari Manglayang Regency Blok C2 No. 33-34 Cileunyi','',
     'Aktif','Lunas',f15,'luar_kota', 370000+f15,'Mandiri','1310017802705','manual','New Order','2026-06-18'),

    (c16,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00251','2026-06-18','2026-06-18','06:30','07:00',
     'Komp. Bumi Harapan Cibiru blok CC2 no.16 Cileunyi','',
     'Aktif','Lunas',f16,'luar_kota',  70000+f16,'Mandiri','1310017802705','manual','New Order','2026-06-18'),

    (c17,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00250','2026-06-18','2026-06-18','06:30','07:00',
     'Komplek Cibiru Asri 1 Blok K no 6 Cileunyi','',
     'Aktif','Lunas',f17,'luar_kota', 170000+f17,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c18,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00249','2026-06-18','2026-06-18','06:30','07:00',
     'De Green Villa Mutiara Residence Blok C No 4 Cipagalo Bojongsoang','',
     'Aktif','Lunas',f18,'luar_kota', 135000+f18,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c19,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00248','2026-06-18','2026-06-18','06:30','07:00',
     'Jl Sarimas IV No 57 Cicaheum Arcamanik','',
     'Aktif','Lunas',f19,'dalam_kota',170000+f19,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c20,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00247','2026-06-18','2026-06-18','06:30','07:00',
     'Jalan Antasari VIII No 13 masjid Al Muhajirin','',
     'Aktif','Lunas',f20,'dalam_kota', 70000+f20,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c21,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00246','2026-06-18','2026-06-18','06:30','07:00',
     'Jl. Budi Raya Kompleks El Verde No 62 Cimahi Utara','',
     'Aktif','Lunas',f21,'luar_kota', 120000+f21,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c22,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00245','2026-06-18','2026-06-18','06:30','07:00',
     'Rumah kedua belakang mebel reza paledang nagrog Ujungberung','',
     'Aktif','Lunas',f22,'dalam_kota', 70000+f22,'BCA','2832835545','manual','New Order','2026-06-18'),

    (c23,v_wanti,'siap_saji',v_gojek,'SI.2026.06.00244','2026-06-18','2026-06-18','06:30','07:00',
     'Komp. SUNNY TOWN REGENCY No.A6 Jl.Ciganitri Utara Cipagalo Bojongsoang','',
     'Aktif','Lunas',f23,'luar_kota',  85000+f23,'BCA','2832835545','manual','New Order','2026-06-18');
END $$;


-- ----------------------------------------------------------------
-- S14. ORDER ITEMS — dari nota PDF (persis sesuai struk)
-- ----------------------------------------------------------------
DO $$
DECLARE
    o266 int8;o265 int8;o264 int8;o263 int8;o262 int8;o261 int8;
    o260 int8;o259 int8;o258 int8;o257 int8;o256 int8;o255 int8;
    o254 int8;o253 int8;o252 int8;o251 int8;o250 int8;o249 int8;
    o248 int8;o247 int8;o246 int8;o245 int8;o244 int8;
    p_beef int8;p_ayam_tj int8;p_udang int8;p_bandeng int8;
    p_telur int8;p_semur int8;p_terong int8;p_capcay int8;
    p_puy int8;p_sop_a int8;p_sop_iga int8;p_sop_b int8;p_mie int8;
    p_udang_h int8;p_ayam_h int8;p_telur_h int8;p_terong_h int8;
    p_capcay_h int8;p_puy_h int8;p_sop_a_h int8;p_mie_h int8;
BEGIN
    SELECT id INTO o266 FROM public.orders WHERE no_struk='SI.2026.06.00266' LIMIT 1;
    SELECT id INTO o265 FROM public.orders WHERE no_struk='SI.2026.06.00265' LIMIT 1;
    SELECT id INTO o264 FROM public.orders WHERE no_struk='SI.2026.06.00264' LIMIT 1;
    SELECT id INTO o263 FROM public.orders WHERE no_struk='SI.2026.06.00263' LIMIT 1;
    SELECT id INTO o262 FROM public.orders WHERE no_struk='SI.2026.06.00262' LIMIT 1;
    SELECT id INTO o261 FROM public.orders WHERE no_struk='SI.2026.06.00261' LIMIT 1;
    SELECT id INTO o260 FROM public.orders WHERE no_struk='SI.2026.06.00260' LIMIT 1;
    SELECT id INTO o259 FROM public.orders WHERE no_struk='SI.2026.06.00259' LIMIT 1;
    SELECT id INTO o258 FROM public.orders WHERE no_struk='SI.2026.06.00258' LIMIT 1;
    SELECT id INTO o257 FROM public.orders WHERE no_struk='SI.2026.06.00257' LIMIT 1;
    SELECT id INTO o256 FROM public.orders WHERE no_struk='SI.2026.06.00256' LIMIT 1;
    SELECT id INTO o255 FROM public.orders WHERE no_struk='SI.2026.06.00255' LIMIT 1;
    SELECT id INTO o254 FROM public.orders WHERE no_struk='SI.2026.06.00254' LIMIT 1;
    SELECT id INTO o253 FROM public.orders WHERE no_struk='SI.2026.06.00253' LIMIT 1;
    SELECT id INTO o252 FROM public.orders WHERE no_struk='SI.2026.06.00252' LIMIT 1;
    SELECT id INTO o251 FROM public.orders WHERE no_struk='SI.2026.06.00251' LIMIT 1;
    SELECT id INTO o250 FROM public.orders WHERE no_struk='SI.2026.06.00250' LIMIT 1;
    SELECT id INTO o249 FROM public.orders WHERE no_struk='SI.2026.06.00249' LIMIT 1;
    SELECT id INTO o248 FROM public.orders WHERE no_struk='SI.2026.06.00248' LIMIT 1;
    SELECT id INTO o247 FROM public.orders WHERE no_struk='SI.2026.06.00247' LIMIT 1;
    SELECT id INTO o246 FROM public.orders WHERE no_struk='SI.2026.06.00246' LIMIT 1;
    SELECT id INTO o245 FROM public.orders WHERE no_struk='SI.2026.06.00245' LIMIT 1;
    SELECT id INTO o244 FROM public.orders WHERE no_struk='SI.2026.06.00244' LIMIT 1;

    SELECT id INTO p_beef     FROM public.products WHERE sku='SP-D01'  LIMIT 1;
    SELECT id INTO p_ayam_tj  FROM public.products WHERE sku='SP-A01'  LIMIT 1;
    SELECT id INTO p_udang    FROM public.products WHERE sku='SP-I01'  LIMIT 1;
    SELECT id INTO p_bandeng  FROM public.products WHERE sku='SP-I02'  LIMIT 1;
    SELECT id INTO p_telur    FROM public.products WHERE sku='SP-T01'  LIMIT 1;
    SELECT id INTO p_semur    FROM public.products WHERE sku='SP-T02'  LIMIT 1;
    SELECT id INTO p_terong   FROM public.products WHERE sku='SP-S01'  LIMIT 1;
    SELECT id INTO p_capcay   FROM public.products WHERE sku='SP-S02'  LIMIT 1;
    SELECT id INTO p_puy      FROM public.products WHERE sku='SP-S03'  LIMIT 1;
    SELECT id INTO p_sop_a    FROM public.products WHERE sku='SP-K01'  LIMIT 1;
    SELECT id INTO p_sop_iga  FROM public.products WHERE sku='SP-K02'  LIMIT 1;
    SELECT id INTO p_sop_b    FROM public.products WHERE sku='SP-K03'  LIMIT 1;
    SELECT id INTO p_mie      FROM public.products WHERE sku='SP-M01'  LIMIT 1;
    SELECT id INTO p_udang_h  FROM public.products WHERE sku='SP-I01H' LIMIT 1;
    SELECT id INTO p_ayam_h   FROM public.products WHERE sku='SP-A01H' LIMIT 1;
    SELECT id INTO p_telur_h  FROM public.products WHERE sku='SP-T01H' LIMIT 1;
    SELECT id INTO p_terong_h FROM public.products WHERE sku='SP-S01H' LIMIT 1;
    SELECT id INTO p_capcay_h FROM public.products WHERE sku='SP-S02H' LIMIT 1;
    SELECT id INTO p_puy_h    FROM public.products WHERE sku='SP-S03H' LIMIT 1;
    SELECT id INTO p_sop_a_h  FROM public.products WHERE sku='SP-K01H' LIMIT 1;
    SELECT id INTO p_mie_h    FROM public.products WHERE sku='SP-M01H' LIMIT 1;

    INSERT INTO public.order_items
        (order_id, product_id, price, quantity, discount, subtotal)
    VALUES
    -- 00266 nane: Sop Baso 35k + Semur Jengkol 50k = 85k
    (o266,p_sop_b, 35000,1,0, 35000),(o266,p_semur, 50000,1,0, 50000),
    -- 00265 Irham: Beef Yakiniku 100k
    (o265,p_beef, 100000,1,0,100000),
    -- 00264 Novi: Udang1/2 + SopAyam1/2 + Mie1/2 + Puyunghai1/2 = 110k
    (o264,p_udang_h, 50000,1,0,50000),(o264,p_sop_a_h,20000,1,0,20000),
    (o264,p_mie_h,   20000,1,0,20000),(o264,p_puy_h,  20000,1,0,20000),
    -- 00263 Ibu Elly: SopAyam + Telur + Puyunghai = 120k
    (o263,p_sop_a,35000,1,0,35000),(o263,p_telur,50000,1,0,50000),(o263,p_puy,35000,1,0,35000),
    -- 00262 Ibu Miang Sutisna: AyamTerasiJeruk x2 + Semur + Terong = 285k
    (o262,p_ayam_tj,100000,2,0,200000),(o262,p_semur,50000,1,0,50000),(o262,p_terong,35000,1,0,35000),
    -- 00261 Tina: SopDagingIga 35k
    (o261,p_sop_iga,35000,1,0,35000),
    -- 00260 Heni: Telur + Terong + Mie = 120k
    (o260,p_telur,50000,1,0,50000),(o260,p_terong,35000,1,0,35000),(o260,p_mie,35000,1,0,35000),
    -- 00259 dewi puspita: AyamTerasiJeruk + Puyunghai = 135k
    (o259,p_ayam_tj,100000,1,0,100000),(o259,p_puy,35000,1,0,35000),
    -- 00258 Nasikun: Udang1/2 + Terong1/2 + Puyunghai1/2 = 90k
    (o258,p_udang_h,50000,1,0,50000),(o258,p_terong_h,20000,1,0,20000),(o258,p_puy_h,20000,1,0,20000),
    -- 00257 Ibu Prawoto: SopAyam + Mie + Terong = 105k
    (o257,p_sop_a,35000,1,0,35000),(o257,p_mie,35000,1,0,35000),(o257,p_terong,35000,1,0,35000),
    -- 00256 Ilhamdaniah: Beef + SopAyam + Mie = 170k
    (o256,p_beef,100000,1,0,100000),(o256,p_sop_a,35000,1,0,35000),(o256,p_mie,35000,1,0,35000),
    -- 00255 Ibu Maria: Udang + Telur = 150k
    (o255,p_udang,100000,1,0,100000),(o255,p_telur,50000,1,0,50000),
    -- 00254 nadia inda: Telur1/2 + Terong1/2 = 45k
    (o254,p_telur_h,25000,1,0,25000),(o254,p_terong_h,20000,1,0,20000),
    -- 00253 Rizky: Puyunghai + Capcay = 70k
    (o253,p_puy,35000,1,0,35000),(o253,p_capcay,35000,1,0,35000),
    -- 00252 Leanna: Beef x2 + AyamTerasiJeruk + SopDagingIga + Capcay = 370k
    (o252,p_beef,100000,2,0,200000),(o252,p_ayam_tj,100000,1,0,100000),
    (o252,p_sop_iga,35000,1,0,35000),(o252,p_capcay,35000,1,0,35000),
    -- 00251 Marni: Terong + Mie = 70k
    (o251,p_terong,35000,1,0,35000),(o251,p_mie,35000,1,0,35000),
    -- 00250 Nuning Novini: Mie + Terong + Bandeng + SopAyam = 170k
    (o250,p_mie,35000,1,0,35000),(o250,p_terong,35000,1,0,35000),
    (o250,p_bandeng,65000,1,0,65000),(o250,p_sop_a,35000,1,0,35000),
    -- 00249 Assad: Beef + Puyunghai = 135k
    (o249,p_beef,100000,1,0,100000),(o249,p_puy,35000,1,0,35000),
    -- 00248 Lely Meilia: AyamTerasiJeruk + SopAyam + Puyunghai = 170k
    (o248,p_ayam_tj,100000,1,0,100000),(o248,p_sop_a,35000,1,0,35000),(o248,p_puy,35000,1,0,35000),
    -- 00247 Ayu/Yudi: Terong + Puyunghai = 70k
    (o247,p_terong,35000,1,0,35000),(o247,p_puy,35000,1,0,35000),
    -- 00246 Dewi Sukma: Mie x2 + Telur = 120k
    (o246,p_mie,35000,2,0,70000),(o246,p_telur,50000,1,0,50000),
    -- 00245 Syulastri: AyamTerasiJeruk1/2 + Capcay1/2 = 70k
    (o245,p_ayam_h,50000,1,0,50000),(o245,p_capcay_h,20000,1,0,20000),
    -- 00244 Eva Mandini: Telur + SopAyam = 85k
    (o244,p_telur,50000,1,0,50000),(o244,p_sop_a,35000,1,0,35000);
END $$;


-- ----------------------------------------------------------------
-- S15. PURCHASES — HPP bahan baku Juni 2026
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_fin_id  int8; v_coa_hpp int8; v_coa_kem int8; v_kas_bca int8;
BEGIN
    SELECT id INTO v_fin_id  FROM public.users    WHERE email='nisa.keu@dyummy.com'              LIMIT 1;
    SELECT id INTO v_coa_hpp FROM public.coa      WHERE kode_akun='5-1001' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_coa_kem FROM public.coa      WHERE kode_akun='5-1002' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_kas_bca FROM public.kas_bank WHERE no_rekening='2832835545' AND lini='siap_saji' LIMIT 1;

    INSERT INTO public.purchases
        (lini,ref_type,finance_id,purchase_date,nota_ref,keterangan,total_amount,coa_id,kas_bank_id,status)
    VALUES
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-02','NOTA-SS-060201',
     'Belanja bahan baku awal Juni: daging sapi, udang, ayam, bumbu rempah',
     2800000,v_coa_hpp,v_kas_bca,'Final'),
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-02','NOTA-SS-060202',
     'Kemasan tinwall, plastik vacuum, box kertas, stiker awal Juni',
     520000,v_coa_kem,v_kas_bca,'Final'),
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-09','NOTA-SS-060901',
     'Bahan baku minggu-2: ikan bandeng, telur, sayuran, mie',
     2200000,v_coa_hpp,v_kas_bca,'Final'),
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-09','NOTA-SS-060902',
     'Kemasan tambahan dan bahan pembungkus minggu-2',
     380000,v_coa_kem,v_kas_bca,'Final'),
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-16','NOTA-SS-061601',
     'Bahan baku persiapan 18 Jun (23 order): daging, udang, ayam goreng terasi',
     3100000,v_coa_hpp,v_kas_bca,'Final'),
    ('siap_saji','pembelian_nota',v_fin_id,'2026-06-16','NOTA-SS-061602',
     'Kemasan extra & plastik wrap untuk 18 Jun',
     450000,v_coa_kem,v_kas_bca,'Final');
END $$;


-- ----------------------------------------------------------------
-- S16. OVERHEADS — Biaya operasional Juni 2026
-- ----------------------------------------------------------------
DO $$
DECLARE v_fin_id int8;
BEGIN
    SELECT id INTO v_fin_id FROM public.users WHERE email='nisa.keu@dyummy.com' LIMIT 1;
    INSERT INTO public.overheads (finance_id, expense_date, category, amount, notes, lini) VALUES
    (v_fin_id,'2026-06-01','Modal Awal',    20000000,'Modal awal operasional SS Juni 2026',           'siap_saji'),
    (v_fin_id,'2026-06-05','Gaji Karyawan',  3500000,'Gaji 2 CS SS (Wanti Nova + 1 helper)',         'siap_saji'),
    (v_fin_id,'2026-06-05','Listrik & Air',   450000,'Tagihan Juni dapur SS',                         'siap_saji'),
    (v_fin_id,'2026-06-05','Sewa Dapur',     1200000,'Sewa dapur operasional Juni',                   'siap_saji'),
    (v_fin_id,'2026-06-10','Transport',         95000,'Ongkos kirim bahan baku dari pasar',           'siap_saji'),
    (v_fin_id,'2026-06-13','Marketing',        250000,'Boost iklan Instagram + FB Ads SS',            'siap_saji'),
    (v_fin_id,'2026-06-15','Perlengkapan',      80000,'Tisu, kantong plastik dapur, sarung tangan',   'siap_saji');
END $$;


-- ----------------------------------------------------------------
-- S17. JOURNALS — jurnal otomatis dari semua transaksi
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_pend    int8; v_bca_coa int8; v_mdr_coa int8;
    v_hpp     int8; v_kem     int8;
    v_gaji    int8; v_listrik int8; v_sewa    int8;
    v_transp  int8; v_mktg    int8; v_modal   int8;
    rec       RECORD;
    p_rec     RECORD;
BEGIN
    SELECT id INTO v_pend    FROM public.coa WHERE kode_akun='4-1001' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_bca_coa FROM public.coa WHERE kode_akun='1-1002' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_mdr_coa FROM public.coa WHERE kode_akun='1-1003' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_hpp     FROM public.coa WHERE kode_akun='5-1001' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_kem     FROM public.coa WHERE kode_akun='5-1002' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_gaji    FROM public.coa WHERE kode_akun='6-1001' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_listrik FROM public.coa WHERE kode_akun='6-1002' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_sewa    FROM public.coa WHERE kode_akun='6-1003' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_transp  FROM public.coa WHERE kode_akun='6-1004' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_mktg    FROM public.coa WHERE kode_akun='6-1005' AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_modal   FROM public.coa WHERE kode_akun='3-1001' AND lini='siap_saji' LIMIT 1;

    -- Modal awal
    INSERT INTO public.journals
        (lini,journal_date,ref_type,ref_id,ref_no,akun_debit,akun_kredit,nominal,keterangan)
    VALUES ('siap_saji','2026-06-01','modal',1,NULL,v_bca_coa,v_modal,20000000,'Modal awal SS Juni 2026');

    -- Penjualan: satu entry per order
    FOR rec IN
        SELECT id, no_struk, order_date, grand_total, payment_bank
        FROM public.orders
        WHERE lini='siap_saji' AND status_order<>'Dibatalkan'
        ORDER BY order_date, no_struk
    LOOP
        INSERT INTO public.journals
            (lini,journal_date,ref_type,ref_id,ref_no,akun_debit,akun_kredit,nominal,keterangan)
        VALUES (
            'siap_saji', rec.order_date, 'penjualan', rec.id, rec.no_struk,
            CASE WHEN rec.payment_bank='BCA' THEN v_bca_coa ELSE v_mdr_coa END,
            v_pend, rec.grand_total,
            'Penjualan '||rec.no_struk||' — '||rec.payment_bank
        );
    END LOOP;

    -- HPP Purchases
    FOR p_rec IN
        SELECT id, purchase_date, nota_ref, total_amount, coa_id
        FROM public.purchases WHERE lini='siap_saji'
    LOOP
        INSERT INTO public.journals
            (lini,journal_date,ref_type,ref_id,ref_no,akun_debit,akun_kredit,nominal,keterangan)
        VALUES (
            'siap_saji', p_rec.purchase_date, 'pembelian',
            p_rec.id, p_rec.nota_ref,
            p_rec.coa_id, v_bca_coa, p_rec.total_amount,
            'Pembelian '||p_rec.nota_ref
        );
    END LOOP;

    -- Biaya operasional
    INSERT INTO public.journals
        (lini,journal_date,ref_type,ref_id,ref_no,akun_debit,akun_kredit,nominal,keterangan)
    VALUES
    ('siap_saji','2026-06-05','biaya',1,NULL,v_gaji,   v_bca_coa,3500000,'Gaji karyawan SS Juni'),
    ('siap_saji','2026-06-05','biaya',2,NULL,v_listrik, v_bca_coa, 450000,'Listrik & Air Juni'),
    ('siap_saji','2026-06-05','biaya',3,NULL,v_sewa,    v_bca_coa,1200000,'Sewa dapur Juni'),
    ('siap_saji','2026-06-10','biaya',4,NULL,v_transp,  v_bca_coa,  95000,'Transport bahan baku'),
    ('siap_saji','2026-06-13','biaya',5,NULL,v_mktg,    v_bca_coa, 250000,'Marketing SS Juni');

    -- Link journal ke orders
    UPDATE public.orders o
    SET journal_id = j.id
    FROM public.journals j
    WHERE j.ref_no = o.no_struk AND j.ref_type = 'penjualan';
END $$;


-- ----------------------------------------------------------------
-- S18. KAS_MUTASI — mutasi lengkap seluruh transaksi
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_bca_id int8; v_mdr_id int8;
    rec      RECORD;
BEGIN
    SELECT id INTO v_bca_id FROM public.kas_bank WHERE no_rekening='2832835545'    AND lini='siap_saji' LIMIT 1;
    SELECT id INTO v_mdr_id FROM public.kas_bank WHERE no_rekening='1310017802705' AND lini='siap_saji' LIMIT 1;

    -- Modal masuk
    INSERT INTO public.kas_mutasi
        (kas_bank_id,lini,mutasi_date,jenis,nominal,ref_type,keterangan)
    VALUES (v_bca_id,'siap_saji','2026-06-01','Masuk',20000000,'modal','Modal awal SS Juni 2026');

    -- HPP keluar
    INSERT INTO public.kas_mutasi
        (kas_bank_id,lini,mutasi_date,jenis,nominal,ref_type,keterangan)
    VALUES
    (v_bca_id,'siap_saji','2026-06-02','Keluar',2800000,'pembelian','Bahan baku awal Juni NOTA-SS-060201'),
    (v_bca_id,'siap_saji','2026-06-02','Keluar', 520000,'pembelian','Kemasan awal Juni NOTA-SS-060202'),
    (v_bca_id,'siap_saji','2026-06-09','Keluar',2200000,'pembelian','Bahan baku minggu-2 NOTA-SS-060901'),
    (v_bca_id,'siap_saji','2026-06-09','Keluar', 380000,'pembelian','Kemasan minggu-2 NOTA-SS-060902'),
    (v_bca_id,'siap_saji','2026-06-16','Keluar',3100000,'pembelian','Persiapan 18Jun NOTA-SS-061601'),
    (v_bca_id,'siap_saji','2026-06-16','Keluar', 450000,'pembelian','Kemasan 18Jun NOTA-SS-061602');

    -- Biaya keluar
    INSERT INTO public.kas_mutasi
        (kas_bank_id,lini,mutasi_date,jenis,nominal,ref_type,keterangan)
    VALUES
    (v_bca_id,'siap_saji','2026-06-05','Keluar',3500000,'biaya','Gaji karyawan SS Juni'),
    (v_bca_id,'siap_saji','2026-06-05','Keluar', 450000,'biaya','Listrik & Air Juni'),
    (v_bca_id,'siap_saji','2026-06-05','Keluar',1200000,'biaya','Sewa dapur Juni'),
    (v_bca_id,'siap_saji','2026-06-10','Keluar',  95000,'biaya','Transport bahan baku'),
    (v_bca_id,'siap_saji','2026-06-13','Keluar', 250000,'biaya','Marketing SS Juni'),
    (v_bca_id,'siap_saji','2026-06-15','Keluar',  80000,'biaya','Perlengkapan operasional');

    -- Penjualan masuk per rekening
    FOR rec IN
        SELECT delivery_date, payment_bank, no_struk, grand_total, id
        FROM public.orders
        WHERE lini='siap_saji' AND status_order<>'Dibatalkan'
        ORDER BY delivery_date, no_struk
    LOOP
        INSERT INTO public.kas_mutasi
            (kas_bank_id,lini,mutasi_date,jenis,nominal,ref_type,ref_id,keterangan)
        VALUES (
            CASE WHEN rec.payment_bank='BCA' THEN v_bca_id ELSE v_mdr_id END,
            'siap_saji', rec.delivery_date, 'Masuk',
            rec.grand_total, 'penjualan', rec.id,
            rec.payment_bank||' — '||rec.no_struk
        );
    END LOOP;

    -- Update saldo_kini semua rekening SS
    UPDATE public.kas_bank kb
    SET saldo_kini = kb.saldo_awal + COALESCE((
        SELECT SUM(CASE WHEN jenis='Masuk' THEN nominal ELSE -nominal END)
        FROM public.kas_mutasi km WHERE km.kas_bank_id = kb.id
    ), 0),
    updated_at = NOW()
    WHERE kb.lini = 'siap_saji';
END $$;


-- ----------------------------------------------------------------
-- S19. REFRESH MATERIALIZED VIEW RFM
-- ----------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY public.rfm_scores;

UPDATE public.settings
SET "value"=NOW()::text, updated_at=NOW()
WHERE "key"='rfm_last_refresh';

UPDATE public.settings
SET "value"='idle', updated_at=NOW()
WHERE "key"='rfm_refresh_status';


-- ================================================================
-- RINGKASAN STRUKTUR AKHIR v4.0
-- ================================================================
--
-- TABEL EKSISTING (Catering — ALTER saja):
--   users, product_categories, products*, recipes,
--   production_schedules, schedule_menus, purchase_requests,
--   pr_items, purchase_orders, overheads*, leads,
--   schedule_orders, order_items, customers*, orders*
--   (* = di-ALTER dengan tambahan kolom)
--
-- TABEL BARU (Master):
--   areas                 kecamatan dinamis + zona default ongkir
--   shipping_zones        tarif default per zona (fallback level-2)
--   channels              channel penjualan dinamis
--   area_channel_shipping MATRIKS ongkir area × channel (v4 baru)
--   product_channels      junction produk × channel + harga
--   settings              config & cron metadata
--
-- TABEL BARU (Akuntansi Terpadu):
--   coa                   chart of accounts per lini
--   kas_bank              rekening kas & bank per lini
--   kas_mutasi            mutasi per rekening
--   purchases             HPP / nota belanja per lini
--   journals              buku jurnal double-entry per lini
--
-- FUNCTION:
--   get_shipping_fee(area_id, channel_id)
--   → Hierarki: acs spesifik > zona default > 0
--
-- MATERIALIZED VIEW:
--   rfm_scores            skor RFM dinamis NTILE(5), refresh 01:30 WIB
--
-- VIEWS:
--   v_shipping_matrix     matriks lengkap fee_efektif per area × channel
--   v_laporan_harian_ss   rekap qty per produk → produksi
--   v_daftar_order_ss     rekap per customer + patokan → pengiriman
--   v_rekap_harian_ss     format tabel manual CS (CS pengganti sheet)
--   v_pl_summary          P&L per lini per bulan
--   v_neraca_saldo        trial balance per lini
--
-- SEED DATA NYATA:
--   23 customer + patokan asli dari struk PDF
--   23 order SI.2026.06.00244–00266 (18 Jun 2026)
--   Ongkir dihitung via get_shipping_fee() — konsisten dengan data
--   2 rekening nyata: BCA 2832835545 + Mandiri 1310017802705
--   13 SKU porsi penuh + 9 SKU varian 1/2 (harga dari struk asli)
--   HPP 6 nota + 7 biaya operasional Juni 2026
--   Matriks ongkir: Marketplace=0, Ahsan=15k flat,
--   Walk-in=0, Gojek=zona default (+override Cimenyan 16k, Cileunyi 13k)
-- ================================================================
