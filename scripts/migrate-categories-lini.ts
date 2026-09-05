import pool from "../lib/db";

async function runCategoryLiniMigration() {
  const client = await pool.connect();
  try {
    console.log("Memulai migrasi flag lini pada product_categories...");

    // 1. Tambah kolom lini dan description jika belum ada
    await client.query(`
      ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS lini VARCHAR(50) DEFAULT 'catering';
    `);
    await client.query(`
      ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS description TEXT;
    `);
    await client.query(`
      ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    console.log("✓ Kolom lini, description, dan is_active pada product_categories dipastikan ada.");

    // 2. Set kategori catering
    const cateringCategories = ['Nasi Box', 'Snack Box', 'Prasmanan', 'Tumpeng', 'Coffee Break'];
    await client.query(
      `UPDATE product_categories SET lini = 'catering' WHERE name = ANY($1::text[])`,
      [cateringCategories]
    );

    // 3. Set kategori siap_saji
    const siapSajiCategories = [
      'Lauk Ayam',
      'Lauk Daging',
      'Lauk Ikan & Seafood',
      'Lauk Telur',
      'Sayuran & Tumisan',
      'Sup & Kuah',
      'Mie & Nasi Goreng'
    ];
    await client.query(
      `UPDATE product_categories SET lini = 'siap_saji' WHERE name = ANY($1::text[])`,
      [siapSajiCategories]
    );

    console.log("✓ Berhasil mengupdate flag lini untuk kategori Catering dan Siap Saji.");
  } catch (error) {
    console.error("❌ Gagal migrasi kategori:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

runCategoryLiniMigration();
