import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Purchasing creates a PO from an approved PR
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { purchasing_id, po_date } = body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prRes = await client.query(`SELECT * FROM purchase_requests WHERE id = $1`, [id]);
    if (!prRes.rows.length) return NextResponse.json({ error: "PR not found" }, { status: 404 });
    const pr = prRes.rows[0];

    if (pr.status !== "Sent to Purchasing") {
      return NextResponse.json({ error: "PR belum dikirim ke Purchasing" }, { status: 400 });
    }

    const existingPO = await client.query(`SELECT id FROM purchase_orders WHERE pr_id = $1`, [id]);
    if (existingPO.rows.length) {
      return NextResponse.json({ error: "PO sudah ada untuk PR ini", po_id: existingPO.rows[0].id }, { status: 409 });
    }

    const poRes = await client.query(
      `INSERT INTO purchase_orders (pr_id, purchasing_id, po_date, total_actual_cost, status_po, status_cost)
       VALUES ($1, $2, $3, 0, 'Diproses', 'Pending') RETURNING *`,
      [id, purchasing_id ?? null, po_date ?? new Date().toISOString().split("T")[0]]
    );

    // Mark PR as processed
    await client.query(`UPDATE purchase_requests SET status='Diproses' WHERE id=$1`, [id]);

    await client.query("COMMIT");
    return NextResponse.json(poRes.rows[0], { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
