import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT ps.*, u.name as chef_name,
        (SELECT json_agg(json_build_object('order_id', so.order_id, 'customer', c.name, 'total', o.grand_total))
         FROM schedule_orders so JOIN orders o ON so.order_id = o.id JOIN customers c ON o.customer_id = c.id
         WHERE so.schedule_id = ps.id) as orders,
        (SELECT json_agg(json_build_object(
          'id', sm.id, 'recipe_id', sm.recipe_id, 'menu_name', r.menu_name,
          'quantity_pax', sm.quantity_pax, 'hpp_subtotal', sm.hpp_subtotal, 'standard_cost', r.standard_cost
        )) FROM schedule_menus sm JOIN recipes r ON sm.recipe_id = r.id WHERE sm.schedule_id = ps.id) as menus,
        (SELECT json_agg(json_build_object(
          'id', pi.id, 'item_name', pi.item_name, 'quantity', pi.quantity,
          'uom', pi.uom, 'estimated_price', pi.estimated_price, 'subtotal', pi.subtotal
        )) FROM purchase_requests pr2
         JOIN pr_items pi ON pi.pr_id = pr2.id
         WHERE pr2.schedule_id = ps.id AND pr2.status = 'Draft') as custom_items
      FROM production_schedules ps LEFT JOIN users u ON ps.chef_id = u.id
      WHERE ps.id = $1`, [id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE production_schedules SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM production_schedules WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally { client.release(); }
}
