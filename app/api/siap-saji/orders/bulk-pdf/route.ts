import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatDate } from "@/lib/utils";

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
    const margin = 10;

    // Mathematically exact height calculation matching draw operations 1:1
    const getSingleOrderHeight = (order: any, isLast: boolean = false) => {
      const items = order.items || [];
      let h = 0;
      // Header: DYummy Catering (16), Jl Sindangsari... (12), gap (4), dashed (12)
      h += 44;
      // Order info: no_struk (12), channel (14), dashed (12)
      h += 38;
      // Customer info: name (12), address (11), patokan (11 if present), kec (14), dashed (12)
      h += 12 + 11 + (order.customer_patokan ? 11 : 0) + 14 + 12;
      // Items: product_name (11), qty/price & subtotal (14) for each item
      h += items.length * 25;
      h += 12; // dashed line
      // Summary: Biaya Kirim (13), Total (13), Pembayaran (14), dashed (12)
      h += 52;
      // Footer: Wanti Nova (11.5)
      h += 11.5;
      // Divider (if not last order)
      if (!isLast) {
        h += 31; // (8 + 11 + 12)
      }
      return h;
    };

    if (mode === "roll") {
      // ── CONTINUOUS THERMAL ROLL MODE (Exact 1:1 Height, Zero Phantom Padding) ──
      let totalContentHeight = 0;
      orderRes.rows.forEach((order, idx) => {
        const isLast = idx === orderRes.rows.length - 1;
        totalContentHeight += getSingleOrderHeight(order, isLast);
      });

      // Top margin 15pt + Bottom margin 15pt
      const totalRollHeight = Math.ceil(totalContentHeight + 30);

      const page = pdfDoc.addPage([width, totalRollHeight]);
      let y = totalRollHeight - 15;

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

      orderRes.rows.forEach((order, idx) => {
        const items = order.items || [];
        const createdDate = order.created_at
          ? new Date(order.created_at).toLocaleDateString("id-ID")
          : new Date().toLocaleDateString("id-ID");

        // Header
        drawCenterText("DYummy Catering", fontBold, 12);
        drawCenterText("Jl Sindangsari 4 No 48 Kota Bandung", fontRegular, 8);
        y -= 4;

        drawDashedLine();

        // Order info
        page.drawText(`${order.no_struk || `INV-${order.id}`} - ${formatDate(order.delivery_date)}`, {
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
          page.drawText(`-Patokan : ${String(order.customer_patokan).substring(0, 32)}`, {
            x: margin,
            y,
            size: 7.5,
            font: fontRegular,
            color: rgb(0.3, 0.3, 0.3),
          });
          y -= 11;
        }
        page.drawText(`Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`, {
          x: margin,
          y,
          size: 8,
          font: fontRegular,
        });
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
        const bankText = `${order.payment_bank || "BCA"} (${order.payment_account || ""})`;
        const bankWidth = fontRegular.widthOfTextAtSize(bankText, 7.5);
        page.drawText(bankText, { x: width - margin - bankWidth, y, size: 7.5, font: fontRegular });
        y -= 14;

        drawDashedLine();

        drawCenterText(`Wanti Nova, ${createdDate}`, fontOblique, 7.5);

        // Cutter divider line between receipts (if not last)
        if (idx < orderRes.rows.length - 1) {
          y -= 8;
          drawCenterText("- - - - - POTONG DI SINI / CUT HERE - - - - -", fontRegular, 7);
          y -= 12;
        }
      });
    } else {
      // ── DYNAMIC EXACT HEIGHT PER RECEIPT PAGE MODE (Zero Wasted Blank Paper) ──
      for (const order of orderRes.rows) {
        const items = order.items || [];
        const createdDate = order.created_at
          ? new Date(order.created_at).toLocaleDateString("id-ID")
          : new Date().toLocaleDateString("id-ID");

        const height = Math.ceil(getSingleOrderHeight(order, true) + 30);
        const page = pdfDoc.addPage([width, height]);

        let y = height - 15;

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
        page.drawText(`${order.no_struk || `INV-${order.id}`} - ${formatDate(order.delivery_date)}`, {
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
          page.drawText(`-Patokan : ${String(order.customer_patokan).substring(0, 32)}`, {
            x: margin,
            y,
            size: 7.5,
            font: fontRegular,
            color: rgb(0.3, 0.3, 0.3),
          });
          y -= 11;
        }
        page.drawText(`Kec. ${order.area_kecamatan || "-"} (${order.area_kota || "-"})`, {
          x: margin,
          y,
          size: 8,
          font: fontRegular,
        });
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
        const bankText = `${order.payment_bank || "BCA"} (${order.payment_account || ""})`;
        const bankWidth = fontRegular.widthOfTextAtSize(bankText, 7.5);
        page.drawText(bankText, { x: width - margin - bankWidth, y, size: 7.5, font: fontRegular });
        y -= 14;

        drawDashedLine();

        drawCenterText(`Wanti Nova, ${createdDate}`, fontOblique, 7.5);
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
