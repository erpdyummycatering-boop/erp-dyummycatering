import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Ensure drivers table and driver_id column exist, and seed initial 3 drivers
async function initDriverTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'Aktif',
      lini VARCHAR(50) DEFAULT 'siap_saji',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL;
  `);

  // Seed default 3 drivers if table is empty
  const countRes = await client.query("SELECT COUNT(*) FROM drivers WHERE lini = 'siap_saji'");
  if (Number(countRes.rows[0].count) === 0) {
    await client.query(`
      INSERT INTO drivers (name, status, lini) VALUES
      ('driver Hendi', 'Aktif', 'siap_saji'),
      ('driver Supriyono', 'Aktif', 'siap_saji'),
      ('driver Daffa', 'Aktif', 'siap_saji')
    `);
  }
}

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    await initDriverTable(client);
    const res = await client.query(
      "SELECT id, name, phone, status FROM drivers WHERE lini = 'siap_saji' ORDER BY id ASC"
    );
    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error("Gagal mengambil data driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Nama Driver wajib diisi." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await initDriverTable(client);
    const ins = await client.query(
      `INSERT INTO drivers (name, phone, status, lini)
       VALUES ($1, $2, 'Aktif', 'siap_saji')
       RETURNING *`,
      [name.trim(), phone || null]
    );

    return NextResponse.json({ success: true, data: ins.rows[0] });
  } catch (error: any) {
    console.error("Gagal menambah driver:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
