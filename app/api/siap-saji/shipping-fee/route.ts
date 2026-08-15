import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const area_id = searchParams.get("area_id");
  const channel_id = searchParams.get("channel_id");

  if (!area_id || !channel_id) {
    return NextResponse.json(
      { error: "Parameter area_id dan channel_id wajib diisi." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT public.get_shipping_fee($1, $2) AS shipping_fee",
      [Number(area_id), Number(channel_id)]
    );
    const shippingFee = Number(res.rows[0]?.shipping_fee || 0);
    return NextResponse.json({ shipping_fee: shippingFee });
  } catch (error: any) {
    console.error("Gagal menghitung shipping fee:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
