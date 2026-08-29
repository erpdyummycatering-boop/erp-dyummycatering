import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const areaId = Number(id);
  if (isNaN(areaId)) {
    return NextResponse.json({ error: "ID area/wilayah tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Check if area is referenced by any customer who has orders
    const checkRes = await client.query(
      `SELECT COUNT(o.id) FROM customers c
       JOIN orders o ON o.customer_id = c.id
       WHERE c.area_id = $1 AND o.status_order <> 'Dibatalkan'`,
      [areaId]
    );

    const orderCount = Number(checkRes.rows[0].count || 0);
    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Kecamatan tidak dapat dihapus karena sudah memiliki ${orderCount} transaksi/order terhubung.` },
        { status: 400 }
      );
    }

    await client.query("BEGIN");
    // Delete orphan shipping rates linked to this area
    await client.query("DELETE FROM shipping_rates WHERE area_id = $1", [areaId]);
    // Reset area_id to null for customers linked to this area who don't have active orders
    await client.query("UPDATE customers SET area_id = NULL WHERE area_id = $1", [areaId]);
    // Delete area
    const delRes = await client.query("DELETE FROM areas WHERE id = $1 RETURNING *", [areaId]);
    await client.query("COMMIT");

    if (delRes.rows.length === 0) {
      return NextResponse.json({ error: "Kecamatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ message: "Kecamatan berhasil dihapus." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menghapus kecamatan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
