import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const payroll_id = searchParams.get("payroll_id");
    const detail_ids = searchParams.get("detail_ids"); // Comma-separated detail IDs (optional selection)

    if (!payroll_id) {
      return NextResponse.json({ error: "Parameter payroll_id wajib diisi" }, { status: 400 });
    }

    // Fetch payroll info
    const payrollRes = await pool.query(`SELECT * FROM hr_payrolls WHERE id = $1`, [payroll_id]);
    if (payrollRes.rows.length === 0) {
      return NextResponse.json({ error: "Data payroll tidak ditemukan" }, { status: 404 });
    }
    const payroll = payrollRes.rows[0];

    // Fetch details
    let detailQuery = `
      SELECT pd.*, e.kode_karyawan, e.nama_fingerprint
      FROM hr_payroll_details pd
      JOIN hr_employees e ON e.id = pd.employee_id
      WHERE pd.payroll_id = $1
    `;
    const params: any[] = [payroll_id];

    if (detail_ids) {
      const ids = detail_ids.split(",").map((x) => x.trim()).filter(Boolean);
      if (ids.length > 0) {
        detailQuery += ` AND pd.id = ANY($2::bigint[])`;
        params.push(ids);
      }
    }

    detailQuery += ` ORDER BY pd.id ASC`;

    const detailsRes = await pool.query(detailQuery, params);
    const details = detailsRes.rows;

    if (details.length === 0) {
      return NextResponse.json({ error: "Tidak ada slip gaji yang dipilih" }, { status: 404 });
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // A4 dimensions in points: 595.28 x 841.89
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;

    // Grid Layout: 2 Columns x 3 Rows = 6 slips per page
    const MARGIN_X = 20;
    const MARGIN_Y = 20;
    const GAP_X = 12;
    const GAP_Y = 12;

    const COLS = 2;
    const ROWS = 3;
    const SLIPS_PER_PAGE = COLS * ROWS; // 6

    const SLIP_WIDTH = (PAGE_WIDTH - 2 * MARGIN_X - (COLS - 1) * GAP_X) / COLS; // ~269.6 pt
    const SLIP_HEIGHT = (PAGE_HEIGHT - 2 * MARGIN_Y - (ROWS - 1) * GAP_Y) / ROWS; // ~257.9 pt

    // Helper format currency
    const formatRp = (num: number) => {
      return Number(num || 0).toLocaleString("id-ID");
    };

    // Helper draw cell border and text
    const drawSlip = (
      page: any,
      slip: any,
      originX: number,
      originY: number, // Bottom-left of slip rectangle
      width: number,
      height: number
    ) => {
      const topY = originY + height;

      // 1. Slip Border Box
      page.drawRectangle({
        x: originX,
        y: originY,
        width,
        height,
        borderColor: rgb(0.2, 0.2, 0.2),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      // 2. Header Bar: Nama & Periode (Persis Excel)
      // Top header row height: 22 pt
      const headerH = 20;
      const headerY = topY - headerH;

      // "Nama" label cell
      page.drawRectangle({
        x: originX,
        y: headerY,
        width: 36,
        height: headerH,
        color: rgb(0.85, 0.9, 0.98), // Light soft blue
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
      });
      page.drawText("Nama", {
        x: originX + 5,
        y: headerY + 6,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // Nama value cell
      const nameValW = width * 0.42;
      page.drawRectangle({
        x: originX + 36,
        y: headerY,
        width: nameValW,
        height: headerH,
        color: rgb(0.96, 0.88, 0.92), // Pinkish pastel
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
      });
      const truncatedName = String(slip.snapshot_nama || "").substring(0, 18);
      page.drawText(truncatedName, {
        x: originX + 40,
        y: headerY + 6,
        size: 8,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // "Periode :" label cell
      const perX = originX + 36 + nameValW;
      const perW = width - (36 + nameValW);
      page.drawRectangle({
        x: perX,
        y: headerY,
        width: perW,
        height: headerH,
        color: rgb(0.9, 0.94, 0.98),
        borderColor: rgb(0.3, 0.3, 0.3),
        borderWidth: 0.5,
      });
      // Short period label
      let perText = payroll.nama_periode || "";
      if (payroll.tanggal_mulai && payroll.tanggal_selesai) {
        const d1 = new Date(payroll.tanggal_mulai);
        const d2 = new Date(payroll.tanggal_selesai);
        const mNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
        perText = `${d1.getDate()} ${mNames[d1.getMonth()]} - ${d2.getDate()} ${mNames[d2.getMonth()]} ${d2.getFullYear()}`;
      }
      page.drawText(`Periode : ${perText}`, {
        x: perX + 4,
        y: headerY + 6,
        size: 7.5,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });

      // 3. Table Column Headers
      const isBulanan = payroll.tipe_payroll === "BULANAN";
      const theadH = 14;
      const theadY = headerY - theadH;

      if (!isBulanan) {
        // Mode Pekanan: ada kolom Tgl, Hari, Datang, Pulang, Jam Kerja, Jam Lembur, Gaji Pokok
        const colW = [30, 32, 28, 28, 38, 38, width - (30 + 32 + 28 + 28 + 38 + 38)];
        const headers = ["Tgl", "Hari", "Datang", "Pulang", "Jam kerja", "Jam Lembur", "Gaji Pokok"];

        let curColX = originX;
        for (let c = 0; c < colW.length; c++) {
          page.drawRectangle({
            x: curColX,
            y: theadY,
            width: colW[c],
            height: theadH,
            color: rgb(0.96, 0.96, 0.96),
            borderColor: rgb(0.4, 0.4, 0.4),
            borderWidth: 0.5,
          });
          page.drawText(headers[c], {
            x: curColX + 2,
            y: theadY + 4,
            size: 6.5,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
          });
          curColX += colW[c];
        }

        // Daily records rows (up to 7 days in a week)
        const dailyRows: any[] = Array.isArray(slip.detail_harian) ? slip.detail_harian : [];
        const maxRows = 7;
        const rowH = 12.5;
        let curRowY = theadY - rowH;

        for (let r = 0; r < maxRows; r++) {
          const rec = dailyRows[r] || null;
          let cellX = originX;

          // Format fields
          const tglStr = rec ? rec.tanggal.substring(8, 10) : "-";
          const hariStr = rec ? rec.hari : "-";
          const inStr = rec && rec.jam_masuk && rec.jam_masuk !== "-" ? rec.jam_masuk.substring(0, 5) : "-";
          const outStr = rec && rec.jam_keluar && rec.jam_keluar !== "-" ? rec.jam_keluar.substring(0, 5) : "-";
          const durStr = rec && rec.jam_kerja_menit ? `${Math.floor(rec.jam_kerja_menit / 60)}:${String(rec.jam_kerja_menit % 60).padStart(2, "0")}` : "-";
          const ovtStr = rec && rec.jam_lembur_menit ? `${Math.floor(rec.jam_lembur_menit / 60)}:${String(rec.jam_lembur_menit % 60).padStart(2, "0")}` : "-";
          const pokStr = rec && rec.gaji_pokok ? `Rp${formatRp(rec.gaji_pokok)}` : "-";

          const cellTexts = [tglStr, hariStr, inStr, outStr, durStr, ovtStr, pokStr];

          for (let c = 0; c < colW.length; c++) {
            page.drawRectangle({
              x: cellX,
              y: curRowY,
              width: colW[c],
              height: rowH,
              color: rgb(1, 1, 1),
              borderColor: rgb(0.7, 0.7, 0.7),
              borderWidth: 0.5,
            });
            page.drawText(cellTexts[c], {
              x: cellX + 2,
              y: curRowY + 3.5,
              size: 6,
              font: fontRegular,
              color: rgb(0.15, 0.15, 0.15),
            });
            cellX += colW[c];
          }
          curRowY -= rowH;
        }

        // Summary Rows (Lembur, Lembur Pagi, Bonus, Subtotal, Potongan, Grand Total)
        const sumRowH = 12;

        // Lembur Row
        page.drawRectangle({
          x: originX,
          y: curRowY,
          width: width - colW[6],
          height: sumRowH,
          color: rgb(1, 0.98, 0.6), // Soft Yellow
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText("LEMBUR", {
          x: originX + 4,
          y: curRowY + 3,
          size: 7,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        // Lembur Value
        page.drawRectangle({
          x: originX + width - colW[6],
          y: curRowY,
          width: colW[6],
          height: sumRowH,
          color: rgb(1, 0.98, 0.6),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText(`Rp${formatRp(slip.subtotal_lembur)}`, {
          x: originX + width - colW[6] + 2,
          y: curRowY + 3,
          size: 6.5,
          font: fontBold,
        });
        curRowY -= sumRowH;

        // Lembur Pagi Row
        if (slip.subtotal_lembur_pagi > 0) {
          page.drawRectangle({
            x: originX,
            y: curRowY,
            width: width - colW[6],
            height: sumRowH,
            color: rgb(1, 0.98, 0.6),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText("LEMBUR PAGI", {
            x: originX + 4,
            y: curRowY + 3,
            size: 7,
            font: fontBold,
          });

          page.drawRectangle({
            x: originX + width - colW[6],
            y: curRowY,
            width: colW[6],
            height: sumRowH,
            color: rgb(1, 0.98, 0.6),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText(`Rp${formatRp(slip.subtotal_lembur_pagi)}`, {
            x: originX + width - colW[6] + 2,
            y: curRowY + 3,
            size: 6.5,
            font: fontBold,
          });
          curRowY -= sumRowH;
        }

        // Bonus / Pembulatan Row
        const bonusVal = Number(slip.tunjangan_bonus || slip.subtotal_bonus || 0);
        page.drawRectangle({
          x: originX,
          y: curRowY,
          width: width - colW[6],
          height: sumRowH,
          color: rgb(0.96, 0.96, 0.96),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText("Bonus / Pembulatan", {
          x: originX + 4,
          y: curRowY + 3,
          size: 6.5,
          font: fontBold,
        });

        page.drawRectangle({
          x: originX + width - colW[6],
          y: curRowY,
          width: colW[6],
          height: sumRowH,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText(bonusVal > 0 ? `Rp${formatRp(bonusVal)}` : "0", {
          x: originX + width - colW[6] + 2,
          y: curRowY + 3,
          size: 6.5,
          font: fontBold,
        });
        curRowY -= sumRowH;

        // Subtotal (Sebelum Potongan)
        const subtotalSebelumPot = Number(slip.subtotal_gaji_pokok || 0) + Number(slip.subtotal_lembur || 0) + Number(slip.subtotal_lembur_pagi || 0) + bonusVal;
        page.drawRectangle({
          x: originX,
          y: curRowY,
          width: width - colW[6],
          height: sumRowH,
          color: rgb(0.92, 0.95, 0.99),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText("TOTAL", {
          x: originX + 4,
          y: curRowY + 3,
          size: 7,
          font: fontBold,
        });

        page.drawRectangle({
          x: originX + width - colW[6],
          y: curRowY,
          width: colW[6],
          height: sumRowH,
          color: rgb(0.92, 0.95, 0.99),
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 0.5,
        });
        page.drawText(`Rp${formatRp(subtotalSebelumPot)}`, {
          x: originX + width - colW[6] + 2,
          y: curRowY + 3,
          size: 6.5,
          font: fontBold,
        });
        curRowY -= sumRowH;

        // Potongan Rows (Tabungan / Kasbon / Lainnya)
        const potTabungan = Number(slip.potongan_tabungan || 0);
        const potLain = Number(slip.potongan_lain || 0);

        if (potTabungan > 0) {
          page.drawRectangle({
            x: originX,
            y: curRowY,
            width: width - colW[6],
            height: sumRowH,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText("Potongan Tabungan", {
            x: originX + 4,
            y: curRowY + 3,
            size: 6.5,
            font: fontBold,
            color: rgb(0.85, 0.1, 0.1),
          });

          page.drawRectangle({
            x: originX + width - colW[6],
            y: curRowY,
            width: colW[6],
            height: sumRowH,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText(`-Rp${formatRp(potTabungan)}`, {
            x: originX + width - colW[6] + 2,
            y: curRowY + 3,
            size: 6.5,
            font: fontBold,
            color: rgb(0.85, 0.1, 0.1),
          });
          curRowY -= sumRowH;
        }

        if (potLain > 0) {
          page.drawRectangle({
            x: originX,
            y: curRowY,
            width: width - colW[6],
            height: sumRowH,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText("Potongan Lainnya", {
            x: originX + 4,
            y: curRowY + 3,
            size: 6.5,
            font: fontBold,
            color: rgb(0.85, 0.1, 0.1),
          });

          page.drawRectangle({
            x: originX + width - colW[6],
            y: curRowY,
            width: colW[6],
            height: sumRowH,
            color: rgb(1, 1, 1),
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 0.5,
          });
          page.drawText(`-Rp${formatRp(potLain)}`, {
            x: originX + width - colW[6] + 2,
            y: curRowY + 3,
            size: 6.5,
            font: fontBold,
            color: rgb(0.85, 0.1, 0.1),
          });
          curRowY -= sumRowH;
        }

        // GRAND TOTAL ROW
        page.drawRectangle({
          x: originX,
          y: curRowY,
          width: width - colW[6],
          height: sumRowH + 1,
          color: rgb(0.82, 0.89, 0.98), // Deeper soft blue
          borderColor: rgb(0.3, 0.3, 0.3),
          borderWidth: 0.7,
        });
        page.drawText("GRAND TOTAL", {
          x: originX + 4,
          y: curRowY + 3,
          size: 7.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });

        page.drawRectangle({
          x: originX + width - colW[6],
          y: curRowY,
          width: colW[6],
          height: sumRowH + 1,
          color: rgb(0.82, 0.89, 0.98),
          borderColor: rgb(0.3, 0.3, 0.3),
          borderWidth: 0.7,
        });
        page.drawText(`Rp${formatRp(slip.gaji_bersih)}`, {
          x: originX + width - colW[6] + 2,
          y: curRowY + 3,
          size: 7.5,
          font: fontBold,
          color: rgb(0.1, 0.1, 0.1),
        });
        curRowY -= sumRowH;

        // Footer info line: Jam Kerja : 8 Jam, Lembur : 7.000/jam
        page.drawText(
          `* Jam Kerja : 8 Jam, Lembur : Rp${formatRp(slip.lembur_per_jam_snapshot)}/jam`,
          {
            x: originX + 6,
            y: originY + 5,
            size: 6,
            font: fontRegular,
            color: rgb(0.4, 0.4, 0.4),
          }
        );
      } else {
        // Mode Bulanan: TIDAK MENAMPILKAN JAM (Sesuai instruksi)
        const rowH = 15;
        let curRowY = theadY;

        const items = [
          { label: "Hari Hadir", val: `${slip.hari_hadir} Hari` },
          { label: "Gaji Pokok", val: `Rp ${formatRp(slip.subtotal_gaji_pokok)}` },
          { label: "Lembur", val: `Rp ${formatRp(slip.subtotal_lembur)}` },
          { label: "Bonus / Insentif", val: `Rp ${formatRp(slip.tunjangan_bonus || slip.subtotal_bonus)}` },
          { label: "Tunjangan Lain", val: `Rp ${formatRp(slip.tunjangan_km || 0)}` },
          { label: "Total Potongan", val: `-Rp ${formatRp(slip.total_potongan)}`, isDanger: true },
        ];

        for (const it of items) {
          page.drawRectangle({
            x: originX + 6,
            y: curRowY - rowH,
            width: width - 12,
            height: rowH,
            color: rgb(0.98, 0.98, 0.98),
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 0.5,
          });
          page.drawText(it.label, {
            x: originX + 12,
            y: curRowY - rowH + 4,
            size: 7.5,
            font: fontRegular,
            color: it.isDanger ? rgb(0.85, 0.1, 0.1) : rgb(0.2, 0.2, 0.2),
          });
          page.drawText(it.val, {
            x: originX + width - 85,
            y: curRowY - rowH + 4,
            size: 7.5,
            font: fontBold,
            color: it.isDanger ? rgb(0.85, 0.1, 0.1) : rgb(0.1, 0.1, 0.1),
          });
          curRowY -= rowH + 2;
        }

        // Grand Total Bulanan
        page.drawRectangle({
          x: originX + 6,
          y: curRowY - 22,
          width: width - 12,
          height: 22,
          color: rgb(0.31, 0.02, 0.65), // #5005A6
        });
        page.drawText("TOTAL GAJI BERSIH", {
          x: originX + 14,
          y: curRowY - 14,
          size: 8.5,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
        page.drawText(`Rp ${formatRp(slip.gaji_bersih)}`, {
          x: originX + width - 100,
          y: curRowY - 14,
          size: 9.5,
          font: fontBold,
          color: rgb(1, 1, 1),
        });

        page.drawText(
          "* Rekapitulasi Bulanan Resmi Dyummy Catering. Tanpa rincian jam harian.",
          {
            x: originX + 12,
            y: originY + 8,
            size: 6,
            font: fontRegular,
            color: rgb(0.5, 0.5, 0.5),
          }
        );
      }
    };

    // Render slips across pages (6 slips per page: 2 columns x 3 rows)
    let page: any = null;
    for (let i = 0; i < details.length; i++) {
      const indexOnPage = i % SLIPS_PER_PAGE;
      if (indexOnPage === 0) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      }

      const col = indexOnPage % COLS; // 0 or 1
      const row = Math.floor(indexOnPage / COLS); // 0, 1, or 2

      const x = MARGIN_X + col * (SLIP_WIDTH + GAP_X);
      // Top row is row 0, bottom row is row 2
      const y = PAGE_HEIGHT - MARGIN_Y - (row + 1) * SLIP_HEIGHT - row * GAP_Y;

      drawSlip(page, details[i], x, y, SLIP_WIDTH, SLIP_HEIGHT);
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Slip_Gaji_MultiUp_${payroll.nama_periode.replace(/\s+/g, "_")}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
