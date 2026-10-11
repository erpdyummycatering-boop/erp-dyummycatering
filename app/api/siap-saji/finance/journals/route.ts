import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { journal_date, ref_no, akun_debit, akun_kredit, nominal, keterangan } = body;

    const numNominal = Number(nominal);
    if (!akun_debit || !akun_kredit || isNaN(numNominal) || numNominal <= 0) {
      return NextResponse.json(
        { error: "Akun debet, akun kredit, dan nominal valid wajib diisi." },
        { status: 400 }
      );
    }

    if (Number(akun_debit) === Number(akun_kredit)) {
      return NextResponse.json(
        { error: "Akun Debet dan Akun Kredit tidak boleh sama." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const tgl = journal_date || new Date().toISOString().split("T")[0];
    const refStr = ref_no ? String(ref_no).trim() : `JU-${Date.now()}`;
    const ketStr = keterangan ? String(keterangan).trim() : "Jurnal Umum Manual";

    // Insert Manual Journal Entry into journals table
    const journalRes = await client.query(
      `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
       VALUES ('siap_saji', $1, 'koreksi', 0, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tgl, refStr, Number(akun_debit), Number(akun_kredit), numNominal, ketStr]
    );

    // If either account is linked to Kas/Bank, update Kas Mutasi and update saldo_kini as well
    const findKasBankByCoaId = async (coaId: number) => {
      const res = await client.query(
        `SELECT kb.* 
         FROM kas_bank kb
         JOIN coa c ON c.id = $1
         WHERE kb.lini = 'siap_saji' 
           AND (
             (c.kode_akun = '1-1001' AND kb.jenis = 'Kas') OR
             (c.kode_akun = '1-1002' AND (kb.nama_bank ILIKE '%BCA%' OR kb.nama_rekening ILIKE '%BCA%')) OR
             (c.kode_akun = '1-1003' AND (kb.nama_bank ILIKE '%MANDIRI%' OR kb.nama_rekening ILIKE '%MANDIRI%'))
           )
         LIMIT 1`,
        [coaId]
      );
      return res.rows[0] || null;
    };

    const kasDebit = await findKasBankByCoaId(Number(akun_debit));
    const kasKredit = await findKasBankByCoaId(Number(akun_kredit));

    if (kasDebit) {
      // Kas Masuk (Debit Kas/Bank)
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Masuk', $3, 'koreksi', $4, $5)`,
        [kasDebit.id, tgl, numNominal, journalRes.rows[0].id, `[JU] ${ketStr}`]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kasDebit.id]
      );
    }
    
    if (kasKredit) {
      // Kas Keluar (Kredit Kas/Bank)
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'koreksi', $4, $5)`,
        [kasKredit.id, tgl, numNominal, journalRes.rows[0].id, `[JU] ${ketStr}`]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kasKredit.id]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Entri Jurnal Umum manual berhasil disimpan!",
      data: journalRes.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menyimpan jurnal umum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { id, journal_date, ref_no, akun_debit, akun_kredit, nominal, keterangan } = body;

    const journalId = Number(id);
    const numNominal = Number(nominal);
    if (!journalId || !akun_debit || !akun_kredit || isNaN(numNominal) || numNominal <= 0) {
      return NextResponse.json(
        { error: "ID jurnal, akun debet, akun kredit, dan nominal valid wajib diisi." },
        { status: 400 }
      );
    }

    if (Number(akun_debit) === Number(akun_kredit)) {
      return NextResponse.json(
        { error: "Akun Debet dan Akun Kredit tidak boleh sama." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 1. Fetch existing journal entry
    const existingRes = await client.query(
      "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' FOR UPDATE",
      [journalId]
    );

    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Entri jurnal tidak ditemukan." }, { status: 404 });
    }

    const oldJournal = existingRes.rows[0];
    const tgl = journal_date || oldJournal.journal_date;
    const refStr = ref_no ? String(ref_no).trim() : oldJournal.ref_no;
    const ketStr = keterangan ? String(keterangan).trim() : oldJournal.keterangan;

    // Helper: Find linked kas/bank
    const findKasBankByCoaId = async (coaId: number) => {
      const res = await client.query(
        `SELECT kb.* 
         FROM kas_bank kb
         JOIN coa c ON c.id = $1
         WHERE kb.lini = 'siap_saji' 
           AND (
             (c.kode_akun = '1-1001' AND kb.jenis = 'Kas') OR
             (c.kode_akun = '1-1002' AND (kb.nama_bank ILIKE '%BCA%' OR kb.nama_rekening ILIKE '%BCA%')) OR
             (c.kode_akun = '1-1003' AND (kb.nama_bank ILIKE '%MANDIRI%' OR kb.nama_rekening ILIKE '%MANDIRI%'))
           )
         LIMIT 1`,
        [coaId]
      );
      return res.rows[0] || null;
    };

    // 2. Revert previous kas_mutasi & saldo_kini if this journal generated mutasi
    const oldMutasiRes = await client.query(
      "SELECT * FROM kas_mutasi WHERE ref_type = 'koreksi' AND ref_id = $1",
      [journalId]
    );

    for (const m of oldMutasiRes.rows) {
      if (m.jenis === "Masuk") {
        await client.query(
          "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
          [Number(m.nominal), m.kas_bank_id]
        );
      } else if (m.jenis === "Keluar") {
        await client.query(
          "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
          [Number(m.nominal), m.kas_bank_id]
        );
      }
    }
    await client.query(
      "DELETE FROM kas_mutasi WHERE ref_type = 'koreksi' AND ref_id = $1",
      [journalId]
    );

    // 3. Update journal record
    const updatedJournalRes = await client.query(
      `UPDATE journals 
       SET journal_date = $1,
           ref_no = $2,
           akun_debit = $3,
           akun_kredit = $4,
           nominal = $5,
           keterangan = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [tgl, refStr, Number(akun_debit), Number(akun_kredit), numNominal, ketStr, journalId]
    );

    // 4. Create new kas_mutasi and update saldo_kini if applicable
    const kasDebit = await findKasBankByCoaId(Number(akun_debit));
    const kasKredit = await findKasBankByCoaId(Number(akun_kredit));

    if (kasDebit) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Masuk', $3, 'koreksi', $4, $5)`,
        [kasDebit.id, tgl, numNominal, journalId, `[JU] ${ketStr}`]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kasDebit.id]
      );
    }

    if (kasKredit) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'koreksi', $4, $5)`,
        [kasKredit.id, tgl, numNominal, journalId, `[JU] ${ketStr}`]
      );
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [numNominal, kasKredit.id]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      message: "Entri Jurnal Umum berhasil diperbarui!",
      data: updatedJournalRes.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mengupdate jurnal umum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

