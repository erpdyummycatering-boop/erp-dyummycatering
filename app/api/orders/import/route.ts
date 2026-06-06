import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { orders } = await req.json();
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return NextResponse.json({ error: "Data order tidak boleh kosong" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const order of orders) {
      if (!order.customer_name) {
        throw new Error("Nama customer wajib diisi");
      }
      if (!order.delivery_date) {
        throw new Error(`Tanggal kirim wajib diisi untuk order customer ${order.customer_name}`);
      }

      // 1. Identify or create customer
      let customerId;
      const custRes = await client.query("SELECT id FROM customers WHERE name = $1 LIMIT 1", [order.customer_name]);
      if (custRes.rows.length) {
        customerId = custRes.rows[0].id;
      } else {
        // If phone is provided, check if it already exists to avoid unique violation
        if (order.customer_phone) {
          const phoneRes = await client.query("SELECT id FROM customers WHERE phone = $1 LIMIT 1", [order.customer_phone]);
          if (phoneRes.rows.length) {
            customerId = phoneRes.rows[0].id;
          }
        }

        if (!customerId) {
          const insertCust = await client.query(
            "INSERT INTO customers (name, phone, type) VALUES ($1, $2, $3) RETURNING id",
            [order.customer_name, order.customer_phone || null, order.customer_type || "Personal"]
          );
          customerId = insertCust.rows[0].id;
        }
      }

      // 1.5 Identify pic_id (CS/Sales)
      let picId = null;
      if (userRole === "CS / Sales") {
        picId = userId;
      } else if (order.pic_name) {
        const picRes = await client.query("SELECT id FROM users WHERE name ILIKE $1 LIMIT 1", [order.pic_name]);
        if (picRes.rows.length) {
          picId = picRes.rows[0].id;
        }
      }

      // Calculate grand total if not explicitly provided
      let grandTotal = Number(order.grand_total);
      if (isNaN(grandTotal) || grandTotal <= 0) {
        grandTotal = (order.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.price || 0) * Number(item.quantity || 0));
        }, 0);
      }

      // 2. Insert order
      const orderRes = await client.query(
        `INSERT INTO orders (customer_id, pic_id, order_date, delivery_date, departure_time, arrival_time, venue, order_notes, status_order, status_payment, grand_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [
          customerId,
          picId,
          order.order_date || new Date().toISOString().split("T")[0],
          order.delivery_date,
          order.departure_time || null,
          order.arrival_time || null,
          order.venue || null,
          order.order_notes || null,
          order.status_order || "Baru",
          order.status_payment || "Belum Lunas",
          grandTotal
        ]
      );
      const orderId = orderRes.rows[0].id;

      // 3. Insert order items
      for (const item of (order.items || [])) {
        if (!item.product_name) continue;

        // Resolve product
        const prodRes = await client.query("SELECT id, price FROM products WHERE name = $1 LIMIT 1", [item.product_name]);
        if (!prodRes.rows.length) {
          throw new Error(`Produk "${item.product_name}" untuk customer "${order.customer_name}" tidak ditemukan di database. Pastikan nama produk sama dengan katalog.`);
        }

        const productId = prodRes.rows[0].id;
        const price = Number(item.price) || Number(prodRes.rows[0].price);
        const qty = Number(item.quantity) || 1;
        const subtotal = price * qty;

        await client.query(
          `INSERT INTO order_items (order_id, product_id, price, quantity, discount, subtotal, custom_menu)
           VALUES ($1, $2, $3, $4, 0, $5, $6)`,
          [orderId, productId, price, qty, subtotal, item.custom_menu || null]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ success: true, count: orders.length });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message || "Gagal mengimpor data order" }, { status: 400 });
  } finally {
    client.release();
  }
}
