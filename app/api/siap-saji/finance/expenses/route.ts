import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = ["j.lini = 'siap_saji'", "j.ref_type = 'biaya'"];
  const vals: any[] = [];
  let idx = 1;

  if (search.trim()) {
    wheres.push(`(j.ref_no ILIKE $${idx} OR j.keterangan ILIKE $${idx} OR c.nama_akun ILIKE $${idx} OR ck.nama_akun ILIKE $${idx})`);
    vals.push(`%${search.trim()}%`);
    idx++;
  }
  if (date_from) {
    wheres.push(`j.journal_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`j.journal_date <= $${idx}`);
    vals.push(date_to);
    idx++;
  }

  const whereSql = wheres.join(" AND ");

  const client = await pool.connect();
  try {
    const dataVals = [...vals, limit, offset];
    const limitIdx = vals.length + 1;
    const offsetIdx = vals.length + 2;

    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM journals j LEFT JOIN coa c ON j.akun_debit = c.id LEFT JOIN coa ck ON j.akun_kredit = ck.id WHERE ${whereSql}`, vals),
      client.query(
        `SELECT 
          j.*,
          c.nama_akun AS beban_nama,
          c.kode_akun AS beban_kode,
          ck.nama_akun AS kredit_nama
        FROM journals j
        LEFT JOIN coa c ON j.akun_debit = c.id
        LEFT JOIN coa ck ON j.akun_kredit = ck.id
        WHERE ${whereSql}
        ORDER BY j.journal_date DESC, j.id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        dataVals
      ),
    ]);

    const total = Number(countRes.rows[0].count);
    return NextResponse.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Gagal mengambil daftar biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { expense_date, keterangan, nominal, coa_id, kas_bank_id } = body;

  if (!expense_date || !keterangan || !nominal || !coa_id || !kas_bank_id) {
    return NextResponse.json(
      { error: "Tanggal, Keterangan, Nominal, Kategori Beban, dan Kas/Bank wajib diisi." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const amount = Number(nominal);

    // Resolve Kredit Account from kas_bank
    const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
    if (kbRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Rekening kas/bank tidak ditemukan" }, { status: 404 });
    }

    const bankName = kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening;
    let kreditKode = "1-1002";
    if (bankName.toUpperCase().includes("MANDIRI")) kreditKode = "1-1003";
    else if (bankName.toUpperCase().includes("KAS")) kreditKode = "1-1001";

    const coaKreditRes = await client.query("SELECT id FROM coa WHERE kode_akun = $1 AND lini = 'siap_saji' LIMIT 1", [kreditKode]);
    if (coaKreditRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Akun kas/bank di CoA tidak ditemukan" }, { status: 404 });
    }

    // Insert Journal
    const jRes = await client.query(
      `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
       VALUES ('siap_saji', $1, 'biaya', 0, 'EXPENSE', $2, $3, $4, $5)
       RETURNING *`,
      [
        expense_date,
        Number(coa_id),
        coaKreditRes.rows[0].id,
        amount,
        keterangan.trim(),
      ]
    );

    const journalId = jRes.rows[0].id;
    await client.query("UPDATE journals SET ref_id = $1 WHERE id = $1", [journalId]);

    // Record Kas Mutasi & Subtract Kas Balance
    await client.query(
      `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
       VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'biaya', $4, $5)`,
      [kas_bank_id, expense_date, amount, journalId, `Biaya Operasional: ${keterangan.trim()}`]
    );

    await client.query(
      "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
      [amount, kas_bank_id]
    );

    await client.query("COMMIT");
    return NextResponse.json(jRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
