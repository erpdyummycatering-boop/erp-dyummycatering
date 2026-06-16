import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const status = p.get("status") || "";
  const pic_id = p.get("pic_id") || "";
  const source = p.get("source") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (search) { wheres.push(`(c.name ILIKE $${idx} OR l.tags ILIKE $${idx} OR l.notes ILIKE $${idx})`); vals.push(`%${search}%`); idx++; }
  if (status) { wheres.push(`l.status = $${idx}`); vals.push(status); idx++; }
  
  if (userRole === "CS / Sales") {
    wheres.push(`l.pic_id = $${idx}`);
    vals.push(userId);
    idx++;
  } else if (pic_id) {
    wheres.push(`l.pic_id = $${idx}`);
    vals.push(pic_id);
    idx++;
  }
  
  if (source) { wheres.push(`l.source = $${idx}`); vals.push(source); idx++; }
  if (date_from) { wheres.push(`l.lead_date >= $${idx}`); vals.push(date_from); idx++; }
  if (date_to) { wheres.push(`l.lead_date <= $${idx}`); vals.push(date_to); idx++; }

  const where = wheres.length ? "WHERE " + wheres.join(" AND ") : "";
  const client = await pool.connect();
  try {
    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM leads l JOIN customers c ON l.customer_id=c.id ${where}`, vals),
      client.query(`SELECT l.*, c.name AS customer_name, u.name AS pic_name,
        CASE WHEN EXISTS (SELECT 1 FROM orders WHERE customer_id = c.id) THEN 'Customer' ELSE 'Lead' END AS customer_caste
        FROM leads l
        JOIN customers c ON l.customer_id=c.id LEFT JOIN users u ON l.pic_id=u.id
        ${where} ORDER BY l.lead_date DESC, l.id DESC LIMIT $${idx} OFFSET $${idx+1}`,
        [...vals, limit, offset])
    ]);
    const total = Number(countRes.rows[0].count);
    return NextResponse.json({ data: dataRes.rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;
  const createdBy = session?.user
    ? `${session.user.name || ""} | ${(session.user as { name?: string; role?: string }).role || ""}`.trim()
    : null;

  const { customer_id, customer_name, customer_phone, pic_id, lead_date, source, status, tags, notes } = await req.json();
  const client = await pool.connect();
  try {
    let final_customer_id = customer_id;
    
    // Handle new customer logic from WA number
    if (final_customer_id === "new") {
      const exist = await client.query("SELECT id FROM customers WHERE phone = $1", [customer_phone]);
      if (exist.rows.length > 0) {
        final_customer_id = exist.rows[0].id;
      } else {
        const ins = await client.query(
          "INSERT INTO customers (name, phone, type, notes, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [customer_name || "Customer Baru", customer_phone, "Perorangan", notes || null, createdBy]
        );
        final_customer_id = ins.rows[0].id;
      }
    }

    let final_pic_id = pic_id;
    if (userRole === "CS / Sales") {
      final_pic_id = userId;
    }

    const res = await client.query(
      `INSERT INTO leads (customer_id,pic_id,lead_date,source,status,tags,notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [final_customer_id, final_pic_id || null, lead_date, source, status || "Prospek", tags, notes]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } catch (err: any) {
    console.error("Gagal menyimpan lead:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { client.release(); }
}
