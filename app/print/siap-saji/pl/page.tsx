import pool from "@/lib/db";

interface PageProps {
  searchParams: Promise<{
    date_from?: string;
    date_to?: string;
    month?: string;
    year?: string;
  }>;
}

export default async function PrintPlPage({ searchParams }: PageProps) {
  const p = await searchParams;
  const dateFrom = p.date_from || "";
  const dateTo = p.date_to || "";
  const month = p.month || "";
  const year = p.year || "2026";

  const client = await pool.connect();
  let details: any[] = [];

  try {
    let dateFilter = "";
    if (dateFrom && dateTo) {
      dateFilter = `AND j.journal_date >= '${dateFrom}'::date AND j.journal_date <= '${dateTo}'::date`;
    } else if (dateFrom) {
      dateFilter = `AND j.journal_date = '${dateFrom}'::date`;
    } else {
      dateFilter = `AND EXTRACT(YEAR FROM j.journal_date) = ${Number(year)}`;
      if (month && month !== "all") {
        dateFilter += ` AND EXTRACT(MONTH FROM j.journal_date) = ${Number(month)}`;
      }
    }

    const detailRes = await client.query(
      `SELECT 
        c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun,
        COALESCE(
          SUM(
            CASE 
              WHEN c.kelompok = 'Pendapatan' THEN 
                CASE WHEN j.akun_kredit = c.id THEN j.nominal WHEN j.akun_debit = c.id THEN -j.nominal ELSE 0 END
              WHEN c.kelompok = 'Beban' THEN 
                CASE WHEN j.akun_debit = c.id THEN j.nominal WHEN j.akun_kredit = c.id THEN -j.nominal ELSE 0 END
              ELSE j.nominal
            END
          ), 0
        ) AS total_nominal
      FROM coa c
      LEFT JOIN journals j ON (j.akun_debit = c.id OR j.akun_kredit = c.id) AND j.lini = 'siap_saji' ${dateFilter}
      WHERE c.lini = 'siap_saji'
      GROUP BY c.id, c.kelompok, c.sub_kelompok, c.kode_akun, c.nama_akun
      ORDER BY c.kode_akun`
    );

    details = detailRes.rows;
  } catch (err) {
    console.error("Gagal mengambil data P&L print:", err);
  } finally {
    client.release();
  }

  // Format Periode Label matching Screenshot 2
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  let periodSubtitle = "";
  let periodHeaderCol = "";

  if (dateFrom && dateTo) {
    const f1 = new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    const f2 = new Date(dateTo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    periodSubtitle = `Dari ${f1} s/d ${f2}`;
    periodHeaderCol = `${new Date(dateFrom).getDate()} - ${f2}`;
  } else if (dateFrom) {
    const f1 = new Date(dateFrom).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    periodSubtitle = `Per Tanggal ${f1}`;
    periodHeaderCol = f1;
  } else if (month && month !== "all") {
    periodSubtitle = `Bulan ${monthNames[Number(month) - 1]} ${year}`;
    periodHeaderCol = `${monthNames[Number(month) - 1]} ${year}`;
  } else {
    periodSubtitle = `Tahun ${year}`;
    periodHeaderCol = `Tahun ${year}`;
  }

  // Categorize
  const pendapatanAccounts = details.filter((d) => d.kelompok === "Pendapatan");
  const hppAccounts = details.filter((d) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Pokok Penjualan");
  const opexAccounts = details.filter((d) => d.kelompok === "Beban" && d.sub_kelompok === "Beban Operasional");
  const otherAccounts = details.filter(
    (d) => d.kelompok === "Beban" && d.sub_kelompok !== "Beban Pokok Penjualan" && d.sub_kelompok !== "Beban Operasional"
  );

  const totalPendapatan = pendapatanAccounts.reduce((s, a) => s + Number(a.total_nominal || 0), 0);
  const totalHpp = hppAccounts.reduce((s, a) => s + Number(a.total_nominal || 0), 0);
  const labaKotor = totalPendapatan - totalHpp;
  const totalOpex = opexAccounts.reduce((s, a) => s + Number(a.total_nominal || 0), 0);
  const labaOperasional = labaKotor - totalOpex;
  const totalOther = otherAccounts.reduce((s, a) => s + Number(a.total_nominal || 0), 0);
  const labaBersih = labaOperasional - totalOther;

  const fmtCurrency = (val: number) => {
    if (val === 0) return "-";
    if (val < 0) {
      return `-${Math.abs(val).toLocaleString("id-ID")}`;
    }
    return val.toLocaleString("id-ID");
  };

  return (
    <div style={{ background: "#e5e7eb", minHeight: "100vh", padding: "24px 12px", fontFamily: "'Source Sans 3', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      {/* Print Controls Toolbar */}
      <div
        className="no-print"
        style={{
          maxWidth: 820,
          margin: "0 auto 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "white",
          padding: "12px 20px",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2937" }}>
            Pratinjau Cetak Laba/Rugi Standar
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            (Format Resmi Accurate Online)
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="print-btn"
            style={{
              padding: "7px 16px",
              background: "#5005A6",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            🖨️ Cetak / Unduh PDF
          </button>
        </div>
      </div>

      {/* Main Paper Sheet (Matching Screenshot 2 Accurate Online) */}
      <div
        className="print-sheet"
        style={{
          maxWidth: 820,
          margin: "0 auto",
          background: "white",
          padding: "48px 56px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          borderRadius: 4,
          color: "#111827",
        }}
      >
        {/* Header Title Section */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#374151", margin: 0, letterSpacing: "0.02em" }}>
            DYummy Catering
          </h1>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#991b1b", margin: "6px 0 0" }}>
            Laba/Rugi (Standar)
          </h2>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#4b5563", margin: "4px 0 0" }}>
            {periodSubtitle}
          </p>
          <p style={{ fontSize: 11, fontStyle: "italic", color: "#6b7280", margin: "4px 0 0" }}>
            Cabang : [Semua Cabang], Mata Uang : Indonesian Rupiah
          </p>
        </div>

        {/* Table Layout */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #111827" }}>
              <th style={{ textAlign: "left", padding: "8px 0", fontWeight: 700, color: "#1e3a8a", width: "70%" }}>
                Deskripsi
              </th>
              <th style={{ textAlign: "right", padding: "8px 0", fontWeight: 700, color: "#1e3a8a", width: "30%" }}>
                {periodHeaderCol}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ── 1. PENDAPATAN ──────────────────────── */}
            <tr>
              <td colSpan={2} style={{ padding: "14px 0 4px", fontWeight: 800, color: "#111827", textTransform: "uppercase" }}>
                PENDAPATAN
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 0 2px 14px", fontWeight: 700, color: "#374151" }}>
                Pendapatan Operasional
              </td>
            </tr>

            {pendapatanAccounts.map((acc, idx) => (
              <tr key={idx}>
                <td style={{ padding: "2px 0 2px 28px", color: "#374151" }}>
                  {acc.nama_akun}
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", color: "#111827", fontFamily: "monospace", fontSize: 13 }}>
                  {fmtCurrency(Number(acc.total_nominal))}
                </td>
              </tr>
            ))}

            {pendapatanAccounts.length === 0 && (
              <tr>
                <td style={{ padding: "2px 0 2px 28px", color: "#9ca3af", fontStyle: "italic" }}>
                  (Tidak ada transaksi pendapatan)
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", fontFamily: "monospace", fontSize: 13 }}>0</td>
              </tr>
            )}

            {/* Subtotal Pendapatan */}
            <tr>
              <td style={{ padding: "8px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                Jumlah Pendapatan
              </td>
              <td style={{ textAlign: "right", padding: "8px 0 6px 0", fontWeight: 800, borderTop: "1px solid #111827", fontFamily: "monospace", fontSize: 13.5 }}>
                {fmtCurrency(totalPendapatan)}
              </td>
            </tr>

            {/* ── 2. BEBAN POKOK PENJUALAN ─────────────── */}
            <tr>
              <td colSpan={2} style={{ padding: "16px 0 4px", fontWeight: 800, color: "#111827", textTransform: "uppercase" }}>
                BEBAN POKOK PENJUALAN
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 0 2px 14px", fontWeight: 700, color: "#374151" }}>
                Beban Pokok Penjualan
              </td>
            </tr>

            {hppAccounts.map((acc, idx) => (
              <tr key={idx}>
                <td style={{ padding: "2px 0 2px 28px", color: "#374151" }}>
                  {acc.nama_akun}
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", color: "#111827", fontFamily: "monospace", fontSize: 13 }}>
                  {fmtCurrency(Number(acc.total_nominal))}
                </td>
              </tr>
            ))}

            {hppAccounts.length === 0 && (
              <tr>
                <td style={{ padding: "2px 0 2px 28px", color: "#9ca3af", fontStyle: "italic" }}>
                  (Tidak ada transaksi HPP)
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", fontFamily: "monospace", fontSize: 13 }}>0</td>
              </tr>
            )}

            {/* Subtotal HPP */}
            <tr>
              <td style={{ padding: "8px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                Jumlah Beban Pokok Penjualan
              </td>
              <td style={{ textAlign: "right", padding: "8px 0 6px 0", fontWeight: 800, borderTop: "1px solid #111827", fontFamily: "monospace", fontSize: 13.5 }}>
                {fmtCurrency(totalHpp)}
              </td>
            </tr>

            {/* ── 3. LABA KOTOR ────────────────────────── */}
            <tr style={{ borderTop: "1.5px solid #111827", borderBottom: "1px solid #d1d5db" }}>
              <td style={{ padding: "10px 0", fontWeight: 900, color: "#111827", fontSize: 14 }}>
                LABA KOTOR
              </td>
              <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 900, color: "#111827", fontFamily: "monospace", fontSize: 14.5 }}>
                {fmtCurrency(labaKotor)}
              </td>
            </tr>

            {/* ── 4. BEBAN OPERASIONAL ─────────────────── */}
            <tr>
              <td colSpan={2} style={{ padding: "16px 0 4px", fontWeight: 800, color: "#111827", textTransform: "uppercase" }}>
                BEBAN OPERASIONAL
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ padding: "2px 0 2px 14px", fontWeight: 700, color: "#374151" }}>
                Beban Operasional
              </td>
            </tr>

            {opexAccounts.map((acc, idx) => (
              <tr key={idx}>
                <td style={{ padding: "2px 0 2px 28px", color: "#374151" }}>
                  {acc.nama_akun}
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", color: "#111827", fontFamily: "monospace", fontSize: 13 }}>
                  {fmtCurrency(Number(acc.total_nominal))}
                </td>
              </tr>
            ))}

            {opexAccounts.length === 0 && (
              <tr>
                <td style={{ padding: "2px 0 2px 28px", color: "#9ca3af", fontStyle: "italic" }}>
                  (Tidak ada transaksi beban operasional)
                </td>
                <td style={{ textAlign: "right", padding: "2px 0", fontFamily: "monospace", fontSize: 13 }}>0</td>
              </tr>
            )}

            {/* Subtotal Beban Operasional */}
            <tr>
              <td style={{ padding: "8px 0 6px 0", fontWeight: 800, color: "#111827" }}>
                Jumlah Beban Operasional
              </td>
              <td style={{ textAlign: "right", padding: "8px 0 6px 0", fontWeight: 800, borderTop: "1px solid #111827", fontFamily: "monospace", fontSize: 13.5 }}>
                {fmtCurrency(totalOpex)}
              </td>
            </tr>

            {/* ── 5. LABA OPERASIONAL ──────────────────── */}
            <tr style={{ borderTop: "1px solid #111827" }}>
              <td style={{ padding: "10px 0", fontWeight: 800, color: "#111827" }}>
                LABA OPERASIONAL
              </td>
              <td style={{ textAlign: "right", padding: "10px 0", fontWeight: 800, color: "#111827", fontFamily: "monospace", fontSize: 14 }}>
                {fmtCurrency(labaOperasional)}
              </td>
            </tr>

            {/* ── 6. PENDAPATAN / BEBAN LAINNYA ────────── */}
            {otherAccounts.length > 0 && (
              <>
                <tr>
                  <td colSpan={2} style={{ padding: "16px 0 4px", fontWeight: 800, color: "#111827", textTransform: "uppercase" }}>
                    PENDAPATAN / (BEBAN) LAINNYA
                  </td>
                </tr>
                {otherAccounts.map((acc, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "2px 0 2px 28px", color: "#374151" }}>
                      {acc.nama_akun}
                    </td>
                    <td style={{ textAlign: "right", padding: "2px 0", color: "#111827", fontFamily: "monospace", fontSize: 13 }}>
                      {fmtCurrency(Number(acc.total_nominal))}
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* ── 7. LABA BERSIH ───────────────────────── */}
            <tr>
              <td
                style={{
                  padding: "16px 0 8px",
                  fontWeight: 900,
                  fontSize: 15,
                  color: "#111827",
                  borderTop: "2px solid #111827",
                  borderBottom: "3px double #111827",
                  textTransform: "uppercase",
                }}
              >
                LABA BERSIH
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "16px 0 8px",
                  fontWeight: 900,
                  fontSize: 16,
                  color: labaBersih >= 0 ? "#15803d" : "#b91c1c",
                  borderTop: "2px solid #111827",
                  borderBottom: "3px double #111827",
                  fontFamily: "monospace",
                }}
              >
                Rp {fmtCurrency(labaBersih)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Print script & media CSS */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function() {
              const btn = document.querySelector('.print-btn');
              if (btn) btn.onclick = function() { window.print(); };
              setTimeout(function() { window.print(); }, 600);
            });
          `,
        }}
      />

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body, html {
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print {
                display: none !important;
              }
              .print-sheet {
                box-shadow: none !important;
                padding: 15mm 15mm !important;
                max-width: 100% !important;
                border-radius: 0 !important;
              }
            }
          `,
        }}
      />
    </div>
  );
}
