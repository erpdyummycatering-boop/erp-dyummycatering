import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const { rows } = await pool.query(
      `SELECT pd.*, e.kode_karyawan, e.no_telepon, p.nama_periode, p.periode_tahun, p.periode_bulan, p.status as payroll_status
       FROM hr_payroll_details pd
       JOIN hr_employees e ON e.id = pd.employee_id
       JOIN hr_payrolls p ON p.id = pd.payroll_id
       WHERE pd.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Slip gaji tidak ditemukan" }, { status: 404 });
    }

    const slip = rows[0];

    // Create a new PDFDocument with pdf-lib (pure JS, no .afm file dependencies)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait in points

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { height } = page.getSize();
    let y = height - 50;

    // Header
    page.drawText("Dyummy Catering", {
      x: 215,
      y,
      size: 20,
      font: helveticaBold,
      color: rgb(0.31, 0.02, 0.65), // #5005A6
    });

    y -= 18;
    page.drawText("SLIP GAJI KARYAWAN RESMI", {
      x: 215,
      y,
      size: 10,
      font: helveticaBold,
      color: rgb(0.42, 0.45, 0.5),
    });

    y -= 18;
    page.drawText(slip.nama_periode || "", {
      x: 240,
      y,
      size: 12,
      font: helveticaBold,
      color: rgb(0.07, 0.09, 0.15),
    });

    y -= 15;
    // Purple Divider
    page.drawLine({
      start: { x: 40, y },
      end: { x: 555, y },
      thickness: 2,
      color: rgb(0.31, 0.02, 0.65),
    });

    y -= 70;
    // Employee Info Card Box
    page.drawRectangle({
      x: 40,
      y,
      width: 515,
      height: 60,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    });

    page.drawText("NAMA KARYAWAN:", { x: 50, y: y + 42, size: 9, font: helvetica, color: rgb(0.42, 0.45, 0.5) });
    page.drawText(String(slip.snapshot_nama || ""), { x: 50, y: y + 28, size: 12, font: helveticaBold, color: rgb(0.07, 0.09, 0.15) });
    page.drawText(String(slip.kode_karyawan || ""), { x: 50, y: y + 14, size: 10, font: helveticaBold, color: rgb(0.31, 0.02, 0.65) });

    page.drawText("DEPARTEMEN / JABATAN:", { x: 300, y: y + 42, size: 9, font: helvetica, color: rgb(0.42, 0.45, 0.5) });
    page.drawText(`${slip.snapshot_departemen} / ${slip.snapshot_jabatan}`, { x: 300, y: y + 28, size: 11, font: helveticaBold, color: rgb(0.07, 0.09, 0.15) });

    y -= 45;
    // Attendance Summary Box
    page.drawRectangle({
      x: 40,
      y,
      width: 515,
      height: 35,
      color: rgb(0.95, 0.95, 0.96),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    });

    page.drawText(`Hari Hadir: ${slip.hari_hadir} Hari`, { x: 60, y: y + 12, size: 10, font: helveticaBold, color: rgb(0.22, 0.6, 0.13) });
    page.drawText(`Hari Absen: ${slip.hari_absen} Hari`, { x: 220, y: y + 12, size: 10, font: helveticaBold, color: rgb(0.88, 0.29, 0.29) });
    page.drawText(`Jam Lembur: ${(slip.total_lembur_menit_diakui / 60).toFixed(1)} Jam`, { x: 390, y: y + 12, size: 10, font: helveticaBold, color: rgb(0.31, 0.02, 0.65) });

    y -= 35;
    // Pendapatan Section
    page.drawText("1. PENDAPATAN", { x: 40, y, size: 11, font: helveticaBold, color: rgb(0.31, 0.02, 0.65) });
    y -= 5;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });

    y -= 18;
    const gajiPokok = Number(slip.subtotal_gaji_pokok || 0);
    page.drawText(`Gaji Pokok (${slip.hari_hadir} x Rp ${Number(slip.gaji_pokok_harian_snapshot).toLocaleString("id-ID")})`, { x: 50, y, size: 10, font: helvetica });
    page.drawText(`Rp ${gajiPokok.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold });

    y -= 18;
    const lembur = Number(slip.subtotal_lembur || 0);
    page.drawText("Uang Lembur", { x: 50, y, size: 10, font: helvetica });
    page.drawText(`Rp ${lembur.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold });

    const tunjKm = Number(slip.tunjangan_km || 0);
    if (tunjKm > 0) {
      y -= 18;
      page.drawText("Tunjangan Perjalanan KM (Driver)", { x: 50, y, size: 10, font: helvetica });
      page.drawText(`Rp ${tunjKm.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold });
    }

    const tunjBonus = Number(slip.tunjangan_bonus || 0);
    if (tunjBonus > 0) {
      y -= 18;
      page.drawText("Insentif / Bonus", { x: 50, y, size: 10, font: helvetica });
      page.drawText(`Rp ${tunjBonus.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold });
    }

    y -= 30;
    // Potongan Section
    page.drawText("2. POTONGAN", { x: 40, y, size: 11, font: helveticaBold, color: rgb(0.88, 0.29, 0.29) });
    y -= 5;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });

    y -= 18;
    const potTerlambat = Number(slip.potongan_terlambat || 0);
    page.drawText("Potongan Keterlambatan", { x: 50, y, size: 10, font: helvetica, color: rgb(0.88, 0.29, 0.29) });
    page.drawText(`Rp ${potTerlambat.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold, color: rgb(0.88, 0.29, 0.29) });

    const potLain = Number(slip.potongan_lain || 0);
    if (potLain > 0) {
      y -= 18;
      page.drawText("Potongan Lainnya (Kasbon)", { x: 50, y, size: 10, font: helvetica, color: rgb(0.88, 0.29, 0.29) });
      page.drawText(`Rp ${potLain.toLocaleString("id-ID")}`, { x: 440, y, size: 10, font: helveticaBold, color: rgb(0.88, 0.29, 0.29) });
    }

    y -= 45;
    // Total Banner
    page.drawRectangle({
      x: 40,
      y,
      width: 515,
      height: 38,
      color: rgb(0.31, 0.02, 0.65),
    });

    page.drawText("TOTAL GAJI BERSIH", { x: 55, y: y + 13, size: 12, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText(`Rp ${Number(slip.gaji_bersih || 0).toLocaleString("id-ID")}`, { x: 410, y: y + 12, size: 14, font: helveticaBold, color: rgb(1, 1, 1) });

    y -= 30;
    page.drawText("Dokumen ini diterbitkan secara elektronik oleh Dyummy Catering. Validasi resmi tanpa tanda tangan basah.", {
      x: 70,
      y,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Slip_Gaji_${slip.kode_karyawan}_${slip.nama_periode}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
