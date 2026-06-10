import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT o.*, c.name as customer_name, u.name as pic_name,
        (SELECT json_agg(json_build_object(
          'id', oi.id, 'product_id', oi.product_id, 'price', oi.price,
          'quantity', oi.quantity, 'discount', oi.discount, 'subtotal', oi.subtotal,
          'product_name', p.name, 'custom_menu', oi.custom_menu
        )) FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) as items
       FROM orders o JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.pic_id = u.id WHERE o.id = $1`, [id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    const order = res.rows[0];
    if (userRole === "CS / Sales" && Number(order.pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(order);
  } finally { client.release(); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const body = await req.json();
  const {
    customer_id,
    pic_id,
    order_date,
    delivery_date,
    departure_time,
    arrival_time,
    shipping_fee,
    additional_menu_price,
    venue,
    order_notes,
    status_order,
    status_payment,
    items
  } = body;

  const client = await pool.connect();
  try {
    const exist = await client.query("SELECT pic_id FROM orders WHERE id = $1", [id]);
    if (!exist.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (userRole === "CS / Sales" && Number(exist.rows[0].pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let final_pic_id = pic_id;
    if (userRole === "CS / Sales") {
      final_pic_id = userId;
    }

    await client.query("BEGIN");
    
    // 1. Recalculate grand total
    const grandTotal = (items || []).reduce((s: number, i: any) => s + (Number(i.price) * Number(i.quantity) - Number(i.discount || 0)), 0) + Number(shipping_fee || 0) + Number(additional_menu_price || 0);
    
    // 2. Update order table
    const res = await client.query(
      `UPDATE orders SET 
        customer_id=$1, pic_id=$2, order_date=$3, delivery_date=$4, 
        departure_time=$5, arrival_time=$6, shipping_fee=$7, additional_menu_price=$8, venue=$9, order_notes=$10, 
        status_order=$11, status_payment=$12, grand_total=$13, updated_at=NOW() 
      WHERE id=$14 RETURNING *`,
      [
        customer_id,
        final_pic_id || null,
        order_date,
        delivery_date,
        departure_time || null,
        arrival_time || null,
        Number(shipping_fee || 0),
        Number(additional_menu_price || 0),
        venue,
        order_notes,
        status_order,
        status_payment,
        grandTotal,
        id
      ]
    );

    if (res.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 3. Delete old items
    await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);

    // 4. Insert new items
    for (const item of (items || [])) {
      const subtotal = Number(item.price) * Number(item.quantity) - Number(item.discount || 0);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, price, quantity, discount, subtotal, custom_menu) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, item.product_id, item.price, item.quantity, item.discount || 0, subtotal, item.custom_menu || null]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(res.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const exist = await client.query("SELECT pic_id FROM orders WHERE id = $1", [id]);
    if (!exist.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (userRole === "CS / Sales" && Number(exist.rows[0].pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await client.query("DELETE FROM orders WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally { client.release(); }
}
