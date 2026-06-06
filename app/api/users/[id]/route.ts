import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, email, role, status } = body;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE users SET name=$1, email=$2, role=$3, status=$4, updated_at=NOW()
       WHERE id=$5 RETURNING id, name, email, role, status`,
      [name, email, role, status, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("UPDATE users SET status='Nonaktif', updated_at=NOW() WHERE id=$1", [id]);
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
