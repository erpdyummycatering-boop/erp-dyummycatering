import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Required for Node.js environment
neonConfig.webSocketConstructor = ws;

async function fixData() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL or POSTGRES_URL is not defined in environment variables.");
    process.exit(1);
  }
  
  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log("🚀 Starting customer retention data cleanup...");

  try {
    await client.query("BEGIN");

    // 1. Find all Pak Oki customer accounts
    const okiCustsRes = await client.query(
      `SELECT id, name, phone FROM customers WHERE name ILIKE '%Oki%' ORDER BY id ASC`
    );
    const okiCusts = okiCustsRes.rows;
    console.log(`Found ${okiCusts.length} Pak Oki customer accounts.`);

    if (okiCusts.length > 0) {
      // Use the first Pak Oki account (ID 396) as Master Customer
      const masterCustomer = okiCusts[0];
      const masterId = masterCustomer.id;

      // Update master customer name to clean 'Pak Oki'
      await client.query(
        `UPDATE customers SET name = $1, phone = COALESCE(phone, '081224146047') WHERE id = $2`,
        ['Pak Oki', masterId]
      );
      console.log(`Master customer designated: ID ${masterId} ('Pak Oki')`);

      // For each Pak Oki account, reassign orders to masterId & extract recipient details
      for (const cust of okiCusts) {
        let recipientCandidate: string | null = null;
        const matchParen = cust.name.match(/\(([^)]+)\)/);
        if (matchParen && matchParen[1]) {
          const inner = matchParen[1].trim();
          if (inner.includes("/")) {
            recipientCandidate = inner.split("/")[0].trim();
          } else {
            recipientCandidate = inner;
          }
        }

        const phoneCandidate = cust.phone && cust.phone.length >= 8 ? cust.phone : null;

        const ordersRes = await client.query(
          `SELECT id, recipient_name, recipient_phone FROM orders WHERE customer_id = $1`,
          [cust.id]
        );

        for (const order of ordersRes.rows) {
          const newRecipientName = order.recipient_name || recipientCandidate || null;
          const newRecipientPhone = order.recipient_phone || phoneCandidate || null;

          await client.query(
            `UPDATE orders 
             SET customer_id = $1, recipient_name = $2, recipient_phone = $3 
             WHERE id = $4`,
            [masterId, newRecipientName, newRecipientPhone, order.id]
          );
        }
      }
      console.log(`✅ All Pak Oki orders consolidated under Customer ID ${masterId}.`);
    }

    // 2. Fast Batch Update jenis_order using Postgres Window Function
    const batchUpdateRes = await client.query(`
      WITH ranked_orders AS (
        SELECT id, 
               ROW_NUMBER() OVER (
                 PARTITION BY customer_id 
                 ORDER BY COALESCE(order_date, delivery_date) ASC, id ASC
               ) as rn
        FROM orders
      )
      UPDATE orders o
      SET jenis_order = CASE WHEN r.rn = 1 THEN 'New Order' ELSE 'Repeat Order' END
      FROM ranked_orders r
      WHERE o.id = r.id
    `);

    console.log(`✅ Recalculated jenis_order batch update complete: ${batchUpdateRes.rowCount} orders updated.`);

    const countRes = await client.query(`SELECT jenis_order, COUNT(*) FROM orders GROUP BY jenis_order`);
    console.log("Current order classification breakdown:", countRes.rows);

    await client.query("COMMIT");
    console.log("✅ Migration & data cleanup completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Cleanup failed, rolled back:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixData();
