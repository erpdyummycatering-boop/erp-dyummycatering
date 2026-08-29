import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT sku FROM products 
       WHERE lini = 'siap_saji' AND is_half_portion = false 
       ORDER BY id DESC LIMIT 50`
    );

    let maxNum = 0;
    let prefix = "SP-A";
    let padLen = 2;

    for (const row of res.rows) {
      const sku = (row.sku || "").trim();
      const match = sku.match(/^([A-Za-z]+-?[A-Za-z]*)(\d+)$/);
      if (match) {
        prefix = match[1];
        const numStr = match[2];
        const numVal = parseInt(numStr, 10);
        padLen = numStr.length;
        if (numVal > maxNum) {
          maxNum = numVal;
        }
      }
    }

    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(padLen, "0");
    const nextSku = `${prefix}${formattedNum}`;
    const nextHalfSku = `${prefix}${formattedNum}H`;

    return NextResponse.json({
      next_sku: nextSku,
      next_half_sku: nextHalfSku,
      last_max_number: maxNum,
    });
  } catch (error: any) {
    console.error("Gagal mendapatkan SKU berikutnya:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
