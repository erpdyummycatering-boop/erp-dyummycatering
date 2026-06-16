import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userName = session?.user?.name;

  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const type = p.get("type") || "";
  const caste = p.get("caste") || "";

  const wheres: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (search) { wheres.push(`(c.name ILIKE $${idx} OR c.phone ILIKE $${idx} OR c.email ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
  if (type) { wheres.push(`c.type = $${idx}`); vals.push(type); idx++; }
  if (caste) {
    if (caste === "Customer") {
      wheres.push(`EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)`);
    } else if (caste === "Lead") {
      wheres.push(`NOT EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id)`);
    }
  }

  if (userRole === "CS / Sales" && userName) {
    wheres.push(`c.created_by = $${idx}`);
    vals.push(`${userName} | CS / Sales`);
    idx++;
  }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM customers c ${where}`, vals),
      client.query(`
        SELECT c.*,
          (SELECT MAX(delivery_date) FROM orders WHERE customer_id = c.id) AS last_order,
          CASE WHEN EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id) THEN 'Customer' ELSE 'Lead' END AS caste
        FROM customers c
        ${where}
        ORDER BY c.created_at DESC
        LIMIT $${idx} OFFSET $${idx+1}
      `, [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const createdBy = session?.user
    ? `${session.user.name || ""} | ${(session.user as { name?: string; role?: string }).role || ""}`.trim()
    : null;
  const userId = (session?.user as any)?.id;

  const { name, phone, email, type, address, notes, create_lead, lead_date, source, status, tags } = await req.json();
  if (!name) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const res = await client.query(
      `INSERT INTO customers (name, phone, email, type, address, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phone || null, email || null, type || "Perorangan", address || null, notes || null, createdBy]
    );
    const newCustomer = res.rows[0];

    // Auto-create first lead unless explicitly set to false
    if (create_lead !== false) {
      await client.query(
        `INSERT INTO leads (customer_id, pic_id, lead_date, source, status, tags, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newCustomer.id,
          userId || null,
          lead_date || new Date().toISOString().split("T")[0],
          source || "WhatsApp",
          status || "Prospek",
          tags || null,
          notes || null
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(newCustomer, { status: 201 });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Gagal menyimpan customer & lead:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { client.release(); }
}
