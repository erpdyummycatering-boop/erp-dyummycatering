import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { recipe_id, quantity_pax } = body;
  if (!recipe_id || !quantity_pax) {
    return NextResponse.json({ error: "recipe_id and quantity_pax required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const recipeRes = await client.query("SELECT standard_cost FROM recipes WHERE id = $1", [recipe_id]);
    if (!recipeRes.rows.length) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    const standardCost = Number(recipeRes.rows[0].standard_cost);
    const hppSubtotal = standardCost * Number(quantity_pax);

    await client.query(
      `INSERT INTO schedule_menus (schedule_id, recipe_id, quantity_pax, hpp_subtotal)
       VALUES ($1,$2,$3,$4)`,
      [id, recipe_id, quantity_pax, hppSubtotal]
    );

    const totalRes = await client.query(
      `SELECT COALESCE(SUM(hpp_subtotal), 0) as total FROM schedule_menus WHERE schedule_id = $1`, [id]
    );
    const totalHPP = Number(totalRes.rows[0].total);
    const schedRes = await client.query(`SELECT budget_limit FROM production_schedules WHERE id = $1`, [id]);
    const budgetLimit = Number(schedRes.rows[0].budget_limit);
    const newStatus = totalHPP > budgetLimit ? "Overbudget Warning" : "Approved";

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const menuId = searchParams.get("menu_id");
  if (!menuId) return NextResponse.json({ error: "menu_id required" }, { status: 400 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM schedule_menus WHERE id = $1", [menuId]);
    const totalRes = await client.query(
      `SELECT COALESCE(SUM(hpp_subtotal), 0) as total FROM schedule_menus WHERE schedule_id = $1`, [id]
    );
    const totalHPP = Number(totalRes.rows[0].total);
    const schedRes = await client.query(`SELECT budget_limit FROM production_schedules WHERE id = $1`, [id]);
    const budgetLimit = Number(schedRes.rows[0].budget_limit);
    const newStatus = totalHPP > budgetLimit ? "Overbudget Warning" : totalHPP === 0 ? "Draft" : "Approved";
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
