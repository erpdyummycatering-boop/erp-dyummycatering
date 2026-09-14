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
      subtotal_lembur_pagi,
      potongan_tabungan,
      rincian_potongan, // array of { nama: string, nominal: number }
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
    const lemburPagiVal = subtotal_lembur_pagi !== undefined ? Number(subtotal_lembur_pagi) : Number(d.subtotal_lembur_pagi || 0);

    const kmVal = tunjangan_km !== undefined ? Number(tunjangan_km) : Number(d.tunjangan_km || 0);
    const bonusVal = tunjangan_bonus !== undefined ? Number(tunjangan_bonus) : Number(d.tunjangan_bonus || 0);
    const tetapVal = tunjangan_tetap !== undefined ? Number(tunjangan_tetap) : Number(d.tunjangan_tetap || 0);
    const bulatVal = pembulatan !== undefined ? Number(pembulatan) : Number(d.pembulatan || 0);

    const totalPendapatan = subtotalGajiPokok + subtotalLembur + lemburPagiVal + kmVal + bonusVal + tetapVal + bulatVal;

    const potTerlambat = override_potongan_terlambat !== undefined && override_potongan_terlambat !== null ? Number(override_potongan_terlambat) : Number(d.potongan_terlambat || 0);
    const potTabungan = potongan_tabungan !== undefined ? Number(potongan_tabungan) : Number(d.potongan_tabungan || 0);
    
    // Total from flexible rincian_potongan if provided
    let rincianList = Array.isArray(rincian_potongan) ? rincian_potongan : (Array.isArray(d.rincian_potongan) ? d.rincian_potongan : []);
    const sumRincian = rincianList.reduce((acc: number, item: any) => acc + (Number(item.nominal) || 0), 0);
    const potLain = potongan_lain !== undefined ? Number(potongan_lain) : (sumRincian > 0 ? sumRincian : Number(d.potongan_lain || 0));

    const totalPotongan = potTerlambat + potTabungan + potLain;

    const gajiKotor = totalPendapatan - potTerlambat;
    const gajiBersih = gajiKotor - potTabungan - potLain;

    const updateRes = await client.query(
      `UPDATE hr_payroll_details SET
        subtotal_lembur = $1,
        subtotal_lembur_pagi = $2,
        tunjangan_km = $3,
        km_perjalanan = COALESCE($4, km_perjalanan),
        tunjangan_bonus = $5,
        tunjangan_tetap = $6,
        pembulatan = $7,
        total_pendapatan = $8,
        potongan_terlambat = $9,
        potongan_tabungan = $10,
        potongan_lain = $11,
        rincian_potongan = $12::jsonb,
        total_potongan = $13,
        gaji_kotor = $14,
        gaji_bersih = $15,
        override_lembur_diakui = $16,
        override_potongan_terlambat = $17,
        catatan_payroll = COALESCE($18, catatan_payroll),
        updated_at = NOW()
       WHERE id = $19 AND payroll_id = $20
       RETURNING *`,
      [
        subtotalLembur,
        lemburPagiVal,
        kmVal,
        km_perjalanan || null,
        bonusVal,
        tetapVal,
        bulatVal,
        totalPendapatan,
        potTerlambat,
        potTabungan,
        potLain,
        JSON.stringify(rincianList),
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
