import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 10));
  const offset = (page - 1) * limit;

  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const customer = result.rows[0];

    const statsRes = await client.query(`
      SELECT COUNT(*) as total_orders, COALESCE(SUM(grand_total), 0) as total_omzet 
      FROM orders WHERE customer_id = $1
    `, [id]);

    const ordersRes = await client.query(`
      SELECT o.*, u.name AS pic_name,
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'price', oi.price,
          'quantity', oi.quantity, 'discount', oi.discount, 'subtotal', oi.subtotal,
          'product_name', p.name, 'custom_menu', oi.custom_menu
        )) FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) as items
      FROM orders o
      LEFT JOIN users u ON o.pic_id = u.id
      WHERE o.customer_id = $1
      ORDER BY o.delivery_date DESC, o.id DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const total = Number(statsRes.rows[0].total_orders || 0);
    const totalOmzet = Number(statsRes.rows[0].total_omzet || 0);

    return NextResponse.json({
      ...customer,
      total_omzet: totalOmzet,
      order_count: total,
      orders: ordersRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, phone, email, type, address, notes, status } = body;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, type=$4, address=$5, notes=$6, status=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, phone, email, type, address, notes, status || "Prospek", id]
    );
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("Gagal memperbarui customer:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM leads WHERE customer_id = $1", [id]);
    await client.query("DELETE FROM rfm_scores WHERE customer_id = $1", [id]);
    await client.query(
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1)",
      [id]
    );
    await client.query("DELETE FROM orders WHERE customer_id = $1", [id]);
    await client.query("DELETE FROM customers WHERE id = $1", [id]);
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menghapus customer:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
