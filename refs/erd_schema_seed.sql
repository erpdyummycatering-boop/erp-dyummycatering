-- =============================================================================
-- ERD + DDL + SEED — Modul HR & Payroll Catering
-- PostgreSQL (Neon) · Next.js · Vercel
-- Rules: BIGSERIAL (no UUID), VARCHAR (no ENUM), full index optimization
-- Generated: 2026-09-05
-- =============================================================================

-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- for trigram full-text search on names
CREATE EXTENSION IF NOT EXISTS btree_gin; -- for composite GIN indexes

-- =============================================================================
-- 0. USERS & ROLES  (sistem auth yang sudah berjalan — minimal scaffold)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  BIGSERIAL       PRIMARY KEY,
    name                VARCHAR(150)    NOT NULL,
    email               VARCHAR(255)    NOT NULL,
    password_hash       VARCHAR(255)    NOT NULL,
    role                VARCHAR(50)     NOT NULL DEFAULT 'HRD',
    -- role: SUPER_ADMIN | HRD | FINANCE | KARYAWAN (future)
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
);
CREATE INDEX idx_users_email      ON users (email);
CREATE INDEX idx_users_role_active ON users (role, is_active);

-- =============================================================================
-- 1. MASTER DEPARTEMEN
-- =============================================================================
CREATE TABLE hr_departments (
    id                  BIGSERIAL       PRIMARY KEY,
    kode                VARCHAR(30)     NOT NULL,
    nama                VARCHAR(100)    NOT NULL,
    deskripsi           TEXT,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_departments_kode UNIQUE (kode)
);
CREATE INDEX idx_hr_departments_is_active ON hr_departments (is_active);

-- =============================================================================
-- 2. MASTER JABATAN
-- =============================================================================
CREATE TABLE hr_positions (
    id                  BIGSERIAL       PRIMARY KEY,
    kode                VARCHAR(30)     NOT NULL,
    nama                VARCHAR(100)    NOT NULL,
    department_id       BIGINT          REFERENCES hr_departments(id) ON DELETE SET NULL,
    tipe_gaji           VARCHAR(30)     NOT NULL DEFAULT 'HARIAN_PRODUKSI',
    -- tipe_gaji: HARIAN_PRODUKSI | HARIAN_DRIVER
    deskripsi           TEXT,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_positions_kode UNIQUE (kode)
);
CREATE INDEX idx_hr_positions_department_id ON hr_positions (department_id);
CREATE INDEX idx_hr_positions_tipe_gaji     ON hr_positions (tipe_gaji);
CREATE INDEX idx_hr_positions_is_active     ON hr_positions (is_active);

-- =============================================================================
-- 3. MASTER KARYAWAN
-- =============================================================================
CREATE TABLE hr_employees (
    id                  BIGSERIAL       PRIMARY KEY,
    kode_karyawan       VARCHAR(20)     NOT NULL,
    nama_fingerprint    VARCHAR(100)    NOT NULL,   -- exact match with fingerprint export
    nama_lengkap        VARCHAR(150)    NOT NULL,
    department_id       BIGINT          NOT NULL REFERENCES hr_departments(id),
    position_id         BIGINT          NOT NULL REFERENCES hr_positions(id),
    tipe_karyawan       VARCHAR(30)     NOT NULL DEFAULT 'TETAP',
    -- tipe_karyawan: TETAP | FREELANCE | TRAINING | DRIVER
    tipe_gaji           VARCHAR(30)     NOT NULL DEFAULT 'HARIAN_PRODUKSI',
    -- tipe_gaji: HARIAN_PRODUKSI | HARIAN_DRIVER
    no_fingerprint      INTEGER,                    -- ID di mesin fingerprint
    no_ktp              VARCHAR(20),
    email               VARCHAR(255),
    no_telepon          VARCHAR(20),
    npwp                VARCHAR(25),                -- for future PPh 21
    ptkp_status         VARCHAR(10),                -- TK0, K0, K1, K2, K3 — for future PPh 21
    bpjs_ketenagakerjaan VARCHAR(25),               -- for future BPJS
    bpjs_kesehatan      VARCHAR(25),                -- for future BPJS
    tanggal_masuk       DATE            NOT NULL,
    tanggal_keluar      DATE,                       -- NULL = masih aktif
    status              VARCHAR(20)     NOT NULL DEFAULT 'AKTIF',
    -- status: AKTIF | NON_AKTIF | CUTI_PANJANG
    catatan             TEXT,
    -- FK ke users untuk akun portal karyawan (future)
    user_id             BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_employees_kode            UNIQUE (kode_karyawan),
    CONSTRAINT uq_hr_employees_nama_fingerprint UNIQUE (nama_fingerprint)
);
CREATE INDEX idx_hr_employees_department_id     ON hr_employees (department_id);
CREATE INDEX idx_hr_employees_position_id       ON hr_employees (position_id);
CREATE INDEX idx_hr_employees_status            ON hr_employees (status);
CREATE INDEX idx_hr_employees_tipe_karyawan     ON hr_employees (tipe_karyawan);
CREATE INDEX idx_hr_employees_tipe_gaji         ON hr_employees (tipe_gaji);
CREATE INDEX idx_hr_employees_no_fingerprint    ON hr_employees (no_fingerprint);
CREATE INDEX idx_hr_employees_tanggal_masuk     ON hr_employees (tanggal_masuk);
-- Trigram index for fuzzy name search (matching fingerprint export names)
CREATE INDEX idx_hr_employees_nama_fingerprint_trgm ON hr_employees USING GIN (nama_fingerprint gin_trgm_ops);
CREATE INDEX idx_hr_employees_nama_lengkap_trgm     ON hr_employees USING GIN (nama_lengkap gin_trgm_ops);

-- =============================================================================
-- 4. MASTER SHIFT
-- =============================================================================
CREATE TABLE hr_shifts (
    id                          BIGSERIAL       PRIMARY KEY,
    kode                        VARCHAR(30)     NOT NULL,
    nama                        VARCHAR(100)    NOT NULL,
    jam_masuk                   TIME            NOT NULL,
    jam_keluar                  TIME            NOT NULL,
    jam_kerja_normal_menit      INTEGER         NOT NULL DEFAULT 480, -- 8 jam = 480 menit
    toleransi_terlambat_menit   INTEGER         NOT NULL DEFAULT 0,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by                  BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_shifts_kode UNIQUE (kode)
);
CREATE INDEX idx_hr_shifts_is_active ON hr_shifts (is_active);

-- =============================================================================
-- 5. PENUGASAN SHIFT KE KARYAWAN (per bulan)
-- =============================================================================
CREATE TABLE hr_shift_assignments (
    id                  BIGSERIAL       PRIMARY KEY,
    employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
    shift_id            BIGINT          NOT NULL REFERENCES hr_shifts(id),
    tanggal             DATE            NOT NULL,   -- tanggal spesifik penugasan
    tipe_shift          VARCHAR(10)     NOT NULL DEFAULT 'DEPT',
    -- tipe_shift: PER (personal override) | DEPT (department default)
    created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_shift_assignments_emp_date UNIQUE (employee_id, tanggal)
);
CREATE INDEX idx_hr_shift_assignments_employee_id   ON hr_shift_assignments (employee_id);
CREATE INDEX idx_hr_shift_assignments_shift_id      ON hr_shift_assignments (shift_id);
CREATE INDEX idx_hr_shift_assignments_tanggal       ON hr_shift_assignments (tanggal);
-- For monthly rekap queries
CREATE INDEX idx_hr_shift_assignments_emp_month     ON hr_shift_assignments (employee_id, DATE_TRUNC('month', tanggal));

-- =============================================================================
-- 6. MASTER STRUKTUR GAJI (versioned by effective_date)
-- =============================================================================
CREATE TABLE hr_salary_structures (
    id                          BIGSERIAL       PRIMARY KEY,
    employee_id                 BIGINT          NOT NULL REFERENCES hr_employees(id),
    effective_date              DATE            NOT NULL,
    -- Komponen Produksi & Driver (shared)
    gaji_pokok_harian           BIGINT          NOT NULL DEFAULT 0,  -- Rupiah
    lembur_per_jam              BIGINT          NOT NULL DEFAULT 0,  -- Rupiah
    tunjangan_tetap             BIGINT          NOT NULL DEFAULT 0,  -- Rupiah/bulan (opsional)
    -- Komponen Driver KM (NULL jika bukan driver)
    tunjangan_km_tier1          BIGINT,         -- tarif 1-5 km
    tunjangan_km_tier2          BIGINT,         -- tarif 6-15 km
    tunjangan_km_tier3          BIGINT,         -- tarif >15 km
    -- Metadata
    catatan                     TEXT,
    created_by                  BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_salary_structures_emp_date UNIQUE (employee_id, effective_date)
);
CREATE INDEX idx_hr_salary_structures_employee_id   ON hr_salary_structures (employee_id);
CREATE INDEX idx_hr_salary_structures_eff_date      ON hr_salary_structures (employee_id, effective_date DESC);

-- =============================================================================
-- 7. KONFIGURASI ATURAN POTONGAN & LEMBUR (global)
-- =============================================================================
CREATE TABLE hr_payroll_rules (
    id                              BIGSERIAL       PRIMARY KEY,
    -- Potongan Keterlambatan
    potongan_terlambat_aktif        BOOLEAN         NOT NULL DEFAULT FALSE,
    potongan_mode                   VARCHAR(20)     NOT NULL DEFAULT 'PER_MENIT',
    -- potongan_mode: PER_MENIT | PER_KEJADIAN
    potongan_tarif_per_menit        BIGINT          NOT NULL DEFAULT 0,
    potongan_tarif_per_kejadian     BIGINT          NOT NULL DEFAULT 0,
    potongan_toleransi_menit        INTEGER         NOT NULL DEFAULT 0,
    potongan_maks_per_hari          BIGINT          NOT NULL DEFAULT 0,  -- 0 = tidak ada batas
    -- Batas Lembur
    lembur_maks_aktif               BOOLEAN         NOT NULL DEFAULT FALSE,
    lembur_maks_jam_per_hari        NUMERIC(5,2)    NOT NULL DEFAULT 0,
    lembur_maks_jam_per_bulan       NUMERIC(6,2)    NOT NULL DEFAULT 0,
    lembur_perilaku_melewati        VARCHAR(20)     NOT NULL DEFAULT 'TANDAI_SAJA',
    -- lembur_perilaku_melewati: POTONG | TANDAI_SAJA
    -- Metadata
    berlaku_mulai                   DATE            NOT NULL DEFAULT CURRENT_DATE,
    catatan                         TEXT,
    created_by                      BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
-- Hanya 1 baris aktif, tapi disimpan histori per berlaku_mulai
CREATE INDEX idx_hr_payroll_rules_berlaku_mulai ON hr_payroll_rules (berlaku_mulai DESC);

-- =============================================================================
-- 8. OVERRIDE ATURAN PER KARYAWAN
-- =============================================================================
CREATE TABLE hr_payroll_rule_overrides (
    id                              BIGSERIAL       PRIMARY KEY,
    employee_id                     BIGINT          NOT NULL REFERENCES hr_employees(id),
    -- NULL = gunakan aturan global; TRUE/FALSE = override spesifik karyawan ini
    potongan_terlambat_aktif        BOOLEAN,
    potongan_tarif_per_menit        BIGINT,
    potongan_tarif_per_kejadian     BIGINT,
    lembur_maks_aktif               BOOLEAN,
    lembur_maks_jam_per_hari        NUMERIC(5,2),
    lembur_maks_jam_per_bulan       NUMERIC(6,2),
    lembur_perilaku_melewati        VARCHAR(20),
    berlaku_mulai                   DATE            NOT NULL DEFAULT CURRENT_DATE,
    berlaku_sampai                  DATE,           -- NULL = berlaku selamanya
    catatan                         TEXT,
    created_by                      BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hr_rule_overrides_employee_id  ON hr_payroll_rule_overrides (employee_id);
CREATE INDEX idx_hr_rule_overrides_berlaku      ON hr_payroll_rule_overrides (employee_id, berlaku_mulai DESC);

-- =============================================================================
-- 9. UPLOAD PRESENSI (log setiap batch upload)
-- =============================================================================
CREATE TABLE hr_attendance_uploads (
    id                  BIGSERIAL       PRIMARY KEY,
    periode_tahun       SMALLINT        NOT NULL,
    periode_bulan       SMALLINT        NOT NULL,   -- 1-12
    nama_file           VARCHAR(255)    NOT NULL,
    ukuran_file_bytes   BIGINT,
    format_file         VARCHAR(20)     NOT NULL,   -- FORMAT_A | FORMAT_B | TEMPLATE_MANUAL
    storage_url         VARCHAR(500),               -- Vercel Blob URL
    status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    -- status: PENDING | PROCESSING | PARTIAL | DONE | ERROR
    total_rows          INTEGER         NOT NULL DEFAULT 0,
    rows_matched        INTEGER         NOT NULL DEFAULT 0,
    rows_unmatched      INTEGER         NOT NULL DEFAULT 0,
    rows_anomali        INTEGER         NOT NULL DEFAULT 0,
    error_log           JSONB,                      -- detail error per baris
    unmatched_names     JSONB,                      -- nama-nama yg tidak match di master
    uploaded_by         BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hr_att_uploads_periode  ON hr_attendance_uploads (periode_tahun, periode_bulan);
CREATE INDEX idx_hr_att_uploads_status   ON hr_attendance_uploads (status);
CREATE INDEX idx_hr_att_uploads_uploaded ON hr_attendance_uploads (uploaded_by);

-- =============================================================================
-- 10. DATA PRESENSI HARIAN
-- =============================================================================
CREATE TABLE hr_attendances (
    id                      BIGSERIAL       PRIMARY KEY,
    employee_id             BIGINT          NOT NULL REFERENCES hr_employees(id),
    upload_id               BIGINT          REFERENCES hr_attendance_uploads(id) ON DELETE SET NULL,
    tanggal                 DATE            NOT NULL,
    jam_masuk               TIME,
    jam_keluar              TIME,
    jam_masuk_2             TIME,           -- untuk multi-session (dari Perhitungan Tidak Normal)
    jam_keluar_2            TIME,
    jam_masuk_3             TIME,
    jam_keluar_3            TIME,
    keterangan              VARCHAR(20)     NOT NULL DEFAULT 'HADIR',
    -- keterangan: HADIR | ABSEN | CUTI | SAKIT | IZIN | DINAS | TIDAK_SCAN
    durasi_kerja_menit      INTEGER,        -- total menit aktual bekerja
    terlambat_menit         INTEGER         NOT NULL DEFAULT 0,
    keluar_awal_menit       INTEGER         NOT NULL DEFAULT 0,
    lembur_menit            INTEGER         NOT NULL DEFAULT 0,
    lembur_spesial_menit    INTEGER         NOT NULL DEFAULT 0,
    tidak_scan_lengkap      BOOLEAN         NOT NULL DEFAULT FALSE,  -- hanya scan 1 kali
    is_anomali              BOOLEAN         NOT NULL DEFAULT FALSE,
    source                  VARCHAR(20)     NOT NULL DEFAULT 'UPLOAD',
    -- source: UPLOAD | MANUAL | API_REALTIME (future)
    is_koreksi              BOOLEAN         NOT NULL DEFAULT FALSE,
    catatan                 TEXT,
    created_by              BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_attendances_emp_date UNIQUE (employee_id, tanggal)
);
-- Critical indexes for payroll computation (aggregated per period)
CREATE INDEX idx_hr_att_employee_id         ON hr_attendances (employee_id);
CREATE INDEX idx_hr_att_tanggal             ON hr_attendances (tanggal);
CREATE INDEX idx_hr_att_emp_tanggal         ON hr_attendances (employee_id, tanggal);
CREATE INDEX idx_hr_att_emp_month           ON hr_attendances (employee_id, DATE_TRUNC('month', tanggal));
CREATE INDEX idx_hr_att_keterangan          ON hr_attendances (keterangan);
CREATE INDEX idx_hr_att_upload_id           ON hr_attendances (upload_id);
CREATE INDEX idx_hr_att_is_anomali          ON hr_attendances (is_anomali) WHERE is_anomali = TRUE;
CREATE INDEX idx_hr_att_tidak_scan          ON hr_attendances (tidak_scan_lengkap) WHERE tidak_scan_lengkap = TRUE;
-- Partition-ready: month range scan
CREATE INDEX idx_hr_att_tanggal_brin        ON hr_attendances USING BRIN (tanggal);

-- =============================================================================
-- 11. AUDIT LOG KOREKSI PRESENSI
-- =============================================================================
CREATE TABLE hr_attendance_corrections (
    id                  BIGSERIAL       PRIMARY KEY,
    attendance_id       BIGINT          NOT NULL REFERENCES hr_attendances(id),
    employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
    field_changed       VARCHAR(50)     NOT NULL,   -- kolom yang diubah
    nilai_sebelum       TEXT,
    nilai_sesudah       TEXT,
    alasan              TEXT,
    corrected_by        BIGINT          NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hr_att_corrections_attendance_id  ON hr_attendance_corrections (attendance_id);
CREATE INDEX idx_hr_att_corrections_employee_id    ON hr_attendance_corrections (employee_id);
CREATE INDEX idx_hr_att_corrections_created_at     ON hr_attendance_corrections (created_at DESC);
CREATE INDEX idx_hr_att_corrections_corrected_by   ON hr_attendance_corrections (corrected_by);

-- =============================================================================
-- 12. PAYROLL HEADER (per periode, per batch run)
-- =============================================================================
CREATE TABLE hr_payrolls (
    id                  BIGSERIAL       PRIMARY KEY,
    periode_tahun       SMALLINT        NOT NULL,
    periode_bulan       SMALLINT        NOT NULL,   -- 1-12
    nama_periode        VARCHAR(50)     NOT NULL,   -- e.g. "September 2026"
    status              VARCHAR(25)     NOT NULL DEFAULT 'DRAFT',
    -- status: DRAFT | PENDING_APPROVAL | APPROVED | FINAL | CANCELLED
    total_karyawan      INTEGER         NOT NULL DEFAULT 0,
    total_gaji_kotor    BIGINT          NOT NULL DEFAULT 0,
    total_gaji_bersih   BIGINT          NOT NULL DEFAULT 0,
    total_potongan      BIGINT          NOT NULL DEFAULT 0,
    -- Snapshot aturan yang berlaku saat hitung (JSONB untuk audit)
    rules_snapshot      JSONB,
    catatan             TEXT,
    -- Workflow
    dihitung_oleh       BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    dihitung_pada       TIMESTAMPTZ,
    diajukan_oleh       BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    diajukan_pada       TIMESTAMPTZ,
    disetujui_oleh      BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    disetujui_pada      TIMESTAMPTZ,
    difinalisasi_oleh   BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    difinalisasi_pada   TIMESTAMPTZ,
    dibatalkan_oleh     BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    dibatalkan_pada     TIMESTAMPTZ,
    alasan_batal        TEXT,
    -- Future integration
    external_ref_id     VARCHAR(100),   -- untuk link ke modul keuangan/kasir
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_payrolls_periode UNIQUE (periode_tahun, periode_bulan)
);
CREATE INDEX idx_hr_payrolls_status          ON hr_payrolls (status);
CREATE INDEX idx_hr_payrolls_periode         ON hr_payrolls (periode_tahun, periode_bulan);
CREATE INDEX idx_hr_payrolls_dihitung_oleh   ON hr_payrolls (dihitung_oleh);
CREATE INDEX idx_hr_payrolls_disetujui_oleh  ON hr_payrolls (disetujui_oleh);

-- =============================================================================
-- 13. PAYROLL DETAIL (per karyawan per periode)
-- =============================================================================
CREATE TABLE hr_payroll_details (
    id                              BIGSERIAL       PRIMARY KEY,
    payroll_id                      BIGINT          NOT NULL REFERENCES hr_payrolls(id),
    employee_id                     BIGINT          NOT NULL REFERENCES hr_employees(id),
    -- Snapshot data karyawan saat payroll diproses
    snapshot_nama                   VARCHAR(150)    NOT NULL,
    snapshot_jabatan                VARCHAR(100),
    snapshot_departemen             VARCHAR(100),
    snapshot_tipe_gaji              VARCHAR(30),
    -- Rekap Kehadiran
    hari_kerja_jadwal               INTEGER         NOT NULL DEFAULT 0,
    hari_hadir                      INTEGER         NOT NULL DEFAULT 0,
    hari_absen                      INTEGER         NOT NULL DEFAULT 0,
    hari_cuti                       INTEGER         NOT NULL DEFAULT 0,
    hari_sakit                      INTEGER         NOT NULL DEFAULT 0,
    hari_izin                       INTEGER         NOT NULL DEFAULT 0,
    hari_dinas                      INTEGER         NOT NULL DEFAULT 0,
    -- Rekap Waktu
    total_terlambat_menit           INTEGER         NOT NULL DEFAULT 0,
    total_keluar_awal_menit         INTEGER         NOT NULL DEFAULT 0,
    total_tidak_scan_hari           INTEGER         NOT NULL DEFAULT 0,
    total_lembur_menit_aktual       INTEGER         NOT NULL DEFAULT 0,   -- dari presensi
    total_lembur_menit_diakui       INTEGER         NOT NULL DEFAULT 0,   -- setelah apply batas maks
    lembur_melewati_batas           BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Komponen Pendapatan
    gaji_pokok_harian_snapshot      BIGINT          NOT NULL DEFAULT 0,
    lembur_per_jam_snapshot         BIGINT          NOT NULL DEFAULT 0,
    subtotal_gaji_pokok             BIGINT          NOT NULL DEFAULT 0,   -- gaji_pokok × hari_hadir
    subtotal_lembur                 BIGINT          NOT NULL DEFAULT 0,   -- lembur/jam × jam_diakui
    tunjangan_km                    BIGINT          NOT NULL DEFAULT 0,   -- khusus driver
    km_perjalanan                   INTEGER,                              -- input manual HRD (driver)
    tunjangan_bonus                 BIGINT          NOT NULL DEFAULT 0,   -- input manual HRD
    tunjangan_tetap                 BIGINT          NOT NULL DEFAULT 0,
    pembulatan                      BIGINT          NOT NULL DEFAULT 0,   -- input manual HRD
    total_pendapatan                BIGINT          NOT NULL DEFAULT 0,
    -- Komponen Potongan
    potongan_terlambat              BIGINT          NOT NULL DEFAULT 0,   -- dari aturan
    potongan_lain                   BIGINT          NOT NULL DEFAULT 0,   -- kasbon, dsb (manual)
    total_potongan                  BIGINT          NOT NULL DEFAULT 0,
    -- Hasil
    gaji_kotor                      BIGINT          NOT NULL DEFAULT 0,
    gaji_bersih                     BIGINT          NOT NULL DEFAULT 0,
    -- Override manual HRD
    override_lembur_diakui          BIGINT,         -- NULL = pakai kalkulasi sistem
    override_potongan_terlambat     BIGINT,         -- NULL = pakai kalkulasi sistem
    -- Snapshot aturan yang dipakai untuk karyawan ini
    rules_snapshot                  JSONB,          -- merge global + override per karyawan
    catatan_payroll                 TEXT,
    -- Slip gaji
    slip_url                        VARCHAR(500),   -- Vercel Blob URL PDF slip gaji
    slip_generated_at               TIMESTAMPTZ,
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_payroll_details_payroll_emp UNIQUE (payroll_id, employee_id)
);
CREATE INDEX idx_hr_pd_payroll_id      ON hr_payroll_details (payroll_id);
CREATE INDEX idx_hr_pd_employee_id     ON hr_payroll_details (employee_id);
CREATE INDEX idx_hr_pd_emp_payroll     ON hr_payroll_details (employee_id, payroll_id);
-- For financial reporting by period
CREATE INDEX idx_hr_pd_gaji_bersih     ON hr_payroll_details (payroll_id, gaji_bersih);
CREATE INDEX idx_hr_pd_snap_tipe_gaji  ON hr_payroll_details (payroll_id, snapshot_tipe_gaji);

-- =============================================================================
-- 14. INPUT KM PERJALANAN DRIVER (detail per perjalanan — future detail)
-- =============================================================================
CREATE TABLE hr_driver_trips (
    id                  BIGSERIAL       PRIMARY KEY,
    payroll_detail_id   BIGINT          NOT NULL REFERENCES hr_payroll_details(id),
    employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
    tanggal             DATE            NOT NULL,
    km                  INTEGER         NOT NULL DEFAULT 0,
    tier                VARCHAR(10),                -- TIER1 | TIER2 | TIER3
    tunjangan_km        BIGINT          NOT NULL DEFAULT 0,
    keterangan          TEXT,
    created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hr_driver_trips_payroll_detail ON hr_driver_trips (payroll_detail_id);
CREATE INDEX idx_hr_driver_trips_employee_id    ON hr_driver_trips (employee_id);
CREATE INDEX idx_hr_driver_trips_tanggal        ON hr_driver_trips (employee_id, tanggal);

-- =============================================================================
-- 15. REKAP KEHADIRAN BULANAN (materialized/cached aggregate — fast reporting)
-- =============================================================================
CREATE TABLE hr_attendance_monthly_summary (
    id                              BIGSERIAL       PRIMARY KEY,
    employee_id                     BIGINT          NOT NULL REFERENCES hr_employees(id),
    periode_tahun                   SMALLINT        NOT NULL,
    periode_bulan                   SMALLINT        NOT NULL,
    hari_kerja_jadwal               INTEGER         NOT NULL DEFAULT 0,
    hari_hadir                      INTEGER         NOT NULL DEFAULT 0,
    hari_absen                      INTEGER         NOT NULL DEFAULT 0,
    hari_cuti                       INTEGER         NOT NULL DEFAULT 0,
    hari_sakit                      INTEGER         NOT NULL DEFAULT 0,
    hari_izin                       INTEGER         NOT NULL DEFAULT 0,
    hari_dinas                      INTEGER         NOT NULL DEFAULT 0,
    total_terlambat_menit           INTEGER         NOT NULL DEFAULT 0,
    total_keluar_awal_menit         INTEGER         NOT NULL DEFAULT 0,
    total_tidak_scan_hari           INTEGER         NOT NULL DEFAULT 0,
    total_lembur_menit              INTEGER         NOT NULL DEFAULT 0,
    -- Cache status
    last_computed_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_hr_att_monthly_emp_periode UNIQUE (employee_id, periode_tahun, periode_bulan)
);
CREATE INDEX idx_hr_att_monthly_emp         ON hr_attendance_monthly_summary (employee_id);
CREATE INDEX idx_hr_att_monthly_periode     ON hr_attendance_monthly_summary (periode_tahun, periode_bulan);
CREATE INDEX idx_hr_att_monthly_emp_periode ON hr_attendance_monthly_summary (employee_id, periode_tahun, periode_bulan);

-- =============================================================================
-- 16. AUDIT LOG UMUM (perubahan data master)
-- =============================================================================
CREATE TABLE hr_audit_logs (
    id                  BIGSERIAL       PRIMARY KEY,
    tabel               VARCHAR(100)    NOT NULL,
    record_id           BIGINT          NOT NULL,
    aksi                VARCHAR(20)     NOT NULL,   -- INSERT | UPDATE | DELETE
    data_sebelum        JSONB,
    data_sesudah        JSONB,
    user_id             BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    ip_address          VARCHAR(45),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hr_audit_logs_tabel        ON hr_audit_logs (tabel, record_id);
CREATE INDEX idx_hr_audit_logs_user_id      ON hr_audit_logs (user_id);
CREATE INDEX idx_hr_audit_logs_created_at   ON hr_audit_logs (created_at DESC);
-- BRIN for time-series audit logs (very efficient for append-only)
CREATE INDEX idx_hr_audit_logs_created_brin ON hr_audit_logs USING BRIN (created_at);

-- =============================================================================
-- =============================================================================
-- SEED DATA — REALISTIS DARI FILE EXCEL + PRD
-- =============================================================================
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SEED: users
-- -----------------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Super Admin',      'admin@catering.id',   '$2b$10$placeholder_hash_admin',   'SUPER_ADMIN'),
(2, 'HRD Sinta',        'hrd@catering.id',     '$2b$10$placeholder_hash_hrd',     'HRD'),
(3, 'Finance Bambang',  'finance@catering.id', '$2b$10$placeholder_hash_finance', 'FINANCE');
SELECT setval('users_id_seq', 10);

-- -----------------------------------------------------------------------------
-- SEED: hr_departments
-- -----------------------------------------------------------------------------
INSERT INTO hr_departments (id, kode, nama, deskripsi, created_by) VALUES
(1, 'COMPANY',  'Company',          'Departemen umum / produksi umum',       1),
(2, 'PRODUKSI', 'Production Dept.', 'Departemen produksi khusus (koki, dll)',  1),
(3, 'DRIVER',   'Driver Dept.',     'Departemen driver pengiriman',           1);
SELECT setval('hr_departments_id_seq', 10);

-- -----------------------------------------------------------------------------
-- SEED: hr_positions
-- -----------------------------------------------------------------------------
INSERT INTO hr_positions (id, kode, nama, department_id, tipe_gaji, created_by) VALUES
(1,  'PRODUKSI',        'Produksi',         1, 'HARIAN_PRODUKSI', 1),
(2,  'DISHWASH',        'Dishwash',         1, 'HARIAN_PRODUKSI', 1),
(3,  'KOKI',            'Koki',             2, 'HARIAN_PRODUKSI', 1),
(4,  'CLEANING',        'Cleaning Service', 1, 'HARIAN_PRODUKSI', 1),
(5,  'GUDANG',          'Karyawan Gudang',  1, 'HARIAN_PRODUKSI', 1),
(6,  'TIM_GUDANG',      'Tim Gudang',       1, 'HARIAN_PRODUKSI', 1),
(7,  'TIM_SIAP_SAJI',   'Tim Siap Saji',    1, 'HARIAN_PRODUKSI', 1),
(8,  'FREELANCE',       'Freelance',        1, 'HARIAN_PRODUKSI', 1),
(9,  'FREELANCE_KOKI',  'Freelance Koki',   2, 'HARIAN_PRODUKSI', 1),
(10, 'TRAINING_KOKI',   'Training Koki',    2, 'HARIAN_PRODUKSI', 1),
(11, 'DRIVER_MOTOR',    'Driver Motor',     3, 'HARIAN_DRIVER',   1),
(12, 'DRIVER_MOBIL',    'Driver Mobil',     3, 'HARIAN_DRIVER',   1),
(13, 'LEADER_DRIVER',   'Leader Driver',    3, 'HARIAN_DRIVER',   1);
SELECT setval('hr_positions_id_seq', 20);

-- -----------------------------------------------------------------------------
-- SEED: hr_shifts
-- Dari sheet "Jadwal Kerja": Shift1 jam 02:00-10:00, Shift2-dst jam 09:00-18:00
-- -----------------------------------------------------------------------------
INSERT INTO hr_shifts (id, kode, nama, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit, created_by) VALUES
(1, 'SHIFT_PAGI',   'Shift Pagi (02:00-10:00)',   '02:00', '10:00', 480, 15, 1),
(2, 'SHIFT_NORMAL', 'Shift Normal (09:00-18:00)', '09:00', '18:00', 480, 15, 1);
SELECT setval('hr_shifts_id_seq', 10);

-- -----------------------------------------------------------------------------
-- SEED: hr_employees
-- Sumber: Database_Gaji_Produksi.xlsx (28 produksi + 8 driver)
-- + tambahan dari Ringkasan Kehadiran yang tidak ada di gaji (Rindu, Anggi, dll)
-- Semua karyawan di periode 2026-09 ada di sini
-- nama_fingerprint = persis seperti di file fingerprint
-- -----------------------------------------------------------------------------
INSERT INTO hr_employees (id, kode_karyawan, nama_fingerprint, nama_lengkap, department_id, position_id, tipe_karyawan, tipe_gaji, no_fingerprint, tanggal_masuk, status, created_by) VALUES
-- ---- Produksi & Operasional ----
(1,  'EMP-001', 'Wiwi Sumiati',              'Wiwi Sumiati',              1, 2,  'TETAP',     'HARIAN_PRODUKSI', 40, '2024-01-15', 'AKTIF', 1),
(2,  'EMP-002', 'Susani',                    'Susani',                    1, 1,  'TETAP',     'HARIAN_PRODUKSI', 26, '2023-06-01', 'AKTIF', 1),
(3,  'EMP-003', 'Riska Damayanti',           'Riska Damayanti',           1, 1,  'TETAP',     'HARIAN_PRODUKSI', 17, '2023-08-01', 'AKTIF', 1),
(4,  'EMP-004', 'ratna',                     'Ratna (Enok)',               1, 1,  'TETAP',     'HARIAN_PRODUKSI', 20, '2023-09-01', 'AKTIF', 1),
(5,  'EMP-005', 'Imas',                      'Imas Munawaroh',            1, 1,  'TETAP',     'HARIAN_PRODUKSI', 8,  '2023-05-01', 'AKTIF', 1),
(6,  'EMP-006', 'Ika',                       'Ika Sartika',               1, 2,  'TETAP',     'HARIAN_PRODUKSI', 12, '2024-02-01', 'AKTIF', 1),
(7,  'EMP-007', 'Iin',                       'Iin Yuliani Marlina',       1, 1,  'TETAP',     'HARIAN_PRODUKSI', 2,  '2022-11-01', 'AKTIF', 1),
(8,  'EMP-008', 'Elis',                      'Elis Mulyani',              1, 1,  'TETAP',     'HARIAN_PRODUKSI', 32, '2023-03-01', 'AKTIF', 1),
(9,  'EMP-009', 'Dana',                      'Husain Pria Wardana',       1, 1,  'TETAP',     'HARIAN_PRODUKSI', 18, '2023-07-01', 'AKTIF', 1),
(10, 'EMP-010', 'cepi',                      'Cepi Sutiaji',              2, 3,  'TETAP',     'HARIAN_PRODUKSI', 25, '2022-08-01', 'AKTIF', 1),
(11, 'EMP-011', 'Ade',                       'Ade Kurnia',                2, 3,  'TETAP',     'HARIAN_PRODUKSI', 13, '2023-04-01', 'AKTIF', 1),
(12, 'EMP-012', 'Raya',                      'Raya',                      1, 5,  'TETAP',     'HARIAN_PRODUKSI', 9,  '2024-01-01', 'AKTIF', 1),
(13, 'EMP-013', 'partini',                   'Partini',                   1, 1,  'TETAP',     'HARIAN_PRODUKSI', 24, '2023-10-01', 'AKTIF', 1),
(14, 'EMP-014', 'Enung',                     'Enung Nuryanti',            1, 4,  'TETAP',     'HARIAN_PRODUKSI', 16, '2023-11-01', 'AKTIF', 1),
(15, 'EMP-015', 'Dede',                      'Dede Sihabudin',            2, 3,  'TETAP',     'HARIAN_PRODUKSI', 21, '2023-02-01', 'AKTIF', 1),
(16, 'EMP-016', 'IDA',                       'Ida',                       1, 7,  'TETAP',     'HARIAN_PRODUKSI', 39, '2024-03-01', 'AKTIF', 1),
(17, 'EMP-017', 'fery',                      'Feri',                      1, 6,  'TETAP',     'HARIAN_PRODUKSI', 27, '2023-12-01', 'AKTIF', 1),
(18, 'EMP-018', 'ari',                       'Ashari Samsu Musalim',      2, 3,  'TETAP',     'HARIAN_PRODUKSI', 22, '2024-01-10', 'AKTIF', 1),
(19, 'EMP-019', 'Dimas',                     'Dimas',                     1, 8,  'FREELANCE', 'HARIAN_PRODUKSI', 7,  '2025-01-01', 'AKTIF', 1),
(20, 'EMP-020', 'Tedhi',                     'Tedhi',                     2, 9,  'FREELANCE', 'HARIAN_PRODUKSI', 24, '2025-03-01', 'AKTIF', 1),
(21, 'EMP-021', 'raka',                      'Rakha',                     2, 10, 'TRAINING',  'HARIAN_PRODUKSI', 38, '2025-06-01', 'AKTIF', 1),
(22, 'EMP-022', 'ujang',                     'Ujang',                     2, 10, 'TRAINING',  'HARIAN_PRODUKSI', 42, '2025-07-01', 'AKTIF', 1),
-- ---- Tambahan dari Ringkasan Kehadiran ----
(23, 'EMP-023', 'Jamilatun Naafiah',         'Jamilatun Naafiah',         1, 1,  'TETAP',     'HARIAN_PRODUKSI', 1,  '2022-05-01', 'AKTIF', 1),
(24, 'EMP-024', 'Wanti_Nova',                'Wanti Nova',                1, 1,  'TETAP',     'HARIAN_PRODUKSI', 3,  '2023-01-01', 'AKTIF', 1),
(25, 'EMP-025', 'Rinjani',                   'Rinjani',                   1, 1,  'TETAP',     'HARIAN_PRODUKSI', 4,  '2023-09-15', 'AKTIF', 1),
(26, 'EMP-026', 'Al_Fateha_Yasha',           'Al Fateha Yasha',           1, 1,  'TETAP',     'HARIAN_PRODUKSI', 5,  '2024-04-01', 'AKTIF', 1),
(27, 'EMP-027', 'Rindu',                     'Rindu',                     1, 1,  'TETAP',     'HARIAN_PRODUKSI', 6,  '2024-05-01', 'AKTIF', 1),
(28, 'EMP-028', 'Repi',                      'Repi',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 10, '2025-02-01', 'AKTIF', 1),
(29, 'EMP-029', 'Anggi',                     'Anggi',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 11, '2025-04-01', 'AKTIF', 1),
(30, 'EMP-030', 'Nuryanti',                  'Nuryanti',                  1, 4,  'TETAP',     'HARIAN_PRODUKSI', 14, '2023-06-15', 'AKTIF', 1),
(31, 'EMP-031', 'Riska',                     'Riska',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 15, '2025-05-01', 'AKTIF', 1),
(32, 'EMP-032', 'cecep',                     'Cecep',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 19, '2025-01-15', 'AKTIF', 1),
(33, 'EMP-033', 'abdul',                     'Abdul',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 23, '2025-03-10', 'AKTIF', 1),
(34, 'EMP-034', 'nurul',                     'Nurul',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 28, '2025-06-01', 'AKTIF', 1),
(35, 'EMP-035', 'agum',                      'Agum',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 29, '2025-07-01', 'AKTIF', 1),
(36, 'EMP-036', 'imam',                      'Imam Jamingil',             3, 12, 'TETAP',     'HARIAN_DRIVER',   30, '2023-10-01', 'AKTIF', 1),
(37, 'EMP-037', 'Jamilatun Naafia',          'Jamilatun Naafia (Fingerprint Alt)', 1, 1, 'TETAP', 'HARIAN_PRODUKSI', 0, '2022-05-01', 'NON_AKTIF', 1),
(38, 'EMP-038', 'Dewi',                      'Dewi',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 37, '2025-08-01', 'AKTIF', 1),
(39, 'EMP-039', 'novia',                     'Novia',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 41, '2025-08-01', 'AKTIF', 1),
(40, 'EMP-040', 'Aura',                      'Aura',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 31, '2025-05-15', 'AKTIF', 1),
-- ---- Driver ----
(41, 'DRV-001', 'Sigi',                      'Sigi Ramdan Adiputra',      3, 11, 'TETAP',     'HARIAN_DRIVER',   33, '2022-09-01', 'AKTIF', 1),
(42, 'DRV-002', 'Zaka',                      'Jakaria',                   3, 12, 'TETAP',     'HARIAN_DRIVER',   36, '2023-01-15', 'AKTIF', 1),
(43, 'DRV-003', 'Supri',                     'Supriyono',                 3, 13, 'TETAP',     'HARIAN_DRIVER',   35, '2022-07-01', 'AKTIF', 1),
(44, 'DRV-004', 'Aziz',                      'Abdullah Al Aziz',          3, 12, 'TETAP',     'HARIAN_DRIVER',   43, '2023-03-01', 'AKTIF', 1),
(45, 'DRV-005', 'Ridpan',                    'Ridpan Irpan (Farid)',       3, 11, 'TETAP',     'HARIAN_DRIVER',   34, '2023-05-01', 'AKTIF', 1),
(46, 'DRV-006', 'Candra',                    'Candra Agung Prasetya',     3, 12, 'TETAP',     'HARIAN_DRIVER',   44, '2023-08-01', 'AKTIF', 1),
(47, 'DRV-007', 'Rohani',                    'Muhamad Abdul Rohani',      3, 12, 'TETAP',     'HARIAN_DRIVER',   45, '2024-01-01', 'AKTIF', 1);
SELECT setval('hr_employees_id_seq', 60);

-- -----------------------------------------------------------------------------
-- SEED: hr_salary_structures
-- Sumber langsung dari Database_Gaji_Produksi.xlsx — semua nilai dalam Rupiah
-- effective_date: 2026-01-01 (berlaku dari awal 2026)
-- -----------------------------------------------------------------------------
INSERT INTO hr_salary_structures (employee_id, effective_date, gaji_pokok_harian, lembur_per_jam, tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3, created_by) VALUES
-- Produksi & Operasional
(1,  '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Wiwi Sumiati - Dishwash
(2,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Susani - Produksi
(3,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Riska Damayanti - Produksi
(4,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Ratna - Produksi
(5,  '2026-01-01', 75000,  8000,  NULL, NULL, NULL, 1),  -- Imas Munawaroh - Produksi
(6,  '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Ika Sartika - Dishwash
(7,  '2026-01-01', 80000,  8000,  NULL, NULL, NULL, 1),  -- Iin Yuliani - Produksi
(8,  '2026-01-01', 100000, 7000,  NULL, NULL, NULL, 1),  -- Elis Mulyani - Produksi
(9,  '2026-01-01', 80000,  7000,  NULL, NULL, NULL, 1),  -- Dana - Produksi
(10, '2026-01-01', 150000, 15000, NULL, NULL, NULL, 1),  -- Cepi Sutiaji - Koki
(11, '2026-01-01', 115000, 12000, NULL, NULL, NULL, 1),  -- Ade Kurnia - Koki
(12, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Raya - Karyawan Gudang
(13, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Partini - Produksi
(14, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Enung - Cleaning Service
(15, '2026-01-01', 110000, 10000, NULL, NULL, NULL, 1),  -- Dede Sihabudin - Koki
(16, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Ida - Tim Siap Saji
(17, '2026-01-01', 75000,  7000,  NULL, NULL, NULL, 1),  -- Feri - Tim Gudang
(18, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, 1),  -- Ari - Koki
(19, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Dimas - Freelance
(20, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, 1),  -- Tedhi - Freelance Koki
(21, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, 1),  -- Rakha - Training Koki
(22, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, 1),  -- Ujang - Training Koki
(23, '2026-01-01', 70000,  8000,  NULL, NULL, NULL, 1),  -- Jamilatun Naafiah (diperkirakan)
(24, '2026-01-01', 65000,  7000,  NULL, NULL, NULL, 1),  -- Wanti Nova
(25, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Rinjani
(26, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Al Fateha Yasha
(27, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Rindu
(28, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Repi
(29, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Anggi
(30, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Nuryanti
(31, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Riska
(32, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Cecep
(33, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Abdul
(34, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Nurul
(35, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Agum
(36, '2026-01-01', 85000,  10000, 10000, 15000, 20000, 1), -- Imam - Driver Mobil
(38, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Dewi
(39, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, 1),  -- Novia
(40, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, 1),  -- Aura
-- Driver
(41, '2026-01-01', 70000,  10000, 10000, 15000, 20000, 1), -- Sigi - Driver Motor
(42, '2026-01-01', 80000,  10000, 10000, 15000, 20000, 1), -- Jakaria - Driver Mobil
(43, '2026-01-01', 100000, 10000, 10000, 15000, 20000, 1), -- Supriyono - Leader Driver
(44, '2026-01-01', 80000,  10000, 10000, 15000, 20000, 1), -- Abdullah Al Aziz - Driver Mobil
(45, '2026-01-01', 70000,  10000, 10000, 15000, 20000, 1), -- Ridpan - Driver Motor
(46, '2026-01-01', 80000,  10000, 10000, 15000, 20000, 1), -- Candra - Driver Mobil
(47, '2026-01-01', 80000,  10000, 10000, 15000, 20000, 1); -- Rohani - Driver Mobil

-- -----------------------------------------------------------------------------
-- SEED: hr_payroll_rules (default — semua off)
-- -----------------------------------------------------------------------------
INSERT INTO hr_payroll_rules (potongan_terlambat_aktif, potongan_mode, potongan_tarif_per_menit, potongan_tarif_per_kejadian, potongan_toleransi_menit, potongan_maks_per_hari, lembur_maks_aktif, lembur_maks_jam_per_hari, lembur_maks_jam_per_bulan, lembur_perilaku_melewati, berlaku_mulai, catatan, created_by)
VALUES (FALSE, 'PER_MENIT', 0, 0, 0, 0, FALSE, 0, 0, 'TANDAI_SAJA', '2026-01-01', 'Default awal — semua aturan nonaktif', 1);

-- -----------------------------------------------------------------------------
-- SEED: hr_attendance_uploads (upload batch September 2026)
-- -----------------------------------------------------------------------------
INSERT INTO hr_attendance_uploads (id, periode_tahun, periode_bulan, nama_file, ukuran_file_bytes, format_file, status, total_rows, rows_matched, rows_unmatched, rows_anomali, uploaded_by) VALUES
(1, 2026, 9, 'AttendanceRecord_Sep2026.xlsx', 45312,  'FORMAT_A', 'DONE', 43, 42, 1, 18, 2),
(2, 2026, 9, 'AllReport_Sep2026.xls',         312400, 'FORMAT_B', 'DONE', 43, 43, 0, 23, 2);
SELECT setval('hr_attendance_uploads_id_seq', 10);

-- -----------------------------------------------------------------------------
-- SEED: hr_shift_assignments (September 2026, semua karyawan — Shift Pagi/Normal)
-- Dari Tabel Shift: semua karyawan masuk tanggal 01 Sep 2026
-- Shift pagi untuk karyawan yang jam masuknya 02:xx–08:xx, normal untuk yg lain
-- -----------------------------------------------------------------------------
INSERT INTO hr_shift_assignments (employee_id, shift_id, tanggal, tipe_shift, created_by) VALUES
(23, 1, '2026-09-01', 'PER',  2),  -- Jamilatun Naafiah - 07:46 → Shift Pagi
(7,  1, '2026-09-01', 'DEPT', 2),  -- Iin - 02:56 → Shift Pagi
(24, 2, '2026-09-01', 'PER',  2),  -- Wanti_Nova - 08:13 → Shift Normal
(25, 2, '2026-09-01', 'PER',  2),  -- Rinjani
(26, 2, '2026-09-01', 'PER',  2),  -- Al_Fateha_Yasha
(27, 1, '2026-09-01', 'PER',  2),  -- Rindu - 07:17 → Shift Pagi
(19, 1, '2026-09-01', 'DEPT', 2),  -- Dimas - 03:09 → Shift Pagi
(5,  2, '2026-09-01', 'DEPT', 2),  -- Imas
(12, 1, '2026-09-01', 'DEPT', 2),  -- Raya - 02:06 → Shift Pagi
(28, 2, '2026-09-01', 'DEPT', 2),  -- Repi
(29, 2, '2026-09-01', 'PER',  2),  -- Anggi
(11, 2, '2026-09-01', 'DEPT', 2),  -- Ade
(30, 2, '2026-09-01', 'DEPT', 2),  -- Nuryanti
(14, 1, '2026-09-01', 'DEPT', 2),  -- Enung - 04:47 → Shift Pagi
(3,  2, '2026-09-01', 'DEPT', 2),  -- Riska Damayanti
(9,  2, '2026-09-01', 'DEPT', 2),  -- Dana
(32, 2, '2026-09-01', 'DEPT', 2),  -- Cecep
(4,  2, '2026-09-01', 'DEPT', 2),  -- Ratna
(15, 1, '2026-09-01', 'DEPT', 2),  -- Dede - 02:28 → Shift Pagi
(18, 1, '2026-09-01', 'DEPT', 2),  -- Ari - 03:08 → Shift Pagi
(33, 2, '2026-09-01', 'DEPT', 2),  -- Abdul
(13, 1, '2026-09-01', 'DEPT', 2),  -- Partini - 05:10 → Shift Pagi
(10, 1, '2026-09-01', 'DEPT', 2),  -- Cepi - 02:37 → Shift Pagi (Production Dept.)
(2,  2, '2026-09-01', 'DEPT', 2),  -- Susani
(17, 1, '2026-09-01', 'DEPT', 2),  -- Fery - 02:13 → Shift Pagi
(34, 2, '2026-09-01', 'DEPT', 2),  -- Nurul
(35, 2, '2026-09-01', 'DEPT', 2),  -- Agum
(36, 2, '2026-09-01', 'DEPT', 2),  -- Imam
(8,  1, '2026-09-01', 'DEPT', 2),  -- Elis - 04:09 → Shift Pagi
(6,  2, '2026-09-01', 'DEPT', 2),  -- Ika
(41, 2, '2026-09-01', 'DEPT', 2),  -- Sigi
(45, 2, '2026-09-01', 'DEPT', 2),  -- Ridpan
(43, 2, '2026-09-01', 'DEPT', 2),  -- Supri
(42, 2, '2026-09-01', 'DEPT', 2),  -- Zaka
(38, 1, '2026-09-01', 'PER',  2),  -- Dewi - 07:56 → Shift Pagi
(16, 1, '2026-09-01', 'DEPT', 2),  -- IDA - 04:19 → Shift Pagi
(1,  2, '2026-09-01', 'DEPT', 2),  -- Wiwi
(39, 2, '2026-09-01', 'PER',  2),  -- Novia
(31, 2, '2026-09-01', 'DEPT', 2),  -- Riska (freelance)
(40, 1, '2026-09-01', 'DEPT', 2),  -- Aura - 08:04 → Shift Pagi
(21, 2, '2026-09-01', 'DEPT', 2),  -- Raka
(22, 1, '2026-09-01', 'DEPT', 2);  -- Ujang - 02:12 → Shift Pagi

-- -----------------------------------------------------------------------------
-- SEED: hr_attendances — data 2026-09-01 dari Perhitungan Tidak Normal
-- terlambat_menit dihitung dari shift masing-masing
-- Shift Pagi: masuk 02:00 → terlambat jika setelahnya
-- Shift Normal: masuk 09:00 → terlambat jika setelahnya
-- Dari data: menit = menit keterlambatan dari file fingerprint
-- -----------------------------------------------------------------------------
INSERT INTO hr_attendances (employee_id, upload_id, tanggal, jam_masuk, jam_keluar, keterangan, durasi_kerja_menit, terlambat_menit, keluar_awal_menit, lembur_menit, tidak_scan_lengkap, is_anomali, source, created_by) VALUES
-- id=23: Jamilatun Naafiah 07:46-16:45, terlambat 346 mnt (shift pagi 02:00)
(23, 2, '2026-09-01', '07:46', '16:45', 'HADIR',    539, 346, 0, 0,   FALSE, TRUE,  'UPLOAD', 2),
-- id=7: Iin 02:56-13:32, terlambat 56 mnt
(7,  2, '2026-09-01', '02:56', '13:32', 'HADIR',    636, 56,  0, 156, FALSE, TRUE,  'UPLOAD', 2),
-- id=24: Wanti_Nova 08:13-15:41, terlambat 373 mnt (shift normal 09:00, ini 08:13 = belum terlambat, tapi data menunjukkan 373 menit anomali)
(24, 2, '2026-09-01', '08:13', '15:41', 'HADIR',    448, 373, 0, 0,   FALSE, TRUE,  'UPLOAD', 2),
-- id=25: Rinjani hanya keluar 15:04, tidak scan masuk
(25, 2, '2026-09-01', NULL,    '15:04', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=26: Al_Fateha_Yasha tidak ada scan sama sekali → ABSEN
(26, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=27: Rindu 07:17-14:43, terlambat 317 mnt
(27, 2, '2026-09-01', '07:17', '14:43', 'HADIR',    446, 317, 0, 0,   FALSE, TRUE,  'UPLOAD', 2),
-- id=19: Dimas 03:09-12:24, terlambat 69 mnt
(19, 2, '2026-09-01', '03:09', '12:24', 'HADIR',    555, 69,  0, 75,  FALSE, TRUE,  'UPLOAD', 2),
-- id=5: Imas hanya keluar 12:20, tidak scan masuk
(5,  2, '2026-09-01', NULL,    '12:20', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=12: Raya 02:06-12:05, terlambat 6 mnt
(12, 2, '2026-09-01', '02:06', '12:05', 'HADIR',    599, 6,   0, 119, FALSE, TRUE,  'UPLOAD', 2),
-- id=28: Repi tidak hadir
(28, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=29: Anggi hanya scan masuk 08:03, tidak scan keluar
(29, 2, '2026-09-01', '08:03', NULL,    'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=11: Ade hanya keluar 12:58, tidak scan masuk
(11, 2, '2026-09-01', NULL,    '12:58', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=30: Nuryanti tidak hadir
(30, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=14: Enung 04:47-15:47, terlambat 167 mnt
(14, 2, '2026-09-01', '04:47', '15:47', 'HADIR',    600, 167, 0, 120, FALSE, TRUE,  'UPLOAD', 2),
-- id=3: Riska tidak hadir
(3,  2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=9: Dana tidak hadir
(9,  2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=32: Cecep tidak hadir
(32, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=4: Ratna hanya keluar 12:34, tidak scan masuk
(4,  2, '2026-09-01', NULL,    '12:34', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=15: Dede 02:28-12:08, terlambat 28 mnt
(15, 2, '2026-09-01', '02:28', '12:08', 'HADIR',    580, 28,  0, 100, FALSE, TRUE,  'UPLOAD', 2),
-- id=18: Ari 03:08-12:09, terlambat 68 mnt
(18, 2, '2026-09-01', '03:08', '12:09', 'HADIR',    541, 68,  0, 61,  FALSE, TRUE,  'UPLOAD', 2),
-- id=33: Abdul tidak hadir
(33, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=13: Partini 05:10-13:35, terlambat 190 mnt
(13, 2, '2026-09-01', '05:10', '13:35', 'HADIR',    505, 190, 0, 25,  FALSE, TRUE,  'UPLOAD', 2),
-- id=10: Cepi 02:37-11:59, terlambat 37 mnt
(10, 2, '2026-09-01', '02:37', '11:59', 'HADIR',    562, 37,  0, 82,  FALSE, TRUE,  'UPLOAD', 2),
-- id=2: Susani 09:54-18:xx (data: hadir, 0 menit terlambat di ringkasan tapi masuk 09:54)
(2,  2, '2026-09-01', '09:54', '18:00', 'HADIR',    486, 0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=17: Fery 02:13-12:03, terlambat 13 mnt
(17, 2, '2026-09-01', '02:13', '12:03', 'HADIR',    590, 13,  0, 110, FALSE, TRUE,  'UPLOAD', 2),
-- id=34: Nurul tidak hadir
(34, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=35: Agum tidak hadir
(35, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=36: Imam tidak hadir (driver)
(36, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=8: Elis 04:09-13:35, terlambat 129 mnt
(8,  2, '2026-09-01', '04:09', '13:35', 'HADIR',    566, 129, 0, 86,  FALSE, TRUE,  'UPLOAD', 2),
-- id=6: Ika hanya keluar 12:18, tidak scan masuk
(6,  2, '2026-09-01', NULL,    '12:18', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=41: Sigi tidak hadir (driver)
(41, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=45: Ridpan tidak hadir
(45, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=43: Supri tidak hadir
(43, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=42: Zaka tidak hadir
(42, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=38: Dewi 07:56-16:13, terlambat 356 mnt
(38, 2, '2026-09-01', '07:56', '16:13', 'HADIR',    497, 356, 0, 17,  FALSE, TRUE,  'UPLOAD', 2),
-- id=16: IDA 04:19-13:35, terlambat 139 mnt
(16, 2, '2026-09-01', '04:19', '13:35', 'HADIR',    556, 139, 0, 76,  FALSE, TRUE,  'UPLOAD', 2),
-- id=1: Wiwi hanya keluar 12:12, tidak scan masuk
(1,  2, '2026-09-01', NULL,    '12:12', 'HADIR',    0,   0,   0, 0,   TRUE,  TRUE,  'UPLOAD', 2),
-- id=39: Novia tidak hadir
(39, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=31: Riska (freelance) tidak hadir
(31, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=40: Aura 08:04-16:18, terlambat 364 mnt
(40, 2, '2026-09-01', '08:04', '16:18', 'HADIR',    494, 364, 0, 14,  FALSE, TRUE,  'UPLOAD', 2),
-- id=21: Raka tidak hadir
(21, 2, '2026-09-01', NULL,    NULL,    'ABSEN',    0,   0,   0, 0,   FALSE, FALSE, 'UPLOAD', 2),
-- id=22: Ujang 02:12-11:44, terlambat 12 mnt
(22, 2, '2026-09-01', '02:12', '11:44', 'HADIR',    572, 12,  0, 92,  FALSE, TRUE,  'UPLOAD', 2);

-- -----------------------------------------------------------------------------
-- SEED: hr_attendance_monthly_summary — September 2026
-- Data hanya 1 hari (01 Sep), jadi ini rekap 1 hari saja
-- -----------------------------------------------------------------------------
INSERT INTO hr_attendance_monthly_summary (employee_id, periode_tahun, periode_bulan, hari_kerja_jadwal, hari_hadir, hari_absen, total_terlambat_menit, total_tidak_scan_hari, total_lembur_menit) VALUES
(23, 2026, 9, 1, 1, 0, 346, 0, 0),
(7,  2026, 9, 1, 1, 0, 56,  0, 156),
(24, 2026, 9, 1, 1, 0, 373, 0, 0),
(25, 2026, 9, 1, 1, 0, 0,   1, 0),
(26, 2026, 9, 1, 0, 1, 0,   0, 0),
(27, 2026, 9, 1, 1, 0, 317, 0, 0),
(19, 2026, 9, 1, 1, 0, 69,  0, 75),
(5,  2026, 9, 1, 1, 0, 0,   1, 0),
(12, 2026, 9, 1, 1, 0, 6,   0, 119),
(28, 2026, 9, 1, 0, 1, 0,   0, 0),
(29, 2026, 9, 1, 1, 0, 0,   1, 0),
(11, 2026, 9, 1, 1, 0, 0,   1, 0),
(30, 2026, 9, 1, 0, 1, 0,   0, 0),
(14, 2026, 9, 1, 1, 0, 167, 0, 120),
(3,  2026, 9, 1, 0, 1, 0,   0, 0),
(9,  2026, 9, 1, 0, 1, 0,   0, 0),
(32, 2026, 9, 1, 0, 1, 0,   0, 0),
(4,  2026, 9, 1, 1, 0, 0,   1, 0),
(15, 2026, 9, 1, 1, 0, 28,  0, 100),
(18, 2026, 9, 1, 1, 0, 68,  0, 61),
(33, 2026, 9, 1, 0, 1, 0,   0, 0),
(13, 2026, 9, 1, 1, 0, 190, 0, 25),
(10, 2026, 9, 1, 1, 0, 37,  0, 82),
(2,  2026, 9, 1, 1, 0, 0,   0, 0),
(17, 2026, 9, 1, 1, 0, 13,  0, 110),
(34, 2026, 9, 1, 0, 1, 0,   0, 0),
(35, 2026, 9, 1, 0, 1, 0,   0, 0),
(36, 2026, 9, 1, 0, 1, 0,   0, 0),
(8,  2026, 9, 1, 1, 0, 129, 0, 86),
(6,  2026, 9, 1, 1, 0, 0,   1, 0),
(41, 2026, 9, 1, 0, 1, 0,   0, 0),
(45, 2026, 9, 1, 0, 1, 0,   0, 0),
(43, 2026, 9, 1, 0, 1, 0,   0, 0),
(42, 2026, 9, 1, 0, 1, 0,   0, 0),
(38, 2026, 9, 1, 1, 0, 356, 0, 17),
(16, 2026, 9, 1, 1, 0, 139, 0, 76),
(1,  2026, 9, 1, 1, 0, 0,   1, 0),
(39, 2026, 9, 1, 0, 1, 0,   0, 0),
(31, 2026, 9, 1, 0, 1, 0,   0, 0),
(40, 2026, 9, 1, 1, 0, 364, 0, 14),
(21, 2026, 9, 1, 0, 1, 0,   0, 0),
(22, 2026, 9, 1, 1, 0, 12,  0, 92);

-- -----------------------------------------------------------------------------
-- SEED: hr_payrolls — payroll September 2026 (DRAFT)
-- Hanya 1 hari data, jadi total dihitung dari 1 hari saja sebagai contoh realistis
-- -----------------------------------------------------------------------------
INSERT INTO hr_payrolls (id, periode_tahun, periode_bulan, nama_periode, status, total_karyawan, rules_snapshot, catatan, dihitung_oleh, dihitung_pada) VALUES
(1, 2026, 9, 'September 2026', 'DRAFT', 42,
 '{"potongan_terlambat_aktif": false, "lembur_maks_aktif": false}'::jsonb,
 'Data hanya 1 hari (01 Sep 2026) — sample seed', 2, '2026-09-02 10:00:00+07');
SELECT setval('hr_payrolls_id_seq', 10);

-- -----------------------------------------------------------------------------
-- SEED: hr_payroll_details — contoh karyawan yang hadir 01 Sep 2026
-- Hitung: gaji_pokok × 1 hari + lembur × jam lembur diakui
-- Karena aturan nonaktif: potongan_terlambat = 0, lembur_maks = aktual
-- -----------------------------------------------------------------------------
INSERT INTO hr_payroll_details (payroll_id, employee_id, snapshot_nama, snapshot_jabatan, snapshot_departemen, snapshot_tipe_gaji, hari_kerja_jadwal, hari_hadir, hari_absen, total_terlambat_menit, total_tidak_scan_hari, total_lembur_menit_aktual, total_lembur_menit_diakui, gaji_pokok_harian_snapshot, lembur_per_jam_snapshot, subtotal_gaji_pokok, subtotal_lembur, total_pendapatan, potongan_terlambat, potongan_lain, total_potongan, gaji_kotor, gaji_bersih, rules_snapshot) VALUES
-- Jamilatun Naafiah: hadir 1 hari, 0 mnt lembur, 346 mnt terlambat, potongan = 0 (off)
(1, 23, 'Jamilatun Naafiah', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 346, 0, 0,   0,   70000, 8000, 70000, 0,    70000, 0, 0, 0, 70000, 70000, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Iin: hadir 1 hari, 156 mnt = 2.6 jam lembur → 2.6×8000=20800
(1, 7,  'Iin Yuliani Marlina', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 56,  0, 156, 156, 80000, 8000, 80000, 20800, 100800, 0, 0, 0, 100800, 100800, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Wanti Nova: hadir 1 hari, 0 mnt lembur
(1, 24, 'Wanti Nova', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 373, 0, 0,   0,   65000, 7000, 65000, 0,    65000, 0, 0, 0, 65000, 65000, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Rinjani: hadir (tidak scan lengkap)
(1, 25, 'Rinjani', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 0, 1, 0, 0, 60000, 7000, 60000, 0, 60000, 0, 0, 0, 60000, 60000, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Enung: hadir 1 hari, 120 mnt = 2 jam lembur → 2×7000=14000
(1, 14, 'Enung Nuryanti', 'Cleaning Service', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 167, 0, 120, 120, 55000, 7000, 55000, 14000, 69000, 0, 0, 0, 69000, 69000, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Dede Sihabudin: hadir 1 hari, 100 mnt = 1.67 jam → 1.67×10000=16700
(1, 15, 'Dede Sihabudin', 'Koki', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 28, 0, 100, 100, 110000, 10000, 110000, 16667, 126667, 0, 0, 0, 126667, 126667, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Cepi Sutiaji: hadir 1 hari, 82 mnt = 1.37 jam → 1.37×15000=20500
(1, 10, 'Cepi Sutiaji', 'Koki', 'Production Dept.', 'HARIAN_PRODUKSI', 1, 1, 0, 37, 0, 82, 82, 150000, 15000, 150000, 20500, 170500, 0, 0, 0, 170500, 170500, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Raya: hadir 1 hari, 119 mnt = 1.98 jam → 1.98×7000=13860
(1, 12, 'Raya', 'Karyawan Gudang', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 6, 0, 119, 119, 60000, 7000, 60000, 13860, 73860, 0, 0, 0, 73860, 73860, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Elis: hadir 1 hari, 86 mnt = 1.43 jam → 1.43×7000=10010
(1, 8,  'Elis Mulyani', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 1, 0, 129, 0, 86, 86, 100000, 7000, 100000, 10010, 110010, 0, 0, 0, 110010, 110010, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb),
-- Absen (contoh Riska)
(1, 3,  'Riska Damayanti', 'Produksi', 'Company', 'HARIAN_PRODUKSI', 1, 0, 1, 0, 0, 0, 0, 60000, 7000, 0, 0, 0, 0, 0, 0, 0, 0, '{"potongan_terlambat_aktif":false,"lembur_maks_aktif":false}'::jsonb);

-- Update totals di header payroll
UPDATE hr_payrolls SET
    total_karyawan  = (SELECT COUNT(*) FROM hr_payroll_details WHERE payroll_id = 1),
    total_gaji_kotor = (SELECT COALESCE(SUM(gaji_kotor), 0) FROM hr_payroll_details WHERE payroll_id = 1),
    total_gaji_bersih = (SELECT COALESCE(SUM(gaji_bersih), 0) FROM hr_payroll_details WHERE payroll_id = 1),
    total_potongan = (SELECT COALESCE(SUM(total_potongan), 0) FROM hr_payroll_details WHERE payroll_id = 1)
WHERE id = 1;

-- =============================================================================
-- VIEWS UNTUK REPORTING (tidak blocking query, tapi bantu developer)
-- =============================================================================

-- View: rekap kehadiran bulanan dengan nama karyawan
CREATE OR REPLACE VIEW v_hr_attendance_monthly AS
SELECT
    s.id,
    s.periode_tahun,
    s.periode_bulan,
    e.kode_karyawan,
    e.nama_lengkap,
    d.nama  AS departemen,
    p.nama  AS jabatan,
    e.tipe_karyawan,
    s.hari_kerja_jadwal,
    s.hari_hadir,
    s.hari_absen,
    s.hari_cuti,
    s.hari_sakit,
    s.hari_izin,
    s.hari_dinas,
    s.total_terlambat_menit,
    ROUND(s.total_terlambat_menit::numeric / 60, 2) AS total_terlambat_jam,
    s.total_tidak_scan_hari,
    s.total_lembur_menit,
    ROUND(s.total_lembur_menit::numeric / 60, 2)   AS total_lembur_jam,
    s.last_computed_at
FROM hr_attendance_monthly_summary s
JOIN hr_employees   e ON e.id = s.employee_id
JOIN hr_departments d ON d.id = e.department_id
JOIN hr_positions   p ON p.id = e.position_id;

-- View: slip gaji lengkap per karyawan per payroll
CREATE OR REPLACE VIEW v_hr_payroll_slip AS
SELECT
    pd.id               AS detail_id,
    py.periode_tahun,
    py.periode_bulan,
    py.nama_periode,
    py.status           AS payroll_status,
    e.kode_karyawan,
    pd.snapshot_nama    AS nama_karyawan,
    pd.snapshot_jabatan,
    pd.snapshot_departemen,
    pd.snapshot_tipe_gaji,
    pd.hari_kerja_jadwal,
    pd.hari_hadir,
    pd.hari_absen,
    pd.total_terlambat_menit,
    pd.total_lembur_menit_aktual,
    pd.total_lembur_menit_diakui,
    pd.gaji_pokok_harian_snapshot,
    pd.subtotal_gaji_pokok,
    pd.subtotal_lembur,
    pd.tunjangan_km,
    pd.tunjangan_bonus,
    pd.tunjangan_tetap,
    pd.pembulatan,
    pd.total_pendapatan,
    pd.potongan_terlambat,
    pd.potongan_lain,
    pd.total_potongan,
    pd.gaji_kotor,
    pd.gaji_bersih,
    pd.catatan_payroll,
    pd.slip_url
FROM hr_payroll_details pd
JOIN hr_payrolls py ON py.id = pd.payroll_id
JOIN hr_employees e ON e.id  = pd.employee_id;

-- View: active salary structures (latest per employee)
CREATE OR REPLACE VIEW v_hr_active_salary AS
SELECT DISTINCT ON (ss.employee_id)
    ss.employee_id,
    e.kode_karyawan,
    e.nama_lengkap,
    e.tipe_gaji,
    ss.effective_date,
    ss.gaji_pokok_harian,
    ss.lembur_per_jam,
    ss.tunjangan_tetap,
    ss.tunjangan_km_tier1,
    ss.tunjangan_km_tier2,
    ss.tunjangan_km_tier3,
    ROUND(ss.gaji_pokok_harian::numeric / 8, 2) AS gaji_per_jam
FROM hr_salary_structures ss
JOIN hr_employees e ON e.id = ss.employee_id
WHERE e.status = 'AKTIF'
ORDER BY ss.employee_id, ss.effective_date DESC;

-- =============================================================================
-- RESET SEQUENCES agar aman setelah manual INSERT
-- =============================================================================
SELECT setval('hr_departments_id_seq',          (SELECT MAX(id) FROM hr_departments));
SELECT setval('hr_positions_id_seq',             (SELECT MAX(id) FROM hr_positions));
SELECT setval('hr_employees_id_seq',             (SELECT MAX(id) FROM hr_employees));
SELECT setval('hr_shifts_id_seq',                (SELECT MAX(id) FROM hr_shifts));
SELECT setval('hr_shift_assignments_id_seq',     (SELECT MAX(id) FROM hr_shift_assignments));
SELECT setval('hr_salary_structures_id_seq',     (SELECT MAX(id) FROM hr_salary_structures));
SELECT setval('hr_payroll_rules_id_seq',         (SELECT MAX(id) FROM hr_payroll_rules));
SELECT setval('hr_attendance_uploads_id_seq',    (SELECT MAX(id) FROM hr_attendance_uploads));
SELECT setval('hr_attendances_id_seq',           (SELECT MAX(id) FROM hr_attendances));
SELECT setval('hr_attendance_monthly_summary_id_seq', (SELECT MAX(id) FROM hr_attendance_monthly_summary));
SELECT setval('hr_payrolls_id_seq',              (SELECT MAX(id) FROM hr_payrolls));
SELECT setval('hr_payroll_details_id_seq',       (SELECT MAX(id) FROM hr_payroll_details));
SELECT setval('users_id_seq',                    (SELECT MAX(id) FROM users));

-- =============================================================================
-- END OF FILE
-- Tables  : 16 (users, 15 hr_*)
-- Indexes : 50+ (btree, brin, gin trigram)
-- Views   : 3
-- Seed rows: ~250+
-- =============================================================================
