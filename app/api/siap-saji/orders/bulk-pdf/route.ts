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
        COALESCE(NULLIF(o.venue, ''), c.address) AS customer_address,
        COALESCE(NULLIF(o.patokan, ''), c.patokan) AS customer_patokan,
        COALESCE(ao.kecamatan, ac.kecamatan, '-') AS area_kecamatan,
        COALESCE(ao.kota, ac.kota, 'Kota Bandung') AS area_kota,
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

    // 72mm Printable Thermal Head Width (204 pt)
    const width = 204;
    const margin = 2;

    // Helper for measuring single order height accurately matching exact y deductions 1:1
    const measureOrderHeight = (order: any, isLast: boolean = false) => {
      const items = order.items || [];
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

      // Garis potong putus-putus untuk pemisah antar nota roll:
      // Spasi atas 36pt + garis dashed + spasi bawah 48pt = 84pt
      if (!isLast) {
        h += 72; // 24 + 12(dashed) simetris -> lihat renderSingleOrder
      }

      return h;
    };

    const drawSolidLineOnPage = (pageObj: any, yPos: number) => {
      const lineY = yPos - 12;
      pageObj.drawLine({
        start: { x: margin, y: lineY },
        end: { x: width - margin, y: lineY },
        thickness: 1.0,
        color: rgb(0.1, 0.1, 0.1),
      });
      return lineY - 24;
    };

    const drawCenterTextOnPage = (pageObj: any, text: string, font: any, size: number, yPos: number) => {
      const textWidth = font.widthOfTextAtSize(text, size);
      const x = (width - textWidth) / 2;
      pageObj.drawText(text, { x, y: yPos, size, font, color: rgb(0.02, 0.02, 0.02) });
    };

    const renderSingleOrder = (pageObj: any, order: any, startY: number, isLastInRoll: boolean = true) => {
      const items = order.items || [];
      let y = startY;

      // Header: D'Yummy Siap Saji
      drawCenterTextOnPage(pageObj, "D'Yummy Siap Saji", fontBold, 20, y);
      y -= 26;
      drawCenterTextOnPage(pageObj, "Jl Sindangsari 4 No 48", fontRegular, 12, y);
      y -= 16;

      // Wrap City / Province lines
      const cityLines = wrapText("Kota Bandung Jawa Barat Indonesia", 30);
      cityLines.forEach((cLine) => {
        drawCenterTextOnPage(pageObj, cLine, fontRegular, 12, y);
        y -= 16;
      });

      const dateFormatted = order.delivery_date
        ? new Date(order.delivery_date).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "";
      drawCenterTextOnPage(pageObj, `${order.no_struk || `SI-${order.id}`} - ${dateFormatted}`, fontBold, 12.5, y);
      y -= 18;

      y = drawSolidLineOnPage(pageObj, y);

      // Customer Info
      pageObj.drawText(order.customer_name || "Pelanggan", { x: margin, y, size: 14, font: fontBold });
      y -= 18;

      if (order.customer_phone) {
        pageObj.drawText(`Telp/WA: ${order.customer_phone}`, { x: margin, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
        y -= 16;
      }

      const addrLines = wrapText(order.customer_address || "-", 29);
      addrLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
        y -= 16;
      });

      if (order.customer_patokan) {
        const patLines = wrapText(`-Patokan: ${order.customer_patokan}`, 29);
        patLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 12, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
          y -= 16;
        });
      }

      const kecText = `Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`;
      const kecLines = wrapText(kecText, 29);
      kecLines.forEach((line) => {
        pageObj.drawText(line, { x: margin, y, size: 12.5, font: fontRegular });
        y -= 16;
      });

      y = drawSolidLineOnPage(pageObj, y);

      // Table Header Bar: "Nama Barang" vs "Total Harga"
      pageObj.drawText("Nama Barang", { x: margin, y, size: 13.5, font: fontBold });
      const headerRightText = "Total Harga";
      const headerRightWidth = fontBold.widthOfTextAtSize(headerRightText, 13.5);
      pageObj.drawText(headerRightText, { x: width - margin - headerRightWidth, y, size: 13.5, font: fontBold });
      y -= 18;

      y = drawSolidLineOnPage(pageObj, y);

      // Items List
      let subtotalItems = 0;
      items.forEach((it: any) => {
        const subVal = Number(it.subtotal || 0);
        subtotalItems += subVal;

        const displayName = formatProductName(it.product_name, it.is_half_portion);
        const pLines = wrapText(displayName || "-", 29);
        pLines.forEach((line) => {
          pageObj.drawText(line, { x: margin, y, size: 13.5, font: fontBold });
          y -= 16;
        });

        const qtyPriceText = `${it.quantity} x ${Number(it.price).toLocaleString("id-ID")}`;
        const subtotalText = Number(it.subtotal).toLocaleString("id-ID");

        pageObj.drawText(qtyPriceText, { x: margin, y, size: 12.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        const subWidth = fontBold.widthOfTextAtSize(subtotalText, 13.5);
        pageObj.drawText(subtotalText, { x: width - margin - subWidth, y, size: 13.5, font: fontBold });
        y -= 18;

        if (it.notes || it.note) {
          const noteText = String(it.notes || it.note).trim();
          if (noteText) {
            const nLines = wrapText(`* ${noteText}`, 29);
            nLines.forEach((line) => {
              pageObj.drawText(line, { x: margin + 8, y, size: 11, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
              y -= 15;
            });
          }
        }
      });

      // Shipping Fee
      const shippingFee = Number(order.shipping_fee || 0);
      if (shippingFee > 0) {
        pageObj.drawText("Biaya Kirim", { x: margin, y, size: 13.5, font: fontBold });
        y -= 16;

        const shipQtyText = `1 x ${shippingFee.toLocaleString("id-ID")}`;
        const shipSubText = shippingFee.toLocaleString("id-ID");

        pageObj.drawText(shipQtyText, { x: margin, y, size: 12.5, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        const shipWidth = fontBold.widthOfTextAtSize(shipSubText, 13.5);
        pageObj.drawText(shipSubText, { x: width - margin - shipWidth, y, size: 13.5, font: fontBold });
        y -= 18;
      }

      y = drawSolidLineOnPage(pageObj, y);

      // Summary: Sub Total & Diskon & Total
      const subTotalAll = subtotalItems + shippingFee;
      const discountVal = Number(order.discount || 0);

      // Sub Total Line
      pageObj.drawText("Sub Total", { x: margin, y, size: 13.5, font: fontBold });
      const subTotalTextStr = subTotalAll.toLocaleString("id-ID");
      const subTotalWidth = fontBold.widthOfTextAtSize(subTotalTextStr, 13.5);
      pageObj.drawText(subTotalTextStr, { x: width - margin - subTotalWidth, y, size: 13.5, font: fontBold });
      y -= 18;

      // Diskon Line
      pageObj.drawText("Diskon", { x: margin, y, size: 13.5, font: fontBold });
      const diskonTextStr = discountVal.toLocaleString("id-ID");
      const diskonWidth = fontBold.widthOfTextAtSize(diskonTextStr, 13.5);
      pageObj.drawText(diskonTextStr, { x: width - margin - diskonWidth, y, size: 13.5, font: fontBold });
      y -= 18;

      y = drawSolidLineOnPage(pageObj, y);

      // Grand Total Line
      pageObj.drawText("Total", { x: margin, y, size: 16, font: fontBold });
      const grandTotalTextStr = Number(order.grand_total || subTotalAll - discountVal).toLocaleString("id-ID");
      const grandTotalWidth = fontBold.widthOfTextAtSize(grandTotalTextStr, 16);
      pageObj.drawText(grandTotalTextStr, { x: width - margin - grandTotalWidth, y, size: 16, font: fontBold });
      y -= 24;

      y = drawSolidLineOnPage(pageObj, y);

      // Garis potong putus-putus untuk roll kertas thermal:
      // Beri jarak nyaman setelah solid line sebelum garis dashed, dan jarak nyaman sebelum judul nota berikutnya
      if (!isLastInRoll) {
        y -= 24;
        pageObj.drawLine({
          start: { x: 0, y },
          end: { x: width, y },
          thickness: 1.2,
          dashArray: [6, 4],
          color: rgb(0.1, 0.1, 0.1),
        });
        y -= 48; // Spasi sebelum D'Yummy Siap Saji di nota berikutnya
      }

      return y;
    };

    // Multi-order selalu dicetak sebagai satu halaman kontinu: ukuran halaman berbeda-beda
    // per struk membuat driver printer thermal memotong bagian bawah (Total) & atas (nama) struk.
    if (mode === "roll" || orderRes.rows.length > 1) {
      // ── CONTINUOUS THERMAL ROLL MODE (Exact 1:1 Height, Zero Phantom Padding) ──
      let totalContentHeight = 0;
      orderRes.rows.forEach((order, idx) => {
        const isLast = idx === orderRes.rows.length - 1;
        totalContentHeight += measureOrderHeight(order, isLast);
      });

      // Padding atas 60pt (sebelum header) & padding bawah 60pt (setelah garis di bawah Total)
      const totalRollHeight = Math.ceil(totalContentHeight + 60 + 36);

      const page = pdfDoc.addPage([width, totalRollHeight]);
      let y = totalRollHeight - 60; // Initial baseline offset so title font is never cut off at top

      orderRes.rows.forEach((order, idx) => {
        const isLast = idx === orderRes.rows.length - 1;
        y = renderSingleOrder(page, order, y, isLast);
      });
    } else {
      // ── DYNAMIC EXACT HEIGHT PER RECEIPT PAGE MODE (Zero Wasted Blank Paper) ──
      for (const order of orderRes.rows) {
        // Budget height including generous margin
        const height = Math.ceil(measureOrderHeight(order, true) + 120);
        const page = pdfDoc.addPage([width, height]);
        renderSingleOrder(page, order, height - 45, true);
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
