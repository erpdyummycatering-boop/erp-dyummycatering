import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; detailId: string }> }) {
  const client = await pool.connect();
  try {
    const { id, detailId } = await params;
    const body = await req.json();

    const {
      tunjangan_km,
      km_perjalanan,
      tunjangan_bonus,
      tunjangan_tetap,
      pembulatan,
      potongan_lain,
      override_lembur_diakui,
      override_potongan_terlambat,
      catatan_payroll,
    } = body;

    await client.query("BEGIN");

    // Fetch detail
    const detailRes = await client.query(`SELECT * FROM hr_payroll_details WHERE id = $1 AND payroll_id = $2`, [detailId, id]);
    if (detailRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Detail payroll tidak ditemukan" }, { status: 404 });
    }

    const d = detailRes.rows[0];

    const subtotalGajiPokok = Number(d.subtotal_gaji_pokok || 0);
    const lemburPerJam = Number(d.lembur_per_jam_snapshot || 0);

    const totalLemburMenit = override_lembur_diakui !== undefined && override_lembur_diakui !== null ? Number(override_lembur_diakui) : Number(d.total_lembur_menit_diakui || 0);
    const subtotalLembur = Math.round(lemburPerJam * (totalLemburMenit / 60));

    const kmVal = tunjangan_km !== undefined ? Number(tunjangan_km) : Number(d.tunjangan_km || 0);
    const bonusVal = tunjangan_bonus !== undefined ? Number(tunjangan_bonus) : Number(d.tunjangan_bonus || 0);
    const tetapVal = tunjangan_tetap !== undefined ? Number(tunjangan_tetap) : Number(d.tunjangan_tetap || 0);
    const bulatVal = pembulatan !== undefined ? Number(pembulatan) : Number(d.pembulatan || 0);

    const totalPendapatan = subtotalGajiPokok + subtotalLembur + kmVal + bonusVal + tetapVal + bulatVal;

    const potTerlambat = override_potongan_terlambat !== undefined && override_potongan_terlambat !== null ? Number(override_potongan_terlambat) : Number(d.potongan_terlambat || 0);
    const potLain = potongan_lain !== undefined ? Number(potongan_lain) : Number(d.potongan_lain || 0);
    const totalPotongan = potTerlambat + potLain;

    const gajiKotor = totalPendapatan - potTerlambat;
    const gajiBersih = gajiKotor - potLain;

    const updateRes = await client.query(
      `UPDATE hr_payroll_details SET
        subtotal_lembur = $1,
        tunjangan_km = $2,
        km_perjalanan = COALESCE($3, km_perjalanan),
        tunjangan_bonus = $4,
        tunjangan_tetap = $5,
        pembulatan = $6,
        total_pendapatan = $7,
        potongan_terlambat = $8,
        potongan_lain = $9,
        total_potongan = $10,
        gaji_kotor = $11,
        gaji_bersih = $12,
        override_lembur_diakui = $13,
        override_potongan_terlambat = $14,
        catatan_payroll = COALESCE($15, catatan_payroll),
        updated_at = NOW()
       WHERE id = $16 AND payroll_id = $17
       RETURNING *`,
      [
        subtotalLembur,
        kmVal,
        km_perjalanan || null,
        bonusVal,
        tetapVal,
        bulatVal,
        totalPendapatan,
        potTerlambat,
        potLain,
        totalPotongan,
        gajiKotor,
        gajiBersih,
        override_lembur_diakui ?? null,
        override_potongan_terlambat ?? null,
        catatan_payroll || null,
        detailId,
        id,
      ]
    );

    // Recalculate header totals
    await client.query(
      `UPDATE hr_payrolls SET
        total_gaji_kotor = (SELECT COALESCE(SUM(gaji_kotor), 0) FROM hr_payroll_details WHERE payroll_id = $1),
        total_gaji_bersih = (SELECT COALESCE(SUM(gaji_bersih), 0) FROM hr_payroll_details WHERE payroll_id = $1),
        total_potongan = (SELECT COALESCE(SUM(total_potongan), 0) FROM hr_payroll_details WHERE payroll_id = $1),
        updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");
    return NextResponse.json(updateRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
