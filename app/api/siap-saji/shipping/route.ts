import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const channel_id = p.get("channel_id") || "";
  const shipping_zone = p.get("shipping_zone") || "";
  const search = p.get("search") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (channel_id) {
    wheres.push(`channel_id = $${idx}`);
    vals.push(Number(channel_id));
    idx++;
  }
  if (shipping_zone) {
    wheres.push(`shipping_zone = $${idx}`);
    vals.push(shipping_zone);
    idx++;
  }
  if (search) {
    wheres.push(`(kecamatan ILIKE $${idx} OR kota ILIKE $${idx} OR channel_name ILIKE $${idx})`);
    vals.push(`%${search}%`);
    idx++;
  }

  const whereSql = wheres.length ? "WHERE " + wheres.join(" AND ") : "";

  const client = await pool.connect();
  try {
    const [matrixRes, zonesRes, channelsRes] = await Promise.all([
      client.query(`SELECT * FROM v_shipping_matrix ${whereSql} ORDER BY shipping_zone, kota, kecamatan, channel_name`, vals),
      client.query("SELECT * FROM shipping_zones ORDER BY zone_key"),
      client.query("SELECT id, name FROM channels WHERE lini = 'siap_saji' AND is_active = true ORDER BY urutan"),
    ]);

    return NextResponse.json({
      matrix: matrixRes.rows,
      zones: zonesRes.rows,
      channels: channelsRes.rows,
    });
  } catch (error: any) {
    console.error("Gagal mengambil matriks shipping:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, area_id, channel_id, shipping_fee, notes, zone_key, zone_fee } = body;

  const client = await pool.connect();
  try {
    if (action === "update_zone_default") {
      if (!zone_key || shipping_fee === undefined) {
        return NextResponse.json({ error: "zone_key dan shipping_fee wajib diisi." }, { status: 400 });
      }
      await client.query(
        "UPDATE shipping_zones SET fee = $1 WHERE zone_key = $2",
        [Number(shipping_fee), zone_key]
      );
      return NextResponse.json({ message: "Tarif zona default berhasil diperbarui." });
    }

    // Default action: update/upsert area × channel override
    if (!area_id || !channel_id || shipping_fee === undefined) {
      return NextResponse.json({ error: "area_id, channel_id, dan shipping_fee wajib diisi." }, { status: 400 });
    }

    await client.query(
      `INSERT INTO area_channel_shipping (area_id, channel_id, shipping_fee, is_active, notes, updated_at)
       VALUES ($1, $2, $3, true, $4, NOW())
       ON CONFLICT (area_id, channel_id) 
       DO UPDATE SET shipping_fee = EXCLUDED.shipping_fee, notes = EXCLUDED.notes, is_active = true, updated_at = NOW()`,
      [Number(area_id), Number(channel_id), Number(shipping_fee), notes || null]
    );

    return NextResponse.json({ message: "Tarif ongkir spesifik berhasil diperbarui." });
  } catch (error: any) {
    console.error("Gagal memperbarui tarif shipping:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
