import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { formatDate } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "ID order tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `SELECT 
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        c.patokan AS customer_patokan,
        a.kecamatan AS area_kecamatan,
        a.kota AS area_kota,
        ch.name AS channel_name,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'product_name', pr.name,
              'sku', pr.sku,
              'price', oi.price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal
            )
          )
          FROM order_items oi
          LEFT JOIN products pr ON oi.product_id = pr.id
          WHERE oi.order_id = o.id
        ) AS items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN channels ch ON o.channel_id = ch.id
      LEFT JOIN areas a ON c.area_id = a.id
      WHERE o.id = $1 AND o.lini = 'siap_saji'`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const order = orderRes.rows[0];
    const items = order.items || [];
    const createdDate = order.created_at ? new Date(order.created_at).toLocaleDateString("id-ID") : new Date().toLocaleDateString("id-ID");

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nota Struk #${order.no_struk || orderId}</title>
  <style>
    @page {
      size: 80mm auto; /* POS Thermal Receipt Paper Size (80mm) */
      margin: 0;
    }
    html, body {
      background: #f3f4f6;
      margin: 0;
      padding: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #111827;
    }
    .receipt-container {
      width: 80mm;
      max-width: 100%;
      background: white;
      margin: 20px auto;
      padding: 12px;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 10px;
    }
    .header h2 {
      font-size: 16px;
      font-weight: 800;
      margin: 0;
    }
    .header p {
      font-size: 10px;
      color: #4b5563;
      margin: 2px 0 0;
    }
    .divider {
      border-top: 1px dashed #9ca3af;
      margin: 8px 0;
    }
    .info-row {
      font-size: 11px;
      line-height: 1.3;
    }
    .item-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 6px;
    }
    .item-table th {
      text-align: left;
      border-bottom: 1px dashed #9ca3af;
      padding-bottom: 4px;
    }
    .item-table td {
      padding-top: 4px;
      vertical-align: top;
    }
    .total-section {
      font-size: 11px;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
    }
    .bold {
      font-weight: 800;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      color: #6b7280;
      margin-top: 10px;
    }
    .no-print-toolbar {
      max-width: 80mm;
      margin: 15px auto 0;
      display: flex;
      gap: 8px;
    }
    .no-print-toolbar button {
      flex: 1;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 700;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-print {
      background: #5005A6;
      color: white;
    }
    .btn-close {
      background: #e5e7eb;
      color: #374151;
    }
    @media print {
      body {
        background: white;
      }
      .no-print-toolbar {
        display: none !important;
      }
      .receipt-container {
        margin: 0;
        border: none;
        box-shadow: none;
        width: 80mm !important;
        padding: 4px !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-toolbar">
    <button class="btn-print" onclick="window.print()">🖨️ Cetak Nota POS (80mm)</button>
    <button class="btn-close" onclick="window.close()">Tutup</button>
  </div>

  <div class="receipt-container">
    <div class="header">
      <h2>DYummy Catering</h2>
      <p>Jl Sindangsari 4 No 48 Kota Bandung Jawa Barat</p>
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <p style="margin:0;"><strong>${order.no_struk || `INV-${orderId}`}</strong> - ${formatDate(order.delivery_date)}</p>
      <p style="margin:2px 0 0; color:#4b5563;">Channel: ${order.channel_name || "Gojek"}</p>
    </div>

    <div class="divider"></div>

    <div class="info-row">
      <p style="margin:0; font-weight:700;">${order.customer_name}</p>
      <p style="margin:2px 0 0;">${order.customer_address}</p>
      ${order.customer_patokan ? `<p style="margin:2px 0 0; color:#4b5563;">-Patokan : ${order.customer_patokan}</p>` : ""}
      <p style="margin:2px 0 0; color:#6b7280;">Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})</p>
    </div>

    <div class="divider"></div>

    <table class="item-table">
      <thead>
        <tr>
          <th>Nama Barang</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it: any) => `
          <tr>
            <td>
              ${it.product_name}
              <br/>
              <span style="color:#6b7280; font-size:10px;">${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}</span>
            </td>
            <td style="text-align:right;">${Number(it.subtotal).toLocaleString("id-ID")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="total-section">
      <div class="flex-between">
        <span>Biaya Kirim</span>
        <span>${Number(order.shipping_fee).toLocaleString("id-ID")}</span>
      </div>
      <div class="flex-between bold" style="font-size: 13px; margin-top: 4px; color: #5005A6;">
        <span>Total</span>
        <span>Rp ${Number(order.grand_total).toLocaleString("id-ID")}</span>
      </div>
      <div class="flex-between" style="font-size: 10px; color: #4b5563; margin-top: 4px;">
        <span>Pembayaran</span>
        <span>${order.payment_bank} (${order.payment_account})</span>
      </div>
    </div>

    <div class="divider"></div>

    <div class="footer">
      Wanti Nova, ${createdDate}
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal generate nota stream:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
