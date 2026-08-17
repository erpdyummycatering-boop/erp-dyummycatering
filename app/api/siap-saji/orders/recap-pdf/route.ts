import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const wrapText = (text: string, maxChars: number = 38): string[] => {
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

    // Query aggregated items & notes for kitchen recap
    const itemsRes = await client.query(
      `SELECT 
        pr.id AS product_id,
        pr.name AS product_name,
        pr.is_half_portion,
        SUM(oi.quantity)::int AS total_qty,
        json_agg(
          json_build_object(
            'quantity', oi.quantity,
            'notes', oi.notes
          )
        ) FILTER (WHERE oi.notes IS NOT NULL AND TRIM(oi.notes) <> '') AS notes_list
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products pr ON oi.product_id = pr.id
      ${whereClause}
      GROUP BY pr.id, pr.name, pr.is_half_portion
      ORDER BY pr.is_half_portion ASC, total_qty DESC, pr.name ASC`,
      queryVals
    );

    const rawRows = itemsRes.rows;
    if (rawRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada data order ditemukan untuk rekap dapur" }, { status: 404 });
    }

    // Process & format notes list per product
    const rowsData = rawRows.map((r: any) => {
      const notesLines: string[] = [];
      if (r.notes_list && Array.isArray(r.notes_list)) {
        r.notes_list.forEach((itemNote: any) => {
          if (!itemNote.notes) return;
          const str = String(itemNote.notes).trim();
          if (!str) return;

          // Split multi-line notes or comma-separated notes if any
          const splitNotes = str.split("\n").map((s) => s.trim()).filter(Boolean);
          splitNotes.forEach((sn) => {
            const formatted = sn.startsWith("*") ? sn : `*${sn}`;
            if (!notesLines.includes(formatted)) {
              notesLines.push(formatted);
            }
          });
        });
      }

      return {
        ...r,
        notesLines,
      };
    });

    // Separate Full Portion items vs Half Portion (1/2) items
    const fullPortionRows = rowsData.filter((r) => !r.is_half_portion && !String(r.product_name || "").includes("1/2"));
    const halfPortionRows = rowsData.filter((r) => r.is_half_portion || String(r.product_name || "").includes("1/2"));

    // Standard A4 dimensions: 595.28 pt x 841.89 pt
    const width = 595.28;
    const pageHeight = 841.89;
    const margin = 28;
    const contentWidth = width - margin * 2; // 539.28 pt

    // Table Column Widths
    const col1Width = 220; // Nama Barang
    const col2Width = 65;  // Kuantitas
    const col3Width = contentWidth - col1Width - col2Width; // 254.28 pt (NOTE)

    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Calculate row heights dynamically based on wrapped product lines & note lines
    const getRowHeight = (row: any) => {
      const pLines = wrapText(row.product_name || "-", 32);
      
      let noteLineCount = 0;
      row.notesLines.forEach((nl: string) => {
        const wrappedN = wrapText(nl, 38);
        noteLineCount += wrappedN.length;
      });

      const maxLines = Math.max(1, pLines.length, noteLineCount);
      return Math.max(22, maxLines * 13 + 6);
    };

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

      // Fill Light Blue Header Background (#D9EAD3)
      pg.drawRectangle({
        x: margin,
        y: y - tableHeaderHeight,
        width: contentWidth,
        height: tableHeaderHeight,
        color: rgb(0.85, 0.92, 0.83), // #D9EAD3 Light Green/Blue header matching attachment 2
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.8,
      });

      // Header Labels
      pg.drawText("Nama Barang", { x: margin + 8, y: y - 18, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      
      const qtyLabel = "Kuantitas";
      const qtyWidth = fontBold.widthOfTextAtSize(qtyLabel, 11);
      pg.drawText(qtyLabel, { x: margin + col1Width + (col2Width - qtyWidth) / 2, y: y - 18, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      pg.drawText("NOTE", { x: margin + col1Width + col2Width + (col3Width / 2) - 15, y: y - 18, size: 11, font: fontBold, color: rgb(0.85, 0.15, 0.15) });

      // Vertical Header Column Lines
      pg.drawLine({ start: { x: margin + col1Width, y }, end: { x: margin + col1Width, y: y - tableHeaderHeight }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
      pg.drawLine({ start: { x: margin + col1Width + col2Width, y }, end: { x: margin + col1Width + col2Width, y: y - tableHeaderHeight }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });

      y -= tableHeaderHeight;
    };

    drawHeader(currentPage);

    const renderRowItem = (row: any, idx: number) => {
      const rh = getRowHeight(row);

      // Check if page overflow
      if (y - rh < margin + 20) {
        currentPage = pdfDoc.addPage([width, pageHeight]);
        y = pageHeight - margin;
        drawHeader(currentPage);
      }

      const rowY = y;

      // Draw Cell Background (White background with crisp borders)
      currentPage.drawRectangle({
        x: margin,
        y: rowY - rh,
        width: contentWidth,
        height: rh,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.7,
      });

      // Vertical Column Lines
      currentPage.drawLine({ start: { x: margin + col1Width, y: rowY }, end: { x: margin + col1Width, y: rowY - rh }, thickness: 0.7, color: rgb(0.3, 0.3, 0.3) });
      currentPage.drawLine({ start: { x: margin + col1Width + col2Width, y: rowY }, end: { x: margin + col1Width + col2Width, y: rowY - rh }, thickness: 0.7, color: rgb(0.3, 0.3, 0.3) });

      // Column 1: Nama Barang
      const pLines = wrapText(row.product_name || "-", 32);
      let textY = rowY - 14;
      pLines.forEach((line) => {
        currentPage.drawText(line, { x: margin + 8, y: textY, size: 10.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        textY -= 13;
      });

      // Column 2: Kuantitas (Format e.g. "10,")
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
      if (row.notesLines && row.notesLines.length > 0) {
        let noteY = rowY - 14;
        row.notesLines.forEach((nl: string) => {
          const wrappedN = wrapText(nl, 38);
          wrappedN.forEach((line) => {
            currentPage.drawText(line, {
              x: margin + col1Width + col2Width + 8,
              y: noteY,
              size: 10,
              font: fontBold,
              color: rgb(0.85, 0.15, 0.15), // Red text for notes matching attachment 2
            });
            noteY -= 13;
          });
        });
      }

      y -= rh;
    };

    // 1. Render Full Portion Rows
    fullPortionRows.forEach((row, idx) => {
      renderRowItem(row, idx);
    });

    // 2. Render 1 Blank Row Separator if there are Half Portion items
    if (halfPortionRows.length > 0) {
      const blankRowHeight = 22;

      if (y - blankRowHeight < margin + 20) {
        currentPage = pdfDoc.addPage([width, pageHeight]);
        y = pageHeight - margin;
        drawHeader(currentPage);
      }

      const rowY = y;
      currentPage.drawRectangle({
        x: margin,
        y: rowY - blankRowHeight,
        width: contentWidth,
        height: blankRowHeight,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.7,
      });

      currentPage.drawLine({ start: { x: margin + col1Width, y: rowY }, end: { x: margin + col1Width, y: rowY - blankRowHeight }, thickness: 0.7, color: rgb(0.3, 0.3, 0.3) });
      currentPage.drawLine({ start: { x: margin + col1Width + col2Width, y: rowY }, end: { x: margin + col1Width + col2Width, y: rowY - blankRowHeight }, thickness: 0.7, color: rgb(0.3, 0.3, 0.3) });

      y -= blankRowHeight;

      // 3. Render Half Portion (1/2) Rows
      halfPortionRows.forEach((row, idx) => {
        renderRowItem(row, idx);
      });
    }

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
