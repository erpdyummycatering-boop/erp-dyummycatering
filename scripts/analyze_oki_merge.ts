import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
neonConfig.webSocketConstructor = ws;

async function analyzeAndMergeOki() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });

  // 1. Get all customer records matching %oki%
  const custRes = await pool.query("SELECT * FROM customers WHERE name ILIKE '%oki%' ORDER BY id ASC");
  const masterCust = custRes.rows.find(c => Number(c.id) === 396) || custRes.rows[0];
  const duplicateCusts = custRes.rows.filter(c => Number(c.id) !== Number(masterCust.id));

  console.log(`Master Customer: ID ${masterCust.id} - ${masterCust.name} (${masterCust.phone || '-'})`);
  console.log(`Duplicate Customers Count: ${duplicateCusts.length}`);

  // Extract recipient details and update orders
  for (const dup of duplicateCusts) {
    // Re-link any orders that might be linked to dup.id to masterCust.id
    await pool.query("UPDATE orders SET customer_id = $1 WHERE customer_id = $2", [masterCust.id, dup.id]);

    // Extract inside parenthesis from name: e.g. "PAK OKI LOKASI 1 (SMK BPP)" -> "SMK BPP"
    let parenValue: string | null = null;
    const matchParen = dup.name.match(/\(([^)]+)\)/);
    if (matchParen && matchParen[1]) {
      const extracted = matchParen[1].trim();
      parenValue = extracted.replace(/^Lokasi\s+\d+\s*/i, "").trim();
    }

    const phone = dup.phone ? dup.phone.trim().replace(/[\s-]/g, "") : null;

    if (parenValue || phone) {
      console.log(`Duplicate ID ${dup.id} "${dup.name}" -> Recipient Name: "${parenValue || '-'}", Recipient Phone: "${phone || '-'}"`);

      if (parenValue) {
        // Update orders where venue or notes match parenValue
        const updateRes = await pool.query(
          `UPDATE orders 
           SET 
             recipient_name = COALESCE(NULLIF(recipient_name, ''), $1),
             recipient_phone = COALESCE(NULLIF(recipient_phone, ''), $2)
           WHERE customer_id = $3 AND (venue ILIKE $4 OR order_notes ILIKE $4)`,
          [parenValue, phone, masterCust.id, `%${parenValue}%`]
        );
        if (updateRes.rowCount && updateRes.rowCount > 0) {
          console.log(`  -> Matched & updated ${updateRes.rowCount} orders for "${parenValue}"`);
        }
      }
    }
  }

  // Also extract location/recipient from order venues if recipient_name is empty
  const venueExtractRes = await pool.query(
    `UPDATE orders
     SET recipient_name = CASE
       WHEN venue ILIKE '%SMK BPP%' THEN 'SMK BPP'
       WHEN venue ILIKE '%LPK PANGHEGAR%' THEN 'LPK PANGHEGAR CICADAS'
       WHEN venue ILIKE '%Teras Kopi%' THEN 'Teras Kopi Batununggal'
       WHEN venue ILIKE '%Sakinah%' THEN 'Koperasi Sakinah Antapani'
       WHEN venue ILIKE '%Bingkai Kopi%' THEN 'Bingkai Kopi Arcamanik'
       WHEN venue ILIKE '%Garasi 47%' THEN 'Garasi 47 Regol'
       WHEN venue ILIKE '%Yana%' THEN 'Rumah Yana Cibiru'
       WHEN venue ILIKE '%Korawa%' THEN 'Korawa Cicendo'
       WHEN venue ILIKE '%Pasirkaliki%' THEN 'Aan Andi Pasirkaliki'
       WHEN venue ILIKE '%GITA BUAH BATU%' THEN 'LPK GITA BUAH BATU'
       WHEN venue ILIKE '%HOLIS BOJONGLOA%' THEN 'PKBM HOLIS BOJONGLOA'
       WHEN venue ILIKE '%CIGONDEWAH%' THEN 'PKBM CITRA CIGONDEWAH'
       ELSE recipient_name
     END
     WHERE customer_id = $1 AND (recipient_name IS NULL OR recipient_name = '')`,
    [masterCust.id]
  );
  console.log(`Updated recipient_name for ${venueExtractRes.rowCount} orders directly from venue patterns.`);

  // 2. Safely delete duplicate customer records so only 1 Master Pak Oki remains
  const dupIds = duplicateCusts.map(c => Number(c.id));
  if (dupIds.length > 0) {
    // First re-link leads if any
    await pool.query("UPDATE leads SET customer_id = $1 WHERE customer_id = ANY($2::bigint[])", [masterCust.id, dupIds]);
    // Then delete duplicate customer rows
    const delRes = await pool.query("DELETE FROM customers WHERE id = ANY($1::bigint[])", [dupIds]);
    console.log(`Deleted ${delRes.rowCount} duplicate Pak Oki customer entries.`);
  }

  // 3. Recalculate jenis_order across ALL orders for Master Pak Oki
  const ordersRes = await pool.query(
    "SELECT id FROM orders WHERE customer_id = $1 ORDER BY delivery_date ASC, id ASC",
    [masterCust.id]
  );
  
  if (ordersRes.rows.length > 0) {
    const firstOrderId = ordersRes.rows[0].id;
    await pool.query("UPDATE orders SET jenis_order = 'New Order' WHERE id = $1", [firstOrderId]);
    if (ordersRes.rows.length > 1) {
      const repeatOrderIds = ordersRes.rows.slice(1).map(r => r.id);
      await pool.query("UPDATE orders SET jenis_order = 'Repeat Order' WHERE id = ANY($1::bigint[])", [repeatOrderIds]);
    }
    console.log(`Recalculated jenis_order for Pak Oki: Order ID ${firstOrderId} = 'New Order', ${ordersRes.rows.length - 1} orders = 'Repeat Order'.`);
  }

  // 4. Verify total Oki customers remaining
  const remainingCusts = await pool.query("SELECT id, name, phone FROM customers WHERE name ILIKE '%oki%'");
  console.log(`Remaining Pak Oki customers count in database: ${remainingCusts.rows.length}`);
  console.log(remainingCusts.rows);

  await pool.end();
}

analyzeAndMergeOki().catch(console.error);
