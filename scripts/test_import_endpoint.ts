import pool from "../lib/db";

async function test() {
  const payload = {
    orders: [
      {
        customer_name: "Kurniawan Perkasa",
        customer_phone: "081299998888",
        customer_type: "Personal",
        pic_name: "Siti Rahayu",
        order_date: "2026-05-27",
        delivery_date: "2026-06-05",
        departure_time: "10:00:00",
        arrival_time: "11:00:00",
        venue: "Gedung Cyber Kuningan",
        order_notes: "Minta sendok plastik",
        status_order: "Baru",
        status_payment: "Belum Lunas",
        grand_total: 300000,
        items: [
          {
            product_name: "Paket Spesial Ayam",
            quantity: 10,
            price: 30000,
            notes: "Pedas saja",
            custom_menu: "1. NASI PUTIH\n2. AYAM SERUNDENG"
          }
        ]
      }
    ]
  };

  console.log("Mengirim payload import ke API...");
  try {
    const response = await fetch("http://localhost:3000/api/orders/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();
    console.log("Status HTTP:", response.status);
    console.log("Response JSON:", resJson);

    // Let's verify in DB directly
    const client = await pool.connect();
    try {
      const custCheck = await client.query("SELECT * FROM customers WHERE name = 'Kurniawan Perkasa'");
      console.log("Customer Terdaftar:", custCheck.rows);

      const orderCheck = await client.query("SELECT id, customer_id, pic_id, venue, status_order FROM orders WHERE customer_id = $1", [custCheck.rows[0]?.id]);
      console.log("Order Terdaftar:", orderCheck.rows);

      if (orderCheck.rows.length > 0) {
        const itemCheck = await client.query("SELECT * FROM order_items WHERE order_id = $1", [orderCheck.rows[0].id]);
        console.log("Order Items Terdaftar:", itemCheck.rows);
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Gagal melakukan request:", err.message);
  }
}

test().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
