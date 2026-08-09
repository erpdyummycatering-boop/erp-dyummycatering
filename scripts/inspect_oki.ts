import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
neonConfig.webSocketConstructor = ws;

async function inspectOki() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
  
  const custRes = await pool.query("SELECT id, name, phone FROM customers WHERE name ILIKE '%oki%' ORDER BY id ASC");
  console.log(`--- ALL OKI CUSTOMERS (Count: ${custRes.rows.length}) ---`);
  for (const c of custRes.rows) {
    const ordersCount = await pool.query("SELECT COUNT(*) FROM orders WHERE customer_id = $1", [c.id]);
    console.log(`ID ${c.id}: "${c.name}" | Phone: ${c.phone || '-'} | Linked Orders: ${ordersCount.rows[0].count}`);
  }
  
  await pool.end();
}

inspectOki().catch(console.error);
