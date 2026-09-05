import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { periode_tahun, periode_bulan, user_id, catatan } = body;

    if (!periode_tahun || !periode_bulan) {
      return NextResponse.json({ error: "Periode Tahun dan Bulan wajib diisi" }, { status: 400 });
    }

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const nama_periode = `${monthNames[periode_bulan - 1]} ${periode_tahun}`;

    await client.query("BEGIN");

    // Fetch current active global rules
    const rulesRes = await client.query(`SELECT * FROM hr_payroll_rules ORDER BY berlaku_mulai DESC, id DESC LIMIT 1`);
    const globalRule = rulesRes.rows[0] || {
      potongan_terlambat_aktif: false,
      potongan_mode: "PER_MENIT",
      potongan_tarif_per_menit: 0,
      potongan_tarif_per_kejadian: 0,
      potongan_toleransi_menit: 0,
      potongan_maks_per_hari: 0,
      lembur_maks_aktif: false,
      lembur_maks_jam_per_hari: 0,
      lembur_maks_jam_per_bulan: 0,
      lembur_perilaku_melewati: "TANDAI_SAJA",
    };

    // Upsert payroll header
    const payrollRes = await client.query(
      `INSERT INTO hr_payrolls (
        periode_tahun, periode_bulan, nama_periode, status, rules_snapshot, catatan, dihitung_oleh, dihitung_pada
      ) VALUES ($1, $2, $3, 'DRAFT', $4::jsonb, $5, $6, NOW())
      ON CONFLICT (periode_tahun, periode_bulan) DO UPDATE SET
        status = 'DRAFT',
        rules_snapshot = EXCLUDED.rules_snapshot,
        catatan = EXCLUDED.catatan,
        dihitung_oleh = EXCLUDED.dihitung_oleh,
        dihitung_pada = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [periode_tahun, periode_bulan, nama_periode, JSON.stringify(globalRule), catatan || null, user_id || 1]
    );
    const payroll = payrollRes.rows[0];

    // Fetch all active employees
    const empRes = await client.query(
      `SELECT e.*, 
              d.nama as department_nama, p.nama as position_nama,
              s.gaji_pokok_harian, s.lembur_per_jam, s.tunjangan_tetap,
              s.tunjangan_km_tier1, s.tunjangan_km_tier2, s.tunjangan_km_tier3
       FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.department_id
       LEFT JOIN hr_positions p ON p.id = e.position_id
       LEFT JOIN LATERAL (
         SELECT * FROM hr_salary_structures ss
         WHERE ss.employee_id = e.id AND ss.effective_date <= MAKE_DATE($1, $2, 1)
         ORDER BY ss.effective_date DESC LIMIT 1
       ) s ON true
       WHERE e.status = 'AKTIF'`,
      [periode_tahun, periode_bulan]
    );

    const employees = empRes.rows;
    let totalKaryawan = 0;
    let totalGajiKotor = 0;
    let totalGajiBersih = 0;
    let totalPotongan = 0;

    for (const emp of employees) {
      // Check employee rule override
      const overrideRes = await client.query(
        `SELECT * FROM hr_payroll_rule_overrides
         WHERE employee_id = $1 AND berlaku_mulai <= MAKE_DATE($2, $3, 1)
           AND (berlaku_sampai IS NULL OR berlaku_sampai >= MAKE_DATE($2, $3, 1))
         ORDER BY berlaku_mulai DESC LIMIT 1`,
        [emp.id, periode_tahun, periode_bulan]
      );
      const override = overrideRes.rows[0] || {};

      // Effective Rule Snapshot for this employee
      const effectiveRule = {
        potongan_terlambat_aktif: override.potongan_terlambat_aktif ?? globalRule.potongan_terlambat_aktif,
        potongan_mode: globalRule.potongan_mode,
        potongan_tarif_per_menit: override.potongan_tarif_per_menit ?? globalRule.potongan_tarif_per_menit,
        potongan_tarif_per_kejadian: override.potongan_tarif_per_kejadian ?? globalRule.potongan_tarif_per_kejadian,
        potongan_toleransi_menit: globalRule.potongan_toleransi_menit,
        potongan_maks_per_hari: globalRule.potongan_maks_per_hari,
        lembur_maks_aktif: override.lembur_maks_aktif ?? globalRule.lembur_maks_aktif,
        lembur_maks_jam_per_hari: override.lembur_maks_jam_per_hari ?? globalRule.lembur_maks_jam_per_hari,
        lembur_maks_jam_per_bulan: override.lembur_maks_jam_per_bulan ?? globalRule.lembur_maks_jam_per_bulan,
        lembur_perilaku_melewati: override.lembur_perilaku_melewati ?? globalRule.lembur_perilaku_melewati,
      };

      // Aggregates from hr_attendances for this period
      const attSummaryRes = await client.query(
        `SELECT 
           COUNT(*) FILTER (WHERE keterangan = 'HADIR') as hari_hadir,
           COUNT(*) FILTER (WHERE keterangan = 'ABSEN') as hari_absen,
           COUNT(*) FILTER (WHERE keterangan = 'CUTI') as hari_cuti,
           COUNT(*) FILTER (WHERE keterangan = 'SAKIT') as hari_sakit,
           COUNT(*) FILTER (WHERE keterangan = 'IZIN') as hari_izin,
           COUNT(*) FILTER (WHERE keterangan = 'DINAS') as hari_dinas,
           COALESCE(SUM(terlambat_menit), 0) as total_terlambat_menit,
           COALESCE(SUM(keluar_awal_menit), 0) as total_keluar_awal_menit,
           COUNT(*) FILTER (WHERE tidak_scan_lengkap = true) as total_tidak_scan_hari,
           COALESCE(SUM(lembur_menit), 0) as total_lembur_menit_aktual
         FROM hr_attendances
         WHERE employee_id = $1
           AND EXTRACT(YEAR FROM tanggal) = $2
           AND EXTRACT(MONTH FROM tanggal) = $3`,
        [emp.id, periode_tahun, periode_bulan]
      );
      const att = attSummaryRes.rows[0];

      const hariHadir = parseInt(att.hari_hadir || "0", 10);
      const hariAbsen = parseInt(att.hari_absen || "0", 10);
      const totalTerlambatMenit = parseInt(att.total_terlambat_menit || "0", 10);
      const totalLemburAktual = parseInt(att.total_lembur_menit_aktual || "0", 10);

      // Lembur Calculation
      let totalLemburDiakui = totalLemburAktual;
      let lemburMelewatiBatas = false;

      if (effectiveRule.lembur_maks_aktif && Number(effectiveRule.lembur_maks_jam_per_bulan) > 0) {
        const maxLemburMenitBulan = Number(effectiveRule.lembur_maks_jam_per_bulan) * 60;
        if (totalLemburAktual > maxLemburMenitBulan) {
          lemburMelewatiBatas = true;
          if (effectiveRule.lembur_perilaku_melewati === "POTONG") {
            totalLemburDiakui = maxLemburMenitBulan;
          }
        }
      }

      // Potongan Terlambat Calculation
      let potonganTerlambat = 0;
      if (effectiveRule.potongan_terlambat_aktif) {
        if (effectiveRule.potongan_mode === "PER_MENIT") {
          const menitNetto = Math.max(0, totalTerlambatMenit - (effectiveRule.potongan_toleransi_menit || 0));
          potonganTerlambat = menitNetto * Number(effectiveRule.potongan_tarif_per_menit || 0);
        } else if (effectiveRule.potongan_mode === "PER_KEJADIAN") {
          potonganTerlambat = Number(effectiveRule.potongan_tarif_per_kejadian || 0);
        }
      }

      const gajiPokokHarian = Number(emp.gaji_pokok_harian || 0);
      const lemburPerJam = Number(emp.lembur_per_jam || Math.round(gajiPokokHarian / 8));
      const subtotalGajiPokok = gajiPokokHarian * hariHadir;
      const jamLemburDiakuiDecimal = totalLemburDiakui / 60;
      const subtotalLembur = Math.round(lemburPerJam * jamLemburDiakuiDecimal);

      const totalPendapatan = subtotalGajiPokok + subtotalLembur;
      const totalPotonganEmp = potonganTerlambat;
      const gajiKotor = totalPendapatan - potonganTerlambat;
      const gajiBersih = gajiKotor;

      totalKaryawan++;
      totalGajiKotor += gajiKotor;
      totalGajiBersih += gajiBersih;
      totalPotongan += totalPotonganEmp;

      // Upsert detail
      await client.query(
        `INSERT INTO hr_payroll_details (
          payroll_id, employee_id, snapshot_nama, snapshot_jabatan, snapshot_departemen, snapshot_tipe_gaji,
          hari_kerja_jadwal, hari_hadir, hari_absen, hari_cuti, hari_sakit, hari_izin, hari_dinas,
          total_terlambat_menit, total_keluar_awal_menit, total_tidak_scan_hari,
          total_lembur_menit_aktual, total_lembur_menit_diakui, lembur_melewati_batas,
          gaji_pokok_harian_snapshot, lembur_per_jam_snapshot,
          subtotal_gaji_pokok, subtotal_lembur, total_pendapatan,
          potongan_terlambat, total_potongan, gaji_kotor, gaji_bersih, rules_snapshot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb)
        ON CONFLICT (payroll_id, employee_id) DO UPDATE SET
          snapshot_nama = EXCLUDED.snapshot_nama,
          snapshot_jabatan = EXCLUDED.snapshot_jabatan,
          snapshot_departemen = EXCLUDED.snapshot_departemen,
          snapshot_tipe_gaji = EXCLUDED.snapshot_tipe_gaji,
          hari_hadir = EXCLUDED.hari_hadir,
          hari_absen = EXCLUDED.hari_absen,
          total_terlambat_menit = EXCLUDED.total_terlambat_menit,
          total_lembur_menit_aktual = EXCLUDED.total_lembur_menit_aktual,
          total_lembur_menit_diakui = EXCLUDED.total_lembur_menit_diakui,
          lembur_melewati_batas = EXCLUDED.lembur_melewati_batas,
          gaji_pokok_harian_snapshot = EXCLUDED.gaji_pokok_harian_snapshot,
          lembur_per_jam_snapshot = EXCLUDED.lembur_per_jam_snapshot,
          subtotal_gaji_pokok = EXCLUDED.subtotal_gaji_pokok,
          subtotal_lembur = EXCLUDED.subtotal_lembur,
          total_pendapatan = EXCLUDED.total_pendapatan,
          potongan_terlambat = EXCLUDED.potongan_terlambat,
          total_potongan = EXCLUDED.total_potongan,
          gaji_kotor = EXCLUDED.gaji_kotor,
          gaji_bersih = EXCLUDED.gaji_bersih,
          rules_snapshot = EXCLUDED.rules_snapshot,
          updated_at = NOW()`,
        [
          payroll.id,
          emp.id,
          emp.nama_lengkap,
          emp.position_nama || "-",
          emp.department_nama || "-",
          emp.tipe_gaji,
          hariHadir + hariAbsen,
          hariHadir,
          hariAbsen,
          parseInt(att.hari_cuti || "0", 10),
          parseInt(att.hari_sakit || "0", 10),
          parseInt(att.hari_izin || "0", 10),
          parseInt(att.hari_dinas || "0", 10),
          totalTerlambatMenit,
          parseInt(att.total_keluar_awal_menit || "0", 10),
          parseInt(att.total_tidak_scan_hari || "0", 10),
          totalLemburAktual,
          totalLemburDiakui,
          lemburMelewatiBatas,
          gajiPokokHarian,
          lemburPerJam,
          subtotalGajiPokok,
          subtotalLembur,
          totalPendapatan,
          potonganTerlambat,
          totalPotonganEmp,
          gajiKotor,
          gajiBersih,
          JSON.stringify(effectiveRule),
        ]
      );
    }

    // Update totals in header
    await client.query(
      `UPDATE hr_payrolls SET
        total_karyawan = $1,
        total_gaji_kotor = $2,
        total_gaji_bersih = $3,
        total_potongan = $4,
        updated_at = NOW()
       WHERE id = $5`,
      [totalKaryawan, totalGajiKotor, totalGajiBersih, totalPotongan, payroll.id]
    );

    await client.query("COMMIT");

    return NextResponse.json({
      message: `Payroll ${nama_periode} berhasil dihitung`,
      payroll_id: payroll.id,
      summary: {
        total_karyawan: totalKaryawan,
        total_gaji_kotor: totalGajiKotor,
        total_gaji_bersih: totalGajiBersih,
        total_potongan: totalPotongan,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
