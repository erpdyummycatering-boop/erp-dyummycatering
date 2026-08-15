import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const type = p.get("type") || "produksi"; // produksi | pengiriman | rekap_cs
  const tanggal = p.get("tanggal") || new Date().toISOString().split("T")[0];
  const channel = p.get("channel") || "";

  const client = await pool.connect();
  try {
    if (type === "produksi") {
      const wheres: string[] = ["tanggal = $1"];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("channel = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");
      const res = await client.query(
        `SELECT * FROM v_laporan_harian_ss ${whereSql} ORDER BY is_half_portion ASC, nama_barang ASC`,
        vals
      );

      const totalQty = res.rows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0);

      return NextResponse.json({
        type: "produksi",
        tanggal,
        channel: channel || "Semua Channel",
        total_qty: totalQty,
        data: res.rows,
      });
    }

    if (type === "pengiriman") {
      const wheres: string[] = ["tanggal = $1"];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("channel = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");
      const res = await client.query(
        `SELECT * FROM v_daftar_order_ss ${whereSql} ORDER BY channel, CASE shipping_zone WHEN 'dalam_kota' THEN 1 ELSE 2 END, kota, kecamatan, nama_customer`,
        vals
      );

      return NextResponse.json({
        type: "pengiriman",
        tanggal,
        channel: channel || "Semua Channel",
        data: res.rows,
      });
    }

    if (type === "rekap_cs") {
      const wheres: string[] = ["tanggal = $1"];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("channel = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");
      const res = await client.query(
        `SELECT * FROM v_rekap_harian_ss ${whereSql} ORDER BY channel, pelanggan`,
        vals
      );

      const totalOmset = res.rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
      const totalOngkir = res.rows.reduce((sum, r) => sum + Number(r.ongkir || 0), 0);

      return NextResponse.json({
        type: "rekap_cs",
        tanggal,
        channel: channel || "Semua Channel",
        total_omset: totalOmset,
        total_ongkir: totalOngkir,
        data: res.rows,
      });
    }

    return NextResponse.json({ error: "Tipe dokumen tidak valid" }, { status: 400 });
  } catch (error: any) {
    console.error("Gagal mengambil dokumen harian Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
