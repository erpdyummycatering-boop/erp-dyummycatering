import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const {
      kas_bank_id,
      target_kas_bank_id,
      jenis,
      nominal,
      biaya_admin,
      mutasi_date,
      keterangan,
      target_account_id,
    } = body;

    const numNominal = Number(nominal);
    const numAdmin = Number(biaya_admin || 0);

    if (!kas_bank_id || !jenis || isNaN(numNominal) || numNominal <= 0) {
      return NextResponse.json(
        { error: "Rekening kas/bank, jenis mutasi, dan nominal valid wajib diisi." },
        { status: 400 }
      );
    }

    if (jenis === "Transfer") {
      if (!target_kas_bank_id) {
        return NextResponse.json(
          { error: "Pilih rekening tujuan transfer." },
          { status: 400 }
        );
      }
      if (Number(kas_bank_id) === Number(target_kas_bank_id)) {
        return NextResponse.json(
          { error: "Rekening asal dan rekening tujuan tidak boleh sama." },
          { status: 400 }
        );
      }
    }

    await client.query("BEGIN");

    // 1. Get Sumber Kas/Bank info & linked COA account
    const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
    if (kbRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Rekening Kas/Bank sumber tidak ditemukan." }, { status: 404 });
    }
    const kasBank = kbRes.rows[0];

    // Find linked COA for Sumber Kas/Bank
    let kasCoaId: number | null = kasBank.coa_id ? Number(kasBank.coa_id) : null;
    if (!kasCoaId) {
      const bName = ((kasBank.nama_bank || "") + " " + (kasBank.nama_rekening || "")).toUpperCase();
      const fallbackRes = await client.query(
        `SELECT id FROM coa 
         WHERE lini = 'siap_saji' 
           AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
         ORDER BY id ASC LIMIT 1`,
        [`%${bName}%`]
      );
      if (fallbackRes.rows.length > 0) kasCoaId = fallbackRes.rows[0].id;
    }

    const tgl = mutasi_date || new Date().toISOString().split("T")[0];

    // ── KONDISI KHUSUS: TRANSFER ANTAR REKENING ──
    if (jenis === "Transfer") {
      const kbTujuanRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [target_kas_bank_id]);
      if (kbTujuanRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Rekening Kas/Bank tujuan tidak ditemukan." }, { status: 404 });
      }
      const kasBankTujuan = kbTujuanRes.rows[0];

      let targetCoaId: number | null = kasBankTujuan.coa_id ? Number(kasBankTujuan.coa_id) : null;
      if (!targetCoaId) {
        const bName = ((kasBankTujuan.nama_bank || "") + " " + (kasBankTujuan.nama_rekening || "")).toUpperCase();
        const fallbackRes = await client.query(
          `SELECT id FROM coa 
           WHERE lini = 'siap_saji' 
             AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
           ORDER BY id ASC LIMIT 1`,
          [`%${bName}%`]
        );
        if (fallbackRes.rows.length > 0) targetCoaId = fallbackRes.rows[0].id;
      }

      const totalDipotongDariAsal = numNominal + numAdmin;
      const defaultKet = `Transfer dari ${kasBank.nama_rekening || kasBank.nama_bank} ke ${kasBankTujuan.nama_rekening || kasBankTujuan.nama_bank}`;
      const ketFinal = keterangan ? String(keterangan).trim() : defaultKet;

      // 1. Mutasi Keluar pada Rekening Asal
      const mutasiAsalRes = await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'transfer', $4)
         RETURNING *`,
        [kas_bank_id, tgl, totalDipotongDariAsal, ketFinal]
      );
      const mutasiAsalId = mutasiAsalRes.rows[0].id;

      // 2. Mutasi Masuk pada Rekening Tujuan
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Masuk', $3, 'transfer', $4, $5)`,
        [target_kas_bank_id, tgl, numNominal, mutasiAsalId, ketFinal]
      );

      // 3. Update Saldo Kini kedua Rekening
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [totalDipotongDariAsal, kas_bank_id]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [numNominal, target_kas_bank_id]
      );

      // 4. Jurnal Pemindahan Saldo (Debet: Rekening Tujuan, Kredit: Rekening Asal)
      if (kasCoaId && targetCoaId) {
        await client.query(
          `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
           VALUES ('siap_saji', $1, 'transfer', $2, $3, $4, $5, $6, $7)`,
          [
            tgl,
            mutasiAsalId,
            `TRF-${mutasiAsalId}`,
            targetCoaId, // Debet: Rekening Tujuan bertambah
            kasCoaId,    // Kredit: Rekening Asal berkurang
            numNominal,
            ketFinal,
          ]
        );

        // Jika ada Biaya Admin Transfer
        if (numAdmin > 0) {
          const adminCoaRes = await client.query(
            "SELECT id FROM coa WHERE kode_akun = '8-8000' AND lini = 'siap_saji' LIMIT 1"
          );
          const adminCoaId = adminCoaRes.rows[0]?.id || target_account_id;
          if (adminCoaId) {
            await client.query(
              `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
               VALUES ('siap_saji', $1, 'biaya_admin', $2, $3, $4, $5, $6, $7)`,
              [
                tgl,
                mutasiAsalId,
                `ADM-${mutasiAsalId}`,
                adminCoaId, // Debet: Biaya Admin Bank
                kasCoaId,   // Kredit: Rekening Asal
                numAdmin,
                `Biaya Admin ${ketFinal}`,
              ]
            );
          }
        }
      }

      await client.query("COMMIT");

      return NextResponse.json({
        message: `Transfer saldo sebesar Rp ${numNominal.toLocaleString("id-ID")} berhasil!`,
        data: mutasiAsalRes.rows[0],
      });
    }

    // ── KONDISI KAS MASUK ATAU KAS KELUAR ──
    const ket = keterangan ? String(keterangan).trim() : (jenis === "Keluar" ? "Kas Keluar (Prive / Lainnya)" : "Kas Masuk (Modal / Lainnya)");

    // 2. Insert into kas_mutasi
    const mutasiRes = await client.query(
      `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, keterangan)
       VALUES ($1, 'siap_saji', $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        kas_bank_id,
        tgl,
        jenis,
        numNominal,
        jenis === "Keluar" ? "prive" : "modal",
        ket,
      ]
    );

    // Update Saldo Kini Kas/Bank
    if (jenis === "Masuk") {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kas_bank_id]
      );
    } else {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kas_bank_id]
      );
    }

    // 3. Resolve Target COA Account for Double-Entry Journal
    let resolvedTargetCoaId = target_account_id ? Number(target_account_id) : null;
    if (!resolvedTargetCoaId) {
      if (jenis === "Keluar") {
        // Default Prive Owner (3-2001)
        const priveCoa = await client.query("SELECT id FROM coa WHERE kode_akun = '3-2001' AND lini = 'siap_saji' LIMIT 1");
        resolvedTargetCoaId = priveCoa.rows[0]?.id;
      } else {
        // Default Modal Owner (3-1001)
        const modalCoa = await client.query("SELECT id FROM coa WHERE kode_akun = '3-1001' AND lini = 'siap_saji' LIMIT 1");
        resolvedTargetCoaId = modalCoa.rows[0]?.id;
      }
    }

    // 4. Create Double-Entry Journal
    if (kasCoaId && resolvedTargetCoaId) {
      let akunDebit = kasCoaId;
      let akunKredit = resolvedTargetCoaId;

      if (jenis === "Keluar") {
        // Debet: Prive/Target Account, Kredit: Kas/Bank Account
        akunDebit = resolvedTargetCoaId;
        akunKredit = kasCoaId;
      }

      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
         VALUES ('siap_saji', $1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tgl,
          jenis === "Keluar" ? "prive" : "modal",
          mutasiRes.rows[0].id,
          `KM-${mutasiRes.rows[0].id}`,
          akunDebit,
          akunKredit,
          numNominal,
          ket,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      message: `Mutasi Kas ${jenis} berhasil dicatat!`,
      data: mutasiRes.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat mutasi kas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
