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
         LEFT JOIN coa c ON c.id = $1
         WHERE kb.lini = 'siap_saji' 
           AND (
             kb.coa_id = $1 OR
             (c.kode_akun IN ('1-0001', '1-1001') AND kb.jenis = 'Kas') OR
             (c.kode_akun IN ('1-0002', '1-1002') AND (kb.nama_bank ILIKE '%BCA%' OR kb.nama_rekening ILIKE '%BCA%')) OR
             (c.kode_akun IN ('1-0003', '1-1003') AND (kb.nama_bank ILIKE '%MANDIRI%' OR kb.nama_rekening ILIKE '%MANDIRI%')) OR
             (c.kode_akun IN ('1-0004', '1-1004') AND (kb.nama_bank ILIKE '%CIMB%' OR kb.nama_rekening ILIKE '%CIMB%')) OR
             (c.nama_akun ILIKE '%' || COALESCE(kb.nama_bank, '') || '%' AND kb.nama_bank IS NOT NULL) OR
             (c.nama_akun ILIKE '%' || kb.nama_rekening || '%')
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
         LEFT JOIN coa c ON c.id = $1
         WHERE kb.lini = 'siap_saji' 
           AND (
             kb.coa_id = $1 OR
             (c.kode_akun IN ('1-0001', '1-1001') AND kb.jenis = 'Kas') OR
             (c.kode_akun IN ('1-0002', '1-1002') AND (kb.nama_bank ILIKE '%BCA%' OR kb.nama_rekening ILIKE '%BCA%')) OR
             (c.kode_akun IN ('1-0003', '1-1003') AND (kb.nama_bank ILIKE '%MANDIRI%' OR kb.nama_rekening ILIKE '%MANDIRI%')) OR
             (c.kode_akun IN ('1-0004', '1-1004') AND (kb.nama_bank ILIKE '%CIMB%' OR kb.nama_rekening ILIKE '%CIMB%')) OR
             (c.nama_akun ILIKE '%' || COALESCE(kb.nama_bank, '') || '%' AND kb.nama_bank IS NOT NULL) OR
             (c.nama_akun ILIKE '%' || kb.nama_rekening || '%')
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

export async function PATCH(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { id, action, cancel_reason } = body;

    const journalId = Number(id);
    if (!journalId) {
      return NextResponse.json({ error: "ID jurnal wajib disertakan." }, { status: 400 });
    }

    if (action === "cancel") {
      const reason = cancel_reason ? String(cancel_reason).trim() : "";
      if (reason.length < 5) {
        return NextResponse.json(
          { error: "Alasan pembatalan jurnal wajib diisi (minimal 5 karakter)." },
          { status: 400 }
        );
      }

      await client.query("BEGIN");

      // 1. Fetch journal
      const jRes = await client.query(
        "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' FOR UPDATE",
        [journalId]
      );
      if (jRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Entri jurnal tidak ditemukan." }, { status: 404 });
      }

      const journal = jRes.rows[0];
      if (journal.status === "dibatalkan") {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Jurnal ini sudah dibatalkan sebelumnya." }, { status: 400 });
      }

      // 2. Rollback linked kas_mutasi and kas_bank saldo_kini
      const mutasiRes = await client.query(
        "SELECT * FROM kas_mutasi WHERE ref_type IN ('koreksi', 'biaya', 'pembelian') AND ref_id = $1",
        [journalId]
      );
      for (const m of mutasiRes.rows) {
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
        "DELETE FROM kas_mutasi WHERE ref_type IN ('koreksi', 'biaya', 'pembelian') AND ref_id = $1",
        [journalId]
      );

      // 3. Mark journal as cancelled and save cancel_reason
      const updatedRes = await client.query(
        `UPDATE journals 
         SET status = 'dibatalkan',
             cancel_reason = $1,
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [reason, journalId]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        message: "Jurnal umum berhasil dibatalkan.",
        data: updatedRes.rows[0],
      });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal membatalkan jurnal umum:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

