import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

    // 80mm POS Thermal receipt width: 80mm = 226.77 pt
    const width = 226.77;

    // Calculate exact dynamic content height to avoid wasted white paper
    let calculatedHeight = 150;
    calculatedHeight += Math.max(1, Math.ceil(String(order.customer_address || "").length / 34)) * 11;
    if (order.customer_patokan) {
      calculatedHeight += Math.max(1, Math.ceil(String(order.customer_patokan).length / 30)) * 11;
    }
    items.forEach((it: any) => {
      calculatedHeight += Math.max(1, Math.ceil(String(it.product_name || "").length / 35)) * 11;
      calculatedHeight += 14;
    });

    const height = Math.max(180, Math.ceil(calculatedHeight));

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    let y = height - 20;
    const margin = 10;

    const drawCenterText = (text: string, font: any, size: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color: rgb(0.07, 0.09, 0.15) });
      y -= size + 4;
    };

    const drawDashedLine = () => {
      page.drawText("- - - - - - - - - - - - - - - - - - - - - - - - - - - - -", {
        x: margin,
        y,
        size: 7.5,
        font: fontRegular,
        color: rgb(0.4, 0.45, 0.5),
      });
      y -= 12;
    };

    // Header
    drawCenterText("DYummy Catering", fontBold, 12);
    drawCenterText("Jl Sindangsari 4 No 48 Kota Bandung", fontRegular, 8);
    y -= 4;

    drawDashedLine();

    // Order info
    page.drawText(`${order.no_struk || `INV-${orderId}`} - ${formatDate(order.delivery_date)}`, {
      x: margin,
      y,
      size: 8,
      font: fontBold,
    });
    y -= 12;
    page.drawText(`Channel: ${order.channel_name || "Gojek"}`, {
      x: margin,
      y,
      size: 8,
      font: fontRegular,
    });
    y -= 14;

    drawDashedLine();

    // Customer info
    page.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 8.5, font: fontBold });
    y -= 12;
    page.drawText(String(order.customer_address || "-").substring(0, 38), { x: margin, y, size: 8, font: fontRegular });
    y -= 11;
    if (order.customer_patokan) {
      page.drawText(`-Patokan : ${String(order.customer_patokan).substring(0, 32)}`, { x: margin, y, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
      y -= 11;
    }
    page.drawText(`Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`, { x: margin, y, size: 8, font: fontRegular });
    y -= 14;

    drawDashedLine();

    // Items
    items.forEach((it: any) => {
      page.drawText(String(it.product_name || "-").substring(0, 35), { x: margin, y, size: 8, font: fontBold });
      y -= 11;

      const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
      const subtotalText = `Rp ${Number(it.subtotal).toLocaleString("id-ID")}`;
      page.drawText(qtyPriceText, { x: margin, y, size: 7.5, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

      const subWidth = fontBold.widthOfTextAtSize(subtotalText, 8);
      page.drawText(subtotalText, { x: width - margin - subWidth, y, size: 8, font: fontBold });
      y -= 14;
    });

    drawDashedLine();

    // Shipping
    page.drawText("Biaya Kirim:", { x: margin, y, size: 8, font: fontRegular });
    const shipText = `Rp ${Number(order.shipping_fee).toLocaleString("id-ID")}`;
    const shipWidth = fontRegular.widthOfTextAtSize(shipText, 8);
    page.drawText(shipText, { x: width - margin - shipWidth, y, size: 8, font: fontRegular });
    y -= 13;

    // Total
    page.drawText("Total:", { x: margin, y, size: 9.5, font: fontBold, color: rgb(0.31, 0.02, 0.65) });
    const totalText = `Rp ${Number(order.grand_total).toLocaleString("id-ID")}`;
    const totalWidth = fontBold.widthOfTextAtSize(totalText, 9.5);
    page.drawText(totalText, { x: width - margin - totalWidth, y, size: 9.5, font: fontBold, color: rgb(0.31, 0.02, 0.65) });
    y -= 13;

    // Payment
    page.drawText("Pembayaran:", { x: margin, y, size: 7.5, font: fontRegular });
    const bankText = `${order.payment_bank} (${order.payment_account})`;
    const bankWidth = fontRegular.widthOfTextAtSize(bankText, 7.5);
    page.drawText(bankText, { x: width - margin - bankWidth, y, size: 7.5, font: fontRegular });
    y -= 14;

    drawDashedLine();

    drawCenterText(`Wanti Nova, ${createdDate}`, fontOblique, 7.5);

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="nota-${order.no_struk || orderId}.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal generate stream PDF nota:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
