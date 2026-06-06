import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT l.*, c.name as customer_name, u.name as pic_name
       FROM leads l JOIN customers c ON l.customer_id = c.id
       LEFT JOIN users u ON l.pic_id = u.id
       WHERE l.id = $1`, [id]
    );
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    
    const lead = result.rows[0];
    if (userRole === "CS / Sales" && Number(lead.pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json(lead);
  } finally { client.release(); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const body = await req.json();
  const { status, tags, notes, pic_id } = body;
  const client = await pool.connect();
  try {
    const exist = await client.query("SELECT pic_id FROM leads WHERE id = $1", [id]);
    if (!exist.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (userRole === "CS / Sales" && Number(exist.rows[0].pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    let final_pic_id = pic_id;
    if (userRole === "CS / Sales") {
      final_pic_id = userId;
    }

    const result = await client.query(
      `UPDATE leads SET status=$1, tags=$2, notes=$3, pic_id=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [status, tags, notes, final_pic_id || null, id]
    );
    return NextResponse.json(result.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.id;

  const { id } = await params;
  const client = await pool.connect();
  try {
    const exist = await client.query("SELECT pic_id FROM leads WHERE id = $1", [id]);
    if (!exist.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (userRole === "CS / Sales" && Number(exist.rows[0].pic_id) !== Number(userId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await client.query("DELETE FROM leads WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally { client.release(); }
}
