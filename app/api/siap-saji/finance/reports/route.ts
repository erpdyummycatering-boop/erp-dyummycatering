import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const type = p.get("type") || "pl"; // pl | neraca | journals

  const client = await pool.connect();
  try {
    if (type === "pl") {
      const month = p.get("month"); // "1" .. "12" or "all"
      const year = p.get("year") || "2026";
      const dateFrom = p.get("date_from");
      const dateTo = p.get("date_to");

      let dateFilter = "";
      if (dateFrom && dateTo) {
        dateFilter = `AND j.journal_date >= '${dateFrom}'::date AND j.journal_date <= '${dateTo}'::date`;
      } else if (dateFrom) {
        dateFilter = `AND j.journal_date = '${dateFrom}'::date`;
      } else {
        dateFilter = `AND EXTRACT(YEAR FROM j.journal_date) = ${Number(year)}`;
        if (month && month !== "all") {
          dateFilter += ` AND EXTRACT(MONTH FROM j.journal_date) = ${Number(month)}`;
        }
      }

      const plRes = await client.query(
        `SELECT 
          j.lini,
          DATE_TRUNC('month', j.journal_date) AS bulan,
          SUM(
            CASE 
              WHEN ck.kelompok = 'Pendapatan' THEN j.nominal 
              WHEN cd.kelompok = 'Pendapatan' THEN -j.nominal
              ELSE 0 
            END
          ) AS pendapatan,
          SUM(
            CASE 
              WHEN cd.kelompok = 'Beban' AND cd.sub_kelompok = 'Beban Pokok Penjualan' THEN j.nominal 
              WHEN ck.kelompok = 'Beban' AND ck.sub_kelompok = 'Beban Pokok Penjualan' THEN -j.nominal
              ELSE 0 
            END
          ) AS hpp,
          SUM(
            CASE 
              WHEN cd.kelompok = 'Beban' AND cd.sub_kelompok = 'Beban Operasional' THEN j.nominal 
              WHEN ck.kelompok = 'Beban' AND ck.sub_kelompok = 'Beban Operasional' THEN -j.nominal
              ELSE 0 
            END
          ) AS biaya_operasional,
          SUM(
            CASE 
              WHEN ck.kelompok = 'Pendapatan' THEN j.nominal 
              WHEN cd.kelompok = 'Pendapatan' THEN -j.nominal
              WHEN cd.kelompok = 'Beban' THEN -j.nominal
              WHEN ck.kelompok = 'Beban' THEN j.nominal
              ELSE 0 
            END
          ) AS laba_bersih
        FROM journals j
        LEFT JOIN coa cd ON cd.id = j.akun_debit
        LEFT JOIN coa ck ON ck.id = j.akun_kredit
        WHERE j.lini = 'siap_saji' AND COALESCE(j.status, 'posted') != 'dibatalkan' ${dateFilter}
        GROUP BY j.lini, DATE_TRUNC('month', j.journal_date)
        ORDER BY bulan DESC`
      );

      // Detailed breakdown by CoA based on selected period
      const detailRes = await client.query(
        `SELECT 
          c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun,
          COALESCE(
            SUM(
              CASE 
                WHEN c.kelompok = 'Pendapatan' THEN 
                  CASE WHEN j.akun_kredit = c.id THEN j.nominal WHEN j.akun_debit = c.id THEN -j.nominal ELSE 0 END
                WHEN c.kelompok = 'Beban' THEN 
                  CASE WHEN j.akun_debit = c.id THEN j.nominal WHEN j.akun_kredit = c.id THEN -j.nominal ELSE 0 END
                ELSE j.nominal
              END
            ), 0
          ) AS total_nominal
        FROM coa c
        LEFT JOIN journals j ON (j.akun_debit = c.id OR j.akun_kredit = c.id) 
          AND j.lini = 'siap_saji' 
          AND COALESCE(j.status, 'posted') != 'dibatalkan' 
          ${dateFilter}
        WHERE c.lini = 'siap_saji' AND c.nama_akun NOT ILIKE '%catering%'
        GROUP BY c.id, c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun
        ORDER BY c.kode_akun`
      );

      return NextResponse.json({
        summary: plRes.rows,
        details: detailRes.rows,
      });
    }

    if (type === "neraca") {
      const date_to = p.get("date_to") || "";
      const date_from = p.get("date_from") || "";

      let journalDateFilter = "";
      const vals: any[] = [];
      if (date_to) {
        vals.push(date_to);
        journalDateFilter = `AND j.journal_date <= $1::date`;
      }

      const neracaRes = await client.query(
        `SELECT 
          c.id, c.kode_akun, c.nama_akun, c.kelompok, c.sub_kelompok,
          COALESCE(SUM(CASE WHEN j.akun_debit = c.id THEN j.nominal ELSE 0 END), 0) AS total_debit,
          COALESCE(SUM(CASE WHEN j.akun_kredit = c.id THEN j.nominal ELSE 0 END), 0) AS total_kredit,
          COALESCE(
            SUM(
              CASE 
                WHEN j.akun_debit = c.id THEN j.nominal
                WHEN j.akun_kredit = c.id THEN -j.nominal
                ELSE 0
              END
            ), 0
          ) AS saldo
        FROM coa c
        LEFT JOIN journals j ON (c.id = j.akun_debit OR c.id = j.akun_kredit)
          AND j.lini = 'siap_saji'
          AND COALESCE(j.status, 'posted') != 'dibatalkan'
          ${journalDateFilter}
        WHERE c.lini = 'siap_saji' AND c.nama_akun NOT ILIKE '%catering%'
        GROUP BY c.id, c.kode_akun, c.nama_akun, c.kelompok, c.sub_kelompok
        ORDER BY c.kode_akun`,
        vals
      );
      return NextResponse.json(neracaRes.rows);
    }

    if (type === "journals") {
      const search = p.get("search") || "";
      const date_from = p.get("date_from") || "";
      const date_to = p.get("date_to") || "";
      const ref_type = p.get("ref_type") || "";
      const account_id = p.get("account_id") || "";
      const page = Math.max(1, Number(p.get("page") || 1));
      const limit = Math.max(1, Math.min(200, Number(p.get("limit") || 50)));
      const offset = (page - 1) * limit;

      const wheres: string[] = ["j.lini = 'siap_saji'"];
      const vals: any[] = [];
      let idx = 1;

      if (account_id) {
        wheres.push(`(j.akun_debit = $${idx} OR j.akun_kredit = $${idx})`);
        vals.push(Number(account_id));
        idx++;
      }
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

      const countRes = await client.query(
        `SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN j.status != 'dibatalkan' THEN j.nominal ELSE 0 END), 0) AS total_nominal
        FROM journals j
        LEFT JOIN coa cd ON j.akun_debit = cd.id
        LEFT JOIN coa ck ON j.akun_kredit = ck.id
        WHERE ${whereSql}`,
        vals
      );

      const totalCount = Number(countRes.rows[0]?.total || 0);
      const totalNominal = Number(countRes.rows[0]?.total_nominal || 0);

      const listVals = [...vals, limit, offset];
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
        LIMIT $${idx} OFFSET $${idx + 1}`,
        listVals
      );

      const isRawArray = !p.has("page") && !p.has("account_id");
      if (isRawArray) {
        return NextResponse.json(journalsRes.rows);
      }

      return NextResponse.json({
        data: journalsRes.rows,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        total_nominal: totalNominal,
      });
    }

    if (type === "ledger") {
      const coa_id = p.get("coa_id") || "";
      const date_from = p.get("date_from") || "";
      const date_to = p.get("date_to") || "";
      const page = Math.max(1, Number(p.get("page") || 1));
      const limit = Math.max(1, Math.min(200, Number(p.get("limit") || 50)));
      const offset = (page - 1) * limit;

      if (!coa_id) {
        return NextResponse.json({
          account: null,
          initial_balance: 0,
          entries: [],
          total: 0,
          page,
          limit,
          totalPages: 1,
          total_debit: 0,
          total_kredit: 0,
          ending_balance: 0,
        });
      }

      // 1. Get COA detail
      const coaRes = await client.query(
        `SELECT id, kode_akun, nama_akun, kelompok, sub_kelompok FROM coa WHERE id = $1`,
        [Number(coa_id)]
      );
      if (coaRes.rows.length === 0) {
        return NextResponse.json({ error: "Akun COA tidak ditemukan" }, { status: 404 });
      }
      const account = coaRes.rows[0];
      const isDebitNormal = account.kelompok === "Aset" || account.kelompok === "Beban";

      // 2. Initial balance before date_from (Saldo Awal)
      let initialBalance = 0;
      if (date_from) {
        const initRes = await client.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN akun_debit = $1 THEN nominal ELSE 0 END), 0) AS init_debit,
            COALESCE(SUM(CASE WHEN akun_kredit = $1 THEN nominal ELSE 0 END), 0) AS init_kredit
          FROM journals
          WHERE lini = 'siap_saji'
            AND COALESCE(status, 'posted') != 'dibatalkan'
            AND (akun_debit = $1 OR akun_kredit = $1)
            AND journal_date < $2::date`,
          [Number(coa_id), date_from]
        );
        const initDebit = Number(initRes.rows[0]?.init_debit || 0);
        const initKredit = Number(initRes.rows[0]?.init_kredit || 0);
        initialBalance = isDebitNormal ? initDebit - initKredit : initKredit - initDebit;
      }

      // 3. Transactions within date range
      const wheres: string[] = [
        "j.lini = 'siap_saji'",
        "COALESCE(j.status, 'posted') != 'dibatalkan'",
        "(j.akun_debit = $1 OR j.akun_kredit = $1)",
      ];
      const vals: any[] = [Number(coa_id)];
      let idx = 2;

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

      const countRes = await client.query(
        `SELECT 
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN j.akun_debit = $1 THEN j.nominal ELSE 0 END), 0) AS total_debit,
          COALESCE(SUM(CASE WHEN j.akun_kredit = $1 THEN j.nominal ELSE 0 END), 0) AS total_kredit
        FROM journals j
        WHERE ${whereSql}`,
        vals
      );

      const totalCount = Number(countRes.rows[0]?.total || 0);
      const totalDebitPeriod = Number(countRes.rows[0]?.total_debit || 0);
      const totalKreditPeriod = Number(countRes.rows[0]?.total_kredit || 0);
      const endingBalance = isDebitNormal
        ? initialBalance + totalDebitPeriod - totalKreditPeriod
        : initialBalance + totalKreditPeriod - totalDebitPeriod;

      const listVals = [...vals, limit, offset];
      const entriesRes = await client.query(
        `SELECT 
          j.id, j.journal_date, j.ref_no, j.ref_type, j.keterangan, j.nominal, j.status,
          j.akun_debit, j.akun_kredit,
          cd.kode_akun AS debit_kode, cd.nama_akun AS debit_nama,
          ck.kode_akun AS kredit_kode, ck.nama_akun AS kredit_nama,
          CASE WHEN j.akun_debit = $1 THEN j.nominal ELSE 0 END AS debit,
          CASE WHEN j.akun_kredit = $1 THEN j.nominal ELSE 0 END AS kredit,
          CASE WHEN j.akun_debit = $1 THEN ck.nama_akun ELSE cd.nama_akun END AS akun_lawan
        FROM journals j
        LEFT JOIN coa cd ON j.akun_debit = cd.id
        LEFT JOIN coa ck ON j.akun_kredit = ck.id
        WHERE ${whereSql}
        ORDER BY j.journal_date ASC, j.id ASC
        LIMIT $${idx} OFFSET $${idx + 1}`,
        listVals
      );

      return NextResponse.json({
        account,
        initial_balance: initialBalance,
        entries: entriesRes.rows,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        total_debit: totalDebitPeriod,
        total_kredit: totalKreditPeriod,
        ending_balance: endingBalance,
      });
    }

    return NextResponse.json({ error: "Tipe laporan tidak valid" }, { status: 400 });
  } catch (error: any) {
    console.error("Gagal mengambil laporan keuangan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
