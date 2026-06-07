import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const status_order = p.get("status_order") || "";
  const status_payment = p.get("status_payment") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";
  const pic_id = p.get("pic_id") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) { wheres.push(`(c.name ILIKE $${idx} OR o.venue ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
  if (status_order) { wheres.push(`o.status_order = $${idx}`); vals.push(status_order); idx++; }
  if (status_payment) { wheres.push(`o.status_payment = $${idx}`); vals.push(status_payment); idx++; }
  
  if (userRole === "CS / Sales") {
    wheres.push(`o.pic_id = $${idx}`);
    vals.push(userId);
    idx++;
  } else if (pic_id) {
    wheres.push(`o.pic_id = $${idx}`);
    vals.push(pic_id);
    idx++;
  }
  
  if (date_from) { wheres.push(`o.delivery_date >= $${idx}`); vals.push(date_from); idx++; }
  if (date_to) { wheres.push(`o.delivery_date <= $${idx}`); vals.push(date_to); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM orders o JOIN customers c ON o.customer_id=c.id ${where}`, vals),
      client.query(`
        SELECT o.*,c.name AS customer_name,u.name AS pic_name,
          (SELECT json_agg(json_build_object(
            'id',oi.id,'product_id',oi.product_id,'product_name',pr.name,
            'price',oi.price,'quantity',oi.quantity,'discount',oi.discount,'subtotal',oi.subtotal,
            'custom_menu',oi.custom_menu
          )) FROM order_items oi LEFT JOIN products pr ON oi.product_id=pr.id WHERE oi.order_id=o.id) AS items
        FROM orders o JOIN customers c ON o.customer_id=c.id LEFT JOIN users u ON o.pic_id=u.id
        ${where} ORDER BY o.delivery_date DESC, o.id DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { customer_id, pic_id, order_date, delivery_date, departure_time, arrival_time, venue, order_notes, status_payment, items } = await req.json();
  if (!customer_id || !delivery_date) return NextResponse.json({ error: "customer_id dan delivery_date wajib" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    let final_pic_id = pic_id;
    if (userRole === "CS / Sales") {
      final_pic_id = userId;
    }

    const grandTotal = (items || []).reduce((s: number, i: any) => s + (i.price * i.quantity - (i.discount || 0)), 0);
    
    // Check if repeat customer
    const customerRes = await client.query("SELECT phone FROM customers WHERE id = $1", [customer_id]);
    const phone = customerRes.rows[0]?.phone;
    let jenis_order = "New Order";
    if (phone) {
      const prevOrderRes = await client.query(
        `SELECT COUNT(*) FROM orders o 
         JOIN customers c ON o.customer_id = c.id 
         WHERE c.phone = $1 AND (o.status_order = 'Selesai' OR o.status_payment = 'Lunas')`,
        [phone]
      );
      if (Number(prevOrderRes.rows[0].count) > 0) {
        jenis_order = "Repeat Order";
      }
    }
    const final_order_date = order_date || new Date().toISOString().split("T")[0];

    const orderRes = await client.query(
      `INSERT INTO orders (customer_id,pic_id,order_date,delivery_date,departure_time,arrival_time,venue,order_notes,status_payment,grand_total,status_order,jenis_order,closing_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Baru',$11,$12) RETURNING *`,
      [customer_id, final_pic_id || null, final_order_date, delivery_date, departure_time || null, arrival_time || null, venue, order_notes, status_payment || "Belum Lunas", grandTotal, jenis_order, final_order_date]
    );
    const orderId = orderRes.rows[0].id;
    for (const item of (items || [])) {
      const subtotal = item.price * item.quantity - (item.discount || 0);
      await client.query(
        `INSERT INTO order_items (order_id,product_id,price,quantity,discount,subtotal,custom_menu) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [orderId, item.product_id, item.price, item.quantity, item.discount || 0, subtotal, item.custom_menu || null]
      );
    }
    await client.query("COMMIT");
    return NextResponse.json(orderRes.rows[0], { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
