import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const type = p.get("type") || "pl"; // pl | neraca | journals

  const client = await pool.connect();
  try {
    if (type === "pl") {
      const plRes = await client.query(
        "SELECT * FROM v_pl_summary WHERE lini = 'siap_saji' ORDER BY bulan DESC"
      );

      // Detailed breakdown by CoA
      const detailRes = await client.query(
        `SELECT 
          c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun,
          COALESCE(SUM(j.nominal), 0) AS total_nominal
        FROM coa c
        LEFT JOIN journals j ON (j.akun_debit = c.id OR j.akun_kredit = c.id) AND j.lini = 'siap_saji'
        WHERE c.lini = 'siap_saji'
        GROUP BY c.id, c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun
        ORDER BY c.kode_akun`
      );

      return NextResponse.json({
        summary: plRes.rows,
        details: detailRes.rows,
      });
    }

    if (type === "neraca") {
      const neracaRes = await client.query(
        "SELECT * FROM v_neraca_saldo WHERE lini = 'siap_saji' ORDER BY kode_akun"
      );
      return NextResponse.json(neracaRes.rows);
    }

    if (type === "journals") {
      const search = p.get("search") || "";
      const date_from = p.get("date_from") || "";
      const date_to = p.get("date_to") || "";
      const ref_type = p.get("ref_type") || "";

      const wheres: string[] = ["j.lini = 'siap_saji'"];
      const vals: any[] = [];
      let idx = 1;

      if (search.trim()) {
        wheres.push(`(j.ref_no ILIKE $${idx} OR j.keterangan ILIKE $${idx} OR cd.nama_akun ILIKE $${idx} OR ck.nama_akun ILIKE $${idx})`);
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
      if (ref_type) {
        wheres.push(`j.ref_type = $${idx}`);
        vals.push(ref_type);
        idx++;
      }

      const whereSql = wheres.join(" AND ");

      const journalsRes = await client.query(
        `SELECT 
          j.*,
          cd.kode_akun AS debit_kode, cd.nama_akun AS debit_nama,
          ck.kode_akun AS kredit_kode, ck.nama_akun AS kredit_nama
        FROM journals j
        LEFT JOIN coa cd ON j.akun_debit = cd.id
        LEFT JOIN coa ck ON j.akun_kredit = ck.id
        WHERE ${whereSql}
        ORDER BY j.journal_date DESC, j.id DESC
        LIMIT 100`,
        vals
      );
      return NextResponse.json(journalsRes.rows);
    }

    return NextResponse.json({ error: "Tipe laporan tidak valid" }, { status: 400 });
  } catch (error: any) {
    console.error("Gagal mengambil laporan keuangan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
