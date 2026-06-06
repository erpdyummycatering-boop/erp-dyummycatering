import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { total_actual_cost, status_po, status_cost, variance_notes, finance_id } = body;
  const client = await pool.connect();
  try {
    const poRes = await client.query(
      `SELECT po.*, pr.total_pr_value as estimated_cost
       FROM purchase_orders po JOIN purchase_requests pr ON po.pr_id = pr.id
       WHERE po.id = $1`, [id]
    );
    if (!poRes.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const estimatedCost = Number(poRes.rows[0].estimated_cost);
    const actualCost = Number(total_actual_cost ?? poRes.rows[0].total_actual_cost);
    const computedStatusCost = status_cost ?? (actualCost > estimatedCost ? "Overbudget" : "Safe");

    const res = await client.query(
      `UPDATE purchase_orders
       SET total_actual_cost=$1, status_po=$2, status_cost=$3, variance_notes=$4, finance_id=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [actualCost, status_po ?? poRes.rows[0].status_po, computedStatusCost,
       variance_notes ?? null, finance_id ?? poRes.rows[0].finance_id, id]
    );
    return NextResponse.json(res.rows[0]);
  } finally { client.release(); }
}
