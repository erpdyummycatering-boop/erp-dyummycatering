import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams: p } = new URL(req.url);
  const page = Math.max(1, Number(p.get("page") || 1));
  const limit = Math.min(100, Number(p.get("limit") || 20));
  const offset = (page - 1) * limit;
  const search = p.get("search") || "";
  const date_from = p.get("date_from") || "";
  const date_to = p.get("date_to") || "";

  const wheres: string[] = ["pu.lini = 'siap_saji'"];
  const vals: any[] = [];
  let idx = 1;

  if (search.trim()) {
    wheres.push(`(pu.nota_ref ILIKE $${idx} OR pu.keterangan ILIKE $${idx} OR c.nama_akun ILIKE $${idx} OR kb.nama_rekening ILIKE $${idx})`);
    vals.push(`%${search.trim()}%`);
    idx++;
  }
  if (date_from) {
    wheres.push(`pu.purchase_date >= $${idx}`);
    vals.push(date_from);
    idx++;
  }
  if (date_to) {
    wheres.push(`pu.purchase_date <= $${idx}`);
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
      client.query(`SELECT COUNT(*) FROM purchases pu LEFT JOIN coa c ON pu.coa_id = c.id LEFT JOIN kas_bank kb ON pu.kas_bank_id = kb.id WHERE ${whereSql}`, vals),
      client.query(
        `SELECT 
          pu.*,
          c.nama_akun AS coa_nama,
          c.kode_akun AS coa_kode,
          kb.nama_rekening AS kas_bank_nama,
          kb.no_rekening AS kas_bank_norek,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', km.id,
                  'tanggal', km.mutasi_date,
                  'nominal', km.nominal,
                  'rekening', kbm.nama_rekening,
                  'bank', kbm.nama_bank,
                  'keterangan', km.keterangan,
                  'created_at', km.created_at
                ) ORDER BY km.mutasi_date ASC, km.id ASC
              )
              FROM kas_mutasi km
              LEFT JOIN kas_bank kbm ON km.kas_bank_id = kbm.id
              WHERE km.ref_type = 'pembelian' AND km.ref_id = pu.id AND km.jenis = 'Keluar'
            ),
            '[]'::json
          ) AS cicilan_history
        FROM purchases pu
        LEFT JOIN coa c ON pu.coa_id = c.id
        LEFT JOIN kas_bank kb ON pu.kas_bank_id = kb.id
        WHERE ${whereSql}
        ORDER BY pu.purchase_date DESC, pu.id DESC
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
    console.error("Gagal mengambil data nota pembelian HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id || null;

  const body = await req.json();
  const { purchase_date, nota_ref, keterangan, total_amount, coa_id, kas_bank_id, dibayar } = body;

  if (!purchase_date || !keterangan || !total_amount) {
    return NextResponse.json(
      { error: "Tanggal, Keterangan, dan Total Nominal wajib diisi." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const total = Number(total_amount);
    let paidAmount = 0;
    const isHutang = kas_bank_id === "hutang" || kas_bank_id === "0" || !kas_bank_id;

    if (isHutang) {
      paidAmount = 0;
    } else {
      paidAmount = dibayar !== undefined && dibayar !== null ? Math.min(total, Math.max(0, Number(dibayar))) : total;
    }

    const sisa = Math.max(0, total - paidAmount);
    let statusPembayaran = "Lunas";
    if (paidAmount === 0) statusPembayaran = "Belum Lunas";
    else if (sisa > 0) statusPembayaran = "Sebagian";

    // Auto-generate nota_ref if left empty
    let finalNotaRef = nota_ref && nota_ref.trim() ? nota_ref.trim() : "";
    if (!finalNotaRef) {
      const dateClean = String(purchase_date).replace(/-/g, "");
      const randomSeq = String(Math.floor(100 + Math.random() * 900));
      finalNotaRef = `NOTA-SS-${dateClean}-${randomSeq}`;
    }

    // 1. Resolve HPP CoA (default to 5-1001 HPP Bahan Baku SS if not provided)
    let selectedCoaId = coa_id;
    if (!selectedCoaId) {
      const coaRes = await client.query("SELECT id FROM coa WHERE kode_akun = '5-1001' AND lini = 'siap_saji' LIMIT 1");
      if (coaRes.rows.length > 0) selectedCoaId = coaRes.rows[0].id;
    }

    // 2. Insert Purchases
    const insRes = await client.query(
      `INSERT INTO purchases (lini, ref_type, finance_id, purchase_date, nota_ref, keterangan, total_amount, coa_id, kas_bank_id, status, dibayar, sisa_hutang, status_pembayaran)
       VALUES ('siap_saji', 'pembelian_nota', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        purchase_date,
        finalNotaRef,
        keterangan.trim(),
        total,
        selectedCoaId,
        paidAmount > 0 && !isHutang ? Number(kas_bank_id) : null,
        sisa > 0 ? "Hutang" : "Final",
        paidAmount,
        sisa,
        statusPembayaran,
      ]
    );
    const purchaseId = insRes.rows[0].id;

    // 3. Insert Journal Entries
    // Debet: Beban HPP (selectedCoaId) sebesar total
    // Kredit: Kas/Bank (sebesar paidAmount) jika ada pembayaran, dan Kredit Utang Usaha (sebesar sisa) jika ada sisa
    if (selectedCoaId) {
      // 3A. Kas/Bank credit for paidAmount
      if (paidAmount > 0 && !isHutang) {
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

        if (coaKasId) {
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              purchase_date,
              purchaseId,
              finalNotaRef,
              selectedCoaId,
              coaKasId,
              paidAmount,
              `Pembelian HPP (${statusPembayaran}): ${keterangan.trim()}`,
              paidAmount,
              sisa,
              statusPembayaran,
            ]
          );

          // Kas Mutasi & Potong Saldo Kas
          await client.query(
            `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
             VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'pembelian', $4, $5)`,
            [kas_bank_id, purchase_date, paidAmount, purchaseId, `Nota HPP ${finalNotaRef}: ${keterangan.trim()}`]
          );

          await client.query(
            "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
            [paidAmount, kas_bank_id]
          );
        }
      }

      // 3B. Utang Usaha (2-1001) credit for sisa
      if (sisa > 0) {
        const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
        if (coaUtangRes.rows.length > 0) {
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              purchase_date,
              purchaseId,
              finalNotaRef,
              selectedCoaId,
              coaUtangRes.rows[0].id,
              sisa,
              `Pembelian HPP (Hutang Usaha / Tempo Sisa Rp ${sisa.toLocaleString("id-ID")}): ${keterangan.trim()}`,
              paidAmount,
              sisa,
              statusPembayaran,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(insRes.rows[0], { status: 201 });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mencatat nota pembelian HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, purchase_date, nota_ref, keterangan, total_amount, coa_id, kas_bank_id, dibayar } = body;

  if (!id || !purchase_date || !keterangan || !total_amount) {
    return NextResponse.json(
      { error: "ID, Tanggal, Keterangan, dan Total Nominal wajib diisi." },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const purchaseId = Number(id);
    const pCheck = await client.query("SELECT * FROM purchases WHERE id = $1 FOR UPDATE", [purchaseId]);
    if (pCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data pembelian HPP tidak ditemukan." }, { status: 404 });
    }

    const total = Number(total_amount);
    const isHutang = kas_bank_id === "hutang" || kas_bank_id === "0" || !kas_bank_id;
    let paidAmount = 0;
    if (isHutang) {
      paidAmount = 0;
    } else {
      paidAmount = dibayar !== undefined && dibayar !== null ? Math.min(total, Math.max(0, Number(dibayar))) : total;
    }
    const sisa = Math.max(0, total - paidAmount);
    let statusPembayaran = "Lunas";
    if (paidAmount === 0) statusPembayaran = "Belum Lunas";
    else if (sisa > 0) statusPembayaran = "Sebagian";

    // 1. Refund previous kas_mutasi
    const oldMutasiRes = await client.query(
      "SELECT * FROM kas_mutasi WHERE ref_type = 'pembelian' AND ref_id = $1",
      [purchaseId]
    );
    for (const m of oldMutasiRes.rows) {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [Number(m.nominal), m.kas_bank_id]
      );
    }
    await client.query("DELETE FROM kas_mutasi WHERE ref_type = 'pembelian' AND ref_id = $1", [purchaseId]);
    await client.query("DELETE FROM journals WHERE ref_type = 'pembelian' AND ref_id = $1", [purchaseId]);

    // 2. Update purchases
    const updRes = await client.query(
      `UPDATE purchases 
       SET purchase_date = $1,
           nota_ref = $2,
           keterangan = $3,
           total_amount = $4,
           coa_id = $5,
           kas_bank_id = $6,
           status = $7,
           dibayar = $8,
           sisa_hutang = $9,
           status_pembayaran = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        purchase_date,
        nota_ref || `NOTA-${purchaseId}`,
        keterangan.trim(),
        total,
        Number(coa_id),
        paidAmount > 0 && !isHutang ? Number(kas_bank_id) : null,
        sisa > 0 ? "Hutang" : "Final",
        paidAmount,
        sisa,
        statusPembayaran,
        purchaseId,
      ]
    );

    // 3. Re-create Journals & Kas Mutasi
    if (coa_id) {
      if (paidAmount > 0 && !isHutang) {
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

        if (coaKasId) {
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              purchase_date,
              purchaseId,
              nota_ref || `NOTA-${purchaseId}`,
              Number(coa_id),
              coaKasId,
              paidAmount,
              `Pembelian HPP (${statusPembayaran}): ${keterangan.trim()}`,
              paidAmount,
              sisa,
              statusPembayaran,
            ]
          );

          await client.query(
            `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
             VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'pembelian', $4, $5)`,
            [kas_bank_id, purchase_date, paidAmount, purchaseId, `Nota HPP ${nota_ref}: ${keterangan.trim()}`]
          );

          await client.query(
            "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
            [paidAmount, kas_bank_id]
          );
        }
      }

      if (sisa > 0) {
        const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
        if (coaUtangRes.rows.length > 0) {
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              purchase_date,
              purchaseId,
              nota_ref || `NOTA-${purchaseId}`,
              Number(coa_id),
              coaUtangRes.rows[0].id,
              sisa,
              `Pembelian HPP (Hutang Usaha / Tempo Sisa Rp ${sisa.toLocaleString("id-ID")}): ${keterangan.trim()}`,
              paidAmount,
              sisa,
              statusPembayaran,
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(updRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal mengupdate nota HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const reason = searchParams.get("reason") || "";

  if (!id) {
    return NextResponse.json({ error: "Parameter ID pembelian HPP wajib diisi." }, { status: 400 });
  }
  if (!reason || reason.trim().length < 5) {
    return NextResponse.json({ error: "Alasan pembatalan wajib diisi (minimal 5 karakter)." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const purchaseId = Number(id);

    const pCheck = await client.query("SELECT * FROM purchases WHERE id = $1 FOR UPDATE", [purchaseId]);
    if (pCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data pembelian HPP tidak ditemukan." }, { status: 404 });
    }

    // 1. Refund kas_mutasi
    const oldMutasiRes = await client.query(
      "SELECT * FROM kas_mutasi WHERE ref_type = 'pembelian' AND ref_id = $1",
      [purchaseId]
    );
    for (const m of oldMutasiRes.rows) {
      await client.query(
        "UPDATE kas_bank SET saldo_kini = saldo_kini + $1, updated_at = NOW() WHERE id = $2",
        [Number(m.nominal), m.kas_bank_id]
      );
    }
    await client.query("DELETE FROM kas_mutasi WHERE ref_type = 'pembelian' AND ref_id = $1", [purchaseId]);

    // 2. Mark journals as dibatalkan
    await client.query(
      `UPDATE journals
       SET status = 'dibatalkan',
           cancel_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE ref_type = 'pembelian' AND ref_id = $2`,
      [reason.trim(), purchaseId]
    );

    // 3. Mark purchases as Dibatalkan
    const updatedP = await client.query(
      `UPDATE purchases
       SET status = 'Dibatalkan',
           status_pembayaran = 'Dibatalkan',
           cancel_reason = $1,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [reason.trim(), purchaseId]
    );

    await client.query("COMMIT");
    return NextResponse.json({ message: "Pembelian HPP berhasil dibatalkan.", data: updatedP.rows[0] });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal membatalkan pembelian HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(req: NextRequest) {
  // Parsial / Pelunasan Hutang Pembelian HPP (Mendukung Single maupun Bulk Pay)
  const body = await req.json();
  const { id, ids, nominal_bayar, kas_bank_id, tanggal_bayar, keterangan } = body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Tangani skenario Bulk Payment jika `ids` dikirimkan (array of ID)
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

      const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
      const coaUtangId = coaUtangRes.rows.length > 0 ? coaUtangRes.rows[0].id : null;

      let totalBulkPaid = 0;
      const processedPurchases: any[] = [];

      for (const rawId of ids) {
        const pId = Number(rawId);
        if (!pId) continue;

        const pCheck = await client.query("SELECT * FROM purchases WHERE id = $1 FOR UPDATE", [pId]);
        if (pCheck.rows.length === 0) continue;
        const p = pCheck.rows[0];
        const sisaSekarang = Number(p.sisa_hutang || 0);
        if (sisaSekarang <= 0) continue; // Lewati yang sudah lunas

        const newPaid = Number(p.dibayar || 0) + sisaSekarang;
        const newSisa = 0;
        const newStatus = "Lunas";

        await client.query(
          `UPDATE purchases
           SET dibayar = $1,
               sisa_hutang = $2,
               status_pembayaran = $3,
               status = 'Final',
               updated_at = NOW()
           WHERE id = $4`,
          [newPaid, newSisa, newStatus, pId]
        );

        if (coaUtangId && coaKasId) {
          await client.query(
            `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
             VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              payDate,
              pId,
              p.nota_ref || `NOTA-${pId}`,
              coaUtangId,
              coaKasId,
              sisaSekarang,
              `Pembayaran Lunas (Bulk) Hutang HPP ${p.nota_ref || `NOTA-${pId}`}: ${keterangan || p.keterangan}`,
              newPaid,
              newSisa,
              newStatus,
            ]
          );

          await client.query(
            `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
             VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'pembelian', $4, $5)`,
            [kas_bank_id, payDate, sisaSekarang, pId, `Bulk Bayar Hutang HPP ${p.nota_ref || `NOTA-${pId}`}: ${keterangan || p.keterangan}`]
          );
        }

        totalBulkPaid += sisaSekarang;
        processedPurchases.push(pId);
      }

      if (totalBulkPaid > 0) {
        await client.query(
          "UPDATE kas_bank SET saldo_kini = saldo_kini - $1, updated_at = NOW() WHERE id = $2",
          [totalBulkPaid, kas_bank_id]
        );
      }

      await client.query("COMMIT");
      return NextResponse.json({
        message: `Berhasil melunasi ${processedPurchases.length} nota hutang HPP sekaligus (Total: Rp ${totalBulkPaid.toLocaleString("id-ID")})!`,
        total_paid: totalBulkPaid,
        processed_ids: processedPurchases,
      });
    }

    // Skenario Single Pay
    const purchaseId = Number(id);
    const payAmount = Number(nominal_bayar);

    if (!purchaseId || isNaN(payAmount) || payAmount <= 0 || !kas_bank_id) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "ID, nominal pembayaran valid, dan Rekening Kas/Bank wajib diisi." },
        { status: 400 }
      );
    }

    const pCheck = await client.query("SELECT * FROM purchases WHERE id = $1 FOR UPDATE", [purchaseId]);
    if (pCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Data pembelian HPP tidak ditemukan." }, { status: 404 });
    }

    const p = pCheck.rows[0];
    const sisaSekarang = Number(p.sisa_hutang || 0);
    if (sisaSekarang <= 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Hutang pembelian ini sudah lunas." }, { status: 400 });
    }

    const actualPay = Math.min(sisaSekarang, payAmount);
    const newPaid = Number(p.dibayar || 0) + actualPay;
    const newSisa = Math.max(0, sisaSekarang - actualPay);
    const newStatus = newSisa === 0 ? "Lunas" : "Sebagian";
    const payDate = tanggal_bayar || new Date().toISOString().split("T")[0];

    // 1. Update purchase
    const updRes = await client.query(
      `UPDATE purchases
       SET dibayar = $1,
           sisa_hutang = $2,
           status_pembayaran = $3,
           status = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [newPaid, newSisa, newStatus, newSisa === 0 ? "Final" : "Hutang", purchaseId]
    );

    // 2. Resolve kas_bank CoA
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

    // 3. Resolve Utang Usaha CoA (2-1001) -> DEBET Utang Usaha, KREDIT Kas/Bank
    const coaUtangRes = await client.query("SELECT id FROM coa WHERE kode_akun = '2-1001' AND lini = 'siap_saji' LIMIT 1");
    if (coaUtangRes.rows.length > 0 && coaKasId) {
      await client.query(
        `INSERT INTO journals (lini, journal_date, ref_type, ref_id, ref_no, akun_debit, akun_kredit, nominal, keterangan, dibayar, sisa_hutang, status_pembayaran)
         VALUES ('siap_saji', $1, 'pembelian', $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payDate,
          purchaseId,
          p.nota_ref || `NOTA-${purchaseId}`,
          coaUtangRes.rows[0].id,
          coaKasId,
          actualPay,
          `Pembayaran Cicilan/Pelunasan Hutang HPP ${p.nota_ref}: ${keterangan || p.keterangan}`,
          newPaid,
          newSisa,
          newStatus,
        ]
      );

      // Kas Mutasi Keluar
      await client.query(
        `INSERT INTO kas_mutasi (kas_bank_id, lini, mutasi_date, jenis, nominal, ref_type, ref_id, keterangan)
         VALUES ($1, 'siap_saji', $2, 'Keluar', $3, 'pembelian', $4, $5)`,
        [kas_bank_id, payDate, actualPay, purchaseId, `Bayar Hutang HPP ${p.nota_ref}: ${keterangan || p.keterangan}`]
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
    console.error("Gagal mencatat pembayaran hutang HPP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

