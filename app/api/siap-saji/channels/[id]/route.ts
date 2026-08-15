import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const channelId = Number(id);
  if (isNaN(channelId)) return NextResponse.json({ error: "ID Channel tidak valid" }, { status: 400 });

  const body = await req.json();
  const { name, harga_type, platform_key, urutan, is_active } = body;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE channels
       SET name = COALESCE($1, name),
           harga_type = COALESCE($2, harga_type),
           platform_key = COALESCE($3, platform_key),
           urutan = COALESCE($4, urutan),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 AND lini = 'siap_saji'
       RETURNING *`,
      [
        name ? name.trim() : null,
        harga_type || null,
        platform_key || null,
        urutan !== undefined ? Number(urutan) : null,
        is_active !== undefined ? Boolean(is_active) : null,
        channelId,
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Channel tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Gagal meng-update channel:", error);
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
  const channelId = Number(id);
  if (isNaN(channelId)) return NextResponse.json({ error: "ID Channel tidak valid" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("UPDATE channels SET is_active = false, updated_at = NOW() WHERE id = $1", [channelId]);
    return NextResponse.json({ message: "Channel berhasil dinonaktifkan." });
  } catch (error: any) {
    console.error("Gagal menonaktifkan channel:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
