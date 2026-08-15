import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const areaId = Number(id);
  if (isNaN(areaId)) return NextResponse.json({ error: "ID Area tidak valid" }, { status: 400 });

  const body = await req.json();
  const { kecamatan, kota, provinsi, shipping_zone, is_active } = body;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE areas
       SET kecamatan = COALESCE($1, kecamatan),
           kota = COALESCE($2, kota),
           provinsi = COALESCE($3, provinsi),
           shipping_zone = COALESCE($4, shipping_zone),
           is_active = COALESCE($5, is_active)
       WHERE id = $6
       RETURNING *`,
      [
        kecamatan ? kecamatan.trim() : null,
        kota ? kota.trim() : null,
        provinsi || null,
        shipping_zone || null,
        is_active !== undefined ? Boolean(is_active) : null,
        areaId,
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Area tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Gagal meng-update area:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const areaId = Number(id);
  if (isNaN(areaId)) return NextResponse.json({ error: "ID Area tidak valid" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("UPDATE areas SET is_active = false WHERE id = $1", [areaId]);
    return NextResponse.json({ message: "Area dinonaktifkan." });
  } catch (error: any) {
    console.error("Gagal menonaktifkan area:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
