import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // 1. Basic customer info & area
    const custRes = await client.query(
      `SELECT c.*, a.kecamatan AS area_kecamatan, a.kota AS area_kota
       FROM customers c
       LEFT JOIN areas a ON c.area_id = a.id
       WHERE c.id = $1`,
      [custId]
    );

    if (custRes.rows.length === 0) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }

    const custInfo = custRes.rows[0];

    // 2. Order statistics
    const statsRes = await client.query(
      `SELECT 
        COUNT(id) AS total_orders,
        COALESCE(SUM(grand_total), 0) AS total_omzet,
        MAX(order_date) AS last_order_date,
        MIN(order_date) AS first_order_date,
        (CURRENT_DATE - MAX(order_date)::date) AS recency_days
       FROM orders
       WHERE customer_id = $1 AND lini = 'siap_saji' AND status_order <> 'Dibatalkan'`,
      [custId]
    );

    const stats = statsRes.rows[0];
    const totalOrders = Number(stats.total_orders || 0);
    const totalOmzet = Number(stats.total_omzet || 0);
    const aov = totalOrders > 0 ? Math.round(totalOmzet / totalOrders) : 0;
    const recencyDays = stats.recency_days !== null ? Number(stats.recency_days) : null;

    // Determine RFM Segment and CRM Treatment matching exact rules
    let segmen = "New Customer";
    let crmTreatment = "Dorong order ke-2 ➔ follow-up setelah pembelian, rekomendasi menu lain, tawarkan voucher/order kedua";

    if (recencyDays !== null && recencyDays > 180) {
      segmen = "Dormant";
      crmTreatment = "Reactivation campaign ➔ campaign khusus 'kangen D'Yummy', perkenalkan produk/menu baru, promo comeback dengan batas waktu";
    } else if (recencyDays !== null && recencyDays > 90) {
      segmen = "At Risk";
      crmTreatment = "Win-back ➔ reminder personal, tawarkan menu yang pernah dibeli, tanyakan alasan tidak order, lalu insentif kembali jika diperlukan";
    } else if (totalOrders === 1) {
      segmen = "New Customer";
      crmTreatment = "Dorong order ke-2 ➔ follow-up setelah pembelian, rekomendasi menu lain, tawarkan voucher/order kedua";
    } else if (totalOrders >= 8) {
      segmen = "Champion";
      crmTreatment = "VIP treatment ➔ reward eksklusif, prioritas menu baru, personal offer, apresiasi pelanggan, upsell/bundling tanpa terlalu mengandalkan diskon";
    } else if (totalOrders >= 4) {
      segmen = "Loyal";
      crmTreatment = "Pertahankan & naikkan nilai transaksi ➔ loyalty reward, cross-sell, bundling, menu baru/limited, benefit khusus pelanggan rutin";
    } else if (totalOrders >= 2) {
      segmen = "Active";
      crmTreatment = "Naikkan menjadi Loyal ➔ reminder menu mingguan, rekomendasi menu baru, bundling beberapa lauk, promo repeat order";
    } else {
      segmen = "Potential";
      crmTreatment = "Percepat frekuensi order ➔ rekomendasi menu berdasarkan pembelian sebelumnya, cross-selling lauk lain, promo agar order berikutnya lebih cepat";
    }

    // 3. Top 5 favorite products
    const favRes = await client.query(
      `SELECT pr.name AS product_name, SUM(oi.quantity) AS total_qty
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN products pr ON oi.product_id = pr.id
       WHERE o.customer_id = $1 AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
       GROUP BY pr.id, pr.name
       ORDER BY total_qty DESC
       LIMIT 5`,
      [custId]
    );

    // 4. Last 5 orders
    const ordersRes = await client.query(
      `SELECT 
        o.id, o.no_struk, o.order_date, o.grand_total,
        (
          SELECT string_agg(pr.name, ', ')
          FROM order_items oi
          JOIN products pr ON oi.product_id = pr.id
          WHERE oi.order_id = o.id
        ) AS item_names
       FROM orders o
       WHERE o.customer_id = $1 AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
       ORDER BY o.order_date DESC, o.id DESC
       LIMIT 5`,
      [custId]
    );

    return NextResponse.json({
      customer: custInfo,
      stats: {
        total_orders: totalOrders,
        total_omzet: totalOmzet,
        aov,
        last_order_date: stats.last_order_date,
        first_order_date: stats.first_order_date,
        recency_days: recencyDays,
        segmen,
        crm_treatment: crmTreatment,
      },
      favorite_products: favRes.rows,
      recent_orders: ordersRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil detail customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, phone, address, patokan, area_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Nama dan Nomor HP/WA wajib diisi." }, { status: 400 });
    }

    const cleanPhone = String(phone).trim().replace(/[^0-9]/g, "");

    // Check duplicate phone
    const checkRes = await client.query(
      "SELECT id FROM customers WHERE phone = $1 AND id <> $2 LIMIT 1",
      [cleanPhone, custId]
    );

    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { error: "Nomor WhatsApp/HP ini sudah digunakan oleh pelanggan lain." },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3, patokan = $4, area_id = $5
       WHERE id = $6`,
      [name, cleanPhone, address || "-", patokan || "", area_id || null, custId]
    );

    return NextResponse.json({ message: "Data pelanggan berhasil diperbarui." });
  } catch (error: any) {
    console.error("Gagal update customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Find all order IDs for this customer
    const orderRes = await client.query("SELECT id FROM orders WHERE customer_id = $1", [custId]);
    const orderIds = orderRes.rows.map((r) => r.id);

    if (orderIds.length > 0) {
      // 2. Cascade delete order_items
      await client.query("DELETE FROM order_items WHERE order_id = ANY($1::bigint[])", [orderIds]);

      // 3. Cascade delete journals
      await client.query(
        "DELETE FROM journals WHERE (ref_type IN ('penjualan', 'koreksi') AND ref_id = ANY($1::bigint[])) OR ref_no LIKE 'SI.%'",
        [orderIds]
      );

      // 4. Cascade delete kas_mutasi
      await client.query(
        "DELETE FROM kas_mutasi WHERE ref_type IN ('penjualan', 'koreksi') AND ref_id = ANY($1::bigint[])",
        [orderIds]
      );

      // 5. Delete orders
      await client.query("DELETE FROM orders WHERE customer_id = $1", [custId]);
    }

    // 6. Delete customer record
    await client.query("DELETE FROM customers WHERE id = $1", [custId]);

    await client.query("COMMIT");

    return NextResponse.json({
      message: `Pelanggan dan ${orderIds.length} riwayat transaksi order/jurnal berhasil dihapus secara permanent.`,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal hapus customer cascade:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus data pelanggan" }, { status: 500 });
  } finally {
    client.release();
  }
}
