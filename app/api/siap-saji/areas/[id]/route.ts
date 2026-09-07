import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const areaId = Number(id);
  if (isNaN(areaId)) {
    return NextResponse.json({ error: "ID area/wilayah tidak valid" }, { status: 400 });
  }

  const body = await req.json();
  const { kecamatan, kota, provinsi, shipping_zone, is_active, custom_fee } = body;

  if (!kecamatan || !kota) {
    return NextResponse.json({ error: "Kecamatan dan Kota wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const updateRes = await client.query(
      `UPDATE areas
       SET kecamatan = $1,
           kota = $2,
           provinsi = COALESCE($3, provinsi),
           shipping_zone = COALESCE($4, shipping_zone),
           is_active = CASE WHEN $5::boolean IS NOT NULL THEN $5::boolean ELSE is_active END
       WHERE id = $6
       RETURNING *`,
      [
        kecamatan.trim(),
        kota.trim(),
        provinsi || null,
        shipping_zone || null,
        is_active !== undefined ? Boolean(is_active) : null,
        areaId,
      ]
    );

    if (updateRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Kecamatan tidak ditemukan." }, { status: 404 });
    }

    // If custom_fee is supplied or zone is custom_manual, save/update shipping rates/area_channel_shipping
    if (custom_fee !== undefined && custom_fee !== null && custom_fee !== "") {
      const numFee = Number(custom_fee);
      if (!isNaN(numFee) && numFee >= 0) {
        const channelsRes = await client.query("SELECT id FROM channels WHERE lini = 'siap_saji'");
        for (const ch of channelsRes.rows) {
          await client.query(
            `INSERT INTO area_channel_shipping (area_id, channel_id, shipping_fee, is_active, notes, updated_at)
             VALUES ($1, $2, $3, true, 'Nominal custom ongkir wilayah', NOW())
             ON CONFLICT (area_id, channel_id)
             DO UPDATE SET shipping_fee = EXCLUDED.shipping_fee, updated_at = NOW()`,
            [areaId, ch.id, numFee]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(updateRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal memperbarui wilayah:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const areaId = Number(id);
  if (isNaN(areaId)) {
    return NextResponse.json({ error: "ID area/wilayah tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Check if area is referenced by any customer who has orders
    const checkRes = await client.query(
      `SELECT COUNT(o.id) FROM customers c
       JOIN orders o ON o.customer_id = c.id
       WHERE c.area_id = $1 AND o.status_order <> 'Dibatalkan'`,
      [areaId]
    );

    const orderCount = Number(checkRes.rows[0].count || 0);
    if (orderCount > 0) {
      return NextResponse.json(
        { error: `Kecamatan tidak dapat dihapus karena sudah memiliki ${orderCount} transaksi/order terhubung.` },
        { status: 400 }
      );
    }

    await client.query("BEGIN");
    // Delete orphan shipping rates linked to this area
    await client.query("DELETE FROM shipping_rates WHERE area_id = $1", [areaId]);
    // Reset area_id to null for customers linked to this area who don't have active orders
    await client.query("UPDATE customers SET area_id = NULL WHERE area_id = $1", [areaId]);
    // Delete area
    const delRes = await client.query("DELETE FROM areas WHERE id = $1 RETURNING *", [areaId]);
    await client.query("COMMIT");

    if (delRes.rows.length === 0) {
      return NextResponse.json({ error: "Kecamatan tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ message: "Kecamatan berhasil dihapus." });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menghapus kecamatan:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
