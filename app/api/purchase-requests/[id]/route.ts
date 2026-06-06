import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT pr.*, u.name as chef_name, ps.target_date,
        (SELECT json_agg(json_build_object(
          'id', pi.id, 'item_name', pi.item_name, 'quantity', pi.quantity,
          'uom', pi.uom, 'estimated_price', pi.estimated_price, 'subtotal', pi.subtotal
        )) FROM pr_items pi WHERE pi.pr_id = pr.id) as items
       FROM purchase_requests pr LEFT JOIN users u ON pr.chef_id = u.id
       LEFT JOIN production_schedules ps ON pr.schedule_id = ps.id
       WHERE pr.id = $1`, [id]
    );
    if (!res.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE purchase_requests SET status=$1 WHERE id=$2 RETURNING *`, [status, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}
