import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { canManageKledo } from "@/lib/integration/access";
import { toDateOnly } from "@/lib/integration/dates";
import {
  enqueueCateringUpdate,
  financialChanged,
  loadOrderState,
  type OrderItemState,
} from "@/lib/integration/orderHooks";
import { publishJobsAfterResponse } from "@/lib/qstash";

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
          'product_name', p.name, 'custom_menu', oi.custom_menu, 'notes', oi.notes
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
    recipient_name,
    recipient_phone,
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
    const previous = await loadOrderState(client, Number(id));
    if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (userRole === "CS / Sales" && Number((await client.query("SELECT pic_id FROM orders WHERE id=$1", [id])).rows[0]?.pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let final_pic_id = pic_id;
    if (userRole === "CS / Sales") {
      final_pic_id = userId;
    }

    const nextItems: OrderItemState[] = (items || []).filter((item: { product_id?: unknown }) => item.product_id).map((item: any) => ({
      product_id: Number(item.product_id),
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      discount: Number(item.discount || 0),
      custom_menu: item.custom_menu || "",
      notes: item.notes || "",
    }));
    const nextState = {
      customer_id: Number(customer_id),
      order_date: toDateOnly(order_date) || "",
      delivery_date: toDateOnly(delivery_date) || "",
      shipping_fee: Number(shipping_fee || 0),
      additional_menu_price: Number(additional_menu_price || 0),
      items: nextItems,
    };
    const changed = financialChanged(previous, nextState);
    const cancelling = status_order === "Batal" || status_order === "Dibatalkan";
    if (previous.kledo_invoice_id && cancelling && !body.confirm_void_invoice) {
      return NextResponse.json({
        error: `Invoice ${previous.kledo_invoice_number || "Kledo"} sudah terbit. Batalkan lewat Finance dengan konfirmasi void invoice.`,
      }, { status: 409 });
    }
    if (previous.kledo_invoice_id && cancelling && body.confirm_void_invoice && !canManageKledo(userRole)) {
      return NextResponse.json({ error: "Hanya Finance atau Super Admin yang dapat membatalkan invoice Kledo." }, { status: 403 });
    }

    await client.query("BEGIN");
    
    // 1. Recalculate grand total
    const grandTotal = (items || []).reduce((s: number, i: any) => s + (Number(i.price) * Number(i.quantity) - Number(i.discount || 0)), 0) + Number(shipping_fee || 0) + Number(additional_menu_price || 0);
    
    // 2. Update order table
    const res = await client.query(
      `UPDATE orders SET 
        customer_id=$1, recipient_name=$2, recipient_phone=$3, pic_id=$4, order_date=$5, delivery_date=$6, 
        departure_time=$7, arrival_time=$8, shipping_fee=$9, additional_menu_price=$10, venue=$11, order_notes=$12, 
        status_order=$13, status_payment=$14, grand_total=$15, updated_at=NOW() 
      WHERE id=$16 RETURNING *`,
      [
        customer_id,
        recipient_name || null,
        recipient_phone || null,
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
        `INSERT INTO order_items (order_id, product_id, price, quantity, discount, subtotal, custom_menu, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, item.product_id, item.price, item.quantity, item.discount || 0, subtotal, item.custom_menu || null, item.notes || null]
      );
    }

    const kledoJobIds = await enqueueCateringUpdate(client, {
      userId: userId ? Number(userId) : null,
      previous,
      nextStatus: status_order,
      next: {
        ...nextState,
        venue: venue || "",
        recipient_name: recipient_name || "",
        recipient_phone: recipient_phone || "",
      },
    });

    await client.query("COMMIT");
    publishJobsAfterResponse(kledoJobIds);
    return NextResponse.json(res.rows[0]);
  } catch (e: any) {
    try { await client.query("ROLLBACK"); } catch { /* tidak ada transaksi terbuka */ }
    console.error("Gagal memperbarui order:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
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
    const previous = await loadOrderState(client, Number(id));
    if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const pic = await client.query("SELECT pic_id FROM orders WHERE id = $1", [id]);
    if (userRole === "CS / Sales" && Number(pic.rows[0]?.pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    if (previous.kledo_invoice_id) {
      return NextResponse.json({
        error: `Order sudah memiliki invoice Kledo${previous.kledo_invoice_number ? ` (${previous.kledo_invoice_number})` : ""} dan tidak bisa dihapus.`,
      }, { status: 409 });
    }

    await client.query("BEGIN");
    if (previous.kledo_so_id) {
      await client.query(
        `UPDATE orders SET status_order='Batal', cancelled_at=now(), cancel_reason=$2, cancelled_by=$3, updated_at=now() WHERE id=$1`,
        [id, "Dihapus dari ERP", userId ? Number(userId) : null]
      );
      const kledoJobIds = await enqueueCateringUpdate(client, {
        userId: userId ? Number(userId) : null,
        previous,
        nextStatus: "Batal",
        next: {
          customer_id: previous.customer_id,
          order_date: previous.order_date,
          delivery_date: previous.delivery_date,
          shipping_fee: previous.shipping_fee,
          additional_menu_price: previous.additional_menu_price,
          venue: previous.venue,
          recipient_name: previous.recipient_name,
          recipient_phone: previous.recipient_phone,
          items: previous.items,
        },
      });
      await client.query("COMMIT");
      publishJobsAfterResponse(kledoJobIds);
      return NextResponse.json({ success: true, cancelled: true });
    }

    await client.query("DELETE FROM orders WHERE id = $1", [id]);
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* tidak ada transaksi terbuka */ }
    console.error("Gagal menghapus order:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { client.release(); }
}
