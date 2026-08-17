import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    // 1. Total Customer Count
    const totalCustRes = await client.query(
      "SELECT COUNT(*) FROM customers WHERE lini = 'siap_saji'"
    );
    const totalCustomers = Number(totalCustRes.rows[0].count) || 1;

    // 2. Segment Distribution using CTE subquery for RFM calculations
    const segmentsRes = await client.query(
      `WITH customer_stats AS (
        SELECT 
          c.id AS customer_id,
          COUNT(o.id) AS total_orders,
          MAX(o.order_date) AS last_order_date
        FROM customers c
        JOIN orders o ON o.customer_id = c.id AND o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
        WHERE c.lini IN ('siap_saji', 'keduanya')
        GROUP BY c.id
      ),
      segmented AS (
        SELECT 
          customer_id,
          CASE 
            WHEN (CURRENT_DATE - last_order_date::date) > 180 THEN 'Dormant'
            WHEN (CURRENT_DATE - last_order_date::date) > 90  THEN 'At Risk'
            WHEN total_orders = 1      THEN 'New Customer'
            WHEN total_orders >= 8     THEN 'Champion'
            WHEN total_orders >= 4     THEN 'Loyal'
            WHEN total_orders >= 2     THEN 'Active'
            ELSE 'Potential'
          END AS segmen
        FROM customer_stats
      )
      SELECT segmen, COUNT(*) AS jumlah
      FROM segmented
      GROUP BY segmen`
    );

    // Exact RFM Segment definition and CRM Treatment mapping from specification
    const segmentDetails: { [key: string]: { definition: string; treatment: string; color: string } } = {
      "New Customer": {
        definition: "Baru 1x melakukan pembelian",
        treatment: "Dorong order ke-2 ➔ follow-up setelah pembelian, rekomendasi menu lain, tawarkan voucher/order kedua",
        color: "#0284c7",
      },
      "Potential": {
        definition: "Sudah repeat, tetapi frekuensinya sekitar 1x/bulan",
        treatment: "Percepat frekuensi order ➔ rekomendasi menu berdasarkan pembelian sebelumnya, cross-selling lauk lain, promo agar order berikutnya lebih cepat",
        color: "#8b5cf6",
      },
      "Active": {
        definition: "Sudah mulai rutin, sekitar 2–3x/bulan",
        treatment: "Naikkan menjadi Loyal ➔ reminder menu mingguan, rekomendasi menu baru, bundling beberapa lauk, promo repeat order",
        color: "#10b981",
      },
      "Loyal": {
        definition: "Konsisten ±1x setiap minggu",
        treatment: "Pertahankan & naikkan nilai transaksi ➔ loyalty reward, cross-sell, bundling, menu baru/limited, benefit khusus pelanggan rutin",
        color: "#3b82f6",
      },
      "Champion": {
        definition: "Sangat aktif, ≥2x/minggu",
        treatment: "VIP treatment ➔ reward eksklusif, prioritas menu baru, personal offer, apresiasi pelanggan, upsell/bundling tanpa terlalu mengandalkan diskon",
        color: "#15803d",
      },
      "At Risk": {
        definition: "Pernah melakukan pembelian, tetapi tidak order selama 3 bulan",
        treatment: "Win-back ➔ reminder personal, tawarkan menu yang pernah dibeli, tanyakan alasan tidak order, lalu insentif kembali jika diperlukan",
        color: "#f59e0b",
      },
      "Dormant": {
        definition: "Tidak order selama >6 bulan",
        treatment: "Reactivation campaign ➔ campaign khusus 'kangen D'Yummy', perkenalkan produk/menu baru, promo comeback dengan batas waktu",
        color: "#ef4444",
      },
    };

    const allSegmentKeys = ["New Customer", "Potential", "Active", "Loyal", "Champion", "At Risk", "Dormant"];
    const dbMap = new Map(segmentsRes.rows.map((r: any) => [r.segmen, Number(r.jumlah)]));

    const segmentsFormatted = allSegmentKeys.map((segKey) => {
      const count = dbMap.get(segKey) || 0;
      const percentage = Number(((count / totalCustomers) * 100).toFixed(1));
      const info = segmentDetails[segKey];
      return {
        segmen: segKey,
        jumlah: count,
        percentage,
        definition: info.definition,
        treatment: info.treatment,
        keterangan: `${info.definition} | ${info.treatment}`,
        color: info.color,
      };
    });

    return NextResponse.json({
      total_customers: totalCustomers,
      distribution: segmentsFormatted,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data analitik RFM customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
