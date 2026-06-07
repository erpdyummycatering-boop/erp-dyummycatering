import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Required for Node.js environment (not browser)
neonConfig.webSocketConstructor = ws;

const DB = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const pool = new Pool({ connectionString: DB });

async function q(sql: string, params: any[] = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function runSeed() {
  console.log("🌱 Starting CS Performance Seeding...");

  // Delete transaction data only (DO NOT DELETE users!)
  await q("DELETE FROM overheads");
  await q("DELETE FROM purchase_orders");
  await q("DELETE FROM pr_items");
  await q("DELETE FROM purchase_requests");
  await q("DELETE FROM schedule_menus");
  await q("DELETE FROM schedule_orders");
  await q("DELETE FROM production_schedules");
  await q("DELETE FROM order_items");
  await q("DELETE FROM orders");
  await q("DELETE FROM leads");
  await q("DELETE FROM customers");

  // Reset sequences
  for (const t of ["customers","leads","orders","order_items","production_schedules","purchase_requests","purchase_orders","overheads"]) {
    await q(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
  }

  // Create products categories if they do not exist
  const catCheck = await q("SELECT COUNT(*) FROM product_categories");
  if (Number(catCheck.rows[0].count) === 0) {
    await q(`INSERT INTO product_categories (name) VALUES ('Nasi Box'), ('Snack Box'), ('Prasmanan'), ('Tumpeng'), ('Coffee Break')`);
  }

  // Create products if they do not exist
  const prodCheck = await q("SELECT COUNT(*) FROM products");
  if (Number(prodCheck.rows[0].count) === 0) {
    const catRes = await q("SELECT id FROM product_categories LIMIT 1");
    const catId = catRes.rows[0].id;
    await q(`INSERT INTO products (name,category_id,price,status,description) VALUES
      ('Paket A', $1, 35000, 'Aktif', 'Paket Nasi Box Lengkap'),
      ('Paket B', $1, 40000, 'Aktif', 'Paket Prasmanan Lengkap'),
      ('Paket C', $1, 50000, 'Aktif', 'Paket VIP Tumpeng')`, [catId]);
  }

  const prodRes = await q("SELECT id, price FROM products");
  const products = prodRes.rows;

  // Insert customers
  const customersData = [
    ['PT Maju Bersama', '08121000001', 'Corporate', 'Jl. Sudirman No.1 Jakarta'],
    ['APTIKOM Jabar', '08121000002', 'Instansi', 'Jl. Dipati Ukur No.35 Bandung'],
    ['Ressa Permata', '08121000003', 'Personal', 'Jl. Buah Batu No.22 Bandung'],
    ['Yayasan Nurul Iman', '08121000004', 'Instansi', 'Jl. Pelajar No.8 Bandung'],
    ['Hotel Savoy Homann', '08121000005', 'Corporate', 'Jl. Asia Afrika Bandung'],
    ['Unpad', '08121000006', 'Instansi', 'Jl. Raya Bandung-Sumedang'],
    ['Dinas Kesehatan Jabar', '08121000007', 'Pemerintah', 'Jl. Pasteur No.25'],
    ['Komunitas PKK', '08121000008', 'Komunitas', 'Jl. Merdeka No.3 Bandung'],
    ['Hendra Wijaya', '08121000009', 'Personal', 'Jl. Setiabudi No.11'],
    ['CV Kreatif Digital', '08121000010', 'Corporate', 'Jl. Industri No.5'],
    ['Budi Santoso', '08123456789', 'Personal', 'Jl. Sukajadi No.12'],
    ['Dewi Lestari', '08781234567', 'Personal', 'Jl. Cihampelas No.45'],
    ['Andi Wijaya', '08561234567', 'Personal', 'Jl. Dago No.78'],
    ['Rina Sari', '08211234567', 'Personal', 'Jl. Pasteur No.15']
  ];

  for (const [name, phone, type, address] of customersData) {
    await q(`INSERT INTO customers (name, phone, type, address) VALUES ($1, $2, $3, $4)`, [name, phone, type, address]);
  }
  console.log("✓ Customers seeded");

  const custRes = await q("SELECT id, name, phone FROM customers");
  const custs = custRes.rows;

  // Let's find the CS user IDs from the database
  const userRes = await q("SELECT id, name, role FROM users WHERE role = 'CS / Sales'");
  const csUsers = userRes.rows;
  console.log("Found CS users in db:", csUsers);

  // We need to seed for these CS users
  const today = '2026-06-07';

  // Seed for each of the CS users found
  for (const cs of csUsers) {
    // Determine target numbers based on name or ID to generate different rates
    let numLeads = 10;
    let numNewOrders = 3;
    let numRepeatOrders = 4;
    let newOrderValTotal = 10000000;
    let repeatOrderValTotal = 4500000;

    if (cs.name.includes("Anggi") || cs.id === 10) {
      numLeads = 10;
      numNewOrders = 4; // 40% -> Excellent
      numRepeatOrders = 5;
      newOrderValTotal = 12000000;
      repeatOrderValTotal = 6000000;
    } else if (cs.name.includes("Siti") || cs.id === 1) {
      numLeads = 10;
      numNewOrders = 3; // 30% -> Competent
      numRepeatOrders = 4;
      newOrderValTotal = 10000000;
      repeatOrderValTotal = 4500000;
    } else if (cs.name.includes("Rina") || cs.id === 2) {
      numLeads = 9;
      numNewOrders = 2; // 22.2% -> Developing
      numRepeatOrders = 3;
      newOrderValTotal = 5000000;
      repeatOrderValTotal = 3000000;
    } else if (cs.name.includes("Rinjani") || cs.id === 12) {
      numLeads = 13;
      numNewOrders = 2; // 15.4% -> Under Perform
      numRepeatOrders = 2;
      newOrderValTotal = 3000000;
      repeatOrderValTotal = 2000000;
    }

    console.log(`Seeding for CS ${cs.name} (ID: ${cs.id}): CR: ${((numNewOrders/numLeads)*100).toFixed(1)}%`);

    // 1. Historical Data (Previous weeks in May/June for Line Chart)
    // We will generate 3 weeks of past data
    const weeks = [
      { start: '2026-05-18', end: '2026-05-24', leads: 8, closing: 2 },
      { start: '2026-05-25', end: '2026-05-31', leads: 12, closing: 3 },
      { start: '2026-06-01', end: '2026-06-07', leads: numLeads, closing: numNewOrders } // current week
    ];

    for (let wIdx = 0; wIdx < weeks.length - 1; wIdx++) {
      const wk = weeks[wIdx];
      // Seed leads for this week
      for (let l = 0; l < wk.leads; l++) {
        const isClosing = l < wk.closing;
        const cust = custs[l % custs.length];
        const status = isClosing ? 'Closing' : 'Follow Up';
        await q(`INSERT INTO leads (customer_id, pic_id, lead_date, source, status) VALUES ($1, $2, $3, $4, $5)`,
          [cust.id, cs.id, wk.start, 'WhatsApp', status]);
        
        if (isClosing) {
          // Create historical order
          await q(`INSERT INTO orders (customer_id, pic_id, order_date, delivery_date, status_order, status_payment, grand_total, jenis_order, closing_date)
            VALUES ($1, $2, $3, $4, 'Selesai', 'Lunas', 2000000, 'New Order', $3)`,
            [cust.id, cs.id, wk.start, wk.start]);
        }
      }
    }

    // 2. Today's Data
    // Insert 10 leads for today
    const todayLeadsIds: number[] = [];
    for (let l = 0; l < numLeads; l++) {
      const isClosing = l < numNewOrders;
      const cust = custs[l % custs.length];
      const status = isClosing ? 'Closing' : 'Follow Up';
      const leadRes = await q(`INSERT INTO leads (customer_id, pic_id, lead_date, source, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [cust.id, cs.id, today, 'WhatsApp', status]);
      todayLeadsIds.push(leadRes.rows[0].id);

      if (isClosing) {
        // Insert new order for this lead
        const orderVal = newOrderValTotal / numNewOrders;
        const ordRes = await q(`INSERT INTO orders (customer_id, lead_id, pic_id, order_date, delivery_date, status_order, status_payment, grand_total, jenis_order, closing_date)
          VALUES ($1, $2, $3, $4, $4, 'Baru', 'Lunas', $5, 'New Order', $4) RETURNING id`,
          [cust.id, leadRes.rows[0].id, cs.id, today, orderVal]);
        
        // Add order item
        await q(`INSERT INTO order_items (order_id, product_id, price, quantity, subtotal)
          VALUES ($1, $2, $3, 1, $3)`, [ordRes.rows[0].id, products[0].id, orderVal]);
      }
    }

    // 3. Repeat Orders for today
    // To make them Repeat Orders, the customer needs to have a completed order in the past.
    // Let's pick customers from the end of the list for repeat orders to avoid overlapping too much with today's new order customers.
    for (let r = 0; r < numRepeatOrders; r++) {
      const cust = custs[(custs.length - 1 - r) % custs.length];

      // Insert previous historic closed order for this customer
      await q(`INSERT INTO orders (customer_id, pic_id, order_date, delivery_date, status_order, status_payment, grand_total, jenis_order, closing_date)
        VALUES ($1, $2, '2026-06-01', '2026-06-02', 'Selesai', 'Lunas', 1500000, 'New Order', '2026-06-01')`,
        [cust.id, cs.id]);

      // Now insert the repeat order for today
      const repeatOrderVal = repeatOrderValTotal / numRepeatOrders;
      const ordRes = await q(`INSERT INTO orders (customer_id, pic_id, order_date, delivery_date, status_order, status_payment, grand_total, jenis_order, closing_date)
        VALUES ($1, $2, $3, $3, 'Baru', 'Lunas', $4, 'Repeat Order', $3) RETURNING id`,
        [cust.id, cs.id, today, repeatOrderVal]);

      // Add order item
      await q(`INSERT INTO order_items (order_id, product_id, price, quantity, subtotal)
        VALUES ($1, $2, $3, 1, $3)`, [ordRes.rows[0].id, products[0].id, repeatOrderVal]);
    }
  }

  console.log("🎉 Seeding performance data completed successfully!");
  await pool.end();
}

runSeed().catch(e => {
  console.error("❌ Seeding failed:", e);
  process.exit(1);
});
