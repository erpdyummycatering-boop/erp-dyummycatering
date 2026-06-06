import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const createdBy = session?.user
    ? `${session.user.name || ""} | ${(session.user as { name?: string; role?: string }).role || ""}`.trim()
    : null;

  const body = await req.json();
  const rows: {
    name?: string;
    phone?: string;
    email?: string;
    type?: string;
    address?: string;
    notes?: string;
  }[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Data tidak boleh kosong" }, { status: 400 });
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    await client.query("BEGIN");

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = String(r.name || "").trim();
      const phone = String(r.phone || "").trim();
      const email = String(r.email || "").trim();
      const type = String(r.type || "Perorangan").trim();
      const address = String(r.address || "").trim();
      const notes = String(r.notes || "").trim();

      if (!name) {
        errors.push(`Baris ${i + 2}: Kolom 'name' wajib diisi — dilewati`);
        skipped++;
        continue;
      }

      // Upsert: jika phone sudah ada, update. Jika tidak, insert baru.
      if (phone) {
        const exist = await client.query("SELECT id FROM customers WHERE phone = $1", [phone]);
        if (exist.rows.length > 0) {
          await client.query(
            `UPDATE customers SET name=$1, email=$2, type=$3, address=$4, notes=$5 WHERE phone=$6`,
            [name, email || null, type, address || null, notes || null, phone]
          );
          skipped++; // counted as updated
          continue;
        }
      }

      await client.query(
        `INSERT INTO customers (name, phone, email, type, address, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [name, phone || null, email || null, type, address || null, notes || null, createdBy]
      );
      inserted++;
    }

    await client.query("COMMIT");
    return NextResponse.json({ inserted, skipped, errors, total: rows.length });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  } finally {
    client.release();
  }
}
