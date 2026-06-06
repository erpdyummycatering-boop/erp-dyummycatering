import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT p.*, pc.name as category 
       FROM products p 
       LEFT JOIN product_categories pc ON p.category_id = pc.id 
       WHERE p.id = $1`, 
      [id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, category_id, price, description, status, image_url } = body;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE products SET name=$1, category_id=$2, price=$3, description=$4, status=$5, image_url=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [name, category_id ? Number(category_id) : null, price, description, status, image_url || null, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM products WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } finally { client.release(); }
}
