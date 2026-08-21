import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const segmentParam = searchParams.get("segment");

  const client = await pool.connect();
  try {
    // 1. If segment drill-down is requested, return list of customers for that segment
    if (segmentParam) {
      // Map display name to SQL segment name if needed
      let searchSeg = segmentParam.trim();
      if (searchSeg === "New Customers") searchSeg = "New Customer";
      if (searchSeg === "Potential Loyals") searchSeg = "Potential";
      if (searchSeg === "Loyal Customers") searchSeg = "Loyal";
      if (searchSeg === "Champions") searchSeg = "Champion";
      if (searchSeg === "At-Risk Customers") searchSeg = "At Risk";
      if (searchSeg === "Dormant Customer") searchSeg = "Dormant";

      const customersRes = await client.query(
        `WITH customer_stats AS (
          SELECT 
            c.id AS customer_id,
            c.name AS customer_name,
            c.phone AS customer_phone,
            c.type AS customer_type,
            c.created_at,
            COUNT(o.id) AS total_orders,
            MAX(o.order_date) AS last_order_date,
            COALESCE(SUM(o.grand_total), 0) AS total_spending
          FROM customers c
          LEFT JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
          WHERE c.lini IN ('siap_saji', 'keduanya') OR o.id IS NOT NULL
          GROUP BY c.id, c.name, c.phone, c.type, c.created_at
        ),
        segmented AS (
          SELECT 
            customer_id,
            customer_name,
            customer_phone,
            customer_type,
            created_at,
            total_orders,
            last_order_date,
            total_spending,
            CASE 
              WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 180 THEN 'Dormant'
              WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 90  THEN 'At Risk'
              WHEN total_orders = 1      THEN 'New Customer'
              WHEN total_orders >= 8     THEN 'Champion'
              WHEN total_orders >= 4     THEN 'Loyal'
              WHEN total_orders >= 2     THEN 'Active'
              WHEN total_orders = 0      THEN 'New Customer'
              ELSE 'Potential'
            END AS segmen
          FROM customer_stats
        )
        SELECT 
          customer_id AS id,
          customer_name AS name,
          customer_phone AS phone,
          customer_type AS type,
          created_at,
          total_orders,
          last_order_date,
          total_spending
        FROM segmented 
        WHERE segmen = $1 OR segmen = $2
        ORDER BY total_spending DESC, total_orders DESC`,
        [searchSeg, segmentParam]
      );

      return NextResponse.json({
        segment: segmentParam,
        customers: customersRes.rows.map((row) => ({
          ...row,
          total_spending: Number(row.total_spending || 0),
          total_orders: Number(row.total_orders || 0),
        })),
        total: customersRes.rows.length,
      });
    }

    // 2. Default Overview Response (Distribution, Monetary, Monthly Retention)
    // 2a. Total Customer Count
    const totalCustRes = await client.query(
      "SELECT COUNT(*) FROM customers WHERE lini IN ('siap_saji', 'keduanya')"
    );
    const totalCustomers = Number(totalCustRes.rows[0].count) || 1;

    // 2b. Segment Distribution & Monetary values (Median, Avg, Total)
    const segmentsRes = await client.query(
      `WITH customer_stats AS (
        SELECT 
          c.id AS customer_id,
          COUNT(o.id) AS total_orders,
          MAX(o.order_date) AS last_order_date,
          COALESCE(SUM(o.grand_total), 0) AS total_spending
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
        WHERE c.lini IN ('siap_saji', 'keduanya') OR o.id IS NOT NULL
        GROUP BY c.id
      ),
      segmented AS (
        SELECT 
          customer_id,
          total_spending,
          CASE 
            WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 180 THEN 'Dormant'
            WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 90  THEN 'At Risk'
            WHEN total_orders = 1      THEN 'New Customer'
            WHEN total_orders >= 8     THEN 'Champion'
            WHEN total_orders >= 4     THEN 'Loyal'
            WHEN total_orders >= 2     THEN 'Active'
            WHEN total_orders = 0      THEN 'New Customer'
            ELSE 'Potential'
          END AS segmen
        FROM customer_stats
      )
      SELECT 
        segmen, 
        COUNT(*) AS jumlah,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spending), 0) AS median_monetary,
        COALESCE(AVG(total_spending), 0) AS avg_monetary,
        COALESCE(SUM(total_spending), 0) AS total_monetary
      FROM segmented
      GROUP BY segmen`
    );

    // Exact RFM Segment definition and CRM Treatment mapping from specification
    const segmentDetails: { [key: string]: { definition: string; treatment: string; color: string; altLabel: string } } = {
      "New Customer": {
        definition: "Baru 1x melakukan pembelian",
        treatment: "Dorong order ke-2 ➔ follow-up setelah pembelian, rekomendasi menu lain, tawarkan voucher/order kedua",
        color: "#0284c7",
        altLabel: "New Customers",
      },
      "Potential": {
        definition: "Sudah repeat, tetapi frekuensinya sekitar 1x/bulan",
        treatment: "Percepat frekuensi order ➔ rekomendasi menu berdasarkan pembelian sebelumnya, cross-selling lauk lain, promo agar order berikutnya lebih cepat",
        color: "#8b5cf6",
        altLabel: "Potential Loyals",
      },
      "Active": {
        definition: "Sudah mulai rutin, sekitar 2–3x/bulan",
        treatment: "Naikkan menjadi Loyal ➔ reminder menu mingguan, rekomendasi menu baru, bundling beberapa lauk, promo repeat order",
        color: "#10b981",
        altLabel: "Active Customers",
      },
      "Loyal": {
        definition: "Konsisten ±1x setiap minggu",
        treatment: "Pertahankan & naikkan nilai transaksi ➔ loyalty reward, cross-sell, bundling, menu baru/limited, benefit khusus pelanggan rutin",
        color: "#3b82f6",
        altLabel: "Loyal Customers",
      },
      "Champion": {
        definition: "Sangat aktif, ≥2x/minggu",
        treatment: "VIP treatment ➔ reward eksklusif, prioritas menu baru, personal offer, apresiasi pelanggan, upsell/bundling tanpa terlalu mengandalkan diskon",
        color: "#15803d",
        altLabel: "Champions",
      },
      "At Risk": {
        definition: "Pernah melakukan pembelian, tetapi tidak order selama 3 bulan",
        treatment: "Win-back ➔ reminder personal, tawarkan menu yang pernah dibeli, tanyakan alasan tidak order, lalu insentif kembali jika diperlukan",
        color: "#f59e0b",
        altLabel: "At-Risk Customers",
      },
      "Dormant": {
        definition: "Tidak order selama >6 bulan",
        treatment: "Reactivation campaign ➔ campaign khusus 'kangen D'Yummy', perkenalkan produk/menu baru, promo comeback dengan batas waktu",
        color: "#ef4444",
        altLabel: "Dormant Customer",
      },
    };

    const allSegmentKeys = ["New Customer", "Potential", "Active", "Loyal", "Champion", "At Risk", "Dormant"];
    const dbMap = new Map(segmentsRes.rows.map((r: any) => [r.segmen, r]));

    const segmentsFormatted = allSegmentKeys.map((segKey) => {
      const dbRow = dbMap.get(segKey) || { jumlah: 0, median_monetary: 0, avg_monetary: 0, total_monetary: 0 };
      const count = Number(dbRow.jumlah) || 0;
      const percentage = Number(((count / totalCustomers) * 100).toFixed(1));
      const info = segmentDetails[segKey];
      return {
        segmen: segKey,
        altLabel: info.altLabel,
        jumlah: count,
        percentage,
        median_monetary: Math.round(Number(dbRow.median_monetary || 0)),
        avg_monetary: Math.round(Number(dbRow.avg_monetary || 0)),
        total_monetary: Math.round(Number(dbRow.total_monetary || 0)),
        definition: info.definition,
        treatment: info.treatment,
        keterangan: `${info.definition} | ${info.treatment}`,
        color: info.color,
      };
    });

    // 2c. Monthly Retention Data (Jan - Dec)
    const monthlyRes = await client.query(
      `WITH customer_first_orders AS (
        SELECT 
          c.id AS customer_id,
          MIN(o.order_date::date) AS first_order_date
        FROM customers c
        JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
        GROUP BY c.id
      ),
      monthly_orders AS (
        SELECT DISTINCT
          o.customer_id,
          DATE_TRUNC('month', o.order_date)::date AS order_month
        FROM orders o
        WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
          AND o.order_date >= DATE_TRUNC('year', CURRENT_DATE)
      )
      SELECT 
        mo.order_month,
        COUNT(CASE WHEN DATE_TRUNC('month', f.first_order_date)::date = mo.order_month THEN 1 END) AS new_count,
        COUNT(CASE WHEN DATE_TRUNC('month', f.first_order_date)::date < mo.order_month THEN 1 END) AS retain_count
      FROM monthly_orders mo
      JOIN customer_first_orders f ON mo.customer_id = f.customer_id
      GROUP BY mo.order_month
      ORDER BY mo.order_month ASC`
    );

    // Build 12-month array (Jan - Dec of current year)
    const monthsName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthDataMap = new Map<number, { new_count: number; retain_count: number }>();
    monthlyRes.rows.forEach((r: any) => {
      const mIdx = new Date(r.order_month).getMonth(); // 0..11
      monthDataMap.set(mIdx, {
        new_count: Number(r.new_count || 0),
        retain_count: Number(r.retain_count || 0),
      });
    });

    const currentMonthIdx = new Date().getMonth();
    const monthlyRetentionFormatted = monthsName.slice(0, currentMonthIdx + 1).map((mName, mIdx) => {
      const data = monthDataMap.get(mIdx) || { new_count: 0, retain_count: 0 };
      const total = data.new_count + data.retain_count;
      const newPct = total > 0 ? Math.round((data.new_count / total) * 100) : 0;
      const retainPct = total > 0 ? 100 - newPct : 100;
      return {
        month: mName,
        monthIdx: mIdx + 1,
        new_count: data.new_count,
        retain_count: data.retain_count,
        total,
        New: newPct,
        Retain: retainPct,
      };
    });

    // 2d. Kecamatan Breakdown (RFM & Retaining vs New)
    const kecamatanRes = await client.query(
      `WITH customer_stats AS (
        SELECT 
          c.id AS customer_id,
          COALESCE(a.kecamatan, 'Lainnya / Non-Area') AS kecamatan,
          COUNT(o.id) AS total_orders,
          MAX(o.order_date) AS last_order_date,
          COALESCE(SUM(o.grand_total), 0) AS total_spending
        FROM customers c
        LEFT JOIN areas a ON a.id = c.area_id
        LEFT JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
        WHERE c.lini IN ('siap_saji', 'keduanya') OR o.id IS NOT NULL
        GROUP BY c.id, a.kecamatan
      ),
      segmented AS (
        SELECT 
          customer_id,
          kecamatan,
          total_orders,
          total_spending,
          CASE 
            WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 180 THEN 'Dormant'
            WHEN last_order_date IS NOT NULL AND (CURRENT_DATE - last_order_date::date) > 90  THEN 'At Risk'
            WHEN total_orders = 1      THEN 'New Customer'
            WHEN total_orders >= 8     THEN 'Champion'
            WHEN total_orders >= 4     THEN 'Loyal'
            WHEN total_orders >= 2     THEN 'Active'
            WHEN total_orders = 0      THEN 'New Customer'
            ELSE 'Potential'
          END AS segmen
        FROM customer_stats
      )
      SELECT 
        kecamatan,
        COUNT(customer_id)::int AS total_customers,
        COUNT(CASE WHEN total_orders <= 1 THEN 1 END)::int AS new_customers,
        COUNT(CASE WHEN total_orders >= 2 THEN 1 END)::int AS retaining_customers,
        COALESCE(SUM(total_spending), 0)::numeric AS total_omset,
        COALESCE(SUM(total_orders), 0)::int AS total_orders,
        MODE() WITHIN GROUP (ORDER BY segmen) AS dominant_rfm_segment
      FROM segmented
      GROUP BY kecamatan
      ORDER BY total_customers DESC, total_omset DESC`
    );

    // 2e. Top Customers (Omset) with dynamic top_limit (10, 20, 100, all)
    const topLimitParam = searchParams.get("top_limit") || "10";
    let topLimitClause = "LIMIT 10";
    if (topLimitParam === "20") topLimitClause = "LIMIT 20";
    else if (topLimitParam === "100") topLimitClause = "LIMIT 100";
    else if (topLimitParam === "all") topLimitClause = "";

    const topCustomersRes = await client.query(
      `SELECT 
        c.id,
        c.name,
        c.phone,
        COALESCE(a.kecamatan, '-') AS kecamatan,
        COUNT(o.id)::int AS orders_count,
        COALESCE(SUM(o.grand_total), 0)::numeric AS omset
      FROM customers c
      JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
      LEFT JOIN areas a ON a.id = c.area_id
      GROUP BY c.id, c.name, c.phone, a.kecamatan
      ORDER BY omset DESC
      ${topLimitClause}`
    );

    return NextResponse.json({
      total_customers: totalCustomers,
      distribution: segmentsFormatted,
      monthly_retention: monthlyRetentionFormatted,
      by_kecamatan: kecamatanRes.rows.map((r: any) => ({
        ...r,
        total_omset: Number(r.total_omset || 0),
        total_customers: Number(r.total_customers || 0),
        new_customers: Number(r.new_customers || 0),
        retaining_customers: Number(r.retaining_customers || 0),
        total_orders: Number(r.total_orders || 0),
      })),
      top_customers: topCustomersRes.rows.map((r: any) => ({
        ...r,
        omset: Number(r.omset || 0),
        orders_count: Number(r.orders_count || 0),
      })),
      top_limit: topLimitParam,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data analitik RFM customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

