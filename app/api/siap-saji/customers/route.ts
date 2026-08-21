import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(10000, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const segmen = p.get("segmen") || "";

  const wheres: string[] = ["c.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (search) {
    wheres.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.patokan ILIKE $${idx} OR a.kecamatan ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }

  if (segmen) {
    wheres.push(`r.segmen = $${idx}`);
    vals.push(segmen);
    idx++;
  }

  const whereSql = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const client = await pool.connect();
  try {
    // Ensure loyalty_settings table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_settings (
        id INT PRIMARY KEY DEFAULT 1,
        min_order NUMERIC(12,2) DEFAULT 100000,
        point_percentage NUMERIC(5,2) DEFAULT 2.0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO loyalty_settings (id, min_order, point_percentage)
      VALUES (1, 100000, 2.0)
      ON CONFLICT (id) DO NOTHING;
    `);

    const settingsRes = await client.query("SELECT min_order, point_percentage FROM loyalty_settings WHERE id = 1");
    const minOrder = Number(settingsRes.rows[0]?.min_order ?? 100000);
    const pointPercentage = Number(settingsRes.rows[0]?.point_percentage ?? 2.0);

    const [countRes, dataRes] = await Promise.all([
      client.query(
        `SELECT COUNT(*) FROM customers c 
         LEFT JOIN areas a ON c.area_id = a.id
         LEFT JOIN rfm_scores r ON r.customer_id = c.id ${whereSql}`,
        vals
      ),
      client.query(
        `SELECT 
          c.*,
          a.kecamatan AS area_kecamatan,
          a.kota AS area_kota,
          a.shipping_zone,
          r.r_score, r.f_score, r.m_score, r.rfm_total, r.segmen, r.channel_favorit,
          COALESCE(r.monetary, (SELECT COALESCE(SUM(grand_total), 0) FROM orders WHERE customer_id = c.id AND status_order <> 'Dibatalkan')) AS total_omset,
          COALESCE(r.frequency, (SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status_order <> 'Dibatalkan')) AS total_orders,
          r.last_order_date,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN o.grand_total >= $${idx + 2} THEN ROUND(o.grand_total * ($${idx + 3} / 100.0))
                ELSE 0 
              END
            ), 0)::numeric
            FROM orders o 
            WHERE o.customer_id = c.id AND o.status_order <> 'Dibatalkan' AND o.lini = 'siap_saji'
          ) AS loyalty_points
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.id
        LEFT JOIN rfm_scores r ON r.customer_id = c.id
        ${whereSql}
        ORDER BY c.id DESC
        LIMIT $${idx} OFFSET $${idx + 1}`,
        [...vals, limit, offset, minOrder, pointPercentage]
      ),
    ]);

    const total = Number(countRes.rows[0].count);
    return NextResponse.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      loyalty_settings: {
        min_order: minOrder,
        point_percentage: pointPercentage,
      },
    });
  } catch (error: any) {
    console.error("Gagal mengambil data customer Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, address, patokan, area_id, type } = body;

  if (!name || !phone) {
    return NextResponse.json({ error: "Nama dan No Telepon wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const existRes = await client.query("SELECT id FROM customers WHERE phone = $1", [phone.trim()]);
    if (existRes.rows.length > 0) {
      return NextResponse.json({ error: "Nomor WhatsApp/Telepon ini sudah terdaftar." }, { status: 400 });
    }

    const insRes = await client.query(
      `INSERT INTO customers (name, phone, type, address, patokan, area_id, lini, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'siap_saji', 'Aktif')
       RETURNING *`,
      [
        name.trim(),
        phone.trim(),
        type || "Personal",
        address || null,
        patokan || null,
        area_id ? Number(area_id) : null,
      ]
    );

    return NextResponse.json(insRes.rows[0], { status: 201 });
  } catch (error: any) {
    console.error("Gagal menyimpan customer Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
