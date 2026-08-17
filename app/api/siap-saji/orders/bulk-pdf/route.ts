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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsStr = searchParams.get("ids");
  const mode = searchParams.get("mode") || "exact"; // exact (dynamic page per order) | roll (continuous thermal roll)

  if (!idsStr) {
    return NextResponse.json({ error: "Parameter ids wajib diisi" }, { status: 400 });
  }

  const ids = idsStr
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !isNaN(id) && id > 0);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Tidak ada ID order yang valid" }, { status: 400 });
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
      WHERE o.id = ANY($1::bigint[]) AND o.lini = 'siap_saji'
      ORDER BY array_position($1::bigint[], o.id)`,
      [ids]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: "Tidak ada order ditemukan" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const width = 226.77; // 80mm POS Thermal receipt width: 80mm = 226.77 pt
    const margin = 1.5; // Ultra-narrow side margin (1.5pt) to span full paper width like reference receipt

    // Helper for measuring single order height accurately matching exact y deductions 1:1
    const measureOrderHeight = (order: any, isLast: boolean = false) => {
      const items = order.items || [];
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

      // Cutter divider line if not last order
      if (!isLast) {
        h += 39; // (12 + 13 + 14)
      }

      return h;
    };

    const drawSolidLineOnPage = (pageObj: any, yPos: number) => {
      pageObj.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 0.9,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const drawCenterTextOnPage = (pageObj: any, text: string, font: any, size: number, yPos: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      pageObj.drawText(text, { x, y: yPos, size, font, color: rgb(0.05, 0.05, 0.05) });
    };

    const renderSingleOrder = (pageObj: any, order: any, startY: number, isLastInRoll: boolean = true) => {
      const items = order.items || [];
      const createdDate = order.created_at
        ? new Date(order.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
        : new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
      const createdTime = order.created_at
        ? new Date(order.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "";

      let y = startY;

      // Header
      drawCenterTextOnPage(pageObj, "DYummy Catering", fontBold, 19, y);
      y -= 24;
      drawCenterTextOnPage(pageObj, "Jl Sindangsari 4 No 48", fontRegular, 12, y);
      y -= 15;
      drawCenterTextOnPage(pageObj, "Kota Bandung Jawa Barat Indonesia", fontRegular, 12, y);
      y -= 15;

      const dateFormatted = order.delivery_date
        ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";
      drawCenterTextOnPage(pageObj, `${order.no_struk || `SI-${order.id}`} - ${dateFormatted}`, fontBold, 12.5, y);
      y -= 17;

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Customer Info
      pageObj.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 13, font: fontBold });
      y -= 17;

      const addrLines = wrapText(order.customer_address || "-", 34);
      addrLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 12, font: fontRegular });
        y -= 15;
      });

      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 34);
        patLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 11.5, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
          y -= 14;
        });
      }

      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 34);
      kecLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 12, font: fontRegular });
        y -= 15;
      });

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Table Header Bar: "Nama Barang" vs "Total Harga"
      pageObj.drawText("Nama Barang", { x: margin, y, size: 12.5, font: fontBold });
      const headerRightText = "Total Harga";
      const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 12.5);
      pageObj.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 12.5, font: fontBold });
      y -= 17;

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Items List
      let subtotalItems = 0;
      items.forEach((it: any) => {
        const subVal = Number(it.subtotal || 0);
        subtotalItems += subVal;

        const pLines = wrapText(it.product_name || "-", 34);
        pLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 12.5, font: fontBold });
          y -= 15;
        });

        const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
        const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

        pageObj.drawText(qtyPriceText, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
        const subWidth = fontBold.widthOfTextAtSize(subtotalText, 12.5);
        pageObj.drawText(subtotalText, { x: width - margin - subWidth, y, size: 12.5, font: fontBold });
        y -= 16;
      });

      // Shipping Fee
      const shippingFee = Number(order.shipping_fee || 0);
      if (shippingFee > 0) {
        pageObj.drawText("Biaya Kirim", { x: margin, y, size: 12.5, font: fontBold });
        y -= 15;

        const shipQtyText = `1 x ${shippingFee.toLocaleString("id-ID")}`;
        const shipSubText = shippingFee.toLocaleString("id-ID");

        pageObj.drawText(shipQtyText, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
        const shipWidth = fontBold.widthOfTextAtSize(shipSubText, 12.5);
        pageObj.drawText(shipSubText, { x: width - margin - shipWidth, y, size: 12.5, font: fontBold });
        y -= 16;
      }

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Summary: Sub Total & Diskon & Total
      const subTotalAll = subtotalItems + shippingFee;
      const discountVal = Number(order.discount || 0);

      // Sub Total Line
      pageObj.drawText("Sub Total", { x: margin, y, size: 12.5, font: fontBold });
      const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
      const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 12.5);
      pageObj.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 12.5, font: fontBold });
      y -= 16;

      // Diskon Line
      pageObj.drawText("Diskon", { x: margin, y, size: 12.5, font: fontBold });
      const diskonTextStr = discountVal.toLocaleString("id-ID");
      const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 12.5);
      pageObj.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 12.5, font: fontBold });
      y -= 16;

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Grand Total Line
      pageObj.drawText("Total", { x: margin, y, size: 14.5, font: fontBold });
      const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
      const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 14.5);
      pageObj.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 14.5, font: fontBold });
      y -= 19;

      drawSolidLineOnPage(pageObj, y);
      y -= 14;

      // Footer Right Aligned: CS SIAP SAJI, 31 Jul 2026, 20:20
      const footerText = `${order.pic_name || "CS SIAP SAJI"},  ${createdDate} ${createdTime}`.trim();
      const footerWidth = fontOblique.widthOfTextAtSize(footerText, 11);
      pageObj.drawText(footerText, { x: width - margin - footerWidth, y, size: 11, font: fontOblique });
      y -= 15;

      // Cutter divider line between receipts (if not last)
      if (!isLastInRoll) {
        y -= 12;
        drawCenterTextOnPage(pageObj, "- - - - - POTONG DI SINI / CUT HERE - - - - -", fontRegular, 8.5, y);
        y -= 13;
        y -= 14;
      }

      return y;
    };

    if (mode === "roll") {
      // ── CONTINUOUS THERMAL ROLL MODE (Exact 1:1 Height, Zero Phantom Padding) ──
      let totalContentHeight = 0;
      orderRes.rows.forEach((order, idx) => {
        const isLast = idx === orderRes.rows.length - 1;
        totalContentHeight += measureOrderHeight(order, isLast);
      });

      // Top margin 12pt + Bottom margin 12pt
      const totalRollHeight = Math.ceil(totalContentHeight + 24);

      const page = pdfDoc.addPage([width, totalRollHeight]);
      let y = totalRollHeight - 12;

      orderRes.rows.forEach((order, idx) => {
        const isLast = idx === orderRes.rows.length - 1;
        y = renderSingleOrder(page, order, y, isLast);
      });
    } else {
      // ── DYNAMIC EXACT HEIGHT PER RECEIPT PAGE MODE (Zero Wasted Blank Paper) ──
      for (const order of orderRes.rows) {
        const height = Math.ceil(measureOrderHeight(order, true) + 24);
        const page = pdfDoc.addPage([width, height]);
        renderSingleOrder(page, order, height - 12, true);
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="bulk-nota-${orderRes.rows.length}-pesanan.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal generate bulk PDF nota:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
