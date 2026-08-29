import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

neonConfig.webSocketConstructor = ws;

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL or POSTGRES_URL is not defined in environment variables.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    console.log("Adding discount columns to orders table...");
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) DEFAULT 'nominal';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(15, 2) DEFAULT 0;
    `);
    console.log("✅ Discount columns added/verified successfully.");
  } catch (err) {
    console.error("❌ Error adding columns:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
