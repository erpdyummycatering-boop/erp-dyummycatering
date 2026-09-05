import { NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const periode_tahun = parseInt(formData.get("periode_tahun") as string || String(new Date().getFullYear()), 10);
    const periode_bulan = parseInt(formData.get("periode_bulan") as string || String(new Date().getMonth() + 1), 10);

    if (!file) {
      return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    const sheetNames = workbook.SheetNames;

    // Fetch all active employees for name matching
    const empRes = await client.query(
      `SELECT id, kode_karyawan, nama_fingerprint, nama_lengkap FROM hr_employees`
    );
    const employees = empRes.rows;

    // Build lookup map (lowercase normalized)
    const empMap = new Map<string, any>();
    employees.forEach((emp) => {
      empMap.set(emp.nama_fingerprint.trim().toLowerCase(), emp);
      empMap.set(emp.nama_lengkap.trim().toLowerCase(), emp);
    });

    let format_file = "FORMAT_A"; // Default
    if (sheetNames.includes("Ringkasan Kehadiran") || sheetNames.includes("Perhitungan Tidak Normal")) {
      format_file = "FORMAT_B";
    } else if (sheetNames.includes("Template Manual") || sheetNames.includes("Sheet1")) {
      format_file = "TEMPLATE_MANUAL";
    }

    await client.query("BEGIN");

    // Insert upload record
    const uploadRes = await client.query(
      `INSERT INTO hr_attendance_uploads (
        periode_tahun, periode_bulan, nama_file, ukuran_file_bytes, format_file, status
      ) VALUES ($1, $2, $3, $4, $5, 'PROCESSING')
      RETURNING *`,
      [periode_tahun, periode_bulan, file.name, file.size, format_file]
    );
    const uploadId = uploadRes.rows[0].id;

    let totalRows = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let anomalyCount = 0;
    const unmatchedNames: string[] = [];
    const errorLogs: any[] = [];

    const sheet = workbook.Sheets[sheetNames[0]];
    const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (format_file === "FORMAT_B" && sheetNames.includes("Ringkasan Kehadiran")) {
      // Parse Sheet Ringkasan Kehadiran
      const summarySheet = workbook.Sheets["Ringkasan Kehadiran"];
      const summaryRows: any[] = XLSX.utils.sheet_to_json(summarySheet, { header: 1 });

      // Search for header row
      let startRowIdx = -1;
      for (let i = 0; i < Math.min(15, summaryRows.length); i++) {
        const rowStr = (summaryRows[i] || []).join(" ").toLowerCase();
        if (rowStr.includes("nama") && (rowStr.includes("hadir") || rowStr.includes("terlambat") || rowStr.includes("lembur"))) {
          startRowIdx = i;
          break;
        }
      }

      if (startRowIdx !== -1) {
        for (let i = startRowIdx + 1; i < summaryRows.length; i++) {
          const row = summaryRows[i];
          if (!row || !row[1] || String(row[1]).trim() === "") continue;

          totalRows++;
          const nameRaw = String(row[1]).trim();
          const emp = empMap.get(nameRaw.toLowerCase());

          if (emp) {
            matchedCount++;
          } else {
            unmatchedCount++;
            if (!unmatchedNames.includes(nameRaw)) unmatchedNames.push(nameRaw);
          }
        }
      }
    } else {
      // Default / Format A / Template Manual Parsing
      let headerIdx = 0;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i] || [];
        const rowText = row.join(" ").toLowerCase();
        if (rowText.includes("nama") || rowText.includes("tanggal")) {
          headerIdx = i;
          break;
        }
      }

      const rowsJson: any[] = XLSX.utils.sheet_to_json(sheet, { range: headerIdx });

      for (const row of rowsJson) {
        const nameRaw = row["Nama Karyawan"] || row["Nama"] || row["nama_karyawan"] || row["Nama Fingerprint"] || row["Name"];
        if (!nameRaw) continue;

        totalRows++;
        const emp = empMap.get(String(nameRaw).trim().toLowerCase());

        if (!emp) {
          unmatchedCount++;
          if (!unmatchedNames.includes(String(nameRaw).trim())) {
            unmatchedNames.push(String(nameRaw).trim());
          }
          continue;
        }

        matchedCount++;
        const dateRaw = row["Tanggal"] || row["tanggal"] || row["Date"];
        const timeIn = row["Jam Masuk"] || row["jam_masuk"] || row["In"];
        const timeOut = row["Jam Keluar"] || row["jam_keluar"] || row["Out"];
        const ket = row["Keterangan"] || row["keterangan"] || "HADIR";

        let dateStr = dateRaw;
        if (typeof dateRaw === "number") {
          const dateObj = XLSX.SSF.parse_date_code(dateRaw);
          dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
        }

        if (dateStr && emp) {
          const isNoScan = (!timeIn && !!timeOut) || (!!timeIn && !timeOut);
          if (isNoScan) anomalyCount++;

          await client.query(
            `INSERT INTO hr_attendances (
              employee_id, upload_id, tanggal, jam_masuk, jam_keluar, keterangan,
              tidak_scan_lengkap, is_anomali, source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UPLOAD')
            ON CONFLICT (employee_id, tanggal) DO UPDATE SET
              jam_masuk = EXCLUDED.jam_masuk,
              jam_keluar = EXCLUDED.jam_keluar,
              keterangan = EXCLUDED.keterangan,
              tidak_scan_lengkap = EXCLUDED.tidak_scan_lengkap,
              is_anomali = EXCLUDED.is_anomali,
              upload_id = EXCLUDED.upload_id,
              updated_at = NOW()`,
            [
              emp.id,
              uploadId,
              dateStr,
              timeIn || null,
              timeOut || null,
              ket || "HADIR",
              isNoScan,
              isNoScan,
            ]
          );
        }
      }
    }

    // Update upload status summary
    await client.query(
      `UPDATE hr_attendance_uploads SET
        status = 'DONE',
        total_rows = $1,
        rows_matched = $2,
        rows_unmatched = $3,
        rows_anomali = $4,
        unmatched_names = $5::jsonb,
        updated_at = NOW()
       WHERE id = $6`,
      [totalRows, matchedCount, unmatchedCount, anomalyCount, JSON.stringify(unmatchedNames), uploadId]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: "File presensi berhasil diunggah & diproses",
      upload_id: uploadId,
      format_file,
      summary: {
        total_rows: totalRows,
        matched: matchedCount,
        unmatched: unmatchedCount,
        unmatched_names: unmatchedNames,
        anomali: anomalyCount,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
