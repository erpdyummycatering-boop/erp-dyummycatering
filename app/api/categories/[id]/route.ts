import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "Nama kategori wajib diisi" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      "UPDATE product_categories SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );
    if (!res.rows.length) {
      return NextResponse.json({ error: "Kategori tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    // Check if there are any products referencing this category
    const checkProducts = await client.query("SELECT COUNT(*) FROM products WHERE category_id = $1", [id]);
    if (Number(checkProducts.rows[0].count) > 0) {
      return NextResponse.json(
        { error: "Kategori tidak bisa dihapus karena masih digunakan oleh produk" },
        { status: 400 }
      );
    }

    await client.query("DELETE FROM product_categories WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
