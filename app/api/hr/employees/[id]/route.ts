import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const empRes = await pool.query(
      `SELECT e.*, 
              d.nama as department_nama, d.kode as department_kode,
              p.nama as position_nama, p.kode as position_kode
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.department_id
       LEFT JOIN hr_positions p ON p.id = e.position_id
       WHERE e.id = $1`,
      [id]
    );

    if (empRes.rows.length === 0) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }

    const employee = empRes.rows[0];

    // Fetch salary history
    const salaryRes = await pool.query(
      `SELECT * FROM hr_salary_structures WHERE employee_id = $1 ORDER BY effective_date DESC`,
      [id]
    );

    // Fetch payroll history (slips) for this employee
    const slipsRes = await pool.query(
      `SELECT pd.*, p.nama_periode, p.periode_tahun, p.periode_bulan, p.status as payroll_status
       FROM hr_payroll_details pd
       JOIN hr_payrolls p ON p.id = pd.payroll_id
       WHERE pd.employee_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    );

    return NextResponse.json({
      ...employee,
      salary_history: salaryRes.rows,
      payroll_history: slipsRes.rows,
      active_salary: salaryRes.rows[0] || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await req.json();

    const fields = [
      "kode_karyawan", "nama_fingerprint", "nama_lengkap", "department_id", "position_id",
      "tipe_karyawan", "tipe_gaji", "tipe_periode_gaji", "no_fingerprint", "no_ktp", "email", "no_telepon",
      "npwp", "ptkp_status", "bpjs_ketenagakerjaan", "bpjs_kesehatan",
      "tanggal_masuk", "tanggal_keluar", "status", "catatan"
    ];

    const updates: string[] = [];
    const values: any[] = [];

    fields.forEach((field) => {
      if (body[field] !== undefined) {
        values.push(body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    });

    const hasSalaryFields =
      body.gaji_pokok_harian !== undefined ||
      body.lembur_per_jam !== undefined ||
      body.tunjangan_km_tier1 !== undefined ||
      body.tunjangan_km_tier2 !== undefined ||
      body.tunjangan_km_tier3 !== undefined;

    if (updates.length === 0 && !hasSalaryFields) {
      return NextResponse.json({ error: "Tidak ada field yang diubah" }, { status: 400 });
    }

    await client.query("BEGIN");

    let updatedEmployee = null;
    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE hr_employees
        SET ${updates.join(", ")}, updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `;

      const empRes = await client.query(query, values);
      if (empRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
      }
      updatedEmployee = empRes.rows[0];
    } else {
      const empRes = await client.query(`SELECT * FROM hr_employees WHERE id = $1`, [id]);
      if (empRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
      }
      updatedEmployee = empRes.rows[0];
    }

    // Update / insert salary structure if salary fields are present
    if (hasSalaryFields) {
      const gajiPokok = body.gaji_pokok_harian !== undefined ? Number(body.gaji_pokok_harian) : null;
      const lembur = body.lembur_per_jam !== undefined 
        ? Number(body.lembur_per_jam) 
        : (gajiPokok ? Math.round(gajiPokok / 8) : 0);
      const tier1 = body.tunjangan_km_tier1 !== undefined ? (body.tunjangan_km_tier1 === "" ? null : Number(body.tunjangan_km_tier1)) : null;
      const tier2 = body.tunjangan_km_tier2 !== undefined ? (body.tunjangan_km_tier2 === "" ? null : Number(body.tunjangan_km_tier2)) : null;
      const tier3 = body.tunjangan_km_tier3 !== undefined ? (body.tunjangan_km_tier3 === "" ? null : Number(body.tunjangan_km_tier3)) : null;

      // Check if employee already has an active salary structure
      const existingSalaryRes = await client.query(
        `SELECT id FROM hr_salary_structures WHERE employee_id = $1 ORDER BY effective_date DESC LIMIT 1`,
        [id]
      );

      if (existingSalaryRes.rows.length > 0) {
        const salaryId = existingSalaryRes.rows[0].id;
        await client.query(
          `UPDATE hr_salary_structures
           SET gaji_pokok_harian = COALESCE($1, gaji_pokok_harian),
               lembur_per_jam = COALESCE($2, lembur_per_jam),
               tunjangan_km_tier1 = COALESCE($3, tunjangan_km_tier1),
               tunjangan_km_tier2 = COALESCE($4, tunjangan_km_tier2),
               tunjangan_km_tier3 = COALESCE($5, tunjangan_km_tier3)
           WHERE id = $6`,
          [gajiPokok, lembur, tier1, tier2, tier3, salaryId]
        );
      } else if (gajiPokok !== null) {
        await client.query(
          `INSERT INTO hr_salary_structures (
            employee_id, effective_date, gaji_pokok_harian, lembur_per_jam,
            tunjangan_km_tier1, tunjangan_km_tier2, tunjangan_km_tier3
          ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)`,
          [id, gajiPokok, lembur, tier1, tier2, tier3]
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(updatedEmployee);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { rows } = await pool.query(
      `UPDATE hr_employees SET status = 'NON_AKTIF', tanggal_keluar = CURRENT_DATE, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Karyawan telah dinonaktifkan", employee: rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
