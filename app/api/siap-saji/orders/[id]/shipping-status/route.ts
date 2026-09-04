import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { shipping_status, driver_id } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (shipping_status !== undefined) {
      updates.push(`shipping_status = $${idx}`);
      values.push(shipping_status);
      idx++;
    }

    if (driver_id !== undefined) {
      // Fetch driver name if driver_id provided
      if (driver_id) {
        const dRes = await pool.query(`SELECT name FROM drivers WHERE id = $1`, [driver_id]);
        const dName = dRes.rows[0]?.name || null;
        updates.push(`driver_id = $${idx}`, `driver_name = $${idx + 1}`);
        values.push(driver_id, dName);
        idx += 2;
      } else {
        updates.push(`driver_id = NULL`, `driver_name = NULL`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Tidak ada field untuk diperbarui" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE siap_saji_orders
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING id, order_number, shipping_status, driver_id, driver_name
    `;

    const res = await pool.query(query, values);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Status pengiriman berhasil diperbarui",
      order: res.rows[0],
    });
  } catch (error: any) {
    console.error("Error update shipping status:", error);
    return NextResponse.json(
      { error: error.message || "Gagal memperbarui status pengiriman" },
      { status: 500 }
    );
  }
}
