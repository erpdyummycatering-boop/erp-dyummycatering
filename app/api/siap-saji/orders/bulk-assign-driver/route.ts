import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  try {
    const body = await req.json();
    const { orderIds, driver_id } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: "Tidak ada order yang dipilih." }, { status: 400 });
    }

    if (!driver_id) {
      return NextResponse.json({ error: "Driver wajib dipilih." }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify orders exist and belong to siap_saji
      const existingRes = await client.query(
        "SELECT id FROM orders WHERE id = ANY($1) AND lini = 'siap_saji' FOR UPDATE",
        [orderIds]
      );

      if (existingRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Order tidak ditemukan atau tidak valid." }, { status: 404 });
      }

      const validOrderIds = existingRes.rows.map((r) => r.id);

      // Update driver_id for all valid orders
      await client.query(
        `UPDATE orders
         SET driver_id = $1,
             updated_at = NOW()
         WHERE id = ANY($2)`,
        [Number(driver_id), validOrderIds]
      );

      await client.query("COMMIT");
      return NextResponse.json({
        message: "Driver berhasil ditetapkan.",
        updated_count: validOrderIds.length,
      });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Gagal melakukan bulk assign driver:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
