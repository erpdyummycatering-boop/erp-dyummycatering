import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Required for Node.js environment (not browser)
neonConfig.webSocketConstructor = ws;

async function migrate() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL or POSTGRES_URL is not defined in environment variables.");
    process.exit(1);
  }
  
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log("🚀 Starting database alteration...");

  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS jenis_order VARCHAR(50);");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS closing_date DATE;");
    await client.query("COMMIT");
    console.log("✅ Alteration completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Alteration failed, rolled back:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
