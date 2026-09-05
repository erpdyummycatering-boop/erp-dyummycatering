import pool from "../lib/db";

async function runFullMigrationAndSeed() {
  const client = await pool.connect();
  try {
    console.log("Memulai penyesuaian/migrasi kolom & tabel yang belum ada...");

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
    console.log("✓ Tabel drivers dipastikan aman.");

    // 2. Tambahkan kolom driver_id & driver_name di tabel orders jika belum ada
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL;
    `);
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255);
    `);
    console.log("✓ Kolom driver_id & driver_name pada tabel orders dipastikan aman.");

    // 3. Tambahkan kolom shipping_status di tabel orders jika belum ada
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_status VARCHAR(50) DEFAULT 'Menunggu';
    `);
    console.log("✓ Kolom shipping_status pada tabel orders dipastikan aman.");

    // 4. Tambahkan kolom recipient_name & recipient_phone jika belum ada
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(255);
    `);
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50);
    `);
    console.log("✓ Kolom recipient_name & recipient_phone pada tabel orders dipastikan aman.");

    // 5. Seed default drivers jika kosong
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
      console.log(`ℹ Data drivers sudah berisi ${currentCount} record, seed dilewati agar data eksisting aman.`);
    }

    console.log("SUKSES: Seluruh kolom dan tabel berhasil disesuaikan secara aman tanpa menghapus data!");
  } catch (error) {
    console.error("❌ Gagal migrasi:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

runFullMigrationAndSeed();
