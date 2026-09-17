import { NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

function parseExcelTime(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
      return null;
    }

    // 1. Check standard time pattern "HH:mm", "HH:mm:ss", with optional AM/PM
    const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
    if (colonMatch) {
      let h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      const s = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
      const meridiem = colonMatch[4] ? colonMatch[4].toUpperCase() : null;
      if (meridiem === "PM" && h < 12) h += 12;
      if (meridiem === "AM" && h === 12) h = 0;
      if (h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
    }

    // 2. Check "HH.mm" format (e.g. 12.01 -> 12:01:00)
    const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{2})$/);
    if (dotMatch) {
      const h = parseInt(dotMatch[1], 10);
      const m = parseInt(dotMatch[2], 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      }
    }

    // 3. Check if string is float representation of Excel time (e.g. "0.500694444444444")
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0 && num < 1) {
      val = num;
    } else {
      return null;
    }
  }

  if (typeof val === "number") {
    if (isNaN(val) || val < 0) return null;
    // Excel time is a fraction of a 24-hour day (0 <= fraction < 1)
    let fraction = val % 1;
    if (fraction === 0 && val >= 1) return null; // An integer >= 1 is likely a date without time or an ID
    if (fraction < 0) fraction += 1;
    const totalSeconds = Math.round(fraction * 86400);
    const h = Math.floor(totalSeconds / 3600) % 24;
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  if (val instanceof Date) {
    const h = String(val.getHours()).padStart(2, "0");
    const m = String(val.getMinutes()).padStart(2, "0");
    const s = String(val.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  return null;
}

function parseExcelDate(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "number") {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
        return `${dateObj.y}-${String(dateObj.m).padStart(2, "0")}-${String(dateObj.d).padStart(2, "0")}`;
      }
    } catch {
      // ignore
    }
  }

  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;

    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split("-");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }

  return null;
}

function findEmployee(nameRaw: any, empMap: Map<string, any>): any {
  if (!nameRaw) return null;
  const clean = String(nameRaw).trim().replace(/\s+/g, " ");
  const lower = clean.toLowerCase();

  // 1. Direct match
  if (empMap.has(lower)) return empMap.get(lower);

  // 2. Remove text in parentheses, e.g. "Husain Pria Wardana (Dana)" -> "Husain Pria Wardana"
  const withoutParens = clean.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (withoutParens && empMap.has(withoutParens)) return empMap.get(withoutParens);

  // 3. Match text inside parentheses, e.g. "(Dana)" -> "dana"
  const insideParensMatches = Array.from(clean.matchAll(/\((.*?)\)/g));
  for (const match of insideParensMatches) {
    const inside = match[1].trim().toLowerCase();
    if (inside && empMap.has(inside)) return empMap.get(inside);
  }

  // 4. Strip honorific titles like "pak", "bu", "ibu", "bapak"
  const withoutTitles = withoutParens.replace(/^(pak|bapak|bu|ibu)\s+/i, "").trim().toLowerCase();
  if (withoutTitles && empMap.has(withoutTitles)) return empMap.get(withoutTitles);

  return null;
}

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

    // Fetch all employees for name matching
    const empRes = await client.query(
      `SELECT id, kode_karyawan, nama_fingerprint, nama_lengkap FROM hr_employees`
    );
    const employees = empRes.rows;

    // Build lookup map (lowercase normalized)
    const empMap = new Map<string, any>();
    employees.forEach((emp) => {
      if (emp.nama_fingerprint) empMap.set(emp.nama_fingerprint.trim().toLowerCase(), emp);
      if (emp.nama_lengkap) empMap.set(emp.nama_lengkap.trim().toLowerCase(), emp);
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
          const emp = findEmployee(nameRaw, empMap);

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
        const nameRaw =
          row["Nama Karyawan"] ||
          row["Nama"] ||
          row["nama_karyawan"] ||
          row["Nama Fingerprint"] ||
          row["Name"] ||
          row["nama"] ||
          row["Employee Name"];
        if (!nameRaw) continue;

        totalRows++;
        const emp = findEmployee(nameRaw, empMap);

        if (!emp) {
          unmatchedCount++;
          const trimmedName = String(nameRaw).trim();
          if (!unmatchedNames.includes(trimmedName)) {
            unmatchedNames.push(trimmedName);
          }
          continue;
        }

        matchedCount++;
        const dateRaw =
          row["Tanggal"] ||
          row["tanggal"] ||
          row["Date"] ||
          row["date"] ||
          row["Tgl"] ||
          row["tgl"];
        const timeInRaw =
          row["Jam Masuk"] ||
          row["jam_masuk"] ||
          row["In"] ||
          row["in"] ||
          row["Masuk"] ||
          row["masuk"] ||
          row["Check In"];
        const timeOutRaw =
          row["Jam Keluar"] ||
          row["jam_keluar"] ||
          row["Out"] ||
          row["out"] ||
          row["Keluar"] ||
          row["keluar"] ||
          row["Check Out"];
        const rawKet =
          row["Keterangan"] ||
          row["keterangan"] ||
          row["Status"] ||
          row["status"] ||
          row["Ket"] ||
          row["ket"];

        const dateStr = parseExcelDate(dateRaw);
        const timeIn = parseExcelTime(timeInRaw);
        const timeOut = parseExcelTime(timeOutRaw);

        if (dateStr && emp) {
          const isNoScan = (!timeIn && !!timeOut) || (!!timeIn && !timeOut);
          if (isNoScan) anomalyCount++;

          // Auto calculate work duration & overtime if both timeIn & timeOut exist
          let durasiMenit: number | null = null;
          let lemburMenit = 0;
          if (timeIn && timeOut) {
            const [inH, inM] = timeIn.split(":").map(Number);
            const [outH, outM] = timeOut.split(":").map(Number);
            let inTotal = inH * 60 + inM;
            let outTotal = outH * 60 + outM;
            if (outTotal < inTotal) {
              outTotal += 24 * 60; // shift crossed midnight
            }
            durasiMenit = outTotal - inTotal;
            if (durasiMenit > 480) {
              lemburMenit = durasiMenit - 480;
            }
          }

          const ket = rawKet || (!timeIn && !timeOut ? "LIBUR" : "HADIR");

          await client.query(
            `INSERT INTO hr_attendances (
              employee_id, upload_id, tanggal, jam_masuk, jam_keluar,
              durasi_kerja_menit, lembur_menit, keterangan,
              tidak_scan_lengkap, is_anomali, source
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'UPLOAD')
            ON CONFLICT (employee_id, tanggal) DO UPDATE SET
              jam_masuk = EXCLUDED.jam_masuk,
              jam_keluar = EXCLUDED.jam_keluar,
              durasi_kerja_menit = EXCLUDED.durasi_kerja_menit,
              lembur_menit = EXCLUDED.lembur_menit,
              keterangan = EXCLUDED.keterangan,
              tidak_scan_lengkap = EXCLUDED.tidak_scan_lengkap,
              is_anomali = EXCLUDED.is_anomali,
              upload_id = EXCLUDED.upload_id,
              updated_at = NOW()`,
            [
              emp.id,
              uploadId,
              dateStr,
              timeIn,
              timeOut,
              durasiMenit,
              lemburMenit,
              ket,
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
