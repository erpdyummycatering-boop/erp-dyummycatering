import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: Request) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      tipe_payroll = "PEKANAN", // 'PEKANAN' | 'BULANAN' | 'CUSTOM'
      tanggal_mulai,
      tanggal_selesai,
      periode_tahun,
      periode_bulan,
      nama_periode_input,
      tipe_periode_filter, // optional filter: 'PEKANAN', 'BULANAN', 'SEMUA'
      user_id,
      catatan,
    } = body;

    let startDate: string;
    let endDate: string;
    let namaPeriode: string;
    let pTahun: number | null = periode_tahun ? parseInt(periode_tahun, 10) : null;
    let pBulan: number | null = periode_bulan ? parseInt(periode_bulan, 10) : null;

    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    if (tipe_payroll === "BULANAN") {
      if (!pTahun || !pBulan) {
        return NextResponse.json({ error: "Periode Tahun dan Bulan wajib diisi untuk payroll bulanan" }, { status: 400 });
      }
      startDate = `${pTahun}-${String(pBulan).padStart(2, "0")}-01`;
      // Last day of month
      const lastDay = new Date(pTahun, pBulan, 0).getDate();
      endDate = `${pTahun}-${String(pBulan).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      namaPeriode = nama_periode_input || `Bulanan ${monthNames[pBulan - 1]} ${pTahun}`;
    } else {
      // PEKANAN or CUSTOM
      if (!tanggal_mulai || !tanggal_selesai) {
        return NextResponse.json({ error: "Tanggal mulai dan selesai wajib diisi" }, { status: 400 });
      }
      startDate = tanggal_mulai;
      endDate = tanggal_selesai;

      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      const day1 = d1.getDate();
      const month1 = monthNames[d1.getMonth()];
      const day2 = d2.getDate();
      const month2 = monthNames[d2.getMonth()];
      const year2 = d2.getFullYear();

      if (!pTahun) pTahun = year2;
      if (!pBulan) pBulan = d2.getMonth() + 1;

      if (tipe_payroll === "PEKANAN") {
        namaPeriode = nama_periode_input || `Pekan ${day1} ${month1} - ${day2} ${month2} ${year2}`;
      } else {
        namaPeriode = nama_periode_input || `Payroll ${day1} ${month1} - ${day2} ${month2} ${year2}`;
      }
    }

    await client.query("BEGIN");

    // Fetch active global rules
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

    // Insert new payroll header
    const payrollRes = await client.query(
      `INSERT INTO hr_payrolls (
        tipe_payroll, tanggal_mulai, tanggal_selesai, periode_tahun, periode_bulan,
        nama_periode, status, rules_snapshot, catatan, dihitung_oleh, dihitung_pada, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7::jsonb, $8, $9, NOW(), NOW(), NOW())
      RETURNING *`,
      [
        tipe_payroll,
        startDate,
        endDate,
        pTahun,
        pBulan,
        namaPeriode,
        JSON.stringify(globalRule),
        catatan || null,
        user_id || 1,
      ]
    );
    const payroll = payrollRes.rows[0];

    // Fetch employees matching active status and optional filter
    let empQuery = `
      SELECT e.*, 
             d.nama as department_nama, p.nama as position_nama,
             s.gaji_pokok_harian, s.lembur_per_jam, s.tunjangan_tetap,
             s.tunjangan_km_tier1, s.tunjangan_km_tier2, s.tunjangan_km_tier3
      FROM hr_employees e
      LEFT JOIN hr_departments d ON d.id = e.department_id
      LEFT JOIN hr_positions p ON p.id = e.position_id
      LEFT JOIN LATERAL (
        SELECT * FROM hr_salary_structures ss
        WHERE ss.employee_id = e.id AND ss.effective_date <= $1::date
        ORDER BY ss.effective_date DESC LIMIT 1
      ) s ON true
      WHERE e.status = 'AKTIF'
    `;
    const empParams: any[] = [endDate];

    if (tipe_periode_filter && tipe_periode_filter !== "SEMUA") {
      empParams.push(tipe_periode_filter);
      empQuery += ` AND e.tipe_periode_gaji = $${empParams.length}`;
    }

    empQuery += ` ORDER BY d.id ASC, e.nama_lengkap ASC`;

    const empRes = await client.query(empQuery, empParams);
    const employees = empRes.rows;

    let totalKaryawan = 0;
    let totalGajiKotor = 0;
    let totalGajiBersih = 0;
    let totalPotongan = 0;

    for (const emp of employees) {
      // Check employee rule override
      const overrideRes = await client.query(
        `SELECT * FROM hr_payroll_rule_overrides
         WHERE employee_id = $1 AND berlaku_mulai <= $2::date
           AND (berlaku_sampai IS NULL OR berlaku_sampai >= $3::date)
         ORDER BY berlaku_mulai DESC LIMIT 1`,
        [emp.id, endDate, startDate]
      );
      const override = overrideRes.rows[0] || {};

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

      // Fetch day-by-day attendance records for this date range
      const dailyAttRes = await client.query(
        `SELECT 
           tanggal,
           TO_CHAR(tanggal, 'TMDay') as nama_hari,
           jam_masuk,
           jam_keluar,
           COALESCE(durasi_kerja_menit, 0) as durasi_kerja_menit,
           COALESCE(terlambat_menit, 0) as terlambat_menit,
           COALESCE(lembur_menit, 0) as lembur_menit,
           COALESCE(lembur_pagi_menit, 0) as lembur_pagi_menit,
           COALESCE(bonus_harian, 0) as bonus_harian,
           keterangan,
           tidak_scan_lengkap,
           catatan
         FROM hr_attendances
         WHERE employee_id = $1 AND tanggal >= $2::date AND tanggal <= $3::date
         ORDER BY tanggal ASC`,
        [emp.id, startDate, endDate]
      );
      const dailyRecords = dailyAttRes.rows;

      const gajiPokokHarian = Number(emp.gaji_pokok_harian || 0);
      const lemburPerJam = Number(emp.lembur_per_jam || Math.round(gajiPokokHarian / 8));

      // Build daily snapshot
      let hariHadir = 0;
      let hariAbsen = 0;
      let hariCuti = 0;
      let hariSakit = 0;
      let hariIzin = 0;
      let hariDinas = 0;
      let totalTerlambatMenit = 0;
      let totalLemburMenit = 0;
      let totalLemburPagiMenit = 0;
      let totalBonusHarian = 0;
      let totalTidakScan = 0;

      const detailHarianArray = dailyRecords.map((rec) => {
        const isHadir = rec.keterangan === "HADIR";
        if (isHadir) hariHadir++;
        else if (rec.keterangan === "ABSEN") hariAbsen++;
        else if (rec.keterangan === "CUTI") hariCuti++;
        else if (rec.keterangan === "SAKIT") hariSakit++;
        else if (rec.keterangan === "IZIN") hariIzin++;
        else if (rec.keterangan === "DINAS") hariDinas++;

        if (rec.tidak_scan_lengkap) totalTidakScan++;
        totalTerlambatMenit += Number(rec.terlambat_menit || 0);
        totalLemburMenit += Number(rec.lembur_menit || 0);
        totalLemburPagiMenit += Number(rec.lembur_pagi_menit || 0);
        totalBonusHarian += Number(rec.bonus_harian || 0);

        const dailyGajiPokok = isHadir ? gajiPokokHarian : 0;

        return {
          tanggal: rec.tanggal.toISOString().substring(0, 10),
          hari: rec.nama_hari ? rec.nama_hari.trim() : "",
          jam_masuk: rec.jam_masuk || "-",
          jam_keluar: rec.jam_keluar || "-",
          jam_kerja_menit: rec.durasi_kerja_menit,
          jam_lembur_menit: rec.lembur_menit,
          jam_lembur_pagi_menit: rec.lembur_pagi_menit,
          gaji_pokok: dailyGajiPokok,
          bonus: Number(rec.bonus_harian || 0),
          keterangan: rec.keterangan,
        };
      });

      // Lembur Calculation
      let totalLemburDiakui = totalLemburMenit;
      let lemburMelewatiBatas = false;
      if (effectiveRule.lembur_maks_aktif && Number(effectiveRule.lembur_maks_jam_per_bulan) > 0) {
        const maxMenit = Number(effectiveRule.lembur_maks_jam_per_bulan) * 60;
        if (totalLemburMenit > maxMenit) {
          lemburMelewatiBatas = true;
          if (effectiveRule.lembur_perilaku_melewati === "POTONG") {
            totalLemburDiakui = maxMenit;
          }
        }
      }

      // Potongan Terlambat
      let potonganTerlambat = 0;
      if (effectiveRule.potongan_terlambat_aktif) {
        if (effectiveRule.potongan_mode === "PER_MENIT") {
          const menitNetto = Math.max(0, totalTerlambatMenit - (effectiveRule.potongan_toleransi_menit || 0));
          potonganTerlambat = menitNetto * Number(effectiveRule.potongan_tarif_per_menit || 0);
        } else if (effectiveRule.potongan_mode === "PER_KEJADIAN") {
          potonganTerlambat = Number(effectiveRule.potongan_tarif_per_kejadian || 0);
        }
      }

      const subtotalGajiPokok = gajiPokokHarian * hariHadir;
      const subtotalLembur = Math.round(lemburPerJam * (totalLemburDiakui / 60));
      const subtotalLemburPagi = Math.round(lemburPerJam * (totalLemburPagiMenit / 60));
      const subtotalBonus = totalBonusHarian;

      const totalPendapatan = subtotalGajiPokok + subtotalLembur + subtotalLemburPagi + subtotalBonus;
      const totalPotonganEmp = potonganTerlambat;
      const gajiKotor = totalPendapatan - potonganTerlambat;
      const gajiBersih = gajiKotor;

      totalKaryawan++;
      totalGajiKotor += gajiKotor;
      totalGajiBersih += gajiBersih;
      totalPotongan += totalPotonganEmp;

      await client.query(
        `INSERT INTO hr_payroll_details (
          payroll_id, employee_id, snapshot_nama, snapshot_jabatan, snapshot_departemen, snapshot_tipe_gaji,
          hari_kerja_jadwal, hari_hadir, hari_absen, hari_cuti, hari_sakit, hari_izin, hari_dinas,
          total_terlambat_menit, total_keluar_awal_menit, total_tidak_scan_hari,
          total_lembur_menit_aktual, total_lembur_menit_diakui, lembur_melewati_batas,
          gaji_pokok_harian_snapshot, lembur_per_jam_snapshot,
          subtotal_gaji_pokok, subtotal_lembur, subtotal_lembur_pagi, subtotal_bonus, tunjangan_bonus,
          total_pendapatan, potongan_terlambat, total_potongan, gaji_kotor, gaji_bersih,
          rules_snapshot, detail_harian
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, 0, $15,
          $16, $17, $18,
          $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30,
          $31::jsonb, $32::jsonb
        )`,
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
          hariCuti,
          hariSakit,
          hariIzin,
          hariDinas,
          totalTerlambatMenit,
          totalTidakScan,
          totalLemburMenit,
          totalLemburDiakui,
          lemburMelewatiBatas,
          gajiPokokHarian,
          lemburPerJam,
          subtotalGajiPokok,
          subtotalLembur,
          subtotalLemburPagi,
          subtotalBonus,
          subtotalBonus, // set initial tunjangan_bonus equal to subtotal_bonus
          totalPendapatan,
          potonganTerlambat,
          totalPotonganEmp,
          gajiKotor,
          gajiBersih,
          JSON.stringify(effectiveRule),
          JSON.stringify(detailHarianArray),
        ]
      );
    }

    // Update totals in payroll header
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
      message: `Payroll ${namaPeriode} berhasil dihitung`,
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
