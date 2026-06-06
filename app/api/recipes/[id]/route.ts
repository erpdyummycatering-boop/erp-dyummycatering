import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { menu_name, ingredients, standard_cost, product_id } = body;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE recipes SET menu_name=$1, ingredients=$2, standard_cost=$3, product_id=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [menu_name, ingredients, standard_cost, product_id, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM recipes WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally { client.release(); }
}
