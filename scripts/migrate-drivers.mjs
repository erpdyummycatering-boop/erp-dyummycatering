import pool from "../lib/db.js";

async function runDriverMigrationAndSeed() {
  const client = await pool.connect();
  try {
    console.log("Memulai migrasi tabel drivers...");

    // 1. Buat tabel drivers jika belum ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Aktif',
        lini VARCHAR(50) DEFAULT 'siap_saji',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✓ Tabel drivers berhasil dipastikan (CREATE TABLE IF NOT EXISTS).");

    // 2. Tambah kolom driver_id ke tabel orders jika belum ada
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL;
    `);
    console.log("✓ Kolom driver_id pada tabel orders berhasil dipastikan (ALTER TABLE ADD COLUMN IF NOT EXISTS).");

    // 3. Seed data driver default jika tabel drivers (lini siap_saji) masih kosong
    const countRes = await client.query("SELECT COUNT(*) FROM drivers WHERE lini = 'siap_saji'");
    const currentCount = Number(countRes.rows[0].count);

    if (currentCount === 0) {
      await client.query(`
        INSERT INTO drivers (name, status, lini) VALUES
        ('driver Hendi', 'Aktif', 'siap_saji'),
        ('driver Supriyono', 'Aktif', 'siap_saji'),
        ('driver Daffa', 'Aktif', 'siap_saji');
      `);
      console.log("✓ Seed 3 driver default ('driver Hendi', 'driver Supriyono', 'driver Daffa') berhasil ditambahkan.");
    } else {
      console.log(`ℹ Data drivers sudah berisi ${currentCount} record, seed dilewati agar tidak terjadi duplikasi.`);
    }

    console.log("Migration dan seed drivers SELESAI dengan aman tanpa menghapus data lain.");
  } catch (error) {
    console.error("❌ Gagal menjalankan migrasi/seed driver:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

runDriverMigrationAndSeed();
