import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) return NextResponse.json({ error: "ID Customer tidak valid" }, { status: 400 });

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

    const [custRes, ordersRes] = await Promise.all([
      client.query(
        `SELECT 
          c.*,
          a.kecamatan AS area_kecamatan,
          a.kota AS area_kota,
          a.shipping_zone,
          r.r_score, r.f_score, r.m_score, r.rfm_total, r.segmen, r.channel_favorit,
          COALESCE((SELECT SUM(grand_total) FROM orders WHERE customer_id = c.id AND status_order <> 'Dibatalkan' AND lini = 'siap_saji'), 0) AS total_omset,
          COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = c.id AND status_order <> 'Dibatalkan' AND lini = 'siap_saji'), 0) AS total_orders,
          COALESCE((
            SELECT SUM(
              CASE 
                WHEN o.grand_total >= ls.min_order THEN ROUND(o.grand_total * (ls.point_percentage / 100.0))
                ELSE 0 
              END
            )
            FROM orders o 
            CROSS JOIN loyalty_settings ls
            WHERE o.customer_id = c.id AND o.status_order <> 'Dibatalkan' AND o.lini = 'siap_saji' AND ls.id = 1
          ), 0)::numeric AS loyalty_points
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.id
        LEFT JOIN rfm_scores r ON r.customer_id = c.id
        WHERE c.id = $1`,
        [custId]
      ),
      client.query(
        `SELECT o.*, ch.name AS channel_name
         FROM orders o
         LEFT JOIN channels ch ON o.channel_id = ch.id
         WHERE o.customer_id = $1 AND o.lini = 'siap_saji'
         ORDER BY o.delivery_date DESC LIMIT 20`,
        [custId]
      ),
    ]);

    if (custRes.rows.length === 0) {
      return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({
      customer: custRes.rows[0],
      orders: ordersRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil detail customer:", error);
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
  const custId = Number(id);
  if (isNaN(custId)) return NextResponse.json({ error: "ID Customer tidak valid" }, { status: 400 });

  const body = await req.json();
  const { name, phone, address, patokan, area_id, status } = body;

  const client = await pool.connect();
  try {
    const updRes = await client.query(
      `UPDATE customers
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           address = COALESCE($3, address),
           patokan = COALESCE($4, patokan),
           area_id = COALESCE($5, area_id),
           status = COALESCE($6, status)
       WHERE id = $7
       RETURNING *`,
      [
        name ? name.trim() : null,
        phone ? phone.trim() : null,
        address || null,
        patokan || null,
        area_id ? Number(area_id) : null,
        status || null,
        custId,
      ]
    );

    if (updRes.rows.length === 0) {
      return NextResponse.json({ error: "Customer tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(updRes.rows[0]);
  } catch (error: any) {
    console.error("Gagal meng-update customer:", error);
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
  const custId = Number(id);
  if (isNaN(custId)) return NextResponse.json({ error: "ID Customer tidak valid" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("UPDATE customers SET status = 'Nonaktif' WHERE id = $1", [custId]);
    return NextResponse.json({ message: "Customer dinonaktifkan." });
  } catch (error: any) {
    console.error("Gagal menonaktifkan customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
