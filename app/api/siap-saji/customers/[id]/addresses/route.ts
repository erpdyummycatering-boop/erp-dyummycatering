import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// GET: Ambil daftar alamat tersimpan dari customer tertentu
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "ID customer tidak valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Ensure table exists safely without wipeout
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
        label VARCHAR(100) DEFAULT 'Alamat',
        address TEXT NOT NULL,
        patokan TEXT,
        area_id BIGINT REFERENCES areas(id) ON DELETE SET NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const res = await client.query(
      `SELECT 
        ca.*,
        a.kecamatan AS area_kecamatan,
        a.kota AS area_kota,
        a.shipping_zone
      FROM customer_addresses ca
      LEFT JOIN areas a ON ca.area_id = a.id
      WHERE ca.customer_id = $1
      ORDER BY ca.is_default DESC, ca.id DESC`,
      [customerId]
    );

    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error("Gagal mengambil daftar alamat customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST: Tambahkan alamat baru untuk customer eksisting
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);
  if (isNaN(customerId)) {
    return NextResponse.json({ error: "ID customer tidak valid" }, { status: 400 });
  }

  const body = await req.json();
  const { label, address, patokan, area_id, is_default } = body;

  if (!address || !address.trim()) {
    return NextResponse.json({ error: "Alamat lengkap wajib diisi" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pastikan tabel ada
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id BIGSERIAL PRIMARY KEY,
        customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
        label VARCHAR(100) DEFAULT 'Alamat',
        address TEXT NOT NULL,
        patokan TEXT,
        area_id BIGINT REFERENCES areas(id) ON DELETE SET NULL,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Jika is_default = true, reset is_default alamat lain milik customer ini
    if (is_default) {
      await client.query(
        "UPDATE customer_addresses SET is_default = false WHERE customer_id = $1",
        [customerId]
      );
    }

    const insRes = await client.query(
      `INSERT INTO customer_addresses (customer_id, label, address, patokan, area_id, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        customerId,
        label ? label.trim() : "Alamat",
        address.trim(),
        patokan ? patokan.trim() : null,
        area_id ? Number(area_id) : null,
        Boolean(is_default),
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json(insRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menambah alamat customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE: Hapus alamat tertentu dari customer
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customerId = Number(id);
  const { searchParams } = new URL(req.url);
  const addressId = Number(searchParams.get("address_id"));

  if (isNaN(customerId) || isNaN(addressId)) {
    return NextResponse.json({ error: "ID customer dan address_id wajib valid" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const delRes = await client.query(
      "DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2 RETURNING *",
      [addressId, customerId]
    );
    if (delRes.rowCount === 0) {
      return NextResponse.json({ error: "Alamat tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Alamat berhasil dihapus", data: delRes.rows[0] });
  } catch (error: any) {
    console.error("Gagal menghapus alamat customer:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
