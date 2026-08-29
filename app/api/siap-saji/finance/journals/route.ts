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

    // If either account is linked to Kas/Bank, update Kas Mutasi as well
    const kasDebitCheck = await client.query("SELECT * FROM kas_bank WHERE coa_id = $1 LIMIT 1", [akun_debit]);
    const kasKreditCheck = await client.query("SELECT * FROM kas_bank WHERE coa_id = $1 LIMIT 1", [akun_kredit]);

    if (kasDebitCheck.rows.length > 0) {
      // Kas Masuk
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Masuk', $3, 'koreksi', $4, $5)`,
        [kasDebitCheck.rows[0].id, tgl, numNominal, journalRes.rows[0].id, `[JU] ${ketStr}`]
      );
    } else if (kasKreditCheck.rows.length > 0) {
      // Kas Keluar
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'koreksi', $4, $5)`,
        [kasKreditCheck.rows[0].id, tgl, numNominal, journalRes.rows[0].id, `[JU] ${ketStr}`]
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
