import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// POST: Add a custom BOM item (not from recipes) — contributes to total_estimated_hpp
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { item_name, quantity, uom, estimated_price, subtotal } = body;

  if (!item_name || !quantity || !estimated_price) {
    return NextResponse.json({ error: "item_name, quantity, estimated_price required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check schedule exists
    const schedRes = await client.query(`SELECT * FROM production_schedules WHERE id = $1`, [id]);
    if (!schedRes.rows.length) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

    // Ensure a PR exists or is pending for this schedule — store custom items as pr_items
    // We store custom items directly in pr_items linked to a Draft PR for this schedule
    let prRes = await client.query(`SELECT id FROM purchase_requests WHERE schedule_id = $1`, [id]);
    let prId: number;

    if (!prRes.rows.length) {
      // Auto-create a draft PR to hold custom items
      const newPR = await client.query(
        `INSERT INTO purchase_requests (schedule_id, chef_id, total_pr_value, status)
         VALUES ($1, $2, 0, 'Draft') RETURNING id`,
        [id, schedRes.rows[0].chef_id]
      );
      prId = newPR.rows[0].id;
    } else {
      prId = prRes.rows[0].id;
    }

    // Insert into pr_items
    await client.query(
      `INSERT INTO pr_items (pr_id, item_name, quantity, uom, estimated_price, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [prId, item_name, quantity, uom, estimated_price, subtotal]
    );

    // Update total_pr_value on PR
    await client.query(
      `UPDATE purchase_requests SET total_pr_value = (
        SELECT COALESCE(SUM(subtotal), 0) FROM pr_items WHERE pr_id = $1
      ) WHERE id = $1`,
      [prId]
    );

    // Update total_estimated_hpp on schedule = menus HPP + custom items subtotal
    const totalRes = await client.query(`
      SELECT
        COALESCE((SELECT SUM(hpp_subtotal) FROM schedule_menus WHERE schedule_id = $1), 0) +
        COALESCE((SELECT SUM(pi.subtotal) FROM pr_items pi WHERE pi.pr_id = $2), 0)
      AS total_hpp`, [id, prId]
    );
    const totalHPP = Number(totalRes.rows[0].total_hpp);
    const budgetLimit = Number(schedRes.rows[0].budget_limit);
    const newStatus = totalHPP > budgetLimit && budgetLimit > 0 ? "Overbudget Warning" : totalHPP > 0 ? "Approved" : "Draft";

    await client.query(
      `UPDATE production_schedules SET total_estimated_hpp=$1, status=$2, updated_at=NOW() WHERE id=$3`,
      [totalHPP, newStatus, id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true, totalHPP, status: newStatus }, { status: 201 });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}

// DELETE: Remove a custom item by item_id (pr_items row)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("item_id");
  if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the pr_id from this item
    const itemRes = await client.query(`SELECT pr_id FROM pr_items WHERE id = $1`, [itemId]);
    if (!itemRes.rows.length) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    const prId = itemRes.rows[0].pr_id;

    await client.query(`DELETE FROM pr_items WHERE id = $1`, [itemId]);

    // Update PR total
    await client.query(
      `UPDATE purchase_requests SET total_pr_value = (
        SELECT COALESCE(SUM(subtotal), 0) FROM pr_items WHERE pr_id = $1
      ) WHERE id = $1`,
      [prId]
    );

    // Recalculate schedule HPP
    const totalRes = await client.query(`
      SELECT
        COALESCE((SELECT SUM(hpp_subtotal) FROM schedule_menus WHERE schedule_id = $1), 0) +
        COALESCE((SELECT SUM(pi.subtotal) FROM pr_items pi WHERE pi.pr_id = $2), 0)
      AS total_hpp`, [id, prId]
    );
    const totalHPP = Number(totalRes.rows[0].total_hpp);
    const schedRes = await client.query(`SELECT budget_limit FROM production_schedules WHERE id = $1`, [id]);
    const budgetLimit = Number(schedRes.rows[0].budget_limit);
    const newStatus = totalHPP > budgetLimit && budgetLimit > 0 ? "Overbudget Warning" : totalHPP > 0 ? "Approved" : "Draft";

    await client.query(
      `UPDATE production_schedules SET total_estimated_hpp=$1, status=$2, updated_at=NOW() WHERE id=$3`,
      [totalHPP, newStatus, id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true, totalHPP, status: newStatus });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
}
