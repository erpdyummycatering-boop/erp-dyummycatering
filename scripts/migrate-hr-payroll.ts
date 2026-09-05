import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Required for Node.js environment
neonConfig.webSocketConstructor = ws;

async function migrateAndSeedHR() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL or POSTGRES_URL is not defined in environment variables.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log("🚀 Starting HR & Payroll safe migration and seed...");

  try {
    await client.query("BEGIN");

    // 0. Ensure extensions
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE EXTENSION IF NOT EXISTS btree_gin;
    `);

    // Fetch a default user ID from existing users table for safe FK referencing
    const userRes = await client.query(`SELECT id FROM users ORDER BY id ASC LIMIT 1`);
    const defaultUserId = userRes.rows.length > 0 ? userRes.rows[0].id : null;
    console.log(`ℹ️ Default user ID for HR FK reference: ${defaultUserId || "NULL"}`);

    // 1. HR DEPARTMENTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_departments (
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
      CREATE INDEX IF NOT EXISTS idx_hr_departments_is_active ON hr_departments (is_active);
    `);

    // 2. HR POSITIONS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_positions (
          id                  BIGSERIAL       PRIMARY KEY,
          kode                VARCHAR(30)     NOT NULL,
          nama                VARCHAR(100)    NOT NULL,
          department_id       BIGINT          REFERENCES hr_departments(id) ON DELETE SET NULL,
          tipe_gaji           VARCHAR(30)     NOT NULL DEFAULT 'HARIAN_PRODUKSI',
          deskripsi           TEXT,
          is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
          created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_positions_kode UNIQUE (kode)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_positions_department_id ON hr_positions (department_id);
      CREATE INDEX IF NOT EXISTS idx_hr_positions_tipe_gaji     ON hr_positions (tipe_gaji);
      CREATE INDEX IF NOT EXISTS idx_hr_positions_is_active     ON hr_positions (is_active);
    `);

    // 3. HR EMPLOYEES
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employees (
          id                  BIGSERIAL       PRIMARY KEY,
          kode_karyawan       VARCHAR(20)     NOT NULL,
          nama_fingerprint    VARCHAR(100)    NOT NULL,
          nama_lengkap        VARCHAR(150)    NOT NULL,
          department_id       BIGINT          NOT NULL REFERENCES hr_departments(id),
          position_id         BIGINT          NOT NULL REFERENCES hr_positions(id),
          tipe_karyawan       VARCHAR(30)     NOT NULL DEFAULT 'TETAP',
          tipe_gaji           VARCHAR(30)     NOT NULL DEFAULT 'HARIAN_PRODUKSI',
          no_fingerprint      INTEGER,
          no_ktp              VARCHAR(20),
          email               VARCHAR(255),
          no_telepon          VARCHAR(20),
          npwp                VARCHAR(25),
          ptkp_status         VARCHAR(10),
          bpjs_ketenagakerjaan VARCHAR(25),
          bpjs_kesehatan      VARCHAR(25),
          tanggal_masuk       DATE            NOT NULL,
          tanggal_keluar      DATE,
          status              VARCHAR(20)     NOT NULL DEFAULT 'AKTIF',
          catatan             TEXT,
          user_id             BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_employees_kode            UNIQUE (kode_karyawan),
          CONSTRAINT uq_hr_employees_nama_fingerprint UNIQUE (nama_fingerprint)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_employees_department_id     ON hr_employees (department_id);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_position_id       ON hr_employees (position_id);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_status            ON hr_employees (status);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_tipe_karyawan     ON hr_employees (tipe_karyawan);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_tipe_gaji         ON hr_employees (tipe_gaji);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_no_fingerprint    ON hr_employees (no_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_tanggal_masuk     ON hr_employees (tanggal_masuk);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_nama_fingerprint_trgm ON hr_employees USING GIN (nama_fingerprint gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_nama_lengkap_trgm     ON hr_employees USING GIN (nama_lengkap gin_trgm_ops);
    `);

    // 4. HR SHIFTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_shifts (
          id                          BIGSERIAL       PRIMARY KEY,
          kode                        VARCHAR(30)     NOT NULL,
          nama                        VARCHAR(100)    NOT NULL,
          jam_masuk                   TIME            NOT NULL,
          jam_keluar                  TIME            NOT NULL,
          jam_kerja_normal_menit      INTEGER         NOT NULL DEFAULT 480,
          toleransi_terlambat_menit   INTEGER         NOT NULL DEFAULT 0,
          is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
          created_by                  BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_shifts_kode UNIQUE (kode)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_shifts_is_active ON hr_shifts (is_active);
    `);

    // 5. HR SHIFT ASSIGNMENTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_shift_assignments (
          id                  BIGSERIAL       PRIMARY KEY,
          employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
          shift_id            BIGINT          NOT NULL REFERENCES hr_shifts(id),
          tanggal             DATE            NOT NULL,
          tipe_shift          VARCHAR(10)     NOT NULL DEFAULT 'DEPT',
          created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_shift_assignments_emp_date UNIQUE (employee_id, tanggal)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_employee_id   ON hr_shift_assignments (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_shift_id      ON hr_shift_assignments (shift_id);
      CREATE INDEX IF NOT EXISTS idx_hr_shift_assignments_tanggal       ON hr_shift_assignments (tanggal);
    `);

    // 6. HR SALARY STRUCTURES
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_salary_structures (
          id                          BIGSERIAL       PRIMARY KEY,
          employee_id                 BIGINT          NOT NULL REFERENCES hr_employees(id),
          effective_date              DATE            NOT NULL,
          gaji_pokok_harian           BIGINT          NOT NULL DEFAULT 0,
          lembur_per_jam              BIGINT          NOT NULL DEFAULT 0,
          tunjangan_tetap             BIGINT          NOT NULL DEFAULT 0,
          tunjangan_km_tier1          BIGINT,
          tunjangan_km_tier2          BIGINT,
          tunjangan_km_tier3          BIGINT,
          catatan                     TEXT,
          created_by                  BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_salary_structures_emp_date UNIQUE (employee_id, effective_date)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_salary_structures_employee_id   ON hr_salary_structures (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_salary_structures_eff_date      ON hr_salary_structures (employee_id, effective_date DESC);
    `);

    // 7. HR PAYROLL RULES
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_rules (
          id                              BIGSERIAL       PRIMARY KEY,
          potongan_terlambat_aktif        BOOLEAN         NOT NULL DEFAULT FALSE,
          potongan_mode                   VARCHAR(20)     NOT NULL DEFAULT 'PER_MENIT',
          potongan_tarif_per_menit        BIGINT          NOT NULL DEFAULT 0,
          potongan_tarif_per_kejadian     BIGINT          NOT NULL DEFAULT 0,
          potongan_toleransi_menit        INTEGER         NOT NULL DEFAULT 0,
          potongan_maks_per_hari          BIGINT          NOT NULL DEFAULT 0,
          lembur_maks_aktif               BOOLEAN         NOT NULL DEFAULT FALSE,
          lembur_maks_jam_per_hari        NUMERIC(5,2)    NOT NULL DEFAULT 0,
          lembur_maks_jam_per_bulan       NUMERIC(6,2)    NOT NULL DEFAULT 0,
          lembur_perilaku_melewati        VARCHAR(20)     NOT NULL DEFAULT 'TANDAI_SAJA',
          berlaku_mulai                   DATE            NOT NULL DEFAULT CURRENT_DATE,
          catatan                         TEXT,
          created_by                      BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_payroll_rules_berlaku_mulai ON hr_payroll_rules (berlaku_mulai DESC);
    `);

    // 8. HR PAYROLL RULE OVERRIDES
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_rule_overrides (
          id                              BIGSERIAL       PRIMARY KEY,
          employee_id                     BIGINT          NOT NULL REFERENCES hr_employees(id),
          potongan_terlambat_aktif        BOOLEAN,
          potongan_tarif_per_menit        BIGINT,
          potongan_tarif_per_kejadian     BIGINT,
          lembur_maks_aktif               BOOLEAN,
          lembur_maks_jam_per_hari        NUMERIC(5,2),
          lembur_maks_jam_per_bulan       NUMERIC(6,2),
          lembur_perilaku_melewati        VARCHAR(20),
          berlaku_mulai                   DATE            NOT NULL DEFAULT CURRENT_DATE,
          berlaku_sampai                  DATE,
          catatan                         TEXT,
          created_by                      BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_rule_overrides_employee_id  ON hr_payroll_rule_overrides (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_rule_overrides_berlaku      ON hr_payroll_rule_overrides (employee_id, berlaku_mulai DESC);
    `);

    // 9. HR ATTENDANCE UPLOADS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_uploads (
          id                  BIGSERIAL       PRIMARY KEY,
          periode_tahun       SMALLINT        NOT NULL,
          periode_bulan       SMALLINT        NOT NULL,
          nama_file           VARCHAR(255)    NOT NULL,
          ukuran_file_bytes   BIGINT,
          format_file         VARCHAR(20)     NOT NULL,
          storage_url         VARCHAR(500),
          status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
          total_rows          INTEGER         NOT NULL DEFAULT 0,
          rows_matched        INTEGER         NOT NULL DEFAULT 0,
          rows_unmatched      INTEGER         NOT NULL DEFAULT 0,
          rows_anomali        INTEGER         NOT NULL DEFAULT 0,
          error_log           JSONB,
          unmatched_names     JSONB,
          uploaded_by         BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_att_uploads_periode  ON hr_attendance_uploads (periode_tahun, periode_bulan);
      CREATE INDEX IF NOT EXISTS idx_hr_att_uploads_status   ON hr_attendance_uploads (status);
      CREATE INDEX IF NOT EXISTS idx_hr_att_uploads_uploaded ON hr_attendance_uploads (uploaded_by);
    `);

    // 10. HR ATTENDANCES
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendances (
          id                      BIGSERIAL       PRIMARY KEY,
          employee_id             BIGINT          NOT NULL REFERENCES hr_employees(id),
          upload_id               BIGINT          REFERENCES hr_attendance_uploads(id) ON DELETE SET NULL,
          tanggal                 DATE            NOT NULL,
          jam_masuk               TIME,
          jam_keluar              TIME,
          jam_masuk_2             TIME,
          jam_keluar_2            TIME,
          jam_masuk_3             TIME,
          jam_keluar_3            TIME,
          keterangan              VARCHAR(20)     NOT NULL DEFAULT 'HADIR',
          durasi_kerja_menit      INTEGER,
          terlambat_menit         INTEGER         NOT NULL DEFAULT 0,
          keluar_awal_menit       INTEGER         NOT NULL DEFAULT 0,
          lembur_menit            INTEGER         NOT NULL DEFAULT 0,
          lembur_spesial_menit    INTEGER         NOT NULL DEFAULT 0,
          tidak_scan_lengkap      BOOLEAN         NOT NULL DEFAULT FALSE,
          is_anomali              BOOLEAN         NOT NULL DEFAULT FALSE,
          source                  VARCHAR(20)     NOT NULL DEFAULT 'UPLOAD',
          is_koreksi              BOOLEAN         NOT NULL DEFAULT FALSE,
          catatan                 TEXT,
          created_by              BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_attendances_emp_date UNIQUE (employee_id, tanggal)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_att_employee_id         ON hr_attendances (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_tanggal             ON hr_attendances (tanggal);
      CREATE INDEX IF NOT EXISTS idx_hr_att_emp_tanggal         ON hr_attendances (employee_id, tanggal);
      CREATE INDEX IF NOT EXISTS idx_hr_att_keterangan          ON hr_attendances (keterangan);
      CREATE INDEX IF NOT EXISTS idx_hr_att_upload_id           ON hr_attendances (upload_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_tanggal_brin        ON hr_attendances USING BRIN (tanggal);
    `);

    // 11. HR ATTENDANCE CORRECTIONS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_corrections (
          id                  BIGSERIAL       PRIMARY KEY,
          attendance_id       BIGINT          NOT NULL REFERENCES hr_attendances(id),
          employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
          field_changed       VARCHAR(50)     NOT NULL,
          nilai_sebelum       TEXT,
          nilai_sesudah       TEXT,
          alasan              TEXT,
          corrected_by        BIGINT          NOT NULL REFERENCES users(id),
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_att_corrections_attendance_id  ON hr_attendance_corrections (attendance_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_corrections_employee_id    ON hr_attendance_corrections (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_corrections_created_at     ON hr_attendance_corrections (created_at DESC);
    `);

    // 12. HR PAYROLLS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payrolls (
          id                  BIGSERIAL       PRIMARY KEY,
          periode_tahun       SMALLINT        NOT NULL,
          periode_bulan       SMALLINT        NOT NULL,
          nama_periode        VARCHAR(50)     NOT NULL,
          status              VARCHAR(25)     NOT NULL DEFAULT 'DRAFT',
          total_karyawan      INTEGER         NOT NULL DEFAULT 0,
          total_gaji_kotor    BIGINT          NOT NULL DEFAULT 0,
          total_gaji_bersih   BIGINT          NOT NULL DEFAULT 0,
          total_potongan      BIGINT          NOT NULL DEFAULT 0,
          rules_snapshot      JSONB,
          catatan             TEXT,
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
          external_ref_id     VARCHAR(100),
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_payrolls_periode UNIQUE (periode_tahun, periode_bulan)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_payrolls_status          ON hr_payrolls (status);
      CREATE INDEX IF NOT EXISTS idx_hr_payrolls_periode         ON hr_payrolls (periode_tahun, periode_bulan);
    `);

    // 13. HR PAYROLL DETAILS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_details (
          id                              BIGSERIAL       PRIMARY KEY,
          payroll_id                      BIGINT          NOT NULL REFERENCES hr_payrolls(id),
          employee_id                     BIGINT          NOT NULL REFERENCES hr_employees(id),
          snapshot_nama                   VARCHAR(150)    NOT NULL,
          snapshot_jabatan                VARCHAR(100),
          snapshot_departemen             VARCHAR(100),
          snapshot_tipe_gaji              VARCHAR(30),
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
          total_lembur_menit_aktual       INTEGER         NOT NULL DEFAULT 0,
          total_lembur_menit_diakui       INTEGER         NOT NULL DEFAULT 0,
          lembur_melewati_batas           BOOLEAN         NOT NULL DEFAULT FALSE,
          gaji_pokok_harian_snapshot      BIGINT          NOT NULL DEFAULT 0,
          lembur_per_jam_snapshot         BIGINT          NOT NULL DEFAULT 0,
          subtotal_gaji_pokok             BIGINT          NOT NULL DEFAULT 0,
          subtotal_lembur                 BIGINT          NOT NULL DEFAULT 0,
          tunjangan_km                    BIGINT          NOT NULL DEFAULT 0,
          km_perjalanan                   INTEGER,
          tunjangan_bonus                 BIGINT          NOT NULL DEFAULT 0,
          tunjangan_tetap                 BIGINT          NOT NULL DEFAULT 0,
          pembulatan                      BIGINT          NOT NULL DEFAULT 0,
          total_pendapatan                BIGINT          NOT NULL DEFAULT 0,
          potongan_terlambat              BIGINT          NOT NULL DEFAULT 0,
          potongan_lain                   BIGINT          NOT NULL DEFAULT 0,
          total_potongan                  BIGINT          NOT NULL DEFAULT 0,
          gaji_kotor                      BIGINT          NOT NULL DEFAULT 0,
          gaji_bersih                     BIGINT          NOT NULL DEFAULT 0,
          override_lembur_diakui          BIGINT,
          override_potongan_terlambat     BIGINT,
          rules_snapshot                  JSONB,
          catatan_payroll                 TEXT,
          slip_url                        VARCHAR(500),
          slip_generated_at               TIMESTAMPTZ,
          created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_payroll_details_payroll_emp UNIQUE (payroll_id, employee_id)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_pd_payroll_id      ON hr_payroll_details (payroll_id);
      CREATE INDEX IF NOT EXISTS idx_hr_pd_employee_id     ON hr_payroll_details (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_pd_emp_payroll     ON hr_payroll_details (employee_id, payroll_id);
    `);

    // 14. HR DRIVER TRIPS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_driver_trips (
          id                  BIGSERIAL       PRIMARY KEY,
          payroll_detail_id   BIGINT          NOT NULL REFERENCES hr_payroll_details(id),
          employee_id         BIGINT          NOT NULL REFERENCES hr_employees(id),
          tanggal             DATE            NOT NULL,
          km                  INTEGER         NOT NULL DEFAULT 0,
          tier                VARCHAR(10),
          tunjangan_km        BIGINT          NOT NULL DEFAULT 0,
          keterangan          TEXT,
          created_by          BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_driver_trips_payroll_detail ON hr_driver_trips (payroll_detail_id);
      CREATE INDEX IF NOT EXISTS idx_hr_driver_trips_employee_id    ON hr_driver_trips (employee_id);
    `);

    // 15. HR ATTENDANCE MONTHLY SUMMARY
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_monthly_summary (
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
          last_computed_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          created_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          updated_at                      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_hr_att_monthly_emp_periode UNIQUE (employee_id, periode_tahun, periode_bulan)
      );
      CREATE INDEX IF NOT EXISTS idx_hr_att_monthly_emp         ON hr_attendance_monthly_summary (employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_att_monthly_periode     ON hr_attendance_monthly_summary (periode_tahun, periode_bulan);
    `);

    // 16. HR AUDIT LOGS
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_audit_logs (
          id                  BIGSERIAL       PRIMARY KEY,
          tabel               VARCHAR(100)    NOT NULL,
          record_id           BIGINT          NOT NULL,
          aksi                VARCHAR(20)     NOT NULL,
          data_sebelum        JSONB,
          data_sesudah        JSONB,
          user_id             BIGINT          REFERENCES users(id) ON DELETE SET NULL,
          ip_address          VARCHAR(45),
          created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_tabel        ON hr_audit_logs (tabel, record_id);
      CREATE INDEX IF NOT EXISTS idx_hr_audit_logs_created_at   ON hr_audit_logs (created_at DESC);
    `);

    console.log("✅ Tables and indexes created safely.");

    // =========================================================================
    // SEEDING HR DATA (IDEMPOTENT / SAFE)
    // =========================================================================
    console.log("🌱 Seeding HR Master Data...");

    // Seed Departments
    await client.query(`
      INSERT INTO hr_departments (id, kode, nama, deskripsi, created_by) VALUES
      (1, 'COMPANY',  'Company',          'Departemen umum / produksi umum',       ${defaultUserId ? defaultUserId : "NULL"}),
      (2, 'PRODUKSI', 'Production Dept.', 'Departemen produksi khusus (koki, dll)',  ${defaultUserId ? defaultUserId : "NULL"}),
      (3, 'DRIVER',   'Driver Dept.',     'Departemen driver pengiriman',           ${defaultUserId ? defaultUserId : "NULL"})
      ON CONFLICT (kode) DO NOTHING;
      SELECT setval('hr_departments_id_seq', GREATEST((SELECT MAX(id) FROM hr_departments), 1));
    `);

    // Seed Positions
    await client.query(`
      INSERT INTO hr_positions (id, kode, nama, department_id, tipe_gaji, created_by) VALUES
      (1,  'PRODUKSI',        'Produksi',         1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (2,  'DISHWASH',        'Dishwash',         1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (3,  'KOKI',            'Koki',             2, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (4,  'CLEANING',        'Cleaning Service', 1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (5,  'GUDANG',          'Karyawan Gudang',  1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (6,  'TIM_GUDANG',      'Tim Gudang',       1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (7,  'TIM_SIAP_SAJI',   'Tim Siap Saji',    1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (8,  'FREELANCE',       'Freelance',        1, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (9,  'FREELANCE_KOKI',  'Freelance Koki',   2, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (10, 'TRAINING_KOKI',   'Training Koki',    2, 'HARIAN_PRODUKSI', ${defaultUserId ? defaultUserId : "NULL"}),
      (11, 'DRIVER_MOTOR',    'Driver Motor',     3, 'HARIAN_DRIVER',   ${defaultUserId ? defaultUserId : "NULL"}),
      (12, 'DRIVER_MOBIL',    'Driver Mobil',     3, 'HARIAN_DRIVER',   ${defaultUserId ? defaultUserId : "NULL"}),
      (13, 'LEADER_DRIVER',   'Leader Driver',    3, 'HARIAN_DRIVER',   ${defaultUserId ? defaultUserId : "NULL"})
      ON CONFLICT (kode) DO NOTHING;
      SELECT setval('hr_positions_id_seq', GREATEST((SELECT MAX(id) FROM hr_positions), 1));
    `);

    // Seed Shifts
    await client.query(`
      INSERT INTO hr_shifts (id, kode, nama, jam_masuk, jam_keluar, jam_kerja_normal_menit, toleransi_terlambat_menit, created_by) VALUES
      (1, 'SHIFT_PAGI',   'Shift Pagi (02:00-10:00)',   '02:00', '10:00', 480, 15, ${defaultUserId ? defaultUserId : "NULL"}),
      (2, 'SHIFT_NORMAL', 'Shift Normal (09:00-18:00)', '09:00', '18:00', 480, 15, ${defaultUserId ? defaultUserId : "NULL"})
      ON CONFLICT (kode) DO NOTHING;
      SELECT setval('hr_shifts_id_seq', GREATEST((SELECT MAX(id) FROM hr_shifts), 1));
    `);

    // Seed Employees
    await client.query(`
      INSERT INTO hr_employees (id, kode_karyawan, nama_fingerprint, nama_lengkap, department_id, position_id, tipe_karyawan, tipe_gaji, no_fingerprint, tanggal_masuk, status, created_by) VALUES
      (1,  'EMP-001', 'Wiwi Sumiati',              'Wiwi Sumiati',              1, 2,  'TETAP',     'HARIAN_PRODUKSI', 40, '2024-01-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (2,  'EMP-002', 'Susani',                    'Susani',                    1, 1,  'TETAP',     'HARIAN_PRODUKSI', 26, '2023-06-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (3,  'EMP-003', 'Riska Damayanti',           'Riska Damayanti',           1, 1,  'TETAP',     'HARIAN_PRODUKSI', 17, '2023-08-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (4,  'EMP-004', 'ratna',                     'Ratna (Enok)',               1, 1,  'TETAP',     'HARIAN_PRODUKSI', 20, '2023-09-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (5,  'EMP-005', 'Imas',                      'Imas Munawaroh',            1, 1,  'TETAP',     'HARIAN_PRODUKSI', 8,  '2023-05-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (6,  'EMP-006', 'Ika',                       'Ika Sartika',               1, 2,  'TETAP',     'HARIAN_PRODUKSI', 12, '2024-02-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (7,  'EMP-007', 'Iin',                       'Iin Yuliani Marlina',       1, 1,  'TETAP',     'HARIAN_PRODUKSI', 2,  '2022-11-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (8,  'EMP-008', 'Elis',                      'Elis Mulyani',              1, 1,  'TETAP',     'HARIAN_PRODUKSI', 32, '2023-03-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (9,  'EMP-009', 'Dana',                      'Husain Pria Wardana',       1, 1,  'TETAP',     'HARIAN_PRODUKSI', 18, '2023-07-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (10, 'EMP-010', 'cepi',                      'Cepi Sutiaji',              2, 3,  'TETAP',     'HARIAN_PRODUKSI', 25, '2022-08-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (11, 'EMP-011', 'Ade',                       'Ade Kurnia',                2, 3,  'TETAP',     'HARIAN_PRODUKSI', 13, '2023-04-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (12, 'EMP-012', 'Raya',                      'Raya',                      1, 5,  'TETAP',     'HARIAN_PRODUKSI', 9,  '2024-01-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (13, 'EMP-013', 'partini',                   'Partini',                   1, 1,  'TETAP',     'HARIAN_PRODUKSI', 24, '2023-10-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (14, 'EMP-014', 'Enung',                     'Enung Nuryanti',            1, 4,  'TETAP',     'HARIAN_PRODUKSI', 16, '2023-11-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (15, 'EMP-015', 'Dede',                      'Dede Sihabudin',            2, 3,  'TETAP',     'HARIAN_PRODUKSI', 21, '2023-02-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (16, 'EMP-016', 'IDA',                       'Ida',                       1, 7,  'TETAP',     'HARIAN_PRODUKSI', 39, '2024-03-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (17, 'EMP-017', 'fery',                      'Feri',                      1, 6,  'TETAP',     'HARIAN_PRODUKSI', 27, '2023-12-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (18, 'EMP-018', 'ari',                       'Ashari Samsu Musalim',      2, 3,  'TETAP',     'HARIAN_PRODUKSI', 22, '2024-01-10', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (19, 'EMP-019', 'Dimas',                     'Dimas',                     1, 8,  'FREELANCE', 'HARIAN_PRODUKSI', 7,  '2025-01-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (20, 'EMP-020', 'Tedhi',                     'Tedhi',                     2, 9,  'FREELANCE', 'HARIAN_PRODUKSI', 24, '2025-03-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (21, 'EMP-021', 'raka',                      'Rakha',                     2, 10, 'TRAINING',  'HARIAN_PRODUKSI', 38, '2025-06-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (22, 'EMP-022', 'ujang',                     'Ujang',                     2, 10, 'TRAINING',  'HARIAN_PRODUKSI', 42, '2025-07-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (23, 'EMP-023', 'Jamilatun Naafiah',         'Jamilatun Naafiah',         1, 1,  'TETAP',     'HARIAN_PRODUKSI', 1,  '2022-05-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (24, 'EMP-024', 'Wanti_Nova',                'Wanti Nova',                1, 1,  'TETAP',     'HARIAN_PRODUKSI', 3,  '2023-01-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (25, 'EMP-025', 'Rinjani',                   'Rinjani',                   1, 1,  'TETAP',     'HARIAN_PRODUKSI', 4,  '2023-09-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (26, 'EMP-026', 'Al_Fateha_Yasha',           'Al Fateha Yasha',           1, 1,  'TETAP',     'HARIAN_PRODUKSI', 5,  '2024-04-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (27, 'EMP-027', 'Rindu',                     'Rindu',                     1, 1,  'TETAP',     'HARIAN_PRODUKSI', 6,  '2024-05-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (28, 'EMP-028', 'Repi',                      'Repi',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 10, '2025-02-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (29, 'EMP-029', 'Anggi',                     'Anggi',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 11, '2025-04-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (30, 'EMP-030', 'Nuryanti',                  'Nuryanti',                  1, 4,  'TETAP',     'HARIAN_PRODUKSI', 14, '2023-06-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (31, 'EMP-031', 'Riska',                     'Riska',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 15, '2025-05-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (32, 'EMP-032', 'cecep',                     'Cecep',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 19, '2025-01-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (33, 'EMP-033', 'abdul',                     'Abdul',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 23, '2025-03-10', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (34, 'EMP-034', 'nurul',                     'Nurul',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 28, '2025-06-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (35, 'EMP-035', 'agum',                      'Agum',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 29, '2025-07-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (36, 'EMP-036', 'imam',                      'Imam Jamingil',             3, 12, 'TETAP',     'HARIAN_DRIVER',   30, '2023-10-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (37, 'EMP-037', 'Jamilatun Naafia',          'Jamilatun Naafia (Alt)',    1, 1,  'TETAP',     'HARIAN_PRODUKSI', 0,  '2022-05-01', 'NON_AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (38, 'EMP-038', 'Dewi',                      'Dewi',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 37, '2025-08-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (39, 'EMP-039', 'novia',                     'Novia',                     1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 41, '2025-08-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (40, 'EMP-040', 'Aura',                      'Aura',                      1, 1,  'FREELANCE', 'HARIAN_PRODUKSI', 31, '2025-05-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (41, 'DRV-001', 'Sigi',                      'Sigi Ramdan Adiputra',      3, 11, 'TETAP',     'HARIAN_DRIVER',   33, '2022-09-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (42, 'DRV-002', 'Zaka',                      'Jakaria',                   3, 12, 'TETAP',     'HARIAN_DRIVER',   36, '2023-01-15', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (43, 'DRV-003', 'Supri',                     'Supriyono',                 3, 13, 'TETAP',     'HARIAN_DRIVER',   35, '2022-07-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (44, 'DRV-004', 'Aziz',                      'Abdullah Al Aziz',          3, 12, 'TETAP',     'HARIAN_DRIVER',   43, '2023-03-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (45, 'DRV-005', 'Ridpan',                    'Ridpan Irpan (Farid)',       3, 11, 'TETAP',     'HARIAN_DRIVER',   34, '2023-05-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (46, 'DRV-006', 'Candra',                    'Candra Agung Prasetya',     3, 12, 'TETAP',     'HARIAN_DRIVER',   44, '2023-08-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"}),
      (47, 'DRV-007', 'Rohani',                    'Muhamad Abdul Rohani',      3, 12, 'TETAP',     'HARIAN_DRIVER',   45, '2024-01-01', 'AKTIF', ${defaultUserId ? defaultUserId : "NULL"})
      ON CONFLICT (kode_karyawan) DO NOTHING;
      SELECT setval('hr_employees_id_seq', GREATEST((SELECT MAX(id) FROM hr_employees), 1));
    `);

    // Seed Salary Structures
    await client.query(`
      INSERT INTO hr_salary_structures (employee_id, effective_date, gaji_pokok_harian, lembur_per_jam, tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3, created_by) VALUES
      (1,  '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (2,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (3,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (4,  '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (5,  '2026-01-01', 75000,  8000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (6,  '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (7,  '2026-01-01', 80000,  8000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (8,  '2026-01-01', 100000, 7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (9,  '2026-01-01', 80000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (10, '2026-01-01', 150000, 15000, NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (11, '2026-01-01', 115000, 12000, NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (12, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (13, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (14, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (15, '2026-01-01', 110000, 10000, NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (16, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (17, '2026-01-01', 75000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (18, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (19, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (20, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (21, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (22, '2026-01-01', 80000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (23, '2026-01-01', 70000,  8000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (24, '2026-01-01', 65000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (25, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (26, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (27, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (28, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (29, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (30, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (31, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (32, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (33, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (34, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (35, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (36, '2026-01-01', 85000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (38, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (39, '2026-01-01', 55000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (40, '2026-01-01', 60000,  7000,  NULL, NULL, NULL, ${defaultUserId ? defaultUserId : "NULL"}),
      (41, '2026-01-01', 70000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (42, '2026-01-01', 80000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (43, '2026-01-01', 100000, 10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (44, '2026-01-01', 80000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (45, '2026-01-01', 70000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (46, '2026-01-01', 80000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"}),
      (47, '2026-01-01', 80000,  10000, 10000, 15000, 20000, ${defaultUserId ? defaultUserId : "NULL"})
      ON CONFLICT (employee_id, effective_date) DO NOTHING;
    `);

    // Seed Payroll Rules
    const rulesCheck = await client.query(`SELECT COUNT(*) FROM hr_payroll_rules`);
    if (parseInt(rulesCheck.rows[0].count, 10) === 0) {
      await client.query(`
        INSERT INTO hr_payroll_rules (potongan_terlambat_aktif, potongan_mode, potongan_tarif_per_menit, potongan_tarif_per_kejadian, potongan_toleransi_menit, potongan_maks_per_hari, lembur_maks_aktif, lembur_maks_jam_per_hari, lembur_maks_jam_per_bulan, lembur_perilaku_melewati, berlaku_mulai, catatan, created_by)
        VALUES (FALSE, 'PER_MENIT', 0, 0, 0, 0, FALSE, 0, 0, 'TANDAI_SAJA', '2026-01-01', 'Default awal — semua aturan nonaktif', ${defaultUserId ? defaultUserId : "NULL"});
      `);
    }

    // Views creation
    await client.query(`
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
    `);

    await client.query("COMMIT");
    console.log("🎉 HR & Payroll migration & seed completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ HR Migration failed, rolled back:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAndSeedHR();
