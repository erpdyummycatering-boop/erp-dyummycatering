import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

neonConfig.webSocketConstructor = ws;

const DB = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const pool = new Pool({ connectionString: DB });

async function q(sql: string, params: any[] = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function verify() {
  console.log("🔍 Running CS Performance Verification...");

  const startDate = "2026-06-07";
  const endDate = "2026-06-07";

  const userRes = await q("SELECT id, name FROM users WHERE role = 'CS / Sales' AND status = 'Aktif' ORDER BY id");
  const csUsers = userRes.rows;

  console.log("\n--- CS Performance Metrics for Today (2026-06-07) ---");

  for (const cs of csUsers) {
    const csId = cs.id;
    // Leads Count
    const leadsRes = await q(
      `SELECT COUNT(*) FROM leads WHERE lead_date >= $1 AND lead_date <= $2 AND pic_id = $3`,
      [startDate, endDate, csId]
    );
    const leadsCount = Number(leadsRes.rows[0].count) || 0;

    // New Orders Count & Value
    const newOrdersRes = await q(
      `SELECT COUNT(*), COALESCE(SUM(grand_total), 0) as total_value 
       FROM orders 
       WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3 AND jenis_order = 'New Order'`,
      [startDate, endDate, csId]
    );
    const newOrdersCount = Number(newOrdersRes.rows[0].count) || 0;
    const newOrdersValue = Number(newOrdersRes.rows[0].total_value) || 0;

    // Repeat Orders Count & Value
    const repeatOrdersRes = await q(
      `SELECT COUNT(*), COALESCE(SUM(grand_total), 0) as total_value 
       FROM orders 
       WHERE order_date >= $1 AND order_date <= $2 AND pic_id = $3 AND jenis_order = 'Repeat Order'`,
      [startDate, endDate, csId]
    );
    const repeatOrdersCount = Number(repeatOrdersRes.rows[0].count) || 0;
    const repeatOrdersValue = Number(repeatOrdersRes.rows[0].total_value) || 0;

    const totalClosing = newOrdersCount + repeatOrdersCount;
    const totalOmzet = newOrdersValue + repeatOrdersValue;
    const closingRate = leadsCount > 0 ? Number(((newOrdersCount / leadsCount) * 100).toFixed(1)) : 0;

    console.log(`\nCS: ${cs.name} (ID: ${cs.id})`);
    console.log(`  - Leads: ${leadsCount}`);
    console.log(`  - New Orders: ${newOrdersCount} (Rp ${newOrdersValue.toLocaleString()})`);
    console.log(`  - Repeat Orders: ${repeatOrdersCount} (Rp ${repeatOrdersValue.toLocaleString()})`);
    console.log(`  - Total Closing: ${totalClosing} Transactions`);
    console.log(`  - Total Omzet: Rp ${totalOmzet.toLocaleString()}`);
    console.log(`  - Closing Rate: ${closingRate}%`);
  }

  console.log("\n--- Testing Auto-Classification Logic ---");
  // Let's check a customer that has closed orders:
  const repeatCustomerRes = await q(
    `SELECT c.id, c.name, c.phone FROM customers c 
     JOIN orders o ON o.customer_id = c.id 
     WHERE o.status_order = 'Selesai' LIMIT 1`
  );
  const repeatCust = repeatCustomerRes.rows[0];
  if (repeatCust) {
    console.log(`Repeat Customer: ${repeatCust.name} (${repeatCust.phone})`);
    const countRes = await q(
      `SELECT COUNT(*) FROM orders o 
       JOIN customers c ON o.customer_id = c.id 
       WHERE c.phone = $1 AND (o.status_order = 'Selesai' OR o.status_payment = 'Lunas')`,
      [repeatCust.phone]
    );
    const count = Number(countRes.rows[0].count);
    console.log(`  - Completed/Paid Orders Count in DB: ${count} (Should be > 0)`);
    console.log(`  - Classification should be: Repeat Order`);
  }

  // Let's create a new temporary customer to test New Order classification
  console.log("\nCreating a test new customer...");
  const tempPhone = "08999999999";
  const newCustRes = await q(
    `INSERT INTO customers (name, phone, type, address) VALUES ('Test New Customer', $1, 'Personal', 'Test Address') RETURNING id`,
    [tempPhone]
  );
  const newCustId = newCustRes.rows[0].id;

  try {
    const countRes = await q(
      `SELECT COUNT(*) FROM orders o 
       JOIN customers c ON o.customer_id = c.id 
       WHERE c.phone = $1 AND (o.status_order = 'Selesai' OR o.status_payment = 'Lunas')`,
      [tempPhone]
    );
    const count = Number(countRes.rows[0].count);
    console.log(`New Customer: Test New Customer (${tempPhone})`);
    console.log(`  - Completed/Paid Orders Count in DB: ${count} (Should be 0)`);
    console.log(`  - Classification should be: New Order`);
  } finally {
    // Cleanup
    await q("DELETE FROM customers WHERE id = $1", [newCustId]);
    console.log("Cleanup temporary customer complete.");
  }

  await pool.end();
}

verify().catch(console.error);
