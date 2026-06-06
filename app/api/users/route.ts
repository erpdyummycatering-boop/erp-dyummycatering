import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, name, email, role, status, created_at FROM users ORDER BY role, name`
    );
    return NextResponse.json(res.rows);
  } finally { client.release(); }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, role, password } = body;
  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email, role required" }, { status: 400 });
  }
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ($1,$2,$3,$4,'Aktif') RETURNING id, name, email, role, status`,
      [name, email, password || "hashed_default", role]
    );
    return NextResponse.json(res.rows[0], { status: 201 });
  } finally { client.release(); }
}
