import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    const [channelsRes, areasRes, kasBankRes, productsRes, driversRes] = await Promise.all([
      client.query(
        "SELECT id, name, harga_type, platform_key, urutan FROM channels WHERE lini = 'siap_saji' AND is_active = true ORDER BY urutan, name"
      ),
      client.query(
        "SELECT id, kecamatan, kota, provinsi, shipping_zone FROM areas WHERE is_active = true ORDER BY shipping_zone, kota, kecamatan"
      ),
      client.query(
        "SELECT id, nama_rekening, jenis, no_rekening, nama_bank, is_payment_default FROM kas_bank WHERE lini = 'siap_saji' AND is_active = true ORDER BY is_payment_default DESC, id"
      ),
      client.query(`
        SELECT 
          p.id, p.sku, p.name, p.category_id, p.description, p.price, p.is_half_portion, p.parent_sku,
          COALESCE(
            json_agg(
              json_build_object('channel_id', pc.channel_id, 'harga_override', pc.harga_override)
            ) FILTER (WHERE pc.channel_id IS NOT NULL AND pc.is_active = true), '[]'
          ) AS channel_prices
        FROM products p
        LEFT JOIN product_channels pc ON pc.product_id = p.id
        WHERE p.lini = 'siap_saji' AND p.status = 'Aktif'
        GROUP BY p.id, p.sku, p.name, p.category_id, p.description, p.price, p.is_half_portion, p.parent_sku
        ORDER BY p.is_half_portion ASC, p.name ASC
      `),
      client.query(
        "SELECT id, name, phone, status FROM drivers WHERE lini = 'siap_saji' AND status = 'Aktif' ORDER BY id ASC"
      ).catch(() => ({ rows: [] })),
    ]);

    return NextResponse.json({
      channels: channelsRes.rows,
      areas: areasRes.rows,
      kas_bank: kasBankRes.rows,
      products: productsRes.rows,
      drivers: driversRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil master data Siap Saji:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
