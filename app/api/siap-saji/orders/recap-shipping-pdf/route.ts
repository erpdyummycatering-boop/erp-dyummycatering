import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 32): string[] => {
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
  const dateFrom = searchParams.get("date_from") || new Date().toISOString().split("T")[0];
  const dateTo = searchParams.get("date_to") || dateFrom;

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT 
        o.id AS order_id,
        c.name AS nama_customer,
        c.phone AS no_hp,
        o.no_struk,
        COALESCE(a.kecamatan, '-') AS kecamatan,
        COALESCE(o.shipping_address, c.address, '-') AS alamat,
        c.patokan,
        COALESCE(dr.name, 'Unassigned') AS driver_name,
        COALESCE(
          json_agg(
            json_build_object(
              'name', p.name,
              'quantity', oi.quantity,
              'is_half_portion', p.is_half_portion
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) AS items
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      LEFT JOIN areas a ON a.id = c.area_id
      LEFT JOIN channels ch ON ch.id = o.channel_id
      LEFT JOIN drivers dr ON dr.id = o.driver_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'
        AND (o.delivery_date::date >= $1::date AND o.delivery_date::date <= $2::date)
      GROUP BY o.id, c.id, c.name, c.phone, o.no_struk, a.kecamatan, o.shipping_address, c.address, c.patokan, dr.name
      ORDER BY COALESCE(dr.name, 'Z'), a.kecamatan, c.name`,
      [dateFrom, dateTo]
    );

    const ordersData = res.rows;
    if (ordersData.length === 0) {
      return NextResponse.json({ error: "Tidak ada data pengiriman untuk tanggal ini" }, { status: 404 });
    }

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page dimensions (A4 Landscape: 841.89 x 595.28 pt)
    const pageWidth = 841.89;
    const pageHeight = 595.28;
    const margin = 28;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Header Title
    page.drawText("REKAP PENGIRIMAN HARIAN - DYUMMY CATERING SIAP SAJI", {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.12, 0.02, 0.25),
    });

    const dateStr = dateFrom === dateTo ? dateFrom : `${dateFrom} s/d ${dateTo}`;
    page.drawText(`Tanggal Kirim: ${dateStr} | Total Order: ${ordersData.length}`, {
      x: pageWidth - margin - 220,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });

    y -= 22;

    // Table Column Widths
    // Cols: No (35), Pelanggan (120), Nama Barang (140), Qty (40), Alamat (255), Kecamatan (95), Driver (100) = 785
    const colX = [
      margin,                       // No: 28
      margin + 35,                  // Pelanggan: 63
      margin + 35 + 125,            // Nama Barang: 188
      margin + 35 + 125 + 145,      // Qty: 333
      margin + 35 + 125 + 145 + 40, // Alamat: 373
      margin + 35 + 125 + 145 + 40 + 245, // Kecamatan: 618
      margin + 35 + 125 + 145 + 40 + 245 + 95, // Driver: 713
      pageWidth - margin,           // End: 813.89
    ];

    const drawTableHeader = (p: any, currentY: number) => {
      p.drawRectangle({
        x: margin,
        y: currentY - 18,
        width: pageWidth - margin * 2,
        height: 20,
        color: rgb(0.9, 0.93, 0.98),
        borderColor: rgb(0.7, 0.75, 0.85),
        borderWidth: 1,
      });

      const headers = ["NO", "PELANGGAN", "NAMA BARANG", "QTY", "ALAMAT & PATOKAN", "KECAMATAN", "DRIVER"];
      const alignCenter = [true, false, false, true, false, true, true];

      headers.forEach((h, idx) => {
        const cx = colX[idx];
        const cw = colX[idx + 1] - cx;
        const txtWidth = fontBold.widthOfTextAtSize(h, 9);
        const tx = alignCenter[idx] ? cx + (cw - txtWidth) / 2 : cx + 6;
        p.drawText(h, {
          x: tx,
          y: currentY - 13,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.2),
        });
      });
      return currentY - 20;
    };

    y = drawTableHeader(page, y);

    let rowNum = 1;

    for (const ord of ordersData) {
      // Build Items list & line items
      const itemsList = Array.isArray(ord.items) ? ord.items : [];
      // Include Biaya Kirim as extra line if shipping fee > 0
      const displayItems = [
        ...itemsList.map((it: any) => ({
          name: it.name || "Produk",
          qty: String(it.quantity || 1),
        })),
        { name: "Biaya Kirim", qty: "1" },
      ];

      // Format Address Lines
      const fullAddressStr = `${ord.alamat || ""}${ord.patokan ? ` (Patokan: ${ord.patokan})` : ""}`;
      const addressLines = wrapText(fullAddressStr, 42);

      const maxLinesInRow = Math.max(displayItems.length, addressLines.length, 1);
      const rowHeight = Math.max(maxLinesInRow * 14 + 10, 36);

      // Page break check
      if (y - rowHeight < margin + 20) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        y = drawTableHeader(page, y);
      }

      const rowTopY = y;
      const rowBottomY = y - rowHeight;

      // Draw Row Border Box
      page.drawRectangle({
        x: margin,
        y: rowBottomY,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rowNum % 2 === 0 ? rgb(0.98, 0.98, 1) : rgb(1, 1, 1),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 0.5,
      });

      // Draw Vertical Column Lines
      for (let cIdx = 1; cIdx < colX.length - 1; cIdx++) {
        page.drawLine({
          start: { x: colX[cIdx], y: rowTopY },
          end: { x: colX[cIdx], y: rowBottomY },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });
      }

      // Column 1: No
      page.drawText(String(rowNum), {
        x: colX[0] + 12,
        y: rowTopY - 16,
        size: 9,
        font: fontBold,
      });

      // Column 2: Pelanggan & Phone
      const custNameLines = wrapText(ord.nama_customer || "Umum", 18);
      let custY = rowTopY - 14;
      custNameLines.forEach((cn) => {
        page.drawText(cn, { x: colX[1] + 6, y: custY, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        custY -= 12;
      });
      if (ord.no_hp) {
        page.drawText(ord.no_hp, { x: colX[1] + 6, y: custY, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      }

      // Column 3 & 4: Nama Barang & Qty
      let itemY = rowTopY - 14;
      displayItems.forEach((it) => {
        const itemLines = wrapText(it.name, 22);
        itemLines.forEach((il) => {
          page.drawText(il, { x: colX[2] + 6, y: itemY, size: 8.5, font: fontRegular });
          page.drawText(`${it.qty},`, { x: colX[3] + 14, y: itemY, size: 8.5, font: fontBold });
          itemY -= 12;
        });
      });

      // Column 5: Alamat & Patokan
      let addrY = rowTopY - 14;
      addressLines.forEach((al) => {
        page.drawText(al, { x: colX[4] + 6, y: addrY, size: 8, font: fontRegular, color: rgb(0.15, 0.15, 0.15) });
        addrY -= 11;
      });

      // Column 6: Kecamatan (Uppercase & Bold)
      const kecStr = String(ord.kecamatan || "-").toUpperCase();
      const kecWidth = fontBold.widthOfTextAtSize(kecStr, 9);
      page.drawText(kecStr, {
        x: colX[5] + (colX[6] - colX[5] - kecWidth) / 2,
        y: rowTopY - 16,
        size: 9,
        font: fontBold,
        color: rgb(0, 0, 0),
      });

      // Column 7: Driver (Bold)
      let drNameStr = String(ord.driver_name || "Unassigned").toUpperCase();
      if (!drNameStr.startsWith("P ") && !drNameStr.startsWith("DRIVER ")) {
        drNameStr = `P ${drNameStr}`;
      }
      const drWidth = fontBold.widthOfTextAtSize(drNameStr, 9);
      page.drawText(drNameStr, {
        x: colX[6] + (colX[7] - colX[6] - drWidth) / 2,
        y: rowTopY - 16,
        size: 9,
        font: fontBold,
        color: rgb(0.2, 0, 0.5),
      });

      y -= rowHeight;
      rowNum++;
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Rekap_Pengiriman_${dateFrom}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Gagal generate PDF Rekap Pengiriman:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
