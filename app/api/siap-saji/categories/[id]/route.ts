import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, description } = body;
  const catId = Number(id);

  if (!catId) {
    return NextResponse.json({ error: "ID Kategori tidak valid." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const upd = await client.query(
      `UPDATE product_categories
       SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW()
       WHERE id = $3 AND lini = 'siap_saji'
       RETURNING *`,
      [name ? name.trim() : null, description !== undefined ? description : null, catId]
    );

    if (upd.rows.length === 0) {
      return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: upd.rows[0] });
  } catch (error: any) {
    console.error("Gagal update kategori Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const catId = Number(id);

  if (!catId) {
    return NextResponse.json({ error: "ID Kategori tidak valid." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("DELETE FROM product_categories WHERE id = $1 AND lini = 'siap_saji'", [catId]);
    return NextResponse.json({ success: true, message: "Kategori berhasil dihapus." });
  } catch (error: any) {
    console.error("Gagal menghapus kategori Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
