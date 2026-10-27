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

const formatProductName = (name: string, isHalf?: boolean): string => {
  let pName = String(name || "").trim();
  if (isHalf && !pName.includes("1/2") && !pName.includes("½")) {
    return `${pName} 1/2`;
  }
  return pName;
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

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") || "exact"; // exact (dynamic page per order) | roll (continuous thermal roll)

  const client = await pool.connect();
  try {
    const orderRes = await client.query(
      `SELECT 
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COALESCE(NULLIF(o.venue, ''), c.address) AS customer_address,
        COALESCE(NULLIF(o.patokan, ''), c.patokan) AS customer_patokan,
        COALESCE(ao.kecamatan, ac.kecamatan, '-') AS area_kecamatan,
        COALESCE(ao.kota, ac.kota, '-') AS area_kota,
        u.name AS pic_name,
        (
          SELECT json_agg(
            json_build_object(
              'id', oi.id,
              'product_name', pr.name,
              'sku', pr.sku,
              'is_half_portion', pr.is_half_portion,
              'price', oi.price,
              'quantity', oi.quantity,
              'subtotal', oi.subtotal,
              'notes', oi.notes
            )
          )
          FROM order_items oi
          LEFT JOIN products pr ON oi.product_id = pr.id
          WHERE oi.order_id = o.id
        ) AS items
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN areas ao ON o.area_id = ao.id
      LEFT JOIN areas ac ON c.area_id = ac.id
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
    const margin = 2;

    // Helper for measuring single order height accurately
    const measureOrderHeight = () => {
      let h = 0;
      // Header: DYummy Siap Saji (26), Jl Sindangsari (16), Kota Bandung (lines * 16), SI.Struk (18), solid line (36)
      const cityLines = wrapText("Kota Bandung Jawa Barat Indonesia", 30);
      h += 26 + 16 + cityLines.length * 16 + 18 + 36;

      // Customer info: Name (18), Phone (16), Address lines (lines * 16), Patokan lines (lines * 16), Kec (16), solid line (36)
      h += 18;
      if (order.customer_phone) h += 16;
      const addrLines = wrapText(order.customer_address || "-", 29);
      h += addrLines.length * 16;
      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 29);
        h += patLines.length * 16;
      }
      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 29);
      h += kecLines.length * 16 + 36;

      // Table header bar: "Nama Barang .... Total Harga" (18), solid line (36)
      h += 18 + 36;

      // Items
      items.forEach((it: any) => {
        const displayName = formatProductName(it.product_name, it.is_half_portion);
        const pLines = wrapText(displayName || "-", 29);
        h += pLines.length * 16;
        h += 18;
        if (it.notes || it.note) {
          const noteText = String(it.notes || it.note).trim();
          if (noteText) {
            const nLines = wrapText(`* ${noteText}`, 29);
            h += nLines.length * 15;
          }
        }
      });

      // Shipping fee if > 0
      if (Number(order.shipping_fee) > 0) {
        h += 16;
        h += 18;
      }

      h += 36; // solid line sebelum ringkasan

      // Summary: Sub Total (18), Diskon (18), solid line (36), Total (24), solid line (36)
      h += 18 + 18 + 36 + 24 + 36;

      // Garis potong putus-putus:
      // Spasi atas 36pt + garis dashed + spasi bawah 48pt = 84pt
      h += 84;

      return h;
    };

    // 120pt total vertical margin budget (ensures header top, bottom total, and dashed cut line never cut off)
    const height = Math.ceil(measureOrderHeight() + 120);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Initial baseline offset at (height - 45) so title header is never cut off at the top
    let y = height - 45;

    const drawCenterText = (text: string, font: any, size: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      page.drawText(text, { x, y, size, font, color: rgb(0.02, 0.02, 0.02) });
    };

    const drawSolidLine = () => {
      const lineY = y - 12;
      page.drawLine({
        start: { x: margin, y: lineY },
        end: { x: width - margin, y: lineY },
        thickness: 1.0,
        color: rgb(0.1, 0.1, 0.1),
      });
      return lineY - 24;
    };

    // Header
    drawCenterText("D'Yummy Siap Saji", fontBold, 20);
    y -= 26;
    drawCenterText("Jl Sindangsari 4 No 48", fontRegular, 12);
    y -= 16;
    const cityLines = wrapText("Kota Bandung Jawa Barat Indonesia", 30);
    cityLines.forEach((cLine) => {
      drawCenterText(cLine, fontRegular, 12);
      y -= 16;
    });
    const dateFormatted = order.delivery_date
      ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "";
    drawCenterText(`${order.no_struk || `SI-${orderId}`} - ${dateFormatted}`, fontBold, 12.5);
    y -= 18;

    y = drawSolidLine();

    // Customer Info
    page.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 14, font: fontBold });
    y -= 18;

    if (order.customer_phone) {
      page.drawText(`Telp/WA: ${order.customer_phone}`, { x: margin, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 16;
    }

    const addrLines = wrapText(order.customer_address || "-", 29);
    addrLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
      y -= 16;
    });

    if (order.customer_patokan) {
      const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 29);
      patLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        y -= 16;
      });
    }

    const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
    const kecLines = wrapText(kecText, 29);
    kecLines.forEach((line) => {
      page.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
      y -= 16;
    });

    y = drawSolidLine();

    // Table Header Bar: "Nama Barang" vs "Total Harga"
    page.drawText("Nama Barang", { x: margin, y, size: 13.5, font: fontBold });
    const headerRightText = "Total Harga";
    const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 13.5);
    page.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 13.5, font: fontBold });
    y -= 18;

    y = drawSolidLine();

    // Items List
    let subtotalItems = 0;
    items.forEach((it: any) => {
      const subVal = Number(it.subtotal || 0);
      subtotalItems += subVal;

      const displayName = formatProductName(it.product_name, it.is_half_portion);
      const pLines = wrapText(displayName || "-", 29);
      pLines.forEach((line) => {
        page.drawText(line, { x: margin, y, size: 13.5, font: fontBold });
        y -= 16;
      });

      const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
      const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

      page.drawText(qtyPriceText, { x: margin, y, size: 12.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      const subWidth = fontBold.widthOfTextAtSize(subtotalText, 13.5);
      page.drawText(subtotalText, { x: width - margin - subWidth, y, size: 13.5, font: fontBold });
      y -= 18;

      if (it.notes || it.note) {
        const noteText = String(it.notes || it.note).trim();
        if (noteText) {
          const nLines = wrapText(`* ${noteText}`, 29);
          nLines.forEach((line) => {
            page.drawText(line, { x: margin + 8, y, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
            y -= 15;
          });
        }
      }
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
      y -= 18;
    }

    y = drawSolidLine();

    // Summary: Sub Total & Diskon & Total
    const subTotalAll = subtotalItems + shippingFee;
    const discountVal = Number(order.discount || 0);

    // Sub Total Line
    page.drawText("Sub Total", { x: margin, y, size: 13.5, font: fontBold });
    const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
    const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 13.5);
    page.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 13.5, font: fontBold });
    y -= 18;

    // Diskon Line
    page.drawText("Diskon", { x: margin, y, size: 13.5, font: fontBold });
    const diskonTextStr = discountVal.toLocaleString("id-ID");
    const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 13.5);
    page.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 13.5, font: fontBold });
    y -= 18;

    y = drawSolidLine();

    // Grand Total Line
    page.drawText("Total", { x: margin, y, size: 16, font: fontBold });
    const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
    const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 16);
    page.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 16, font: fontBold });
    y -= 24;

    y = drawSolidLine();

    // Garis potong putus-putus
    y -= 36;
    page.drawLine({
      start: { x: 0, y },
      end: { x: width, y },
      thickness: 1.2,
      dashArray: [6, 4],
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= 48;

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
