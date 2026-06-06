import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { fmt } from "@/lib/utils";

export default async function PRPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const prRes = await client.query(
      `SELECT pr.*, u.name as chef_name, ps.target_date, ps.total_revenue,
        (SELECT json_agg(json_build_object(
          'id', pi.id, 'item_name', pi.item_name, 'quantity', pi.quantity,
          'uom', pi.uom, 'estimated_price', pi.estimated_price, 'subtotal', pi.subtotal
        ) ORDER BY pi.id) FROM pr_items pi WHERE pi.pr_id = pr.id) as items
       FROM purchase_requests pr
       LEFT JOIN users u ON pr.chef_id = u.id
       LEFT JOIN production_schedules ps ON pr.schedule_id = ps.id
       WHERE pr.id = $1`,
      [id]
    );

    if (!prRes.rows.length) return notFound();

    const pr = prRes.rows[0];
    const items: any[] = pr.items || [];
    const grandTotal = items.reduce((sum: number, it: any) => sum + Number(it.subtotal || 0), 0);
    const targetDate = pr.target_date
      ? new Date(pr.target_date).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
      : "-";
    const createdAt = pr.created_at
      ? new Date(pr.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })
      : "-";

    const statusColor = pr.status === "Approved" || pr.status === "Sent to Purchasing"
      ? "#5005A6"
      : pr.status === "Rejected"
      ? "#E24B4A"
      : "#BA7517";

    return (
      <div
        className="print-container"
        style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif", color: "#333", backgroundColor: "white" }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #5005A6", paddingBottom: "20px", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", color: "#5005A6", fontWeight: 800 }}>DYUMMY CATERING</h1>
            <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#666" }}>
              Jl. Kuliner Lezat No. 99, Bandung<br />
              Telp: 0812-3456-7890 | IG: @dyummycatering
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: "22px", color: "#333" }}>PURCHASE REQUEST</h2>
            <p style={{ margin: "5px 0 0", fontSize: "14px", fontWeight: "bold" }}>
              #PR-{String(pr.id).padStart(4, "0")}
            </p>
            <div style={{
              marginTop: "10px", display: "inline-block", padding: "5px 15px",
              borderRadius: "20px", border: `2px solid ${statusColor}`,
              color: statusColor, fontWeight: "bold", fontSize: "12px"
            }}>
              {(pr.status || "Draft").toUpperCase()}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div style={{ display: "flex", gap: "40px", marginBottom: "30px", fontSize: "13px" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>
              Dibuat Oleh:
            </h3>
            <p style={{ margin: "0 0 5px", fontWeight: "bold", fontSize: "15px" }}>{pr.chef_name || "-"}</p>
            <p style={{ margin: "0 0 5px", color: "#555" }}>Tanggal Buat: {createdAt}</p>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>
              Detail Produksi:
            </h3>
            <table style={{ width: "100%", fontSize: "13px", lineHeight: "1.8" }}>
              <tbody>
                <tr>
                  <td style={{ width: "130px", color: "#666" }}>Tanggal Acara:</td>
                  <td style={{ fontWeight: "bold" }}>{targetDate}</td>
                </tr>
                <tr>
                  <td style={{ color: "#666" }}>Total Revenue:</td>
                  <td style={{ fontWeight: "bold", color: "#5005A6" }}>{fmt(pr.total_revenue || 0)}</td>
                </tr>
                <tr>
                  <td style={{ color: "#666" }}>Schedule ID:</td>
                  <td>#{String(pr.schedule_id || "-").padStart(4, "0")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#5005A6", color: "white" }}>
              <th style={{ padding: "12px", textAlign: "left", border: "1px solid #5005A6", width: "36px" }}>No.</th>
              <th style={{ padding: "12px", textAlign: "left", border: "1px solid #5005A6" }}>Nama Bahan / Item</th>
              <th style={{ padding: "12px", textAlign: "center", border: "1px solid #5005A6", width: "70px" }}>Qty</th>
              <th style={{ padding: "12px", textAlign: "center", border: "1px solid #5005A6", width: "60px" }}>Satuan</th>
              <th style={{ padding: "12px", textAlign: "right", border: "1px solid #5005A6", width: "130px" }}>Harga Est./Satuan</th>
              <th style={{ padding: "12px", textAlign: "right", border: "1px solid #5005A6", width: "130px" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, index: number) => (
              <tr key={index} style={{ borderBottom: "1px solid #eee", backgroundColor: index % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 12px", textAlign: "center", borderLeft: "1px solid #eee", borderRight: "1px solid #eee", color: "#6b7280" }}>
                  {index + 1}
                </td>
                <td style={{ padding: "10px 12px", borderRight: "1px solid #eee", fontWeight: "600" }}>
                  {item.item_name}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center", borderRight: "1px solid #eee" }}>
                  {Number(item.quantity).toLocaleString("id-ID")}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "center", borderRight: "1px solid #eee", color: "#6b7280" }}>
                  {item.uom}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", borderRight: "1px solid #eee", color: "#6b7280" }}>
                  {fmt(item.estimated_price)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", borderRight: "1px solid #eee", fontWeight: "bold", color: "#111827" }}>
                  {fmt(item.subtotal)}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontStyle: "italic" }}>
                  Tidak ada item dalam PR ini.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#f3f4f6" }}>
              <td colSpan={4} style={{ padding: "12px", border: "1px solid #e5e7eb" }} />
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #e5e7eb", color: "#374151" }}>
                TOTAL ESTIMASI HPP
              </td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "16px", color: "#5005A6", border: "1px solid #e5e7eb" }}>
                {fmt(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Notes */}
        {pr.notes && (
          <div style={{ marginBottom: "30px", padding: "14px 18px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", fontSize: "13px" }}>
            <strong style={{ color: "#92400e" }}>Catatan:</strong>
            <p style={{ margin: "4px 0 0", color: "#78350f" }}>{pr.notes}</p>
          </div>
        )}

        {/* Footer Signatures */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px", fontSize: "13px" }}>
          <div style={{ textAlign: "center", width: "200px" }}>
            <p style={{ margin: "0 0 60px" }}>Dibuat oleh,</p>
            <p style={{ margin: 0, fontWeight: "bold", borderBottom: "1px solid #333", paddingBottom: "5px" }}>
              {pr.chef_name || "Chef"}
            </p>
          </div>
          <div style={{ textAlign: "center", width: "200px" }}>
            <p style={{ margin: "0 0 60px" }}>Disetujui oleh,</p>
            <p style={{ margin: 0, fontWeight: "bold", borderBottom: "1px solid #333", paddingBottom: "5px" }}>
              Manajer Purchasing
            </p>
          </div>
        </div>

        {/* Auto Print */}
        <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />

        {/* Print CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 0; size: A4; }
            body { margin: 1cm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}} />
      </div>
    );
  } finally {
    client.release();
  }
}
