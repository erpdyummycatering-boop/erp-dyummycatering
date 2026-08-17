import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 34): string[] => {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let curr = "";
  for (const w of words) {
    if ((curr + " " + w).trim().length <= maxChars) {
      curr = (curr + " " + w).trim();
    } else {
      if (curr) lines.push(curr);
      curr = w;
    }
  }
  if (curr) lines.push(curr);
  return lines.length > 0 ? lines : [text.substring(0, maxChars)];
};

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
        u.name AS pic_name,
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
      LEFT JOIN areas a ON c.area_id = a.id
      LEFT JOIN users u ON o.pic_id = u.id
      WHERE o.id = $1 AND o.lini = 'siap_saji'`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 });
    }

    const order = orderRes.rows[0];
    const items = order.items || [];
    const createdDate = order.created_at
      ? new Date(order.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const createdTime = order.created_at
      ? new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      : "";

    // 80mm POS Thermal receipt width: 80mm = 226.77 pt
    const width = 226.77;
    const margin = 1.5; // Ultra-narrow side margin (1.5pt) to span full paper width like reference receipt

    // Helper for measuring single order height accurately
    const measureOrderHeight = () => {
      let h = 0;
      // Header: DYummy Catering (24), Jl Sindangsari (15), Kota Bandung (15), SI.Struk (17), line (14)
      h += 24 + 15 + 15 + 17 + 14;

      // Customer info: Name (17), Address lines (lines * 15), Patokan lines (lines * 14), Kec (15), line (14)
      h += 17;
      const addrLines = wrapText(order.customer_address || "-", 34);
      h += addrLines.length * 15;
      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 34);
        h += patLines.length * 14;
      }
      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 34);
      h += kecLines.length * 15 + 14;

      // Table header bar: "Nama Barang .... Total Harga" (17), line (14)
      h += 17 + 14;

      // Items
      items.forEach((it: any) => {
        const pLines = wrapText(it.product_name || "-", 34);
        h += pLines.length * 15;
        h += 16;
      });

      // Shipping fee if > 0
      if (Number(order.shipping_fee) > 0) {
        h += 15;
        h += 16;
      }

      h += 14; // line

      // Summary: Sub Total (16), Diskon (16), line (14), Total (19), line (14)
      h += 16 + 16 + 14 + 19 + 14;

      // Footer: CS SIAP SAJI, Date (15)
      h += 15;

      return h;
    };

    const height = Math.ceil(measureOrderHeight() + 20); // 10pt top + 10pt bottom

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    let y = height - 10;

    const drawCenterText = (text: string, font: any, size: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color: rgb(0.05, 0.05, 0.05) });
      y -= size + 5;
    };

    const drawSolidLine = () => {
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 0.9,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 14;
    };

    // Header
    drawCenterText("DYummy Catering", fontBold, 19);
    drawCenterText("Jl Sindangsari 4 No 48", fontRegular, 12);
    drawCenterText("Kota Bandung Jawa Barat Indonesia", fontRegular, 12);
    const dateFormatted = order.delivery_date
      ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    drawCenterText(`${order.no_struk || `SI-${orderId}`} - ${dateFormatted}`, fontBold, 12.5);

    drawSolidLine();

    // Customer Info
    page.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 13, font: fontBold });
    y -= 17;

    const addrLines = wrapText(order.customer_address || "-", 34);
    addrLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12, font: fontRegular });
      y -= 15;
    });

    if (order.customer_patokan) {
      const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 34);
      patLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 11.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        y -= 14;
      });
    }

    const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
    const kecLines = wrapText(kecText, 34);
    kecLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12, font: fontRegular });
      y -= 15;
    });

    drawSolidLine();

    // Table Header Bar: "Nama Barang" vs "Total Harga"
    page.drawText("Nama Barang", { x: margin, y, size: 12.5, font: fontBold });
    const headerRightText = "Total Harga";
    const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 12.5);
    page.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 12.5, font: fontBold });
    y -= 17;

    drawSolidLine();

    // Items List
    let subtotalItems = 0;
    items.forEach((it: any) => {
      const subVal = Number(it.subtotal || 0);
      subtotalItems += subVal;

      const pLines = wrapText(it.product_name || "-", 34);
      pLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 12.5, font: fontBold });
        y -= 15;
      });

      const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
      const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

      page.drawText(qtyPriceText, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
      const subWidth = fontBold.widthOfTextAtSize(subtotalText, 12.5);
      page.drawText(subtotalText, { x: width - margin - subWidth, y, size: 12.5, font: fontBold });
      y -= 16;
    });

    // Shipping Fee
    const shippingFee = Number(order.shipping_fee || 0);
    if (shippingFee > 0) {
      page.drawText("Biaya Kirim", { x: margin, y, size: 12.5, font: fontBold });
      y -= 15;

      const shipQtyText = `1 x ${shippingFee.toLocaleString("id-ID")}`;
      const shipSubText = shippingFee.toLocaleString("id-ID");

      page.drawText(shipQtyText, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
      const shipWidth = fontBold.widthOfTextAtSize(shipSubText, 12.5);
      page.drawText(shipSubText, { x: width - margin - shipWidth, y, size: 12.5, font: fontBold });
      y -= 16;
    }

    drawSolidLine();

    // Summary: Sub Total & Diskon & Total
    const subTotalAll = subtotalItems + shippingFee;
    const discountVal = Number(order.discount || 0);

    // Sub Total Line
    page.drawText("Sub Total", { x: margin, y, size: 12.5, font: fontBold });
    const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
    const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 12.5);
    page.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 12.5, font: fontBold });
    y -= 16;

    // Diskon Line
    page.drawText("Diskon", { x: margin, y, size: 12.5, font: fontBold });
    const diskonTextStr = discountVal.toLocaleString("id-ID");
    const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 12.5);
    page.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 12.5, font: fontBold });
    y -= 16;

    drawSolidLine();

    // Grand Total Line
    page.drawText("Total", { x: margin, y, size: 14.5, font: fontBold });
    const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
    const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 14.5);
    page.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 14.5, font: fontBold });
    y -= 19;

    drawSolidLine();

    // Footer Right Aligned: CS SIAP SAJI, 31 Jul 2026, 20:20
    const footerText = `${order.pic_name || "CS SIAP SAJI"},  ${createdDate} ${createdTime}`.trim();
    const footerWidth = fontOblique.widthOfTextAtSize(footerText, 11);
    page.drawText(footerText, { x: width - margin - footerWidth, y, size: 11, font: fontOblique });

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
