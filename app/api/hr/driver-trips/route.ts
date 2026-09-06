import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET API untuk mengambil data trip, KM, dan insentif driver per periode / tanggal
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7); // YYYY-MM

  const [yearStr, monthStr] = month.split("-");
  const yearNum = Number(yearStr) || new Date().getFullYear();
  const monthNum = Number(monthStr) || (new Date().getMonth() + 1);
  const lastDay = new Date(yearNum, monthNum, 0).getDate();

  const dateFrom = searchParams.get("date_from") || `${month}-01`;
  const dateTo = searchParams.get("date_to") || `${month}-${String(lastDay).padStart(2, "0")}`;

  const client = await pool.connect();
  try {
    // 1. Ambil daftar Karyawan Driver
    const driversRes = await client.query(`
      SELECT 
        e.id AS employee_id,
        COALESCE(e.kode_karyawan, '-') AS nip,
        e.nama_lengkap,
        p.nama AS jabatan_nama,
        COALESCE(ss.gaji_pokok_harian, 80000) AS gaji_pokok_harian,
        COALESCE(ss.lembur_per_jam, 10000) AS lembur_per_jam,
        COALESCE(ss.tunjangan_km_tier1, 10000) AS tunjangan_km_tier1,
        COALESCE(ss.tunjangan_km_tier2, 15000) AS tunjangan_km_tier2,
        COALESCE(ss.tunjangan_km_tier3, 20000) AS tunjangan_km_tier3
      FROM hr_employees e
      JOIN hr_positions p ON p.id = e.position_id
      LEFT JOIN LATERAL (
        SELECT * FROM hr_salary_structures s
        WHERE s.employee_id = e.id
        ORDER BY s.effective_date DESC
        LIMIT 1
      ) ss ON true
      WHERE e.tipe_gaji = 'HARIAN_DRIVER' OR p.nama ILIKE '%driver%'
      ORDER BY e.nama_lengkap ASC
    `);

    // 2. Ambil data trip & KM dari hr_driver_trips
    const tripsRes = await client.query(
      `SELECT 
        dt.id,
        dt.employee_id,
        dt.tanggal,
        dt.total_trip,
        dt.total_destinasi,
        dt.km,
        dt.tier,
        dt.tunjangan_km,
        dt.insentif_trip,
        dt.keterangan
       FROM hr_driver_trips dt
       WHERE dt.tanggal BETWEEN $1 AND $2
       ORDER BY dt.tanggal DESC`,
      [dateFrom, dateTo]
    );

    // 3. Ambil data sync otomatis pengiriman Siap Saji per driver per tanggal
    const syncRes = await client.query(
      `SELECT 
        o.driver_id,
        dr.name AS driver_name,
        COUNT(DISTINCT o.id) AS total_order,
        DATE(o.created_at) AS tgl
       FROM orders o
       JOIN drivers dr ON dr.id = o.driver_id
       WHERE DATE(o.created_at) BETWEEN $1 AND $2
       GROUP BY o.driver_id, dr.name, DATE(o.created_at)`,
      [dateFrom, dateTo]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json({
      drivers: driversRes.rows,
      trips: tripsRes.rows,
      siap_saji_sync: syncRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data trip driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST API untuk simpan / update log trip & KM driver
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employee_id, tanggal, km, total_trip, total_destinasi, insentif_trip, keterangan } = body;

  if (!employee_id || !tanggal) {
    return NextResponse.json({ error: "Driver dan tanggal wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Ambil setting tunjangan KM per-tier karyawan dari struktur gaji terbarunya
    const salRes = await client.query(
      `SELECT tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3
       FROM hr_salary_structures
       WHERE employee_id = $1
       ORDER BY effective_date DESC LIMIT 1`,
      [employee_id]
    );
    const sal = salRes.rows[0] || {};
    const rateTier1 = Number(sal.tunjangan_km_tier1) || 10000;
    const rateTier2 = Number(sal.tunjangan_km_tier2) || 15000;
    const rateTier3 = Number(sal.tunjangan_km_tier3) || 20000;

    // Determine tier & tunjangan_km
    const kmNum = Number(km) || 0;
    let tier = "TIER1";
    let rateKm = rateTier1;

    if (kmNum > 15) {
      tier = "TIER3";
      rateKm = rateTier3;
    } else if (kmNum >= 6) {
      tier = "TIER2";
      rateKm = rateTier2;
    }

    const tunjanganKm = kmNum > 0 ? rateKm : 0;

    // Check if record exists for employee + date
    const checkExist = await client.query(
      `SELECT id FROM hr_driver_trips WHERE employee_id = $1 AND tanggal = $2`,
      [employee_id, tanggal]
    );

    let resultRow;
    if (checkExist.rows.length > 0) {
      const updateRes = await client.query(
        `UPDATE hr_driver_trips
         SET km = $1, total_trip = $2, total_destinasi = $3, tier = $4, tunjangan_km = $5, insentif_trip = $6, keterangan = $7
         WHERE id = $8
         RETURNING *`,
        [kmNum, total_trip || 1, total_destinasi || 1, tier, tunjanganKm, insentif_trip || 0, keterangan || null, checkExist.rows[0].id]
      );
      resultRow = updateRes.rows[0];
    } else {
      const insertRes = await client.query(
        `INSERT INTO hr_driver_trips (employee_id, tanggal, km, total_trip, total_destinasi, tier, tunjangan_km, insentif_trip, keterangan)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [employee_id, tanggal, kmNum, total_trip || 1, total_destinasi || 1, tier, tunjanganKm, insentif_trip || 0, keterangan || null]
      );
      resultRow = insertRes.rows[0];
    }

    return NextResponse.json({ success: true, data: resultRow });
  } catch (error: any) {
    console.error("Gagal menyimpan trip driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
