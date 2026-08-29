import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { kas_bank_id, jenis, nominal, mutasi_date, keterangan, target_account_id } = body;

    const numNominal = Number(nominal);
    if (!kas_bank_id || !jenis || isNaN(numNominal) || numNominal <= 0) {
      return NextResponse.json(
        { error: "Rekening kas/bank, jenis mutasi, dan nominal valid wajib diisi." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Get Kas/Bank info & linked COA account
    const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
    if (kbRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Rekening Kas/Bank tidak ditemukan." }, { status: 404 });
    }
    const kasBank = kbRes.rows[0];

    // Find linked COA for this Kas/Bank
    let kasCoaId = kasBank.coa_id;
    if (!kasCoaId) {
      const coaKasRes = await client.query(
        "SELECT id FROM coa WHERE (kode_akun LIKE '1-100%' OR nama_akun ILIKE %kas%) AND lini = 'siap_saji' LIMIT 1"
      );
      kasCoaId = coaKasRes.rows[0]?.id;
    }

    const tgl = mutasi_date || new Date().toISOString().split("T")[0];
    const ket = keterangan ? String(keterangan).trim() : (jenis === "Keluar" ? "Kas Keluar (Prive / Lainya)" : "Kas Masuk (Modal / Lainnya)");

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
