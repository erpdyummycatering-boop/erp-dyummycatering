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

    // 2. Segment Distribution
    const segmentsRes = await client.query(
      `SELECT 
        COALESCE(r.segmen, 'Potential Loyalist') AS segmen,
        COUNT(c.id) AS jumlah
       FROM customers c
       LEFT JOIN rfm_scores r ON r.customer_id = c.id
       WHERE c.lini = 'siap_saji'
       GROUP BY COALESCE(r.segmen, 'Potential Loyalist')
       ORDER BY jumlah DESC`
    );

    // Keterangan rekomendasi aksi per segmen
    const segmentDetails: { [key: string]: { desc: string; color: string } } = {
      "Champions": { desc: "Transaksi sering, nilai tinggi, transaksi terbaru. Berikan reward VIP.", color: "#15803d" },
      "Loyal Customers": { desc: "Loyal, sering transaksi. Tawarkan program berlangganan.", color: "#3b82f6" },
      "Potential Loyalist": { desc: "Customer potensial, perlu didorong dengan promo reguler.", color: "#8b5cf6" },
      "At Risk": { desc: "Mulai berkurang transaksi. Kirim penawaran khusus WA.", color: "#f59e0b" },
      "Dormant": { desc: "Sudah lama tidak transaksi. Lakukan win-back campaign.", color: "#ef4444" },
    };

    const segmentsFormatted = segmentsRes.rows.map((row: any) => {
      const count = Number(row.jumlah);
      const percentage = Number(((count / totalCustomers) * 100).toFixed(1));
      const info = segmentDetails[row.segmen] || { desc: "Segmentasi pelanggan retail", color: "#6b7280" };
      return {
        segmen: row.segmen,
        jumlah: count,
        percentage,
        keterangan: info.desc,
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
