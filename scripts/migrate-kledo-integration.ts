import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
neonConfig.webSocketConstructor = ws;

async function migrate() {
  if (process.env.ALLOW_KLEDO_MIGRATE !== "staging") {
    console.error("Migrasi tidak dijalankan. Set ALLOW_KLEDO_MIGRATE=staging untuk menerapkan refs/kledo_integration.sql ke Neon staging.");
    process.exit(1);
  }
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("DATABASE_URL atau POSTGRES_URL belum diisi.");
    process.exit(1);
  }
  if (connectionString.includes("br-frosty-paper")) {
    console.error("Ditolak: connection string mengarah ke branch produksi.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const sqlPath = path.resolve(process.cwd(), "refs/kledo_integration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf8");
  console.log("Menerapkan refs/kledo_integration.sql ...");
  try {
    await client.query(sqlContent);
    console.log("Migrasi Kledo selesai.");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* file sudah memuat BEGIN/COMMIT */ }
    console.error("Migrasi Kledo gagal:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
