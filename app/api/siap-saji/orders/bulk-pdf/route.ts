import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 36): string[] => {
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
    const margin = 4; // Narrow margin to span full paper width like reference receipt

    // Helper for measuring single order height accurately matching exact y deductions 1:1
    const measureOrderHeight = (order: any, isLast: boolean = false) => {
      const items = order.items || [];
      let h = 0;
      // Header: DYummy Catering (21), Jl Sindangsari (14), Kota Bandung (14), SI.Struk (16), line (12)
      h += 21 + 14 + 14 + 16 + 12;

      // Customer info: name (15), address lines (lines * 13.5), patokan lines (lines * 13), kec (13.5), line (12)
      h += 15;
      const addrLines = wrapText(order.customer_address || "-", 36);
      h += addrLines.length * 13.5;
      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 36);
        h += patLines.length * 13;
      }
      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 36);
      h += kecLines.length * 13.5 + 12;

      // Table header bar: "Nama Barang .... Total Harga" (15), line (12)
      h += 15 + 12;

      // Items
      items.forEach((it: any) => {
        const pLines = wrapText(it.product_name || "-", 36);
        h += pLines.length * 14;
        h += 15;
      });

      // Shipping fee if > 0
      if (Number(order.shipping_fee) > 0) {
        h += 14;
        h += 15;
      }

      h += 12; // line

      // Summary: Sub Total (15), Diskon (15), line (12), Total (17), line (12)
      h += 15 + 15 + 12 + 17 + 12;

      // Footer: CS SIAP SAJI, Date (14)
      h += 14;

      // Cutter divider line if not last order
      if (!isLast) {
        h += 34; // (10 + 12 + 12)
      }

      return h;
    };

    const drawSolidLineOnPage = (pageObj: any, yPos: number) => {
      pageObj.drawLine({
        start: { x: margin, y: yPos },
        end: { x: width - margin, y: yPos },
        thickness: 0.8,
        color: rgb(0.15, 0.15, 0.15),
      });
    };

    const drawCenterTextOnPage = (pageObj: any, text: string, font: any, size: number, yPos: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      pageObj.drawText(text, { x, y: yPos, size, font, color: rgb(0.07, 0.09, 0.15) });
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
      drawCenterTextOnPage(pageObj, "DYummy Catering", fontBold, 17, y);
      y -= 21;
      drawCenterTextOnPage(pageObj, "Jl Sindangsari 4 No 48", fontRegular, 11, y);
      y -= 14;
      drawCenterTextOnPage(pageObj, "Kota Bandung Jawa Barat Indonesia", fontRegular, 11, y);
      y -= 14;

      const dateFormatted = order.delivery_date
        ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";
      drawCenterTextOnPage(pageObj, `${order.no_struk || `SI-${order.id}`} - ${dateFormatted}`, fontBold, 11.5, y);
      y -= 16;

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Customer Info
      pageObj.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 12, font: fontBold });
      y -= 15;

      const addrLines = wrapText(order.customer_address || "-", 36);
      addrLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 11, font: fontRegular });
        y -= 13.5;
      });

      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 36);
        patLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 10.5, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
          y -= 13;
        });
      }

      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 36);
      kecLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 11, font: fontRegular });
        y -= 13.5;
      });

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Table Header Bar: "Nama Barang" vs "Total Harga"
      pageObj.drawText("Nama Barang", { x: margin, y, size: 11.5, font: fontBold });
      const headerRightText = "Total Harga";
      const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 11.5);
      pageObj.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 11.5, font: fontBold });
      y -= 15;

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Items List
      let subtotalItems = 0;
      items.forEach((it: any) => {
        const subVal = Number(it.subtotal || 0);
        subtotalItems += subVal;

        const pLines = wrapText(it.product_name || "-", 36);
        pLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 11.5, font: fontBold });
          y -= 14;
        });

        const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
        const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

        pageObj.drawText(qtyPriceText, { x: margin, y, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        const subWidth = fontBold.widthOfTextAtSize(subtotalText, 11.5);
        pageObj.drawText(subtotalText, { x: width - margin - subWidth, y, size: 11.5, font: fontBold });
        y -= 15;
      });

      // Shipping Fee
      const shippingFee = Number(order.shipping_fee || 0);
      if (shippingFee > 0) {
        pageObj.drawText("Biaya Kirim", { x: margin, y, size: 11.5, font: fontBold });
        y -= 14;

        const shipQtyText = `1 x ${shippingFee.toLocaleString("id-ID")}`;
        const shipSubText = shippingFee.toLocaleString("id-ID");

        pageObj.drawText(shipQtyText, { x: margin, y, size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
        const shipWidth = fontBold.widthOfTextAtSize(shipSubText, 11.5);
        pageObj.drawText(shipSubText, { x: width - margin - shipWidth, y, size: 11.5, font: fontBold });
        y -= 15;
      }

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Summary: Sub Total & Diskon & Total
      const subTotalAll = subtotalItems + shippingFee;
      const discountVal = Number(order.discount || 0);

      // Sub Total Line
      pageObj.drawText("Sub Total", { x: margin, y, size: 11.5, font: fontBold });
      const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
      const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 11.5);
      pageObj.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 11.5, font: fontBold });
      y -= 15;

      // Diskon Line
      pageObj.drawText("Diskon", { x: margin, y, size: 11.5, font: fontBold });
      const diskonTextStr = discountVal.toLocaleString("id-ID");
      const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 11.5);
      pageObj.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 11.5, font: fontBold });
      y -= 15;

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Grand Total Line
      pageObj.drawText("Total", { x: margin, y, size: 13, font: fontBold });
      const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
      const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 13);
      pageObj.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 13, font: fontBold });
      y -= 17;

      drawSolidLineOnPage(pageObj, y);
      y -= 12;

      // Footer Right Aligned: CS SIAP SAJI, 31 Jul 2026, 20:20
      const footerText = `${order.pic_name || "CS SIAP SAJI"},  ${createdDate} ${createdTime}`.trim();
      const footerWidth = fontOblique.widthOfTextAtSize(footerText, 10);
      pageObj.drawText(footerText, { x: width - margin - footerWidth, y, size: 10, font: fontOblique });
      y -= 14;

      // Cutter divider line between receipts (if not last)
      if (!isLastInRoll) {
        y -= 10;
        drawCenterTextOnPage(pageObj, "- - - - - POTONG DI SINI / CUT HERE - - - - -", fontRegular, 8, y);
        y -= 12;
        y -= 12;
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

      // Top margin 15pt + Bottom margin 15pt
      const totalRollHeight = Math.ceil(totalContentHeight + 30);

      const page = pdfDoc.addPage([width, totalRollHeight]);
      let y = totalRollHeight - 15;

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
