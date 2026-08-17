import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const kelompok = searchParams.get("kelompok") || "";

  const client = await pool.connect();
  try {
    const wheres: string[] = ["lini = 'siap_saji'"];
    const vals: any[] = [];
    let idx = 1;

    if (search) {
      wheres.push(`(kode_akun ILIKE $${idx} OR nama_akun ILIKE $${idx} OR sub_kelompok ILIKE $${idx})`);
      vals.push(`%${search}%`);
      idx++;
    }

    if (kelompok) {
      wheres.push(`kelompok = $${idx}`);
      vals.push(kelompok);
      idx++;
    }

    const whereClause = wheres.length > 0 ? "WHERE " + wheres.join(" AND ") : "";

    const res = await client.query(
      `SELECT id, lini, kode_akun, nama_akun, kelompok, sub_kelompok, is_active, created_at
       FROM coa
       ${whereClause}
       ORDER BY kode_akun ASC`,
      vals
    );

    return NextResponse.json({ data: res.rows });
  } catch (error: any) {
    console.error("Gagal mengambil data COA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { kode_akun, nama_akun, kelompok, sub_kelompok, is_active } = body;

    if (!kode_akun || !nama_akun || !kelompok) {
      return NextResponse.json(
        { error: "Kode Akun, Nama Akun, dan Kelompok wajib diisi." },
        { status: 400 }
      );
    }

    // Check duplicate code
    const dupRes = await client.query(
      "SELECT id FROM coa WHERE kode_akun = $1 AND lini = 'siap_saji' LIMIT 1",
      [kode_akun]
    );

    if (dupRes.rows.length > 0) {
      return NextResponse.json({ error: "Kode Akun sudah digunakan." }, { status: 400 });
    }

    const res = await client.query(
      `INSERT INTO coa (lini, kode_akun, nama_akun, kelompok, sub_kelompok, is_active)
       VALUES ('siap_saji', $1, $2, $3, $4, $5)
       RETURNING id, kode_akun, nama_akun, kelompok, sub_kelompok, is_active`,
      [kode_akun, nama_akun, kelompok, sub_kelompok || kelompok, is_active !== false]
    );

    return NextResponse.json({
      message: "Akun COA berhasil ditambahkan.",
      data: res.rows[0],
    });
  } catch (error: any) {
    console.error("Gagal menambah COA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await req.json();
    const { id, kode_akun, nama_akun, kelompok, sub_kelompok, is_active } = body;

    if (!id || !kode_akun || !nama_akun || !kelompok) {
      return NextResponse.json(
        { error: "ID, Kode Akun, Nama Akun, dan Kelompok wajib diisi." },
        { status: 400 }
      );
    }

    // Check duplicate code for other IDs
    const dupRes = await client.query(
      "SELECT id FROM coa WHERE kode_akun = $1 AND id <> $2 AND lini = 'siap_saji' LIMIT 1",
      [kode_akun, Number(id)]
    );

    if (dupRes.rows.length > 0) {
      return NextResponse.json({ error: "Kode Akun sudah digunakan oleh akun lain." }, { status: 400 });
    }

    await client.query(
      `UPDATE coa
       SET kode_akun = $1, nama_akun = $2, kelompok = $3, sub_kelompok = $4, is_active = $5
       WHERE id = $6`,
      [kode_akun, nama_akun, kelompok, sub_kelompok || kelompok, is_active !== false, Number(id)]
    );

    return NextResponse.json({ message: "Akun COA berhasil diperbarui." });
  } catch (error: any) {
    console.error("Gagal update COA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID akun wajib diisi" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Check if referenced by journals
    const jouRes = await client.query(
      "SELECT id FROM journals WHERE debit_account_id = $1 OR credit_account_id = $1 LIMIT 1",
      [Number(id)]
    );

    if (jouRes.rows.length > 0) {
      return NextResponse.json(
        { error: "Akun ini tidak dapat dihapus karena sudah memiliki riwayat jurnal keuangan." },
        { status: 400 }
      );
    }

    await client.query("DELETE FROM coa WHERE id = $1", [Number(id)]);

    return NextResponse.json({ message: "Akun COA berhasil dihapus." });
  } catch (error: any) {
    console.error("Gagal hapus COA:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
