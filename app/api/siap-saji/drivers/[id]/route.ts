import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, phone, status } = body;
  const driverId = Number(id);

  if (!driverId) {
    return NextResponse.json({ error: "ID Driver tidak valid." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const upd = await client.query(
      `UPDATE drivers
       SET name = COALESCE($1, name), phone = COALESCE($2, phone), status = COALESCE($3, status)
       WHERE id = $4 AND lini = 'siap_saji'
       RETURNING *`,
      [name ? name.trim() : null, phone || null, status || null, driverId]
    );

    if (upd.rows.length === 0) {
      return NextResponse.json({ error: "Driver tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: upd.rows[0] });
  } catch (error: any) {
    console.error("Gagal update driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const driverId = Number(id);

  if (!driverId) {
    return NextResponse.json({ error: "ID Driver tidak valid." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM drivers WHERE id = $1 AND lini = 'siap_saji'", [driverId]);
    return NextResponse.json({ success: true, message: "Driver berhasil dihapus." });
  } catch (error: any) {
    console.error("Gagal menghapus driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
