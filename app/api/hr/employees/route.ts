import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const department_id = searchParams.get("department_id");
    const position_id = searchParams.get("position_id");
    const status = searchParams.get("status");
    const tipe_karyawan = searchParams.get("tipe_karyawan");

    let query = `
      SELECT e.*, 
             d.nama as department_nama, d.kode as department_kode,
             p.nama as position_nama, p.kode as position_kode,
             s.gaji_pokok_harian, s.lembur_per_jam, s.tunjangan_km_tier1, s.tunjangan_km_tier2, s.tunjangan_km_tier3, s.effective_date as salary_effective_date
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      LEFT JOIN LATERAL (
        SELECT * FROM hr_salary_structures ss
        WHERE ss.employee_id = e.id
        ORDER BY ss.effective_date DESC
        LIMIT 1
      ) s ON true
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (e.nama_lengkap ILIKE $${params.length} OR e.nama_fingerprint ILIKE $${params.length} OR e.kode_karyawan ILIKE $${params.length})`;
    }

    if (department_id) {
      params.push(department_id);
      query += ` AND e.department_id = $${params.length}`;
    }

    if (position_id) {
      params.push(position_id);
      query += ` AND e.position_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND e.status = $${params.length}`;
    }

    if (tipe_karyawan) {
      params.push(tipe_karyawan);
      query += ` AND e.tipe_karyawan = $${params.length}`;
    }

    query += ` ORDER BY e.id ASC`;

    const { rows } = await pool.query(query, params);
    return NextResponse.json(rows);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      nama_fingerprint,
      nama_lengkap,
      department_id,
      position_id,
      tipe_karyawan,
      tipe_gaji,
      no_fingerprint,
      no_ktp,
      email,
      no_telepon,
      npwp,
      ptkp_status,
      tanggal_masuk,
      status,
      catatan,
      // Gaji Pokok awal
      gaji_pokok_harian,
      lembur_per_jam,
      tunjangan_km_tier1,
      tunjangan_km_tier2,
      tunjangan_km_tier3,
    } = body;

    if (!nama_fingerprint || !nama_lengkap || !department_id || !position_id || !tanggal_masuk) {
      return NextResponse.json({ error: "Nama Fingerprint, Nama Lengkap, Departemen, Jabatan, dan Tanggal Masuk wajib diisi" }, { status: 400 });
    }

    await client.query("BEGIN");

    // Auto-generate kode_karyawan if not provided
    const countRes = await client.query(`SELECT COUNT(*) FROM hr_employees`);
    const count = parseInt(countRes.rows[0].count, 10) + 1;
    const kode_karyawan = body.kode_karyawan || (tipe_gaji === "HARIAN_DRIVER" ? `DRV-${String(count).padStart(3, "0")}` : `EMP-${String(count).padStart(3, "0")}`);

    const empRes = await client.query(
      `INSERT INTO hr_employees (
        kode_karyawan, nama_fingerprint, nama_lengkap, department_id, position_id,
        tipe_karyawan, tipe_gaji, no_fingerprint, no_ktp, email, no_telepon,
        npwp, ptkp_status, tanggal_masuk, status, catatan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        kode_karyawan,
        nama_fingerprint.trim(),
        nama_lengkap.trim(),
        department_id,
        position_id,
        tipe_karyawan || "TETAP",
        tipe_gaji || "HARIAN_PRODUKSI",
        no_fingerprint || null,
        no_ktp || null,
        email || null,
        no_telepon || null,
        npwp || null,
        ptkp_status || "TK0",
        tanggal_masuk,
        status || "AKTIF",
        catatan || null,
      ]
    );

    const employee = empRes.rows[0];

    // Auto-create initial salary structure if provided
    if (gaji_pokok_harian !== undefined && gaji_pokok_harian !== null) {
      await client.query(
        `INSERT INTO hr_salary_structures (
          employee_id, effective_date, gaji_pokok_harian, lembur_per_jam,
          tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          employee.id,
          tanggal_masuk || new Date().toISOString().substring(0, 10),
          gaji_pokok_harian,
          lembur_per_jam || Math.round(gaji_pokok_harian / 8),
          tunjangan_km_tier1 || null,
          tunjangan_km_tier2 || null,
          tunjangan_km_tier3 || null,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
