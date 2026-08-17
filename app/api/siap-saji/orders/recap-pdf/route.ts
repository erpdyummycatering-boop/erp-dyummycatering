import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 40): string[] => {
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
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const client = await pool.connect();
  try {
    let whereClause = "WHERE o.lini = 'siap_saji' AND o.status_order <> 'Dibatalkan'";
    const queryVals: any[] = [];

    if (idsStr) {
      const ids = idsStr
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);
      if (ids.length > 0) {
        whereClause += " AND o.id = ANY($1::bigint[])";
        queryVals.push(ids);
      }
    } else if (dateFrom && dateTo) {
      whereClause += " AND o.delivery_date >= $1::date AND o.delivery_date <= $2::date";
      queryVals.push(dateFrom, dateTo);
    } else if (dateFrom) {
      whereClause += " AND o.delivery_date >= $1::date";
      queryVals.push(dateFrom);
    } else if (dateTo) {
      whereClause += " AND o.delivery_date <= $1::date";
      queryVals.push(dateTo);
    }

    // Query aggregated items for kitchen recap
    const itemsRes = await client.query(
      `SELECT 
        pr.name AS product_name,
        pr.is_half_portion,
        SUM(oi.quantity)::int AS total_qty,
        string_agg(DISTINCT oi.notes, ' | ') FILTER (WHERE oi.notes IS NOT NULL AND TRIM(oi.notes) <> '') AS notes_agg
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products pr ON oi.product_id = pr.id
      ${whereClause}
      GROUP BY pr.id, pr.name, pr.is_half_portion
      ORDER BY pr.is_half_portion ASC, total_qty DESC, pr.name ASC`,
      queryVals
    );

    const rowsData = itemsRes.rows;
    if (rowsData.length === 0) {
      return NextResponse.json({ error: "Tidak ada data order ditemukan untuk rekap dapur" }, { status: 404 });
    }

    // Standard A4 dimensions: 595.28 pt x 841.89 pt
    const width = 595.28;
    const pageHeight = 841.89;
    const margin = 28;
    const contentWidth = width - margin * 2; // 539.28 pt

    // Table Column Widths
    const col1Width = 240; // Nama Barang
    const col2Width = 70;  // Kuantitas
    const col3Width = contentWidth - col1Width - col2Width; // 229.28 pt (NOTE)

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Calculate row heights
    const getRowHeight = (row: any) => {
      const pLines = wrapText(row.product_name || "-", 35);
      const nLines = wrapText(row.notes_agg || "", 30);
      const maxLines = Math.max(1, pLines.length, nLines.length);
      return Math.max(22, maxLines * 14 + 6);
    };

    // Calculate pages required or multi-page support
    let currentPage = pdfDoc.addPage([width, pageHeight]);
    let y = pageHeight - margin;

    const drawHeader = (pg: any) => {
      pg.drawText("REKAP ORDER PRODUKSI DAPUR SIAP SAJI", {
        x: margin,
        y: y - 16,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 24;

      const dateStr = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
      pg.drawText(`Dicetak Pada: ${dateStr} | Total Item Berbeda: ${rowsData.length}`, {
        x: margin,
        y: y - 10,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      });
      y -= 20;

      // Table Header Row
      const tableHeaderHeight = 26;

      // Fill Light Blue Header Background (#D9EAD3 / #D0E0E3)
      pg.drawRectangle({
        x: margin,
        y: y - tableHeaderHeight,
        width: contentWidth,
        height: tableHeaderHeight,
        color: rgb(0.85, 0.92, 0.94),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.8,
      });

      // Header Labels
      pg.drawText("Nama Barang", { x: margin + 8, y: y - 18, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      
      const qtyLabel = "Kuantitas";
      const qtyWidth = fontBold.widthOfTextAtSize(qtyLabel, 11);
      pg.drawText(qtyLabel, { x: margin + col1Width + (col2Width - qtyWidth) / 2, y: y - 18, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      pg.drawText("NOTE", { x: margin + col1Width + col2Width + 8, y: y - 18, size: 11, font: fontBold, color: rgb(0.85, 0.15, 0.15) });

      // Vertical Header Column Lines
      pg.drawLine({ start: { x: margin + col1Width, y }, end: { x: margin + col1Width, y: y - tableHeaderHeight }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
      pg.drawLine({ start: { x: margin + col1Width + col2Width, y }, end: { x: margin + col1Width + col2Width, y: y - tableHeaderHeight }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });

      y -= tableHeaderHeight;
    };

    drawHeader(currentPage);

    // Draw Data Rows
    rowsData.forEach((row, idx) => {
      const rh = getRowHeight(row);

      // Check if page overflow
      if (y - rh < margin + 20) {
        currentPage = pdfDoc.addPage([width, pageHeight]);
        y = pageHeight - margin;
        drawHeader(currentPage);
      }

      const rowY = y;

      // Draw Cell Background (Alt zebra striping or white)
      currentPage.drawRectangle({
        x: margin,
        y: rowY - rh,
        width: contentWidth,
        height: rh,
        color: idx % 2 === 1 ? rgb(0.97, 0.98, 0.99) : rgb(1, 1, 1),
        borderColor: rgb(0.4, 0.4, 0.4),
        borderWidth: 0.6,
      });

      // Vertical Column Lines
      currentPage.drawLine({ start: { x: margin + col1Width, y: rowY }, end: { x: margin + col1Width, y: rowY - rh }, thickness: 0.6, color: rgb(0.4, 0.4, 0.4) });
      currentPage.drawLine({ start: { x: margin + col1Width + col2Width, y: rowY }, end: { x: margin + col1Width + col2Width, y: rowY - rh }, thickness: 0.6, color: rgb(0.4, 0.4, 0.4) });

      // Column 1: Nama Barang
      const pLines = wrapText(row.product_name || "-", 35);
      let textY = rowY - 14;
      pLines.forEach((line) => {
        currentPage.drawText(line, { x: margin + 8, y: textY, size: 10.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        textY -= 13;
      });

      // Column 2: Kuantitas
      const qtyStr = `${row.total_qty},`;
      const qtyWidth = fontBold.widthOfTextAtSize(qtyStr, 10.5);
      currentPage.drawText(qtyStr, {
        x: margin + col1Width + (col2Width - qtyWidth) / 2,
        y: rowY - 14,
        size: 10.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Column 3: NOTE (Bold Red Text #D93025)
      if (row.notes_agg) {
        const nLines = wrapText(row.notes_agg, 30);
        let noteY = rowY - 14;
        nLines.forEach((line) => {
          currentPage.drawText(line, {
            x: margin + col1Width + col2Width + 8,
            y: noteY,
            size: 10,
            font: fontBold,
            color: rgb(0.85, 0.15, 0.15), // Red text for notes matching attachment 2
          });
          noteY -= 13;
        });
      }

      y -= rh;
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="rekap-dapur-siap-saji.pdf"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal generate PDF rekap dapur:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
