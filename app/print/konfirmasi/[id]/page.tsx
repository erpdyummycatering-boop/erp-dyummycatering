import { notFound } from "next/navigation";
import pool from "@/lib/db";

function formatIndoDate(dateStr: Date | string) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[date.getDay()];

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();

  return `${dayName} / ${dd}-${mm}-${yyyy}`;
}

function formatRupiah(amount: number | string) {
  const val = Math.floor(Number(amount));
  return "Rp " + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default async function OrderConfirmationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const orderRes = await client.query(`
      SELECT o.*, c.name AS customer_name, c.phone, c.type AS customer_type, u.name AS pic_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      LEFT JOIN users u ON o.pic_id = u.id
      WHERE o.id = $1
    `, [id]);

    if (orderRes.rows.length === 0) {
      return notFound();
    }

    const order = orderRes.rows[0];

    const itemsRes = await client.query(`
      SELECT oi.*, p.name AS product_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
    `, [id]);

    const items = itemsRes.rows;

    return (
      <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif", color: "#000", backgroundColor: "white" }}>

        {/* Header Title */}
        <div style={{ marginBottom: "15px" }}>
          <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold", borderBottom: "0px solid #000", paddingBottom: "6px" }}>
            Konfirmasi Pemesanan - {order.pic_name || "Admin"}
          </p>
        </div>

        {/* Confirmation Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", border: "2px solid #000" }}>
          <tbody>
            {/* Nama Pemesan */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", width: "40%", fontSize: "14px" }}>Nama Pemesan</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", width: "60%", fontSize: "14px", fontWeight: "bold", textTransform: "uppercase" }}>
                {order.customer_name}
              </td>
            </tr>

            {/* Instansi */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Instansi</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {order.customer_type === "Umum" ? "" : (order.customer_type || "")}
              </td>
            </tr>

            {/* No. HP */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>No. HP</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {order.phone || "-"}
              </td>
            </tr>

            {/* Hari / Tanggal */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Hari / Tanggal</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {formatIndoDate(order.delivery_date)}
              </td>
            </tr>

            {/* Jam Berangkat */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Jam Berangkat</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {order.departure_time || "-"}
              </td>
            </tr>

            {/* Jam Sampai Lokasi */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Jam Sampai Lokasi</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {order.arrival_time || "-"}
              </td>
            </tr>

            {/* Kirim ke */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Kirim ke</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", whiteSpace: "pre-line" }}>
                {order.venue || "-"}
              </td>
            </tr>

            {/* Jenis Paket */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Jenis Paket</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: idx < items.length - 1 ? "4px" : 0 }}>
                    {item.product_name}
                  </div>
                ))}
              </td>
            </tr>

            {/* Paket Harga & Jumlah Pesan */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Paket Harga & Jumlah Pesan</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                {items.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: idx < items.length - 1 ? "4px" : 0 }}>
                    {formatRupiah(item.price)} x {item.quantity}
                  </div>
                ))}
              </td>
            </tr>

            {/* Biaya Ongkir */}
            {Number(order.shipping_fee) > 0 && (
              <tr>
                <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Biaya Ongkir (Ongkos Kirim)</td>
                <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                  {formatRupiah(order.shipping_fee)}
                </td>
              </tr>
            )}

            {/* Tambahan Harga Menu */}
            {Number(order.additional_menu_price) > 0 && (
              <tr>
                <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Tambahan Harga Menu</td>
                <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                  {formatRupiah(order.additional_menu_price)}
                </td>
              </tr>
            )}

            {/* Total Pemesanan (Grand Total) */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", fontWeight: "bold" }}>Total Pemesanan</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", fontWeight: "bold" }}>
                {formatRupiah(order.grand_total)}
              </td>
            </tr>

            {/* Dynamic Custom Menu Rows */}
            {items.map((item, itemIdx) => {
              const menuLines = (item.custom_menu || "")
                .split("\n")
                .map((line: string) => line.trim())
                .filter(Boolean);

              if (menuLines.length === 0) return null;

              return (
                <optgroup key={itemIdx} style={{ display: "contents" }}>
                  {menuLines.map((line: string, lineIdx: number) => (
                    <tr key={lineIdx}>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", fontWeight: lineIdx === 0 ? "bold" : "normal" }}>
                        {lineIdx === 0 ? `${item.product_name} (${item.quantity})` : ""}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>
                        {line}
                      </td>
                    </tr>
                  ))}
                  {/* Empty spacer row after each product menu list as in screenshot */}
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px", height: "20px" }}></td>
                    <td style={{ border: "1px solid #000", padding: "8px 12px", fontSize: "14px" }}></td>
                  </tr>
                </optgroup>
              );
            })}

            {/* Catatan */}
            <tr>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px" }}>Catatan</td>
              <td style={{ border: "1px solid #000", padding: "10px 12px", fontSize: "14px", whiteSpace: "pre-line" }}>
                {order.order_notes || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Auto Print Script */}
        <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />

        {/* CSS for print */}
        <style dangerouslySetInnerHTML={{
          __html: `
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
