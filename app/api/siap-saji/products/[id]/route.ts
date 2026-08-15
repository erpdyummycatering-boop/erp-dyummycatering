import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prodId = Number(id);
  if (isNaN(prodId)) return NextResponse.json({ error: "ID Produk tidak valid" }, { status: 400 });

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object('channel_id', pc.channel_id, 'harga_override', pc.harga_override)
          ) FILTER (WHERE pc.channel_id IS NOT NULL AND pc.is_active = true), '[]'
        ) AS channel_prices
      FROM products p
      LEFT JOIN product_channels pc ON pc.product_id = p.id
      WHERE p.id = $1
      GROUP BY p.id`,
      [prodId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Gagal mengambil detail produk:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prodId = Number(id);
  if (isNaN(prodId)) return NextResponse.json({ error: "ID Produk tidak valid" }, { status: 400 });

  const body = await req.json();
  const { sku, name, category_id, description, price, status, is_half_portion, parent_sku, channel_prices } = body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updRes = await client.query(
      `UPDATE products
       SET sku = COALESCE($1, sku),
           name = COALESCE($2, name),
           category_id = COALESCE($3, category_id),
           description = COALESCE($4, description),
           price = COALESCE($5, price),
           status = COALESCE($6, status),
           is_half_portion = COALESCE($7, is_half_portion),
           parent_sku = COALESCE($8, parent_sku)
       WHERE id = $9
       RETURNING *`,
      [
        sku ? sku.trim() : null,
        name ? name.trim() : null,
        category_id ? Number(category_id) : null,
        description || null,
        price !== undefined ? Number(price) : null,
        status || null,
        is_half_portion !== undefined ? Boolean(is_half_portion) : null,
        parent_sku || null,
        prodId,
      ]
    );

    if (updRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    }

    // Update channel prices if provided
    if (Array.isArray(channel_prices)) {
      for (const cp of channel_prices) {
        if (cp.channel_id) {
          await client.query(
            `INSERT INTO product_channels (product_id, channel_id, harga_override, is_active)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (product_id, channel_id)
             DO UPDATE SET harga_override = EXCLUDED.harga_override, is_active = true`,
            [prodId, Number(cp.channel_id), cp.harga_override !== undefined && cp.harga_override !== null ? Number(cp.harga_override) : null]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(updRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal meng-update produk:", error);
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
  const prodId = Number(id);
  if (isNaN(prodId)) return NextResponse.json({ error: "ID Produk tidak valid" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("UPDATE products SET status = 'Nonaktif' WHERE id = $1", [prodId]);
    return NextResponse.json({ message: "Produk dinonaktifkan." });
  } catch (error: any) {
    console.error("Gagal menonaktifkan produk:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
