import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = ["pu.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (search.trim()) {
    wheres.push(`(pu.nota_ref ILIKE $${idx} OR pu.keterangan ILIKE $${idx} OR c.nama_akun ILIKE $${idx} OR kb.nama_rekening ILIKE $${idx})`);
    vals.push(`%${search.trim()}%`);
    idx++;
  }
  if (date_from) {
    wheres.push(`pu.purchase_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`pu.purchase_date <= $${idx}`);
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
      client.query(`SELECT COUNT(*) FROM purchases pu LEFT JOIN coa c ON pu.coa_id = c.id LEFT JOIN kas_bank kb ON pu.kas_bank_id = kb.id WHERE ${whereSql}`, vals),
      client.query(
        `SELECT 
          pu.*,
          c.nama_akun AS coa_nama,
          c.kode_akun AS coa_kode,
          kb.nama_rekening AS kas_bank_nama,
          kb.no_rekening AS kas_bank_norek
        FROM purchases pu
        LEFT JOIN coa c ON pu.coa_id = c.id
        LEFT JOIN kas_bank kb ON pu.kas_bank_id = kb.id
        WHERE ${whereSql}
        ORDER BY pu.purchase_date DESC, pu.id DESC
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
    console.error("Gagal mengambil data nota pembelian HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  const body = await req.json();
  const { purchase_date, nota_ref, keterangan, total_amount, coa_id, kas_bank_id } = body;

  if (!purchase_date || !keterangan || !total_amount) {
    return NextResponse.json(
      { error: "Tanggal, Keterangan, dan Total Nominal wajib diisi." },
      { status: 400 }
    );
  }

  const isHutang = kas_bank_id === "hutang" || kas_bank_id === "0" || !kas_bank_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const amount = Number(total_amount);

    // Auto-generate nota_ref if left empty
    let finalNotaRef = nota_ref && nota_ref.trim() ? nota_ref.trim() : "";
    if (!finalNotaRef) {
      const dateClean = String(purchase_date).replace(/-/g, "");
      const randomSeq = String(Math.floor(100 + Math.random() * 900));
      finalNotaRef = `NOTA-SS-${dateClean}-${randomSeq}`;
    }

    // 1. Resolve HPP CoA (default to 5-1001 HPP Bahan Baku SS if not provided)
    let selectedCoaId = coa_id;
    if (!selectedCoaId) {
      const coaRes = await client.query("SELECT id FROM coa WHERE kode_akun = '5-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaRes.rows.length > 0) selectedCoaId = coaRes.rows[0].id;
    }

    // 2. Insert Purchases
    const insRes = await client.query(
      `INSERT INTO purchases (lini, ref_type, finance_id, purchase_date, nota_ref, keterangan, total_amount, coa_id, kas_bank_id, status)
       VALUES ('siap_saji', 'pembelian_nota', $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        purchase_date,
        finalNotaRef,
        keterangan.trim(),
        amount,
        selectedCoaId,
        isHutang ? null : Number(kas_bank_id),
        isHutang ? "Hutang" : "Final",
      ]
    );
    const purchaseId = insRes.rows[0].id;

    // 3. Resolve Credit Account (If Hutang -> 2-1001 Utang Usaha SS, else Kas/Bank)
    let coaKreditId: number | null = null;

    if (isHutang) {
      const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaUtangRes.rows.length > 0) coaKreditId = coaUtangRes.rows[0].id;
    } else {
      const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
      if (kbRes.rows.length > 0) {
        const bankName = kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening;
        let kreditKode = "1-1002";
        if (bankName.toUpperCase().includes("MANDIRI")) kreditKode = "1-1003";
        else if (bankName.toUpperCase().includes("KAS")) kreditKode = "1-1001";

        const coaKreditRes = await client.query("SELECT id FROM coa WHERE kode_akun = $1 AND lini = 'siap_saji' LIMIT 1", [kreditKode]);
        if (coaKreditRes.rows.length > 0) coaKreditId = coaKreditRes.rows[0].id;
      }
    }

    if (coaKreditId && selectedCoaId) {
      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan)
         VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7)`,
        [
          purchase_date,
          purchaseId,
          finalNotaRef,
          selectedCoaId,
          coaKreditId,
          amount,
          isHutang ? `Pembelian HPP (Hutang Usaha / Tempo): ${keterangan.trim()}` : `Pembelian HPP: ${keterangan.trim()}`,
        ]
      );
    }

    // 4. Record Kas Mutasi & Subtract Kas Balance ONLY if not Hutang
    if (!isHutang) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'pembelian', $4, $5)`,
        [kas_bank_id, purchase_date, amount, purchaseId, `Nota HPP ${finalNotaRef}: ${keterangan.trim()}`]
      );

      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [amount, kas_bank_id]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(insRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat nota pembelian HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
