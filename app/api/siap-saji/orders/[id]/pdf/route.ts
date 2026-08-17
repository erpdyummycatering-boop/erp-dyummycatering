import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 29): string[] => {
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

    // 72mm Printable Thermal Head Width (204 pt)
    const width = 204;
    const margin = 1;

    // Helper for measuring single order height accurately with 1.3-1.5x line spacing
    const measureOrderHeight = () => {
      let h = 0;
      // Header: D'Yummy Siap Saji (26), Jl Sindangsari (16), Kota Bandung (16), SI.Struk (18), line (15)
      h += 26 + 16 + 16 + 18 + 15;

      // Customer info: Name (18), Address lines (lines * 16), Patokan lines (lines * 15), Kec (16), line (15)
      h += 18;
      const addrLines = wrapText(order.customer_address || "-", 29);
      h += addrLines.length * 16;
      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 29);
        h += patLines.length * 15;
      }
      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 29);
      h += kecLines.length * 16 + 15;

      // Table header bar: "Nama Barang .... Total Harga" (18), line (15)
      h += 18 + 15;

      // Items
      items.forEach((it: any) => {
        const pLines = wrapText(it.product_name || "-", 29);
        h += pLines.length * 16;
        h += 17;
      });

      // Shipping fee if > 0
      if (Number(order.shipping_fee) > 0) {
        h += 16;
        h += 17;
      }

      h += 15; // line

      // Summary: Sub Total (17), Diskon (17), line (15), Total (20), line (15)
      h += 17 + 17 + 15 + 20 + 15;

      return h;
    };

    // 50pt total vertical margin budget (top padding 18pt + cap height offset 18pt + bottom padding 14pt)
    const height = Math.ceil(measureOrderHeight() + 50);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Initial baseline offset at (height - 36) so top cap height of 22pt title font is at (height - 18)
    let y = height - 36;

    const drawCenterText = (text: string, font: any, size: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color: rgb(0.02, 0.02, 0.02) });
      y -= size + 4;
    };

    const drawSolidLine = () => {
      page.drawLine({
        start: { x: margin, y },
        end: { x: width - margin, y },
        thickness: 1.0,
        color: rgb(0.05, 0.05, 0.05),
      });
      y -= 15;
    };

    // Header (Title font size 22pt starts at y = height - 36, cap height top = height - 18pt)
    drawCenterText("D'Yummy Siap Saji", fontBold, 22);
    drawCenterText("Jl Sindangsari 4 No 48", fontRegular, 13);
    drawCenterText("Kota Bandung Jawa Barat Indonesia", fontRegular, 13);
    const dateFormatted = order.delivery_date
      ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    drawCenterText(`${order.no_struk || `SI-${orderId}`} - ${dateFormatted}`, fontBold, 13.5);

    drawSolidLine();

    // Customer Info
    page.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 14, font: fontBold });
    y -= 18;

    const addrLines = wrapText(order.customer_address || "-", 29);
    addrLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
      y -= 16;
    });

    if (order.customer_patokan) {
      const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 29);
      patLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        y -= 15;
      });
    }

    const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
    const kecLines = wrapText(kecText, 29);
    kecLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
      y -= 16;
    });

    drawSolidLine();

    // Table Header Bar: "Nama Barang" vs "Total Harga"
    page.drawText("Nama Barang", { x: margin, y, size: 13.5, font: fontBold });
    const headerRightText = "Total Harga";
    const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 13.5);
    page.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 13.5, font: fontBold });
    y -= 18;

    drawSolidLine();

    // Items List
    let subtotalItems = 0;
    items.forEach((it: any) => {
      const subVal = Number(it.subtotal || 0);
      subtotalItems += subVal;

      const pLines = wrapText(it.product_name || "-", 29);
      pLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 13.5, font: fontBold });
        y -= 16;
      });

      const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
      const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

      page.drawText(qtyPriceText, { x: margin, y, size: 12.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      const subWidth = fontBold.widthOfTextAtSize(subtotalText, 13.5);
      page.drawText(subtotalText, { x: width - margin - subWidth, y, size: 13.5, font: fontBold });
      y -= 17;
    });

    // Shipping Fee
    const shippingFee = Number(order.shipping_fee || 0);
    if (shippingFee > 0) {
      page.drawText("Biaya Kirim", { x: margin, y, size: 13.5, font: fontBold });
      y -= 16;

      const shipQtyText = `1 x ${shippingFee.toLocaleString("id-ID")}`;
      const shipSubText = shippingFee.toLocaleString("id-ID");

      page.drawText(shipQtyText, { x: margin, y, size: 12.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      const shipWidth = fontBold.widthOfTextAtSize(shipSubText, 13.5);
      page.drawText(shipSubText, { x: width - margin - shipWidth, y, size: 13.5, font: fontBold });
      y -= 17;
    }

    drawSolidLine();

    // Summary: Sub Total & Diskon & Total
    const subTotalAll = subtotalItems + shippingFee;
    const discountVal = Number(order.discount || 0);

    // Sub Total Line
    page.drawText("Sub Total", { x: margin, y, size: 13.5, font: fontBold });
    const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
    const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 13.5);
    page.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 13.5, font: fontBold });
    y -= 17;

    // Diskon Line
    page.drawText("Diskon", { x: margin, y, size: 13.5, font: fontBold });
    const diskonTextStr = discountVal.toLocaleString("id-ID");
    const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 13.5);
    page.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 13.5, font: fontBold });
    y -= 17;

    drawSolidLine();

    // Grand Total Line
    page.drawText("Total", { x: margin, y, size: 16, font: fontBold });
    const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
    const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 16);
    page.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 16, font: fontBold });
    y -= 20;

    drawSolidLine();

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
