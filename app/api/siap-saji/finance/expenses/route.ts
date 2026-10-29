import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = ["j.lini = 'siap_saji'", "j.ref_type = 'biaya'", "(j.id = j.ref_id OR j.ref_id IS NULL OR j.ref_id = 0)"];
  const vals: any[] = [];
  let idx = 1;

  if (search.trim()) {
    wheres.push(`(j.ref_no ILIKE $${idx} OR j.keterangan ILIKE $${idx} OR c.nama_akun ILIKE $${idx} OR ck.nama_akun ILIKE $${idx})`);
    vals.push(`%${search.trim()}%`);
    idx++;
  }
  if (date_from) {
    wheres.push(`j.journal_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`j.journal_date <= $${idx}`);
    vals.push(date_to);
    idx++;
  }

  const whereSql = wheres.join(" AND ");

  const client = await pool.connect();
  try {
    const dataVals = [...vals, limit, offset];
    const limitIdx = vals.length + 1;
    const offsetIdx = vals.length + 2;

    const [countRes, dataRes] = await Promise.all([
      client.query(`SELECT COUNT(*) FROM journals j LEFT JOIN coa c ON j.akun_debit = c.id LEFT JOIN coa ck ON j.akun_kredit = ck.id WHERE ${whereSql}`, vals),
      client.query(
        `SELECT 
          j.*,
          c.nama_akun AS beban_nama,
          c.kode_akun AS beban_kode,
          ck.nama_akun AS kredit_nama,
          (
            SELECT km.kas_bank_id 
            FROM kas_mutasi km 
            WHERE km.ref_type = 'biaya' AND (km.ref_id = j.id OR km.ref_id = j.ref_id) AND km.jenis = 'Keluar'
            ORDER BY km.id ASC 
            LIMIT 1
          ) AS kas_bank_id,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', km.id,
                  'tanggal', km.mutasi_date,
                  'nominal', km.nominal,
                  'rekening', kb.nama_rekening,
                  'bank', kb.nama_bank,
                  'keterangan', km.keterangan,
                  'created_at', km.created_at
                ) ORDER BY km.mutasi_date ASC, km.id ASC
              )
              FROM kas_mutasi km
              LEFT JOIN kas_bank kb ON km.kas_bank_id = kb.id
              WHERE km.ref_type = 'biaya' AND (km.ref_id = j.id OR km.ref_id = j.ref_id) AND km.jenis = 'Keluar'
            ),
            '[]'::json
          ) AS cicilan_history
        FROM journals j
        LEFT JOIN coa c ON j.akun_debit = c.id
        LEFT JOIN coa ck ON j.akun_kredit = ck.id
        WHERE ${whereSql}
        ORDER BY j.journal_date DESC, j.id DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        dataVals
      ),
    ]);

    const total = Number(countRes.rows[0].count);
    return NextResponse.json({
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Gagal mengambil daftar biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { expense_date, keterangan, nominal, coa_id, kas_bank_id } = body;

  if (!expense_date || !keterangan || !nominal || !coa_id) {
    return NextResponse.json(
      { error: "Tanggal, Keterangan, Nominal, dan Kategori Beban wajib diisi." },
      { status: 400 }
    );
  }

  const isHutang = kas_bank_id === "hutang" || kas_bank_id === "hutang_lainnya" || String(kas_bank_id).startsWith("hutang_") || kas_bank_id === "0" || !kas_bank_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const total = Number(nominal);
    let paidAmount = 0;
    if (isHutang) {
      paidAmount = 0;
    } else {
      paidAmount = body.dibayar !== undefined && body.dibayar !== null
        ? Math.min(total, Math.max(0, Number(body.dibayar)))
        : total;
    }
    const sisa = Math.max(0, total - paidAmount);
    let statusPembayaran = "Lunas";
    if (paidAmount === 0) statusPembayaran = "Belum Lunas";
    else if (sisa > 0) statusPembayaran = "Sebagian";

    // Resolve Kredit Account (Kas/Bank or Utang Usaha / Hutang Lainnya)
    let coaKasId: number | null = null;
    let coaUtangId: number | null = null;
    let utangLabel = "Hutang Usaha / Tempo";

    if (kas_bank_id === "hutang_lainnya") {
      const coaHLRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1002' AND lini = 'siap_saji' LIMIT 1");
      if (coaHLRes.rows.length > 0) {
        coaUtangId = coaHLRes.rows[0].id;
        utangLabel = "Hutang Lainnya";
      }
    }

    if (!coaUtangId) {
      const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaUtangRes.rows.length > 0) coaUtangId = coaUtangRes.rows[0].id;
    }

    if (paidAmount > 0 && !isHutang) {
      const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
      if (kbRes.rows.length > 0) {
        if (kbRes.rows[0].coa_id) {
          coaKasId = Number(kbRes.rows[0].coa_id);
        } else {
          // Fallback if coa_id not yet linked
          const bankName = (kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening || "").toUpperCase();
          const fallbackRes = await client.query(
            `SELECT id FROM coa 
             WHERE lini = 'siap_saji' 
               AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
             ORDER BY id ASC LIMIT 1`,
            [`%${bankName}%`]
          );
          if (fallbackRes.rows.length > 0) coaKasId = fallbackRes.rows[0].id;
        }
      }
    }

    const primaryKreditId = paidAmount > 0 ? coaKasId : coaUtangId;
    if (!primaryKreditId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Akun kredit CoA tidak ditemukan." }, { status: 400 });
    }

    // Insert Primary Journal (or Full Journal)
    const jRes = await client.query(
      `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
       VALUES ('siap_saji', $1, 'biaya', 0, 'EXPENSE', $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        expense_date,
        Number(coa_id),
        primaryKreditId,
        total,
        isHutang ? `Biaya Operasional (${utangLabel}): ${keterangan.trim()}` : keterangan.trim(),
        paidAmount,
        sisa,
        statusPembayaran,
      ]
    );

    const journalId = jRes.rows[0].id;
    await client.query("UPDATE journals SET ref_id = $1, ref_no = $2 WHERE id = $1", [journalId, `EXP-${journalId}`]);

    // Record Kas Mutasi & Subtract Kas Balance if paidAmount > 0
    if (paidAmount > 0 && !isHutang) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'biaya', $4, $5)`,
        [kas_bank_id, expense_date, paidAmount, journalId, `Biaya Operasional (${statusPembayaran}): ${keterangan.trim()}`]
      );

      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [paidAmount, kas_bank_id]
      );
    }

    // If partial payment, also record Utang Usaha credit sub-journal if needed for balancing
    if (paidAmount > 0 && sisa > 0 && coaUtangId && coaKasId) {
      await client.query(
        `UPDATE journals SET nominal = $1, keterangan = $2 WHERE id = $3`,
        [paidAmount, `Biaya Operasional (Bayar DP/Sebagian Rp ${paidAmount.toLocaleString("id-ID")}): ${keterangan.trim()}`, journalId]
      );
      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
         VALUES ('siap_saji', $1, 'biaya', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          expense_date,
          journalId,
          `EXP-${journalId}`,
          Number(coa_id),
          coaUtangId,
          sisa,
          `Biaya Operasional (Hutang Usaha / Tempo Sisa Rp ${sisa.toLocaleString("id-ID")}): ${keterangan.trim()}`,
          paidAmount,
          sisa,
          statusPembayaran,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ...jRes.rows[0], dibayar: paidAmount, sisa_hutang: sisa, status_pembayaran: statusPembayaran }, { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, expense_date, keterangan, nominal, coa_id, kas_bank_id, dibayar } = body;

  if (!id || !expense_date || !keterangan || !nominal || !coa_id) {
    return NextResponse.json(
      { error: "ID, Tanggal, Keterangan, Nominal, dan Kategori Beban wajib diisi." },
      { status: 400 }
    );
  }

  const isHutang = kas_bank_id === "hutang" || kas_bank_id === "hutang_lainnya" || String(kas_bank_id).startsWith("hutang_") || kas_bank_id === "0" || !kas_bank_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const total = Number(nominal);
    let paidAmount = 0;
    if (isHutang) {
      paidAmount = 0;
    } else {
      paidAmount = dibayar !== undefined && dibayar !== null
        ? Math.min(total, Math.max(0, Number(dibayar)))
        : total;
    }
    const sisa = Math.max(0, total - paidAmount);
    let statusPembayaran = "Lunas";
    if (paidAmount === 0) statusPembayaran = "Belum Lunas";
    else if (sisa > 0) statusPembayaran = "Sebagian";

    // 1. Verify existing journal
    const jCheck = await client.query(
      "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' AND ref_type = 'biaya' FOR UPDATE",
      [id]
    );
    if (jCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data biaya operasional tidak ditemukan." }, { status: 404 });
    }

    // 2. Revert previous kas_mutasi and refund old saldo
    const oldMutasiRes = await client.query(
      "SELECT * FROM kas_mutasi WHERE ref_type = 'biaya' AND (ref_id = $1 OR ref_id IN (SELECT id FROM journals WHERE ref_id = $1 AND ref_type = 'biaya'))",
      [id]
    );
    for (const oldM of oldMutasiRes.rows) {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [Number(oldM.nominal), oldM.kas_bank_id]
      );
      await client.query("DELETE FROM kas_mutasi WHERE id = $1", [oldM.id]);
    }

    // Remove any secondary split journals for this expense
    await client.query(
      "DELETE FROM journals WHERE ref_type = 'biaya' AND ref_id = $1 AND id != $1",
      [id]
    );

    // 3. Resolve accounts
    let coaKasId: number | null = null;
    let coaUtangId: number | null = null;
    let utangLabel = "Hutang Usaha / Tempo";

    if (kas_bank_id === "hutang_lainnya") {
      const coaHLRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1002' AND lini = 'siap_saji' LIMIT 1");
      if (coaHLRes.rows.length > 0) {
        coaUtangId = coaHLRes.rows[0].id;
        utangLabel = "Hutang Lainnya";
      }
    }

    if (!coaUtangId) {
      const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaUtangRes.rows.length > 0) coaUtangId = coaUtangRes.rows[0].id;
    }

    if (paidAmount > 0 && !isHutang) {
      const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
      if (kbRes.rows.length > 0) {
        if (kbRes.rows[0].coa_id) {
          coaKasId = Number(kbRes.rows[0].coa_id);
        } else {
          const bankName = (kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening || "").toUpperCase();
          const fallbackRes = await client.query(
            `SELECT id FROM coa 
             WHERE lini = 'siap_saji' 
               AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
             ORDER BY id ASC LIMIT 1`,
            [`%${bankName}%`]
          );
          if (fallbackRes.rows.length > 0) coaKasId = fallbackRes.rows[0].id;
        }
      }
    }

    const primaryKreditId = paidAmount > 0 ? coaKasId : coaUtangId;
    if (!primaryKreditId) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Akun kredit CoA tidak ditemukan." }, { status: 400 });
    }

    // 4. Update Main Journal
    const finalKeterangan = isHutang && !keterangan.includes("Hutang")
      ? `Biaya Operasional (${utangLabel}): ${keterangan.trim()}`
      : (paidAmount > 0 && sisa > 0 ? `Biaya Operasional (Bayar DP/Sebagian Rp ${paidAmount.toLocaleString("id-ID")}): ${keterangan.trim()}` : keterangan.trim());

    const updNominal = (paidAmount > 0 && sisa > 0) ? paidAmount : total;

    const updRes = await client.query(
      `UPDATE journals
       SET journal_date = $1, akun_debit = $2, akun_kredit = $3, nominal = $4, keterangan = $5,
           dibayar = $6, sisa_hutang = $7, status_pembayaran = $8, status = 'posted', updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [expense_date, Number(coa_id), primaryKreditId, updNominal, finalKeterangan, paidAmount, sisa, statusPembayaran, id]
    );

    // 5. Insert new kas_mutasi & deduct new kas_bank if paidAmount > 0
    if (paidAmount > 0 && !isHutang) {
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'biaya', $4, $5)`,
        [kas_bank_id, expense_date, paidAmount, id, `Biaya Operasional (${statusPembayaran}): ${keterangan.trim()}`]
      );

      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [paidAmount, kas_bank_id]
      );
    }

    // 6. Secondary journal if split
    if (paidAmount > 0 && sisa > 0 && coaUtangId) {
      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
         VALUES ('siap_saji', $1, 'biaya', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          expense_date,
          id,
          `EXP-${id}`,
          Number(coa_id),
          coaUtangId,
          sisa,
          `Biaya Operasional (Hutang Usaha / Tempo Sisa Rp ${sisa.toLocaleString("id-ID")}): ${keterangan.trim()}`,
          paidAmount,
          sisa,
          statusPembayaran,
        ]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(updRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal memperbarui biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// PATCH: Pembayaran Cicilan / Pelunasan Hutang Biaya Operasional (Mendukung Single maupun Bulk Pay)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ids, nominal_bayar, kas_bank_id, tanggal_bayar, keterangan } = body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Skenario Bulk Payment jika `ids` dikirimkan (array of ID)
    if (Array.isArray(ids) && ids.length > 0) {
      if (!kas_bank_id) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Rekening Kas/Bank wajib dipilih." }, { status: 400 });
      }

      const payDate = tanggal_bayar || new Date().toISOString().split("T")[0];

      // Resolve kas_bank CoA
      const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
      let coaKasId: number | null = null;
      if (kbRes.rows.length > 0) {
        if (kbRes.rows[0].coa_id) {
          coaKasId = Number(kbRes.rows[0].coa_id);
        } else {
          const bankName = (kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening || "").toUpperCase();
          const fallbackRes = await client.query(
            `SELECT id FROM coa 
             WHERE lini = 'siap_saji' 
               AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
             ORDER BY id ASC LIMIT 1`,
            [`%${bankName}%`]
          );
          if (fallbackRes.rows.length > 0) coaKasId = fallbackRes.rows[0].id;
        }
      }

      const coaUtangDefaultRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      const defaultUtangId = coaUtangDefaultRes.rows.length > 0 ? coaUtangDefaultRes.rows[0].id : null;

      let totalBulkPaid = 0;
      const processedExpenses: any[] = [];

      for (const rawId of ids) {
        const expId = Number(rawId);
        if (!expId) continue;

        const jCheck = await client.query(
          "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' AND ref_type = 'biaya' FOR UPDATE",
          [expId]
        );
        if (jCheck.rows.length === 0) continue;
        const j = jCheck.rows[0];
        if (j.status === "dibatalkan") continue;

        const sisaSekarang = Number(j.sisa_hutang || 0);
        if (sisaSekarang <= 0) continue; // Lewati yang sudah lunas

        const newPaid = Number(j.dibayar || 0) + sisaSekarang;
        const newSisa = 0;
        const newStatus = "Lunas";

        await client.query(
          `UPDATE journals
           SET dibayar = $1,
               sisa_hutang = $2,
               status_pembayaran = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [newPaid, newSisa, newStatus, expId]
        );

        let debtDebitCoaId = j.akun_kredit || defaultUtangId;

        if (debtDebitCoaId && coaKasId) {
          // Jurnal pelunasan hutang biaya
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'biaya', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              payDate,
              expId,
              `EXP-${expId}`,
              debtDebitCoaId,
              coaKasId,
              sisaSekarang,
              `Pembayaran Lunas (Bulk) Hutang Biaya EXP-${expId}: ${keterangan || j.keterangan}`,
              newPaid,
              newSisa,
              newStatus,
            ]
          );

          // Kas mutasi keluar
          await client.query(
            `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
             VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'biaya', $4, $5)`,
            [kas_bank_id, payDate, sisaSekarang, expId, `Bulk Bayar Hutang Biaya EXP-${expId}: ${keterangan || j.keterangan}`]
          );
        }

        totalBulkPaid += sisaSekarang;
        processedExpenses.push(expId);
      }

      if (totalBulkPaid > 0) {
        await client.query(
          "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
          [totalBulkPaid, kas_bank_id]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({
        message: `Berhasil melunasi ${processedExpenses.length} hutang biaya operasional sekaligus (Total: Rp ${totalBulkPaid.toLocaleString("id-ID")})!`,
        total_paid: totalBulkPaid,
        processed_ids: processedExpenses,
      });
    }

    // Skenario Single Pay
    if (!id || !nominal_bayar || !kas_bank_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "ID Biaya Operasional, Nominal Bayar, dan Rekening Kas/Bank wajib diisi." },
        { status: 400 }
      );
    }

    const payAmount = Number(nominal_bayar);
    if (isNaN(payAmount) || payAmount <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Nominal bayar harus lebih dari 0." }, { status: 400 });
    }

    const jCheck = await client.query(
      "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' AND ref_type = 'biaya' FOR UPDATE",
      [id]
    );
    if (jCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data biaya operasional tidak ditemukan." }, { status: 404 });
    }

    const j = jCheck.rows[0];
    if (j.status === "dibatalkan") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Biaya operasional sudah dibatalkan." }, { status: 400 });
    }

    const sisaSekarang = Number(j.sisa_hutang || 0);
    if (sisaSekarang <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Hutang biaya ini sudah lunas." }, { status: 400 });
    }

    const actualPay = Math.min(sisaSekarang, payAmount);
    const newPaid = Number(j.dibayar || 0) + actualPay;
    const newSisa = Math.max(0, sisaSekarang - actualPay);
    const newStatus = newSisa === 0 ? "Lunas" : "Sebagian";
    const payDate = tanggal_bayar || new Date().toISOString().split("T")[0];

    // Update Main Journal
    const updRes = await client.query(
      `UPDATE journals
       SET dibayar = $1,
           sisa_hutang = $2,
           status_pembayaran = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newPaid, newSisa, newStatus, id]
    );

    // Resolve kas_bank CoA
    const kbRes = await client.query("SELECT * FROM kas_bank WHERE id = $1", [kas_bank_id]);
    let coaKasId: number | null = null;
    if (kbRes.rows.length > 0) {
      if (kbRes.rows[0].coa_id) {
        coaKasId = Number(kbRes.rows[0].coa_id);
      } else {
        const bankName = (kbRes.rows[0].nama_bank || kbRes.rows[0].nama_rekening || "").toUpperCase();
        const fallbackRes = await client.query(
          `SELECT id FROM coa 
           WHERE lini = 'siap_saji' 
             AND (nama_akun ILIKE $1 OR (kode_akun LIKE '1-%' AND (nama_akun ILIKE '%kas%' OR nama_akun ILIKE '%bank%')))
           ORDER BY id ASC LIMIT 1`,
          [`%${bankName}%`]
        );
        if (fallbackRes.rows.length > 0) coaKasId = fallbackRes.rows[0].id;
      }
    }

    // Resolve Debit account: use original journal's akun_kredit (e.g., Utang Usaha 2-1001 or Hutang Lainnya 2-1002)
    let debtDebitCoaId = j.akun_kredit;
    if (!debtDebitCoaId) {
      const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaUtangRes.rows.length > 0) debtDebitCoaId = coaUtangRes.rows[0].id;
    }
    if (debtDebitCoaId && coaKasId) {
      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
         VALUES ('siap_saji', $1, 'biaya', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payDate,
          id,
          `EXP-${id}`,
          debtDebitCoaId,
          coaKasId,
          actualPay,
          `Pembayaran Cicilan/Pelunasan Hutang Biaya: ${keterangan || j.keterangan}`,
          newPaid,
          newSisa,
          newStatus,
        ]
      );

      // Kas Mutasi Keluar
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'biaya', $4, $5)`,
        [kas_bank_id, payDate, actualPay, id, `Bayar Hutang Biaya EXP-${id}: ${keterangan || j.keterangan}`]
      );

      // Potong Saldo Kas
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
        [actualPay, kas_bank_id]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ message: "Pembayaran berhasil dicatat!", data: updRes.rows[0] });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat pembayaran hutang biaya:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE: Pembatalan Biaya Operasional dengan alasan wajib (Refund kas mutasi & mark dibatalkan)
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const reason = searchParams.get("reason") || "";

  if (!id) {
    return NextResponse.json({ error: "Parameter ID biaya operasional wajib diisi." }, { status: 400 });
  }
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: "Alasan pembatalan biaya wajib diisi (minimal 5 karakter)." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify journal exists
    const jCheck = await client.query(
      "SELECT * FROM journals WHERE id = $1 AND lini = 'siap_saji' AND ref_type = 'biaya' FOR UPDATE",
      [id]
    );
    if (jCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data biaya operasional tidak ditemukan." }, { status: 404 });
    }

    const j = jCheck.rows[0];
    if (j.status === "dibatalkan") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Biaya operasional ini sudah dibatalkan sebelumnya." }, { status: 400 });
    }

    // 2. Refund kas balance for all related mutasi
    const oldMutasiRes = await client.query(
      "SELECT * FROM kas_mutasi WHERE ref_type = 'biaya' AND (ref_id = $1 OR ref_id IN (SELECT id FROM journals WHERE ref_id = $1 AND ref_type = 'biaya'))",
      [id]
    );
    for (const oldM of oldMutasiRes.rows) {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [Number(oldM.nominal), oldM.kas_bank_id]
      );
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', CURRENT_DATE, 'Masuk', $2, 'biaya', $3, $4)`,
        [oldM.kas_bank_id, Number(oldM.nominal), id, `Pembatalan Biaya EXP-${id} [Alasan: ${reason.trim()}]: Refund Kas`]
      );
    }

    // 3. Mark journal(s) as dibatalkan with cancel reason
    const cleanReason = reason.trim();
    await client.query(
      `UPDATE journals
       SET status = 'dibatalkan',
           status_pembayaran = 'Dibatalkan',
           cancel_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE (id = $2 OR (ref_id = $2 AND ref_type = 'biaya')) AND lini = 'siap_saji'`,
      [cleanReason, id]
    );

    await client.query("COMMIT");
    return NextResponse.json({ message: "Biaya operasional berhasil dibatalkan.", cancel_reason: cleanReason });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal membatalkan biaya operasional:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
