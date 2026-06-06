import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, phone, email, type, address, notes } = body;
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, type=$4, address=$5, notes=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, phone, email, type, address, notes, id]
    );
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM customers WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
