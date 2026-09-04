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
      const wheres: string[] = [
        "o.lini = 'siap_saji'",
        "o.status_order <> 'Dibatalkan'",
        "(o.delivery_date::date = $1::date OR o.order_date::date = $1::date)"
      ];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("ch.name = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");
      const res = await client.query(
        `SELECT 
          p.sku,
          p.name AS nama_barang,
          p.is_half_portion,
          SUM(oi.quantity)::int AS total_qty,
          STRING_AGG(DISTINCT oi.notes, '; ') AS notes_gabungan
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN channels ch ON ch.id = o.channel_id
        ${whereSql}
        GROUP BY p.id, p.sku, p.name, p.is_half_portion
        ORDER BY p.is_half_portion ASC, p.name ASC`,
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

    if (type === "pengiriman" || type === "rekap_pengiriman") {
      const wheres: string[] = [
        "o.lini = 'siap_saji'",
        "o.status_order <> 'Dibatalkan'",
        "(o.delivery_date::date = $1::date OR o.order_date::date = $1::date)"
      ];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("ch.name = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");

      if (type === "rekap_pengiriman") {
        // Detailed row structure per order item for Rekap Pengiriman Kurir layout
        const res = await client.query(
          `SELECT 
            o.id AS order_id,
            c.name AS nama_customer,
            c.phone AS no_hp,
            o.no_struk,
            COALESCE(a.kecamatan, '-') AS kecamatan,
            COALESCE(o.shipping_address, c.address, '-') AS alamat,
            c.patokan,
            COALESCE(dr.name, 'Unassigned') AS driver_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'name', p.name,
                  'quantity', oi.quantity,
                  'is_half_portion', p.is_half_portion
                )
              ) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS items
          FROM orders o
          JOIN customers c ON c.id = o.customer_id
          LEFT JOIN areas a ON a.id = c.area_id
          LEFT JOIN channels ch ON ch.id = o.channel_id
          LEFT JOIN drivers dr ON dr.id = o.driver_id
          LEFT JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN products p ON p.id = oi.product_id
          ${whereSql}
          GROUP BY o.id, c.id, c.name, c.phone, o.no_struk, a.kecamatan, o.shipping_address, c.address, c.patokan, dr.name, ch.name
          ORDER BY COALESCE(dr.name, 'Z'), a.kecamatan, c.name`,
          vals
        );

        return NextResponse.json({
          type: "rekap_pengiriman",
          tanggal,
          channel: channel || "Semua Channel",
          data: res.rows,
        });
      }

      const res = await client.query(
        `SELECT 
          o.id AS order_id,
          c.name AS nama_customer,
          c.phone AS no_hp,
          o.no_struk,
          COALESCE(a.kecamatan, '-') AS kecamatan,
          COALESCE(a.shipping_zone, 'dalam_kota') AS shipping_zone,
          COALESCE(a.kota, 'Pekanbaru') AS kota,
          COALESCE(o.shipping_address, c.address, '-') AS alamat,
          c.patokan,
          STRING_AGG(CONCAT(oi.quantity, 'x ', p.name), ', ') AS daftar_order,
          o.grand_total,
          COALESCE(o.payment_bank, 'Cash') AS payment_bank,
          COALESCE(ch.name, 'Direct') AS channel,
          COALESCE(dr.name, 'Unassigned') AS driver_name
        FROM orders o
        JOIN customers c ON c.id = o.customer_id
        LEFT JOIN areas a ON a.id = c.area_id
        LEFT JOIN channels ch ON ch.id = o.channel_id
        LEFT JOIN drivers dr ON dr.id = o.driver_id
        LEFT JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        ${whereSql}
        GROUP BY o.id, c.id, c.name, c.phone, o.no_struk, a.kecamatan, a.shipping_zone, a.kota, o.shipping_address, c.address, c.patokan, o.grand_total, o.payment_bank, ch.name, dr.name
        ORDER BY ch.name, CASE COALESCE(a.shipping_zone, 'dalam_kota') WHEN 'dalam_kota' THEN 1 ELSE 2 END, a.kota, a.kecamatan, c.name`,
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
      const wheres: string[] = [
        "o.lini = 'siap_saji'",
        "o.status_order <> 'Dibatalkan'",
        "(o.delivery_date::date = $1::date OR o.order_date::date = $1::date)"
      ];
      const vals: any[] = [tanggal];

      if (channel) {
        wheres.push("ch.name = $2");
        vals.push(channel);
      }

      const whereSql = "WHERE " + wheres.join(" AND ");
      const res = await client.query(
        `SELECT
          COALESCE(o.delivery_date::text, o.order_date::text) AS tanggal,
          COALESCE(c.name, 'Umum')                            AS pelanggan,
          (COALESCE(o.grand_total, 0) - COALESCE(o.shipping_fee, 0)) AS penjualan,
          COALESCE(o.shipping_fee, 0)                         AS ongkir,
          COALESCE(o.grand_total, 0)                          AS total,
          COALESCE(o.payment_bank, 'Cash')                    AS bank,
          COALESCE(o.payment_account, '-')                    AS no_rekening,
          COALESCE(o.status_payment, 'Belum Lunas')           AS status,
          COALESCE(ch.name, 'Direct')                         AS channel,
          COALESCE(a.kecamatan, '-')                          AS kecamatan
        FROM orders o
        JOIN customers c      ON c.id = o.customer_id
        LEFT JOIN channels ch ON ch.id = o.channel_id
        LEFT JOIN areas a     ON a.id = c.area_id
        ${whereSql}
        ORDER BY ch.name, c.name`,
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
