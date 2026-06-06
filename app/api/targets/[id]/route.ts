import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { periode, jenis, target, satuan } = await req.json();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE targets SET periode=$1, jenis=$2, target=$3, satuan=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [periode, jenis, Number(target), satuan, id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } finally {
    client.release();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM targets WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
  } finally {
    client.release();
  }
}
