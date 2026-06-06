import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// ── Helpers: hitung realisasi real dari DB berdasarkan jenis KPI & periode ──────
async function calcRealisasi(client: any, jenis: string, periode: string) {
  // Parse periode "Mei 2026" → bulan & tahun
  const months: Record<string, number> = {
    Januari: 1, Februari: 2, Maret: 3, April: 4, Mei: 5, Juni: 6,
    Juli: 7, Agustus: 8, September: 9, Oktober: 10, November: 11, Desember: 12,
  };
  const parts = periode.trim().split(" ");
  const month = months[parts[0]];
  const year = Number(parts[1]);

  if (!month || !year) return null;

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const dateTo   = `${year}-${String(month).padStart(2, "0")}-31`;

  switch (jenis) {
    case "Revenue": {
      // Total omset dari orders yang tidak dibatalkan, delivery_date dalam periode
      const res = await client.query(
        `SELECT COALESCE(SUM(grand_total), 0) as val
         FROM orders
         WHERE status_order != 'Batal'
           AND delivery_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      return Number(res.rows[0].val);
    }

    case "Order Count": {
      const res = await client.query(
        `SELECT COUNT(*) as val
         FROM orders
         WHERE status_order != 'Batal'
           AND delivery_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      return Number(res.rows[0].val);
    }

    case "Lead Masuk": {
      const res = await client.query(
        `SELECT COUNT(*) as val
         FROM leads
         WHERE lead_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      return Number(res.rows[0].val);
    }

    case "Closing Rate": {
      // (jumlah lead Closing / total lead) * 100
      const res = await client.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'Closing' THEN 1 END) as closing
         FROM leads
         WHERE lead_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      const total = Number(res.rows[0].total);
      const closing = Number(res.rows[0].closing);
      return total > 0 ? Number(((closing / total) * 100).toFixed(1)) : 0;
    }

    case "Gross Margin": {
      // ((Revenue - BPP Aktual) / Revenue) * 100
      const revRes = await client.query(
        `SELECT COALESCE(SUM(grand_total), 0) as rev
         FROM orders WHERE status_order != 'Batal' AND delivery_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      const bppRes = await client.query(
        `SELECT COALESCE(SUM(po.total_actual_cost), 0) as bpp
         FROM purchase_orders po
         WHERE po.po_date BETWEEN $1 AND $2 AND po.status_po = 'Selesai Belanja'`,
        [dateFrom, dateTo]
      );
      const rev = Number(revRes.rows[0].rev);
      const bpp = Number(bppRes.rows[0].bpp);
      return rev > 0 ? Number((((rev - bpp) / rev) * 100).toFixed(1)) : 0;
    }

    case "BPP %": {
      // (BPP Aktual / Revenue) * 100
      const revRes = await client.query(
        `SELECT COALESCE(SUM(grand_total), 0) as rev
         FROM orders WHERE status_order != 'Batal' AND delivery_date BETWEEN $1 AND $2`,
        [dateFrom, dateTo]
      );
      const bppRes = await client.query(
        `SELECT COALESCE(SUM(po.total_actual_cost), 0) as bpp
         FROM purchase_orders po
         WHERE po.po_date BETWEEN $1 AND $2 AND po.status_po = 'Selesai Belanja'`,
        [dateFrom, dateTo]
      );
      const rev = Number(revRes.rows[0].rev);
      const bpp = Number(bppRes.rows[0].bpp);
      return rev > 0 ? Number(((bpp / rev) * 100).toFixed(1)) : 0;
    }

    default:
      return null;
  }
}

// ── GET: list semua target, realisasi dihitung real-time ─────────────────────
export async function GET() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM targets ORDER BY created_at DESC`
    );

    // Inject realisasi real untuk setiap baris
    const rows = await Promise.all(
      res.rows.map(async (t: any) => {
        const realisasi = await calcRealisasi(client, t.jenis, t.periode);
        return { ...t, realisasi: realisasi ?? 0 };
      })
    );

    return NextResponse.json(rows);
  } catch (err: any) {
    // Jika tabel belum ada, return array kosong
    if (err.message?.includes("does not exist")) return NextResponse.json([]);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// ── POST: tambah target baru ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { periode, jenis, target, satuan } = await req.json();
  if (!periode || !jenis || !target) {
    return NextResponse.json({ error: "Periode, jenis, dan target wajib diisi" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    // Pastikan tabel ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS targets (
        id BIGSERIAL PRIMARY KEY,
        periode VARCHAR(50) NOT NULL,
        jenis VARCHAR(100) NOT NULL,
        target DECIMAL(15,2) NOT NULL,
        satuan VARCHAR(20) NOT NULL DEFAULT 'Rp',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const res = await client.query(
      `INSERT INTO targets (periode, jenis, target, satuan) VALUES ($1,$2,$3,$4) RETURNING *`,
      [periode, jenis, Number(target), satuan || "Rp"]
    );
    const row = res.rows[0];
    const realisasi = await calcRealisasi(client, row.jenis, row.periode);
    return NextResponse.json({ ...row, realisasi: realisasi ?? 0 }, { status: 201 });
  } finally {
    client.release();
  }
}
