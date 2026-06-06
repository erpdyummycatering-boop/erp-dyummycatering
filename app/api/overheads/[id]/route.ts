import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM overheads WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally {
    client.release();
  }
}
