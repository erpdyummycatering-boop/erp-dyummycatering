import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const [rfmRes, statusRes] = await Promise.all([
      client.query("SELECT * FROM rfm_scores ORDER BY rfm_total DESC, monetary DESC"),
      client.query("SELECT value, updated_at FROM settings WHERE key = 'rfm_last_refresh'"),
    ]);

    return NextResponse.json({
      data: rfmRes.rows,
      last_refreshed_at: statusRes.rows[0]?.updated_at || null,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data RFM scores:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    // Refresh materialized view (try CONCURRENTLY, fallback to standard)
    try {
      await client.query("REFRESH MATERIALIZED VIEW CONCURRENTLY public.rfm_scores");
    } catch (e) {
      await client.query("REFRESH MATERIALIZED VIEW public.rfm_scores");
    }
    
    // Update setting timestamp
    const nowStr = new Date().toISOString();
    await client.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('rfm_last_refresh', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [nowStr]
    );

    return NextResponse.json({ message: "RFM scores berhasil diperbarui!", refreshed_at: nowStr });
  } catch (error: any) {
    console.error("Gagal merefresh RFM materialized view:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
