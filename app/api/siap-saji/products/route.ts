import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const category_id = p.get("category_id") || "";
  const is_half = p.get("is_half") || "";

  const wheres: string[] = ["p.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (search) {
    wheres.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }

  if (category_id) {
    wheres.push(`p.category_id = $${idx}`);
    vals.push(Number(category_id));
    idx++;
  }

  if (is_half === "true") {
    wheres.push(`p.is_half_portion = true`);
  } else if (is_half === "false") {
    wheres.push(`p.is_half_portion = false`);
  }

  const whereSql = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const client = await pool.connect();
  try {
    const [countRes, dataRes, categoriesRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM products p ${whereSql}`, vals),
      client.query(
        `SELECT 
          p.*,
          pcat.name AS category_name,
          COALESCE(
            json_agg(
              json_build_object('channel_id', pc.channel_id, 'channel_name', ch.name, 'harga_override', pc.harga_override)
            ) FILTER (WHERE pc.channel_id IS NOT NULL AND pc.is_active = true), '[]'
          ) AS channel_prices
        FROM products p
        LEFT JOIN product_categories pcat ON p.category_id = pcat.id
        LEFT JOIN product_channels pc ON pc.product_id = p.id
        LEFT JOIN channels ch ON pc.channel_id = ch.id
        ${whereSql}
        GROUP BY p.id, pcat.name
        ORDER BY p.is_half_portion ASC, p.name ASC
        LIMIT $${idx} OFFSET $${idx + 1}`,
        [...vals, limit, offset]
      ),
      client.query("SELECT * FROM product_categories WHERE lini = 'siap_saji' ORDER BY name"),
    ]);

    const total = Number(countRes.rows[0].count);
    return NextResponse.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      categories: categoriesRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil katalog produk Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sku, name, category_id, description, price, is_half_portion, parent_sku, channel_prices } = body;

  if (!sku || !name || price === undefined) {
    return NextResponse.json({ error: "SKU, Nama Produk, dan Harga wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existSku = await client.query("SELECT id FROM products WHERE sku = $1", [sku.trim()]);
    if (existSku.rows.length > 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: `SKU '${sku}' sudah digunakan produk lain.` }, { status: 400 });
    }

    const insRes = await client.query(
      `INSERT INTO products (sku, name, category_id, description, price, lini, status, is_half_portion, parent_sku)
       VALUES ($1, $2, $3, $4, $5, 'siap_saji', 'Aktif', $6, $7)
       RETURNING *`,
      [
        sku.trim(),
        name.trim(),
        category_id ? Number(category_id) : null,
        description || null,
        Number(price),
        Boolean(is_half_portion),
        parent_sku || null,
      ]
    );

    const prodId = insRes.rows[0].id;

    // Save channel price overrides if provided
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
    return NextResponse.json(insRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menambah produk Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
