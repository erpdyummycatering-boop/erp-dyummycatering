import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

neonConfig.webSocketConstructor = ws;

const DB = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
const pool = new Pool({ connectionString: DB });

async function q(sql: string, params: any[] = []) {
  const client = await pool.connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

async function seed() {
  console.log("🌱 Seeding...");

  await q("DELETE FROM overheads");
  await q("DELETE FROM purchase_orders");
  await q("DELETE FROM pr_items");
  await q("DELETE FROM purchase_requests");
  await q("DELETE FROM schedule_menus");
  await q("DELETE FROM schedule_orders");
  await q("DELETE FROM production_schedules");
  await q("DELETE FROM order_items");
  await q("DELETE FROM orders");
  await q("DELETE FROM leads");
  await q("DELETE FROM recipes");
  await q("DELETE FROM products");
  await q("DELETE FROM product_categories");
  await q("DELETE FROM customers");
  await q("DELETE FROM users");

  // Reset sequences
  for (const t of ["users","product_categories","products","recipes","customers","leads","orders","order_items","production_schedules","purchase_requests","purchase_orders","overheads"]) {
    await q(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
  }

  // USERS
  await q(`INSERT INTO users (name,email,role,status) VALUES
    ('Siti Rahayu','siti@dyummy.com','CS / Sales','Aktif'),
    ('Rina Marlina','rina@dyummy.com','CS / Sales','Aktif'),
    ('Chef Juna','chef@dyummy.com','Kitchen','Aktif'),
    ('Andi Finance','finance@dyummy.com','Finance','Aktif'),
    ('Bagas Purchasing','purchasing@dyummy.com','Purchasing','Aktif'),
    ('Super Admin','admin@dyummy.com','Super Admin','Aktif')`);
  console.log("✓ Users");

  // PRODUCT CATEGORIES
  await q(`INSERT INTO product_categories (name) VALUES ('Nasi Box'), ('Snack Box'), ('Prasmanan'), ('Tumpeng'), ('Coffee Break')`);
  console.log("✓ Product Categories");

  const catRes = await q("SELECT id, name FROM product_categories");
  const catMap = Object.fromEntries(catRes.rows.map((c: any) => [c.name, Number(c.id)]));

  // PRODUCTS
  await q(`INSERT INTO products (name,category_id,price,status,description,image_url) VALUES
    ('Paket A',$1,35000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki)\n3. Menu Telur (Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)\n4. Cah/Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)\n5. Sup/Soto (Sup bakso, Sup Sosis, Sup Ayam, Soto Bandung)\n6. Kerupuk\n7. Buah Potong\n8. Air Mineral','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png'),
    ('Paket B (40k)',$1,40000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam)\n3. Menu Ikan/Telur (Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang, Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)\n4. Cah/Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)\n5. Sup/Soto (Sup bakso, sup sosis, sup ayam, soto Bandung)\n6. Kerupuk\n7. Buah Potong\n8. Air Mineral','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png'),
    ('Paket B (45k)',$1,45000,'Aktif','1. Nasi Putih\n2. Menu Daging (Gepuk, Sapi lada Hitam, Rendang, Sate Daging Sapi, Rolade Sapi, Semur Daging)\n3. Menu Ayam/Ikan/Telur (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam, Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang, Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)\n4. Cah/ Tumis (Capcay, Cah Jagung Semi Sosis, Sambal Goreng Kentang Ati, Bihun Sayur, Mie Goreng Bakso)\n5. Sup/ Soto (Sup bakso, sup sosis, sup ayam, soto Bandung)\n6. Kerupuk\n7. Buah Potong\n8. Air Mineral','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png'),
    ('Paket C',$1,50000,'Aktif','1. Nasi Putih\n2. Menu Daging (Gepuk, Sapi lada Hitam, Rendang, Sate Daging Sapi, Rolade Sapi, Semur Daging)\n3. Menu Ayam/Ikan (Ayam Suwir, Ayam Bakar, Ayam Asam Manis, Ayam Teriyaki, Sate Ayam, Ikan Kakap/Dori Asam Manis, Ikan kakap/Dori Saos Padang)\n4. Menu Telur (Rolade, Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Cabe Hejo)\n5. Cah/ Tumis (Capcay, cah jagung semi sosis, sambal goreng kentang-ati, bihun sayur, mie goreng)\n6. Sup/ Soto (Sup Bakso, sup sosis, sup ayam, soto Bandung)\n7. Kerupuk\n8. Buah Potong\n9. Air Mineral','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/prasmanan.png'),
    ('Paket Spesial Ayam',$2,30000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)\n3. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n4. Perkedel / Tahu / Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)\n5. Lalapan\n6. Sambal\n7. Kerupuk\n8. Air Mineral Cup','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png'),
    ('Paket Spesial Sapi',$2,32000,'Aktif','1. Nasi Putih\n2. Daging Sapi (Rendang Sapi, Gepuk, Semur Sapi, Sapi Lada Hitam)\n3. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n4. Perkedel / Tahu / Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)\n5. Lalapan\n6. Sambal\n7. Kerupuk\n8. Air Mineral Cup','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png'),
    ('Paket Istimewa',$2,36000,'Aktif','1. Nasi Putih\n2. Daging Sapi/Ikan/Ayam (Rendang Sapi, Gepuk, Sapi Lada Hitam, Kakap Asam Manis, Kakap Saos Padang, Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)\n3. Telur (Telur Balado, Telur Semur, Telur Bumbu Kuning, Telur Bumbu Hejo)\n4. Sayur/Tumis (Capcay, Sambal Goreng Kentang, Pecel Sayur, Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n5. Perkedel/Jugung/Kentang, Tahu/Tempe Goreng (Perkedel jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng, Tahu Bacem, Tempe Bacem)\n6. Lalapan\n7. Sambal\n8. Kerupuk','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png'),
    ('Paket Hemat',$2,22000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)\n3. Sayur/Tumis (Kimlo, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n4. Lalapan\n5. Sambal\n6. Kerupuk','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png'),
    ('Paket Nikmat',$2,25000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)\n3. Sayur/Tumis (Kimlo, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n4. Tahu/Tempe (Tahu Goreng/Bacem, Tempe Goreng/Bacem)\n5. Lalapan\n6. Sambal\n7. Kerupuk','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png'),
    ('Paket Lengkap',$2,27000,'Aktif','1. Nasi Putih\n2. Menu Ayam (Ayam Bakar, Ayam Goreng, Ayam Serundeng, Ayam Bumbu Hejo, Ayam Bumbu Kecap, Ayam Balado)\n3. Sayur/Tumis (Orak Arik Buncis, Kimlo, Acar Wortel, Orek Tempe, Cah Tahu Buncis, Mie Goreng Bakso, Bihun Sayur)\n4. Perkedel/Tahu/Tempe (Perkedel Jagung, Perkedel Kentang, Tahu Goreng, Tempe Goreng)\n5. Lalapan\n6. Sambal\n7. Kerupuk','https://paq7eb6vqmyqlov3.public.blob.vercel-storage.com/nasibox.png')`,
    [catMap['Prasmanan'], catMap['Nasi Box']]
  );
  console.log("✓ Products");

  // RECIPES
  await q(`INSERT INTO recipes (product_id,menu_name,ingredients,standard_cost) VALUES
    (1,'Ayam Bakar Kecap','Ayam potong, kecap, bumbu',9000),
    (1,'Telur Balado','Telur, cabai, tomat',3500),
    (1,'Tempe Orek','Tempe, cabai, kecap',2500),
    (2,'Sapi Lada Hitam','Daging sapi, paprika, lada hitam',22000),
    (2,'Ayam Geprek','Ayam fillet, sambal geprek',11000),
    (3,'Tumis Udang Brokoli','Udang, brokoli, saus tiram',14000),
    (4,'Gulai Kambing','Kambing, santan, rempah',28000),
    (4,'Rendang Daging','Sapi, santan, bumbu rendang',26000),
    (5,'Ikan Asam Pedas','Ikan tongkol, asam, cabai',12000),
    (6,'Beef Wellington','Beef tenderloin, pastry, mushroom',45000),
    (7,'Salmon Panggang','Salmon fillet, herbs, lemon',42000),
    (8,'Risoles Ragout','Tepung, ragout ayam',4500),
    (9,'Kroket Kentang','Kentang, daging cincang',6000),
    (10,'Tumpeng Kuning','Nasi kuning, aneka lauk, urap',18000)`);
  console.log("✓ Recipes");

  // CUSTOMERS
  await q(`INSERT INTO customers (name,phone,email,type,address) VALUES
    ('PT Maju Bersama','08121000001','maju@co.com','Corporate','Jl. Sudirman No.1 Jakarta'),
    ('APTIKOM Jabar','08121000002','aptikom@org.id','Instansi','Jl. Dipati Ukur No.35 Bandung'),
    ('Ressa Permata','08121000003','ressa@gmail.com','Personal','Jl. Buah Batu No.22 Bandung'),
    ('Yayasan Nurul Iman','08121000004','nurul@yas.org','Instansi','Jl. Pelajar No.8 Bandung'),
    ('Hotel Savoy Homann','08121000005','savoy@hotel.com','Corporate','Jl. Asia Afrika Bandung'),
    ('Unpad','08121000006','unpad@ac.id','Instansi','Jl. Raya Bandung-Sumedang'),
    ('Dinas Kesehatan Jabar','08121000007','dinkes@jabar.go.id','Pemerintah','Jl. Pasteur No.25'),
    ('Komunitas PKK','08121000008','pkk@bdg.go.id','Komunitas','Jl. Merdeka No.3 Bandung'),
    ('Hendra Wijaya','08121000009','hendra@gmail.com','Personal','Jl. Setiabudi No.11'),
    ('CV Kreatif Digital','08121000010','kreatif@digi.com','Corporate','Jl. Industri No.5')`);
  console.log("✓ Customers");

  // LEADS — Siti (id=1): 26 leads, 9 closing => CR 34.6%
  //          Rina (id=2): 13 leads, 3 closing => CR 23%
  await q(`INSERT INTO leads (customer_id,pic_id,lead_date,source,status,tags,notes) VALUES
    (1,1,'2026-04-28','WhatsApp','Closing','repeat,korporat','Deal confirmed'),
    (3,1,'2026-04-29','Instagram','Closing','pernikahan','Prasmanan VIP 150pax'),
    (5,1,'2026-04-30','Referral','Closing','hotel,vip','Gala dinner'),
    (2,1,'2026-05-01','Website','Follow Up','instansi','Nunggu approval'),
    (4,1,'2026-05-02','WhatsApp','Negosiasi','yayasan','Minta diskon 10%'),
    (6,1,'2026-05-03','Referral','Closing','universitas','Wisuda S2 500 box'),
    (7,1,'2026-05-04','Website','Follow Up','pemerintah','Perlu SPK dulu'),
    (8,1,'2026-05-05','WhatsApp','Closing','komunitas','Order mingguan OK'),
    (9,1,'2026-05-06','Instagram','Prospek','personal','Masih survei'),
    (10,1,'2026-05-07','Website','Follow Up','startup','Nanya harga'),
    (1,1,'2026-05-08','WhatsApp','Closing','repeat','Order ke-3 bulan ini'),
    (3,1,'2026-05-09','Referral','Negosiasi','pernikahan','Nego jumlah pax'),
    (5,1,'2026-05-10','Website','Follow Up','hotel','Tunggu event'),
    (2,1,'2026-05-11','WhatsApp','Closing','instansi','SPK sudah turun'),
    (4,1,'2026-05-12','Instagram','Prospek','yayasan','Pertimbangan'),
    (6,1,'2026-05-13','Referral','Closing','universitas','Seminar 200 pax'),
    (7,1,'2026-05-14','WhatsApp','Follow Up','pemerintah','Rapat koordinasi'),
    (8,1,'2026-05-15','Instagram','Closing','komunitas','Rutin minggu ini'),
    (9,1,'2026-05-16','Website','Reject','personal','Budget tidak cocok'),
    (10,1,'2026-05-17','WhatsApp','Follow Up','startup','Coba sample'),
    (1,1,'2026-05-18','Referral','Closing','repeat','Approved GM'),
    (3,1,'2026-05-19','WhatsApp','Prospek','pernikahan','Survey lokasi'),
    (5,1,'2026-05-20','Instagram','Follow Up','hotel','Pending Q2'),
    (2,1,'2026-05-21','Website','Negosiasi','instansi','Nego harga'),
    (4,1,'2026-05-22','Referral','Closing','yayasan','Deal lebaran'),
    (6,1,'2026-05-23','WhatsApp','Follow Up','universitas','Tunggu dekan'),
    (7,2,'2026-05-01','Instagram','Follow Up','pemerintah','Belum direspon'),
    (8,2,'2026-05-03','WhatsApp','Closing','komunitas','30 pax kecil'),
    (9,2,'2026-05-05','Website','Prospek','personal','Lihat-lihat'),
    (10,2,'2026-05-07','Referral','Negosiasi','startup','Cicil DP'),
    (1,2,'2026-05-09','WhatsApp','Reject','korporat','Sudah vendor lain'),
    (3,2,'2026-05-11','Instagram','Follow Up','pernikahan','Mau visit dapur'),
    (4,2,'2026-05-13','Website','Closing','yayasan','Kecil tapi pasti'),
    (5,2,'2026-05-15','WhatsApp','Prospek','hotel','Sales kontak'),
    (6,2,'2026-05-17','Referral','Closing','universitas','50 pax acara kecil'),
    (7,2,'2026-05-19','Instagram','Follow Up','pemerintah','Ganti PIC'),
    (8,2,'2026-05-21','WhatsApp','Negosiasi','komunitas','Nego frekuensi'),
    (9,2,'2026-05-22','Website','Reject','personal','Terlalu mahal'),
    (10,2,'2026-05-23','Referral','Prospek','startup','Ngobrol awal')`);
  console.log("✓ Leads");

  // ORDERS (12 orders)
  const orders = [
    [1,1,1,'2026-04-28','2026-05-05','07:00','Gedung PT Maju Jakarta','Selesai','Lunas'],
    [3,3,1,'2026-04-29','2026-05-10','08:00','Ballroom Savannah Bandung','Selesai','Lunas'],
    [5,3,1,'2026-04-30','2026-05-12','09:00','Hotel Savoy Ballroom','Selesai','DP 50%'],
    [6,6,1,'2026-05-03','2026-05-17','07:30','Grha Sanusi Unpad','Diproses','Belum Lunas'],
    [8,8,1,'2026-05-05','2026-05-12','08:00','Balai RW 05 Cibeunying','Selesai','Lunas'],
    [11,1,1,'2026-05-08','2026-05-19','07:00','Kantor Pusat PT Maju','Baru','DP 50%'],
    [14,2,1,'2026-05-11','2026-05-24','08:00','Aula APTIKOM Bandung','Diproses','Belum Lunas'],
    [25,4,1,'2026-05-22','2026-05-28','09:00','Yayasan Nurul Iman','Baru','Belum Lunas'],
    [28,8,2,'2026-05-03','2026-05-10','08:00','Balai Warga','Selesai','Lunas'],
    [33,4,2,'2026-05-13','2026-05-20','08:30','Aula Yayasan','Selesai','Lunas'],
    [35,6,2,'2026-05-17','2026-05-25','08:00','Aula Universitas','Baru','Belum Lunas'],
    [null,9,1,'2026-05-21','2026-05-30','10:00','Rumah Hendra Bandung','Baru','Belum Lunas'],
  ];
  for (const [lead_id,cust_id,pic_id,order_date,delivery_date,dep_time,venue,status_order,status_payment] of orders) {
    await q(`INSERT INTO orders (lead_id,customer_id,pic_id,order_date,delivery_date,departure_time,venue,status_order,status_payment,grand_total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)`,
      [lead_id,cust_id,pic_id,order_date,delivery_date,dep_time,venue,status_order,status_payment]);
  }
  console.log("✓ Orders");

  // ORDER ITEMS (multi-item per order)
  const items = [
    // order 1: Nasi Box Reguler 200pax + Snack Mini 100pax
    [1,1,28000,200,0],
    [1,3,15000,100,0],
    // order 2: Prasmanan VIP 150pax
    [2,6,85000,150,0],
    // order 3: Prasmanan VIP 200pax
    [3,6,85000,200,0],
    // order 4: Nasi Box Premium 400pax
    [4,2,35000,400,0],
    // order 5: Nasi Box Reguler 90pax
    [5,1,28000,90,0],
    // order 6: Nasi Box Premium 200pax + Snack Premium 100pax + Coffee Break 50pax
    [6,2,35000,200,0],
    [6,4,22000,100,0],
    [6,8,18000,50,0],
    // order 7: Nasi Box Reguler 150pax + Snack Mini 100pax
    [7,1,28000,150,0],
    [7,3,15000,100,0],
    // order 8: Nasi Box Reguler 200pax
    [8,1,28000,200,0],
    // order 9: Nasi Box Reguler 30pax
    [9,1,28000,30,0],
    // order 10: Prasmanan Standar 30pax + Snack Mini 10pax
    [10,5,65000,30,0],
    [10,3,15000,10,0],
    // order 11: Nasi Box Reguler 50pax + Snack Mini 20pax
    [11,1,28000,50,0],
    [11,3,15000,20,0],
    // order 12: Prasmanan Standar 50pax + Coffee Break 20pax
    [12,5,65000,50,0],
    [12,8,18000,20,0],
  ];
  for (const [oid,pid,price,qty,disc] of items) {
    await q(`INSERT INTO order_items (order_id,product_id,price,quantity,discount,subtotal)
      VALUES ($1,$2,$3,$4,$5,$6)`,
      [oid,pid,price,qty,disc,(price*qty)-disc]);
  }
  // Update grand_total
  await q(`UPDATE orders o SET grand_total=(SELECT COALESCE(SUM(subtotal),0) FROM order_items WHERE order_id=o.id)`);
  console.log("✓ Order Items");

  // PRODUCTION SCHEDULES
  // Jadwal 1 (5 Mei) — Approved: total revenue order 1+5 = 7300k, budget 3650k, HPP 4250k... wait, let's use real
  // PS1: order1+5 revenue = 28000*200+15000*100 + 28000*90 = 5600+1500+2520 = 9620k, budget=4810k, hpp=4250k => Approved
  // PS2: order2+3 = 12750k+17000k=29750k, budget=14875k, hpp=15200k => Overbudget
  // PS3: order6 = 35000*200+22000*100+18000*50 = 7000+2200+900=10100k, budget=5050k, hpp=0 => Draft
  await q(`INSERT INTO production_schedules (chef_id,target_date,total_revenue,budget_limit,total_estimated_hpp,status) VALUES
    (3,'2026-05-05',9620000,4810000,4250000,'Approved'),
    (3,'2026-05-12',29750000,14875000,15200000,'Overbudget Warning'),
    (3,'2026-05-19',10100000,5050000,0,'Draft')`);

  await q(`INSERT INTO schedule_orders (schedule_id,order_id) VALUES (1,1),(1,5),(2,2),(2,3),(3,6),(3,7)`);

  await q(`INSERT INTO schedule_menus (schedule_id,recipe_id,quantity_pax,hpp_subtotal) VALUES
    (1,1,200,1800000),(1,2,200,700000),(1,3,200,500000),(1,1,90,810000),(1,2,90,315000),(1,3,90,125000),
    (2,10,150,6750000),(2,11,150,6300000),(2,7,200,5600000),(2,8,200,5200000)`);
  console.log("✓ Production Schedules");

  // PURCHASE REQUESTS
  await q(`INSERT INTO purchase_requests (schedule_id,chef_id,total_pr_value,status) VALUES
    (1,3,4250000,'Sent to Purchasing'),
    (2,3,15200000,'Sent to Purchasing')`);

  await q(`INSERT INTO pr_items (pr_id,item_name,quantity,uom,estimated_price,subtotal) VALUES
    (1,'Ayam Potong',30,'Ekor',40000,1200000),
    (1,'Telur Ayam',10,'Kg',28000,280000),
    (1,'Tempe',15,'Kg',15000,225000),
    (1,'Kemasan Box',300,'Pcs',3500,1050000),
    (1,'Bumbu Jadi',1,'Paket',500000,500000),
    (2,'Beef Tenderloin',30,'Kg',200000,6000000),
    (2,'Salmon Fillet',30,'Kg',180000,5400000),
    (2,'Daging Sapi Rendang',35,'Kg',130000,4550000),
    (2,'Bahan Pelengkap',1,'Paket',1250000,1250000)`);

  await q(`INSERT INTO purchase_orders (pr_id,purchasing_id,finance_id,po_date,total_actual_cost,status_po,status_cost,variance_notes) VALUES
    (1,5,4,'2026-05-04',4100000,'Selesai Belanja','Safe','Sesuai estimasi, hemat 150rb'),
    (2,5,4,'2026-05-11',18500000,'Selesai Belanja','Overbudget','Daging impor naik 15% krn kurs dolar. Salmon langka +20rb/kg. Variance Rp3.3 juta')`);
  console.log("✓ PR & PO");

  // OVERHEADS
  await q(`INSERT INTO overheads (finance_id,expense_date,category,amount,notes) VALUES
    (4,'2026-05-05','Kemasan',350000,'Box premium + mika'),
    (4,'2026-05-05','Transportasi',150000,'Bensin 2 motor antar'),
    (4,'2026-05-05','Gas',200000,'Isi 2 tabung 12kg'),
    (4,'2026-05-05','Uang Makan',120000,'5 kru dapur'),
    (4,'2026-05-12','Kemasan',520000,'Box VIP + tissue'),
    (4,'2026-05-12','Transportasi',250000,'Sewa pickup ke Jakarta'),
    (4,'2026-05-12','Gas',200000,'Isi tabung gas'),
    (4,'2026-05-12','Uang Makan',150000,'6 kru + lembur'),
    (4,'2026-05-17','Kemasan',280000,'Box reguler bulk'),
    (4,'2026-05-17','Transportasi',120000,'Bensin operasional'),
    (4,'2026-05-17','Listrik',180000,'Tagihan listrik dapur'),
    (4,'2026-05-19','Gas',200000,'Tabung gas mingguan'),
    (4,'2026-05-19','Transportasi',180000,'Antar + belanja bahan'),
    (4,'2026-05-24','Uang Makan',130000,'4 kru pagi')`);
  console.log("✓ Overheads");

  console.log("🎉 Seed complete!");
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
