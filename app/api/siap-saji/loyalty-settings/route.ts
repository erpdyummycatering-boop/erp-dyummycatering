import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

async function ensureTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS loyalty_settings (
      id INT PRIMARY KEY DEFAULT 1,
      min_order NUMERIC(12,2) DEFAULT 100000,
      point_percentage NUMERIC(5,2) DEFAULT 2.0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO loyalty_settings (id, min_order, point_percentage)
    VALUES (1, 100000, 2.0)
    ON CONFLICT (id) DO NOTHING;
  `);
}

export async function GET() {
  const client = await pool.connect();
  try {
    await ensureTable(client);
    const res = await client.query("SELECT min_order, point_percentage FROM loyalty_settings WHERE id = 1");
    const row = res.rows[0] || { min_order: 100000, point_percentage: 2.0 };
    return NextResponse.json({
      min_order: Number(row.min_order),
      point_percentage: Number(row.point_percentage),
    });
  } catch (error: any) {
    console.error("Gagal mengambil pengaturan loyalty:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const minOrder = Number(body.min_order ?? 100000);
  const pointPercentage = Number(body.point_percentage ?? 2.0);

  if (isNaN(minOrder) || minOrder < 0 || isNaN(pointPercentage) || pointPercentage < 0) {
    return NextResponse.json({ error: "Nilai minimal order dan persentase poin tidak valid." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await ensureTable(client);
    await client.query(
      `UPDATE loyalty_settings 
       SET min_order = $1, point_percentage = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`,
      [minOrder, pointPercentage]
    );

    return NextResponse.json({
      success: true,
      min_order: minOrder,
      point_percentage: pointPercentage,
    });
  } catch (error: any) {
    console.error("Gagal memperbarui pengaturan loyalty:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
