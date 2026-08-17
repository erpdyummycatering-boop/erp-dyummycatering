import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT c.*, a.kecamatan AS area_kecamatan, a.kota AS area_kota
       FROM customers c
       LEFT JOIN areas a ON c.area_id = a.id
       WHERE c.id = $1`,
      [custId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Pelanggan tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(res.rows[0]);
  } catch (error: any) {
    console.error("Gagal mengambil detail customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const body = await req.json();
    const { name, phone, address, patokan, area_id } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Nama dan Nomor HP/WA wajib diisi." }, { status: 400 });
    }

    const cleanPhone = String(phone).trim().replace(/[^0-9]/g, "");

    // Check duplicate phone
    const checkRes = await client.query(
      "SELECT id FROM customers WHERE phone = $1 AND id <> $2 LIMIT 1",
      [cleanPhone, custId]
    );

    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { error: "Nomor WhatsApp/HP ini sudah digunakan oleh pelanggan lain." },
        { status: 400 }
      );
    }

    await client.query(
      `UPDATE customers
       SET name = $1, phone = $2, address = $3, patokan = $4, area_id = $5
       WHERE id = $6`,
      [name, cleanPhone, address || "-", patokan || "", area_id || null, custId]
    );

    return NextResponse.json({ message: "Data pelanggan berhasil diperbarui." });
  } catch (error: any) {
    console.error("Gagal update customer:", error);
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
  const custId = Number(id);
  if (isNaN(custId)) {
    return NextResponse.json({ error: "ID pelanggan tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Find all order IDs for this customer
    const orderRes = await client.query("SELECT id FROM orders WHERE customer_id = $1", [custId]);
    const orderIds = orderRes.rows.map((r) => r.id);

    if (orderIds.length > 0) {
      // 2. Cascade delete order_items
      await client.query("DELETE FROM order_items WHERE order_id = ANY($1::bigint[])", [orderIds]);

      // 3. Cascade delete journals
      await client.query(
        "DELETE FROM journals WHERE (ref_type IN ('penjualan', 'koreksi') AND ref_id = ANY($1::bigint[])) OR ref_no LIKE 'SI.%'",
        [orderIds]
      );

      // 4. Cascade delete kas_mutasi
      await client.query(
        "DELETE FROM kas_mutasi WHERE ref_type IN ('penjualan', 'koreksi') AND ref_id = ANY($1::bigint[])",
        [orderIds]
      );

      // 5. Delete orders
      await client.query("DELETE FROM orders WHERE customer_id = $1", [custId]);
    }

    // 6. Delete customer record
    await client.query("DELETE FROM customers WHERE id = $1", [custId]);

    await client.query("COMMIT");

    return NextResponse.json({
      message: `Pelanggan dan ${orderIds.length} riwayat transaksi order/jurnal berhasil dihapus secara permanent.`,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal hapus customer cascade:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus data pelanggan" }, { status: 500 });
  } finally {
    client.release();
  }
}
