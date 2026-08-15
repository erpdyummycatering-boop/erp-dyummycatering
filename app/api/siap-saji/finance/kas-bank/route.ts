import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const kas_bank_id = p.get("kas_bank_id") || "";
  const search = p.get("search") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";
  const jenis = p.get("jenis") || "";

  const wheres: string[] = ["km.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (kas_bank_id) {
    wheres.push(`km.kas_bank_id = $${idx}`);
    vals.push(Number(kas_bank_id));
    idx++;
  }
  if (search.trim()) {
    wheres.push(`(km.keterangan ILIKE $${idx} OR kb.nama_rekening ILIKE $${idx})`);
    vals.push(`%${search.trim()}%`);
    idx++;
  }
  if (date_from) {
    wheres.push(`km.mutasi_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`km.mutasi_date <= $${idx}`);
    vals.push(date_to);
    idx++;
  }
  if (jenis) {
    wheres.push(`km.jenis = $${idx}`);
    vals.push(jenis);
    idx++;
  }

  const whereSql = wheres.join(" AND ");

  const client = await pool.connect();
  try {
    const [accountsRes, mutasiRes, coaRes] = await Promise.all([
      client.query("SELECT * FROM kas_bank WHERE lini = 'siap_saji' ORDER BY is_payment_default DESC, id ASC"),
      client.query(
        `SELECT 
          km.*,
          kb.nama_rekening AS kas_bank_nama
        FROM kas_mutasi km
        JOIN kas_bank kb ON km.kas_bank_id = kb.id
        WHERE ${whereSql}
        ORDER BY km.mutasi_date DESC, km.id DESC
        LIMIT 100`,
        vals
      ),
      client.query("SELECT * FROM coa WHERE lini = 'siap_saji' AND is_active = true ORDER BY kode_akun"),
    ]);

    return NextResponse.json({
      accounts: accountsRes.rows,
      mutasi: mutasiRes.rows,
      coa: coaRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil data kas/bank:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nama_rekening, jenis, no_rekening, nama_bank, saldo_awal, is_payment_default } = body;

  if (!nama_rekening) {
    return NextResponse.json({ error: "Nama rekening wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const saldo = Number(saldo_awal || 0);

    const res = await client.query(
      `INSERT INTO kas_bank (lini, nama_rekening, jenis, no_rekening, nama_bank, saldo_awal, saldo_kini, is_payment_default)
       VALUES ('siap_saji', $1, $2, $3, $4, $5, $5, $6)
       RETURNING *`,
      [
        nama_rekening.trim(),
        jenis || "Bank",
        no_rekening || null,
        nama_bank || null,
        saldo,
        Boolean(is_payment_default),
      ]
    );

    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (error: any) {
    console.error("Gagal menambah akun kas/bank:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
