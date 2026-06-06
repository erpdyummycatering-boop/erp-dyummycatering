import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

const VALID_STATUSES = ["Prospek", "Follow Up", "Negosiasi", "Konfirmasi", "Closing", "Reject"];
const VALID_SOURCES = ["WhatsApp", "Instagram", "Website", "Referral", "Walk-in"];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const body = await req.json();
  const rows: any[] = body.rows;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Data tidak boleh kosong" }, { status: 400 });
  }

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    await client.query("BEGIN");

    const finalPicId = userRole === "CS / Sales" ? userId : null;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const customerName = String(r.customer_name || r.nama_customer || "").trim();
      const customerPhone = String(r.customer_phone || r.no_hp || r.phone || "").trim();
      const leadDate = String(r.lead_date || r.tanggal || "").trim() || new Date().toISOString().split("T")[0];
      const source = String(r.source || r.sumber || "WhatsApp").trim();
      const status = String(r.status || "Prospek").trim();
      const tags = String(r.tags || "").trim();
      const notes = String(r.notes || r.catatan || "").trim();

      if (!customerName) {
        errors.push(`Baris ${i + 2}: 'customer_name' wajib diisi — dilewati`);
        skipped++;
        continue;
      }

      // Resolve or create customer
      let customerId: number | null = null;
      if (customerPhone) {
        const exist = await client.query("SELECT id FROM customers WHERE phone = $1", [customerPhone]);
        if (exist.rows.length > 0) {
          customerId = exist.rows[0].id;
        }
      }
      if (!customerId) {
        // cari by name
        const byName = await client.query("SELECT id FROM customers WHERE name ILIKE $1 LIMIT 1", [customerName]);
        if (byName.rows.length > 0) {
          customerId = byName.rows[0].id;
        } else {
          const ins = await client.query(
            "INSERT INTO customers (name, phone, type) VALUES ($1, $2, $3) RETURNING id",
            [customerName, customerPhone || null, "Perorangan"]
          );
          customerId = ins.rows[0].id;
        }
      }

      const finalStatus = VALID_STATUSES.includes(status) ? status : "Prospek";
      const finalSource = VALID_SOURCES.includes(source) ? source : "WhatsApp";

      await client.query(
        `INSERT INTO leads (customer_id, pic_id, lead_date, source, status, tags, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [customerId, finalPicId, leadDate, finalSource, finalStatus, tags || null, notes || null]
      );
      inserted++;
    }

    await client.query("COMMIT");
    return NextResponse.json({ inserted, skipped, errors, total: rows.length });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
