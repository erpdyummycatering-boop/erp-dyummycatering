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
      if (driver_id) {
        updates.push(`driver_id = $${idx}`);
        values.push(driver_id);
        idx++;
      } else {
        updates.push(`driver_id = NULL`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "Tidak ada field untuk diperbarui" }, { status: 400 });
    }

    values.push(id);
    const query = `
      UPDATE orders
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE id = $${idx} AND lini = 'siap_saji'
      RETURNING id, no_struk AS order_number, shipping_status, driver_id
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
