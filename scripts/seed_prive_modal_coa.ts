import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
neonConfig.webSocketConstructor = ws;

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is missing.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    console.log("Seeding COA accounts for Prive & Modal Owner...");
    
    // Ensure Modal Owner account exists
    await client.query(`
      INSERT INTO coa (lini, kode_akun, nama_akun, kelompok, sub_kelompok, is_active)
      VALUES ('siap_saji', '3-1001', 'Modal Owner', 'Ekuitas', 'Modal Disetor', true)
      ON CONFLICT (lini, kode_akun) DO NOTHING;
    `);

    // Ensure Prive Owner account exists
    await client.query(`
      INSERT INTO coa (lini, kode_akun, nama_akun, kelompok, sub_kelompok, is_active)
      VALUES ('siap_saji', '3-2001', 'Prive Owner', 'Ekuitas', 'Penarikan Owner', true)
      ON CONFLICT (lini, kode_akun) DO NOTHING;
    `);

    console.log("✅ COA accounts verified/added successfully.");
  } catch (err) {
    console.error("❌ Seeding COA failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
