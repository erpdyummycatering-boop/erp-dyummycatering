import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { fmt } from "@/lib/utils";

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const orderRes = await client.query(`
      SELECT o.*, c.name AS customer_name, c.phone, c.address, u.name AS pic_name
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
    `, [id]);

    const items = itemsRes.rows;
    const isLunas = order.status_payment === "Lunas";
    const itemsSubtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);

    return (
      <div className="print-container" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif", color: "#333", backgroundColor: "white" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #5005A6", paddingBottom: "20px", marginBottom: "30px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", color: "#5005A6", fontWeight: 800 }}>DYUMMY CATERING</h1>
            <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#666" }}>Jl. Kuliner Lezat No. 99, Bandung<br/>Telp: 0812-3456-7890 | IG: @dyummycatering</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ margin: 0, fontSize: "24px", color: "#333" }}>ORDER CONFIRMATION</h2>
            <p style={{ margin: "5px 0 0", fontSize: "14px", fontWeight: "bold" }}>#ORD-{String(order.id).padStart(4, "0")}</p>
            <div style={{ marginTop: "10px", display: "inline-block", padding: "5px 15px", borderRadius: "20px", border: `2px solid ${isLunas ? "#5005A6" : "#E24B4A"}`, color: isLunas ? "#5005A6" : "#E24B4A", fontWeight: "bold", fontSize: "12px" }}>
              {order.status_payment.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div style={{ display: "flex", gap: "40px", marginBottom: "30px", fontSize: "13px" }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Bill To:</h3>
            <p style={{ margin: "0 0 5px", fontWeight: "bold", fontSize: "15px" }}>{order.customer_name}</p>
            <p style={{ margin: "0 0 5px" }}>{order.phone || "-"}</p>
            <p style={{ margin: "0", color: "#555" }}>{order.address || "-"}</p>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "12px", color: "#666", textTransform: "uppercase", marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "5px" }}>Delivery Detail:</h3>
            <table style={{ width: "100%", fontSize: "13px", lineHeight: "1.8" }}>
              <tbody>
                <tr><td style={{ width: "100px", color: "#666" }}>Date:</td><td style={{ fontWeight: "bold" }}>{new Date(order.delivery_date).toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
                <tr>
                  <td style={{ color: "#666" }}>Time:</td>
                  <td>
                    {order.departure_time || "TBD"}
                    {order.arrival_time ? ` - ${order.arrival_time}` : ""}
                  </td>
                </tr>
                <tr><td style={{ color: "#666", verticalAlign: "top" }}>Venue:</td><td>{order.venue || "-"}</td></tr>
                <tr><td style={{ color: "#666" }}>PIC:</td><td>{order.pic_name || "-"}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Order Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "30px", fontSize: "13px" }}>
          <thead>
            <tr style={{ backgroundColor: "#5005A6", color: "white" }}>
              <th style={{ padding: "12px", textAlign: "left", border: "1px solid #5005A6" }}>Description</th>
              <th style={{ padding: "12px", textAlign: "center", border: "1px solid #5005A6", width: "80px" }}>Qty</th>
              <th style={{ padding: "12px", textAlign: "right", border: "1px solid #5005A6", width: "120px" }}>Unit Price</th>
              <th style={{ padding: "12px", textAlign: "right", border: "1px solid #5005A6", width: "100px" }}>Disc.</th>
              <th style={{ padding: "12px", textAlign: "right", border: "1px solid #5005A6", width: "140px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "12px", borderLeft: "1px solid #eee", borderRight: "1px solid #eee" }}>
                  <span style={{ fontWeight: "bold" }}>{item.product_name}</span>
                  {item.custom_menu && <div style={{ fontSize: "11px", color: "#666", marginTop: "4px" }}>{item.custom_menu}</div>}
                </td>
                <td style={{ padding: "12px", textAlign: "center", borderRight: "1px solid #eee" }}>{item.quantity}</td>
                <td style={{ padding: "12px", textAlign: "right", borderRight: "1px solid #eee" }}>{fmt(item.price)}</td>
                <td style={{ padding: "12px", textAlign: "right", borderRight: "1px solid #eee", color: "#E24B4A" }}>{Number(item.discount) > 0 ? "- " + fmt(item.discount) : "-"}</td>
                <td style={{ padding: "12px", textAlign: "right", borderRight: "1px solid #eee", fontWeight: "bold" }}>{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} rowSpan={2 + (Number(order.shipping_fee) > 0 ? 1 : 0) + (Number(order.additional_menu_price) > 0 ? 1 : 0)} style={{ padding: "12px", verticalAlign: "top", border: "1px solid #eee" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>
                  <strong>Notes:</strong><br/>
                  {order.order_notes || "Thank you for your business."}
                </div>
              </td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>Subtotal Item</td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>{fmt(itemsSubtotal)}</td>
            </tr>
            {Number(order.shipping_fee) > 0 && (
              <tr>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>Ongkir</td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>{fmt(order.shipping_fee)}</td>
              </tr>
            )}
            {Number(order.additional_menu_price) > 0 && (
              <tr>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>Tambahan Menu</td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>{fmt(order.additional_menu_price)}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", border: "1px solid #eee" }}>GRAND TOTAL</td>
              <td style={{ padding: "12px", textAlign: "right", fontWeight: "bold", fontSize: "16px", color: "#5005A6", border: "1px solid #eee" }}>{fmt(order.grand_total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer Signatures */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "50px", fontSize: "13px" }}>
          <div style={{ textAlign: "center", width: "200px" }}>
            <p style={{ margin: "0 0 60px" }}>Customer,</p>
            <p style={{ margin: 0, fontWeight: "bold", borderBottom: "1px solid #333", paddingBottom: "5px" }}>{order.customer_name}</p>
          </div>
          <div style={{ textAlign: "center", width: "200px" }}>
            <p style={{ margin: "0 0 60px" }}>Dyummy Catering,</p>
            <p style={{ margin: 0, fontWeight: "bold", borderBottom: "1px solid #333", paddingBottom: "5px" }}>Authorized Signature</p>
          </div>
        </div>

        {/* Auto Print Script */}
        <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
        
        {/* CSS for print to hide browser default headers/footers and margins */}
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
