import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    // Query all existing SKUs for siap_saji products
    const res = await client.query(
      `SELECT sku FROM products WHERE lini = 'siap_saji' AND sku IS NOT NULL`
    );

    const existingSkus = new Set<string>(
      res.rows.map((r) => String(r.sku).trim().toUpperCase())
    );

    let defaultPrefix = "SP-A";
    let maxNum = 0;

    for (const skuStr of existingSkus) {
      const match = skuStr.match(/^([A-Za-z]+-?[A-Za-z]*)(\d+)/);
      if (match) {
        defaultPrefix = match[1];
        const numVal = parseInt(match[2], 10);
        if (numVal > maxNum) {
          maxNum = numVal;
        }
      }
    }

    // Find next available full SKU
    let nextCandidateNum = maxNum + 1;
    let nextSku = `${defaultPrefix}${String(nextCandidateNum).padStart(2, "0")}`;
    while (existingSkus.has(nextSku.toUpperCase())) {
      nextCandidateNum++;
      nextSku = `${defaultPrefix}${String(nextCandidateNum).padStart(2, "0")}`;
    }

    // Find next available half SKU
    let nextHalfSku = `${nextSku}H`;
    if (existingSkus.has(nextHalfSku.toUpperCase())) {
      let halfNum = nextCandidateNum + 1;
      nextHalfSku = `${defaultPrefix}${String(halfNum).padStart(2, "0")}H`;
      while (existingSkus.has(nextHalfSku.toUpperCase())) {
        halfNum++;
        nextHalfSku = `${defaultPrefix}${String(halfNum).padStart(2, "0")}H`;
      }
    }

    return NextResponse.json({
      next_sku: nextSku,
      next_half_sku: nextHalfSku,
    });
  } catch (error: any) {
    console.error("Gagal mendapatkan Next SKU:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
